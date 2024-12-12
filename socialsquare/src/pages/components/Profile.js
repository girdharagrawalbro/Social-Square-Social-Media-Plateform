// react
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AuthContext } from '../../context/AuthContext';

// components
import EditProfile from './EditProfile';
import Follow_FollowingList from "./Follow_FollowingList";
import Loader from './Loader'

// ui
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import { Sidebar } from 'primereact/sidebar';
import { ToastContainer, toast } from 'react-toastify';

const Profile = () => {
  const [visible, setVisible] = useState(false);
  const accept = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('hasReloaded'); // Set reload flag
    setTimeout(() => navigate('/login'), 1500); // Redirect to login page
    toast.info("You have been looged out..")
  }

  const reject = () => {

  }

  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const { fetchUserData } = useContext(AuthContext);
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


  const handleEditSubmit = () => {
    fetchUserData();
  };

  const handleLogout = () => {
    confirmDialog({
      message: 'Are you really want to Logout?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      defaultFocus: 'accept',
      acceptClassName: 'p-button-danger',
      accept,
      reject
    });
  };


  return (
    <>
      <div className={`profile-container pc  bg-white gap-1 pc-show`}>
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

                <Button onClick={handleLogout} icon="pi pi-times" label="Logout" className="mr-2 btn btn-light btn-sm w-100"></Button>

              </div>
              {false ?
                <button className="btn btn-sm btn-outline-dark mt-1">close</button>
                :
                <></>
              }
            </div>
        
            <Sidebar visible={visible} position="right" onHide={() => setVisible(false)} >
  <EditProfile users={loggeduser} onSubmit={handleEditSubmit} closeSidebar={() => setVisible(false)} />
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
