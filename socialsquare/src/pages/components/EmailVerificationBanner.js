import React from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useNavigate } from 'react-router-dom';

const EmailVerificationBanner = () => {
    const user = useAuthStore(s => s.user);
    const navigate = useNavigate();

    if (!user || user.isEmailVerified) return null;

    return (
        <div className="bg-yellow-50 border-b border-yellow-200 px-3 py-2 sm:px-6 flex items-center justify-between z-[99999] relative shrink-0">
            <div className="flex-1 flex items-center">
                <span className="flex p-2 rounded-lg bg-yellow-400 mr-3">
                    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </span>
                <p className="font-medium text-yellow-700 text-sm">
                    Please verify your email address to secure your account.
                </p>
            </div>
            <div className="mt-0 shrink-0 ml-4">
                <button
                    onClick={() => navigate('/please-verify')}
                    className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-yellow-700 bg-yellow-200 hover:bg-yellow-300 transition-colors"
                >
                    Verify Now
                </button>
            </div>
        </div>
    );
};

export default EmailVerificationBanner;
