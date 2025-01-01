import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { followUser, unfollowUser } from "../../store/slices/userSlice";
import { Dialog } from "primereact/dialog";
import ChatPanel from "./ChatPanel";
import { createConversation } from '../../store/slices/conversationSlice';

const FollowFollowingList = ({ isfollowing, ids }) => {
    const dispatch = useDispatch();
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const [visible, setVisible] = useState(false);
    const [selectedId, setSelectedId] = useState(null); // Stores the entire user object
    const [selectedName, setSelectedName] = useState(null); // Stores the entire user object
    const [selectedPic, setSelectedPic] = useState(null); // Stores the entire user object

    const { loggeduser } = useSelector((state) => state.users);

    useEffect(() => {
        const fetchUsersDetails = async () => {
            try {
                const response = await fetch(
                    "http://localhost:5000/api/auth/users/details",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ ids }),
                    }
                );
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

    const selectChat = ({ id, name, pic }) => {
        setSelectedId(id);
        setSelectedName(name);
        setSelectedPic(pic)
        setVisible(true);
        dispatch(createConversation({
            participants: [{
                userId: id,
                fullname: name,
                profilePicture: pic,
            }, {
                userId: loggeduser._id,
                fullname: loggeduser.fullname,
                profilePicture: loggeduser.profile_picture
            }]
        }));
    };

    const headerElement = (
        <div className="d-flex align-items-center gap-2">
            <img src={selectedPic} className="logo" />
            <span className="font-bold white-space-nowrap">{selectedName}</span>
        </div>
    );

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
        <>
            <div className="">
                <div className="list mt-2">
                    {loading ? (
                        <p>Loading...</p>
                    ) : following.length > 0 ? (
                        following.map((user) => (
                            <div
                                key={user._id}
                                className="follower-item mt-2 d-flex justify-content-between align-items-center"
                            >
                                <div className="d-flex gap-2 align-items-center">
                                    <img
                                        src={user.profile_picture}
                                        alt="Profile"
                                        className="logo"
                                    />

                                    <h6 className="m-0 p-0">{user.fullname}</h6>
                                </div>
                                <div className="d-flex gap-1">
                                    {isfollowing && (
                                        <button
                                            className={`btn ${loggeduser.following.includes(user._id)
                                                ? "btn-danger"
                                                : "btn-primary"
                                                } btn-sm py-1 px-2`}
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent triggering the parent div click
                                                handleUnfollow(user._id);
                                            }}
                                            disabled={actionLoading === user._id}
                                        >
                                            {actionLoading === user._id
                                                ? "Processing..."
                                                : loggeduser.following.includes(user._id)
                                                    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                                                        <path d="M5.18007 15.2964C3.92249 16.0335 0.625213 17.5386 2.63348 19.422C3.6145 20.342 4.7071 21 6.08077 21H13.9192C15.2929 21 16.3855 20.342 17.3665 19.422C19.3748 17.5386 16.0775 16.0335 14.8199 15.2964C11.8709 13.5679 8.12906 13.5679 5.18007 15.2964Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                                        <path d="M14 7C14 9.20914 12.2091 11 10 11C7.79086 11 6 9.20914 6 7C6 4.79086 7.79086 3 10 3C12.2091 3 14 4.79086 14 7Z" stroke="currentColor" stroke-width="1.5" />
                                                        <path d="M22 4.5L19.5 7M19.5 7L17 9.5M19.5 7L22 9.5M19.5 7L17 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                                    </svg>
                                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                                                        <path d="M5.18007 15.2964C3.92249 16.0335 0.625213 17.5386 2.63348 19.422C3.6145 20.342 4.7071 21 6.08077 21H13.9192C15.2929 21 16.3855 20.342 17.3665 19.422C19.3748 17.5386 16.0775 16.0335 14.8199 15.2964C11.8709 13.5679 8.12906 13.5679 5.18007 15.2964Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                                        <path d="M14 7C14 9.20914 12.2091 11 10 11C7.79086 11 6 9.20914 6 7C6 4.79086 7.79086 3 10 3C12.2091 3 14 4.79086 14 7Z" stroke="currentColor" stroke-width="1.5" />
                                                        <path d="M19.5 4V9M22 6.5L17 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                                    </svg>}
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => selectChat({ id: user._id, name: user.fullname, pic: user.profile_picture })}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="#ffffff" fill="none">
                                            <path d="M8.5 14.5H15.5M8.5 9.5H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                            <path d="M14.1706 20.8905C18.3536 20.6125 21.6856 17.2332 21.9598 12.9909C22.0134 12.1607 22.0134 11.3009 21.9598 10.4707C21.6856 6.22838 18.3536 2.84913 14.1706 2.57107C12.7435 2.47621 11.2536 2.47641 9.8294 2.57107C5.64639 2.84913 2.31441 6.22838 2.04024 10.4707C1.98659 11.3009 1.98659 12.1607 2.04024 12.9909C2.1401 14.536 2.82343 15.9666 3.62791 17.1746C4.09501 18.0203 3.78674 19.0758 3.30021 19.9978C2.94941 20.6626 2.77401 20.995 2.91484 21.2351C3.05568 21.4752 3.37026 21.4829 3.99943 21.4982C5.24367 21.5285 6.08268 21.1757 6.74868 20.6846C7.1264 20.4061 7.31527 20.2668 7.44544 20.2508C7.5756 20.2348 7.83177 20.3403 8.34401 20.5513C8.8044 20.7409 9.33896 20.8579 9.8294 20.8905C11.2536 20.9852 12.7435 20.9854 14.1706 20.8905Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>No following found.</p>
                    )}
                </div>
            </div>
            <Dialog
                header={headerElement}
                visible={visible}
                style={{ width: "50vw", height: "100vh" }}
                onHide={() => setVisible(false)}
            >
                {selectedId && (
                    <ChatPanel
                        participantId={selectedId}
                    />
                )}
            </Dialog>
        </>
    );
};

export default FollowFollowingList;
