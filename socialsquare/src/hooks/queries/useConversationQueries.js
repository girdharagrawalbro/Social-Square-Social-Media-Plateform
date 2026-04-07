import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { api } from '../../store/zustand/useAuthStore';

const BASE = (process.env.REACT_APP_BACKEND_URL || '').trim();

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const convoKeys = {
    list: (userId) => ['conversations', userId],
    messages: (convId) => ['messages', convId],
    search: (convId, q) => ['messages', 'search', convId, q],
};

// ─── CONVERSATIONS LIST ───────────────────────────────────────────────────────
export function useConversations(userId) {
    const setUnreadCount = useConversationStore(s => s.setUnreadCount);
    return useQuery({
        queryKey: convoKeys.list(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation`);
            // Sync unread counts into Zustand
            res.data.forEach(conv => {
                if (!conv.lastMessage?.isRead && conv.lastMessageBy !== userId) {
                    setUnreadCount(conv._id, 1);
                }
            });
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 30,
        refetchInterval: 1000 * 60, // background refresh every minute
    });
}

// ─── MESSAGES (infinite, oldest-first) ───────────────────────────────────────
export function useMessages(participantIds) {
    const myId = useAuthStore.getState().user?._id;
    const recipientId = participantIds?.find(id => id !== myId);
    return useQuery({
        queryKey: convoKeys.messages(participantIds?.sort().join('-')),
        queryFn: async () => {
            const res = await api.post(`${BASE}/api/conversation/messages`, { recipientId });
            return res.data; // { messages, conversation }
        },
        enabled: !!participantIds && participantIds.length === 2,
        staleTime: 1000 * 30,
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
    const qc = useQueryClient();
    const addSocketMessage = useConversationStore(s => s.addSocketMessage);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ conversationId, content, recipientId, mediaUrl, mediaType }) =>
            api.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, content,
                senderName: user.fullname, recipientId,
                mediaUrl, mediaType,
            }),
        onSuccess: (res, { conversationId }) => {
            // Optimistically add to Zustand socket messages
            addSocketMessage(conversationId, res.data);
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
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