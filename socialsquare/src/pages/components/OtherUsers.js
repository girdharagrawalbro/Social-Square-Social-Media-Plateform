// links of react 
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';

// components
import Loader from './Loader';
import UserProfile from "./UserProfile";

// ui
import { Dialog } from 'primereact/dialog';

// redux
import { followUser, fetchOtherUsers } from '../../store/slices/userSlice';

const OtherUsers = () => {
    const dispatch = useDispatch();
    const [ setUsers] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);
    const { loggeduser, otherusers, loading } = useSelector((state) => state.users);

    const [isVisible, setVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null); // State to store selected otherusers ID



    useEffect(() => {
        if (loggeduser?._id) {
            dispatch(fetchOtherUsers(loggeduser._id));
        }
    }, [dispatch, loggeduser?._id]);

    const handleUserClick = (userId) => {
        setSelectedUserId(userId); // Set selected otherusers ID
        setVisible(true); // Open the dialog
    };


    const handleFollow = async (followUserId) => {
        setActionLoading(followUserId);
        try {
            await dispatch(followUser({ loggedUserId: loggeduser._id, followUserId })).unwrap();
            setUsers((prevUsers) =>
                prevUsers.map((u) =>
                    u._id === followUserId ? { ...u, isFollowing: true } : u
                )
            );
        } catch (err) {
            setError("Failed to follow otherusers.");
        } finally {
            setActionLoading(null);
        }
    };


    useEffect(() => {
        if (otherusers?.otherusers) {
            setUsers(otherusers.otherusers);
        }
    }, [otherusers,setUsers]);

    return (
        <div className="d-flex flex-column gap-3">
            <div className={`p-3 bordershadow bg-white rounded `}>
                <div className="d-flex justify-content-between">
                    <h5>Suggested Users</h5>
                </div>
                {
                    loading.otherusers ?
                        <Loader />
                        : error ?  <p className="text-danger">{error}</p> :
                            otherusers.length === 0 ? (
                                <p>No other users found.</p>
                            ) : (
                                <div className="d-flex mt-3 flex-column gap-2">
                                    {otherusers.map((u) => (
                                        <div
                                            key={u._id}
                                            className="btn border-0 friend-item d-flex align-items-center justify-content-between"
                                            onClick={() => handleUserClick(u._id)} // Pass otherusers ID
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="friend-img">
                                                    <img
                                                        src={u?.profile_picture}
                                                        className="logo"
                                                        alt={u.fullname}
                                                    />
                                                </div>
                                                <h6>{u.fullname || "Unknown User"}</h6>
                                            </div>
                                            <button
                                                className={`btn btn-primary btn-sm py-1 px-2`}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent triggering the parent div click
                                                    handleFollow(u._id);
                                                }}
                                                disabled={actionLoading === u._id}

                                            >
                                                {actionLoading === u._id
                                                    ? "Processing..."
                                                    : "Follow"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
            </div>
            <Dialog
                header="User Profile"
                visible={isVisible}
                style={{ width: '340px' , height : "400px"}}
                onHide={() => setVisible(false)}
            >
                <UserProfile id={selectedUserId} /> {/* Pass selected otherusers ID */}
            </Dialog>
        </div>
    );
};

export default OtherUsers;
