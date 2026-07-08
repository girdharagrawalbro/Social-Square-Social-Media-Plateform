import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast from '../utils/toast.js';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import PasswordStrengthMeter from './components/PasswordStrengthMeter';
import useAuthStore from '../store/zustand/useAuthStore';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { useDarkMode } from '../context/DarkModeContext';
import ContinueWithGoogle from './components/ui/ContinueWithGoogle';

const Signup = () => {

  const { isDark } = useDarkMode();
  const [formData, setFormData] = useState({ email: '', fullname: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const signup = useAuthStore(s => s.signup);

  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const initialized = useAuthStore(s => s.initialized);
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (!initialized || loading) return;
    if (user && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.success("You’re logged in.");
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
        // Initialize E2EE
        const userId = result.user._id;
        try {
          await useE2eeStore.getState().initE2ee(userId, formData.password);
        } catch (e2eeErr) {
          console.error("E2EE initialization failed:", e2eeErr);
        }

        toast.success("Signup successful! Redirecting...");
        navigate(`/${result.user.username}`);
      } else { toast.error(result.message || result.error || "Something went wrong!"); }
    } catch { toast.error("Network error! Please try again."); }
  };

  const inputClass = `px-4 py-2.5 w-full my-2 border rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-[#808bf5]/50 ${isDark ? 'bg-white/5 border-gray-800 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`;

  return (
    <>
      <Bg>
        <div className="flex items-center justify-center gap-4 md:gap-10 flex-col md:flex-row p-2 sm:p-6 md:p-8 w-full">
          <div className={`flex flex-col justify-center w-full max-w-[420px] p-4 sm:p-8 rounded-2xl text-center transition-all duration-200 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
            <div className="mb-8">
              <h3 className="font-pacifico text-4xl text-[#808bf5] mb-3">Social Square</h3>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Sign Up to Social Square</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-1">
              <input className={inputClass} type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input className={inputClass} type="text" name="fullname" placeholder="Full Name" value={formData.fullname} onChange={handleChange} required />
              <div className="relative">
                <input className={inputClass} type={showPassword ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
                <i
                  className={`pi ${showPassword ? 'pi-eye-slash' : 'pi-eye'} absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-[#808bf5] transition-colors`}
                  onClick={() => setShowPassword(!showPassword)}
                ></i>
              </div>
              <PasswordStrengthMeter password={formData.password} />
              <button className="py-2.5 bg-[#4f46e5] text-white w-full rounded-full font-bold disabled:opacity-50" type="submit" disabled={loading}>
                {loading ? 'Signing Up...' : 'Sign Up'}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
              <span className={`px-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OR</span>
              <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
            </div>

            <div className="flex justify-center w-full">
              <ContinueWithGoogle />
            </div>

            <div className="mt-4 text-center">
              <p>Have an account?{' '}
                <Link
                  to="/login"
                  className="text-[#808bf5] font-semibold hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>

        </div>
      </Bg>
      
    </>
  );
};

export default Signup;
