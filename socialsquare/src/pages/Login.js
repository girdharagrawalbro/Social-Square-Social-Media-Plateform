import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { GoogleLogin } from '@react-oauth/google';
import { getFingerprint } from '../utils/fingerprint';

const Login = () => {
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      toast.success('You are already logged in..');
      setTimeout(() => navigate('/'), 1000);
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.identifier)) { toast.error('Please enter a valid email address'); setLoading(false); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); setLoading(false); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: formData.identifier, password: encryptedPassword, fingerprint }),
      });

      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Login successful! Redirecting...');
        setTimeout(() => navigate('/'), 1500);
      }
      else if (result.requiresOtp) {
        navigate('/verify-otp', { state: { userId: result.userId } });
        return;
      } else {
        toast.error(result.error || result.message || 'Login failed');
      }
    } catch { toast.error('Network error! Please try again.'); }
    setLoading(false);
  };

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Google login successful!');
        setTimeout(() => navigate('/'), 1000);
      }
      else if (result.requiresOtp) {
        navigate('/verify-otp', { state: { userId: result.userId } });
        return;
      }
      else { toast.error(result.error || 'Google login failed'); }
    } catch { toast.error('Google login failed. Please try again.'); }
  }, [navigate]);

  return (
    <>
      <Bg>
        <div className="flex items-center gap-6">
          <div className="mx-auto bg-white p-6 rounded text-center">
            <h3 className="font-pacifico mb-3 text-3xl">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="text" name="identifier" placeholder="Email" value={formData.identifier} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <button className="py-2 mt-2 bg-themeAccent text-white w-full rounded" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
            </form>
            <div className="my-3 text-gray-400 text-sm">— or —</div>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google login failed')} width="100%" />
            </div>
            <Link to="/forgot" className="block mt-5 text-themeStart">Forgot Password?</Link>
            <div className="mt-3">
              <p>Don't have an account? <Link to="/signup" className="text-themeStart font-semibold">Sign up</Link></p>
            </div>
          </div>
          <div className="hidden md:block">
            <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" />
          </div>
        </div>
      </Bg>
      <Toaster />
    </>
  );
};

export default Login;