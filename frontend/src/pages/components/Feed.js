import React, { useContext, useEffect, useState } from "react";
import { PostContext } from "../../context/PostContext";

const Feed = ({ userData }) => {
  const { fetchCategories, fetchPosts, categories, posts } = useContext(PostContext);
  const [loading, setLoading] = useState(true);
  const [showImageInput, setShowImageInput] = useState(false);

  const [searchTerm, setSearchTerm] = useState(""); // To track the search input
  const [users, setUsers] = useState([]); // To store the search results for users
  const [searchposts, setPosts] = useState([]); // To store the search results for posts
  const [notfound, setNotfound] = useState(false);

  const [formData, setFormData] = useState({
    caption: "",
    category: "Default",
  });


  useEffect(() => {
    const fetchData = async () => {
      await fetchPosts();
      await fetchCategories();
      setLoading(false);
    };
    fetchData();
  }, []);
  if (!userData) {
    return <>Loading Posts</>;
  }

  if (loading) {
    return <div className="w-50 h-100 p-3 feed">Loading feed...</div>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.caption.trim()) {
      alert("Caption cannot be empty.");
      return;
    }

    try {
      const { caption, category, imageURL } = formData; // Assuming `formData.user` contains user data
      const response = await fetch("http://localhost:5000/api/post/create", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption,
          category,
          imageURL,
          user: userData._id, // Ensure userData has the correct structure
        }),

      });

      if (response.ok) {
        const data = await response.json();
        setFormData({
          caption: "",
          category: "Default",
          imageURL: "",
        });
        alert("Post created successfully!");
        fetchPosts();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error("Failed to create post:", err);
      alert("An error occurred. Please try again.");
    }
  };


  const toggleImageInput = () => {
    setShowImageInput(!showImageInput);
  };

  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.trim()) {
      try {
        const response = await fetch(`http://localhost:5000/api/auth/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: term }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.type === "user") {
            setUsers(data.results); // Update user suggestions
          } else if (data.type === "post") {
            setPosts(data.results); // Update post suggestions
          }
          else if (data.type === "no") {
            setNotfound(true);
          }
        } else {
          console.error("Error fetching search results");
        }
      } catch (error) {
        console.error("Error during search:", error);
      }
    } else {
      setUsers([]);
      setPosts([]);
      setNotfound(false)
    }
  };



  return (
    <div className="w-50 h-100 p-3 feed">
      {/* Explore Section */}
      <div className="explore d-flex gap-2">
        <input
          placeholder="# Explore..."
          className="border p-2 rounded w-100"
          type="text"
          value={searchTerm}
          onChange={handleSearch}
        />
        <button className="theme-bg px-2" aria-label="Search">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
          >
            <path
              d="M17.5 17.5L22 22"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 11C20 6.02944 15.9706 2 11 2C6.02944 2 2 6.02944 2 11C2 15.9706 6.02944 20 11 20C15.9706 20 20 15.9706 20 11Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Suggestions */}
      <div className="suggestion d-flex gap-2 mt-3">
        {categories.length > 0 ? (
          categories.map((category, index) => (
            <button key={index} className="theme-bg" value={category.category}
              onClick={handleSearch}>#{category.category}</button>
          ))
        ) : (
          <p>No categories available.</p>
        )}
      </div>

      <div className="suggestion my-2">
        {users.length > 0 && (
          <div>
            <h5>Users</h5>
            <div className=" d-flex gap-2 flex-wrap">
              {users.map((user) => (
                <button key={user._id} className="btn btn-outline-primary">
                  {user.fullname}
                </button>
              ))}
            </div>
          </div>
        )}

        {searchposts.length > 0 && (
          <div className="mt-2">
            <h5>Posts</h5>
            <div className=" d-flex gap-2 flex-column">

              {searchposts.map((post) => (
                <button key={post._id} className="btn btn-outline-primary">
                  #{post.category} - {post.caption}
                </button>
              ))}
            </div>
          </div>
        )}

        {notfound && (
          <p>No results found for "{searchTerm}"</p>
        )
        }
      </div>


      {/* New Post */}
      <div className="new mt-2 bordershadow p-2 rounded w-100 d-flex gap-1 align-items-center">
        <img
          src={userData?.profile_picture || "default-profile.png"}
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
              onClick={toggleImageInput}
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
          {showImageInput && (
            <input
              type="text"
              placeholder="Enter image URL"
              className="p-2 border-0 mt-2 w-100"
              id="imageURL"
              name="imageURL"
              value={formData.imageURL}
              onChange={handleChange}
            />
          )}
        </form>
      </div>

      {/* Posts */}
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
                      <button className="btn btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="24" color="#ffffff" fill="none">
                          <path d="M2 12.5C2 11.3954 2.89543 10.5 4 10.5C5.65685 10.5 7 11.8431 7 13.5V17.5C7 19.1569 5.65685 20.5 4 20.5C2.89543 20.5 2 19.6046 2 18.5V12.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          <path d="M15.4787 7.80626L15.2124 8.66634C14.9942 9.37111 14.8851 9.72349 14.969 10.0018C15.0369 10.2269 15.1859 10.421 15.389 10.5487C15.64 10.7065 16.0197 10.7065 16.7791 10.7065H17.1831C19.7532 10.7065 21.0382 10.7065 21.6452 11.4673C21.7145 11.5542 21.7762 11.6467 21.8296 11.7437C22.2965 12.5921 21.7657 13.7351 20.704 16.0211C19.7297 18.1189 19.2425 19.1678 18.338 19.7852C18.2505 19.8449 18.1605 19.9013 18.0683 19.9541C17.116 20.5 15.9362 20.5 13.5764 20.5H13.0646C10.2057 20.5 8.77628 20.5 7.88814 19.6395C7 18.7789 7 17.3939 7 14.6239V13.6503C7 12.1946 7 11.4668 7.25834 10.8006C7.51668 10.1344 8.01135 9.58664 9.00069 8.49112L13.0921 3.96056C13.1947 3.84694 13.246 3.79012 13.2913 3.75075C13.7135 3.38328 14.3652 3.42464 14.7344 3.84235C14.774 3.8871 14.8172 3.94991 14.9036 4.07554C15.0388 4.27205 15.1064 4.37031 15.1654 4.46765C15.6928 5.33913 15.8524 6.37436 15.6108 7.35715C15.5838 7.46692 15.5488 7.5801 15.4787 7.80626Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </button>
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
    </div>
  );
};

export default Feed;
