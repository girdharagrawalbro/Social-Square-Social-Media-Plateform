import React, { useEffect, useState } from "react";

const FollowingList = ({ userData }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/auth/view?userId=${userData._id}`);
        if (response.ok) {
          const { users } = await response.json();
          setUsers(users);
        } else {
          console.error("Failed to fetch users");
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userData._id) { // Fetch only if userData._id is available
      fetchUsers();
    }
  }, [userData._id]);


  return (
    <div className="w-25 h-100 p-3 d-flex flex-column gap-3">
      <h3 className="pacifico-regular bordershadow p-3 rounded text-center theme-bg">
        Social Square
      </h3>
      <div className="p-3 bordershadow rounded">
        <h5>Other Users</h5>
        {loading ? (
          <p>Loading...</p>
        ) : users.length === 0 ? (
          <p>No other users found.</p>
        ) : (
          <div className="d-flex mt-3 flex-column gap-2">
            {users.map((user) => (
              <div
                key={user._id}
                className="friend-item d-flex align-items-center justify-content-between"
              >
                <div className="d-flex align-items-center gap-2">
                  <div className="friend-img">
                    <img
                      src={user.profile_picture || "/default-avatar.png"}
                      className="logo"
                      alt={user.fullname}
                    />
                  </div>
                  <h6>{user.fullname}</h6>
                </div>
                <button className="theme-bg py-1 px-2">Follow</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowingList;
