import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";

const DEFAULT_AVATAR = "/default-avatar.png";

const OtherUserList = ({ userData }) => {
    
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    const handleShowUserProfile = () => {
    
    };
    
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `http://localhost:5000/api/auth/other-users?userId=${userData._id}`
            );
            if (response.ok) {
                const { users } = await response.json();
                setUsers(users);
            } else {
                throw new Error("Failed to fetch users");
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [userData?._id]);

    useEffect(() => {
        if (userData?._id) fetchUsers();
    }, [userData?._id, fetchUsers]);

    const handleAction = async (url, payload, userId, isFollow) => {
        setActionLoading(userId);
        setError(null);
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok)
                throw new Error(`Failed to ${isFollow ? "follow" : "unfollow"} user`);

            setUsers((prevUsers) =>
                prevUsers.map((user) =>
                    user._id === userId ? { ...user, isFollowing: isFollow } : user
                )
            );
        } catch (error) {
            setError(error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleFollow = (followUserId) =>
        handleAction(
            `http://localhost:5000/api/auth/follow`,
            { userId: userData._id, followUserId },
            followUserId,
            true
        );

    const handleUnfollow = (unfollowUserId) =>
        handleAction(
            `http://localhost:5000/api/auth/unfollow`,
            { userId: userData._id, unfollowUserId },
            unfollowUserId,
            false
        );

    if (!userData || !userData._id) {
        return (
            <div className="w-25 h-100 p-3 d-flex flex-column gap-3">
                <h3 className="pacifico-regular bordershadow p-3 rounded text-center theme-bg">
                    Social Square
                </h3>
                <div className="p-3 bordershadow rounded">
                    <h5>Other Users</h5>
                    <p>Loading user data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-25 h-100 p-3 d-flex flex-column gap-3">
            <h3 className="pacifico-regular bordershadow p-3 rounded text-center theme-bg">
                Social Square
            </h3>
            <button onClick={handleShowUserProfile}>Show User Profile</button>
   
            <div className="p-3 bordershadow rounded">
                <h5>Other Users</h5>
                {loading ? (
                    <p>Loading...</p>
                ) : error ? (
                    <p className="text-danger">{error}</p>
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
                                            src={user.profile_picture || DEFAULT_AVATAR}
                                            className="logo"
                                            alt={user.fullname || "User Avatar"}
                                        />
                                    </div>
                                    <h6>{user.fullname || "Unknown User"}</h6>
                                </div>
                                <button
                                    className={`btn ${
                                        user.isFollowing ? "btn-danger" : "btn-primary"
                                    } btn-sm py-1 px-2`}
                                    onClick={() =>
                                        user.isFollowing
                                            ? handleUnfollow(user._id)
                                            : handleFollow(user._id)
                                    }
                                    disabled={actionLoading === user._id}
                                    title={
                                        user.isFollowing
                                            ? "Unfollow this user"
                                            : "Follow this user"
                                    }
                                    aria-label={
                                        user.isFollowing
                                            ? "Unfollow user"
                                            : "Follow user"
                                    }
                                >
                                    {actionLoading === user._id
                                        ? "Processing..."
                                        : user.isFollowing
                                        ? "Unfollow"
                                        : "Follow"}
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
