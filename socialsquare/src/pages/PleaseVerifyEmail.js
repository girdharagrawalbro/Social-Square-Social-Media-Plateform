import React, { useState, useEffect } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';
import { api } from '../store/zustand/useAuthStore';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const PleaseVerifyEmail = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResend = async () => {
        if (cooldown > 0) return;
        setResending(true);
        try {
            const res = await api.post('/api/auth/resend-verification');
            toast.success(res.data?.message || 'Verification link sent!');
            setCooldown(60);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to resend verification email.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l8-4.8a2 2 0 012.22 0l8 4.8A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
                    </svg>
                </div>
                
                <h2 className="text-2xl font-black text-gray-800 mb-2">Verify Your Email</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                    We've sent a verification link to <span className="font-bold text-indigo-600">{user?.email}</span>. 
                    Please click the link in that email to activate your account.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={handleResend}
                        disabled={resending || cooldown > 0}
                        className={`w-full py-3 rounded-xl font-bold transition-all active:scale-95 shadow-md ${
                            cooldown > 0 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                        }`}
                    >
                        {resending ? 'Sending...' : cooldown > 0 ? `Resend Link (${cooldown}s)` : 'Resend Verification Email'}
                    </button>

                    <button
                        onClick={() => navigate(`/${user?.username}`)}
                        className="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Back to Feed
                    </button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                        Can't find the email? Check your spam folder or try resending.
                    </p>
                </div>
            </div>
            <Toaster position="top-center" />
        </div>
    );
};

export default PleaseVerifyEmail;
