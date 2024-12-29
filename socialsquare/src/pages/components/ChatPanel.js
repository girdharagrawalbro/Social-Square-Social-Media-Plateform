import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateLastMessage, fetchMessages, createMessage, markMessagesAsRead, addMessageToChat } from '../../store/slices/conversationSlice';
import { socket } from '../../socket';

const ChatPanel = ({ participantId }) => {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector((state) => state.users);
    const { messages, slectedCon } = useSelector((state) => state.conversation);
    const [messageContent, setMessageContent] = useState('');
    const chatContainerRef = useRef(null);


    useEffect(() => {
        if (loggeduser?._id && participantId) {
            dispatch(fetchMessages({ participantIds: [loggeduser._id, participantId] }));
        }

        // Listen to incoming messages
        socket.on('receiveMessage', (message) => {
            if (message.senderId === participantId) {
                // If the chat panel is open, add message to chat
                dispatch(addMessageToChat(message));

            } else {
                console.log('Error in reciving message');
            }
        });

        return () => {
            socket.off('receiveMessage');
        };
    }, [dispatch, loggeduser?._id, participantId]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }

        const unreadMessageIds = messages
            ?.filter((message) => !message.isRead && message.sender === participantId)
            .map((message) => message._id);

        if (unreadMessageIds && unreadMessageIds.length > 0) {
            dispatch(markMessagesAsRead(unreadMessageIds));
        }
    }, [messages, participantId, dispatch]);

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
            dispatch(updateLastMessage({ conversationId: slectedCon?._id, content: messageContent.trim() }));
            setMessageContent('');
        }
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
