import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast from '../utils/toast.js';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import useAuthStore from '../store/zustand/useAuthStore';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { useDarkMode } from '../context/DarkModeContext';
import ContinueWithGoogle from './components/ui/ContinueWithGoogle';

const Login = () => {
    const { isDark } = useDarkMode();
    const [formData, setFormData] = useState({ identifier: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore(s => s.login);
    const user = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const hasShownToast = useRef(false);

    useEffect(() => {
        if (!initialized || loading) return;
        const isInitialMount = !window.sessionStorage.getItem('just_logged_in');
        if (user && isInitialMount && !hasShownToast.current) {
            hasShownToast.current = true;
            toast.success('You’re logged in.');
            navigate(location.search ? `/${user.username}${location.search}` : `/${user.username}`);
        }
    }, [user, navigate, location.search, initialized, loading]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.identifier.trim()) { toast.error('Please enter your email or username'); return; }
        if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

        try {
            const encryptedPassword = encryptPassword(formData.password);
            const fingerprint = await getFingerprint();
            const result = await login({ email: formData.identifier.trim(), password: encryptedPassword, fingerprint });

            if (result?.requiresOtp) {
                const duration = result.resendDuration || 60;
                localStorage.setItem('otpResendUntil', (Date.now() + duration * 1000).toString());
                if (result.otpExpireTime) {
                    localStorage.setItem('otpExpiresAt', result.otpExpireTime);
                }
                navigate('/verify-otp', { state: { userId: result.userId } });
            } else if (result?.success) {
                // Initialize E2EE
                const userId = result.user._id;
                try {
                    await useE2eeStore.getState().initE2ee(userId, formData.password);
                } catch (e2eeErr) {
                    console.error("E2EE initialization failed:", e2eeErr);
                }

                window.sessionStorage.setItem('just_logged_in', 'true');
                toast.success('Login successful...');
                setTimeout(() => window.sessionStorage.removeItem('just_logged_in'), 2000);
                const username = result?.user?.username || useAuthStore.getState().user?.username;
                if (!username) {
                    toast.error('Login succeeded, but user profile is not available yet.');
                    navigate('/');
                    return;
                }
                navigate(`/${username}${location.search}`);
            } else {
                toast.error(result?.error);
            }
        } catch { toast.error('Network error! Please try again.'); }
    };

    const inputClass = `px-4 py-2.5 w-full my-2 border rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-[#808bf5]/50 ${isDark ? 'bg-white/5 border-gray-800 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`;

    return (
        <>
            <Bg>
                <div className="flex items-center justify-center gap-4 md:gap-10 flex-col md:flex-row p-2 sm:p-6 md:p-8 w-full">
                    <div className={`flex flex-col justify-center w-full max-w-[420px] p-4 sm:p-8 rounded-2xl text-center transition-all duration-200 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
                        <div className="mb-8">
                            <h3 className="font-pacifico text-4xl text-[#808bf5] mb-3">Social Square</h3>
                            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Sign in to your account</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-1">
                            <input className={inputClass} type="text" name="identifier" placeholder="Email or Username" value={formData.identifier} onChange={handleChange} required />
                            <div className="relative">
                                <input className={inputClass} type={showPassword ? "text" : "password"} name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
                                <i
                                    className={`pi ${showPassword ? 'pi-eye-slash' : 'pi-eye'} absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer ${isDark ? 'text-gray-400' : 'text-gray-500'} hover:text-[#808bf5] transition-colors`}
                                    onClick={() => setShowPassword(!showPassword)}
                                ></i>
                            </div>
                            <div className="pt-2">
                                <button className="py-2.5 bg-[#4f46e5] text-white w-full rounded-full font-bold disabled:opacity-50" type="submit" disabled={loading}>
                                    {loading ? 'Signing In...' : 'Sign In'}
                                </button>
                            </div>
                        </form>
                        <Link to="/forgot" className="block mt-6 text-[#808bf5] font-semibold hover:underline">Forgot Password?</Link>
                        <div className="flex items-center my-6">
                            <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
                            <span className={`px-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OR</span>
                            <div className={`flex-1 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}></div>
                        </div>

                        <div className="flex justify-center w-full">
                            <ContinueWithGoogle />
                        </div>

                        <div className="mt-4 text-center">
                            <p>Don't have an account?{' '}
                                <Link
                                    to="/signup"
                                    className="text-[#808bf5] font-semibold hover:underline"
                                >
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>

                </div>
            </Bg>
            
        </>
    );
};

export default Login;
