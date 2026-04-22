import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Stories from './components/Stories';
import Explore from './components/Explore';
import Communities from './components/Communities';
import useAuthStore from '../store/zustand/useAuthStore';
import useWindowWidth from '../hooks/useWindowWidth';
import usePostStore from '../store/zustand/usePostStore';

const Home = () => {
    const activeView = 'feed';
    const navigate = useNavigate();
    const location = useLocation();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 1024;

    const loggeduser = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const postDetailId = usePostStore(s => s.postDetailId);
    const setPostDetailId = usePostStore(s => s.setPostDetailId);
    const profileDetailId = usePostStore(s => s.profileDetailId);
    const setProfileDetailId = usePostStore(s => s.setProfileDetailId);
    const setStoryDetailDeepLink = usePostStore(s => s.setStoryDetailDeepLink);
    // const resendVerification = useAuthStore(s => s.resendVerification);
    // const [isResending, setIsResending] = useState(false);

    // ✅ Redirect to landing only after auth check is complete and no user found
    useEffect(() => {
        if (initialized && !loading && !loggeduser) {
            navigate('/');
        }
    }, [initialized, loading, loggeduser, navigate]);

    useEffect(() => {
        if (!initialized || loading || !loggeduser) return;

        const params = new URLSearchParams(location.search);
        const queryPostId = params.get('post');
        const queryProfileId = params.get('profile');
        const queryStoryUserId = params.get('storyUser');
        const queryStoryId = params.get('story');

        const pendingPostId = window.sessionStorage.getItem('pendingPostId');
        const pendingProfileId = window.sessionStorage.getItem('pendingProfileId');
        const pendingStoryUserId = window.sessionStorage.getItem('pendingStoryUserId');
        const pendingStoryId = window.sessionStorage.getItem('pendingStoryId');

        const targetPostId = queryPostId || pendingPostId;
        const targetProfileId = queryProfileId || pendingProfileId;
        const targetStoryUserId = queryStoryUserId || pendingStoryUserId;
        const targetStoryId = queryStoryId || pendingStoryId;

        if (targetPostId) {
            setPostDetailId(targetPostId);
            if (pendingPostId === targetPostId) {
                window.sessionStorage.removeItem('pendingPostId');
            }
        }

        if (targetProfileId) {
            setProfileDetailId(targetProfileId);
            if (pendingProfileId === targetProfileId) {
                window.sessionStorage.removeItem('pendingProfileId');
            }
        }

        if (targetStoryUserId) {
            if (typeof window.onViewStory === 'function') {
                window.onViewStory(targetStoryUserId, targetStoryId || null);
            } else {
                setStoryDetailDeepLink(targetStoryUserId, targetStoryId || null);
            }

            if (pendingStoryUserId === targetStoryUserId) {
                window.sessionStorage.removeItem('pendingStoryUserId');
            }
            if (targetStoryId && pendingStoryId === targetStoryId) {
                window.sessionStorage.removeItem('pendingStoryId');
            }
        }

        if (!targetPostId && !targetProfileId && !targetStoryUserId) return;

        if (loggeduser.username && (queryPostId || queryProfileId || queryStoryUserId)) {
            navigate(`/${loggeduser.username}`, { replace: true });
        }
    }, [initialized, loading, loggeduser, location.search, navigate, setPostDetailId, setProfileDetailId, setStoryDetailDeepLink]);

    // Show skeleton while auth is being checked
    if (!initialized || loading || !loggeduser) return <MainSkeleton />;

    const bg = 'bg-[var(--surface-2)]';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return <><Stories /><Feed activeMood={null} /></>;
            case 'explore': return <Explore />;
            case 'communities': return <Communities />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <div className="h-full flex flex-col"><Conversations /></div>;
            default: return null;
        }
    };


    // const handleResend = async () => {
    //     setIsResending(true);
    //     const result = await resendVerification();
    //     setIsResending(false);
    //     if (result.success) {
    //         toast.success(result.message);
    //     } else {
    //         toast.error(result.error);
    //     }
    // };

    // const VerificationBanner = () => {
    //     if (!loggeduser || loggeduser.isEmailVerified) return null;
    //     return (
    //         <div className="w-full bg-themeAccent/10 border-b border-themeAccent/20 py-3 px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top-4 duration-500">
    //             <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
    //                 📧 Your email is not verified. Please check your inbox.
    //             </p>
    //             <button
    //                 onClick={handleResend}
    //                 disabled={isResending}
    //                 className="text-xs font-bold bg-themeAccent text-white px-4 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
    //             >
    //                 {isResending ? 'Sending...' : 'Resend Link'}
    //             </button>
    //         </div>
    //     );
    return (
        <section className={`w-full min-h-full ${bg} transition-colors duration-200 pb-20`}>
            {/* <VerificationBanner /> */}
            {/* Desktop */}
            {isDesktop ? (
                <div className="flex justify-center items-start gap-3 w-full max-w-6xl mx-auto p-3">
                    <div className="flex-1 px-0 sm:px-3">
                        <div className="max-w-screen-md mx-auto w-full">
                            <Stories />
                            <div className="max-w-md mx-auto">
                                <Feed activeMood={null} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Mobile */
                <div className="flex flex-col pb-24">
                    <div className={`flex-1 p-2 ${activeView === 'messages' ? 'h-[calc(100dvh-120px)] flex flex-col overflow-hidden' : ''}`}>
                        {renderMobileView()}
                    </div>
                </div>
            )}

        </section >
    );
};

export default Home;
