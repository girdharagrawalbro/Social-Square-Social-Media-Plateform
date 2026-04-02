import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Stories from './components/Stories';
import Explore from './components/Explore';
import Groups from './components/Groups';
import Navbar from './components/Navbar';
import { useDarkMode } from '../context/DarkModeContext';
import useAuthStore from '../store/zustand/useAuthStore';
import Chatbot from './components/Chatbot';
import useWindowWidth from '../hooks/useWindowWidth';
import usePostStore from '../store/zustand/usePostStore';
import { Dialog } from 'primereact/dialog';
import PostDetail from './components/PostDetail';
import toast from 'react-hot-toast';

const Home = () => {
    const [activeView, setActiveView] = useState('feed');
    const [desktopView, setDesktopView] = useState('profile'); // 'profile' or 'communities'
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;

    const loggeduser = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const postDetailId = usePostStore(s => s.postDetailId);
    const setPostDetailId = usePostStore(s => s.setPostDetailId);
    const resendVerification = useAuthStore(s => s.resendVerification);
    const [isResending, setIsResending] = useState(false);

    // ✅ Redirect to landing only after auth check is complete and no user found
    useEffect(() => {
        if (initialized && !loading && !loggeduser) {
            navigate('/');
        }
    }, [initialized, loading, loggeduser, navigate]);

    // Show skeleton while auth is being checked
    if (!initialized || loading || !loggeduser) return <MainSkeleton />;

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return <><Stories /><Feed activeMood={null} /></>;
            case 'explore': return <Explore />;
            case 'communities': return <Groups />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <div className="h-full flex flex-col"><Conversations /></div>;
            default: return null;
        }
    };

    const navItems = [
        { key: 'feed', icon: 'pi-home' },
        { key: 'explore', icon: 'pi-compass' },
        { key: 'communities', icon: 'pi-users' },
        { key: 'messages', icon: 'pi-envelope' },
        { key: 'profile', icon: 'pi-user' },
    ];

    const handleResend = async () => {
        setIsResending(true);
        const result = await resendVerification();
        setIsResending(false);
        if (result.success) {
            toast.success(result.message);
        } else {
            toast.error(result.error);
        }
    };

    const VerificationBanner = () => {
        if (!loggeduser || loggeduser.isEmailVerified) return null;
        return (
            <div className="w-full bg-themeAccent/10 border-b border-themeAccent/20 py-3 px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top-4 duration-500">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    📧 Your email is not verified. Please check your inbox.
                </p>
                <button
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-xs font-bold bg-themeAccent text-white px-4 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isResending ? 'Sending...' : 'Resend Link'}
                </button>
            </div>
        );
    };

    return (
        <section className={`min-h-[100dvh] w-full overflow-x-hidden ${bg} transition-colors duration-200`}>
            <Navbar />
            <VerificationBanner />

            {/* Desktop */}
            {isDesktop ? (
                <div className="flex gap-3 w-full max-w-8xl mx-auto p-3 h-[calc(100dvh-64px)]">
                    <div className="w-25 h-full overflow-y-auto flex flex-col">
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setDesktopView('profile')}
                                className={`flex-1 px-3 py-2 rounded-lg border-0 text-xs font-bold cursor-pointer transition-all ${desktopView === 'profile' ? 'bg-[#808bf5] text-white' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}`}
                            >
                                👤 Profile
                            </button>
                            <button
                                onClick={() => setDesktopView('communities')}
                                className={`flex-1 px-3 py-2 rounded-lg border-0 text-xs font-bold cursor-pointer transition-all ${desktopView === 'communities' ? 'bg-[#808bf5] text-white' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}`}
                            >
                                👥 Communities
                            </button>
                        </div>
                        {desktopView === 'profile' ? <Profile /> : <Groups />}
                    </div>
                    <div className="w-50 overflow-y-auto h-full px-3">
                        <Stories />
                        <Feed activeMood={null} />
                    </div>
                    <div className="w-25 h-full flex flex-col gap-3 min-w-0">
                        <Conversations />
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
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                position="center"
                onHide={() => setPostDetailId(null)}
                baseZIndex={usePostStore.getState().isStoryViewerOpen ? 20000 : 1000}
                appendTo={document.body}
                blockScroll
                className="p-0 overflow-hidden post-detail-dialog"
            >
                {postDetailId && <PostDetail postId={postDetailId} onHide={() => setPostDetailId(null)} />}
            </Dialog>
        </section>
    );
};

export default Home;
