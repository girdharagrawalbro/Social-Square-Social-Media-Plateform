import { useState, useEffect } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import NotificationBell from './ui/NotificationBell';


import { Dialog } from 'primereact/dialog';


import Search from './Search';
import NewPost from "./Newpost";

// using existing imports `useNotifications` and `useNavigate` from above


export default function Sidebar() {
    const { isDark, toggle } = useDarkMode();
    const [newpostVisible, setnewpostVisible] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const navigate = useNavigate();



    const [open, setOpen] = useState(() => {
        try { return JSON.parse(localStorage.getItem('ss_sidebar_open')) ?? true; } catch { return true; }
    });

    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);

    useEffect(() => { localStorage.setItem('ss_sidebar_open', JSON.stringify(open)); }, [open]);

    const links = [
        { key: 'feed', label: 'Home', icon: 'pi pi-home', to: `/${user?.username || 'You'}` },
        { key: 'explore', label: 'Explore', icon: 'pi pi-compass', to: '/explore' },
        { key: 'communities', label: 'Communities', icon: 'pi pi-users', to: '/groups' },
        { key: 'messages', label: 'Messages', icon: 'pi pi-envelope', to: '/messages' },
        { key: 'profile', label: 'Profile', icon: 'pi pi-user', to: `/profile/${user?._id}` },
        { key: 'search', label: 'Search', icon: 'pi pi-search', to: '/search' },
        { key: 'addpost', label: 'Add Post', icon: 'pi pi-plus-circle', to: '/compose' },
        { key: 'notifications', label: 'Notifications', icon: 'pi pi-bell', to: '/notifications' },
        { key: 'settings', label: 'Settings', icon: 'pi pi-cog', to: '/settings' },
    ];


    return (
        <>
            <aside className={`hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transition-all duration-200 ${open ? 'w-72' : 'w-20'}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Link to={"/"} className="flex items-center">
                            <i className={`pi pi-home text-3xl ${isDark ? 'text-white' : 'text-black'}`}></i>
                        </Link>
                        {open && <div className="text-sm font-semibold"><h1 className="font-pacifico text-3xl m-0 whitespace-nowrap">Social Square</h1></div>}
                    </div>
                    <button aria-label="Toggle sidebar" onClick={() => setOpen(v => !v)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                        <i className={`pi ${open ? 'pi-angle-left' : 'pi-angle-right'}`}></i>
                    </button>
                </div>

                <nav className="flex-1 overflow-auto py-3">
                    <ul className="flex flex-col gap-2 px-1">
                        {links.map(l => (
                            <li key={l.key}>
                                {l.key === 'search' ? (
                                    <button onClick={() => setIsSearchOpen(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left hover:bg-gray-100 dark:hover:bg-gray-800`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </button>
                                ) : l.key === 'addpost' ? (
                                    <button onClick={() => setnewpostVisible(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left hover:bg-gray-100 dark:hover:bg-gray-800`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </button>
                                ) : l.key === 'notifications' ? (
                                    <NotificationBell userId={user?.id} />
                                ) : (
                                    <Link to={l.to || '#'} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${l.accent ? 'bg-gradient-to-r from-[#808bf5] to-[#6366f1] text-white font-semibold shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </Link>
                                )}
                            </li>
                        ))}
                        {user?.isAdmin && (
                            <li>
                                <Link to="/admin" className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left">
                                    <i className={`pi pi-shield text-xl`} />
                                    {open && <span className="font-medium text-base">Admin</span>}
                                </Link>
                            </li>
                        )}
                        <li>
                            <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-left">
                                <i className={`pi ${isDark ? 'pi-moon' : 'pi-sun'} text-xl`} />
                                {open && <span className="font-medium text-base">Toggle Theme</span>}
                            </button>
                        </li>
                    </ul>
                </nav>

                <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <img src={user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullname || 'U')}&background=808bf5&color=fff`} alt="me" className="w-10 h-10 rounded-full" />
                        {open && <div className="text-base">{user?.fullname || 'You'}</div>}
                    </div>

                    <div className="mt-3">
                        {open ? (
                            <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
                                <i className="pi pi-sign-out"></i>
                                <span className="font-semibold">Logout</span>
                            </button>
                        ) : (
                            <button onClick={() => logout()} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto hover:bg-red-700">
                                <i className="pi pi-sign-out"></i>
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            <Dialog header={null} visible={isSearchOpen} onHide={() => setIsSearchOpen(false)} style={{ width: '50vw', height: '100vh' }} position="top" baseZIndex={2000} appendTo={document.body} draggable={false} resizable={false} modal>
                <div style={{ padding: 8 }}>
                    <Search />
                </div>
            </Dialog>

            <Dialog header="Add Post" visible={newpostVisible} modal position="center" style={{ width: '30vw', maxHeight: '100vh' }} onHide={() => setnewpostVisible(false)}>
                <NewPost setnewpostVisible={setnewpostVisible} />
            </Dialog>


        </>
    );
}
