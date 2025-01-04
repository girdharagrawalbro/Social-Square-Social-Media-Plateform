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
    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        // Calculate the difference in milliseconds
        const diff = now - date;
        // If less than 24 hours, show the time
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        // Otherwise, show the date
        return date.toLocaleDateString();
    };
    return (
        <div className='comment'>
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
                                            <h6 className='m-0 p-0' style={{fontSize : "14px"}}>{comment?.user?.fullname}</h6>
                                            <p className='m-0 p-0 ' style={{fontSize : "14px"}}>{comment.content}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className='m-0 p-0 text-secondary' style={{ fontSize: "12px" }}>{formatDateTime(comment.createdAt)}</p>
                                    </div>
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