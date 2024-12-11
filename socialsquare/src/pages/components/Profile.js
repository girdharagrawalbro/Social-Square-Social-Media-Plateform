import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import EditProfile from './EditProfile';
import { useDispatch, useSelector } from 'react-redux';
import { AuthContext } from '../../context/AuthContext';
import FollowersList from "../popups/FollowersList";
import { hideComponent3 } from "../../store/slices/visibilitySlice3";
import Loader from './Loader'


const Profile = () => {
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { fetchUserData } = useContext(AuthContext);
  const dispatch = useDispatch();

  const { isVisible3 } = useSelector((state) => state.visibility3);
  const { users} = useSelector((state) => state.users);


  const handleEditClick = () => {
    setIsEditing(true);
  };
  const handleClose3 = () => {
    dispatch(hideComponent3())
  }


  const handleEditSubmit = (updatedData) => {
    setIsEditing(false);
    fetchUserData();
  };

  const handleLogout = () => {
    alert('You are logging out...');
    localStorage.removeItem('token');
    sessionStorage.removeItem('hasReloaded'); // Set reload flag

    setTimeout(() => navigate('/'), 1500); // Redirect to login page
    window.location.reload(); // Reload the page to clear any cached data
  };


  return (
    <>
      <div className={`profile-container pc  bg-white gap-1 ${isVisible3 ? "pc-show" : ``}`}>
        {!isEditing ? (
          <>
            <div className="bordershadow p-3 rounded bg-white d-flex flex-column gap-1">
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
                    src={users.profile_picture}
                    alt="Profile"
                    className="profile-pic rounded-circle"
                  />
                </div>
                <h3 className="m-0 pacifico-regular">{users.fullname}</h3>
              </div>

              <div className="text-center">
                <p>{users.bio}</p>
              </div>

              <div className="d-flex justify-content-around">
                <div
                  className="text-center"
                  onClick={() => setShowFollowersList(true)}
                >
                  <h6 className="m-0 p-0 nosifer-regular">
                    {users.followers.length}
                  </h6>
                  <h6>Followers</h6>
                </div>

                <div className="text-center">
                  <h6 className="m-0 p-0 nosifer-regular">
                    {users.following.length}
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
              {isVisible3 ?
                <button onClick={() => handleClose3()} className="btn btn-sm btn-outline-dark mt-1">close</button>
                :
                <></>
              }
            </div>
          </>
        ) : (
          <EditProfile users={users} onSubmit={handleEditSubmit} />
        )}
      </div>

      {showFollowersList && (
        <FollowersList
          ids={users.followers}
          onClose={() => setShowFollowersList(false)}
        />
      )}
    </>
  );
};

export default Profile;
