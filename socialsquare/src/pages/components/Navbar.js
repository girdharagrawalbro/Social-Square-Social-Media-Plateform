import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Search from "./Search";
import useAuthStore, { getToken } from '../../store/zustand/useAuthStore';
import Authnav from "./Authnav";
import NotificationBell from "./ui/NotificationBell";
import { useDarkMode } from '../../context/DarkModeContext';
import { requestNotificationPermission } from '../../utils/pushNotifications';
import NewPost from "./Newpost";
import { Dialog } from "primereact/dialog";


const Navbar = () => {
  const location = useLocation();
  const isLandingPage = ['/', '/help', '/contact'].includes(location.pathname);
  const { user: loggeduser, logout } = useAuthStore();
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
    <nav ref={mobileMenuRef} aria-label="Main Navigation" className={`sticky top-0 z-50 w-full h-16 backdrop-blur-md shadow-sm border-b flex items-center justify-between px-3 sm:px-4 transition-all duration-300 ${isDark ? 'bg-black/80 border-[#1a1a1a]' : 'bg-white/80 border-gray-200'}`}>
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2">
        <Link to={isAuthenticated && loggeduser?.username ? `/${loggeduser.username}` : "/"} className="flex items-center flex-shrink-0">
          <i className={`pi pi-home text-xl sm:text-2xl ${isDark ? 'text-white' : 'text-black'}`}></i>
        </Link>
        <Link to={isAuthenticated && loggeduser?.username ? `/${loggeduser.username}` : "/"} className={`no-underline flex items-center gap-2 min-w-0 ${isDark ? 'text-white' : 'text-gray-800'}`} title="Go to Home">
          <h1 className="font-pacifico text-lg sm:text-2xl m-0 truncate whitespace-nowrap">Social Square</h1>
        </Link>
      </div>

      <div className="hidden md:block mx-auto max-w-4xl w-full px-8">
        {isLandingPage ? <Authnav /> : (isAuthenticated ? <Search onClose={() => setMobileMenuOpen(false)} /> : <Authnav />)}
      </div>


      <div className="hidden md:flex items-center justify-end gap-3 flex-1">
        {isAuthenticated && !isLandingPage ? (
          <button
            aria-label="Create post"
            onClick={() => setnewpostVisible(true)}
            className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}
            title="Create post"
          >
            <i className="pi pi-plus"></i>
          </button>
        ) : null}

        {isAuthenticated ? (
          !isLandingPage && <NotificationBell userId={loggeduser?._id} />
        ) : (
          location.pathname === '/login' ? (
            <Link to="/signup" className="border border-[#808bf5] text-[#808bf5] px-4 py-1 rounded no-underline hover:bg-[#808bf5] hover:text-white transition-all">Sign Up</Link>
          ) : (
            <Link to="/login" className="bg-[#808bf5] text-white px-4 py-1 rounded no-underline hover:opacity-90">Login</Link>
          )
        )}
        {/* Dark mode toggle */}
        <button
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggle}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>


        {isAdminUser && (
          <Link
            to="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}

          >
            <span>⚙️</span>
          </Link>
        )}
      </div>

      <div className="md:hidden flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {isAuthenticated && !isLandingPage ? (
          <>
            <button
              aria-label="Create post"
              onClick={() => setnewpostVisible(true)}
              className={`border-0 rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
              title="Create post"
            >
              <i className="pi pi-plus text-xs sm:text-base"></i>
            </button>

            <NotificationBell userId={loggeduser?._id} />
          </>
        ) : (
          !isAuthenticated && (
            location.pathname === '/login' ? (
              <Link to="/signup" className="bg-[#808bf5] text-white px-3 py-1 rounded no-underline text-sm hover:opacity-90">Sign Up</Link>
            ) : (
              <Link to="/login" className="bg-[#808bf5] text-white px-3 py-1 rounded no-underline text-sm hover:opacity-90">Login</Link>
            )
          )
        )}

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

      <div className={`md:hidden absolute top-full left-0 right-0 border-b shadow-2xl px-4 py-4 z-40 flex flex-col gap-4 transition-all duration-300 ease-out origin-top ${mobileMenuOpen ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-4 invisible pointer-events-none'
        } ${isDark ? 'bg-[#0f0f0f]/95 border-neutral-800' : 'bg-white/95 border-gray-200'}`}>
        <div className={isAuthenticated ? '' : 'mb-3'}>
          {isLandingPage ? <Authnav /> : (isAuthenticated ? <Search onClose={() => setMobileMenuOpen(false)} /> : <Authnav />)}
        </div>

        {isAuthenticated && (
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            {isAdminUser && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2 rounded-lg no-underline flex items-center gap-2 ${isDark ? 'text-white hover:bg-gray-800' : 'text-gray-800 hover:bg-gray-50'}`}
              >
                <span>⚙️</span> Admin Dashboard
              </Link>
            )}

            <button
              onClick={() => { toggle(); setMobileMenuOpen(false); }}
              className={`text-left px-3 py-2.5 rounded-xl border-0 bg-transparent cursor-pointer flex items-center gap-3 font-medium transition-colors ${isDark ? 'text-gray-100 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <span className="text-lg">{isDark ? '☀️' : '🌙'}</span> {isDark ? 'Light Mode' : 'Dark Mode'}
            </button>

            <button
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className={`text-left px-3 py-2.5 rounded-xl border-0 bg-transparent cursor-pointer flex items-center gap-3 font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
            >
              <span className="text-lg">🚪</span> Logout
            </button>
          </div>
        )}
      </div>

      <Dialog header="New Post" visible={newpostVisible} modal position="center" style={{ width: '500px', maxHeight: '600px' }} onHide={() => setnewpostVisible(false)}>
        <NewPost setnewpostVisible={setnewpostVisible} />
      </Dialog>
    </nav>
  );
};

export default Navbar;
