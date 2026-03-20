import React, { useEffect, useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

const FollowFollowingList = ({ ids = [], isfollowing }) => {
    const user         = useAuthStore(s => s.user);
    const followUser   = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const [users, setUsers]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ids?.length) { setLoading(false); return; }
        const body = JSON.stringify({ ids });
        fetch(`${BASE}/api/auth/users/details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
            .then(r => r.json())
            .then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [ids]);

    const handleFollow = (userId) => {
        const isFollowing = user?.following?.some(f => f?.toString() === userId?.toString());
        if (isFollowing) unfollowUser(userId);
        else followUser(userId);
    };

    if (loading) return (
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
        <div className="flex flex-col gap-2 p-2">
            {users.map(u => {
                const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                return (
                    <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                        <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="m-0 text-sm font-semibold truncate">{u.fullname}</p>
                            <p className="m-0 text-xs text-gray-400">{u.followers?.length || 0} followers</p>
                        </div>
                        {u._id !== user?._id && (
                            <button onClick={() => handleFollow(u._id)}
                                className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'}`}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default FollowFollowingList;