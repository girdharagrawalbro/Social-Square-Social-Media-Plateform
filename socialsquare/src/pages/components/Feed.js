  import React, { useEffect, useState, useRef } from "react";
  import { useSelector, useDispatch } from 'react-redux';
  // components
  import SkeletonPost from './ui/SkeletonPost';
  // ui
  import { Image } from 'primereact/image';
  import { OverlayPanel } from 'primereact/overlaypanel';
  import Like from "./ui/Like";
  import Comment from './ui/Comment';
  import { ConfirmPopup } from 'primereact/confirmpopup';
  // redux
  import { fetchPosts, fetchComments, unlikepost, likepost } from '../../store/slices/postsSlice';

  import relativeTime from '../../utils/relativeTime';

  const Feed = () => {
    const op = useRef(null);
    const dispatch = useDispatch();
    const { posts, loading } = useSelector((state) => state.posts);
    const { loggeduser } = useSelector((state) => state.users);
    const [visiblePostId, setVisiblePostId] = useState(null);

    useEffect(() => {
      dispatch(fetchPosts());
    }, [dispatch]);

    const toggleComments = (postId) => {
      dispatch(fetchComments(postId));
      setVisiblePostId((prev) => (prev === postId ? null : postId));
    };

    return (
      <div>
        {loading.posts || !loggeduser ? (
          <div className="mt-3 rounded flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonPost key={i} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded flex flex-col gap-3">
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <div key={index} className="relative overflow-hidden w-full rounded-xl shadow-md flex flex-col gap-1 border">

                  <div className="flex items-center gap-2 px-2 pt-2">
                    <img src={post.user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex flex-col gap-0">
                      <h6 className="m-0 p-0 font-medium">{post.user.fullname}</h6>
                    </div>
                  </div>

                  {post.image_url && (
                    <div className="relative w-full text-center mt-2 max-h-50 overflow-hidden">
                      <Image src={post.image_url} alt="Post" className="rounded-xl w-full  object-cover " preview width="100%" />
                    </div>
                  )}

                  <div className="bg-white text-black rounded-t-xl w-full">

                    <div className="flex flex-col gap-1 p-3">

                      <div className="flex flex-wrap items-center gap-3">
                        <div onClick={() =>
                          dispatch(
                            post?.likes?.includes(loggeduser?._id)
                              ? unlikepost({ postId: post._id, userId: loggeduser._id })
                              : likepost({ postId: post._id, userId: loggeduser._id })
                          )
                        } className="flex items-center gap-2 cursor-pointer">
                          <Like
                            isliked={post?.likes?.includes(loggeduser?._id)}
                            loading={post?.likes?.includes(loggeduser?._id) ? loading.like : loading.unlike}
                          />
                        </div>

                        <button onClick={() => toggleComments(post._id)} className="flex items-center justify-center gap-2">
                          <i className="pi pi-comment" style={{ fontSize: '1.3rem', color: 'black' }}></i>
                        </button>

                        <button onClick={(e) => op.current.toggle(e)} className="flex items-center justify-center gap-2">
                          <i className="pi pi-share-alt" style={{ fontSize: '1.3rem', color: 'black' }}></i>
                          {/* <span>{post.shares?.length || 0}</span> */}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center  gap-2 mt-2">
                        <p className="m-0  text-xs"><span className="font-medium text-sm">{post?.likes?.length}</span> likes</p>
                      </div>


                      <div className="flex flex-wrap items-center gap-2">
                        <p className=""><span className="font-medium">{post.user.fullname}</span> {post.caption}</p>
                      </div>


                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-xs text-gray-700 font-medium">View all <span className="font-medium">{post.comments?.length || 0}</span> comments</p>
                      </div>


                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-xs text-gray-400">{relativeTime(post.updatedAt)}</p>
                      </div>
                    </div>

                  </div>

                  <ConfirmPopup />

                  {visiblePostId === post._id && (
                    <Comment postId={post._id} setVisible={() => setVisiblePostId(null)} />
                  )}
                </div>
              ))
            ) : (
              <p>No posts to display.</p>
            )}
          </div>
        )}

        <OverlayPanel header="Share" ref={op}>
          <div className="w-64 p-2">Share</div>
        </OverlayPanel>
      </div>
    );
  };

  export default Feed;
