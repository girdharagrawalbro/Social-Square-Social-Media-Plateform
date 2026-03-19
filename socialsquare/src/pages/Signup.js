import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { GoogleLogin } from '@react-oauth/google';
import { getFingerprint } from '../utils/fingerprint';
import PasswordStrengthMeter from './components/PasswordStrengthMeter';

const Signup = () => {
  const [formData, setFormData] = useState({ email: '', fullname: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { toast.success("You are already logged in.."); setTimeout(() => navigate('/'), 1500); }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { toast.error('Please enter a valid email address'); setLoading(false); return; }
    if (formData.fullname.trim().length < 2) { toast.error('Full name must be at least 2 characters'); setLoading(false); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); setLoading(false); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fullname: formData.fullname, email: formData.email, password: encryptedPassword, fingerprint }),
      });

      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success("Signup successful! Redirecting...");
        setTimeout(() => navigate('/'), 1500);
      } else { toast.error(result.message || result.error || "Something went wrong!"); }
    } catch { toast.error("Network error! Please try again."); }
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
        toast.success('Google signup successful!');
        setTimeout(() => navigate('/'), 1000);
      } else { toast.error(result.error || 'Google signup failed'); }
    } catch { toast.error('Google signup failed. Please try again.'); }
  }, [navigate]);

  return (
    <>
      <Bg>
        <div className="flex align-center">
          <div className='flex flex-col'>
            <h3 className="pacifico-regular mb-3">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="text" name="fullname" placeholder="Full Name" value={formData.fullname} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <PasswordStrengthMeter password={formData.password} />
              <button className="py-2 mt-2 theme-bg w-100" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign up'}</button>
            </form>
            <div className="my-3 text-center text-secondary" style={{ fontSize: '14px' }}>— or —</div>
            <div className="flex justify-content-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google signup failed')} text="signup_with" width="100%" />
            </div>
            <div className="mt-4">
              <p>Have an account? <Link to="/login" className="text-primary text-decoration-none fw-bold">Log in</Link></p>
            </div>
          </div>
        </div>
        <div className='pc'>
          <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" />
        </div>
      </Bg>
      <Toaster />
    </>
  );
};

export default Signup;