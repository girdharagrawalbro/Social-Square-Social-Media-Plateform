import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import NotificationBell from './ui/NotificationBell';
import { Dialog } from 'primereact/dialog';
import NewPost from "./Newpost";
import { useSystemFlags } from '../../hooks/queries/useMiscQueries';
import { USER_DEFAULT_IMAGE } from '../../utils/constantMediaVariable';
import { hoverButtonAnimation, hoverButtonReset } from '../../utils/animations';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useCollabInvites } from '../../hooks/queries/useAuthQueries';

export default function Sidebar() {
    const { isDark, toggle } = useDarkMode();
    const [newpostVisible, setnewpostVisible] = useState(false);
    const [open, setOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
    const location = useLocation();
    const navigate = useNavigate();
    const { data: flags } = useSystemFlags();
    const { totalUnread, unreadNotificationsCount } = useConversationStore();
    const { data: collabInvites = [] } = useCollabInvites(user?._id);

    const pendingCollabCount = collabInvites.length;
    const notificationsBadge = unreadNotificationsCount + pendingCollabCount;
    const messagesBadge = totalUnread();

    // ── Floating pill state ──────────────────────────────────────────────────
    const navRef = useRef(null);
    const itemRefs = useRef({});
    const [pillStyle, setPillStyle] = useState({ top: 0, height: 48, opacity: 0 });
    const [pillReady, setPillReady] = useState(false);

    const allNavItems = !user
        ? [
            { key: 'home', label: 'Home', icon: 'pi pi-home', to: '/' },
            { key: 'login', label: 'Log In', icon: 'pi pi-sign-in', to: '/login', accent: true },
        ]
        : [
            { key: 'feed', label: 'Home', icon: 'pi pi-home', to: `/${user?.username}` },
            { key: 'search', label: 'Search', icon: 'pi pi-search', to: '/explore' },
            { key: 'reels', label: 'Reels', icon: 'pi pi-video', to: '/reels' },
            { key: 'discover', label: 'Discover', icon: 'pi pi-users', to: '/discover' },
            { key: 'pulse', label: 'Pulse', icon: 'pi pi-bolt', to: '/pulse' },
            { key: 'addpost', label: 'Add', icon: 'pi pi-plus-circle', to: '/compose' },
            { key: 'confessions', label: 'Confessions', icon: 'pi pi-map', to: '/confessions' },
            { key: 'conversations', label: 'Conversations', icon: 'pi pi-envelope', to: '/conversations', badge: messagesBadge },
            { key: 'notifications', label: 'Notifications', icon: 'pi pi-bell', to: '/notifications', badge: notificationsBadge },
            { key: 'knowledge', label: 'Knowledge', icon: 'pi pi-book', to: '/knowledge' },
        ].filter(item => !(item.key === 'confessions' && flags?.anonymous_posts === false));

    // Find active key including admin
    const getActiveKey = () => {
        if (newpostVisible) return 'addpost';
        for (const l of allNavItems) {
            if (!l.to) continue;
            if (l.to === `/${user?.username}` && (location.pathname === l.to || location.pathname === '/')) return l.key;
            if (l.to !== `/${user?.username}` && (location.pathname === l.to || location.pathname.startsWith(`${l.to}/`))) return l.key;
            if (l.accent) return l.key;
        }
        return null;
    };

    const activeKey = getActiveKey();

    // ── Update pill position whenever active item or open state changes ──────
    useLayoutEffect(() => {
        const activeEl = itemRefs.current[activeKey];
        const nav = navRef.current;
        if (!activeEl || !nav) {
            setPillStyle(s => ({ ...s, opacity: 0 }));
            return;
        }
        const navRect = nav.getBoundingClientRect();
        const elRect = activeEl.getBoundingClientRect();
        setPillStyle({
            top: elRect.top - navRect.top + nav.scrollTop,
            height: elRect.height,
            opacity: 1,
        });
        setPillReady(true);
    }, [activeKey, open, location.pathname, newpostVisible]);

    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMoreMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const nav = navRef.current;
        if (!nav) return;
        const onScroll = () => {
            const activeEl = itemRefs.current[activeKey];
            if (!activeEl) return;
            const navRect = nav.getBoundingClientRect();
            const elRect = activeEl.getBoundingClientRect();
            setPillStyle(s => ({
                ...s,
                top: elRect.top - navRect.top + nav.scrollTop,
            }));
        };
        nav.addEventListener('scroll', onScroll);
        return () => nav.removeEventListener('scroll', onScroll);
    }, [activeKey]);

    const setItemRef = (key) => (el) => {
        itemRefs.current[key] = el;
    };



    // ── Shared item classes (no bg — pill handles it) ────────────────────────
    const itemBase = (key) =>
        `relative z-10 flex items-center rounded-full transition-colors duration-150 border-0 cursor-pointer text-left w-full
        ${open ? 'px-4 gap-4 justify-start' : 'justify-center'}
        ${activeKey === key
            ? 'text-white'
            : 'text-[var(--text-main)] hover:bg-gray-100 dark:hover:bg-neutral-900'
        }`;

    const iconClass = 'text-xl relative z-10 shrink-0 w-6 h-6 flex items-center justify-center';
    const labelClass = 'font-semibold text-base relative z-10 truncate';

    return (
        <>
            <aside
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className={`sticky top-0 h-full hidden md:flex flex-col bg-transparent transition-all duration-300 ease-in-out shadow-xl z-40 ${open ? 'w-72' : 'w-20'}`}
            >
                {/* Logo */}
                <div className="flex items-center justify-between px-3 py-4">
                    <div className="flex items-center gap-3">
                        <Link to={user?.username ? `/${user.username}` : "/"} className="flex items-center shrink-0 ml-1">
                            <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-full" />
                        </Link>
                        {open && (
                            <div className="text-sm font-semibold opacity-100 transition-opacity duration-300">
                                <h1 className="font-pacifico text-3xl m-0 whitespace-nowrap text-[var(--text-main)]">Social Square</h1>
                            </div>
                        )}
                    </div>
                </div>

                {/* Nav */}
                <nav
                    ref={navRef}
                    className="flex-1 flex flex-col justify-center overflow-auto py-1 relative"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {/* ── Floating pill ── */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: open ? '8px' : '16px',
                            right: open ? '8px' : '16px',
                            top: pillStyle.top,
                            height: pillStyle.height,
                            borderRadius: '9999px',
                            background: 'linear-gradient(135deg, #808bf5, #6366f1, #4f46e5)',
                            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
                            opacity: pillReady ? pillStyle.opacity : 0,
                            // First render: no transition so it snaps into place without flying from top:0
                            transition: pillReady
                                ? 'top 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s ease, left 0.3s ease, right 0.3s ease, opacity 0.2s ease'
                                : 'left 0.3s ease, right 0.3s ease',
                            pointerEvents: 'none',
                            zIndex: 1,
                            // Subtle shimmer overlay
                            overflow: 'hidden',
                        }}
                    >
                        {/* Shimmer streak */}
                        <div style={{
                            position: 'absolute',
                            top: 0, bottom: 0,
                            left: '-60%',
                            width: '40%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                            animation: 'shimmer 2.4s ease-in-out infinite',
                            borderRadius: 'inherit',
                        }} />
                    </div>

                    <ul className="flex flex-col gap-2 px-2 items-center w-full">
                        {allNavItems.map(l => (
                            <li key={l.key} className="w-full">
                                {l.key === 'addpost' ? (
                                    <button
                                        ref={setItemRef(l.key)}
                                        aria-label={l.label}
                                        onClick={() => setnewpostVisible(true)}
                                        onMouseEnter={(e) => hoverButtonAnimation(e.currentTarget)}
                                        onMouseLeave={(e) => hoverButtonReset(e.currentTarget)}
                                        className={`${itemBase(l.key)} h-12`}
                                    >
                                        <i className={`${l.icon} ${iconClass}`} />
                                        {open && <span className={labelClass}>{l.label}</span>}
                                    </button>
                                ) : (
                                    <Link
                                        ref={setItemRef(l.key)}
                                        aria-label={l.label}
                                        to={l.to || '#'}
                                        onMouseEnter={(e) => hoverButtonAnimation(e.currentTarget)}
                                        onMouseLeave={(e) => hoverButtonReset(e.currentTarget)}
                                        className={`${itemBase(l.key)} h-12`}
                                    >
                                        <div className="relative flex items-center justify-center shrink-0">
                                            <i className={`${l.icon} ${iconClass}`} />
                                            {l.badge > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-red-500 text-white !min-w-[16px] !h-[16px] text-[9px] font-black flex items-center justify-center rounded-full shadow-sm z-20 px-1 py-1.5">
                                                    {l.badge > 99 ? '99+' : l.badge}
                                                </span>
                                            )}
                                        </div>
                                        {open && <span className={labelClass}>{l.label}</span>}
                                    </Link>
                                )}
                            </li>
                        ))}


                    </ul>
                </nav>

                {/* User footer */}
                {user && (
                    <div
                        ref={menuRef}
                        className={`relative p-3 border-t border-[var(--border-color)] flex flex-col items-${open ? 'start' : 'center'} gap-3 w-full`}
                    >
                        <Link to={`/profile/${user._id}`} className="w-full">
                            <div className="flex items-center gap-3 w-full px-1">
                                <img
                                    src={user?.profile_picture || USER_DEFAULT_IMAGE}
                                    alt="me"
                                    className="w-10 h-10 rounded-full border-2 border-[#808bf5]/20 shadow-sm shrink-0"
                                />
                                {open && (
                                    <div className="flex flex-col truncate">
                                        <span className="text-sm font-bold text-[var(--text-main)] leading-none truncate">{user?.fullname || 'User'}</span>
                                    </div>
                                )}
                            </div>
                        </Link>

                        {/* The Hamburger Button */}
                        <button
                            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                            className={`flex items-center ${open ? 'w-full px-3 py-2 justify-start gap-4' : 'w-10 h-10 justify-center'} rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 border-0 cursor-pointer transition-colors bg-transparent`}
                            aria-label="More options"
                        >
                            <i className="pi pi-bars text-xl w-6 text-center text-[var(--text-main)] shrink-0" />
                            {open && <span className="font-semibold text-base text-[var(--text-main)]">More</span>}
                        </button>

                        {/* The Popup Menu */}
                        {isMoreMenuOpen && (
                            <div className="absolute bottom-full left-2 mb-2 w-48 bg-[var(--surface-1)] dark:bg-neutral-900 rounded-xl shadow-xl border border-[var(--border-color)] overflow-hidden z-50 animate-fade-in">
                                <div className="flex flex-col">

                                    {/* Theme Toggle Inside Popup */}
                                    <button
                                        onClick={() => {
                                            toggle();
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-neutral-700 text-left text-sm text-[var(--text-main)] border-0 cursor-pointer bg-transparent"
                                    >
                                        <i className={`pi ${isDark ? 'pi-moon' : 'pi-sun'} text-lg w-6 text-center`} />
                                        <span className="font-semibold">{isDark ? 'Dark' : 'Light'}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            navigate('/settings');
                                            setIsMoreMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-left text-sm border-0 cursor-pointer bg-transparent transition-colors"
                                    >
                                        <i className="pi pi-cog text-lg w-6 text-center" />
                                        <span className="font-semibold">Settings</span>
                                    </button>
                                    {/* Logout Inside Popup */}
                                    <button
                                        onClick={() => {
                                            logout();
                                            setIsMoreMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-left text-sm text-red-500 border-0 cursor-pointer bg-transparent transition-colors"
                                    >
                                        <i className="pi pi-sign-out text-lg w-6 text-center" />
                                        <span className="font-semibold">Log out</span>
                                    </button>

                                </div>
                            </div>
                        )}
                    </div>
                )}
            </aside>

            {/* Shimmer keyframe — inject once */}
            <style>{`
                @keyframes shimmer {
                    0%   { left: -60%; }
                    60%  { left: 120%; }
                    100% { left: 120%; }
                }
            `}</style>



            <NewPost visible={newpostVisible} onHide={() => setnewpostVisible(false)} />
        </>
    );
}
