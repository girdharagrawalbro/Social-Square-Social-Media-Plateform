import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDark } = useDarkMode();
    const user = useAuthStore(s => s.user);
    const { totalUnread } = useConversationStore();

    const isChatOpen = location.pathname.startsWith('/conversation/') && location.pathname.split('/').length > 2;

    if (isChatOpen) return null;
    if (!user) return null;

    const cardBg = isDark ? 'bg-black/90 border-neutral-800' : 'bg-white/95 border-gray-200';
    const msgCount = totalUnread();

    const navItems = [
        { key: 'feed', icon: 'pi-home', to: () => `/${user?.username || ''}` },
        { key: 'explore', icon: 'pi-compass', to: () => '/explore' },
        { key: 'pulse', icon: 'pi-bolt', to: () => '/pulse' },
        { key: 'communities', label: 'Communities', icon: 'pi pi-map', to: '/communities' },
        { key: 'messages', icon: 'pi-envelope', to: () => '/conversations', badge: msgCount },
        { key: 'profile', icon: 'pi-user', to: () => `/profile/${user?._id || ''}` },
    ];

    const currentPath = location.pathname || '';

    const isActive = (key, to) => {
        if (key === 'feed') {
            return currentPath === `/${user?.username}` || currentPath === '/';
        }
        if (key === 'profile') {
            return currentPath.startsWith('/profile');
        }
        const target = typeof to === 'function' ? to() : to;
        if (!target) return false;
        return currentPath === target || currentPath.startsWith(`${target}/`);
    };

    const activeClass = "bg-gradient-to-tr from-[#808bf5] via-[#6366f1] to-[#4f46e5] text-white shadow-lg shadow-indigo-500/40 scale-110 -translate-y-1";
    const inactiveClass = isDark ? 'text-gray-400' : 'text-gray-600';

    const handleClick = (item) => {
        const target = typeof item.to === 'function' ? item.to() : item.to;
        if (!target) return;
        navigate(target);
    };

    return (
        <div className={`sm:hidden fixed bottom-0 left-0 right-0 w-full ${cardBg} border-t backdrop-blur-md px-2 py-2 flex justify-around items-center`} style={{ zIndex: 1000, paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
            {navItems.map(item => {
                const active = isActive(item.key, item.to);
                return (
                    <button
                        key={item.key}
                        aria-label={item.key}
                        className="relative flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer transition-all duration-300"
                        onClick={() => handleClick(item)}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden ${item.accent || active
                            ? activeClass
                            : inactiveClass
                            }`}>
                            {(item.accent || active) && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
                            <i className={`pi ${item.icon} ${item.accent || active ? 'text-xl' : 'text-lg'} relative z-10`}></i>

                            {/* Notification Badge */}
                            {item.badge > 0 && (
                                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-black shadow-sm">
                                    {item.badge > 9 ? '9+' : item.badge}
                                </span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNav;
