import React from "react";
import Search from "./Search";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Authnav from "./Authnav";
import NotificationBell from "./ui/NotificationBell";

const Navbar = () => {
  const { loggeduser } = useSelector((state) => state.users);
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('socketId');
    window.location.href = '/landing';
  };

  return (
    <div className="sticky top-0 z-50 bg-white shadow-md border-b max-w-8xl mx-auto flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3 w-25">
        <Link to="/landing" className="no-underline text-gray-800 flex items-center gap-2" title="Go to Home">
          <i className="pi pi-home text-2xl"></i>
          <h1 className="font-pacifico text-2xl m-0">Social Square</h1>
        </Link>
      </div>

      <div className="flex-1 mx-4 relative w-50">
        {token ? <Search /> : <Authnav />}
      </div>

      <div className="flex items-center justify-end gap-4 w-25">
        {token ? (
          <>
            <NotificationBell userId={loggeduser?._id} />

            <img
              src={loggeduser?.profile_picture || "default-profile.png"}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover"
            />
            <button onClick={handleLogout} className="hover:scale-105 hover:text-red-500 transition" title="Logout">
              <i className="pi pi-sign-out"></i>
            </button>
          </>
        ) : (
          <Link to="/login" className="bg-themeStart text-white px-4 py-1 rounded">Login</Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;