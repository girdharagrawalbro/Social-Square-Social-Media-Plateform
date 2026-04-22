import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Bg from './components/Bg';
import { useDarkMode } from '../context/DarkModeContext';

const Forgot = () => {
    const { isDark } = useDarkMode();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const result = await response.json();
            if (response.ok) {
                setSent(true);
                toast.success('Reset link sent! Check your email.');
            } else {
                toast.error(result.error || 'Failed to send reset link.');
            }
        } catch {
            toast.error('Network error! Please try again.');
        }
        setLoading(false);
    };

    const inputClass = `px-4 py-2.5 w-full my-2 border rounded-lg transition-all duration-200 outline-none focus:ring-2 focus:ring-[#808bf5]/50 ${isDark ? 'bg-white/5 border-gray-800 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-800'}`;

    return (
        <Bg>
            <div className={`max-w-md mx-auto p-8 sm:p-10 rounded-2xl text-center transition-all duration-200 ${isDark ? 'bg-[#121212]' : 'bg-white'}`}>
                <h3 className="font-pacifico text-4xl text-[#808bf5] mb-4">Social Square</h3>
                {sent ? (
                    <div className="animate-in fade-in zoom-in duration-500">
                        <div className="text-green-500 text-xl font-bold mb-4 flex items-center justify-center gap-2">
                            <span>✅</span> Check your email!
                        </div>
                        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            We sent a password reset link to <strong className="text-[#808bf5]">{email}</strong>.
                        </p>
                        <Link to="/login" className="inline-block py-2 px-6 bg-[#808bf5] text-white rounded-lg font-bold hover:bg-[#6c79f2] transition-colors">
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Enter your email and we'll send you a password reset link.
                        </p>
                        <input
                            className={inputClass}
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        <div className="pt-2">
                            <button className="py-2.5 bg-[#808bf5] hover:bg-[#6c79f2] text-white w-full rounded-lg font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50" type="submit" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </div>
                        <div className={`pt-6 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                                Remembered? <Link to="/login" className="text-[#808bf5] font-bold hover:underline">Log in</Link>
                            </p>
                        </div>
                    </form>
                )}
            </div>
            <Toaster />
        </Bg>
    );
};

export default Forgot;
