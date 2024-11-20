import React from 'react';

const Profile = () => {
  return (
    <div className="profile-container w-25 p-3 h-100 gap-3">
      <div className="bordershadow p-3 rounded d-flex flex-column gap-3">
        {/* Top Cover Image */}
        <div>
          <img
            src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
            alt="Cover"
            className="cover-image"
          />
        </div>

        {/* Profile Details */}
        <div className="profile-details d-flex align-items-center justify-content-center text-center flex-column gap-1">

          <div className="profile-pic-container">
            <img
              src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
              alt="Profile"
              className="profile-pic rounded-circle"
            />
          </div>

          <h3 className="m-0 pacifico-regular">Girdhar Agrawal</h3>
        </div>

        {/* Bio */}
        <div className="text-center">
          <p>Hey, I am a UI Designer</p>
        </div>
        <div className="d-flex justify-content-around">
          <div className="text-center">
            <h6 className="m-0 p-0 nosifer-regular">2334</h6>
            <h6>Following</h6>
          </div>
          <div className="text-center">
            <h6 className="m-0 p-0 nosifer-regular">2334</h6>
            <h6>Following</h6>
          </div>
        </div>
      </div>


      {/* Friends List */}
      <div className="mt-4 bordershadow p-3 rounded">
        <h5>Your Friends</h5>
        <div className="friends-list d-flex flex-column gap-3 mt-3">
          {/* Friend 1 */}
          <div className="friend-item d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <div className="friend-img">
                <img
                  src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
                  className="logo"
                  alt=""
                />
              </div>
              <div className="d-flex flex-column gap-0">
                <h6>Vyom Sahu</h6>
              </div>
            </div>
            <button className="btn btn-dark btn-sm">Message</button>
          </div>

          {/* Friend 2 */}
          <div className="friend-item d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <div className="friend-img">
                <img
                  src="https://images.pexels.com/photos/674010/pexels-photo-674010.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"
                  className="logo"
                  alt=""
                />
              </div>
              <div className="d-flex align-items-center">
                <h6>Purnanad Painkra</h6>
              </div>
            </div>
            <button className="btn btn-dark btn-sm">Message</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
