import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../socket';
import toast from '../utils/toast.js';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import { postKeys } from './queries/usePostQueries';

export default function useFeedSocket() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    const addSocketPost = usePostStore(s => s.addSocketPost);
    const removeSocketPost = usePostStore(s => s.removeSocketPost);
    const syncLike = usePostStore(s => s.syncLikeFromSocket);
    const toggleSaved = usePostStore(s => s.toggleSaved);

    useEffect(() => {
        if (!user?._id) return;

        //  New post from followed user → Zustand socket store
        const onNewFeedPost = (post) => {
            if (post.user._id !== user._id) addSocketPost(post);
        };

        //  Like sync from another user → Zustand optimistic store
        const onPostLiked = ({ postId, userId, likesCount }) => {
            if (userId !== user._id) syncLike(postId, userId, true);
        };
        const onPostUnliked = ({ postId, userId }) => {
            if (userId !== user._id) syncLike(postId, userId, false);
        };

        //  Comment added → invalidate comments query for that post AND update feed count
        const onNewComment = ({ postId, comment, commentsCount }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });

            const updateCount = (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.map(p =>
                            p._id === postId ? {
                                ...p,
                                commentsCount: commentsCount !== undefined ? commentsCount : (p.commentsCount ? p.commentsCount + 1 : 1),
                                comments: [...(p.comments || []), comment._id || 'temp']
                            } : p
                        ),
                    })),
                };
            };
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, updateCount);
            qc.setQueriesData({ queryKey: postKeys.userPosts(user._id) }, updateCount);
        };

        //  Comment deleted → invalidate
        const onCommentDeleted = ({ postId, parentId, commentsCount }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });

            if (!parentId) {
                const updateCount = (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map(page => ({
                            ...page,
                            posts: page.posts.map(p =>
                                p._id === postId ? {
                                    ...p,
                                    commentsCount: commentsCount !== undefined ? commentsCount : Math.max(0, (p.commentsCount ? p.commentsCount - 1 : 0))
                                } : p
                            ),
                        })),
                    };
                };
                qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, updateCount);
                qc.setQueriesData({ queryKey: postKeys.userPosts(user._id) }, updateCount);
            }
        };

        //  Post updated → update in all feed caches
        const onPostUpdated = ({ postId, caption, category }) => {
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.map(p =>
                            p._id === postId ? { ...p, caption, category } : p
                        ),
                    })),
                };
            });
        };

        //  Post deleted → remove from all caches + Zustand
        const onPostDeleted = ({ postId }) => {
            removeSocketPost(postId);
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.filter(p => p._id !== postId),
                    })),
                };
            });
        };

        //  Collaboration notifications
        const onCollaborationInvite = ({ postId, postCaption, invitedBy }) => {
            toast(`🤝 ${invitedBy} invited you to collaborate!`, { duration: 6000 });
            // Refresh feed so invite banner appears
            qc.invalidateQueries({ queryKey: postKeys.feed(user._id) });
        };
        const onCollaborationAccepted = () => {
            toast.success('A collaborator accepted your invite!');
        };

        //  New confession post
        const onNewConfessionPost = (post) => {
            addSocketPost(post); // goes to socketConfessions via addSocketPost logic
            qc.invalidateQueries({ queryKey: postKeys.confessions });
        };

        //  Profile updated broadcast
        const onProfileUpdated = ({ userId: updatedUserId, username, fullname, profile_picture }) => {
            const updatePostUser = (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.map(p => {
                            const authorId = p.user?._id || p.user;
                            if (authorId && authorId.toString() === updatedUserId.toString()) {
                                return {
                                    ...p,
                                    user: {
                                        ...p.user,
                                        username: username || p.user?.username,
                                        fullname: fullname || p.user?.fullname,
                                        profile_picture: profile_picture || p.user?.profile_picture
                                    }
                                };
                            }
                            return p;
                        }),
                    })),
                };
            };
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, updatePostUser);
            qc.setQueriesData({ queryKey: postKeys.userPosts(updatedUserId) }, updatePostUser);
        };

        //  Post saved/unsaved broadcast (for sync across multiple tabs/devices)
        const onPostSavedState = ({ postId, saved }) => {
            toggleSaved(postId, saved);
            qc.invalidateQueries({ queryKey: postKeys.saved(user._id) });
        };

        socket.on('newFeedPost', onNewFeedPost);
        socket.on('postLiked', onPostLiked);
        socket.on('postUnliked', onPostUnliked);
        socket.on('newComment', onNewComment);
        socket.on('commentDeleted', onCommentDeleted);
        socket.on('postUpdated', onPostUpdated);
        socket.on('postDeleted', onPostDeleted);
        socket.on('collaborationInvite', onCollaborationInvite);
        socket.on('collaborationAccepted', onCollaborationAccepted);
        socket.on('newConfessionPost', onNewConfessionPost);
        socket.on('profileUpdated', onProfileUpdated);
        socket.on('postSavedState', onPostSavedState);

        return () => {
            socket.off('newFeedPost', onNewFeedPost);
            socket.off('postLiked', onPostLiked);
            socket.off('postUnliked', onPostUnliked);
            socket.off('newComment', onNewComment);
            socket.off('commentDeleted', onCommentDeleted);
            socket.off('postUpdated', onPostUpdated);
            socket.off('postDeleted', onPostDeleted);
            socket.off('collaborationInvite', onCollaborationInvite);
            socket.off('collaborationAccepted', onCollaborationAccepted);
            socket.off('newConfessionPost', onNewConfessionPost);
            socket.off('profileUpdated', onProfileUpdated);
            socket.off('postSavedState', onPostSavedState);
        };
    }, [user?._id, qc, addSocketPost, removeSocketPost, syncLike, toggleSaved]);
}
