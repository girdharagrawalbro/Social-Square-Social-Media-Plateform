import React from 'react'

const FollowingList = () => {
  return (
    <div className='w-25 h-100 p-3 d-flex flex-column gap-3'>
      <h3 className="pacifico-regular bordershadow p-3 rounded text-center">Social Square</h3>
      <div className='p-3 bordershadow p-3 rounded'>
        <h5>Other Users</h5>
        <div className="d-flex p-3 flex-column gap-2">
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
            <button className="btn btn-primary btn-sm">Follow</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FollowingList