import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { debounce } from 'lodash';
import { useInView } from 'react-intersection-observer';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import toast from 'react-hot-toast';
import { useExploreReels } from '../../hooks/queries/useExploreQueries';
import { Skeleton } from 'primereact/skeleton';
import { getMediaThumbnail } from '../../utils/mediaUtils';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useNavigate } from 'react-router-dom';
import {
  useLikePost, useSavePost
} from '../../hooks/queries/usePostQueries';
import Comment from './ui/Comment';
import SharePostDialog from './ui/SharePostDialog';
import PostMenu from './ui/PostMenu';
import { useMuteUser, useBlockUser } from '../../hooks/queries/useAuthQueries';
import usePostStore from '../../store/zustand/usePostStore';
import SkeletonExplore from './ui/SkeletonExplore';

const VideoCard = React.memo(({ vid, onClick, isPlaying, onVisible }) => {
  const videoRef = useRef(null);
  const { ref, inView } = useInView({
    threshold: 0.2, // Trigger earlier to start loading
    rootMargin: '100px 0px'
  });

  useEffect(() => {
    if (inView) {
      onVisible(vid._id);
    }
  }, [inView, vid._id, onVisible]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => onVisible(vid._id)}
      className="relative rounded-2xl overflow-hidden bg-[#121212] cursor-pointer group transition-transform active:scale-95 shadow-lg"
      style={{ aspectRatio: '9/16' }}
      onClick={onClick}
    >
      {isPlaying ? (
        <video
          ref={videoRef}
          src={vid.video}
          poster={vid.videoThumbnail || getMediaThumbnail(vid.video, 'video')}
          muted
          loop
          playsInline
          preload="auto"
          className={`w-full h-full object-cover transition-all duration-1000 grayscale-0 scale-105 opacity-100`}
        />
      ) : (
        <img
          src={vid.videoThumbnail || getMediaThumbnail(vid.video, 'video', { width: 400, height: 711 })}
          alt=""
          className="w-full h-full object-cover grayscale opacity-60 scale-100 transition-all duration-500"
        />
      )}

      {/* Dynamic Overlay Info */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute bottom-4 left-4 right-4 transform translate-y-0 transition-transform duration-500">
          <span className="text-[10px] uppercase font-bold text-[#808bf5] tracking-widest">{vid.user?.fullname}</span>
          <p className="m-0 text-white font-bold text-sm truncate mt-1">{vid.caption}</p>
        </div>
      </div>

      {/* Play Indicator for Inactive */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <i className="pi pi-play text-white text-xl ml-1"></i>
          </div>
        </div>
      )}

      {/* Status Dot */}
      <div className="absolute top-4 right-4">
        <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`}></div>
      </div>
    </div>
  );
});

const Explore = () => {
  const loggeduser = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized && !loading && !loggeduser) {
      toast.error('Log in to explore reels', { icon: '🔒' });
      navigate('/login');
    }
  }, [initialized, loading, loggeduser, navigate]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching
  } = useExploreReels();

  // Flatten the pages into a single array of videos and deduplicate by _id
  const videos = useMemo(() => {
    const allPosts = data?.pages.flatMap(page => page.posts) || [];
    const seenIds = new Set();
    const seenUrls = new Set();

    return allPosts.filter(p => {
      if (!p || !p._id) return false;
      const id = p._id.toString();
      const videoUrl = p.video;

      if (seenIds.has(id)) return false;
      if (videoUrl && seenUrls.has(videoUrl)) return false;

      seenIds.add(id);
      if (videoUrl) seenUrls.add(videoUrl);
      return true;
    });
  }, [data?.pages]);



  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [heartVisible, setHeartVisible] = useState(false);
  const [expandedCaptions, setExpandedCaptions] = useState(new Set());
  const lastTap = useRef(0);

  const toggleCaption = (postId) => {
    setExpandedCaptions(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  // Social Interaction Hooks
  const likeMut = useLikePost();
  const saveMut = useSavePost();
  // const reactMut = useReactPost();
  const muteMut = useMuteUser();
  const blockMut = useBlockUser();
  const savedPostIds = usePostStore(s => s.savedPostIds);
  const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);
  const [isCommentVisible, setCommentVisible] = useState(false);
  const [isShareVisible, setShareVisible] = useState(false);

  const activePost = useMemo(() => videos[activeIndex], [videos, activeIndex]);
  const optimisticLikes = usePostStore(s => s.optimisticLikes);

  const { isLikedByMe, likesCount } = useMemo(() => {
    if (!activePost) return { isLikedByMe: false, likesCount: 0 };
    const opt = optimisticLikes[activePost._id];
    const loggedUserId = loggeduser?._id?.toString();

    if (opt) {
      const optList = Array.from(opt);
      return {
        isLikedByMe: optList.some(id => id?.toString() === loggedUserId),
        likesCount: opt.size
      };
    }
    return {
      isLikedByMe: (activePost.likes || []).some(id => (id._id || id)?.toString() === loggedUserId),
      likesCount: activePost.likes?.length || 0
    };
  }, [activePost, loggeduser?._id, optimisticLikes]);

  const isSavedByMe = useMemo(() => activePost && savedPostIds.has(activePost._id), [activePost, savedPostIds]);

  // Infinite Scroll Trigger
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0.1,
    rootMargin: '200px'
  });

  useEffect(() => {
    if (loadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (videos.length > 0 && !currentlyPlayingId) {
      setCurrentlyPlayingId(videos[0]._id);
    }
  }, [videos, currentlyPlayingId]);

  const handleVisible = useCallback((id) => {
    setCurrentlyPlayingId(id);
  }, []);

  const addFloatingReaction = (emoji = '❤️') => {
    const id = Date.now();
    const x = Math.random() * 60 + 20; // 20-80% width
    setFloatingReactions(prev => [...prev, { id, x, emoji }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 1200);
  };

  const handleLike = () => {
    if (!activePost) return;
    if (navigator.vibrate) navigator.vibrate([10, 30]);
    addFloatingReaction();
    setHeartVisible(true);

    if (!isLikedByMe) {
      likeMut.mutate({ postId: activePost._id, isLiked: false, likes: activePost.likes });
    }

    setTimeout(() => setHeartVisible(false), 800);
  };

  const debouncedLikeToggle = useMemo(
    () => debounce((postId, isLiked, likes) => {
      likeMut.mutate({ postId, isLiked, likes });
    }, 400),
    [likeMut]
  );

  const handleToggleLike = (e) => {
    e?.stopPropagation();
    if (!activePost) return;

    // UI feedback immediately
    if (!isLikedByMe) {
      addFloatingReaction();
      if (navigator.vibrate) navigator.vibrate(10);
    }

    // Call debounced mutation
    debouncedLikeToggle(activePost._id, isLikedByMe, activePost.likes);
  };

  const handleToggleSave = (e) => {
    e?.stopPropagation();
    if (!activePost) return;
    saveMut.mutate({ postId: activePost._id });
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleDoubleClick = () => {
    handleLike();
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) handleDoubleClick();
    lastTap.current = now;
  };

  if (!initialized || loading || !loggeduser) {
    return (
      <div className="max-w-4xl mx-auto p-2">
        <SkeletonExplore />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 px-4 py-2 bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-[var(--border-color)] mb-2">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="m-0 text-2xl font-black text-[var(--text-main)]">
            Explore
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="w-10 h-10 bg-[var(--surface-2)] rounded-full text-[var(--text-sub)] border-0 cursor-pointer hover:bg-[var(--surface-3)] transition-all flex items-center justify-center disabled:opacity-50"
          >
            <i className={`pi pi-refresh ${isRefetching ? 'pi-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      <div className="px-2 sm:px-4 pb-12 text-center">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto gap-2 sm:gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} shape="rectangle" className="rounded-2xl w-full" style={{ aspectRatio: '9/16' }} />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="py-20 flex flex-col items-center">
            <i className="pi pi-video text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 font-medium">No reels found yet. Check back soon!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto gap-2 sm:gap-4">
              {videos.map((vid, idx) => (
                <VideoCard
                  key={vid._id}
                  vid={vid}
                  isPlaying={currentlyPlayingId === vid._id}
                  onVisible={handleVisible}
                  onClick={() => { setActiveIndex(idx); setVisible(true); }}
                />
              ))}
            </div>

            {/* Infinite Scroll Trigger & Loader */}
            <div ref={loadMoreRef} className="py-10 flex justify-center w-full">
              {isFetchingNextPage ? (
                <div className="inline-block w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin"></div>
              ) : hasNextPage ? (
                <p className="text-[var(--text-sub)] text-sm font-medium opacity-50">Scrolling for more magic...</p>
              ) : (
                <p className="text-[var(--text-sub)] text-sm font-medium opacity-50">You've reached the end of the magic ✨</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* REEL STYLE MODAL */}
      <Dialog
        visible={visible}
        onHide={() => setVisible(false)}
        style={{ width: '100vw', maxWidth: '500px', height: '100vh', margin: 0, padding: 0 }}
        modal
        showHeader={false}
        className="explore-reels-dialog"
      >
        <div className="w-full h-full bg-black relative flex flex-col items-center justify-center overflow-hidden">
          {/* Close button */}
          <button
            onClick={() => setVisible(false)}
            className="absolute top-6 left-6 z-50 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center backdrop-blur-md"
          >
            <i className="pi pi-arrow-left"></i>
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(!muted)}
            className="absolute top-6 right-6 z-50 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full border-0 cursor-pointer flex items-center justify-center backdrop-blur-md"
          >
            <i className={`pi ${muted ? 'pi-volume-off' : 'pi-volume-up'}`}></i>
          </button>

          {/* Reels Container */}
          <div className="w-full h-full flex items-center justify-center relative">
            <video
              src={videos[activeIndex]?.video}
              autoPlay
              loop
              playsInline
              muted={muted}
              onDoubleClick={handleDoubleClick}
              onTouchEnd={handleTap}
              className="h-full w-auto max-w-full object-contain cursor-pointer"
            />

            {/* Floating Reactions Layer */}
            {floatingReactions.map(r => (
              <span
                key={r.id}
                className="floating-reaction"
                style={{ left: `${r.x}%`, bottom: '20%' }}
              >
                {r.emoji}
              </span>
            ))}

            {/* Overlay Actions */}
            <div className="absolute bottom-10 right-4 flex flex-col gap-6 items-center text-white z-40">
              {/* Like */}
              <div className="flex flex-col items-center gap-1">
                <button
                  className="bg-transparent border-0 text-white text-3xl p-0 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                  onClick={handleToggleLike}
                >
                  <i className={`pi ${isLikedByMe ? 'pi-heart-fill text-red-500' : 'pi-heart text-white'}`}></i>
                </button>
                <span className="text-[10px] font-bold">{likesCount}</span>
              </div>

              {/* Comment */}
              <div className="flex flex-col items-center gap-1">
                <button
                  className="bg-transparent border-0 text-white text-3xl p-0 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                  onClick={(e) => { e.stopPropagation(); setCommentVisible(true); }}
                >
                  <i className="pi pi-comment"></i>
                </button>
                <span className="text-[10px] font-bold">Comments</span>
              </div>

              {/* Save */}
              <div className="flex flex-col items-center gap-1">
                <button
                  className="bg-transparent border-0 text-white text-3xl p-0 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                  onClick={handleToggleSave}
                >
                  <i className={`pi ${isSavedByMe ? 'pi-bookmark-fill text-[#808bf5]' : 'pi-bookmark text-white'}`}></i>
                </button>
                <span className="text-[10px] font-bold">{isSavedByMe ? 'Saved' : 'Save'}</span>
              </div>

              {/* Share */}
              <div className="flex flex-col items-center gap-1">
                <button
                  className="bg-transparent border-0 text-white text-3xl p-0 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                  onClick={(e) => { e.stopPropagation(); setShareVisible(true); }}
                >
                  <i className="pi pi-share-alt"></i>
                </button>
                <span className="text-[10px] font-bold">Share</span>
              </div>

              {/* More Menu */}
              <div className="flex flex-col items-center gap-1">
                <PostMenu
                  post={activePost}
                  user={loggeduser}
                  isSaved={isSavedByMe}
                  onMute={() => {
                    const targetUser = activePost.user;
                    confirmDialog({
                      message: `Are you sure you want to mute ${targetUser.fullname}? Their posts will be hidden from your feed.`,
                      header: 'Mute User',
                      icon: 'pi pi-volume-off',
                      acceptLabel: 'Mute',
                      acceptClassName: 'p-button-warning border-0 rounded-xl',
                      rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                      accept: () => muteMut.mutate({ targetUserId: targetUser._id }),
                    });
                  }}
                  onBlock={() => {
                    const targetUser = activePost.user;
                    confirmDialog({
                      message: `Are you sure you want to block ${targetUser.fullname}? They won't be able to see your profile or posts, and you won't see theirs.`,
                      header: 'Block Confirmation',
                      icon: 'pi pi-ban',
                      acceptLabel: 'Block',
                      acceptClassName: 'p-button-danger border-0 rounded-xl',
                      rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                      accept: () => blockMut.mutate({ targetUserId: targetUser._id }),
                    });
                  }}
                  buttonClassName="bg-transparent border-0 text-white text-3xl p-0 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                  iconClassName="pi pi-ellipsis-v"
                />
                <span className="text-[10px] font-bold">More</span>
              </div>
            </div>

            {/* Bottom Details */}
            <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 z-40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 p-0.5">
                  <img src={videos[activeIndex]?.user?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} className="w-full h-full rounded-full object-cover border-2 border-black" alt="" />
                </div>
                <div>
                  <p className="m-0 text-white font-bold text-sm">@{videos[activeIndex]?.user?.username || videos[activeIndex]?.user?.fullname?.toLowerCase().replace(/\s/g, '_') || 'user'}</p>
                </div>
              </div>
              <div className="m-0 text-white text-sm mt-2 font-medium">
                {(() => {
                  const caption = videos[activeIndex]?.caption || '';
                  const postId = videos[activeIndex]?._id;
                  const isExpanded = expandedCaptions.has(postId);
                  const limit = 80;
                  const needsTruncation = caption.length > limit;
                  const displayCaption = (!isExpanded && needsTruncation) ? caption.substring(0, limit) + '...' : caption;

                  return (
                    <>
                      {displayCaption.split(/(\s+)/).map((token, i) => {
                        if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token))
                          return <span key={i} className="text-[#808bf5] font-medium">{token}</span>;
                        return <span key={i}>{token}</span>;
                      })}
                      {needsTruncation && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCaption(postId); }}
                          className="ml-1 border-0 bg-transparent p-0 text-gray-300 font-bold text-xs cursor-pointer hover:text-white transition-colors underline"
                        >
                          {isExpanded ? ' show less' : ' more'}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Navigation Buttons for PC */}
            <button
              onClick={() => setActiveIndex(prev => (prev > 0 ? prev - 1 : videos.length - 1))}
              className="hidden md:flex absolute top-45 left-10 -translate-y-1/2 bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full border-0 cursor-pointer items-center justify-center text-white text-xl backdrop-blur-lg z-50 transition"
            >
              <i className="pi pi-chevron-left"></i>
            </button>
            <button
              onClick={() => setActiveIndex(prev => (prev < videos.length - 1 ? prev + 1 : 0))}
              className="hidden md:flex absolute top-45 right-10 -translate-y-1/2 bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full border-0 cursor-pointer items-center justify-center text-white text-xl backdrop-blur-lg z-50 transition"
            >
              <i className="pi pi-chevron-right"></i>
            </button>

            {/* Heart Burst Animation */}
            {heartVisible && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none animate-heartBurst opacity-0">
                <i className="pi pi-heart-fill text-9xl text-red-500" style={{ filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.6))' }}></i>
              </div>
            )}
          </div>
        </div>

        <style>{`
            .explore-reels-dialog .p-dialog-content {
                padding: 0 !important;
                background: #000;
                overflow: hidden;
            }
            .comment-dialog-bottom {
                border-top-left-radius: 24px !important;
                border-top-right-radius: 24px !important;
                overflow: hidden;
                box-shadow: 0 -10px 40px rgba(0,0,0,0.2) !important;
            }
            .comment-dialog-bottom .p-dialog-header {
                padding: 1rem !important;
                border-bottom: 1px solid var(--border-color) !important;
                background: var(--surface-1) !important;
            }
            .comment-dialog-bottom .p-dialog-content {
                background: var(--surface-1) !important;
            }
            .comment-dialog-center {
                border-radius: 24px !important;
                overflow: hidden;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4) !important;
                border: 1px solid var(--border-color) !important;
            }
            .comment-dialog-center .p-dialog-header {
                background: var(--surface-1) !important;
                border-bottom: 1px solid var(--border-color) !important;
            }
            .comment-dialog-center .p-dialog-content {
                background: var(--surface-1) !important;
            }
            @keyframes reelHeartBurst {
                0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
                50% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
            }
            .animate-heartBurst {
                animation: reelHeartBurst 0.8s cubic-bezier(0.17, 0.89, 0.32, 1.49) forwards;
            }
        `}</style>
      </Dialog>

      {/* Social Dialogs */}
      {activePost && (
        <>
          <Dialog
            header="Comments"
            visible={isCommentVisible}
            onHide={() => setCommentVisible(false)}
            position={window.innerWidth < 768 ? "bottom" : "center"}
            style={{ width: '100vw', maxWidth: '500px', margin: '0' }}
            contentStyle={{ height: window.innerWidth < 768 ? '60vh' : '80vh', padding: '0' }}
            draggable={false}
            resizable={false}
            showHeader={true}
            className={window.innerWidth < 768 ? "comment-dialog-bottom" : "comment-dialog-center"}
          >
            <Comment
              postId={activePost._id}
              setVisible={setCommentVisible}
              onProfileClick={(userId) => {
                setCommentVisible(false);
                setVisible(false);
                navigate(`/profile/${userId}`);
              }}
            />
          </Dialog>
          <SharePostDialog
            visible={isShareVisible}
            onHide={() => setShareVisible(false)}
            post={activePost}
            user={loggeduser}
            onShareToStory={(post) => setSharingPostToStory(post)}
          />
        </>
      )}
    </div>
  );
};

export default Explore;
