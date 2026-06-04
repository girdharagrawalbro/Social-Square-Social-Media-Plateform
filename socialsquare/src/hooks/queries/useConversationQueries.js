import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { api } from '../../store/zustand/useAuthStore';
import { Capacitor } from '@capacitor/core';
import cacheService from '../../utils/CacheService';

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

            // ✅ NATIVE CACHE HYDRATION
            if (Capacitor.isNativePlatform()) {
                const cached = await cacheService.get(cacheKey);
                if (cached) return cached;
            }

            const res = await api.post(`${BASE}/api/conversation/messages`, { recipientId });

            // ✅ UPDATE CACHE
            if (Capacitor.isNativePlatform() && res.data) {
                cacheService.set(cacheKey, res.data);
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

    return useMutation({
        mutationFn: ({ conversationId, content, recipientId, mediaUrl, mediaType, sharedPost, replyTo, storyReply }) =>
            api.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, content,
                senderName: user.fullname, recipientId,
                mediaUrl, mediaType, sharedPost, replyTo, storyReply
            }),
        onSuccess: (res, { conversationId }) => {
            // Optimistically add to Zustand socket messages
            addSocketMessage(conversationId, res.data);
            // Redundant with Socket.io conversationUpdated list updates
            // qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
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
        mutationFn: ({ messageId, conversationId }) =>
            api.delete(`${BASE}/api/conversation/messages/${messageId}`),
        onSuccess: (_, { messageId, conversationId }) => {
            deleteSocketMessage(conversationId, messageId);
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
    return useMutation({
        mutationFn: (conversationId) => api.delete(`${BASE}/api/conversation/${conversationId}/clear`),
        onMutate: async (conversationId) => {
            clearSocketMessages(conversationId);
            const queryKey = convoKeys.list(user?._id);
            await qc.cancelQueries({ queryKey });
            const prev = qc.getQueryData(queryKey);
            if (prev) {
                qc.setQueryData(queryKey, prev.map(c =>
                    c._id === conversationId ? { ...c, lastMessage: null, lastMessageAt: null } : c
                ));
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
    return useMutation({
        mutationFn: (conversationId) => api.delete(`${BASE}/api/conversation/${conversationId}`),
        onMutate: async (conversationId) => {
            clearSocketMessages(conversationId);
            const queryKey = convoKeys.list(user?._id);
            await qc.cancelQueries({ queryKey });
            const prev = qc.getQueryData(queryKey);
            if (prev) {
                qc.setQueryData(queryKey, prev.filter(c => c._id !== conversationId));
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
