import React, { useEffect } from "react";
import Search from "./Search";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Authnav from "./Authnav";
import NotificationBell from "./ui/NotificationBell";
import { useDarkMode } from "../../context/DarkModeContext";
import { requestNotificationPermission } from "../../utils/pushNotifications";

const Navbar = () => {
  const { loggeduser } = useSelector(state => state.users);
  const { isDark, toggle } = useDarkMode();
  const token = localStorage.getItem('token');

  // Request push notification permission on first login
  useEffect(() => {
    if (token && loggeduser) {
      requestNotificationPermission();
    }
  }, [token, loggeduser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('socketId');
    window.location.href = '/landing';
  };

  return (
    <div className={`sticky top-0 z-50 shadow-md border-b max-w-8xl mx-auto flex items-center justify-between px-4 py-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 w-25">
        <Link to="/landing" className={`no-underline flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`} title="Go to Home">
          <i className="pi pi-home text-2xl"></i>
          <h1 className="font-pacifico text-2xl m-0">Social Square</h1>
        </Link>
      </div>

      <div className="flex-1 mx-4 relative w-50">
        {token ? <Search /> : <Authnav />}
      </div>

      <div className="flex items-center justify-end gap-3 w-25">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {token ? (
          <>
            <NotificationBell userId={loggeduser?._id} />
            <img
              src={loggeduser?.profile_picture || "default-profile.png"}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover cursor-pointer"
            />
            <button onClick={handleLogout} className={`border-0 bg-transparent cursor-pointer hover:text-red-500 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="Logout">
              <i className="pi pi-sign-out"></i>
            </button>
          </>
        ) : (
          <Link to="/login" className="bg-[#808bf5] text-white px-4 py-1 rounded no-underline">Login</Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;