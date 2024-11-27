import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import EditProfile from './EditProfile';
import { AuthContext } from '../../context/AuthContext';

const Profile = ({ userData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate(); // Initialize useNavigate
  const { fetchUserData } = useContext(AuthContext);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditSubmit = (updatedData) => {
    setIsEditing(false);
    fetchUserData();
  };
  const handleLogout = () => {
    alert("You are logging out..  ")
    localStorage.removeItem('token');
    navigate("/login")
  }
  return (
    <>
      <div className="profile-container w-25 p-3 h-100 gap-1">
        {!isEditing ? (
          <>
            <div className="bordershadow p-3 rounded d-flex flex-column gap-1">
              {/* Top Cover Image */}
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
              <div className="text-center ">
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
              <div className="d-flex justify-content-center gap-2">
                <button className="theme-bg border-0 rounded w-100" onClick={handleEditClick}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm w-100" onClick={handleLogout}>Logout</button>
              </div>
            </div>

            <div className="mt-4 bordershadow p-3 rounded">
              <h5>Your Friends</h5>
              <div className="friends-list d-flex flex-column gap-3 mt-3">
                {/* Friend 1 */}
                <div className="friend-item d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <img
                      src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
                      className="logo"
                      alt="logo"
                    />
                    <h6>Vyom Sahu</h6>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="theme-bg px-2 py-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                      <path d="M22 11.5667C22 16.8499 17.5222 21.1334 12 21.1334C11.3507 21.1343 10.7032 21.0742 10.0654 20.9545C9.60633 20.8682 9.37678 20.8251 9.21653 20.8496C9.05627 20.8741 8.82918 20.9948 8.37499 21.2364C7.09014 21.9197 5.59195 22.161 4.15111 21.893C4.69874 21.2194 5.07275 20.4112 5.23778 19.5448C5.33778 19.0148 5.09 18.5 4.71889 18.1231C3.03333 16.4115 2 14.1051 2 11.5667C2 6.28357 6.47778 2 12 2C17.5222 2 22 6.28357 22 11.5667Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                      <path d="M11.9955 12H12.0045M15.991 12H16M8 12H8.00897" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg></button>
                    <button className='bg-danger border-0 rounded px-2 py-1'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                      <path d="M19.0005 4.99988L5.00049 18.9999M5.00049 4.99988L19.0005 18.9999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg></button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EditProfile userData={userData} onSubmit={handleEditSubmit} />
        )}
      </div >
    </>
  );
};

export default Profile;
