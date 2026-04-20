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
    const isChatOpen = location.pathname.startsWith('/messages/') && location.pathname.split('/').length > 2;
    const isMessages = location.pathname === '/messages';

    if (isChatOpen) return null;

    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

    const navItems = [
        { key: 'feed', icon: 'pi-home', to: () => `/${user?.username || ''}` },
        { key: 'explore', icon: 'pi-compass', to: () => '/explore' },
        { key: 'pulse', icon: 'pi-bolt', to: () => '/pulse', accent: true },
        { key: 'users', icon: 'pi-users', to: () => '/users' },
        { key: 'messages', icon: 'pi-envelope', to: () => '/messages' },
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
        return currentPath.startsWith(to());
    };

    const handleClick = (item) => {
        const target = item.to();
        if (!target) return;
        navigate(target);
    };

    return (
        <div className={`lg:hidden fixed bottom-2 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md ${cardBg} rounded-full p-2 shadow-md`} style={{ zIndex: 1000 }}>
            <div className="flex justify-around">
                {navItems.map(item => (
                    <button key={item.key}
                        aria-label={item.key.charAt(0).toUpperCase() + item.key.slice(1)}
                        className={`px-3 py-2 rounded-full border-0 cursor-pointer transition-all ${
                            item.accent ? 'bg-gradient-to-tr from-[#808bf5] to-[#6366f1] text-white shadow-md' : 
                            isActive(item.key, item.to) ? 'bg-[#808bf5] text-white' : 
                            isDark ? 'bg-gray-700 text-gray-300' : 'bg-transparent border border-gray-200 text-gray-600'
                        }`}
                        onClick={() => handleClick(item)}>
                        <i className={`pi ${item.icon}`}></i>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNav;
