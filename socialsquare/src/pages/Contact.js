import React from 'react';
import Bg from './components/Bg';
import { useDarkMode } from '../context/DarkModeContext';

const Contact = () => {
    const { isDark } = useDarkMode();

    const cardClass = `border rounded-xl p-4 transition-all duration-200 transform hover:scale-[1.02] ${isDark ? 'bg-white/5 border-gray-800 hover:bg-white/10' : 'bg-white border-gray-100 hover:shadow-md'}`;
    const labelClass = `text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`;
    const valueClass = `font-bold text-base sm:text-lg text-[#808bf5] break-all`;

    return (
        <Bg>
            <div className="w-full max-w-3xl mx-auto text-left">
                <div className={`rounded-2xl border transition-all duration-200 p-6 sm:p-8 md:p-10 ${isDark ? 'bg-black/40 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Contact Us</h1>
                    <p className={`text-base mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        We would love to hear from you. Reach out through any channel below and we will get back to you as soon as possible.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <a href="mailto:girdharagarawalbro@gmail.com" target="_blank" rel="noopener noreferrer" className={cardClass}>
                            <p className={labelClass}>Email</p>
                            <p className={valueClass}>girdharagarawalbro@gmail.com</p>
                        </a>

                        <a href="https://instagram.com/codewithgirdhar" target="_blank" rel="noopener noreferrer" className={cardClass}>
                            <p className={labelClass}>Instagram</p>
                            <p className={valueClass}>@codewithgirdhar</p>
                        </a>

                        <a href="https://linkedin.com/in/girdhar-agrawal" target="_blank" rel="noopener noreferrer" className={`${cardClass} sm:col-span-2`}>
                            <p className={labelClass}>LinkedIn</p>
                            <p className={valueClass}>Girdhar Agrawal</p>
                        </a>
                    </div>

                    <div className={`rounded-xl border p-6 transition-colors duration-200 ${isDark ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                        <h2 className="text-xl font-bold mb-3">Collaborate With Us</h2>
                        <p className={`text-sm sm:text-base leading-relaxed mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            We are always excited to welcome new collaborators. If you want to contribute ideas or code, check the repository and share your contribution.
                        </p>
                        <a
                            href="https://github.com/girdharagrawalbro/Social-Square-Social-Media-Plateform"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[#808bf5] font-bold hover:underline"
                        >
                            <i className="pi pi-github" />
                            <span>Social Square Repository</span>
                        </a>
                    </div>
                </div>
            </div>
        </Bg>
    );
};

export default Contact;
