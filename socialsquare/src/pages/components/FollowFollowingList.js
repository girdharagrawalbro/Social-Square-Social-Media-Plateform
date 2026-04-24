import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useUserDetails, useFollowUser, useUnfollowUser, useRemoveFollower, useCancelFollowRequest } from '../../hooks/queries/useAuthQueries';
import { confirmDialog } from 'primereact/confirmdialog';
import UserProfile from './UserProfile';

const FollowFollowingList = ({ ids = [], isfollowing }) => {
    const user = useAuthStore(s => s.user);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);

    // ✅ TanStack Query for fetching user details
    const [searchQuery, setSearchQuery] = useState('');
    const { data: users = [], isLoading } = useUserDetails(ids);

    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();
    const removeFollowerMutation = useRemoveFollower();
    const cancelMutation = useCancelFollowRequest();

    const filteredUsers = users.filter(u =>
        u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ... handleFollow, handleRemoveFollower, openUserProfile ...
    const handleFollow = (targetUserId, isRequested) => {
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

    const handleRemoveFollower = (followerId) => {
        confirmDialog({
            message: 'Are you sure you want to remove this person from your followers?',
            header: 'Remove Follower',
            icon: 'pi pi-user-minus',
            acceptClassName: 'p-button-danger',
            accept: () => {
                removeFollowerMutation.mutate({ followerId });
            }
        });
    };

    const openUserProfile = (targetUserId) => {
        setSelectedUserId(targetUserId);
        setProfileVisible(true);
    };

    if (isLoading) return (
        <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
    );

    return (
        <>
            <div className="p-2 sticky top-0 bg-[var(--surface-1)] z-10 border-b border-[var(--border-color)] mb-2">
                <div className="relative">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)] text-xs"></i>
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[var(--surface-2)] border-0 rounded-xl text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[#808bf5]/30 outline-none transition-all placeholder:text-[var(--text-sub)]"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent text-[var(--text-sub)] hover:text-[var(--text-main)] cursor-pointer p-0"
                        >
                            <i className="pi pi-times-circle text-xs"></i>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-1 p-2">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 opacity-40">
                        <i className="pi pi-users text-2xl text-[var(--text-sub)] mb-2"></i>
                        <p className="text-sm m-0 text-[var(--text-sub)] font-medium">
                            {searchQuery ? `No users found matching "${searchQuery}"` : 'No users there'}
                        </p>
                    </div>
                ) : filteredUsers.map(u => {
                    const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                    return (
                        <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="p-0 border-0 bg-transparent cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-[var(--border-color)]">
                                    <img src={u.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} alt={u.fullname} className="w-full h-full object-cover" />
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="flex-1 min-w-0 p-0 border-0 bg-transparent text-left cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <p className="m-0 text-sm font-semibold truncate text-[var(--text-main)]">{u.fullname}</p>
                                {u.username && <p className="m-0 text-[11px] text-[#808bf5] font-medium">@{u.username}</p>}
                            </button>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {u._id !== user?._id && (
                                    <>
                                        {/* If it's followers list AND it's MY list, show Remove button */}
                                        {!isfollowing && ids.some(id => id.toString() === u._id.toString()) && user.followers?.some(fid => fid.toString() === u._id.toString()) && (
                                            <button
                                                onClick={() => handleRemoveFollower(u._id)}
                                                disabled={removeFollowerMutation.isPending}
                                                className="text-[10px] sm:text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] cursor-pointer font-semibold hover:bg-[var(--surface-1)] transition min-w-[70px]"
                                            >
                                                {(removeFollowerMutation.isPending && removeFollowerMutation.variables?.followerId === u._id) ? '...' : "Remove"}
                                            </button>
                                        )}

                                        {/* Always show follow/unfollow unless it's yourself */}
                                        {(() => {
                                            const isRequested = u.followRequests?.some(r => r?.toString() === user?._id?.toString());
                                            const isMutating = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) ||
                                                (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id) ||
                                                (cancelMutation.isPending && cancelMutation.variables?.targetUserId === u._id);
                                            return (
                                                <button onClick={() => handleFollow(u._id, isRequested)}
                                                    disabled={isMutating}
                                                    className={`text-[10px] sm:text-xs px-4 py-1.5 rounded-full border-0 cursor-pointer font-bold transition min-w-[85px] ${isFollowing ? 'bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border-color)]' : isRequested ? 'bg-[var(--surface-2)] text-[var(--text-sub)] border border-[var(--border-color)]' : 'bg-[#808bf5] text-white shadow-sm hover:opacity-90'}`}>
                                                    {isMutating
                                                        ? '...'
                                                        : (isFollowing ? 'Unfollow' : isRequested ? 'Requested' : 'Follow')}
                                                </button>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <Dialog
                header="Profile"
                visible={profileVisible}
                style={{ width: '95vw', maxWidth: '520px', height: '90vh' }}
                onHide={() => {
                    setProfileVisible(false);
                    setSelectedUserId(null);
                }}
            >
                {selectedUserId && <UserProfile id={selectedUserId} />}
            </Dialog>
        </>
    );
};

export default FollowFollowingList;
