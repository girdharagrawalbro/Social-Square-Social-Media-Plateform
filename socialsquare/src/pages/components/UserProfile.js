// links of react
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

// ui
import { Image } from "primereact/image";

// redux
import { followUser, unfollowUser } from '../../store/slices/userSlice';

const UserProfile = ({ id }) => {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();

  const { userFollowStatus, loading: loadingState, loggeduser } = useSelector((state) => state.users);

  useEffect(() => {
    if (id && loggeduser._id) {
      const fetchUserDetails = async () => {
        try {
          const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/auth/other-user/view", {
            method: "GET",
            headers: {
              Authorization: `${id}`,
            },
          });

          const data = await response.json();
          setUserDetails(data);
          setLoading(false);
        } catch (error) {
          console.error("Error fetching user details:", error);
          setLoading(false);
        }
      };

      fetchUserDetails();
    }
  }, [id]);

  const handleFollow = () => {
    dispatch(followUser({ loggedUserId: loggeduser._id, followUserId: id }));
  };

  const handleUnfollow = () => {
    dispatch(unfollowUser({ loggedUserId: loggeduser._id, unfollowUserId: id }));
  };

  if (!loggeduser._id) {
    return <p>Loading...</p>;
  }

  if (!id) {
    return null;
  }

  return (
    <div className="">
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
              <Image
                src={userDetails.profile_picture}
                zoomSrc={userDetails.profile_picture}
                alt="Profile"
                className="profile-pic rounded-circle overflow-hidden"
                width="100"
                height="100"
                preview
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
            {loggeduser.following.includes(userDetails._id) ? (
              <button
                className="btn btn-sm btn-danger p-1 w-100"
                onClick={handleUnfollow}
                disabled={loadingState.unfollow}
              >
                {loadingState.unfollow ? "Unfollowing..." : "Unfollow"}
              </button>
            ) : (
              <button
                className="theme-bg p-1 w-100"
                onClick={handleFollow}
                disabled={loadingState.follow}
              >
                {loadingState.follow ? "Following..." : "Follow"}
              </button>
            )}
          </div>
        </>
      ) : (
        <p>User not found</p>
      )}
    </div>
  );
};

export default UserProfile;
