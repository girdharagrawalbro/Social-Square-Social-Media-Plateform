import React, { useState, useMemo } from 'react';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';
import { useUserDetails } from '../../../hooks/queries/useAuthQueries';
import { useConversations, useSendMessage } from '../../../hooks/queries/useConversationQueries';

const SharePostDialog = ({ visible, onHide, post, user, onShareToStory }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sendingUsers, setSendingUsers] = useState([]);

    // 1. Fetch recent conversations to prioritize frequent contacts
    const { data: conversations = [], isLoading: convLoading } = useConversations(visible ? user?._id : null);

    // 2. Collect all follower/following IDs for a full list
    const followerIds = (user?.followers || []).map(f => f.toString());
    const followingIds = (user?.following || []).map(f => f.toString());
    const allUniqueIds = Array.from(new Set([...followerIds, ...followingIds]));

    // 3. Fetch detailed user info for all unique IDs
    const { data: users = [], isLoading: usersLoading } = useUserDetails(visible ? allUniqueIds : []);

    const sendMessageMut = useSendMessage();

    // 4. Combine and Sort: Frequent/Recent Chats first
    const sortedUsers = useMemo(() => {
        // Map of userId -> lastMessageAt for sorting
        const convMap = new Map();
        conversations.forEach(c => {
            const other = c.participants.find(p => p.userId !== user?._id);
            if (other) convMap.set(other.userId, new Date(c.updatedAt).getTime());
        });

        return [...users]
            .filter(u =>
                u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                const timeA = convMap.get(a._id) || 0;
                const timeB = convMap.get(b._id) || 0;
                return timeB - timeA; // Descending: most recent first
            });
    }, [users, conversations, searchQuery, user?._id]);

    const handleShare = async (targetUser) => {
        if (!post?._id || !targetUser?._id) return;
        setSendingUsers(prev => [...prev, targetUser._id]);

        try {
            const content = `You sent an attachment`;

            // Find existing conversation or it will be handled by the mutation logic
            const conv = conversations.find(c => c.participants.some(p => p.userId === targetUser._id));

            await sendMessageMut.mutateAsync({
                conversationId: conv?._id,
                content,
                recipientId: targetUser._id,
                sharedPost: {
                    postId: post._id,
                    authorName: post.user?.fullname,
                    authorUsername: post.user?.fullname?.toLowerCase().replace(/\s/g, '_'), // Best guess for username if not in post object
                    authorProfilePicture: post.user?.profile_picture,
                    caption: post.caption,
                    mediaUrl: post.image_urls?.[0] || post.image_url || post.videoURL,
                    mediaType: post.videoURL ? 'video' : 'image'
                }
            });

            toast.success(`Shared with ${targetUser.fullname}`);
        } catch (err) {
            console.error('Share failed', err);
            toast.error('Failed to share');
        } finally {
            setSendingUsers(prev => prev.filter(id => id !== targetUser._id));
        }
    };

    const copyLink = () => {
        const url = `${window.location.origin}/post/${post?._id}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
    };

    return (
        <Dialog
            header="Share Post"
            visible={visible}
            onHide={onHide}
            style={{ width: '95vw', maxWidth: '450px' }}
            breakpoints={{ '640px': '100vw' }}
            draggable={false}
            className="share-dialog"
        >
            <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                    <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Search people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            onShareToStory?.(post);
                            onHide();
                            toast.success('Ready to share to story!');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-50 border-0 rounded-xl cursor-pointer text-indigo-600 font-semibold text-xs hover:bg-indigo-100 transition"
                    >
                        ✨ Share to Story
                    </button>
                    <button
                        onClick={copyLink}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 border-0 rounded-xl cursor-pointer text-gray-700 font-semibold text-xs hover:bg-gray-200 transition"
                    >
                        🔗 Copy Link
                    </button>
                </div>

                {/* User List */}
                <div className="max-h-[350px] overflow-y-auto pr-1 flex flex-col gap-1 custom-scrollbar">
                    {convLoading || usersLoading ? (
                        [1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                                <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
                                <div className="flex-1">
                                    <div className="h-3 bg-gray-100 rounded w-24 mb-2"></div>
                                    <div className="h-2 bg-gray-50 rounded w-16"></div>
                                </div>
                            </div>
                        ))
                    ) : sortedUsers.length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-gray-400 text-sm m-0">No users found</p>
                        </div>
                    ) : (
                        sortedUsers.map(u => (
                            <div key={u._id} className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={u.profile_picture || '/default-profile.png'}
                                        className="w-10 h-10 rounded-full object-cover border border-gray-100"
                                        alt=""
                                    />
                                    <div>
                                        <p className="m-0 text-sm font-bold text-gray-800">{u.fullname}</p>
                                        <p className="m-0 text-[11px] text-gray-400">@{u.username}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleShare(u)}
                                    disabled={sendingUsers.includes(u._id)}
                                    className={`px-3 py-2 rounded-full text-[11px] font-bold border-0 cursor-pointer transition-all ${sendingUsers.includes(u._id)
                                        ? 'bg-gray-100 text-gray-400'
                                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                                        }`}
                                >
                                    {sendingUsers.includes(u._id) ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Dialog>
    );
};

export default SharePostDialog;
