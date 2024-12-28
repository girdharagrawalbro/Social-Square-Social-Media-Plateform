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

            const response = await axios.post('http://localhost:5000/api/conversation/create', {
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
            const response = await axios.get(`http://localhost:5000/api/conversation/${userId}`);
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

            const response = await fetch(`http://localhost:5000/api/conversation/messages`, {
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
            const response = await axios.post('http://localhost:5000/api/conversation/messages/create', {
                conversationId,
                sender,
                content,
            });
            socket.emit('sendMessage', { recipientId, senderName, content });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);
export const markMessagesAsRead = createAsyncThunk(
    'conversation/markMessagesAsRead',
    async (messageIds, { rejectWithValue }) => {
        try {
            const response = await axios.patch('http://localhost:5000/api/conversation/messages/mark-read', { messageIds });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);
const conversationSlice = createSlice({
    name: 'conversation',
    initialState: {
        conversations: [],
        messages: [],
        loading: {
            conversation: true,
            messages: null,
        },
        error: null,
    },
    reducers: {
        updateLastMessage: (state, action) => {
            const { conversationId, content } = action.payload;
            const conversation = state.conversations.find(
                (conv) => conv._id === conversationId
            );
            console.log(content)
            if (conversation) {
                conversation.lastMessage = content;
            }
        },

        addMessageToChat: (state, action) => {
            state.messages.push(action.payload);
        },


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
                const updatedIds = action.payload.messageIds;
                state.messages = state.messages.map((message) =>
                    updatedIds.includes(message._id) ? { ...message, isRead: true } : message
                );
            })
            .addCase(markMessagesAsRead.rejected, (state, action) => {
                state.error = action.payload;
            });




    },
});

export const { addMessageToChat, updateLastMessage } = conversationSlice.actions;

export default conversationSlice.reducer;
