import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import NotificationBell from './ui/NotificationBell';
import { Dialog } from 'primereact/dialog';
import Search from './Search';
import NewPost from "./Newpost";

export default function Sidebar() {
    const { isDark, toggle } = useDarkMode();
    const [newpostVisible, setnewpostVisible] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [open, setOpen] = useState(false);

    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
    const location = useLocation();

    // ── Floating pill state ──────────────────────────────────────────────────
    const navRef = useRef(null);
    const itemRefs = useRef({});
    const [pillStyle, setPillStyle] = useState({ top: 0, height: 48, opacity: 0 });
    const [pillReady, setPillReady] = useState(false);


    const links = !user
        ? [
            { key: 'home', label: 'Home', icon: 'pi pi-home', to: '/' },
            { key: 'login', label: 'Log In', icon: 'pi pi-sign-in', to: '/login', accent: true },
        ]
        : [
            { key: 'feed', label: 'Home', icon: 'pi pi-home', to: `/${user?.username}` },
            { key: 'search', label: 'Search', icon: 'pi pi-search', to: '/search' },
            { key: 'explore', label: 'Explore', icon: 'pi pi-compass', to: '/explore' },
            { key: 'discover', label: 'Discover', icon: 'pi pi-users', to: '/discover' },
            { key: 'pulse', label: 'Pulse', icon: 'pi pi-bolt', to: '/pulse' },
            { key: 'addpost', label: 'Add', icon: 'pi pi-plus-circle', to: '/compose' },
            { key: 'communities', label: 'Communities', icon: 'pi pi-map', to: '/communities' },
            { key: 'conversations', label: 'Conversations', icon: 'pi pi-envelope', to: '/conversations' },
            { key: 'profile', label: 'Profile', icon: 'pi pi-user', to: user?._id ? `/profile/${user._id}` : '/profile' },
            { key: 'notifications', label: 'Notifications', icon: 'pi pi-bell', to: '/notifications' },
            { key: 'sessions', label: 'Sessions', icon: 'pi pi-cog', to: '/sessions' },
        ];

    const allNavItems = [
        ...links,
        ...(user?.isAdmin ? [{ key: 'admin', label: 'Admin', icon: 'pi pi-shield', to: '/admin' }] : []),
    ];

    // Find active key including admin
    const getActiveKey = () => {
        if (isSearchOpen) return 'search';
        if (newpostVisible) return 'addpost';
        if (user?.isAdmin && location.pathname.startsWith('/admin')) return 'admin';
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
    }, [activeKey, open, location.pathname, isSearchOpen, newpostVisible]);

    // ── Recalculate on scroll inside nav ────────────────────────────────────
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

    const iconClass = 'text-xl relative z-10 shrink-0';
    const labelClass = 'font-semibold text-base relative z-10 truncate';

    return (
        <>
            <aside
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className={`sticky top-0 h-screen hidden lg:flex flex-col bg-[var(--surface-1)] border-r border-[var(--border-color)] transition-all duration-300 ease-in-out shadow-xl z-40 ${open ? 'w-72' : 'w-20'}`}
            >
                {/* Logo */}
                <div className="flex items-center justify-between px-3 py-4 border-b border-[var(--border-color)]">
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
                    className="flex-1 overflow-auto py-1 relative"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {/* ── Floating pill ── */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: open ? '8px' : '12px',
                            right: open ? '8px' : '12px',
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

                    <ul className={`flex flex-col gap-2 ${open ? 'px-2 items-start' : 'px-3 items-center'}`}>
                        {links.map(l => (
                            <li key={l.key} className="w-full" ref={setItemRef(l.key)}>
                                {l.key === 'search' ? (
                                    <button
                                        aria-label={l.label}
                                        onClick={() => setIsSearchOpen(true)}
                                        className={`${itemBase(l.key)} h-12`}
                                    >
                                        <i className={`${l.icon} ${iconClass}`} />
                                        {open && <span className={labelClass}>{l.label}</span>}
                                    </button>
                                ) : l.key === 'addpost' ? (
                                    <button
                                        aria-label={l.label}
                                        onClick={() => setnewpostVisible(true)}
                                        className={`${itemBase(l.key)} h-12`}
                                    >
                                        <i className={`${l.icon} ${iconClass}`} />
                                        {open && <span className={labelClass}>{l.label}</span>}
                                    </button>
                                ) : l.key === 'notifications' ? (
                                    <NotificationBell
                                        userId={user?._id}
                                        useRoute={true}
                                        showLabel={open}
                                        active={activeKey === 'notifications'}
                                    />
                                ) : (
                                    <Link
                                        aria-label={l.label}
                                        to={l.to || '#'}
                                        className={`${itemBase(l.key)} h-12`}
                                    >
                                        <i className={`${l.icon} ${iconClass}`} />
                                        {open && <span className={labelClass}>{l.label}</span>}
                                    </Link>
                                )}
                            </li>
                        ))}

                        {/* Admin link */}
                        {user?.isAdmin && (
                            <li className="w-full" ref={setItemRef('admin')}>
                                <Link
                                    to="/admin"
                                    aria-label="Admin"
                                    className={`${itemBase('admin')} h-12`}
                                >
                                    <i className={`pi pi-shield ${iconClass}`} />
                                    {open && <span className={labelClass}>Admin</span>}
                                </Link>
                            </li>
                        )}

                        {/* Theme toggle — not part of pill system */}
                        <li className="w-full">
                            <button
                                aria-label="Theme"
                                onClick={toggle}
                                className={`${open ? 'w-full px-4' : 'w-12'} h-12 flex items-center ${open ? 'justify-start gap-4' : 'justify-center'} rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 border-0 cursor-pointer text-left transition-colors`}
                            >
                                <i className={`pi ${isDark ? 'pi-moon' : 'pi-sun'} text-xl`} />
                                {open && <span className="font-semibold text-base">Theme</span>}
                            </button>
                        </li>
                    </ul>
                </nav>

                {/* User footer */}
                {user && (
                    <div className={`p-3 border-t border-[var(--border-color)] flex flex-col items-${open ? 'start' : 'center'} gap-3 w-full`}>
                        <Link to={`/profile/${user._id}`}>
                            <div className="flex items-center gap-3 w-full px-1">
                                <img
                                    src={user?.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'}
                                    alt="me"
                                    className="w-10 h-10 rounded-full border-2 border-[#808bf5]/20 shadow-sm"
                                />
                                {open && (
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[var(--text-main)] leading-none">{user?.fullname || 'User'}</span>
                                    </div>
                                )}
                            </div>
                        </Link>
                        <button
                            onClick={() => logout()}
                            className={`flex items-center ${open ? 'w-full px-4 py-2 justify-start gap-3' : 'w-10 h-10 justify-center'} rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border-0 cursor-pointer p-0`}
                            aria-label="Logout"
                        >
                            <i className={`pi pi-sign-out ${open ? 'text-lg' : 'text-xl'}`} />
                            {open && <span className="font-bold text-sm">Logout</span>}
                        </button>
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

            <Dialog
                header="Search Users, Posts, Categories..."
                visible={isSearchOpen}
                onHide={() => setIsSearchOpen(false)}
                style={{ width: '50vw', height: '100vh' }}
                position="center"
                baseZIndex={2000}
                appendTo={document.body}
                draggable={false}
                resizable={false}
                modal
            >
                <div style={{ padding: 8 }}>
                    <Search onClose={() => setIsSearchOpen(false)} />
                </div>
            </Dialog>

            <NewPost visible={newpostVisible} onHide={() => setnewpostVisible(false)} />
        </>
    );
}