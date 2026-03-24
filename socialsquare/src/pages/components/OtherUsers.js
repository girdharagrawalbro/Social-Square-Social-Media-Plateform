import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useOtherUsers, useFollowUser, useUnfollowUser } from '../../hooks/queries/useAuthQueries';
import UserProfile from './UserProfile';

const OtherUsers = () => {
    const user = useAuthStore(s => s.user);
    
    // ✅ TanStack Query - cached, deduplicated requests
    const { data: users = [], isLoading } = useOtherUsers();
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    const [selectedId, setSelectedId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);

    const handleFollow = (e, userId) => {
        e.stopPropagation();
        const isFollowing = user?.following?.some(f => f?.toString() === userId?.toString());
        if (isFollowing) {
            unfollowMutation.mutate({ targetUserId: userId });
        } else {
            followMutation.mutate({ targetUserId: userId });
        }
    };

    if (isLoading) return (
        <div className="p-3 bordershadow bg-white rounded mt-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl mb-2 animate-pulse" />)}
        </div>
    );

    return (
        <>
            <div className="p-3 border bg-white rounded mt-3 h-[36vh]">
                <h5 className="font-medium mb-3">Suggested Users</h5>
                <div className="flex flex-col gap-2">
                    {users.filter(u => u._id !== user?._id).slice(0, 8).map(u => {
                        const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                        const isLoading = followMutation.isPending || unfollowMutation.isPending;
                        return (
                            <div key={u._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                                onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}>
                                <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-sm font-medium truncate">{u.fullname}</p>
                                    <p className="m-0 text-xs text-gray-400">{u.followers?.length || 0} followers</p>
                                </div>
                                <button onClick={e => handleFollow(e, u._id)}
                                    disabled={isLoading}
                                    className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold flex-shrink-0 transition ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '500px' }} onHide={() => setProfileVisible(false)}>
                <UserProfile id={selectedId} />
            </Dialog>
        </>
    );
};

export default OtherUsers;