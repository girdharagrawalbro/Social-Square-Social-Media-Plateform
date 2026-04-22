import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import useAuthStore from '../store/zustand/useAuthStore';
import { useDarkMode } from '../context/DarkModeContext';

import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
    const { isDark } = useDarkMode();
    const [formData, setFormData] = useState({ identifier: '', password: '' });
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore(s => s.login);
    const googleLogin = useAuthStore(s => s.googleLogin);
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.identifier)) { toast.error('Please enter a valid email address'); return; }
        if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

        try {
            const encryptedPassword = encryptPassword(formData.password);
            const fingerprint = await getFingerprint();
            const result = await login({ email: formData.identifier, password: encryptedPassword, fingerprint });

            if (result?.requiresOtp) {
                navigate('/verify-otp', { state: { userId: result.userId } });
            } else if (result?.success) {
                window.sessionStorage.setItem('just_logged_in', 'true');
                toast.success('Login successful! Redirecting...');
                setTimeout(() => window.sessionStorage.removeItem('just_logged_in'), 2000);
                const username = result?.user?.username || useAuthStore.getState().user?.username;
                if (!username) {
                    toast.error('Login succeeded, but user profile is not available yet.');
                    navigate('/');
                    return;
                }
                navigate(`/${username}${location.search}`);
            } else {
                toast.error(result?.error || 'Login failed');
            }
        } catch { toast.error('Network error! Please try again.'); }
    };

    const inputClass = `px-4 py-2.5 w-full my-2 border rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-[#808bf5]/50 ${isDark ? 'bg-white/5 border-gray-800 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`;

    return (
        <>
            <Bg>
                <div className="w-full flex items-center justify-center gap-10 flex-col md:flex-row">
                    <div className={`w-full max-w-md mx-auto p-8 sm:p-10 rounded-2xl text-center transition-all duration-200 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
                        <div className="mb-8">
                            <h3 className="font-pacifico text-4xl text-[#808bf5] mb-3">Social Square</h3>
                            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Log in to your account</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-1">
                            <input className={inputClass} type="text" name="identifier" placeholder="Email" value={formData.identifier} onChange={handleChange} required />
                            <input className={inputClass} type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
                            <div className="pt-2">
                                <button className="py-2.5 bg-[#808bf5] hover:bg-[#6c79f2] text-white w-full rounded-lg font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50" type="submit" disabled={loading}>
                                    {loading ? 'Logging in...' : 'Log in'}
                                </button>
                            </div>
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

                        <Link to="/forgot" className="block mt-6 text-[#808bf5] font-semibold hover:underline">Forgot Password?</Link>
                        <div className={`mt-4 pt-6 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Don't have an account? <Link to="/signup" className="text-[#808bf5] font-bold hover:underline">Sign up</Link></p>
                        </div>
                    </div>
                    <div className="hidden md:block md:max-w-sm lg:max-w-md animate-in fade-in duration-700">
                        <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" className="w-full h-auto rounded-2xl shadow-xl" />
                    </div>
                </div>
            </Bg>
            <Toaster />
        </>
    );
};

export default Login;
