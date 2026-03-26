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
            <div className="p-3 border bg-white rounded mt-3">
                <h5 className="font-medium mb-3">Suggested Users</h5>
                <div className="flex flex-col gap-2 overflow-y-auto  h-[34vh] sm:h-[50vh]">
                    {users.filter(u => u._id !== user?._id && !user?.following?.some(f => f?.toString() === u._id?.toString())).slice(0, 8).map(u => {
                        const isFollowing = false; // We filtered out already following users
                        const isThisUserLoading = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) || 
                                                  (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id);
                        const followersCount = typeof u.followersCount === 'number' ? u.followersCount : (u.followers?.length || 0);
                        return (
                            <div key={u._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                                onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}>
                                <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-sm font-medium truncate">{u.fullname}</p>
                                    <p className="m-0 text-xs text-gray-400 truncate">{followersCount} followers{u.reason ? ` • ${u.reason}` : ''}</p>
                                </div>
                                <button onClick={e => handleFollow(e, u._id)}
                                    disabled={isThisUserLoading}
                                    className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold flex-shrink-0 transition ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'} ${isThisUserLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isThisUserLoading ? 'Loading...' : (isFollowing ? 'Following' : 'Follow')}
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