import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

const OtherUserList = ({ userData }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

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

        if (userData._id) {
            fetchUsers();
        }
    }, [userData._id]);

    const handleAction = async (url, payload, userId, isFollow) => {
        setActionLoading(userId);
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setUsers((prevUsers) =>
                    prevUsers.map((user) =>
                        user._id === userId ? { ...user, isFollowing: isFollow } : user
                    )
                );
            } else {
                console.error(`Failed to ${isFollow ? "follow" : "unfollow"} user`);
            }
        } catch (error) {
            console.error(`Error during ${isFollow ? "follow" : "unfollow"} operation:`, error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleFollow = (followUserId) =>
        handleAction(`${process.env.NEXT_PUBLIC_API_URL}/auth/follow`, { userId: userData._id, followUserId }, followUserId, true);

    const handleUnfollow = (unfollowUserId) =>
        handleAction(`${process.env.NEXT_PUBLIC_API_URL}/auth/unfollow`, { userId: userData._id, unfollowUserId }, unfollowUserId, false);

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
                                            alt={user.fullname || "User Avatar"}
                                        />
                                    </div>
                                    <h6>{user.fullname || "Unknown User"}</h6>
                                </div>
                                <button
                                    className={`btn ${user.isFollowing ? "btn-danger" : "btn-primary"} py-1 px-2`}
                                    onClick={() =>
                                        user.isFollowing ? handleUnfollow(user._id) : handleFollow(user._id)
                                    }
                                    disabled={actionLoading === user._id}
                                    aria-label={user.isFollowing ? "Unfollow user" : "Follow user"}
                                >
                                    {actionLoading === user._id ? "Processing..." : user.isFollowing ? "Unfollow" : "Follow"}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

OtherUserList.propTypes = {
    userData: PropTypes.shape({
        _id: PropTypes.string.isRequired,
    }).isRequired,
};

export default OtherUserList;
