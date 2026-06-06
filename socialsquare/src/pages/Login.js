import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { getFingerprint } from '../utils/fingerprint';
import useAuthStore from '../store/zustand/useAuthStore';
import { useDarkMode } from '../context/DarkModeContext';

import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

const Login = () => {
    const { isDark } = useDarkMode();
    const [formData, setFormData] = useState({ identifier: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
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
        if (!formData.identifier.trim()) { toast.error('Please enter your email or username'); return; }
        if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

        try {
            const encryptedPassword = encryptPassword(formData.password);
            const fingerprint = await getFingerprint();
            const result = await login({ email: formData.identifier.trim(), password: encryptedPassword, fingerprint });

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
                toast.error(result?.error);
            }
        } catch { toast.error('Network error! Please try again.'); }
    };

    const handleNativeGoogleLogin = async () => {
        try {
            const googleUser = await GoogleAuth.signIn();
            const fingerprint = await getFingerprint();
            const result = await googleLogin({
                credential: googleUser.authentication.idToken,
                fingerprint
            });

            if (result?.success) {
                toast.success('Google login successful!');
                navigate(`/${result.user.username}`);
            } else {
                toast.error(result?.error || 'Google login failed');
            }
        } catch (err) {
            console.error('Native Google login error:', err);
            if (err.message !== 'user cancelled login') {
                toast.error('An error occurred during Google login');
            }
        }
    };

    const inputClass = `px-4 py-2.5 w-full my-2 border rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-[#808bf5]/50 ${isDark ? 'bg-white/5 border-gray-800 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`;

    return (
        <>
            <Bg>
                <div className="flex items-center justify-center gap-4 md:gap-10 flex-col md:flex-row p-2 sm:p-6 md:p-8 w-full">
                    <div className={`flex flex-col justify-center w-full max-w-[420px] p-4 sm:p-8 rounded-2xl text-center transition-all duration-200 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
                        <div className="mb-8">
                            <h3 className="font-pacifico text-4xl text-[#808bf5] mb-3">Social Square</h3>
                            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} font-medium`}>Log in to your account</p>
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
                                <button className="py-2.5 bg-[#808bf5] hover:bg-[#6c79f2] text-white w-full rounded-lg font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50" type="submit" disabled={loading}>
                                    {loading ? 'Logging in...' : 'Log in'}
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
                            {Capacitor.isNativePlatform() ? (
                                <button
                                    onClick={handleNativeGoogleLogin}
                                    className="flex items-center justify-center gap-3 px-6 py-2.5 w-full bg-white border border-gray-300 rounded-full text-gray-700 font-semibold transition-all hover:bg-gray-50 active:scale-[0.98] shadow-sm"
                                    style={{ maxWidth: '350px' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.956L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
                                    </svg>
                                    Continue with Google
                                </button>
                            ) : (
                                <button
                                    onClick={async () => {
                                        try {
                                            const { auth, googleProvider } = await import('../lib/firebase');
                                            const { signInWithPopup } = await import('firebase/auth');
                                            const result = await signInWithPopup(auth, googleProvider);
                                            const idToken = await result.user.getIdToken();
                                            const fingerprint = await getFingerprint();
                                            const loginResult = await googleLogin({
                                                credential: idToken,
                                                fingerprint
                                            });

                                            if (loginResult?.success) {
                                                toast.success('Google login successful!');
                                                navigate(`/${loginResult.user.username}`);
                                            } else {
                                                toast.error(loginResult?.error || 'Google login failed');
                                            }
                                        } catch (err) {
                                            console.error('Google login error:', err);
                                            if (err.code !== 'auth/popup-closed-by-user') {
                                                toast.error('An error occurred during Google login');
                                            }
                                        }
                                    }}
                                    className="flex items-center justify-center gap-3 px-6 py-2.5 w-full bg-white border border-gray-300 rounded-full text-gray-700 font-semibold transition-all hover:bg-gray-50 active:scale-[0.98] shadow-sm"
                                    style={{ maxWidth: '350px' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.956L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
                                    </svg>
                                    Continue with Google
                                </button>
                            )}

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
            <Toaster />
        </>
    );
};

export default Login;
