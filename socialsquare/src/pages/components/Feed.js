import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from 'react-redux';
// components
import Loader from './Loader';
// ui
import { Image } from 'primereact/image';
import { OverlayPanel } from 'primereact/overlaypanel';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { ConfirmPopup } from 'primereact/confirmpopup';
// redux
import { fetchPosts, fetchComments, unlikepost, likepost } from '../../store/slices/postsSlice';

const Feed = () => {
  const op = useRef(null);
  const dispatch = useDispatch();
  const { posts, loading } = useSelector((state) => state.posts);
  const { loggeduser } = useSelector((state) => state.users);
  const [visiblePostId, setVisiblePostId] = useState(null); // State for tracking the post with visible comments

  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

  const toggleComments = (postId) => {
    dispatch(fetchComments(postId));
    setVisiblePostId((prev) => (prev === postId ? null : postId)); // Toggle visibility for the specific post
  };

  return (
    <>
      <div className="">
        {loading.posts || !loggeduser ? (
          <Loader />
        ) : (
          <div className="mt-3 rounded d-flex flex-column gap-3">
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <div key={index} className="post w-100 rounded-3 shadow d-flex flex-column gap-1">
                  <div
                    className="d-flex align-items-center gap-2 px-2 pt-2" >
                    <img
                      src={post.user.profile_picture}
                      alt="Profile"
                      className="logo"
                    />
                    <div className="d-flex flex-column gap-0">
                      <h6 className="m-0 p-0">{post.user.fullname}</h6>
                    </div>
                  </div>
                    {post.image_url && (
                  <div className="post-img-container border mt-2">
                      <Image
                        src={post.image_url}
                        alt="Post"
                        className="post-img rounded-3"
                        preview
                        width="100%"
                      />
                        </div>

                    )}

                    <div className="interaction w-100">
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 px-3 py-2">
                        {/* Post Caption */}
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <p className="text-white m-0">{post.caption}</p>
                        </div>

                        {/* Post Actions (Aligned to End) */}
                        <div className="d-flex flex-wrap justify-content-end align-items-center gap-3 ms-auto">
                          {/* Like Button */}
                          <div
                            onClick={() =>
                              dispatch(
                                post?.likes?.includes(loggeduser?._id)
                                  ? unlikepost({ postId: post._id, userId: loggeduser._id })
                                  : likepost({ postId: post._id, userId: loggeduser._id })
                              )
                            }
                            className="d-flex align-items-center gap-2"
                          >
                            <Like
                              count={post?.likes?.length}
                              isliked={post?.likes?.includes(loggeduser?._id)}
                              loading={post?.likes?.includes(loggeduser?._id) ? loading.like : loading.unlike}
                            />
                          </div>

                          {/* Comments Button */}
                          <span
                            className="d-flex align-items-center justify-content-center gap-2 text-white"
                            onClick={() => toggleComments(post._id)}
                          >
                            <i className="pi pi-comment" style={{ fontSize: '1.3rem', color: 'white' }}></i>
                            <span>{post.comments?.length || 0}</span>
                          </span>

                          {/* Share Button */}
                          <span
                            className="d-flex align-items-center justify-content-center gap-2 text-white"
                            onClick={(e) => op.current.toggle(e)}
                          >
                            <i className="pi pi-share-alt" style={{ fontSize: '1.3rem', color: 'white' }}></i>
                            <span>{post.shares?.length || 0}</span>
                          </span>

                          {/* Delete Button (Conditional) */}
                          {/* {post.user._id === loggeduser._id && (
      <span
        className="d-flex align-items-center justify-content-center gap-2 text-white"
        onClick={() => confirm(post._id)}
      >
        <i className="pi pi-trash" style={{ fontSize: '1.3rem', color: 'white' }}></i>
      </span>
    )} */}
                        </div>

                    </div>
                  </div>
                  <ConfirmPopup />
                  {/* for comment  */}
                  {visiblePostId === post._id && ( // Only render if the post is the currently visible one
                    <Comment postId={post._id} setVisible={() => setVisiblePostId(null)} />
                  )}
                </div>
              ))
            ) : (
              <p>No posts to display.</p>
            )}
          </div>
        )}

        {/* for share */}
        <OverlayPanel header="Share" ref={op}>
          <div className="25vw m-2 ">
            Share
            <div>
            </div>
          </div>
        </OverlayPanel>
      </div>
    </>
  );
};

export default Feed;
