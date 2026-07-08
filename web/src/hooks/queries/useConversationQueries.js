import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/zustand/useAuthStore';
import useE2eeStore from '../../store/zustand/useE2eeStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { api } from '../../store/zustand/useAuthStore';
import { encryptText } from '../../utils/cryptoUtils';
import dbService from '../../utils/indexedDb';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const convoKeys = {
    list: (userId) => ['conversations', userId],
    searchConvos: (userId, q) => ['conversations', 'search', userId, q],
    messages: (convId) => ['messages', convId],
    search: (convId, q) => ['messages', 'search', convId, q],
};

// ─── CONVERSATIONS LIST (Infinite Scroll) ─────────────────────────────────────
export function useConversations(userId) {
    const setUnreadCount = useConversationStore(s => s.setUnreadCount);
    return useInfiniteQuery({
        queryKey: convoKeys.list(userId),
        queryFn: async ({ pageParam = null }) => {
            const cacheKey = `conversations_${userId}`;
            if (!pageParam) {
                const cached = await dbService.getCache(cacheKey);
                if (cached) return cached;
            }
            const res = await api.get(`${BASE}/api/conversation`, {
                params: { cursor: pageParam, limit: 20 }
            });
            const data = res.data.conversations || [];

            // Sync unread counts into Zustand
            data.forEach(conv => {
                if (!conv.lastMessage?.isRead && conv.lastMessageBy !== userId) {
                    setUnreadCount(conv._id, 1);
                }
            });

            if (!pageParam && res.data) {
                await dbService.setCache(cacheKey, res.data);
            }

            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes (Socket.io handles real-time sync)
    });
}

// ─── CONVERSATION SEARCH ──────────────────────────────────────────────────────
export function useSearchConversations(userId, query) {
    return useQuery({
        queryKey: convoKeys.searchConvos(userId, query),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation/search`, {
                params: { q: query }
            });
            return res.data || [];
        },
        enabled: !!userId && query.length > 1,
        staleTime: 1000 * 60,
    });
}

// ─── MESSAGES (infinite, oldest-first) ───────────────────────────────────────
export function useMessages(participantIds) {
    const myId = useAuthStore.getState().user?._id;
    const recipientId = participantIds?.find(id => id !== myId);
    return useQuery({
        queryKey: convoKeys.messages(participantIds?.sort().join('-')),
        queryFn: async () => {
            const cacheKey = `messages_${participantIds?.sort().join('-')}`;

            // ✅ CACHE HYDRATION (IndexedDB)
            const cached = await dbService.getCache(cacheKey);
            if (cached) {
                // Return cached data immediately, then fetch fresh in background
                // React Query handles background updating automatically since staleTime is used
                return cached;
            }

            const res = await api.post(`${BASE}/api/conversation/messages`, { recipientId });

            if (res.data && Array.isArray(res.data.messages)) {
                const decryptMessage = useE2eeStore.getState().decryptMessage;
                res.data.messages = await Promise.all(
                    res.data.messages.map(msg => decryptMessage(msg, recipientId))
                );
            }

            // ✅ UPDATE CACHE
            if (res.data) {
                await dbService.setCache(cacheKey, res.data);
            }

            return res.data; // { messages, conversation }
        },
        enabled: !!participantIds && participantIds.length === 2,
        staleTime: 1000 * 60 * 5, // 5 minutes (Socket.io handles real-time sync)
    });
}

// ─── MESSAGE SEARCH ───────────────────────────────────────────────────────────
export function useMessageSearch(conversationId, query) {
    return useQuery({
        queryKey: convoKeys.search(conversationId, query),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation/messages/search`, {
                params: { conversationId, q: query }
            });
            return res.data;
        },
        enabled: !!conversationId && query.length > 1,
        staleTime: 1000 * 60,
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export function useCreateConversation() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: (recipientId) =>
            api.post(`${BASE}/api/conversation/create`, { recipientId }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
        },
    });
}

export function useSendMessage() {
    const addSocketMessage = useConversationStore(s => s.addSocketMessage);
    const user = useAuthStore(s => s.user);
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ conversationId, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize, sharedPost, replyTo, storyReply, fileKey, fileIv }) => {
            const e2eeState = useE2eeStore.getState();
            let finalContent = content;
            let finalMediaUrl = mediaUrl;
            let finalMediaName = mediaName;
            let isEncrypted = false;

            if (e2eeState.privateKey && conversationId) {
                const aesKey = await e2eeState.getConversationKey(conversationId, recipientId);
                if (aesKey) {
                    isEncrypted = true;
                    if (content) {
                        const encrypted = await encryptText(content, aesKey);
                        finalContent = JSON.stringify(encrypted);
                    }
                    if (mediaUrl) {
                        const encryptedUrl = await encryptText(mediaUrl, aesKey);
                        finalMediaUrl = JSON.stringify(encryptedUrl);
                    }
                    if (mediaName || fileKey) {
                        const fileMetadata = {
                            name: mediaName,
                            key: fileKey || null,
                            iv: fileIv || null
                        };
                        const encryptedMeta = await encryptText(JSON.stringify(fileMetadata), aesKey);
                        finalMediaName = JSON.stringify(encryptedMeta);
                    }
                }
            }

            return api.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, content: finalContent,
                senderName: user.fullname, recipientId,
                mediaUrl: finalMediaUrl, mediaType, mediaName: finalMediaName, mediaSize,
                sharedPost, replyTo, storyReply, isEncrypted
            });
        },
        onSuccess: (res, { conversationId }) => {
            // Optimistically add to Zustand socket messages
            addSocketMessage(conversationId, res.data);

            // Optimistically update conversation list lastMessage
            const message = res.data;
            const userConvoKey = convoKeys.list(user?._id);
            qc.setQueryData(userConvoKey, (old) => {
                if (!old || !old.pages) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        conversations: (page.conversations || []).map(c => String(c._id) === String(conversationId || message.conversationId) ? {
                            ...c,
                            lastMessage: {
                                id: message._id,
                                message: message.content || (message.media ? `📎 ${message.media.type || 'file'}` : 'New message'),
                                isRead: false,
                                isReply: !!message.replyTo
                            },
                            lastMessageAt: message.createdAt || new Date().toISOString(),
                            lastMessageBy: message.senderId || message.sender
                        } : c)
                    }))
                };
            });
        },
    });
}

export function useEditMessage() {
    const qc = useQueryClient();
    const updateMessageStatus = useConversationStore(s => s.updateMessageStatus);
    return useMutation({
        mutationFn: ({ messageId, content, conversationId }) =>
            api.patch(`${BASE}/api/conversation/messages/${messageId}`, { content }),
        onSuccess: (res, { conversationId, messageId }) => {
            updateMessageStatus(conversationId, messageId, { content: res.data.content, edited: true });
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useDeleteMessage() {
    const qc = useQueryClient();
    const deleteSocketMessage = useConversationStore(s => s.deleteSocketMessage);
    return useMutation({
        mutationFn: ({ messageId, conversationId, mode = 'everyone' }) =>
            api.delete(`${BASE}/api/conversation/messages/${messageId}`, { params: { mode } }),
        onSuccess: (_, { messageId, conversationId, mode }) => {
            if (mode === 'me') {
                deleteSocketMessage(conversationId, messageId);
            }
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useReactToMessage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ messageId, emoji, conversationId }) =>
            api.post(`${BASE}/api/conversation/messages/${messageId}/react`, {
                emoji
            }),
        onSuccess: (_, { conversationId }) => {
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useMarkMessagesRead() {
    const clearUnread = useConversationStore(s => s.clearUnread);
    return useMutation({
        mutationFn: ({ unreadMessageIds, lastMessage }) =>
            api.post(`${BASE}/api/conversation/messages/mark-read`, { unreadMessageIds, lastMessage }),
        onSuccess: (_, { conversationId }) => {
            if (conversationId) clearUnread(conversationId);
        },
    });
}

export function useClearChat() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const clearSocketMessages = useConversationStore(s => s.clearSocketMessages);
    const clearConversationHistory = useConversationStore(s => s.clearConversationHistory);
    return useMutation({
        mutationFn: (conversationId) => api.delete(`${BASE}/api/conversation/${conversationId}/clear`),
        onMutate: async (conversationId) => {
            clearSocketMessages(conversationId);
            clearConversationHistory(conversationId);
            const queryKey = convoKeys.list(user?._id);
            await qc.cancelQueries({ queryKey });
            const prev = qc.getQueryData(queryKey);
            if (prev && prev.pages) {
                const updatedPages = prev.pages.map(page => ({
                    ...page,
                    conversations: (page.conversations || []).map(c =>
                        String(c._id) === String(conversationId) ? { ...c, lastMessage: null, lastMessageAt: null } : c
                    )
                }));
                qc.setQueryData(queryKey, { ...prev, pages: updatedPages });
            }
            return { prev };
        },
        onError: (err, id, ctx) => {
            if (ctx?.prev) qc.setQueryData(convoKeys.list(user?._id), ctx.prev);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
        },
    });
}

export function useDeleteChat() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const clearSocketMessages = useConversationStore(s => s.clearSocketMessages);
    const removeConversation = useConversationStore(s => s.removeConversation);
    return useMutation({
        mutationFn: (conversationId) => api.delete(`${BASE}/api/conversation/${conversationId}`),
        onMutate: async (conversationId) => {
            clearSocketMessages(conversationId);
            removeConversation(conversationId);
            const queryKey = convoKeys.list(user?._id);
            await qc.cancelQueries({ queryKey });
            const prev = qc.getQueryData(queryKey);
            if (prev && prev.pages) {
                const updatedPages = prev.pages.map(page => ({
                    ...page,
                    conversations: (page.conversations || []).filter(c => String(c._id) !== String(conversationId))
                }));
                qc.setQueryData(queryKey, { ...prev, pages: updatedPages });
            }
            return { prev };
        },
        onError: (err, id, ctx) => {
            if (ctx?.prev) qc.setQueryData(convoKeys.list(user?._id), ctx.prev);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
        },
    });
}
