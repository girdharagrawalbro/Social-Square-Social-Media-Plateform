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

    const [localDismissed, setLocalDismissed] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [optimisticStates, setOptimisticStates] = useState({}); // userId -> 'following' | 'requested' | 'unfollowed' | null
    const [localUsers, setLocalUsers] = useState([]);

    useEffect(() => {
        if (users && users.length > 0) {
            setLocalUsers(prev => {
                if (prev.length === 0) return users;
                const newUsersMap = new Map(users.map(u => [u._id, u]));
                const preserved = prev
                    .filter(p => newUsersMap.has(p._id) || optimisticStates[p._id] !== undefined)
                    .map(p => newUsersMap.has(p._id) ? newUsersMap.get(p._id) : p);
                const preservedIds = new Set(preserved.map(p => p._id));
                const added = users.filter(u => !preservedIds.has(u._id));
                return [...preserved, ...added];
            });
        }
    }, [users, optimisticStates]);

    const handleFollow = (e, targetUserId, isRequested) => {
        e.stopPropagation();
        const isFollowingUser = user?.following?.some(f => f?.toString() === targetUserId?.toString());
        if (isFollowingUser) {
            confirmDialog({
                message: 'Are you sure you want to unfollow this user?',
                header: 'Unfollow User',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Unfollow',
                rejectLabel: 'Cancel',
                acceptClassName: 'p-button-danger',
                accept: () => {
                    setOptimisticStates(prev => ({ ...prev, [targetUserId]: 'unfollowed' }));
                    unfollowMutation.mutate(
                        { targetUserId },
                        {
                            onSettled: () => setOptimisticStates(prev => ({ ...prev, [targetUserId]: null })),
                        }
                    );
                },
            });
        } else if (isRequested) {
            confirmDialog({
                message: 'Do you want to cancel your follow request?',
                header: 'Cancel Request',
                icon: 'pi pi-times-circle',
                acceptLabel: 'Withdraw Request',
                rejectLabel: 'Keep',
                acceptClassName: 'p-button-secondary',
                accept: () => {
                    setOptimisticStates(prev => ({ ...prev, [targetUserId]: 'unfollowed' }));
                    cancelMutation.mutate(
                        { targetUserId },
                        {
                            onSettled: () => setOptimisticStates(prev => ({ ...prev, [targetUserId]: null })),
                        }
                    );
                },
            });
        } else {
            const targetUser = localUsers.find(u => u._id?.toString() === targetUserId?.toString());
            const nextState = targetUser?.isPrivate ? 'requested' : 'following';
            setOptimisticStates(prev => ({ ...prev, [targetUserId]: nextState }));
            followMutation.mutate(
                { targetUserId },
                {
                    onSettled: () => setOptimisticStates(prev => ({ ...prev, [targetUserId]: null })),
                }
            );
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

    const filteredUsers = localUsers.filter(u =>
        u._id !== user?._id &&
        !user?.dismissedUsers?.some(d => d?.toString() === u._id?.toString()) &&
        !localDismissed.includes(u._id)
    ).sort((a, b) => {
        const getWeight = (usr) => {
            const opt = optimisticStates[usr._id];
            const following = opt === 'following' ? true : opt === 'unfollowed' ? false : isFollowing(usr._id);
            const requested = opt === 'requested' ? true : opt === 'unfollowed' ? false : (usr.isRequested || usr.followRequests?.some(r => r?.toString() === user?._id?.toString()));
            if (requested) return 2; // Bottom
            if (following) return 1; // Middle
            return 0; // Top
        };
        return getWeight(a) - getWeight(b);
    });

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="sticky top-0 z-20 px-4 py-2 bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-[var(--border-color)] mb-2">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                    <h2 className="m-0 text-2xl font-black text-[var(--text-main)]">
                        Suggested For You
                    </h2>

                </div>
            </div>

            <div className="flex flex-col gap-2 px-3">
                {filteredUsers.map((u) => {
                    const userIsOnline = isOnline(u._id);
                    const optState = optimisticStates[u._id];
                    const following = optState === 'following' ? true : optState === 'unfollowed' ? false : isFollowing(u._id);
                    const isRequested = optState === 'requested' ? true : optState === 'unfollowed' ? false : (u.isRequested || u.followRequests?.some(r => r?.toString() === user?._id?.toString()));
                    const isMutating = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) ||
                        (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id) ||
                        (cancelMutation.isPending && cancelMutation.variables?.targetUserId === u._id);

                    return (
                        <div
                            key={u._id}
                            className={`flex items-center justify-between gap-3 p-3 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all duration-200 border border-transparent hover:border-[var(--border-color)] ${isDark ? 'bg-[#1a1a1a]/40' : 'bg-white'}`}
                            onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm ring-2 ring-white dark:ring-gray-800">
                                        <img src={u.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} alt={u.fullname} className="w-full h-full object-cover" />
                                    </div>
                                    {userIsOnline && (
                                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="m-0 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{u.fullname}</p>
                                        {u.isVerified && <i className="pi pi-check-circle text-blue-500 text-xs"></i>}
                                    </div>
                                    <p className="m-0 text-xs text-gray-400 dark:text-gray-500 font-medium truncate mt-0.5">
                                        {u.reason || `${u.followersCount || 0} followers`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    disabled={isMutating}
                                    onClick={(e) => handleFollow(e, u._id, isRequested)}
                                    className={`text-xs px-4 py-2 rounded-full border-0 cursor-pointer font-bold transition min-w-[90px] ${following ? 'bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)]' : isRequested ? 'bg-[var(--surface-2)] text-[var(--text-sub)] border border-[var(--border-color)]' : 'bg-[#808bf5] text-white shadow-sm hover:opacity-90'}`}
                                >
                                    {following ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/profile/${u._id}`);
                                    }}
                                    className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center border-0 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    title="View Profile"
                                >
                                    <i className="pi pi-user text-sm"></i>
                                </button>
                                <button
                                    onClick={(e) => handleDismiss(e, u._id)}
                                    className="w-9 h-9 rounded-full bg-transparent text-gray-400 flex items-center justify-center border-0 cursor-pointer hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20 transition-colors"
                                    title="Dismiss Suggestion"
                                >
                                    <i className="pi pi-times text-sm"></i>
                                </button>
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
