import React from 'react';
import { useDarkMode } from '../../context/DarkModeContext';

const Footer = () => {
    const { isDark } = useDarkMode();

    return (
        <footer className={`py-10 px-5 border-t transition-colors duration-200 ${isDark ? 'bg-[#000000] border-gray-800' : 'bg-white border-gray-100'}`}>
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                    <h3 className="font-pacifico text-2xl text-[#808bf5]">Social Square</h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Building connections that matter</p>
                </div>

                <div className="flex gap-8 flex-wrap justify-center">
                    {/* <div className="text-center md:text-left">
                        <h4 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>Product</h4>
                        <ul className="space-y-2 list-none p-0 m-0">
                            <li><Link to="/help" className={`text-sm hover:text-[#808bf5] transition ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Help Center</Link></li>
                            <li><Link to="/help" className={`text-sm hover:text-[#808bf5] transition ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Support</Link></li>
                        </ul>
                    </div>
                    <div className="text-center md:text-left">
                        <h4 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>Company</h4>
                        <ul className="space-y-2 list-none p-0 m-0">
                            <li><Link to="/contact" className={`text-sm hover:text-[#808bf5] transition ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Contact Us</Link></li>
                        </ul>
                    </div>
                    <div className="text-center md:text-left">
                        <h4 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>Legal</h4>
                        <ul className="space-y-2 list-none p-0 m-0">
                            <li><a href="#privacy" className={`text-sm hover:text-[#808bf5] transition ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Privacy Policy</a></li>
                            <li><a href="#terms" className={`text-sm hover:text-[#808bf5] transition ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Terms of Service</a></li>
                        </ul>
                    </div> */}

                    <div className={`max-w-6xl mx-auto text-center ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                        <p className={`text-[12px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>&copy; 2026 Social Square. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;