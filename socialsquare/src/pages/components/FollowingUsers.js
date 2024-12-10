// Links for react and redux 
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import { useSelector, useDispatch } from 'react-redux';
import FollowingList from "../popups/FollowingList";


const FollowingUsers = () => {
    const dispatch = useDispatch();
    const { users } = useSelector((state) => state.users);

  return (
    <>
                <input
              type="search"
              className="border py-1 px-2 mt-3 rounded bg-white w-100"
              placeholder="Search your Friends"
            />
            <div className="mt-3 bordershadow p-3 rounded">
              <h5>Your Friends</h5>
              <div className="friends-list d-flex flex-column gap-3 mt-3">
                <FollowingList ids={users.following} />
              </div>
            </div>
</>
  )
}

export default FollowingUsers