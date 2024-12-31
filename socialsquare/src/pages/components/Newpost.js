// React imports
import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast, ToastContainer } from 'react-toastify';
import { OverlayPanel } from 'primereact/overlaypanel';
import { addNewPost } from '../../store/slices/postsSlice';

const NewPost = () => {
  const dispatch = useDispatch();
  const op = useRef(null);
  const { loggeduser } = useSelector((state) => state.users);

  const [formData, setFormData] = useState({
    caption: "",
    category: "Default",
  });


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.caption.trim()) {
      toast.error('Caption cannot be empty!');
    }
else{
    const postData = {
      ...formData,
      loggeduser: loggeduser?._id,
    };

    try {
      const response = await fetch("http://localhost:5000/api/post/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      const data = await response.json();
      if (data) {
        toast.success("Post created successfully");
        dispatch(addNewPost(data));
      } else {
        const error = await response.json();
        toast.error(error.error);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }
    setFormData({
      caption: "",
      category: "Default",
    });
  };


  return (
    <div className="new mt-2 bordershadow p-2 rounded w-100 d-flex gap-1 align-items-center">

      <img
        src={loggeduser?.profile_picture || "default-profile.png"}
        alt="Profile"
        className="logo"
      />
      <form onSubmit={handleSubmit} className="d-flex w-100 flex-column">
        <div className="d-flex w-100">
          <input
            type="text"
            placeholder="# Tell your thoughts to your friends"
            className="p-2 border-0 w-100"
            id="caption"
            name="caption"
            value={formData.caption}
            onChange={handleChange}
          />
          <span
            className="theme-bg px-2 py-1 ms-2"
            aria-label="Add image"
            onClick={(e) => op.current.toggle(e)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              color="#ffffff"
              fill="none"
            >
              <path
                d="M10 13.229C10.1416 13.4609 10.3097 13.6804 10.5042 13.8828C11.7117 15.1395 13.5522 15.336 14.9576 14.4722C15.218 14.3121 15.4634 14.1157 15.6872 13.8828L18.9266 10.5114C20.3578 9.02184 20.3578 6.60676 18.9266 5.11718C17.4953 3.6276 15.1748 3.62761 13.7435 5.11718L13.03 5.85978"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M10.9703 18.14L10.2565 18.8828C8.82526 20.3724 6.50471 20.3724 5.07345 18.8828C3.64218 17.3932 3.64218 14.9782 5.07345 13.4886L8.31287 10.1172C9.74413 8.62761 12.0647 8.6276 13.4959 10.1172C13.6904 10.3195 13.8584 10.539 14 10.7708"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <button
            type="submit"
            className="theme-bg mx-1 px-2 py-1"
            aria-label="Share thoughts"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              color="#ffffff"
              fill="none"
            >
              <path
                d="M11.922 4.79004C16.6963 3.16245 19.0834 2.34866 20.3674 3.63261C21.6513 4.91656 20.8375 7.30371 19.21 12.078L18.1016 15.3292C16.8517 18.9958 16.2267 20.8291 15.1964 20.9808C14.9195 21.0216 14.6328 20.9971 14.3587 20.9091C13.3395 20.5819 12.8007 18.6489 11.7231 14.783C11.4841 13.9255 11.3646 13.4967 11.0924 13.1692C11.0134 13.0742 10.9258 12.9866 10.8308 12.9076C10.5033 12.6354 10.0745 12.5159 9.21705 12.2769C5.35111 11.1993 3.41814 10.6605 3.0909 9.64127C3.00292 9.36724 2.97837 9.08053 3.01916 8.80355C3.17088 7.77332 5.00419 7.14834 8.6708 5.89838L11.922 4.79004Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>

        <ToastContainer
   position="top-right"
   autoClose={1000}
   hideProgressBar={false}
   newestOnTop
   closeOnClick
   rtl={false}
   pauseOnFocusLoss={false}
   draggable
   pauseOnHover={false}
   theme="light"
        transition={"Bounce"} />

        <OverlayPanel ref={op} style={{ padding: "0px" }}>
          <input
            type="text"
            placeholder="Enter image URL"
            className="p-2 border-0 mt-2 w-100"
            id="imageURL"
            name="imageURL"
            value={formData.imageURL}
            onChange={handleChange}
          />
        </OverlayPanel>
      </form>
    </div>
  );
};

export default NewPost;
