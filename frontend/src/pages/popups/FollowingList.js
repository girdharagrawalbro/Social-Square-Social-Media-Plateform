import React, { useState, useEffect } from "react";
import { useDispatch } from 'react-redux';
import { showComponent } from '../../store/slices/visibilitySlice';


const FollowingList = ({ ids, onClose }) => {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchFollowingDetails = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/auth/users/details", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids }),
        });
        const data = await response.json();
        setFollowing(data.users);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching following:", error);
        setLoading(false);
      }
    };

    fetchFollowingDetails();
  }, [ids]);



  const handleShow = (id) => {
    dispatch(showComponent(id));
  }
  return (
    <>
      {
        loading ? (
          <p> Loading...</p >
        ) : following.length > 0 ? (
          following.map((user) => (

            <div key={user._id} className="friend-item d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2" onClick={() => handleShow(user._id)}>
              <img
                  src={user.profile_picture}
                  className="logo"
                  alt="logo"
                />
                <h6>{user.fullname}</h6>
              </div>
              <div className="d-flex gap-2">
                <button className="theme-bg px-2 py-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                    <path d="M22 11.5667C22 16.8499 17.5222 21.1334 12 21.1334C11.3507 21.1343 10.7032 21.0742 10.0654 20.9545C9.60633 20.8682 9.37678 20.8251 9.21653 20.8496C9.05627 20.8741 8.82918 20.9948 8.37499 21.2364C7.09014 21.9197 5.59195 22.161 4.15111 21.893C4.69874 21.2194 5.07275 20.4112 5.23778 19.5448C5.33778 19.0148 5.09 18.5 4.71889 18.1231C3.03333 16.4115 2 14.1051 2 11.5667C2 6.28357 6.47778 2 12 2C17.5222 2 22 6.28357 22 11.5667Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M11.9955 12H12.0045M15.991 12H16M8 12H8.00897" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button className="bg-danger border-0 rounded px-2 py-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                    <path d="M19.0005 4.99988L5.00049 18.9999M5.00049 4.99988L19.0005 18.9999" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

          ))
        ) : (
          <p>No following users found.</p>
        )}
    </>
  );
};
export default FollowingList;
