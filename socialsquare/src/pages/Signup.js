import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import PasswordStrengthMeter from './components/PasswordStrengthMeter';
import useAuthStore from '../store/zustand/useAuthStore';
import { GoogleLogin } from '@react-oauth/google';
import { useDarkMode } from '../context/DarkModeContext';

const Signup = () => {
  const { isDark } = useDarkMode();
  const [formData, setFormData] = useState({ email: '', fullname: '', password: '' });
  const navigate = useNavigate();
  const signup = useAuthStore(s => s.signup);
  const googleLogin = useAuthStore(s => s.googleLogin);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (!initialized || loading) return;
    if (user && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("You are already logged in..");
      navigate(`/${user.username}`);
    }
  }, [user, navigate, initialized, loading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { toast.error('Please enter a valid email address'); return; }
    if (formData.fullname.trim().length < 2) { toast.error('Full name must be at least 2 characters'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const result = await signup({
        fullname: formData.fullname,
        email: formData.email,
        password: encryptedPassword,
        fingerprint,
      });

      if (result?.success) {
        toast.success("Signup successful! Redirecting...");
        navigate(`/${result.user.username}`);
      } else { toast.error(result.message || result.error || "Something went wrong!"); }
    } catch { toast.error("Network error! Please try again."); }
  };

  return (
    <>
      <Bg>
        <div className="w-full flex items-center justify-center gap-6 flex-col md:flex-row">
          <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col text-left">
            <div className="mb-6 text-center">
                <h3 className="font-pacifico text-3xl sm:text-4xl text-[#808bf5] mb-2">Social Square</h3>
                <p className="text-gray-500 font-medium whitespace-nowrap">Join your community today</p>
            </div>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-dark w-full my-2 border rounded" type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-full my-2 border rounded" type="text" name="fullname" placeholder="Full Name" value={formData.fullname} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-full my-2 border rounded" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <PasswordStrengthMeter password={formData.password} />
              <button className="py-2 mt-2 bg-themeAccent text-white w-full rounded" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign up'}</button>
            </form>

            <div className="flex items-center my-6">
              <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
              <span className={`px-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OR</span>
              <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
            </div>

            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    const fingerprint = await getFingerprint();
                    const result = await googleLogin({
                      credential: credentialResponse.credential,
                      fingerprint
                    });

                    if (result?.success) {
                      toast.success('Google login successful!');
                      navigate(`/${result.user.username}`);
                    } else {
                      toast.error(result?.error || 'Google login failed');
                    }
                  } catch (err) {
                    toast.error('An error occurred during Google login');
                  }
                }}
                onError={() => {
                  toast.error('Google login failed');
                }}
                useOneTap
                theme={isDark ? 'filled_black' : 'outline'}
                shape="pill"
                width="100%"
              />
            </div>
            <div className="mt-4 text-center">
              <p>Have an account? <Link to="/login" className="text-themeStart font-semibold">Log in</Link></p>
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

export default Signup;