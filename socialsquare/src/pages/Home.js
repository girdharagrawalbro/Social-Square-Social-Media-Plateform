import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Stories from './components/Stories';
import Explore from './components/Explore';
import Navbar from './components/Navbar';
import { useDarkMode } from '../context/DarkModeContext';
import { showPushNotification } from '../utils/pushNotifications';
import useFeedSocket from '../hooks/useFeedSocket';
import MoodFeedToggle from './components/MoodFeedToggle';
import useAuthStore from '../store/zustand/useAuthStore';
import Chatbot from './components/Chatbot'

const Home = () => {
    const token = localStorage.getItem('token');
    const [activeView, setActiveView] = useState('feed');
    const navigate = useNavigate();
    const fetchUser = useAuthStore(state => state.fetchUser);
    const loggeduser = useAuthStore(state => state.user);
    const authLoading = useAuthStore(state => state.loading);
    const authError = useAuthStore(state => state.error);
    const { isDark } = useDarkMode();

    const [activeMood, setActiveMood] = useState(null);

    // ✅ All real-time feed socket listeners
    useFeedSocket();

    useEffect(() => {
        const token = localStorage.getItem('token');
        console.log(token);
        if (!token) { navigate('/landing'); return; }
        fetchUser();
    }, [fetchUser, token, navigate]);

    useEffect(() => {
        if (loggeduser?._id) {
            if (!socket.connected) socket.connect();
            socket.emit('registerUser', loggeduser._id);
            socket.on('connect', () => { localStorage.setItem('socketId', socket.id); });

            socket.on('receiveMessage', ({ senderName, content }) => {
                showPushNotification({ title: `New message from ${senderName}`, body: content, onClick: () => window.focus() });
            });

            socket.on('newNotification', (notification) => {
                showPushNotification({ title: `${notification.sender?.fullname} created a new post`, body: 'Tap to view', onClick: () => window.focus() });
            });
        }
        return () => {
            socket.off('connect');
            socket.off('receiveMessage');
            socket.off('newNotification');
        };
    }, [loggeduser]);

    useEffect(() => {
        if (authError && !authLoading) {
            localStorage.removeItem('token');
            localStorage.removeItem('socketId');
            navigate('/landing');
        }
    }, [authError, authLoading, navigate]);

    if (authLoading) return <MainSkeleton />;
    if (!token || !loggeduser) return <MainSkeleton />;

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return <><Stories /><Newpost /><MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} /><Feed activeMood={activeMood} /></>;
            case 'explore': return <Explore />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <Conversations />;
            default: return null;
        }
    };

    const navItems = [
        { key: 'feed', icon: 'pi-home' },
        { key: 'explore', icon: 'pi-compass' },
        { key: 'otherUsers', icon: 'pi-users' },
        { key: 'messages', icon: 'pi-envelope' },
        { key: 'profile', icon: 'pi-user' },
    ];

    return (
        <section className={`min-h-screen w-full ${bg} transition-colors duration-200`}>
            <Navbar />

            {/* Desktop */}
            <div className="hidden lg:flex gap-3 w-full max-w-8xl mx-auto p-3">
                <div className="w-25"><OtherUsers /></div>
                <div className="w-50 overflow-y-scroll h-screen px-3">
                    <Stories />
                    <Newpost />
                    <MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} />
                    <Feed activeMood={activeMood} />
                </div>
                <div className="w-25">
                    <Profile />
                    <Conversations />
                </div>
            </div>

            {/* Mobile */}
            <div className="flex lg:hidden flex-col h-screen">
                <div className="flex-1 overflow-auto p-2">{renderMobileView()}</div>
                <div className={`fixed bottom-3 left-1/2 transform -translate-x-1/2 w-11/12 md:w-3/4 ${cardBg} rounded-full p-2 shadow-md`} style={{ zIndex: 100 }}>
                    <div className="flex justify-around">
                        {navItems.map(item => (
                            <button key={item.key}
                                className={`px-3 py-2 rounded-full border-0 cursor-pointer transition-all ${activeView === item.key ? 'bg-[#808bf5] text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-transparent border border-gray-200 text-gray-600'}`}
                                onClick={() => setActiveView(item.key)}>
                                <i className={`pi ${item.icon}`}></i>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <Chatbot />

        </section>
    );
};

export default Home;