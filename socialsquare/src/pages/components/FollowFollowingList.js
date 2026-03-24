import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useUserDetails, useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
import UserProfile from './UserProfile';

const FollowFollowingList = ({ ids = [], isfollowing }) => {
    const user = useAuthStore(s => s.user);
    const [profileVisible, setProfileVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    
    // ✅ TanStack Query for fetching user details
    const { data: users = [], isLoading } = useUserDetails(ids);
    
    // ✅ Mutations for follow/unfollow
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const handleFollow = (targetUserId) => {
        const isFollowing = user?.following?.some(f => f?.toString() === targetUserId?.toString());
        if (isFollowing) {
            unfollowMutation.mutate({ targetUserId });
        } else {
            followMutation.mutate({ targetUserId });
        }
    };

    const openUserProfile = (targetUserId) => {
        setSelectedUserId(targetUserId);
        setProfileVisible(true);
    };

    if (isLoading) return (
        <div className="flex flex-col gap-2 p-2">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
    );

    if (!users.length) return (
        <p className="text-center text-gray-400 text-sm py-6">
            {isfollowing ? 'Not following anyone yet' : 'No followers yet'}
        </p>
    );

    return (
        <>
            <div className="flex flex-col gap-2 p-2">
                {users.map(u => {
                    const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                    return (
                        <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="p-0 border-0 bg-transparent cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                            </button>
                            <button
                                type="button"
                                onClick={() => openUserProfile(u._id)}
                                className="flex-1 min-w-0 p-0 border-0 bg-transparent text-left cursor-pointer"
                                title={`Open ${u.fullname} profile`}
                            >
                                <p className="m-0 text-sm font-semibold truncate">{u.fullname}</p>
                                <p className="m-0 text-xs text-gray-400">{u.followers?.length || 0} followers</p>
                            </button>
                            {u._id !== user?._id && (
                                <button onClick={() => handleFollow(u._id)}
                                    disabled={followMutation.isPending || unfollowMutation.isPending}
                                    className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold transition ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'} ${(followMutation.isPending || unfollowMutation.isPending) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {followMutation.isPending || unfollowMutation.isPending ? 'Loading...' : (isFollowing ? 'Unfollow' : 'Follow')}
                                </button>
                            )}
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