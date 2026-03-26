import React from 'react'
import useConversationStore from '../../store/zustand/useConversationStore';

const Notification = () => {
    const { notifications, unreadNotificationsCount } = useConversationStore();
    const loading = false; // Zustand state is sync for now
    const error = null;

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
            <div className="border-top py-3">
                {
                    loading.notifications ? (
                        <>Loading...</>
                    ) : error ? (
                        <div>Error: {error}</div>
                    ) : (
                        notifications.length > 0 ?
                            notifications.map((notification) => (

                                <div className="d-flex py-1 justify-content-between align-items-center" key={notification._id} style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: notification.read ? 'transparent' : '#808bf5' }} />
                                        <h6 className="m-0" style={{ fontSize: '14px' }}>
                                            <b>{notification.sender.fullname}</b>
                                            <span className="text-secondary fw-normal">
                                                {notification.type === 'like' && ' liked your post'}
                                                {notification.type === 'comment' && ' commented on your post'}
                                                {notification.type === 'new_post' && ' shared a new post'}
                                                {notification.type === 'message' && ` sent a message: "${notification.message?.content?.substring(0, 30)}..."`}
                                                {notification.type === 'system' && ` - ${notification.message?.content}`}
                                            </span>
                                        </h6>
                                    </div>
                                    <p className='text-secondary m-0' style={{ fontSize: "12px" }}>{formatDateTime(notification.createdAt)}</p>
                                </div>
                            ))
                            :
                            <>No notifications found</>
                    )
                }
            </div>
        </>
    )
}
export default Notification;