import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux';

const Notification = () => {
    const { notifications, loading, error } = useSelector((state) => state.conversation);
    const dispatch = useDispatch();

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

                                <div className="d-flex py-1 justify-content-between" key={notification._id}>
                                    <h6><b>{notification.sender.fullname}</b>: {notification.message.content}</h6>
                                    <p className='text-secondary' style={{ fontSize: "14px" }}>{formatDateTime(notification.createdAt)}</p>
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