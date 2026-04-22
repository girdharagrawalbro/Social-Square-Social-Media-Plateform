import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../socket';
import toast from 'react-hot-toast';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import { postKeys } from './queries/usePostQueries';

export default function useFeedSocket() {
    const qc           = useQueryClient();
    const user         = useAuthStore(s => s.user);
    const addSocketPost= usePostStore(s => s.addSocketPost);
    const removeSocketPost = usePostStore(s => s.removeSocketPost);
    const syncLike     = usePostStore(s => s.syncLikeFromSocket);

    useEffect(() => {
        if (!user?._id) return;

        // ✅ New post from followed user → Zustand socket store
        const onNewFeedPost = (post) => {
            if (post.user._id !== user._id) addSocketPost(post);
        };

        // ✅ Like sync from another user → Zustand optimistic store
        const onPostLiked = ({ postId, userId, likesCount }) => {
            if (userId !== user._id) syncLike(postId, userId, true);
        };
        const onPostUnliked = ({ postId, userId }) => {
            if (userId !== user._id) syncLike(postId, userId, false);
        };

        // ✅ Comment added → invalidate comments query for that post
        const onNewComment = ({ postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        };

        // ✅ Comment deleted → invalidate
        const onCommentDeleted = ({ postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        };

        // ✅ Post updated → update in all feed caches
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

        // ✅ Post deleted → remove from all caches + Zustand
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

        // ✅ Collaboration notifications
        const onCollaborationInvite = ({ postId, postCaption, invitedBy }) => {
            toast(`🤝 ${invitedBy} invited you to collaborate!`, { duration: 6000 });
            // Refresh feed so invite banner appears
            qc.invalidateQueries({ queryKey: postKeys.feed(user._id) });
        };
        const onCollaborationAccepted = () => {
            toast.success('A collaborator accepted your invite!');
        };

        // ✅ New confession post
        const onNewConfessionPost = (post) => {
            addSocketPost(post); // goes to socketConfessions via addSocketPost logic
            qc.invalidateQueries({ queryKey: postKeys.confessions });
        };

        socket.on('newFeedPost',           onNewFeedPost);
        socket.on('postLiked',             onPostLiked);
        socket.on('postUnliked',           onPostUnliked);
        socket.on('newComment',            onNewComment);
        socket.on('commentDeleted',        onCommentDeleted);
        socket.on('postUpdated',           onPostUpdated);
        socket.on('postDeleted',           onPostDeleted);
        socket.on('collaborationInvite',   onCollaborationInvite);
        socket.on('collaborationAccepted', onCollaborationAccepted);
        socket.on('newConfessionPost',     onNewConfessionPost);

        return () => {
            socket.off('newFeedPost',           onNewFeedPost);
            socket.off('postLiked',             onPostLiked);
            socket.off('postUnliked',           onPostUnliked);
            socket.off('newComment',            onNewComment);
            socket.off('commentDeleted',        onCommentDeleted);
            socket.off('postUpdated',           onPostUpdated);
            socket.off('postDeleted',           onPostDeleted);
            socket.off('collaborationInvite',   onCollaborationInvite);
            socket.off('collaborationAccepted', onCollaborationAccepted);
            socket.off('newConfessionPost',     onNewConfessionPost);
        };
    }, [user?._id, qc, addSocketPost, removeSocketPost, syncLike]);
}
