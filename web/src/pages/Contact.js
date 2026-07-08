import React, { useState } from 'react';
import Bg from './components/Bg';
import { useDarkMode } from '../context/DarkModeContext';
import { api } from '../store/zustand/useAuthStore';
import toast from '../utils/toast.js';

const Contact = () => {
    const { isDark } = useDarkMode();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        message: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

    const validateField = (name, val) => {
        let err = '';
        if (name === 'name') {
            if (!val.trim()) {
                err = 'Name is required';
            } else if (val.trim().length < 3) {
                err = 'Name must be at least 3 letters long';
            }
        }
        if (name === 'email') {
            if (!val.trim()) {
                err = 'Email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
                err = 'Please enter a valid email address';
            }
        }
        if (name === 'mobile') {
            if (val && !/^\+?[0-9]{10,15}$/.test(val.trim())) {
                err = 'Mobile number must be 10-15 digits (e.g. +1234567890)';
            }
        }
        if (name === 'message') {
            if (!val.trim()) {
                err = 'Message is required';
            } else if (val.length > 200) {
                err = 'Message cannot exceed 200 characters';
            }
        }
        return err;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Live validation
        const err = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: err }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate all fields
        const newErrors = {};
        Object.keys(formData).forEach(key => {
            const err = validateField(key, formData[key]);
            if (err) newErrors[key] = err;
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Please fix the errors before submitting.');
            return;
        }

        setLoading(true);
        try {
            await api.post(`${BASE}/api/contact`, formData);
            setSuccess(true);
            setFormData({ name: '', email: '', mobile: '', message: '' });
            toast.success('Your message has been sent!');
        } catch (err) {
            const serverMsg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to submit contact form.';
            toast.error(serverMsg);
        } finally {
            setLoading(false);
        }
    };

    const cardClass = `border rounded-xl px-4 py-3 transition-all duration-200 transform hover:scale-[1.02] ${isDark ? 'bg-white/5 border-gray-800 hover:bg-white/10' : 'bg-white border-gray-100 hover:shadow-md'}`;
    const labelClass = `text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`;
    const valueClass = `font-bold text-base sm:text-lg text-[#808bf5] break-all`;

    const inputStyle = `w-full px-4 py-3 rounded-lg border text-sm outline-none transition-all duration-200 ${isDark
        ? 'bg-black/40 border-gray-800 text-white placeholder-gray-600 focus:border-[#808bf5] focus:ring-1 focus:ring-[#808bf5]/30'
        : 'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#808bf5] focus:ring-1 focus:ring-[#808bf5]/30'
        }`;

    return (
        <Bg>
            <div className="w-full max-w-3xl mx-auto text-left py-4 sm:py-8">
                <div className={`rounded-2xl border transition-all duration-200 p-6 sm:p-8 md:p-10 ${isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-100'}`}>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Contact Us</h1>
                    <p className={`text-base mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        We would love to hear from you. Fill out the for any queries and also can react out us on our social plateforms.
                    </p>

                    {success ? (
                        <div className={`rounded-xl mb-4 border p-8 text-center transition-all duration-500 transform scale-100 ${isDark ? 'bg-[#808bf5]/10 border-[#808bf5]/30' : 'bg-white border-green-100'}`}>
                            <div className="w-16 h-16 bg-[#808bf5]/20 text-[#808bf5] rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
                                📬
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
                            <p className={`text-sm mb-6 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Your message has been sent successfully. We will reach out you soon.
                            </p>
                            <button
                                onClick={() => setSuccess(false)}
                                className="px-6 py-2.5 bg-[#808bf5] text-white font-bold rounded-lg hover:bg-indigo-600 transition-all active:scale-95 text-sm"
                            >
                                Send another message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5 mb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Your full name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className={`${inputStyle} ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                                    />
                                    {errors.name && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="email@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={`${inputStyle} ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                                    />
                                    {errors.email && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.email}</p>}
                                </div>
                            </div>

                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Mobile Number <span className="text-gray-400/80 font-normal lowercase">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    name="mobile"
                                    placeholder="+1234567890"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    className={`${inputStyle} ${errors.mobile ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                                />
                                {errors.mobile && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.mobile}</p>}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Message <span className="text-red-500">*</span>
                                    </label>
                                    <span className={`text-[10px] font-bold ${formData.message.length > 200 ? 'text-red-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {formData.message.length}/200
                                    </span>
                                </div>
                                <textarea
                                    name="message"
                                    rows="2"
                                    placeholder="Tell us what you need help with..."
                                    value={formData.message}
                                    onChange={handleChange}
                                    className={`${inputStyle} resize-none ${errors.message ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
                                />
                                {errors.message && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.message}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3 px-6 rounded-lg bg-[#808bf5] hover:bg-indigo-600 text-white font-bold text-sm tracking-wider uppercase transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:shadow-indigo-500/20'}`}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <span>Send Message</span>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <a href="https://linkedin.com/in/girdhar-agrawa" target="_blank" rel="noopener noreferrer" className={cardClass}>
                            <p className={labelClass}>LinkedIn</p>
                            <p className={valueClass}>Girdhar Agrawal</p>
                        </a>

                        <a href="https://instagram.com/codewithgirdhar" target="_blank" rel="noopener noreferrer" className={cardClass}>
                            <p className={labelClass}>Instagram</p>
                            <p className={valueClass}>@codewithgirdhar</p>
                        </a>
                    </div>


                </div>
            </div>
        </Bg>
    );
};

export default Contact;
