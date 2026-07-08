import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from '../utils/toast.js';
import useAuthStore from '../store/zustand/useAuthStore';

const VerifyEmail = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying');
    const [message, setMessage] = useState('');
    const verifyEmailLocally = useAuthStore(s => s.verifyEmailLocally);
    const user = useAuthStore(s => s.user);

    useEffect(() => {
        const verify = async () => {
            try {
                const API_BASE_URL = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;
                const response = await axios.get(`${API_BASE_URL}/auth/verify-email/${token}`);
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');
                verifyEmailLocally();
                toast.success('Verification complete!');
            } catch (error) {
                setStatus('error');
                setMessage(error.response?.data?.error || 'Verification failed. The link may be invalid or expired.');
                toast.error('Verification failed');
            }
        };

        if (token) {
            verify();
        } else {
            setStatus('error');
            setMessage('No verification token provided.');
        }
    }, [token, verifyEmailLocally]);

    const handleContinue = () => {
        if (user?.username) {
            navigate(`/${user.username}`);
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">

                {/* VERIFYING */}
                {status === 'verifying' && (
                    <>
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 mb-2">Verifying...</h2>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Please wait while we verify your email address.
                        </p>
                    </>
                )}

                {/* SUCCESS */}
                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-black text-gray-800 mb-2">Email Verified!</h2>
                        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                            Your email has been verified successfully.{' '}
                            {user?.username
                                ? 'You can now continue using Social Square.'
                                : 'You can now log in to your account.'}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleContinue}
                                className="w-full py-3 rounded-xl font-bold transition-all active:scale-95 shadow-md bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg"
                            >
                                {user?.username ? 'Go to Feed' : 'Proceed to Login'}
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                Need help?{' '}
                                <Link to="/contact" className="text-indigo-500 font-semibold hover:text-indigo-700">
                                    Contact Support
                                </Link>
                            </p>
                        </div>
                    </>
                )}

                {/* ERROR */}
                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-black text-gray-800 mb-2">Link Expired</h2>
                        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>

                        <div className="space-y-3">
                            {user?.username ? (
                                <button
                                    onClick={() => navigate(`/${user.username}`)}
                                    className="w-full py-3 rounded-xl font-bold transition-all active:scale-95 shadow-md bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg"
                                >
                                    Back to Feed
                                </button>
                            ) : (
                                <Link
                                    to="/signup"
                                    className="block w-full py-3 rounded-xl font-bold transition-all active:scale-95 shadow-md bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg"
                                >
                                    Create a New Account
                                </Link>
                            )}
                            {!user?.username && (
                                <Link
                                    to="/login"
                                    className="block w-full py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Back to Login
                                </Link>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                Need help?{' '}
                                <Link to="/contact" className="text-indigo-500 font-semibold hover:text-indigo-700">
                                    Contact Support
                                </Link>
                            </p>
                        </div>
                    </>
                )}
            </div>
            
        </div>
    );
};

export default VerifyEmail;
