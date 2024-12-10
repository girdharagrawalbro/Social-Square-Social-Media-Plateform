import React, { useState, useEffect } from "react";

const FollowersList = ({ ids, onClose }) => {
    const [followers, setFollowers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFollowersDetails = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/auth/users/details", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ids }), // Pass the array of IDs
                });
                const data = await response.json();
                setFollowers(data.users); // Assume the API returns an array of user objects
                setLoading(false);
            } catch (error) {
                console.error("Error fetching followers:", error);
                setLoading(false);
            }
        };

        fetchFollowersDetails();
    }, [ids]);

    return (
        <div className="followers-list popups bordershadow p-3 rounded">
            <div className="header d-flex justify-content-between align-items-center">
                <h4>Followers</h4>
                <button onClick={onClose} className="btn btn-outline-dark btn-sm">X</button>
            </div>
            <div className="list mt-2 ">
                {loading ? (
                    <p>Loading...</p>
                ) : followers.length > 0 ? (
                    followers.map((user) => (
                        <div key={user._id} className="follower-item mt-2 d-flex    justify-content-between align-items-center">
                            <div className="d-flex justify-content-center d-flex gap-2 align-items-center">
                            <img src={user.profile_picture} alt="Profile" className="logo" />
                            <h6>{user.fullname}</h6>
                            </div>
                            <div>
                                <button className="btn btn-danger btn-sm">remove</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No followers found.</p>
                )}
            </div>
        </div>
    );
};

export default FollowersList;
