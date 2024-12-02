import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from 'react-redux';
import { hideComponent } from '../../redux/actions';

const UserProfile = ({ userData, loggedInUserId, userid }) => {
  const [isFollowing, setIsFollowing] = useState(false);

  const dispatch = useDispatch();

  const handleClose = () => {
    dispatch(hideComponent());
  };


  useEffect(() => {
    // Check if the logged-in user is already following this user
    const checkFollowingStatus = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/auth/isFollowing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId: loggedInUserId, followUserId: userData._id }),
        });

        if (response.ok) {
          const { following } = await response.json();
          setIsFollowing(following);
        } else {
          console.error("Failed to check follow status");
        }
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };

    if (loggedInUserId && userData._id) {
      checkFollowingStatus();
    }
  }, [loggedInUserId, userData._id]);

  const handleFollow = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: loggedInUserId, followUserId: userData._id }),
      });

      if (response.ok) {
        setIsFollowing(true);
      } else {
        console.error("Failed to follow user");
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const handleUnfollow = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/unfollow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: loggedInUserId, unfollowUserId: userData._id }),
      });

      if (response.ok) {
        setIsFollowing(false);
      } else {
        console.error("Failed to unfollow user");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  return (

    <div className="popups bordershadow rounded p-3 d-flex flex-column gap-1 text-center">
      {/* Top Cover Image */}
      fourth comonent {userid}
      <button onClick={handleClose}>Close</button>
      <div>
        <img
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQWdjis-8T0ZC_aBUa_8QAxnkmCuWLQCP5rg&s"
          alt="Cover"
          className="cover-image"
        />
      </div>

      {/* Profile Details */}
      <div className="profile-details d-flex align-items-center justify-content-center text-center flex-column gap-1">
        <div className="profile-pic-container">
          <img
            src={userData.profile_picture}
            alt="Profile"
            className="profile-pic rounded-circle"
          />
        </div>
        <h3 className="m-0 pacifico-regular">{userData.fullname}</h3>
      </div>

      {/* Bio */}
      <div className="text-center">
        <p>{userData.bio}</p>
      </div>

      <div className="d-flex justify-content-around">
        <div className="text-center">
          <h6 className="m-0 p-0 nosifer-regular">{userData.following.length}</h6>
          <h6>Following</h6>
        </div>
        <div className="text-center">
          <h6 className="m-0 p-0 nosifer-regular">{userData.followers.length}</h6>
          <h6>Followers</h6>
        </div>
      </div>

      <div className="mt-2 d-flex justify-content-center gap-2">
        {isFollowing ? (
          <button className="theme-bg p-1 w-100" onClick={handleUnfollow}>
            Unfollow
          </button>
        ) : (
          <button className="theme-bg p-1 w-100" onClick={handleFollow}>
            Follow
          </button>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
