import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStoryFeed } from '../hooks/queries/useAuthQueries';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import { StoryViewer, ShareStoryDialog } from './components/Stories';
import { Dialog } from 'primereact/dialog';
import { getMediaThumbnail } from '../utils/mediaUtils';

const PostDetail = React.lazy(() => import('./components/PostDetail'));

const StoriesPage = () => {
    const { username, storyId: initialStoryParam } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const { markGroupAsViewed } = usePostStore();
    const { data: storyFeed, isLoading } = useStoryFeed(user?._id);
    const [groups, setGroups] = useState(storyFeed || []);
    const [postVisible, setPostVisible] = useState(false);
    const [selectedPostId, setSelectedPostId] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);
    const [sharingStory, setSharingStory] = useState(null);

    const onIndexChange = React.useCallback((newIndex) => {
        // Now handled internally by StoryViewer to include storyId sync
    }, []);

    useEffect(() => {
        if (storyFeed) {
            setGroups(storyFeed);
        }
    }, [storyFeed]);

    const currentGroupIndex = React.useMemo(() => {
        if (!username || !groups.length) return 0;
        const normalizedUsername = username.toLowerCase();
        return groups.findIndex(g => 
            g.user.username?.toLowerCase() === normalizedUsername || 
            g.user._id.toString() === username
        );
    }, [groups, username]);

    if (isLoading) return <div className="h-screen w-full bg-black flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin"></div></div>;
    if (!groups || groups.length === 0) {
        return (
            <div className="h-screen w-full bg-[#030303] flex flex-col items-center justify-center text-white p-4">
                <i className="pi pi-images text-5xl mb-4 opacity-20"></i>
                <p className="text-xl font-medium opacity-60">No stories available</p>
                <button onClick={() => navigate(-1)} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/10">Go Back</button>
            </div>
        );
    }


    const safeIndex = currentGroupIndex === -1 ? 0 : currentGroupIndex;
    const prevGroup = safeIndex > 0 ? groups[safeIndex - 1] : null;
    const nextGroup = safeIndex < groups.length - 1 ? groups[safeIndex + 1] : null;

    const handleClose = () => {
        navigate(`/${user?.username || ''}`, { replace: true });
    };

    const navigateToGroup = (index) => {
        if (groups[index]) {
            const target = groups[index].user.username || groups[index].user._id;
            navigate(`/stories/${target}`);
            markGroupAsViewed(groups[index].user._id);
        }
    };

    const handleStoryDeleted = (userId, storyId) => {
        setGroups(prev =>
            prev.map(g => g.user._id.toString() === userId
                ? { ...g, stories: g.stories.filter(s => s._id !== storyId) }
                : g
            ).filter(g => g.stories.length > 0)
        );
    };

    const handleStoryLiked = (storyId, likes) => {
        setGroups(prev => prev.map(g => ({
            ...g,
            stories: g.stories.map(s => s._id === storyId ? { ...s, likes } : s)
        })));
    };


    return (
        <div className="fixed inset-0 z-[2000] bg-[#030303] flex items-center justify-center overflow-hidden">
            {/* Background Blur Overlay */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
                backgroundImage: groups[safeIndex]?.stories[0]?.media?.url ? `url(${groups[safeIndex].stories[0].media.url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(100px)'
            }}></div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className="absolute top-2 right-2 md:top-6 md:right-6 z-[2010] bg-white/10 hover:bg-white/20 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md group cursor-pointer"
            >
                <i className="pi pi-times group-hover:scale-110 transition-transform"></i>
            </button>



            <div className="relative flex items-center justify-center w-full h-full max-w-[1400px] mx-auto px-4 gap-8">

                {/* Previous Group Preview */}
                {prevGroup && (
                    <div
                        onClick={() => navigateToGroup(safeIndex - 1)}
                        className="hidden lg:flex flex-col items-center gap-4 cursor-pointer transition-all hover:scale-110 group opacity-40 hover:opacity-100 relative"
                    >
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/40 text-white w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="pi pi-chevron-left text-xl"></i>
                        </div>
                        <div className="w-[180px] h-[320px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all z-10"></div>
                            <img
                                src={prevGroup.stories[0]?.media?.type === 'video'
                                    ? getMediaThumbnail(prevGroup.stories[0]?.media?.url, 'video', { width: 180, height: 320 })
                                    : prevGroup.stories[0]?.media?.url}
                                alt=""
                                className="w-full h-full object-cover blur-[2px]"
                            />
                            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center z-20">
                                <div className="w-12 h-12 rounded-full border-2 border-white/80 p-0.5 mb-2 overflow-hidden shadow-lg">
                                    <img src={prevGroup.user.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} className="w-full h-full object-cover rounded-full" alt="" />
                                </div>
                                <span className="text-white text-xs font-semibold drop-shadow-md">{prevGroup.user.username || prevGroup.user.fullname}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVE STORY VIEWER */}
                <div className="relative w-full max-w-[420px] aspect-[9/16] h-[90vh] max-h-[820px] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]  animate-in zoom-in-95 duration-300">
                    <StoryViewer
                        groups={groups}
                        startGroupIndex={safeIndex}
                        onClose={handleClose}
                        loggeduser={user}
                        initialStoryId={initialStoryParam}
                        onStoryDeleted={handleStoryDeleted}
                        onStoryLiked={handleStoryLiked}
                        onOpenPostDetail={(id) => {
                            setSelectedPostId(id);
                            setPostVisible(true);
                        }}
                        onShareStory={(s) => {
                            setSharingStory(s);
                            setShareOpen(true);
                        }}
                        onIndexChange={onIndexChange}
                    />
                </div>

                {/* Next Group Preview */}
                {nextGroup && (
                    <div
                        onClick={() => navigateToGroup(safeIndex + 1)}
                        className="hidden lg:flex flex-col items-center gap-4 cursor-pointer transition-all hover:scale-110 group opacity-40 hover:opacity-100 relative"
                    >
                        <div className="absolute -right-12 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/40 text-white w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="pi pi-chevron-right text-xl"></i>
                        </div>
                        <div className="w-[180px] h-[320px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all z-10"></div>
                            <img
                                src={nextGroup.stories[0]?.media?.type === 'video'
                                    ? getMediaThumbnail(nextGroup.stories[0]?.media?.url, 'video', { width: 180, height: 320 })
                                    : nextGroup.stories[0]?.media?.url}
                                alt=""
                                className="w-full h-full object-cover blur-[2px]"
                            />
                            <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center z-20">
                                <div className="w-12 h-12 rounded-full border-2 border-white/80 p-0.5 mb-2 overflow-hidden shadow-lg">
                                    <img src={nextGroup.user.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} className="w-full h-full object-cover rounded-full" alt="" />
                                </div>
                                <span className="text-white text-xs font-semibold drop-shadow-md">{nextGroup.user.username || nextGroup.user.fullname}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Post Detail Dialog (for story stickers) */}
            <Dialog
                showHeader={false}
                visible={postVisible}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                onHide={() => setPostVisible(false)}
                dismissableMask
                blockScroll={true}
                closable={false}
                modal
                maskStyle={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)', zIndex: 20006 }}
                baseZIndex={20005}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full shadow-2xl" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setPostVisible(false)}
                        className="absolute top-4 left-4 z-[20007] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                    >
                        <i className="pi pi-times text-sm"></i>
                    </button>
                    <React.Suspense fallback={<div className="p-20 text-center text-[var(--text-sub)]">Loading Post...</div>}>
                        <PostDetail postId={selectedPostId} onHide={() => setPostVisible(false)} />
                    </React.Suspense>
                </div>
            </Dialog>

            <ShareStoryDialog
                visible={shareOpen}
                onHide={() => setShareOpen(false)}
                story={sharingStory}
                loggeduser={user}
            />

            <style>{`
                .zoom-in-95 { --tw-enter-scale: .95; }
                .animate-in {
                    animation-duration: 300ms;
                    animation-fill-mode: both;
                    animation-name: enter;
                }
                @keyframes enter {
                    from { opacity: 0; transform: scale(var(--tw-enter-scale, 1)); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default StoriesPage;
