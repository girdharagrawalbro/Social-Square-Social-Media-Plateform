import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux';
import { createComment } from '../../../store/slices/postsSlice';

const Comment = ({ postId, setVisible }) => {
    const dispatch = useDispatch();
    const { loggeduser } = useSelector((state) => state.users);
    const { comments, loading } = useSelector((state) => state.posts);
    const [formData, setFormData] = useState({
        content: ""
    })

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.content.trim()) return;

        dispatch(createComment({ postId, content: formData.content, user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture } }))
            .unwrap()
            .then(() => {
                setFormData({ content: '' }); // Clear input
            })
            .catch((error) => {
                console.error('Failed to post comment:', error);
            });
    };


    return (
        <div className='comment'>
            <hr />
            <div className="commentlist d-flex flex-column gap-2">
                {loading.comments || !comments ? <p className="text-secondary" style={{ fontSize: "14px" }}>Loading...</p> :
                    comments.length > 0 ? (
                        (comments.map((comment) => (
                            <div className="commentbox bordershadow p-2 rounded w-100">
                                <div className='d-flex gap-2 align-items-center justify-content-between'>
                                    <div className='d-flex gap-2 align-items-center'>
                                        <img
                                            src={comment?.user?.profile_picture || "default-profile.png"}
                                            alt="Profile"
                                            className="logo"
                                        />
                                        <div>
                                            <h6 className='m-0 p-0'>{comment?.user?.fullname}</h6>
                                            <p className='m-0 p-0 text-secondary' style={{ fontSize: "12px" }}>{(comment.createdAt)}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="like-button">
                                            <input className="on" id="heart" type="checkbox" />
                                            <label className="like" for="heart">
                                                <svg
                                                    className="like-icon"
                                                    fill-rule="nonzero"
                                                    viewBox="0 0 24 24"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
                                                    ></path>
                                                </svg>
                                            </label>
                                            <span className="like-count one">68</span>
                                            <span className="like-count two">69</span>
                                        </div>

                                    </div>
                                </div>
                                <div className='pt-1 px-2'>
                                    <p className='m-0 p-0 text-secondary'>{comment.content}</p>
                                </div>
                            </div>
                        )))
                    ) : <p className="text-secondary" style={{ fontSize: "14px" }}>No comments yet</p>
                }

            </div>
            <div className=" mt-2 bordershadow p-2 rounded w-100 d-flex gap-1 align-items-center">
                <img
                    src={loggeduser?.profile_picture || "default-profile.png"}
                    alt="Profile"
                    className="logo"
                />
                <form onSubmit={handleSubmit} className="d-flex w-100 flex-column">
                    <div className="d-flex w-100">
                        <input
                            type="text"
                            placeholder="# Comment your thoughts on this post"
                            className="p-2 border-0 w-100"
                            id="content"
                            name="content"
                            value={formData.content}
                            onChange={handleChange}
                        />

                        <button
                            type="submit"
                            className="theme-bg mx-1 px-2 py-1 d-flex align-items-center"
                            aria-label="Share thoughts"
                        >
                            <i className='pi pi-send' style={{ fontSize: "22px" }}></i>
                        </button>
                        <button onClick={() => setVisible(false)} className="theme-bg px-2 d-flex align-items-center">
                            <i className='pi pi-times' style={{ fontSize: "22px" }}></i>

                        </button>
                    </div>

                </form>
            </div>

        </div>
    )
}

export default Comment;