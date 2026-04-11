import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import useAuthStore, { api } from '../store/zustand/useAuthStore';
import useConversationStore from '../store/zustand/useConversationStore';
import { useOtherUsers, useFollowUser, useUnfollowUser } from '../hooks/queries/useAuthQueries';
import { Dialog } from 'primereact/dialog';
import UserProfile from './components/UserProfile';

const UsersPage = () => {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const isOnline = useConversationStore(s => s.isOnline);
    
    // Hooks from our query system
    const { data: users = [], isLoading, error } = useOtherUsers();
    const followMutation = useFollowUser();
    const unfollowMutation = useUnfollowUser();

    // Local state for UI responsiveness
    const [localDismissed, setLocalDismissed] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);

    const handleFollow = (e, targetUserId) => {
        e.stopPropagation();
        const isFollowing = user?.following?.some(f => f?.toString() === targetUserId?.toString());
        if (isFollowing) {
            unfollowMutation.mutate({ targetUserId });
        } else {
            followMutation.mutate({ targetUserId });
        }
    };

    const handleDismiss = async (e, targetUserId) => {
        e.stopPropagation();
        setLocalDismissed(prev => [...prev, targetUserId]);
        try {
            await api.post('/auth/dismiss-user', { targetUserId });
        } catch (err) {
            console.error('Failed to dismiss user:', err);
        }
    };

    const isFollowing = (userId) => {
        return user?.following?.some(f => f?.toString() === userId?.toString());
    };

    if (isLoading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gray-50 text-gray-900'}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#808bf5]"></div>
            </div>
        );
    }

    const filteredUsers = users.filter(u => 
        u._id !== user?._id && 
        !user?.dismissedUsers?.some(d => d?.toString() === u._id?.toString()) &&
        !localDismissed.includes(u._id)
    );

    return (
        <div className={`p-4 md:p-8 ${isDark ? 'bg-[#0d0d0d] text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">Discover People</h1>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Expand your square with new voices and creators.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredUsers.map((u) => {
                        const userIsOnline = isOnline(u._id);
                        const following = isFollowing(u._id);
                        const isMutating = (followMutation.isPending && followMutation.variables?.targetUserId === u._id) ||
                                         (unfollowMutation.isPending && unfollowMutation.variables?.targetUserId === u._id);

                        return (
                            <div 
                                key={u._id}
                                className={`group relative p-6 rounded-3xl border transition-all hover:scale-[1.02] cursor-pointer ${
                                    isDark ? 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#222]' : 'bg-white border-gray-100 hover:shadow-2xl'
                                }`}
                                onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}
                            >
                                {/* Dismiss button */}
                                <button 
                                    onClick={(e) => handleDismiss(e, u._id)}
                                    className="absolute top-4 right-4 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 text-gray-400 border-0 bg-transparent flex items-center justify-center cursor-pointer"
                                >
                                    <i className="pi pi-times text-xs"></i>
                                </button>

                                <div className="flex flex-col items-center">
                                    <div className="relative w-24 h-24 mb-4">
                                        <img 
                                            src={u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullname)}&background=808bf5&color=fff`} 
                                            alt={u.fullname}
                                            className="w-full h-full rounded-full object-cover border-4 border-[#808bf5]/10 group-hover:border-[#808bf5]/30 transition-all"
                                        />
                                        {userIsOnline && (
                                            <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-[#1a1a1a] rounded-full shadow-lg"></div>
                                        )}
                                    </div>

                                    <div className="text-center w-full mb-4">
                                        <h3 className="font-bold text-lg m-0 truncate px-2">{u.fullname}</h3>
                                        <p className={`text-xs mt-1 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {u.reason || 'Recommended'}
                                        </p>
                                    </div>

                                    <div className="flex gap-4 mb-6">
                                        <div className="text-center">
                                            <p className="font-bold text-sm m-0">{u.followersCount || 0}</p>
                                            <p className="text-[10px] uppercase tracking-wider opacity-50 font-bold m-0">Followers</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full mt-auto">
                                        <button 
                                            disabled={isMutating}
                                            onClick={(e) => handleFollow(e, u._id)}
                                            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border-0 cursor-pointer ${
                                                following 
                                                ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' 
                                                : 'bg-[#808bf5] text-white hover:shadow-[0_8px_20px_-6px_rgba(128,139,245,0.6)]'
                                            } ${isMutating ? 'opacity-50' : ''}`}
                                        >
                                            {isMutating ? '...' : (following ? 'Following' : 'Follow')}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/profile/${u._id}`);
                                            }}
                                            className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-500 flex items-center justify-center border-0 cursor-pointer hover:bg-gray-100 transition-colors"
                                        >
                                            <i className="pi pi-user"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
            </div>

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
