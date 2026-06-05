import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useDarkMode } from '../context/DarkModeContext';
import useAuthStore, { api } from '../store/zustand/useAuthStore';
import useConversationStore from '../store/zustand/useConversationStore';
import { useInfiniteOtherUsers, useFollowUser, useUnfollowUser, useCancelFollowRequest } from '../hooks/queries/useAuthQueries';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import UserProfile from './components/UserProfile';
import SkeletonUsers from './components/ui/SkeletonUsers';

const UsersPage = () => {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);

    // Infinite Query with limit of 10
    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteOtherUsers(10);

    const { ref: loadMoreRef, inView } = useInView();

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    // Flatten pages into a single users array, using Suggested Users cache fallback if initial fetch is empty
    const queryClient = useQueryClient();
    const users = useMemo(() => {
        const infiniteUsers = data?.pages.flatMap(page => page) || [];
        if (infiniteUsers.length > 0) return infiniteUsers;

        // Fallback to SuggestedUser cache if it exists to prevent double network calls on initial load
        const suggestedCache = queryClient.getQueryData(['users', 'other-users', 8]);
        if (Array.isArray(suggestedCache)) {
            return suggestedCache;
        }
        return [];
    }, [data, queryClient]);

    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();
    const cancelMutation = useCancelFollowRequest();

    // Local state for UI responsiveness
    const [localDismissed, setLocalDismissed] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);

    const handleFollow = (e, targetUserId, isRequested) => {
        e.stopPropagation();
        const isFollowing = user?.following?.some(f => f?.toString() === targetUserId?.toString());
        if (isFollowing) {
            confirmDialog({
                message: 'Are you sure you want to unfollow this user?',
                header: 'Unfollow User',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Unfollow',
                rejectLabel: 'Cancel',
                acceptClassName: 'p-button-danger',
                accept: () => unfollowMutation.mutate({ targetUserId }),
            });
        } else if (isRequested) {
            confirmDialog({
                message: 'Do you want to cancel your follow request?',
                header: 'Cancel Request',
                icon: 'pi pi-times-circle',
                acceptLabel: 'Withdraw Request',
                rejectLabel: 'Keep',
                acceptClassName: 'p-button-secondary',
                accept: () => cancelMutation.mutate({ targetUserId }),
            });
        } else {
            followMutation.mutate({ targetUserId });
        }
    };

    const handleDismiss = async (e, targetUserId) => {
        e.stopPropagation();
        setLocalDismissed(prev => [...prev, targetUserId]);
        try {
            await api.post('/api/auth/dismiss-user', { targetUserId });
        } catch (err) {
            console.error('Failed to dismiss user:', err);
        }
    };

    const isFollowing = (userId) => {
        return user?.following?.some(f => f?.toString() === userId?.toString());
    };

    if (isLoading && !users.length) {
        return (
            <div className={`p-4 md:p-8 min-h-screen ${isDark ? 'bg-[#0d0d0d]' : 'bg-gray-50'}`}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col gap-4 mb-8">
                        <div className="skeleton w-48 h-8 rounded mb-2"></div>
                        <div className="skeleton w-64 h-4 rounded"></div>
                    </div>
                    <SkeletonUsers />
                </div>
            </div>
        );
    }

    const filteredUsers = users.filter(u =>
        u._id !== user?._id &&
        !user?.dismissedUsers?.some(d => d?.toString() === u._id?.toString()) &&
        !localDismissed.includes(u._id)
    );

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="sticky top-0 z-20 px-4 py-2 bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-[var(--border-color)] mb-2">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <h2 className="m-0 text-2xl font-black text-[var(--text-main)]">
                        Suggested For You
                    </h2>

                </div>
            </div>

            <div className="grid px-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {filteredUsers.map((u) => {
                    const userIsOnline = isOnline(u._id);
                    const following = isFollowing(u._id);
                    const isRequested = u.followRequests?.some(r => r?.toString() === user?._id?.toString());
                    const isMutating = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) ||
                        (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id) ||
                        (cancelMutation.isPending && cancelMutation.variables?.targetUserId === u._id);

                    return (
                        <div
                            key={u._id}
                            className={`group relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${isDark ? 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#222]' : 'bg-white border-gray-100 hover:shadow-2xl'
                                }`}
                            onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}
                        >
                            {/* Dismiss button */}
                            <button
                                onClick={(e) => handleDismiss(e, u._id)}
                                className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 text-gray-400 border-0 bg-transparent flex items-center justify-center cursor-pointer"
                            >
                                <i className="pi pi-times text-[10px] sm:text-xs"></i>
                            </button>

                            <div className="flex flex-col items-center w-full">
                                <div className="relative w-16 h-16 sm:w-24 sm:h-24 mb-3 sm:mb-4">
                                    <img
                                        src={u.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                        alt={u.fullname}
                                        className="w-full h-full rounded-full object-cover border-4 border-[#808bf5]/10 group-hover:border-[#808bf5]/30 transition-all"
                                    />
                                    {userIsOnline && (
                                        <div className="absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 border-2 sm:border-4 border-white dark:border-[#1a1a1a] rounded-full shadow-lg"></div>
                                    )}
                                </div>

                                <div className="text-center w-full mb-2">
                                    <h3 className="font-bold text-sm sm:text-lg m-0 truncate px-1 sm:px-2">{u.fullname}</h3>
                                    <p className={`text-[10px] sm:text-xs mt-1 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {u.reason || 'Recommended'}
                                    </p>
                                </div>

                                {/* 📝 BIO BOX: Clamped exactly to 2 lines to maintain same card heights */}
                                <div
                                    className={`w-full px-1 sm:px-2 mb-3 text-[11px] sm:text-sm text-center leading-normal sm:leading-relaxed overflow-hidden text-ellipsis ${isDark ? 'text-gray-400' : 'text-gray-500'
                                        }`}
                                    style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        height: '34px', // Fixed height prevents uneven box heights
                                    }}
                                >
                                    {u.bio || "No bio added yet."}
                                </div>

                                <div className="flex gap-4 mb-4">
                                    <div className="text-center">
                                        <p className="font-bold text-xs sm:text-sm m-0">{u.followersCount || 0}</p>
                                        <p className="text-[8px] sm:text-[10px] uppercase tracking-wider opacity-50 font-bold m-0">Followers</p>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 sm:gap-2 w-full mt-auto">
                                    <button
                                        disabled={isMutating}
                                        onClick={(e) => handleFollow(e, u._id, isRequested)}
                                        className={`flex-1 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold transition-all border-0 cursor-pointer ${following
                                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                            : isRequested
                                                ? 'bg-gray-200 text-gray-500 cursor-default'
                                                : 'bg-[#808bf5] text-white hover:shadow-[0_8px_20px_-6px_rgba(128,139,245,0.6)]'
                                            } ${isMutating ? 'opacity-50' : ''}`}
                                    >
                                        {isMutating ? '...' : (following ? 'Following' : isRequested ? 'Requested' : 'Follow')}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/profile/${u._id}`);
                                        }}
                                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-500 flex items-center justify-center border-0 cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <i className="pi pi-user text-xs sm:text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Loading indicator for infinite scroll */}
            <div ref={loadMoreRef} className="py-12 flex justify-center w-full">
                {isFetchingNextPage && (
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#808bf5]"></div>
                )}
                {!hasNextPage && filteredUsers.length > 0 && (
                    <p className="text-gray-500 text-sm italic">You've explored all suggestions!</p>
                )}
            </div>

            {filteredUsers.length === 0 && (
                <div className="text-center py-24 glass-card rounded-3xl">
                    <div className="w-20 h-20 bg-[#808bf5]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="pi pi-users text-3xl text-[#808bf5]"></i>
                    </div>
                    <h2 className="text-xl font-bold mb-2">No new suggestions</h2>
                    <p className="text-gray-500">You've seen everyone! Check back later for more.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-6 px-6 py-2 rounded-xl bg-[#808bf5] text-white font-bold border-0 cursor-pointer"
                    >
                        Return Home
                    </button>
                </div>
            )}

            <Dialog
                showHeader={false}
                visible={profileVisible}
                style={{ width: '95vw', maxWidth: '500px', height: '90vh' }}
                position="center"
                onHide={() => setProfileVisible(false)}
                dismissableMask={true}
                modal={true}
                maskStyle={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)' }}
            >
                <div className="relative h-full overflow-hidden bg-[var(--surface-1)]" style={{ borderRadius: '24px' }}>
                    <button
                        onClick={() => setProfileVisible(false)}
                        className="absolute top-4 left-4 z-50 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center border-0 cursor-pointer"
                    >
                        <i className="pi pi-times"></i>
                    </button>
                    {selectedId && <UserProfile id={selectedId} onClose={() => setProfileVisible(false)} />}
                </div>
            </Dialog>
        </div>
    );
};

export default UsersPage;
