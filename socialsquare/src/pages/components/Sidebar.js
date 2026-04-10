import { useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { Link } from 'react-router-dom';
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




    const [open, setOpen] = useState(false);

    const user = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);

    const links = [
        { key: 'feed', label: 'Home', icon: 'pi pi-home', to: `/${user?.username || 'You'}` },
        { key: 'explore', label: 'Explore', icon: 'pi pi-compass', to: '/explore' },
        { key: 'communities', label: 'Communities', icon: 'pi pi-users', to: '/communities' },
        { key: 'messages', label: 'Messages', icon: 'pi pi-envelope', to: '/messages' },
        { key: 'profile', label: 'Profile', icon: 'pi pi-user', to: user?._id ? `/profile/${user._id}` : '/profile' },
        { key: 'search', label: 'Search', icon: 'pi pi-search', to: '/search' },
        { key: 'addpost', label: 'Add', icon: 'pi pi-plus-circle', to: '/compose' },
        { key: 'notifications', label: 'Notifications', icon: 'pi pi-bell', to: '/notifications' },
        { key: 'settings', label: 'Settings', icon: 'pi pi-cog', to: '/settings' },
    ];


    return (
        <>
            <aside
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className={`sticky top-0 h-screen hidden lg:flex flex-col bg-[var(--surface-1)] border-r border-[var(--border-color)] transition-all duration-300 ease-in-out shadow-xl z-40 ${open ? 'w-72' : 'w-20'}`}
            >
                <div className="flex items-center justify-between px-3 py-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                        <Link to={user?.username ? `/${user.username}` : "/"} className="flex items-center shrink-0 ml-1">
                            <i className={`pi pi-home text-3xl text-[var(--text-main)]`}></i>
                        </Link>
                        {open && <div className="text-sm font-semibold opacity-100 transition-opacity duration-300"><h1 className="font-pacifico text-3xl m-0 whitespace-nowrap text-[var(--text-main)]">Social Square</h1></div>}
                    </div>
                </div>

                <nav className="flex-1 overflow-auto py-1">
                    <ul className="flex flex-col gap-2 px-1">
                        {links.map(l => (
                            <li key={l.key}>
                                {l.key === 'search' ? (
                                    <button aria-label={l.label} onClick={() => setIsSearchOpen(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left hover:bg-gray-100 dark:hover:bg-neutral-900`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </button>
                                ) : l.key === 'addpost' ? (
                                    <button aria-label={l.label} onClick={() => setnewpostVisible(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left hover:bg-gray-100 dark:hover:bg-neutral-900`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </button>
                                ) : l.key === 'notifications' ? (
                                    <NotificationBell userId={user?._id} useRoute={true} showLabel={open} />
                                ) : (
                                    <Link aria-label={l.label} to={l.to || '#'} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${l.accent ? 'bg-gradient-to-r from-[#808bf5] to-[#6366f1] text-white font-semibold shadow-md' : 'hover:bg-gray-100 dark:hover:bg-neutral-900'}`}>
                                        <i className={`${l.icon} text-xl`} />
                                        {open && <span className="font-medium text-base">{l.label}</span>}
                                    </Link>
                                )}
                            </li>
                        ))}
                        {user?.isAdmin && (
                            <li>
                                <Link to="/admin" className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-left">
                                    <i className={`pi pi-shield text-xl`} />
                                    {open && <span className="font-medium text-base">Admin</span>}
                                </Link>
                            </li>
                        )}
                        <li>
                            <button aria-label="Theme" onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 text-left">
                                <i className={`pi ${isDark ? 'pi-moon' : 'pi-sun'} text-xl`} />
                                {open && <span className="font-medium text-base">Theme</span>}
                            </button>
                        </li>
                    </ul>
                </nav>

                <div className="p-3 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <img src={user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullname || 'U')}&background=808bf5&color=fff`} alt="me" className="w-10 h-10 rounded-full border border-[var(--border-color)]" />
                        {open && <div className="text-base font-semibold text-[var(--text-main)]">{user?.fullname || 'You'}</div>}
                    </div>

                    <div className="mt-3">
                        {open ? (
                            <button onClick={() => logout()} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700">
                                <i className="pi pi-sign-out"></i>
                                <span className="font-semibold">Logout</span>
                            </button>
                        ) : (
                            <button aria-label="Logout" onClick={() => logout()} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center mx-auto hover:bg-red-700">
                                <i className="pi pi-sign-out"></i>
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            <Dialog header={"Search Users , Posts , Categories..."} visible={isSearchOpen} onHide={() => setIsSearchOpen(false)} style={{ width: '50vw', height: '100vh' }} position="top" baseZIndex={2000} appendTo={document.body} draggable={false} resizable={false} modal>
                <div style={{ padding: 8 }}>
                    <Search onClose={() => setIsSearchOpen(false)} />
                </div>
            </Dialog>

            <Dialog header="Add Post" visible={newpostVisible} modal position="center" style={{ width: '30vw', maxHeight: '100vh' }} onHide={() => setnewpostVisible(false)}>
                <NewPost setnewpostVisible={setnewpostVisible} />
            </Dialog>


        </>
    );
}
