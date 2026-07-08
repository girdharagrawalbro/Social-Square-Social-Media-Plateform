import React, { useEffect, useState } from 'react';
import useToastStore from '../../../store/zustand/useToastStore';

const CustomToast = ({ toast }) => {
    const dismiss = useToastStore(s => s.dismiss);
    const [animate, setAnimate] = useState('translateY(20px) scale(0.95)');
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setAnimate('translateY(0) scale(1)');
            setOpacity(1);
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    const handleDismiss = () => {
        setAnimate(toast.position.startsWith('top') ? 'translateY(-20px) scale(0.95)' : 'translateY(20px) scale(0.95)');
        setOpacity(0);
        setTimeout(() => {
            dismiss(toast.id);
        }, 150);
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return (
                    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" fill="#22c55e" stroke="none" />
                        <path d="M8 12l3 3 5-6" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                );
            case 'error':
                return (
                    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="none" />
                        <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeLinecap="round" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L1 21h22L12 2z" fill="#f59e0b" stroke="none" />
                        <path d="M12 9v5M12 17h.01" stroke="white" strokeLinecap="round" />
                    </svg>
                );
            case 'confirm':
                return (
                    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="none" />
                        <path d="M12 16v-4M12 8h.01" stroke="white" strokeLinecap="round" />
                    </svg>
                );
            default:
                return (
                    <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" fill="#6366f1" stroke="none" />
                        <path d="M12 16v-4M12 8h.01" stroke="white" strokeLinecap="round" />
                    </svg>
                );
        }
    };

    return (
        <div
            style={{
                transform: animate,
                opacity: opacity,
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.1), opacity 0.15s ease-out',
                pointerEvents: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                borderRadius: '24px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13px',
                fontWeight: 600,
                maxWidth: '340px',
                minWidth: '220px',
                background: 'var(--surface-2)',
                // border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                backdropFilter: 'blur(10px)',
            }}
            className="custom-toast-item"
        >
            <span style={{ fontSize: '14px', flexShrink: 0 }}>{getIcon()}</span>
            <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.4 }}>
                {toast.message}
            </div>

            {toast.type === 'confirm' ? (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                    <button
                        onClick={() => {
                            if (toast.onConfirm) toast.onConfirm();
                            handleDismiss();
                        }}
                        style={{
                            background: '#808bf5',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = 0.9}
                        onMouseLeave={(e) => e.target.style.opacity = 1}
                    >
                        {toast.confirmLabel}
                    </button>
                    <button
                        onClick={() => {
                            if (toast.onCancel) toast.onCancel();
                            handleDismiss();
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-sub)',
                            borderRadius: '12px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {toast.cancelLabel}
                    </button>
                </div>
            ) : (
                // <button
                //     onClick={handleDismiss}
                //     style={{
                //         background: 'none',
                //         border: 'none',
                //         color: 'var(--text-sub)',
                //         fontSize: '14px',
                //         cursor: 'pointer',
                //         padding: '0 4px',
                //         display: 'flex',
                //         alignItems: 'center',
                //         justifyContent: 'center',
                //         flexShrink: 0,
                //     }}
                // >
                //     ✕
                // </button>
                <></>
            )}
        </div>
    );
};

export default CustomToast;
