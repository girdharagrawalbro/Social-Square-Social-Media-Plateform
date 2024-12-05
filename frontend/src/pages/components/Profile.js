import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import EditProfile from './EditProfile';
import { AuthContext } from '../../context/AuthContext';
import FollowingList from "../popups/FollowingList";
import FollowersList from "../popups/FollowersList";


const Profile = ({ userData }) => {
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { fetchUserData } = useContext(AuthContext);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditSubmit = (updatedData) => {
    setIsEditing(false);
    fetchUserData();
  };

  const handleLogout = () => {
    alert('You are logging out...');
    localStorage.removeItem('token');
    navigate('/login'); // Redirect to login page
    window.location.reload(); // Reload the page to clear any cached data
  };

  // Loading fallback
  if (!userData) {
    return (
      <div className="loading-container d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="profile-container w-25 p-3 h-100 gap-1">
        {!isEditing ? (
          <>
            <div className="bordershadow p-3 rounded d-flex flex-column gap-1">
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
                    src={userData.profile_picture}
                    alt="Profile"
                    className="profile-pic rounded-circle"
                  />
                </div>
                <h3 className="m-0 pacifico-regular">{userData.fullname}</h3>
              </div>

              <div className="text-center">
                <p>{userData.bio}</p>
              </div>

              <div className="d-flex justify-content-around">
                <div
                  className="text-center"
                  onClick={() => setShowFollowersList(true)}
                >
                  <h6 className="m-0 p-0 nosifer-regular">
                    {userData.followers.length}
                  </h6>
                  <h6>Followers</h6>
                </div>

                <div className="text-center">
                  <h6 className="m-0 p-0 nosifer-regular">
                    {userData.following.length}
                  </h6>
                  <h6>Following</h6>
                </div>
              </div>

              <div className="d-flex justify-content-center gap-2">
                <button
                  className="theme-bg border-0 rounded w-100"
                  onClick={handleEditClick}
                >
                  Edit
                </button>
                <button
                  className="btn btn-light btn-sm w-100"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
            <input
              type="search"
              className="border py-1 px-2 mt-3 rounded bg-white w-100"
              placeholder="Search your Friends"
            />
            <div className="mt-3 bordershadow p-3 rounded">
              <h5>Your Friends</h5>
              <div className="friends-list d-flex flex-column gap-3 mt-3">
                <FollowingList ids={userData.following} />
              </div>
            </div>
          </>
        ) : (
          <EditProfile userData={userData} onSubmit={handleEditSubmit} />
        )}
      </div>

      {showFollowersList && (
        <FollowersList
          ids={userData.followers}
          onClose={() => setShowFollowersList(false)}
        />
      )}
    </>
  );
};

export default Profile;
