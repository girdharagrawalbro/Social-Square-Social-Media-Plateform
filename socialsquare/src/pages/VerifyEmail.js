import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Bg from './components/Bg';
import { Toaster, toast } from 'react-hot-toast';
import useAuthStore from '../store/zustand/useAuthStore';

const VerifyEmail = () => {
    const { token } = useParams();
    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [message, setMessage] = useState('Verifying your email address...');
    const verifyEmailLocally = useAuthStore(s => s.verifyEmailLocally);

    useEffect(() => {
        const verify = async () => {
            try {
                // Determine API URL based on environment
                const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
                const response = await axios.get(`${API_BASE_URL}/auth/verify-email/${token}`);
                
                setStatus('success');
                setMessage(response.data.message || 'Email verified successfully!');
                verifyEmailLocally(); // Sync the local user state if they are already logged in
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
    }, [token]);

    return (
        <>
            <Bg>
                <div className="w-full max-w-md mx-auto p-8 text-center">
                    <h2 className="font-pacifico text-3xl mb-6 text-themeAccent">Social Square</h2>
                    
                    <div className="my-8">
                        {status === 'verifying' && (
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-themeAccent border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-gray-600 font-medium">Please wait while we verify your account...</p>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">Verified!</h3>
                                <p className="text-gray-600 mb-8">{message}</p>
                                <Link 
                                    to="/login" 
                                    className="w-full py-3 bg-gradient-to-r from-themeAccent to-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                                >
                                    Proceed to Login
                                </Link>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">Oops!</h3>
                                <p className="text-gray-600 mb-8">{message}</p>
                                <Link 
                                    to="/signup" 
                                    className="w-full py-3 border-2 border-themeAccent text-themeAccent rounded-xl font-bold hover:bg-themeAccent hover:text-white transition-all active:scale-95"
                                >
                                    Back to Signup
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            Need help? <Link to="/contact" className="text-themeAccent font-semibold">Contact Support</Link>
                        </p>
                    </div>
                </div>
            </Bg>
            <Toaster position="top-center" />
        </>
    );
};

export default VerifyEmail;
