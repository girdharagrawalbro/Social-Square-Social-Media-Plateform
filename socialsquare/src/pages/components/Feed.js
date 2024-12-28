import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from 'react-redux';
// components
import Loader from './Loader';

// ui
import { Image } from 'primereact/image';
import { OverlayPanel } from 'primereact/overlaypanel';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
// redux
import { fetchPosts, fetchComments, unlikepost, likepost } from '../../store/slices/postsSlice';

const Feed = () => {
  const op = useRef(null);
  const dispatch = useDispatch();
  const { posts, loading, error } = useSelector((state) => state.posts);
  const { loggeduser } = useSelector((state) => state.users);
  const [visiblePostId, setVisiblePostId] = useState(null); // State for tracking the post with visible comments

  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

  const toggleComments = (postId) => {
    dispatch(fetchComments(postId));
    setVisiblePostId((prev) => (prev === postId ? null : postId)); // Toggle visibility for the specific post
  };

  const confirm = (event) => {
    confirmPopup({
      target: event.currentTarget,
      message: 'Do you want to delete this post?',
      icon: 'pi pi-info-circle',
      defaultFocus: 'reject',
      acceptClassName: 'p-button-danger',
      accept,
      reject
    });
  };
  
  const accept = () => {

  };

  const reject = () => {

  };
  return (
    <div className="">
      {loading.posts || !loggeduser ? (
        <Loader />
      ) : (
        <div className="mt-3 rounded d-flex flex-column gap-3">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <div key={index} className="post w-100 h-20 rounded-3 p-3 shadow d-flex flex-column gap-1">
                <div
                  className={`d-flex align-items-center gap-2 ${post.image_url ? "" : "mb-5"}`}
                >
                  <img
                    src={post.user.profile_picture}
                    alt="Profile"
                    className="logo"
                  />
                  <div className="d-flex flex-column gap-0">
                    <h6 className="m-0 p-0">{post.user.fullname}</h6>
                  </div>
                </div>
                <div className="post-img-container border mt-2 position-relative">
                  {post.image_url && (
                    <Image
                      src={post.image_url}
                      alt="Post"
                      className="post-img rounded-3"
                      preview
                      width="100%"
                    />
                  )}

                  <div className="interaction position-absolute w-100">
                    <div className="d-flex justify-content-between align-items-center px-3 py-2">
                      <div className="d-flex gap-2">
                        <p className="text-white">{post.caption}</p>
                      </div>
                      <div className="d-flex justify-content-center align-items-center gap-3">

                        <div className="d-flex align-items-center gap-2">
                          <span
                            onClick={() =>
                              dispatch(
                                post?.likes?.includes(loggeduser?._id)
                                  ? unlikepost({ postId: post._id, userId: loggeduser._id })
                                  : likepost({ postId: post._id, userId: loggeduser._id })
                              )
                            }
                            className="d-flex align-items-center gap-2"
                          >
                            {post?.likes?.includes(loggeduser?._id) ? (
                              <Like count={post?.likes?.length} isliked={true} loading={loading.like} />
                            ) : (
                              <Like count={post?.likes?.length} isliked={false} loading={loading.unlike} />
                            )}
                          </span>
                        </div>

                        <span
                          className="d-flex align-items-center justify-content-center gap-2 text-white"
                          onClick={() => toggleComments(post._id)} // Pass the postId to toggleComments
                        >
                          <i className="pi pi-comment" style={{ fontSize: '1.3rem', color: 'white' }}></i>
                          <span>{post.comments?.length || 0}</span>
                        </span>

                        <span className="d-flex align-items-center justify-content-center gap-2 text-white" onClick={(e) => op.current.toggle(e)} >
                          <i className="pi pi-share-alt" style={{ fontSize: '1.3rem', color: 'white' }}></i>
                          <span>{post.shares?.length || 0}</span>
                        </span>
                        {post.user._id === loggeduser._id ?
                          <span className="d-flex align-items-center justify-content-center gap-2 text-white" onClick={confirm} >
                            <i className="pi pi-trash" style={{ fontSize: '1.3rem', color: 'white' }}></i>
                          </span>
                          : <></>
                        }

                      </div>
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
  );
};

export default Feed;
