import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Stories from './components/Stories';
import Explore from './components/Explore';
import Communities from './components/Communities';
import MoodFeedToggle from './components/MoodFeedToggle';
import useAuthStore from '../store/zustand/useAuthStore';
import useWindowWidth from '../hooks/useWindowWidth';
import usePostStore from '../store/zustand/usePostStore';

const Home = () => {
    const activeView = 'feed';
    const [activeMood, setActiveMood] = useState(null);
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

    if (!initialized || loading || !loggeduser) return <MainSkeleton />;

    const bg = 'bg-[var(--surface-2)]';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return (
                <>
                    <Stories />
                    <div className="px-2">
                        <MoodFeedToggle
                            activeMood={activeMood}
                            onMoodSelect={setActiveMood}
                            onClear={() => setActiveMood(null)}
                        />
                    </div>
                    <Feed activeMood={activeMood} />
                </>
            );
            case 'explore': return <Explore />;
            case 'communities': return <Communities />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <div className="h-full flex flex-col"><Conversations /></div>;
            default: return null;
        }
    };

    return (
        <section className={`w-full min-h-full ${bg} transition-colors duration-200 pb-20`}>
            {isDesktop ? (
                <div className="flex justify-center items-start gap-3 w-full max-w-6xl mx-auto p-3">
                    <div className="flex-1 px-0 sm:px-3">
                        <div className="max-w-screen-md mx-auto w-full">
                            <Stories />
                            <div className="max-w-md mx-auto">
                                <MoodFeedToggle
                                    activeMood={activeMood}
                                    onMoodSelect={setActiveMood}
                                    onClear={() => setActiveMood(null)}
                                />
                                <Feed activeMood={activeMood} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
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
