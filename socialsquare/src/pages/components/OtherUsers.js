import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useOtherUsers, useFollowUser, useUnfollowUser, useCancelFollowRequest } from '../../hooks/queries/useAuthQueries';
import UserProfile from './UserProfile';

const OtherUsers = () => {
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);

    // ✅ TanStack Query - cached, deduplicated requests
    const { data: users = [], isLoading } = useOtherUsers();
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();
    const cancelMutation = useCancelFollowRequest();

    const [selectedId, setSelectedId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);
    const [localDismissed, setLocalDismissed] = useState([]);

    const handleDismiss = async (e, targetUserId) => {
        e.stopPropagation();
        setLocalDismissed(prev => [...prev, targetUserId]);
        try {
            await api.post('/api/auth/dismiss-user', { targetUserId });
        } catch (err) {
            console.error('Failed to dismiss user:', err);
        }
    };

    const handleFollow = (e, userId, isRequested) => {
        e.stopPropagation();
        const isFollowing = user?.following?.some(f => f?.toString() === userId?.toString());
        if (isFollowing) {
            confirmDialog({
                message: 'Are you sure you want to unfollow this user?',
                header: 'Unfollow User',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: 'Unfollow',
                rejectLabel: 'Cancel',
                acceptClassName: 'p-button-danger',
                accept: () => unfollowMutation.mutate({ targetUserId: userId }),
            });
        } else if (isRequested) {
            confirmDialog({
                message: 'Do you want to cancel your follow request?',
                header: 'Cancel Request',
                icon: 'pi pi-times-circle',
                acceptLabel: 'Withdraw Request',
                rejectLabel: 'Keep',
                acceptClassName: 'p-button-secondary',
                accept: () => cancelMutation.mutate({ targetUserId: userId }),
            });
        } else {
            followMutation.mutate({ targetUserId: userId });
        }
    };

    if (isLoading) return (
        <div className="p-3 bordershadow bg-white rounded mt-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl mb-2 animate-pulse" />)}
        </div>
    );

    return (
        <>
            <div className="flex flex-col flex-1 min-h-0 glass-card rounded-2xl overflow-hidden transition-all duration-300">
                <div className="px-4 py-3  border-b border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md">
                    <h5 className="font-semibold m-0 text-gray-800 dark:text-gray-100">Suggested Users</h5>
                </div>

                <div className="flex flex-col gap-1 p-2 overflow-y-auto flex-1 custom-scrollbar scroll-smooth">
                    {users.filter(u => 
                        u._id !== user?._id && 
                        !user?.following?.some(f => f?.toString() === u._id?.toString()) &&
                        !user?.dismissedUsers?.some(d => d?.toString() === u._id?.toString()) &&
                        !localDismissed.includes(u._id)
                    ).slice(0, 8).map(u => {
                        const userIsOnline = isOnline(u._id);
                        const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                        const isRequested = u.followRequests?.some(r => r?.toString() === user?._id?.toString());
                        const isMutating = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) ||
                            (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id) ||
                            (cancelMutation.isPending && cancelMutation.variables?.targetUserId === u._id);
                        const followersCount = typeof u.followersCount === 'number' ? u.followersCount : (u.followers?.length || 0);
                        return (
                            <div key={u._id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all duration-200"
                                onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}>
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm ring-2 ring-white dark:ring-gray-800">
                                        <img src={u.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} alt={u.fullname} className="w-full h-full object-cover" />
                                    </div>
                                    {userIsOnline && (
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{u.fullname}</p>
                                    <p className="m-0 text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                                        {u.reason || `${followersCount} followers`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={e => handleDismiss(e, u._id)}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 transition-colors border-0 bg-transparent flex items-center justify-center"
                                        title="Dismiss suggestion">
                                        <i className="pi pi-times" style={{ fontSize: '10px' }}></i>
                                    </button>
                                        <button onClick={(e) => handleFollow(e, u._id, isRequested)}
                                            disabled={isMutating}
                                            className={`text-[10px] sm:text-xs px-4 py-1.5 rounded-full border-0 cursor-pointer font-bold transition min-w-[85px] ${isFollowing ? 'bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)]' : isRequested ? 'bg-[var(--surface-2)] text-[var(--text-sub)] border border-[var(--border-color)]' : 'bg-[#808bf5] text-white shadow-sm hover:opacity-90'}`}>
                                            {isMutating ? '...' : (isFollowing ? 'Unfollow' : isRequested ? 'Requested' : 'Follow')}
                                        </button>
                                </div>
                            </div>
                        );
                    })}
                    {users.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500 text-xs text-center py-6 opacity-60">No suggestions right now</p>
                    )}
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setProfileVisible(false)}>
                <UserProfile id={selectedId} onClose={() => setProfileVisible(false)} />
            </Dialog>
        </>
    );
};

export default OtherUsers;
