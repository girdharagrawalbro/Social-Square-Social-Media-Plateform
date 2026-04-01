import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useConversationStore = create(
    devtools(
        (set, get) => ({
            // ─── Active chat ──────────────────────────────────────────────
            activeConversationId: null,
            activeParticipant: null, // { userId, fullname, profilePicture }

            // ─── Online users ─────────────────────────────────────────────
            onlineUserIds: new Set(),
            lastSeenMap: {}, // userId → Date string

            // ─── Typing indicators ────────────────────────────────────────
            typingUsers: {}, // conversationId → { senderName, ts }

            // ─── Unread counts ────────────────────────────────────────────
            unreadCounts: {}, // conversationId → number
            unreadNotificationsCount: 0,
            notifications: [],

            // ─── Socket messages (real-time, merged with query cache) ─────
            socketMessages: {}, // conversationId → Message[]

            // ─── Search state ─────────────────────────────────────────────
            messageSearchQuery: '',
            messageSearchResults: [],

            // ─── UI ───────────────────────────────────────────────────────
            chatOpen: false,

            // ─── Setters ──────────────────────────────────────────────────
            openChat: (conversationId, participant) => set({
                activeConversationId: conversationId,
                activeParticipant: participant,
                chatOpen: true,
            }),
            closeChat: () => set({
                activeConversationId: null,
                activeParticipant: null,
                chatOpen: false,
            }),

            // ─── Online users ─────────────────────────────────────────────
            setOnlineUsers: (users) => set({
                onlineUserIds: new Set(users.map(u => u.userId))
            }),
            addOnlineUser: (user) => set(state => {
                const next = new Set(state.onlineUserIds);
                next.add(user.userId);
                return { onlineUserIds: next };
            }),
            removeOnlineUser: (userId, lastSeen) => set(state => {
                const next = new Set(state.onlineUserIds);
                next.delete(userId);
                return { 
                    onlineUserIds: next,
                    lastSeenMap: { ...state.lastSeenMap, [userId]: lastSeen || new Date().toISOString() }
                };
            }),
            setLastSeen: (userId, date) => set(state => ({
                lastSeenMap: { ...state.lastSeenMap, [userId]: date }
            })),
            getLastSeen: (userId) => get().lastSeenMap[userId],
            isOnline: (userId) => get().onlineUserIds.has(userId),

            // ─── Typing ───────────────────────────────────────────────────
            setTyping: (conversationId, senderName) => {
                set(state => ({
                    typingUsers: {
                        ...state.typingUsers,
                        [conversationId]: { senderName, ts: Date.now() },
                    }
                }));
                // Auto-clear after 3 seconds
                setTimeout(() => {
                    set(state => {
                        const entry = state.typingUsers[conversationId];
                        if (entry && Date.now() - entry.ts >= 2900) {
                            const next = { ...state.typingUsers };
                            delete next[conversationId];
                            return { typingUsers: next };
                        }
                        return {};
                    });
                }, 3000);
            },
            clearTyping: (conversationId) => {
                set(state => {
                    const next = { ...state.typingUsers };
                    delete next[conversationId];
                    return { typingUsers: next };
                });
            },
            isTyping: (conversationId) => !!get().typingUsers[conversationId],
            getTypingName: (conversationId) => get().typingUsers[conversationId]?.senderName,

            // ─── Unread counts ────────────────────────────────────────────
            setUnreadCount: (conversationId, count) => set(state => ({
                unreadCounts: { ...state.unreadCounts, [conversationId]: count }
            })),
            incrementUnread: (conversationId) => set(state => ({
                unreadCounts: {
                    ...state.unreadCounts,
                    [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
                }
            })),
            clearUnread: (conversationId) => set(state => ({
                unreadCounts: { ...state.unreadCounts, [conversationId]: 0 }
            })),
            totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),

            // ─── Socket messages ──────────────────────────────────────────
            addSocketMessage: (conversationId, message) => {
                set(state => {
                    const existing = state.socketMessages[conversationId] || [];
                    const alreadyExists = existing.some(m => m._id === message._id);
                    if (alreadyExists) return {};
                    return {
                        socketMessages: {
                            ...state.socketMessages,
                            [conversationId]: [...existing, message],
                        }
                    };
                });
            },
            updateMessageStatus: (conversationId, messageId, updates) => {
                set(state => ({
                    socketMessages: {
                        ...state.socketMessages,
                        [conversationId]: (state.socketMessages[conversationId] || []).map(m =>
                            m._id === messageId ? { ...m, ...updates } : m
                        ),
                    }
                }));
            },
            deleteSocketMessage: (conversationId, messageId) => {
                set(state => ({
                    socketMessages: {
                        ...state.socketMessages,
                        [conversationId]: (state.socketMessages[conversationId] || []).filter(m => m._id !== messageId),
                    }
                }));
            },
            clearSocketMessages: (conversationId) => {
                set(state => {
                    const next = { ...state.socketMessages };
                    delete next[conversationId];
                    return { socketMessages: next };
                });
            },
            getSocketMessages: (conversationId) => get().socketMessages[conversationId] || [],

            // ─── Message search ───────────────────────────────────────────
            setMessageSearch: (query) => set({ messageSearchQuery: query }),
            setMessageSearchResults: (results) => set({ messageSearchResults: results }),
            clearMessageSearch: () => set({ messageSearchQuery: '', messageSearchResults: [] }),

            // ─── Notifications ────────────────────────────────────────────
            setNotifications: (notifications) => set({ 
                notifications, 
                unreadNotificationsCount: notifications.filter(n => !n.read).length 
            }),
            addNotification: (notification) => set(state => ({
                notifications: [notification, ...state.notifications],
                unreadNotificationsCount: state.unreadNotificationsCount + 1
            })),
            markNotificationsRead: () => set(state => ({
                notifications: state.notifications.map(n => ({ ...n, read: true })),
                unreadNotificationsCount: 0
            })),
        }),
        { name: 'ConversationStore' }
    )
);

export default useConversationStore;