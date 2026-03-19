// react
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

// components
import EditProfile from './EditProfile';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from "./FollowFollowingList";
import { socket } from '../../socket'; // Assume this is your socket connection file

// ui
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { resetState } from '../../store/slices/userSlice';

const Profile = () => {
  const [editvisible, setEditVisible] = useState(false);
  const [activesessionsvisible, setActiveSessionsVisible] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { loggeduser, updateusersuccess, error } = useSelector((state) => state.users);

  useEffect(() => {
    if (updateusersuccess) {
      toast.success(updateusersuccess);
    }
    if (error.updateuser) {
      toast.error(error.updateuser);
    }
  }, [updateusersuccess, error]);

  const handleLogout = () => {
    confirmDialog({
      message: 'Are you sure you want to logout?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      defaultFocus: 'accept',
      acceptClassName: 'p-button-danger',
      accept: () => {
        // Clear session storage and Redux state

        localStorage.removeItem('socketId');
        localStorage.removeItem('token');
        sessionStorage.removeItem('hasReloaded');

        dispatch(resetState()); // Reset Redux store

        toast.error('You have been logged out.');

        if (socket.connected) {
          // Emit logoutUser event
          const userId = loggeduser?._id; // Assuming loggeduser? contains the user's ID
          socket.emit('logoutUser', userId);
        }
        // Delay navigation to ensure cleanup
        setTimeout(() => navigate('/login'), 500);
      },
      reject: () => {
        toast.error('Logout canceled.');
      }
    });
  };

  if (!loggeduser) {
    return <>Loading...</>
  }

  return (
    <>
      <div className={`profile-container bg-white gap-1 pc-show`}>
        <div className="bordershadow p-3 rounded bg-white flex flex-column gap-1">

          <div className="flex py-4 items-center justify-center text-center flex-col gap-1">
            <div className="profile-pic-container ">
              <Image
                src={loggeduser?.profile_picture}
                zoomSrc={loggeduser?.profile_picture}
                alt="Profile"
                className="profile-pic rounded-full overflow-hidden"
                preview
                width="100" height="100"
              />
            </div>
            <h3 className="m-0 pacifico-regular">{loggeduser?.fullname}</h3>
          </div>
          {/* 
          <div className="text-center">
            <p>{loggeduser?.bio}</p>
          </div> */}

          <div className="flex justify-around border-y py-4">
            <div label="Show"
              className="text-center"
              onClick={() => setShowFollowersList(true)}
            >

              <h6 className="m-0 p-0 nosifer-regular font-bold">
                {loggeduser?.followers?.length || 0}
              </h6>
              <span className='text-sm text-gray-500 font-medium'>Followers</span>
            </div>

            <div className="text-center"
              label="Show"
              onClick={() => setShowFollowingList(true)}
            >
              <h6 className="m-0 p-0 nosifer-regular font-bold">
                {loggeduser?.following?.length}
              </h6>
              <span className='text-sm text-gray-500 font-medium'>Following</span>
            </div>
          </div>

          <div className="flex justify-center gap-2 py-4 w-100">
            <button
              className="btn bg-[#808bf5] border-0 rounded-xl text-white w-80 font-medium"
              onClick={() => setEditVisible(true)}
            >
              Edit Profile
            </button>

            <button
              className="btn bg-[#808bf5] border-0 rounded-xl text-white w-80 font-medium"
              onClick={() => setActiveSessionsVisible(true)}
            >
              Active Sessions
            </button>
            <button onClick={handleLogout} className="btn border border-gray-500 rounded-xl w-10">
              <i className="pi pi-sign-out"></i>
            </button>
          </div>
          {false ?
            <button className="btn btn-sm btn-outline-dark mt-1">close</button>
            :
            <></>
          }
        </div>

        <Dialog header="Update your Profile" visible={activesessionsvisible} position="right" style={{ width: "340px", height: "100vh" }} onHide={() => setActiveSessionsVisible(false)} >
          <ActiveSessions />
        </Dialog>

        <Dialog header="Update your Profile" visible={editvisible} position="right" style={{ width: "340px", height: "100vh" }} onHide={() => setEditVisible(false)} >
          <EditProfile users={loggeduser} closeSidebar={() => setEditVisible(false)} />
        </Dialog>

      </div>
      <ConfirmDialog />

      <Dialog header="Followers" visible={showFollowersList} style={{ width: '340px', height: "100vh" }} onHide={() => { if (!showFollowersList) return; setShowFollowersList(false); }}>
        <FollowFollowingList
          isfollowing={false}
          ids={loggeduser?.followers}
        />
      </Dialog>

      <Toaster />
      <Dialog header="Following" visible={showFollowingList} style={{ width: '340px', height: "100vh" }} onHide={() => { if (!showFollowingList) return; setShowFollowingList(false); }}>
        <FollowFollowingList
          isfollowing={true}
          ids={loggeduser?.following}
        />
      </Dialog>
    </>
  );
};

export default Profile;
