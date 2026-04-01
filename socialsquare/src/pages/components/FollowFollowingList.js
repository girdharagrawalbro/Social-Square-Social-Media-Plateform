import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useUserDetails, useFollowUser, useUnfollowUser, useRemoveFollower } from '../../hooks/queries/useAuthQueries';
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

    const filteredUsers = users.filter(u =>
        u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ... handleFollow, handleRemoveFollower, openUserProfile ...
    const handleFollow = (targetUserId) => {
        const isFollowing = user?.following?.some(f => f?.toString() === targetUserId?.toString());
        if (isFollowing) {
            unfollowMutation.mutate({ targetUserId });
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
            <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-50 mb-2">
                <div className="relative">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-200 outline-none transition-all placeholder:text-gray-400"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent text-gray-400 hover:text-gray-600 cursor-pointer p-0"
                        >
                            <i className="pi pi-times-circle text-xs"></i>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-1 p-2">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 opacity-60">
                        <i className="pi pi-users text-2xl text-gray-300 mb-2"></i>
                        <p className="text-sm m-0">No one found matching "{searchQuery}"</p>
                    </div>
                ) : filteredUsers.map(u => {
                    const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                    return (
                        <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="p-0 border-0 bg-transparent cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-100">
                                    <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-full h-full object-cover" />
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="flex-1 min-w-0 p-0 border-0 bg-transparent text-left cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <p className="m-0 text-sm font-semibold truncate text-gray-800">{u.fullname}</p>
                                {u.username && <p className="m-0 text-[11px] text-indigo-500 font-medium">@{u.username}</p>}
                            </button>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {u._id !== user?._id && (
                                    <>
                                        {/* If it's followers list, show Remove button */}
                                        {!isfollowing && (
                                            <button
                                                onClick={() => handleRemoveFollower(u._id)}
                                                disabled={removeFollowerMutation.isPending}
                                                className="text-[10px] sm:text-xs px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-600 cursor-pointer font-semibold hover:bg-gray-50 transition min-w-[60px]"
                                            >
                                                {(removeFollowerMutation.isPending && removeFollowerMutation.variables?.followerId === u._id) ? 'Removing...' : "Remove"}
                                            </button>
                                        )}

                                        {/* Always show follow/unfollow unless it's yourself */}
                                        <button onClick={() => handleFollow(u._id)}
                                            disabled={followMutation.isPending || unfollowMutation.isPending}
                                            className={`text-[10px] sm:text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold transition min-w-[75px] ${isFollowing ? 'bg-indigo-50 text-indigo-600' : 'bg-[#808bf5] text-white shadow-sm hover:shadow-md'}`}>
                                            {(followMutation.isPending && followMutation.variables?.targetUserId === u._id) || (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id)
                                                ? 'Loading...'
                                                : (isFollowing ? 'Unfollow' : 'Follow')}
                                        </button>
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