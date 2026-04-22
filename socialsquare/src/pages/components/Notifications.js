import React from 'react'
import useConversationStore from '../../store/zustand/useConversationStore';
import { useAcceptFollowRequest, useDeclineFollowRequest } from '../../hooks/queries/useAuthQueries';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Notification = () => {
    const navigate = useNavigate();
    const { notifications, unreadNotificationsCount } = useConversationStore();
    const loading = false;
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
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

        return date.toLocaleDateString();
    };

    const getIcon = (type) => {
        switch (type) {
            case 'like': return <i className="pi pi-heart-fill text-pink-500"></i>;
            case 'comment': return <i className="pi pi-comment text-blue-500"></i>;
            case 'follow': return <i className="pi pi-user-plus text-indigo-500"></i>;
            case 'follow_request': return <i className="pi pi-user-plus text-purple-500"></i>;
            case 'system': return <i className="pi pi-shield text-orange-500"></i>;
            case 'message': return <i className="pi pi-envelope text-green-500"></i>;
            default: return <i className="pi pi-bell text-gray-400"></i>;
        }
    };

    return (
        <div className="flex flex-col gap-1 py-2">
            {loading ? (
                <div className="flex flex-col gap-4 p-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-full"></div>
                            <div className="flex-1 space-y-2 py-1">
                                <div className="h-2 bg-[var(--surface-2)] rounded w-3/4"></div>
                                <div className="h-2 bg-[var(--surface-2)] rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="p-10 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="pi pi-exclamation-triangle text-red-500 text-2xl"></i>
                    </div>
                    <p className="text-red-500 font-bold">Error loading notifications</p>
                    <p className="text-[var(--text-sub)] text-sm">{error}</p>
                </div>
            ) : notifications.length > 0 ? (
                notifications.map((notification) => {
                    const isSystem = notification.type === 'system';
                    const isUnread = !notification.read;

                    return (
                        <div 
                            key={notification._id}
                            className={`relative group flex items-start gap-4 p-4 rounded-3xl transition-all duration-300 border border-transparent hover:border-[var(--border-color)] ${isUnread ? 'bg-indigo-500/[0.03]' : 'hover:bg-[var(--surface-2)]'}`}
                        >
                            {/* Unread Indicator */}
                            {isUnread && (
                                <div className="absolute top-1/2 left-1 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full"></div>
                            )}

                            {/* Avatar/Icon Section */}
                            <div className="relative flex-shrink-0">
                                <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 ${isSystem ? 'border-orange-500/20 bg-orange-500/5' : 'border-indigo-500/10 bg-[var(--surface-2)]'} flex items-center justify-center shadow-sm`}>
                                    {isSystem ? (
                                        <i className="pi pi-shield text-2xl text-orange-500"></i>
                                    ) : (
                                        <img 
                                            src={notification.sender.profile_picture} 
                                            alt="" 
                                            className="w-full h-full object-cover"
                                            onClick={() => {
                                                const id = notification.sender.id || notification.sender._id;
                                                if (id) navigate(`/profile/${id}`);
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--surface-1)] shadow-md border border-[var(--border-color)] flex items-center justify-center text-[10px]">
                                    {getIcon(notification.type)}
                                </div>
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest opacity-60">
                                        {notification.type.replace('_', ' ')}
                                    </span>
                                    <span className="text-[10px] font-bold text-[var(--text-sub)] opacity-50">
                                        {formatDateTime(notification.createdAt)}
                                    </span>
                                </div>

                                <div className="text-sm leading-relaxed text-[var(--text-main)]">
                                    {!isSystem && (
                                        <b 
                                            className="font-black hover:text-indigo-600 transition-colors cursor-pointer mr-1.5"
                                            onClick={() => {
                                                const id = notification.sender.id || notification.sender._id;
                                                if (id) navigate(`/profile/${id}`);
                                            }}
                                        >
                                            {notification.sender.fullname || notification.sender.username || 'User'}
                                        </b>
                                    )}
                                    
                                    <span className={isSystem ? 'font-bold text-orange-600/90' : 'text-[var(--text-sub)]'}>
                                        {notification.type === 'like' && 'liked your post'}
                                        {notification.type === 'comment' && 'commented on your post'}
                                        {notification.type === 'new_post' && 'shared a new post'}
                                        {notification.type === 'follow' && 'started following you'}
                                        {notification.type === 'follow_request' && 'sent you a follow request'}
                                        {notification.type === 'message' && `sent a message: "${notification.message?.content?.substring(0, 40)}..."`}
                                        {isSystem && `${notification.message?.content}`}
                                    </span>
                                </div>

                                {notification.type === 'follow_request' && (
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={() => handleAccept(notification.sender.id)}
                                            className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-0 py-2.5 rounded-2xl text-[11px] font-black cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
                                        >
                                            ACCEPT
                                        </button>
                                        <button
                                            onClick={() => handleDecline(notification.sender.id)}
                                            className="flex-1 bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)] py-2.5 rounded-2xl text-[11px] font-black cursor-pointer hover:bg-[var(--surface-1)] active:scale-95 transition-all"
                                        >
                                            DECLINE
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="py-20 text-center animate-in fade-in zoom-in duration-700">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-indigo-500/20">
                        <i className="pi pi-bell-slash text-4xl text-indigo-500/20"></i>
                    </div>
                    <h3 className="text-lg font-black text-[var(--text-main)] m-0">All Caught Up!</h3>
                    <p className="text-[var(--text-sub)] text-sm max-w-[200px] mx-auto mt-2 leading-relaxed">
                        No new notifications right now. Check back later for activity.
                    </p>
                </div>
            )}
        </div>
    );
}

export default Notification;