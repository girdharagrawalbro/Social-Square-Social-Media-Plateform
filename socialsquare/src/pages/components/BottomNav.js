import React, { useRef, useState, useLayoutEffect } from 'react';
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
    const cardBg = isDark ? 'bg-black/90 border-neutral-800' : 'bg-white/95 border-gray-200';
    const msgCount = totalUnread();

    const navItems = [
        { key: 'feed', icon: 'pi-home', to: () => `/${user?.username || ''}` },
        { key: 'explore', icon: 'pi-compass', to: () => '/explore' },
        { key: 'pulse', icon: 'pi-bolt', to: () => '/pulse' },
        { key: 'communities', icon: 'pi-map', to: () => '/communities' },
        { key: 'messages', icon: 'pi-envelope', to: () => '/conversations', badge: msgCount },
        { key: 'profile', icon: 'pi-user', to: () => `/profile/${user?._id || ''}` },
    ];

    const isActive = (key, to) => {
        const currentPath = location.pathname || '';
        if (key === 'feed') return currentPath === `/${user?.username}` || currentPath === '/';
        if (key === 'profile') return currentPath.startsWith('/profile');
        const target = typeof to === 'function' ? to() : to;
        if (!target) return false;
        return currentPath === target || currentPath.startsWith(`${target}/`);
    };

    const activeKey = navItems.find(item => isActive(item.key, item.to))?.key ?? null;

    // ── Floating pill refs ───────────────────────────────────────────────────
    const containerRef = useRef(null);
    const itemRefs = useRef({});
    const [pill, setPill] = useState({ left: 0, width: 40, opacity: 0 });
    const [pillReady, setPillReady] = useState(false);

    useLayoutEffect(() => {
        const activeEl = itemRefs.current[activeKey];
        const container = containerRef.current;
        if (!activeEl || !container) { setPill(p => ({ ...p, opacity: 0 })); return; }

        const cRect = container.getBoundingClientRect();
        const eRect = activeEl.getBoundingClientRect();

        // Centre the pill on the icon button
        const pillW = 40;
        const centre = eRect.left - cRect.left + eRect.width / 2;

        setPill({ left: centre - pillW / 2, width: pillW, opacity: 1 });
        setPillReady(true);
    }, [activeKey]);

    if (isChatOpen) return null;
    if (!user) return null;


    const handleClick = (item) => {
        const target = typeof item.to === 'function' ? item.to() : item.to;
        if (target) navigate(target);
    };

    const inactiveClass = isDark ? 'text-gray-400' : 'text-gray-500';

    return (
        <div
            className={`sm:hidden fixed bottom-0 left-0 right-0 w-full ${cardBg} border-t backdrop-blur-md px-2 py-2 flex justify-around items-center`}
            style={{ zIndex: 1000, paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        >
            {/* ── Floating pill ── */}
            <div
                ref={containerRef}
                className="absolute inset-x-0 top-0 bottom-0 pointer-events-none"
                aria-hidden="true"
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        left: pill.left,
                        width: pill.width,
                        height: 40,
                        borderRadius: '9999px',
                        background: 'linear-gradient(135deg, #808bf5, #6366f1, #4f46e5)',
                        boxShadow: '0 6px 20px rgba(99,102,241,0.38)',
                        opacity: pillReady ? pill.opacity : 0,
                        transition: pillReady
                            ? 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s ease, opacity 0.2s ease'
                            : 'none',
                        overflow: 'hidden',
                    }}
                >
                    {/* Shimmer streak */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        left: '-60%',
                        width: '40%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                        animation: 'shimmer 2.4s ease-in-out infinite',
                    }} />
                </div>
            </div>

            {/* ── Nav items ── */}
            {navItems.map(item => {
                const active = activeKey === item.key;
                return (
                    <button
                        key={item.key}
                        ref={el => { itemRefs.current[item.key] = el; }}
                        aria-label={item.key}
                        onClick={() => handleClick(item)}
                        className="relative flex flex-col items-center justify-center border-0 bg-transparent cursor-pointer"
                        style={{ width: 44, height: 44 }}
                    >
                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                            <i
                                className={`pi ${item.icon} transition-all duration-300 relative z-10
                                    ${active ? 'text-white text-xl scale-110' : `${inactiveClass} text-lg`}`}
                            />
                            {item.badge > 0 && (
                                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-black shadow-sm z-20">
                                    {item.badge > 9 ? '9+' : item.badge}
                                </span>
                            )}
                        </div>
                    </button>
                );
            })}

            <style>{`
                @keyframes shimmer {
                    0%   { left: -60%; }
                    60%  { left: 120%; }
                    100% { left: 120%; }
                }
            `}</style>
        </div>
    );
};

export default BottomNav;