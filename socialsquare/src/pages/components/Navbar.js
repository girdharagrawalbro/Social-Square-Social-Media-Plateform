import { useState, useEffect, useRef } from "react";
import Search from "./Search";
import useAuthStore, { getToken } from '../../store/zustand/useAuthStore';

import { Link } from "react-router-dom";
import Authnav from "./Authnav";
import NotificationBell from "./ui/NotificationBell";
import { useDarkMode } from '../../context/DarkModeContext';
import { requestNotificationPermission } from '../../utils/pushNotifications';
import NewPost from "./Newpost";
import { Dialog } from "primereact/dialog";


const Navbar = () => {
  const loggeduser = useAuthStore(s => s.user);
  const isAdminUser = Boolean(loggeduser?.isAdmin || loggeduser?.role === 'admin');
  const isAuthenticated = Boolean(loggeduser?._id || getToken());
  const { isDark, toggle } = useDarkMode();
  const [newpostVisible, setnewpostVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef(null);

  // Request push notification permission on first login
  useEffect(() => {
    if (isAuthenticated && loggeduser) {
      requestNotificationPermission();
    }
  }, [isAuthenticated, loggeduser]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mobileMenuOpen]);



  return (
    <div ref={mobileMenuRef} className={`sticky top-0 z-50 md:relative md:top-auto w-full shadow-md border-b max-w-8xl mx-auto flex items-center justify-between px-4 py-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 w-25">
        <Link to="/landing">
          <i className="pi pi-home text-2xl text-black"></i>
        </Link>
        <Link to="/" className={`no-underline flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`} title="Go to Home">
          <h1 className="font-pacifico text-2xl m-0">Social Square</h1>
        </Link>
      </div>

      <div className="hidden md:block flex-1 mx-4 relative w-50">
        {isAuthenticated ? <Search /> : <Authnav />}
      </div>

      <div className="hidden md:flex items-center justify-end gap-3 w-25">
         {isAuthenticated ? (
        <button onClick={() => setnewpostVisible(true)} className={`border-0 rounded-full w-9 h-9 bg-primary text-white flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}>
          +</button>
         ) : null}

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        > 
          {isDark ? '☀️' : '🌙'}
        </button>

        {isAuthenticated ? (
          <>
            <NotificationBell userId={loggeduser?._id} />
            {isAdminUser && (
              <Link to="/admin" className={`border-0 rounded-lg px-2 py-1 text-xs font-semibold no-underline ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`} title="Admin Dashboard">
                ⚙️
              </Link>

              
            )}
            <img
              src={loggeduser?.profile_picture || "default-profile.png"}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover cursor-pointer"
            />
          </>
        ) : (
          <Link to="/login" className="bg-[#808bf5] text-white px-4 py-1 rounded no-underline">Login</Link>
        )}
      </div>

      <div className="md:hidden flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <button
              onClick={() => setnewpostVisible(true)}
              className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
              title="Create post"
            >
              +
            </button>

            <NotificationBell userId={loggeduser?._id} />

            {isAdminUser && (
              <Link
                to="/admin"
                className={`border-0 rounded-lg px-2 py-1 text-xs font-semibold no-underline flex items-center gap-1 ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}
                title="Admin Dashboard"
              >
                <span>⚙️</span>
              </Link>
            )}

            <img
              src={loggeduser?.profile_picture || "default-profile.png"}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover"
            />
          </>
        ) : (
          <Link to="/login" className="bg-[#808bf5] text-white px-3 py-1 rounded no-underline text-sm">Login</Link>
        )}

        <button
          onClick={toggle}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        <button
          onClick={() => setMobileMenuOpen(v => !v)}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-700'}`}
          title="Open menu"
          aria-label="Open mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          <i className={`pi ${mobileMenuOpen ? 'pi-times' : 'pi-bars'}`}></i>
        </button>
      </div>

      {mobileMenuOpen && (
        <div className={`md:hidden absolute top-full left-0 right-0 border-b shadow-lg px-4 py-3 z-40 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={isAuthenticated ? '' : 'mb-3'}>
            {isAuthenticated ? <Search /> : <Authnav />}
          </div>

          {!isAuthenticated && (
            <div className="flex justify-end">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-[#808bf5] text-white px-4 py-1 rounded no-underline"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      )}

      <Dialog header="New Post" visible={newpostVisible} modal position="center" style={{ width: '500px', maxHeight: '600px' }} onHide={() => setnewpostVisible(false)}>
        <NewPost setnewpostVisible={setnewpostVisible} />
      </Dialog>
    </div>
  );
};

export default Navbar;