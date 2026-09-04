import React from 'react';
import useToastStore from '../../../store/zustand/useToastStore';
import CustomToast from './CustomToast';

const CustomToastContainer = () => {
    const toasts = useToastStore(s => s.toasts);
    
    // Group toasts by position
    const positions = ['top-right', 'bottom-right', 'top-center', 'bottom-center', 'top-left', 'bottom-left'];
    
    return (
        <>
            {positions.map(pos => {
                const posToasts = toasts.filter(t => t.position === pos);
                if (posToasts.length === 0) return null;
                
                const style = {
                    position: 'fixed',
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    pointerEvents: 'none',
                    transition: 'all 0.3s ease',
                };
                
                if (pos.startsWith('top')) {
                    style.top = '16px';
                } else {
                    style.bottom = '16px';
                }
                
                if (pos.endsWith('right')) {
                    style.right = '16px';
                    style.alignItems = 'flex-end';
                } else if (pos.endsWith('left')) {
                    style.left = '16px';
                    style.alignItems = 'flex-start';
                } else {
                    style.left = '50%';
                    style.transform = 'translateX(-50%)';
                    style.alignItems = 'center';
                }
                
                return (
                    <div key={pos} style={style} className={`custom-toast-container-${pos}`}>
                        {posToasts.map(toast => (
                            <CustomToast key={toast.id} toast={toast} />
                        ))}
                    </div>
                );
            })}
        </>
    );
};

export default CustomToastContainer;
