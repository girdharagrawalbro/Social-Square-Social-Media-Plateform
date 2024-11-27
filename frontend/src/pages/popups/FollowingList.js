import React, { useState, useEffect } from "react";

const FollowingList = ({ ids, onClose }) => {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="following-list popups bordershadow p-3 rounded">
      <div className="header d-flex justify-content-between align-items-center">
        <h4>Following</h4>
        <button onClick={onClose} className="btn btn-outline-dark btn-sm">X</button>
      </div>
      <div className="list mt-2">
        {loading ? (
          <p>Loading...</p>
        ) : following.length > 0 ? (
          following.map((user) => (
            <div key={user._id} className="following-item d-flex gap-2 align-items-center">
              <img src={user.profile_picture} alt="Profile" className="logo" />
              <h6>{user.fullname}</h6>
            </div>
          ))
        ) : (
          <p>No following users found.</p>
        )}
      </div>
    </div>
  );
};

export default FollowingList;
