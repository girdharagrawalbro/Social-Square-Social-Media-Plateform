import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const convoKeys = {
    list:    (userId) => ['conversations', userId],
    messages:(convId) => ['messages', convId],
    search:  (convId, q) => ['messages', 'search', convId, q],
};

// ─── CONVERSATIONS LIST ───────────────────────────────────────────────────────
export function useConversations(userId) {
    const setUnreadCount = useConversationStore(s => s.setUnreadCount);
    return useQuery({
        queryKey: convoKeys.list(userId),
        queryFn: async () => {
            const res = await axios.get(`${BASE}/api/conversation/${userId}`);
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
    return useQuery({
        queryKey: convoKeys.messages(participantIds?.sort().join('-')),
        queryFn: async () => {
            const res = await axios.post(`${BASE}/api/conversation/messages`, { participantIds });
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
            const res = await axios.get(`${BASE}/api/conversation/messages/search`, {
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
        mutationFn: (participants) =>
            axios.post(`${BASE}/api/conversation/create`, { participants }),
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
            axios.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, sender: user._id, content,
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
            axios.patch(`${BASE}/api/conversation/messages/${messageId}`, { content }),
        onSuccess: (res, { conversationId, messageId }) => {
            updateMessageStatus(conversationId, messageId, { content: res.data.content, edited: true });
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useDeleteMessage() {
    const qc = useQueryClient();
    const deleteSocketMessage = useConversationStore(s => s.deleteSocketMessage);
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ messageId, conversationId }) =>
            axios.delete(`${BASE}/api/conversation/messages/${messageId}`, { data: { userId: user._id } }),
        onSuccess: (_, { messageId, conversationId }) => {
            deleteSocketMessage(conversationId, messageId);
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useReactToMessage() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ messageId, emoji, conversationId }) =>
            axios.post(`${BASE}/api/conversation/messages/${messageId}/react`, {
                userId: user._id, emoji
            }),
        onSuccess: (_, { conversationId }) => {
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useMarkMessagesRead() {
    const qc = useQueryClient();
    const clearUnread = useConversationStore(s => s.clearUnread);
    return useMutation({
        mutationFn: ({ unreadMessageIds, lastMessage }) =>
            axios.post(`${BASE}/api/conversation/messages/mark-read`, { unreadMessageIds, lastMessage }),
        onSuccess: (_, { conversationId }) => {
            if (conversationId) clearUnread(conversationId);
        },
    });
}