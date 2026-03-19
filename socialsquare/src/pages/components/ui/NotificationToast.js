import React, { useEffect, useState } from 'react';
import { socket } from '../../../socket';

const SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function NotificationToast({ userId }) {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        if (!userId) return;

        const handleNewNotification = (notification) => {
            const id = notification._id || Date.now();

            // Play sound
            try {
                const audio = new Audio(SOUND_URL);
                audio.volume = 0.4;
                audio.play().catch(() => {}); // Ignore autoplay errors
            } catch {}

            // Add toast
            setToasts(prev => [...prev, { ...notification, toastId: id }]);

            // Auto-remove after 4 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.toastId !== id));
            }, 4000);
        };

        socket.on('newNotification', handleNewNotification);
        return () => socket.off('newNotification', handleNewNotification);
    }, [userId]);

    if (!toasts.length) return null;

    return (
        <div style={{
            position: 'fixed', top: '70px', right: '20px',
            zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
            {toasts.map(toast => (
                <div key={toast.toastId} style={{
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '12px', padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    minWidth: '280px', maxWidth: '340px',
                    animation: 'slideIn 0.3s ease'
                }}>
                    <img
                        src={toast.sender?.profile_picture || '/default-profile.png'}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                            {toast.sender?.fullname}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            {toast.type === 'new_post' ? 'Created a new post' : toast.message?.content}
                        </p>
                    </div>
                    <button
                        onClick={() => setToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}
                    >✕</button>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}