import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import useAuthStore from '../store/zustand/useAuthStore';

const Login = () => {
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore(s => s.login);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);

  useEffect(() => {
    // Only show "Already logged in" if user was already present on initial mount
    const isInitialMount = !window.sessionStorage.getItem('just_logged_in');
    if (user && isInitialMount) {
      toast.success('You are already logged in..');
      if (location.search) {
        navigate(`/${user.username}${location.search}`);
      } else {
        navigate(`/${user.username}`);
      }
    }
  }, [user, navigate, location.search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.identifier)) { toast.error('Please enter a valid email address'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const result = await login({
        email: formData.identifier,
        password: encryptedPassword,
        fingerprint,
      });

      if (result?.requiresOtp) {
        navigate('/verify-otp', { state: { userId: result.userId } });
        return;
      } else if (result?.success) {
        window.sessionStorage.setItem('just_logged_in', 'true');
        toast.success('Login successful! Redirecting...');
        setTimeout(() => window.sessionStorage.removeItem('just_logged_in'), 2000);
        const params = new URLSearchParams(location.search);
        const sharedPostId = params.get('post') || window.sessionStorage.getItem('pendingPostId');
        const sharedProfileId = params.get('profile') || window.sessionStorage.getItem('pendingProfileId');
        const sharedStoryUserId = params.get('storyUser') || window.sessionStorage.getItem('pendingStoryUserId');
        const sharedStoryId = params.get('story') || window.sessionStorage.getItem('pendingStoryId');
        const loggedInUser = useAuthStore.getState().user;
        const username = loggedInUser?.username || result?.user?.username;

        if (!username) {
          toast.error('Login succeeded, but user profile is not available yet. Please try again.');
          navigate('/');
          return;
        }

        const redirectParams = new URLSearchParams();
        if (sharedPostId) redirectParams.set('post', sharedPostId);
        if (sharedProfileId) redirectParams.set('profile', sharedProfileId);
        if (sharedStoryUserId) redirectParams.set('storyUser', sharedStoryUserId);
        if (sharedStoryId) redirectParams.set('story', sharedStoryId);

        if ([...redirectParams.keys()].length > 0) {
          navigate(`/${username}?${redirectParams.toString()}`);
          return;
        }

        navigate(`/${username}`);
      } else {
        toast.error(result?.error || 'Login failed');
      }
    } catch { toast.error('Network error! Please try again.'); }
  };

  return (
    <>
      <Bg>
        <div className="w-full flex items-center justify-center gap-6 flex-col md:flex-row">
          <div className="w-full max-w-md mx-auto bg-white p-4 sm:p-6 rounded text-center">
            <h3 className="font-pacifico mb-3 text-2xl sm:text-3xl">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="text" name="identifier" placeholder="Email" value={formData.identifier} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <button className="py-2 mt-2 bg-themeAccent text-white w-full rounded" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
            </form>
            <Link to="/forgot" className="block mt-5 text-themeStart">Forgot Password?</Link>
            <div className="mt-3">
              <p>Don't have an account? <Link to="/signup" className="text-themeStart font-semibold">Sign up</Link></p>
            </div>
          </div>
          <div className="hidden md:block md:max-w-sm lg:max-w-md">
            <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" className="w-full h-auto" />
          </div>
        </div>
      </Bg>
      <Toaster />
    </>
  );
};

export default Login;