import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socket } from '../socket';
import {
    socketNewFeedPost,
    socketPostLiked,
    socketPostUnliked,
    socketNewComment,
    socketCommentDeleted,
    socketPostUpdated,
    socketPostDeleted,
} from '../store/slices/postsSlice';

export default function useFeedSocket() {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector(state => state.users);

    useEffect(() => {
        if (!loggeduser?._id) return;

        // ✅ New post from followed user → prepend to feed
        const onNewFeedPost = (post) => {
            // Don't add own posts (already added optimistically)
            if (post.user._id !== loggeduser._id) {
                dispatch(socketNewFeedPost(post));
            }
        };

        // ✅ Like count sync from server
        const onPostLiked = (data) => {
            // Don't update own action (already handled optimistically)
            if (data.userId !== loggeduser._id) {
                dispatch(socketPostLiked(data));
            }
        };

        // ✅ Unlike count sync from server
        const onPostUnliked = (data) => {
            if (data.userId !== loggeduser._id) {
                dispatch(socketPostUnliked(data));
            }
        };

        // ✅ New comment from another user
        const onNewComment = (data) => {
            if (data.comment?.user?._id !== loggeduser._id) {
                dispatch(socketNewComment(data));
            }
        };

        // ✅ Comment deleted
        const onCommentDeleted = (data) => {
            dispatch(socketCommentDeleted(data));
        };

        // ✅ Post updated by owner
        const onPostUpdated = (data) => {
            dispatch(socketPostUpdated(data));
        };

        // ✅ Post deleted by owner
        const onPostDeleted = (data) => {
            dispatch(socketPostDeleted(data));
        };

        socket.on('newFeedPost', onNewFeedPost);
        socket.on('postLiked', onPostLiked);
        socket.on('postUnliked', onPostUnliked);
        socket.on('newComment', onNewComment);
        socket.on('commentDeleted', onCommentDeleted);
        socket.on('postUpdated', onPostUpdated);
        socket.on('postDeleted', onPostDeleted);

        return () => {
            socket.off('newFeedPost', onNewFeedPost);
            socket.off('postLiked', onPostLiked);
            socket.off('postUnliked', onPostUnliked);
            socket.off('newComment', onNewComment);
            socket.off('commentDeleted', onCommentDeleted);
            socket.off('postUpdated', onPostUpdated);
            socket.off('postDeleted', onPostDeleted);
        };
    }, [dispatch, loggeduser]);
}