import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateLastMessage, fetchMessages, createMessage, markMessagesAsRead, addMessageToChat, updateReadMessage } from '../../store/slices/conversationSlice';
import { socket } from '../../socket';

const ChatPanel = ({ participantId, lastMessage }) => {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector(state => state.users);
    const { messages, slectedCon } = useSelector(state => state.conversation);
    const [messageContent, setMessageContent] = useState('');
    const [isTyping, setIsTyping] = useState(false);       // other user typing
    const [typingName, setTypingName] = useState('');
    const chatContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const currentTime = new Date().toISOString();

    useEffect(() => {
        if (loggeduser?._id && participantId) {
            dispatch(fetchMessages({ participantIds: [loggeduser._id, participantId] }));
        }
    }, [loggeduser._id, dispatch, participantId]);

    // Receive messages
    useEffect(() => {
        socket.on('receiveMessage', (message) => {
            if (message.senderId === participantId) {
                dispatch(addMessageToChat(message));
                dispatch(markMessagesAsRead({ unreadMessageIds: [message._id], lastMessage: message._id }));
                dispatch(updateLastMessage({ conversationId: message.conversationId, content: message.content, createdAt: message.createdAt, messageid: message._id, isRead: true }));
                socket.emit("readMessage", { messageId: message._id, socketId: message.socketId });
            }
        });
        return () => socket.off('receiveMessage');
    }, [dispatch, participantId]);

    // Seen messages
    useEffect(() => {
        socket.on("seenMessage", (messageId) => { dispatch(updateReadMessage(messageId)); });
        return () => socket.off('seenMessage');
    }, [dispatch]);

    // Typing indicator
    useEffect(() => {
        socket.on('userTyping', ({ senderName }) => {
            setIsTyping(true);
            setTypingName(senderName);
        });
        socket.on('userStoppedTyping', () => {
            setIsTyping(false);
            setTypingName('');
        });
        return () => {
            socket.off('userTyping');
            socket.off('userStoppedTyping');
        };
    }, []);

    // Scroll to bottom + mark read
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        const unreadMessageIds = messages?.filter(m => !m.isRead && m.sender === participantId).map(m => m._id);
        if (unreadMessageIds?.length > 0) {
            dispatch(markMessagesAsRead({ unreadMessageIds, lastMessage }));
            dispatch(updateLastMessage({ conversationId: slectedCon?._id, isRead: true }));
        }
    }, [messages, participantId, dispatch, lastMessage, slectedCon?._id]);

    const handleInputChange = (e) => {
        setMessageContent(e.target.value);
        // Emit typing
        socket.emit('typing', { recipientId: participantId, senderName: loggeduser.fullname });
        // Clear previous timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('stopTyping', { recipientId: participantId });
        }, 1500);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!messageContent.trim()) return;
        socket.emit('stopTyping', { recipientId: participantId });
        dispatch(createMessage({
            conversationId: slectedCon?._id,
            sender: loggeduser._id,
            content: messageContent.trim(),
            recipientId: participantId,
            senderName: loggeduser.fullname,
        }));
        dispatch(updateLastMessage({ conversationId: slectedCon?._id, content: messageContent.trim(), createdAt: currentTime, isRead: true }));
        setMessageContent('');
    };

    const formatDateTime = (dateString) => {
        const diff = Date.now() - new Date(dateString);
        if (diff < 86400000) return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="flex flex-col gap-2" style={{ height: '77vh' }}>
            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-auto flex flex-col gap-2 border-t pt-3 px-1" style={{ height: '100vh' }}>
                {messages?.length > 0 ? messages.map(message => (
                    <div key={message._id} className={`flex ${message.sender === loggeduser._id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`${message.sender === loggeduser._id ? 'bg-[#808bf5] text-white' : 'bg-gray-100 text-gray-800'} rounded-2xl px-3 py-2 max-w-xs flex items-end gap-2`}>
                            <p className="m-0 text-sm">{message.content}</p>
                            <span className="text-xs opacity-70 whitespace-nowrap">{formatDateTime(message.createdAt)}</span>
                            {message.sender === loggeduser._id && (
                                message.isRead ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="#fff" fill="none">
                                        <path d="M3 13.3333C3 13.3333 4.5 14 6.5 17C6.5 17 6.78485 16.5192 7.32133 15.7526M17 6C14.7085 7.14577 12.3119 9.55181 10.3879 11.8223" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M8 13.3333C8 13.3333 9.5 14 11.5 17C11.5 17 17 8.5 22 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" color="#fff" fill="none">
                                        <path d="M5 14.5C5 14.5 6.5 14.5 8.5 18C8.5 18 14.0588 8.83333 19 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )
                            )}
                        </div>
                    </div>
                )) : (
                    <div className="w-full h-full flex items-center justify-center text-center text-gray-400 text-sm">
                        No messages yet. Start the conversation!
                    </div>
                )}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl px-4 py-2 flex items-center gap-1">
                            <span className="text-xs text-gray-500">{typingName} is typing</span>
                            <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                                {[0, 1, 2].map(i => (
                                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af', animation: `typingDot 1s ${i * 0.2}s infinite` }} />
                                ))}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="w-full border-t pt-2">
                <form className="flex gap-2 items-center" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-indigo-400"
                        placeholder="Type your message..."
                        value={messageContent}
                        onChange={handleInputChange}
                    />
                    <button type="submit" className="bg-[#808bf5] text-white border-0 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer flex-shrink-0">
                        <i className="pi pi-send"></i>
                    </button>
                </form>
            </div>

            <style>{`
                @keyframes typingDot {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-4px); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ChatPanel;