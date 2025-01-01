import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateLastMessage, fetchMessages, createMessage, markMessagesAsRead, addMessageToChat, updateReadMessage } from '../../store/slices/conversationSlice';
import { socket } from '../../socket';

const ChatPanel = ({ participantId, lastMessage }) => {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector((state) => state.users);
    const { messages, slectedCon } = useSelector((state) => state.conversation);
    const [messageContent, setMessageContent] = useState('');
    const chatContainerRef = useRef(null);
    const currentTime = new Date().toISOString();

    useEffect(() => {
        if (loggeduser?._id && participantId) {
            dispatch(fetchMessages({ participantIds: [loggeduser._id, participantId] }));
        }
    }, [loggeduser._id, dispatch, participantId]);

    useEffect(() => {
        // Listen to incoming messages
        socket.on('receiveMessage', (message) => {
            if (message.senderId === participantId) {
                dispatch(addMessageToChat(message));
                dispatch(markMessagesAsRead({ unreadMessageIds: [message._id], lastMessage: message._id }));
                dispatch(updateLastMessage({ conversationId: message.conversationId, content: message.content, createdAt: message.createdAt, messageid: message._id, isRead: true }));
                socket.emit("readMessage", { messageId: message._id, socketId: message.socketId });
            } else {
                console.log('Error in reciving message');
            }
        });

        return () => {
            socket.off('receiveMessage');
        };
    }, [dispatch, loggeduser?._id, participantId, messages]);

    useEffect(() => {
        socket.on("seenMessage", (messageId) => {
            dispatch(updateReadMessage(messageId));
        })

        return () => {
            socket.off('seenMessage');
        }
    }, [dispatch])

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }

        const unreadMessageIds = messages
            ?.filter((message) => !message.isRead && message.sender === participantId)
            .map((message) => message._id);

        if (unreadMessageIds && unreadMessageIds.length > 0) {
            dispatch(markMessagesAsRead({ unreadMessageIds, lastMessage }));
            dispatch(updateLastMessage({ conversationId: slectedCon?._id, isRead: true }));
        }
    }, [messages, participantId, dispatch, lastMessage, slectedCon?._id]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (messageContent.trim()) {
            dispatch(
                createMessage({
                    conversationId: slectedCon?._id,
                    sender: loggeduser._id,
                    content: messageContent.trim(),
                    recipientId: participantId,
                    senderName: loggeduser.fullname
                })
            );
            dispatch(updateLastMessage({ conversationId: slectedCon?._id, content: messageContent.trim(), createdAt: currentTime, isRead: true }));
            setMessageContent('');
        }
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();

        // Calculate the difference in milliseconds
        const diff = now - date;

        // If less than 24 hours, show the time
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Otherwise, show the date
        return date.toLocaleDateString();
    };

    return (
        <div className="d-flex flex-column gap-2">
            <div
                ref={chatContainerRef}
                className="flex-grow-1 overflow-auto d-flex flex-column gap-2 border-top pt-3"
                style={{ height: '68vh' }}
            >
                {messages?.length > 0 ? (
                    messages.map((message) => (
                        <div
                            className={`d-flex ${message.sender === loggeduser._id
                                ? 'justify-content-end'
                                : 'justify-content-start'
                                }`}
                            key={message._id}
                        >
                            <div
                                className={`${message.sender === loggeduser._id
                                    ? 'bg-primary text-white'
                                    : 'bg-light'
                                    } border rounded px-2 d-flex align-items-end gap-2`}
                            >
                                <p className="m-0 py-1">{message.content}</p>
                                <span style={{ fontSize: '10px' }}>
                                    {formatDateTime(message.createdAt)}
                                </span>
                                {message.sender === loggeduser._id ? (
                                    message.isRead ?
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="16"
                                            height="16"
                                            color="#ffffff"
                                            fill="none"
                                        >
                                            <path
                                                d="M3 13.3333C3 13.3333 4.5 14 6.5 17C6.5 17 6.78485 16.5192 7.32133 15.7526M17 6C14.7085 7.14577 12.3119 9.55181 10.3879 11.8223"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            <path
                                                d="M8 13.3333C8 13.3333 9.5 14 11.5 17C11.5 17 17 8.5 22 6"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                        :
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            width="16"
                                            height="16"
                                            color="#ffffff"
                                            fill="none"
                                        >
                                            <path
                                                d="M5 14.5C5 14.5 6.5 14.5 8.5 18C8.5 18 14.0588 8.83333 19 7"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>

                                ) : (
                                    <></>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="w-100 h-100 d-flex align-items-center justify-content-center text-center">
                        No messages found. Start the conversation!
                    </div>
                )}
            </div>
            <div className="w-100">
                <form className="d-flex gap-2 align-items-center w-100">
                    <input
                        type="text"
                        className="form-control border border-primary rounded-pill"
                        placeholder="Type your message..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                    />
                    <button
                        className="btn btn-primary d-flex align-items-center justify-content-center px-3 py-2 rounded-circle"
                        onClick={handleSendMessage}
                    >
                        <i className="pi pi-send"></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatPanel;
