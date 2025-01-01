import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { socket } from '../../socket'; // Import socket connection

// Async thunk for creating a conversation
export const createConversation = createAsyncThunk(
    'conversations/createConversation',
    async ({ participants }, { rejectWithValue }) => {
        try {
            // Ensure the participants array has exactly two participants
            if (!participants || participants.length !== 2) {
                throw new Error('Exactly two participants are required to create a conversation.');
            }

            const response = await axios.post('https://social-square-social-media-plateform.onrender.com/api/conversation/create', {
                participants,
            });

            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: error.message });
        }
    }
);

// Async thunk for fetching conversations
export const fetchConversations = createAsyncThunk(
    'conversations/fetchConversations',
    async (userId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`https://social-square-social-media-plateform.onrender.com/api/conversation/${userId}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);



//  Async thunk for fetching messages
export const fetchMessages = createAsyncThunk(
    'conversations/fetchMessages',
    async ({ participantIds }, { rejectWithValue }) => {
        try {
            // Ensure exactly two participant IDs are provided
            if (!participantIds || participantIds.length !== 2) {
                throw new Error('Exactly two participant IDs are required.');
            }

            const response = await fetch(`https://social-square-social-media-plateform.onrender.com/api/conversation/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ participantIds }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch messages.');
            }

            return await response.json();
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk for creating a new message 
export const createMessage = createAsyncThunk(
    'conversations/createMessage',
    async ({ conversationId, sender, content, senderName, recipientId }, { rejectWithValue }) => {
        try {
            const response = await axios.post('https://social-square-social-media-plateform.onrender.com/api/conversation/messages/create', {
                conversationId,
                sender,
                content,
                recipientId,
                senderName
            });
            const data = response.data;
            socket.emit('sendMessage', { recipientId, senderName, content, sender, conversationId, _id: data._id, createdAt: data.createdAt, isRead: data.isRead });
            return data;
        }
        catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Async thunk for mark message as read 
export const markMessagesAsRead = createAsyncThunk(
    'conversation/markMessagesAsRead',
    async ({ unreadMessageIds, lastMessage }, { rejectWithValue }) => {
        try {
            const response = await axios.post('https://social-square-social-media-plateform.onrender.com/api/conversation/messages/mark-read', { unreadMessageIds, lastMessage });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

export const getNotifications = createAsyncThunk(
    'conversation/getNotifications',
    async (userId, { rejectWithValue }) => {
        try {
            const response = await axios.get(`https://social-square-social-media-plateform.onrender.com/api/conversation/notifications/${userId}`);
            return response.data;  // Return the notifications data
        } catch (error) {
            return rejectWithValue(error.response.data);  // Handle errors
        }
    }
);

//  to mark notifications as read 
export const readNotifications = createAsyncThunk(
    'conversation/readNotifications',
    async (Ids, { rejectWithValue }) => {
        try {
            const response = await axios.patch('https://social-square-social-media-plateform.onrender.com/api/conversation/notifications/mark-read', { Ids });
            return response.data;
        }
        catch (error) {
            return rejectWithValue(error.response.data)
        }
    });

const conversationSlice = createSlice({
    name: 'conversation',
    initialState: {
        conversations: [],
        notifications: [],
        messages: [],
        loading: {
            conversation: true,
            messages: null,
            notifications: null
        },
        error: null,
    },
    reducers: {

        updateLastMessage: (state, action) => {
            const { conversationId, content, createdAt, messageid, isRead } = action.payload;

            const conversation = state.conversations.find(
                (conv) => conv._id === conversationId
            );

            if (conversation) {
                if (content !== undefined) {
                    conversation.lastMessage.message = content;
                }
                if (messageid !== undefined) {
                    conversation.lastMessage.id = messageid;
                }
                if (createdAt !== undefined) {
                    conversation.lastMessageAt = createdAt;
                }
                if (isRead !== undefined) {
                    conversation.lastMessage.isRead = isRead;
                }
            }
        },

        addMessageToChat: (state, action) => {
            state.messages.push(action.payload);
        },

        addNewNotification: (state, action) => {
            const { notification } = action.payload;
            state.notifications.push(notification);
        },

        updateReadMessage: (state, action) => {
            const messageId = action.payload;
            const message = state.messages.find((message) => message._id === messageId.messageId);
            console.log(message)
            if (message) {
                message.isRead = true;
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(createConversation.pending, (state) => {
                state.loading.conversation = true;
            })
            .addCase(createConversation.fulfilled, (state, action) => {
                state.loading.conversation = false;
                state.conversations.push(action.payload);
            })
            .addCase(createConversation.rejected, (state, action) => {
                state.loading.conversation = false;
                state.error = action.payload;

            })

            .addCase(fetchConversations.pending, (state) => {
                state.loading.conversation = true;
            })

            .addCase(fetchConversations.fulfilled, (state, action) => {
                state.loading.conversation = false;
                state.conversations = action.payload;
            })

            .addCase(fetchConversations.rejected, (state, action) => {
                state.loading.conversation = false;
                state.error = action.payload;
            })

            .addCase(fetchMessages.pending, (state) => {
                state.loading.messages = true;
                state.messages = [];
            })

            .addCase(fetchMessages.fulfilled, (state, action) => {
                state.loading.messages = false;
                const { messages, conversation } = action.payload;
                state.messages = messages;
                state.slectedCon = conversation;
            })
            .addCase(fetchMessages.rejected, (state, action) => {
                state.loading.messages = false;
                state.error = action.payload;
            })

            .addCase(createMessage.pending, (state) => {
                state.loading.messages = true;
            })
            .addCase(createMessage.fulfilled, (state, action) => {
                state.loading.messages = false;
                state.messages.push(action.payload); // Add the new message to the existing messages
            })
            .addCase(createMessage.rejected, (state, action) => {
                state.loading.messages = false;
                state.error = action.payload;
            })

            .addCase(markMessagesAsRead.fulfilled, (state, action) => {
                const updatedIds = action.payload.unreadMessageIds;
                state.messages = state.messages.map((message) =>
                    updatedIds.includes(message._id) ? { ...message, isRead: true } : message
                );
            })

            .addCase(markMessagesAsRead.rejected, (state, action) => {
                state.error = action.payload;
            })

            .addCase(getNotifications.pending, (state, action) => {
                state.loading.notifications = true;
                state.error = action.payload;
            })
            .addCase(getNotifications.fulfilled, (state, action) => {
                state.loading.notifications = false;
                state.notifications = action.payload
            })
            .addCase(getNotifications.rejected, (state, action) => {
                state.loading.notifications = false;
                state.error = action.payload;
            })


            .addCase(readNotifications.fulfilled, (state, action) => {
                const updatedIds = action.payload.Ids;
                console.log(updatedIds)
                // Update the notifications in the state
                state.notifications = state.notifications.filter(notification =>
                    !updatedIds.includes(notification._id)
                );

            })


            .addCase(readNotifications.rejected, (state, action) => {
                state.error = action.payload;
            })

    },
});

export const { updateReadMessage, addMessageToChat, updateLastMessage, updateReadNotifications, addNewNotification } = conversationSlice.actions;

export default conversationSlice.reducer;
