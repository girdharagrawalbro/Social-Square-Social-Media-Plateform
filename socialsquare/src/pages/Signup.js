import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import PasswordStrengthMeter from './components/PasswordStrengthMeter';
import useAuthStore from '../store/zustand/useAuthStore';

const Signup = () => {
  const [formData, setFormData] = useState({ email: '', fullname: '', password: '' });
  const navigate = useNavigate();
  const signup = useAuthStore(s => s.signup);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);

  useEffect(() => {
    if (user) { toast.success("You are already logged in.."); navigate('/'); }
  }, [user, navigate]);

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
        navigate('/');
      } else { toast.error(result.message || result.error || "Something went wrong!"); }
    } catch { toast.error("Network error! Please try again."); }
  };

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