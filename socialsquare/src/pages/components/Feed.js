import React, { useContext, useEffect, useState } from "react";
import { PostContext } from "../../context/PostContext";
import { useDispatch } from 'react-redux';
import { showComponent } from '../../store/slices/visibilitySlice';
import Loader from './Loader'
const Feed = ({ userId,profile_picture }) => {
  const { fetchCategories, fetchPosts, categories, posts } = useContext(PostContext);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  

  useEffect(() => {
    const fetchData = async () => {
      await fetchPosts();
      await fetchCategories();
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleShow = (id) => {
    dispatch(showComponent(id));
  }

  



  const handleLike = async (postId) => {
    try {
      const response = await fetch("http://localhost:5000/api/post/like", {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          userId: userId
        }),
      });
      if (response.ok) {
        const data = await response.json();
      fetchPosts();

      }
      else {
        console.error("Failed to like");
      }
    }
    catch (error) {
      console.error("Error in likeing ");
    }
  }

  const handleUnlike = async (postId) => {
    try {
      const response = await fetch("http://localhost:5000/api/post/unlike", {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          userId: userId
        }),
      });
      if (response.ok) {
        const data = await response.json();
        fetchPosts();

      }
      else {
        console.error("Failed to like");
      }
    }
    catch (error) {
      console.error("Error in likeing ");
    }
  }

  return (
    <div className="">
      {loading ?
        <Loader />
        :
        <div className="mt-3 rounded d-flex flex-column gap-3">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <div key={index} className="post w-100 h-20 rounded-3 p-3 shadow d-flex flex-column gap-1">
                <div
                  className={`d-flex align-items-center gap-2 ${post.image_url ? "" : "mb-5"
                    }`}
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
                  {
                    post.image_url ?
                      <img
                        src={post.image_url}
                        alt="Post"
                        className="post-img rounded-3"
                      />
                      :
                      <></>
                  }

                  <div className="interaction position-absolute w-100">
                    <div className="d-flex justify-content-between align-items-center px-3 py-2">
                      <div className="d-flex gap-2">
                        <p className="text-white">{post.caption}</p>
                      </div>
                      <div className="d-flex gap-2">
                        {(post?.likes?.includes(userId)) ? (
                          <button className="btn btn-sm" onClick={() => handleUnlike(post._id)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              width="18"
                              height="24"
                              color="#fff"
                              fill="red"
                            >
                              <path
                                d="M2 12.5C2 11.3954 2.89543 10.5 4 10.5C5.65685 10.5 7 11.8431 7 13.5V17.5C7 19.1569 5.65685 20.5 4 20.5C2.89543 20.5 2 19.6046 2 18.5V12.5Z"
                                stroke="currentColor"
                                stroke-width="1"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <path
                                d="M15.4787 7.80626L15.2124 8.66634C14.9942 9.37111 14.8851 9.72349 14.969 10.0018C15.0369 10.2269 15.1859 10.421 15.389 10.5487C15.64 10.7065 16.0197 10.7065 16.7791 10.7065H17.1831C19.7532 10.7065 21.0382 10.7065 21.6452 11.4673C21.7145 11.5542 21.7762 11.6467 21.8296 11.7437C22.2965 12.5921 21.7657 13.7351 20.704 16.0211C19.7297 18.1189 19.2425 19.1678 18.338 19.7852C18.2505 19.8449 18.1605 19.9013 18.0683 19.9541C17.116 20.5 15.9362 20.5 13.5764 20.5H13.0646C10.2057 20.5 8.77628 20.5 7.88814 19.6395C7 18.7789 7 17.3939 7 14.6239V13.6503C7 12.1946 7 11.4668 7.25834 10.8006C7.51668 10.1344 8.01135 9.58664 9.00069 8.49112L13.0921 3.96056C13.1947 3.84694 13.246 3.79012 13.2913 3.75075C13.7135 3.38328 14.3652 3.42464 14.7344 3.84235C14.774 3.8871 14.8172 3.94991 14.9036 4.07554C15.0388 4.27205 15.1064 4.37031 15.1654 4.46765C15.6928 5.33913 15.8524 6.37436 15.6108 7.35715C15.5838 7.46692 15.5488 7.5801 15.4787 7.80626Z"
                                stroke="currentColor"
                                stroke-width="1"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>

                        ) : (
                          <button className="btn btn-sm" onClick={() => handleLike(post._id)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              width="18"
                              height="24"
                              color="#ffffff"
                              fill="none"
                            >
                              <path
                                d="M2 12.5C2 11.3954 2.89543 10.5 4 10.5C5.65685 10.5 7 11.8431 7 13.5V17.5C7 19.1569 5.65685 20.5 4 20.5C2.89543 20.5 2 19.6046 2 18.5V12.5Z"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <path
                                d="M15.4787 7.80626L15.2124 8.66634C14.9942 9.37111 14.8851 9.72349 14.969 10.0018C15.0369 10.2269 15.1859 10.421 15.389 10.5487C15.64 10.7065 16.0197 10.7065 16.7791 10.7065H17.1831C19.7532 10.7065 21.0382 10.7065 21.6452 11.4673C21.7145 11.5542 21.7762 11.6467 21.8296 11.7437C22.2965 12.5921 21.7657 13.7351 20.704 16.0211C19.7297 18.1189 19.2425 19.1678 18.338 19.7852C18.2505 19.8449 18.1605 19.9013 18.0683 19.9541C17.116 20.5 15.9362 20.5 13.5764 20.5H13.0646C10.2057 20.5 8.77628 20.5 7.88814 19.6395C7 18.7789 7 17.3939 7 14.6239V13.6503C7 12.1946 7 11.4668 7.25834 10.8006C7.51668 10.1344 8.01135 9.58664 9.00069 8.49112L13.0921 3.96056C13.1947 3.84694 13.246 3.79012 13.2913 3.75075C13.7135 3.38328 14.3652 3.42464 14.7344 3.84235C14.774 3.8871 14.8172 3.94991 14.9036 4.07554C15.0388 4.27205 15.1064 4.37031 15.1654 4.46765C15.6928 5.33913 15.8524 6.37436 15.6108 7.35715C15.5838 7.46692 15.5488 7.5801 15.4787 7.80626Z"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                        )}

                        <button className="btn btn-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="24" color="#ffffff" fill="none">
                            <path d="M8.5 14.5H15.5M8.5 9.5H12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M14.1706 20.8905C18.3536 20.6125 21.6856 17.2332 21.9598 12.9909C22.0134 12.1607 22.0134 11.3009 21.9598 10.4707C21.6856 6.22838 18.3536 2.84913 14.1706 2.57107C12.7435 2.47621 11.2536 2.47641 9.8294 2.57107C5.64639 2.84913 2.31441 6.22838 2.04024 10.4707C1.98659 11.3009 1.98659 12.1607 2.04024 12.9909C2.1401 14.536 2.82343 15.9666 3.62791 17.1746C4.09501 18.0203 3.78674 19.0758 3.30021 19.9978C2.94941 20.6626 2.77401 20.995 2.91484 21.2351C3.05568 21.4752 3.37026 21.4829 3.99943 21.4982C5.24367 21.5285 6.08268 21.1757 6.74868 20.6846C7.1264 20.4061 7.31527 20.2668 7.44544 20.2508C7.5756 20.2348 7.83177 20.3403 8.34401 20.5513C8.8044 20.7409 9.33896 20.8579 9.8294 20.8905C11.2536 20.9852 12.7435 20.9854 14.1706 20.8905Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                          </svg>
                        </button>
                        <button className="btn btn-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="24" color="#ffffff" fill="none">
                            <path d="M21 6.5C21 8.15685 19.6569 9.5 18 9.5C16.3431 9.5 15 8.15685 15 6.5C15 4.84315 16.3431 3.5 18 3.5C19.6569 3.5 21 4.84315 21 6.5Z" stroke="currentColor" stroke-width="2" />
                            <path d="M9 12C9 13.6569 7.65685 15 6 15C4.34315 15 3 13.6569 3 12C3 10.3431 4.34315 9 6 9C7.65685 9 9 10.3431 9 12Z" stroke="currentColor" stroke-width="1.5" />
                            <path d="M21 17.5C21 19.1569 19.6569 20.5 18 20.5C16.3431 20.5 15 19.1569 15 17.5C15 15.8431 16.3431 14.5 18 14.5C19.6569 14.5 21 15.8431 21 17.5Z" stroke="currentColor" stroke-width="1.5" />
                            <path d="M8.72852 10.7495L15.2285 7.75M8.72852 13.25L15.2285 16.2495" stroke="currentColor" stroke-width="1.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No posts to display.</p>
          )}
        </div>
      }
    </div>
  );
};

export default Feed;
