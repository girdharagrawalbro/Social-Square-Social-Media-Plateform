import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socket } from '../socket';
import toast from 'react-hot-toast';
import {
    socketNewFeedPost, socketNewConfessionPost,
    socketPostLiked, socketPostUnliked,
    socketNewComment, socketCommentDeleted, socketPostUpdated, socketPostDeleted,
} from '../store/slices/postsSlice';

export default function useFeedSocket() {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector(state => state.users);

    useEffect(() => {
        if (!loggeduser?._id) return;

        const onNewFeedPost = (post) => {
            if (post.user._id !== loggeduser._id) dispatch(socketNewFeedPost(post));
        };
        const onPostLiked = (data) => {
            if (data.userId !== loggeduser._id) dispatch(socketPostLiked(data));
        };
        const onPostUnliked = (data) => {
            if (data.userId !== loggeduser._id) dispatch(socketPostUnliked(data));
        };
        const onNewComment = (data) => {
            if (data.comment?.user?._id !== loggeduser._id) dispatch(socketNewComment(data));
        };
        const onCommentDeleted = (data) => dispatch(socketCommentDeleted(data));
        const onPostUpdated = (data) => dispatch(socketPostUpdated(data));
        const onPostDeleted = (data) => dispatch(socketPostDeleted(data));

        // ✅ Collaboration invite notification
        const onCollaborationInvite = ({ postId, postCaption, invitedBy }) => {
            toast(`🤝 ${invitedBy} invited you to collaborate on a post!`, {
                duration: 6000,
                icon: '🤝',
            });
        };

        // ✅ Collaboration accepted notification (for post owner)
        const onCollaborationAccepted = ({ postId, userId }) => {
            toast.success('A collaborator accepted your invite!');
        };

        // ✅ Anonymous posts go to confessions feed — NOT normal feed
        // So we ignore newConfessionPost in the main feed socket
        socket.on('newFeedPost', onNewFeedPost);
        socket.on('postLiked', onPostLiked);
        socket.on('postUnliked', onPostUnliked);
        socket.on('newComment', onNewComment);
        socket.on('commentDeleted', onCommentDeleted);
        socket.on('postUpdated', onPostUpdated);
        socket.on('postDeleted', onPostDeleted);
        // ✅ Anonymous confession post — separate from main feed
        const onNewConfessionPost = (post) => {
            dispatch(socketNewConfessionPost(post));
        };

        socket.on('collaborationInvite', onCollaborationInvite);
        socket.on('collaborationAccepted', onCollaborationAccepted);
        socket.on('newConfessionPost', onNewConfessionPost);

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
        };
    }, [dispatch, loggeduser]);
}