import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import useAuthStore from '../store/zustand/useAuthStore';
import Chatbot from './components/Chatbot';
import MoodFeedToggle from './components/MoodFeedToggle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePostStore from '../store/zustand/usePostStore';
import { Dialog } from 'primereact/dialog';
import PostDetail from './components/PostDetail';

const Home = () => {
    const [activeView, setActiveView] = useState('feed');
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const [activeMood, setActiveMood] = useState(null);
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;

    const loggeduser = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const postDetailId = usePostStore(s => s.postDetailId);
    const setPostDetailId = usePostStore(s => s.setPostDetailId);

    // ✅ Redirect to landing only after auth check is complete and no user found
    useEffect(() => {
        if (initialized && !loading && !loggeduser) {
            navigate('/landing');
        }
    }, [initialized, loading, loggeduser, navigate]);

    // Show skeleton while auth is being checked
    if (!initialized || loading || !loggeduser) return <MainSkeleton />;

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return <><Stories /><Newpost /><MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} /><Feed activeMood={activeMood} /></>;
            case 'explore': return <Explore />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <div className="h-full flex flex-col"><Conversations /></div>;
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
        <section className={`min-h-[100dvh] w-full overflow-x-hidden ${bg} transition-colors duration-200`}>
            <Navbar />

            {/* Desktop */}
            {isDesktop ? (
                <div className="flex gap-3 w-full max-w-8xl mx-auto p-3 h-[calc(100dvh-64px)]">
                    <div className="w-25 h-full overflow-y-auto">
                        <Profile />
                    </div>
                    <div className="w-50 overflow-y-auto h-full px-3">
                        <Stories />
                        <MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} />
                        <Feed activeMood={activeMood} />
                    </div>
                    <div className="w-25 h-full overflow-y-auto">
                        <Conversations/>
                        <OtherUsers />
                    </div>
                </div>
            ) : (
                /* Mobile */
                <div className="flex flex-col h-[calc(100dvh-60px)] overflow-hidden">
                    <div className={`flex-1 p-2 pb-20 ${activeView === 'messages' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>
                        {renderMobileView()}
                    </div>
                    <div className={`fixed bottom-2 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md ${cardBg} rounded-full p-2 shadow-md`} style={{ zIndex: 100 }}>
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
            )}

            <Chatbot />

            <Dialog 
                header="Post Detail" 
                visible={!!postDetailId} 
                style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }}
                onHide={() => setPostDetailId(null)} 
                blockScroll
            >
                {postDetailId && <PostDetail postId={postDetailId} onHide={() => setPostDetailId(null)}  />}
            </Dialog>
        </section>
    );
};

export default Home;
