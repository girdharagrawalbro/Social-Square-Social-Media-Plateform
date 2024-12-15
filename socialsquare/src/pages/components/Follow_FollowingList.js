import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { followUser, unfollowUser, fetchLoggedUser, fetchOtherUsers } from "../../store/slices/userSlice";

const Follow_FollowingList = ({ isfollowing }) => {
    const dispatch = useDispatch();
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const { loggeduser } = useSelector((state) => state.users);
    const ids = loggeduser.following;

    useEffect(() => {
        const fetchUsersDetails = async () => {
            try {
                const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/auth/users/details", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ids }), // Pass the array of IDs
                });
                const data = await response.json();
                setFollowing(data.users); // Assume the API returns an array of user objects
                setLoading(false);
            } catch (error) {
                console.error("Error fetching following:", error);
                setLoading(false);
            }
        };

        fetchUsersDetails();
    }, [ids]);


    const handleUnfollow = async (unfollowUserId) => {
        setActionLoading(unfollowUserId);
        try {
            await dispatch(unfollowUser({ loggedUserId: loggeduser._id, unfollowUserId })).unwrap();
            // Optimistically update the UI
            setFollowing((prevFollowers) =>
                prevFollowers.map((user) =>
                    user._id === unfollowUserId ? { ...user, isFollowing: false } : user
                )
            );
        } catch (err) {
            setError("Failed to unfollow the user.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="">
            <div className="list mt-2 ">
                {loading ? (
                    <p>Loading...</p>
                ) : following.length > 0 ? (
                    following.map((user) => (
                        <div
                            key={user._id}
                            className="follower-item mt-2 d-flex justify-content-between align-items-center"
                        >
                            <div className="d-flex justify-content-center d-flex gap-2 align-items-center">
                                <img
                                    src={user.profile_picture}
                                    alt="Profile"
                                    className="logo"
                                />
                                <h6>{user.fullname}</h6>
                            </div>
                            <div>
                                {isfollowing ? (
                                    <button
                                        className={`btn ${loggeduser.following.includes(user._id)
                                            ? "btn-danger"
                                            : "btn-primary"
                                            } btn-sm py-1 px-2`}
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent triggering the parent div click
                                            handleUnfollow(user._id)
                                        }}
                                        disabled={actionLoading === user._id}

                                    >
                                        {actionLoading === user._id
                                            ? "Processing..."
                                            : loggeduser.following.includes(user._id)
                                                ? "Unfollow"
                                                : "Follow"}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ))
                ) : (
                    <p>No following found.</p>
                )}
            </div>
        </div>
    );
};

export default Follow_FollowingList;
