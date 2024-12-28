// react
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

// components
import EditProfile from './EditProfile';
import Follow_FollowingList from "./Follow_FollowingList";
import { socket } from '../../socket'; // Assume this is your socket connection file

// ui
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import { Sidebar } from 'primereact/sidebar';
import { ToastContainer, toast } from 'react-toastify';
import { resetState } from '../../store/slices/userSlice';

const Profile = () => {
  const [visible, setVisible] = useState(false);
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

        toast.info('You have been logged out.');
      
        if (socket.connected) {
          // Emit logoutUser event
          const userId = loggeduser?._id; // Assuming loggeduser contains the user's ID
          socket.emit('logoutUser', userId);
        }
        // Delay navigation to ensure cleanup
        setTimeout(() => navigate('/login'), 500);
      },
      reject: () => {
        toast.info('Logout canceled.');
      }
    });
  };

  if (!loggeduser) {
    return <>Loading...</>
  }

  return (
    <>
      <div className={`profile-container bg-white gap-1 pc-show`}>
        <div className="bordershadow p-3 rounded bg-white d-flex flex-column gap-1">
          <div>
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQWdjis-8T0ZC_aBUa_8QAxnkmCuWLQCP5rg&s"
              alt="Cover"
              className="cover-image"
            />
          </div>

          <div className="profile-details d-flex align-items-center justify-content-center text-center flex-column gap-1">
            <div className="profile-pic-container">
              <Image
                src={loggeduser.profile_picture}
                zoomSrc={loggeduser.profile_picture}
                alt="Profile"
                className="profile-pic rounded-circle overflow-hidden"
                preview
                width="100" height="100"
              />
            </div>
            <h3 className="m-0 pacifico-regular">{loggeduser.fullname}</h3>
          </div>

          <div className="text-center">
            <p>{loggeduser.bio}</p>
          </div>

          <div className="d-flex justify-content-around">
            <div label="Show"
              className="text-center"
              onClick={() => setShowFollowersList(true)}
            >

              <h6 className="m-0 p-0 nosifer-regular">
                {loggeduser.followers.length}
              </h6>
              <h6>Followers</h6>
            </div>

            <div className="text-center"
              label="Show"
              onClick={() => setShowFollowingList(true)}
            >
              <h6 className="m-0 p-0 nosifer-regular">
                {loggeduser.following.length}
              </h6>
              <h6>Following</h6>
            </div>
          </div>

          <div className="d-flex justify-content-center gap-2">
            <button
              className="theme-bg border-0 rounded w-100"
              onClick={() => setVisible(true)}
            >
              Edit
            </button>

            <button onClick={handleLogout} className="mr-2 btn btn-light btn-sm w-100">
              Logout
            </button>
          </div>
          {false ?
            <button className="btn btn-sm btn-outline-dark mt-1">close</button>
            :
            <></>
          }
        </div>

        <Sidebar visible={visible} position="right" onHide={() => setVisible(false)} >
          <EditProfile users={loggeduser} closeSidebar={() => setVisible(false)} />
        </Sidebar>

      </div>
      <ConfirmDialog />
      <ToastContainer
        theme="light"
      />
      <Dialog header="Followers" visible={showFollowersList} style={{ width: '25vw' }} onHide={() => { if (!showFollowersList) return; setShowFollowersList(false); }}>
        <Follow_FollowingList
          isfollowing={false}
          ids={loggeduser.followers}
        />
      </Dialog>

      <Dialog header="Following" visible={showFollowingList} style={{ width: '25vw' }} onHide={() => { if (!showFollowingList) return; setShowFollowingList(false); }}>
        <Follow_FollowingList
          isfollowing={true}
          ids={loggeduser.following}
        />
      </Dialog>
    </>
  );
};

export default Profile;
