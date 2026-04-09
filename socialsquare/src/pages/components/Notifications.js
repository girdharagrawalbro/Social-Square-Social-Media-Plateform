import React from 'react'
import useConversationStore from '../../store/zustand/useConversationStore';
import { useAcceptFollowRequest, useDeclineFollowRequest } from '../../hooks/queries/useAuthQueries';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Notification = () => {
    const navigate = useNavigate();
    const { notifications, unreadNotificationsCount } = useConversationStore();
    const loading = false; // Zustand state is sync for now
    const error = null;

    const acceptMutation = useAcceptFollowRequest();
    const declineMutation = useDeclineFollowRequest();

    const handleAccept = async (requesterId) => {
        try {
            await acceptMutation.mutateAsync({ requesterId });
            toast.success('Follow request accepted');
        } catch {
            toast.error('Failed to accept request');
        }
    };

    const handleDecline = async (requesterId) => {
        try {
            await declineMutation.mutateAsync({ requesterId });
            toast.success('Follow request declined');
        } catch {
            toast.error('Failed to decline request');
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
        <>
            <div className="py-1">
                {
                    loading ? (
                        <div className="p-4 text-center text-[var(--text-sub)]">Loading notifications...</div>
                    ) : error ? (
                        <div className="p-4 text-center text-red-500">Error: {error}</div>
                    ) : (
                        notifications.length > 0 ?
                            notifications.map((notification) => (
                                <div className="flex py-3 justify-between items-center border-b border-[var(--border-color)] group hover:bg-[var(--surface-2)] px-2 transition-colors duration-200 rounded-lg mb-1" key={notification._id}>
                                    <div className="flex items-center gap-3">
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: notification.read ? 'transparent' : '#808bf5', boxShadow: notification.read ? 'none' : '0 0 8px #808bf5' }} />
                                        <div className="flex flex-col">
                                            <h6 className="m-0 text-[14px] text-[var(--text-main)]">
                                                <b
                                                    className="font-bold cursor-pointer hover:text-indigo-600 transition-colors"
                                                    onClick={() => {
                                                        const id = notification.sender.id || notification.sender._id;
                                                        if (id) navigate(`/profile/${id}`);
                                                    }}
                                                >
                                                    {notification.sender.fullname || notification.sender.username || 'User'}
                                                </b>
                                                <span className="text-[var(--text-sub)] font-normal ml-1">
                                                    {notification.type === 'like' && ' liked your post'}
                                                    {notification.type === 'comment' && ' commented on your post'}
                                                    {notification.type === 'new_post' && ' shared a new post'}
                                                    {notification.type === 'follow' && ' started following you'}
                                                    {notification.type === 'follow_request' && ' sent you a follow request'}
                                                    {notification.type === 'message' && ` sent a message: "${notification.message?.content?.substring(0, 30)}..."`}
                                                    {notification.type === 'system' && ` - ${notification.message?.content}`}
                                                </span>
                                            </h6>
                                            {notification.type === 'follow_request' && (
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => handleAccept(notification.sender.id)}
                                                        className="bg-[#808bf5] text-white border-0 py-1 px-3 rounded-full text-[11px] font-bold cursor-pointer hover:opacity-90 transition shadow-sm"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecline(notification.sender.id)}
                                                        className="bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] py-1 px-3 rounded-full text-[11px] font-bold cursor-pointer hover:bg-[var(--surface-1)] transition"
                                                    >
                                                        Decline
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className='text-[var(--text-sub)] m-0 whitespace-nowrap text-[11px] font-medium opacity-70'>{formatDateTime(notification.createdAt)}</p>
                                </div>
                            ))
                            :
                            <div className="p-8 text-center text-[var(--text-sub)]">
                                <i className="pi pi-bell-slash text-2xl mb-2 opacity-20 block"></i>
                                No notifications found
                            </div>
                    )
                }
            </div>
        </>
    )
}
export default Notification;