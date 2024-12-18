import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { hideComponent } from "../../store/slices/visibilitySlice";
const UserProfile = ({ userData }) => {
  const [userDetails, setUserDetails] = useState(null);
  const [isFollower, setIsFollower] = useState(false);
  const [loading, setLoading] = useState(true);

  const otheruserid = useSelector((state) => state.visibility.id);
  const dispatch = useDispatch();


  useEffect(() => {
    if (otheruserid && userData) {
      const fetchUserDetails = async () => {
        try {
          const response = await fetch("http://localhost:5000/api/auth/other-user/view", {
            method: "GET",
            headers: {
              Authorization: `${otheruserid}`,
            },
          });

          const data = await response.json();
          setUserDetails(data);
          setIsFollower(data?.followers?.includes(userData._id)); // Optional chaining to avoid errors
          setLoading(false);
        } catch (error) {
          console.error("Error fetching user details:", error);
          setLoading(false);
        }
      };

      fetchUserDetails();
    }
  }, [otheruserid ]);


  // Early return if userData is null or undefined
  if (!userData) {
    return <p>Loading...</p>; // Ensure we return here
  }


  const handleFollow = async () => {
    if (!userDetails) return;

    try {
      const response = await fetch("http://localhost:5000/api/auth/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userData._id, followUserId: userDetails._id }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setIsFollower(true);
        setUserDetails((prevDetails) => ({
          ...prevDetails,
          followers: [...prevDetails.followers, userData._id],
        }));
      } else {
        console.error("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const handleUnfollow = async () => {
    if (!userDetails) return;

    try {
      const response = await fetch("http://localhost:5000/api/auth/unfollow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userData._id, unfollowUserId: userDetails._id }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setIsFollower(false);
        setUserDetails((prevDetails) => ({
          ...prevDetails,
          followers: prevDetails.followers.filter((id) => id !== userData._id),
        }));
      } else {
        console.error("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  const handleHide = () => {
    dispatch(hideComponent());
  };

  if (!otheruserid) {
    return null;
  }

  return (
    <div className="popups bordershadow rounded p-3 d-flex flex-column gap-1 text-center">
      {loading ? (
        <p>Loading...</p>
      ) : userDetails ? (
        <>
          <div>
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQWdjis-8T0ZC_aBUa_8QAxnkmCuWLQCP5rg&s"
              alt="Cover"
              className="cover-image"
            />
          </div>
          <div className="profile-details d-flex align-items-center justify-content-center text-center flex-column gap-1">
            <div className="profile-pic-container">
              <img
                src={userDetails.profile_picture}
                alt="Profile"
                className="profile-pic rounded-circle"
              />
            </div>
            <h3 className="m-0 pacifico-regular">{userDetails.fullname}</h3>
          </div>
          <div className="text-center">
            <p>{userDetails.bio}</p>
          </div>
          <div className="d-flex justify-content-around">
            <div className="text-center">
              <h6 className="m-0 p-0 nosifer-regular">{userDetails.following?.length || 0}</h6>
              <h6>Following</h6>
            </div>
            <div className="text-center">
              <h6 className="m-0 p-0 nosifer-regular">{userDetails.followers?.length || 0}</h6>
              <h6>Followers</h6>
            </div>
          </div>
          <div className="mt-2 d-flex justify-content-center gap-2 flex-column">
            {isFollower ? (
              <button className="btn btn-sm btn-danger p-1 w-100" onClick={handleUnfollow}>
                Unfollow
              </button>
            ) : (
              <button className="theme-bg p-1 w-100" onClick={handleFollow}>
                Follow
              </button>
            )}
            <button onClick={handleHide} className="btn btn-sm btn-outline-dark">
              Back
            </button>
          </div>
        </>
      ) : (
        <p>User not found</p>
      )}
    </div>
  );
};

export default UserProfile;
