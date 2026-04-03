import React from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-r from-themeStart to-themeEnd text-white">
            <div className="flex-grow">
                <section className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between px-5 md:px-12 py-20 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                    <div className="flex-1 max-w-xl">
                        <h1 className="font-pacifico text-6xl md:text-7xl mb-4">Social Square</h1>
                        <p className="text-2xl font-semibold mb-4">Connect, Share, and Engage with Your Community</p>
                        <p className="text-lg leading-relaxed mb-8 opacity-95">
                            Join thousands of users sharing their moments, connecting with friends,
                            and building meaningful relationships in a safe and vibrant social space.
                        </p>
                        <div className="flex gap-4 flex-wrap">
                            <Link to="/signup" className="bg-white text-[#667eea] border-2 border-white px-6 py-3 rounded-lg font-semibold transition transform hover:-translate-y-1 hover:bg-[#667eea]">Get Started</Link>
                            <Link to="/login" className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold transition transform hover:-translate-y-1 hover:bg-[#667eea]">Sign In</Link>
                        </div>

                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <img className="max-w-full h-auto rounded-2xl shadow-2xl" src="https://i.ibb.co/3zgV9GB/image.png" alt="Social Square Community" />
                    </div>
                </section>
            </div>
            <footer className="bg-[var(--surface-1)] text-[var(--text-main)] py-10 px-5 border-t border-[var(--border-color)]">
                <div className="max-w-6xl mx-auto flex flex-wrap justify-between gap-8">
                    <div>
                        <h3 className="font-pacifico text-2xl text-[var(--text-main)]">Social Square</h3>
                        <p className="text-[var(--text-sub)]">Building connections that matter</p>
                    </div>
                    <div className="flex gap-8 flex-wrap">
                        <div>
                            <h4 className="font-semibold mb-2 text-[var(--text-main)]">Product</h4>
                            <Link to="/login" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Features</Link>
                            <Link to="/help" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Help Center</Link>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-[var(--text-main)]">Company</h4>
                            <Link to="/contact" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Contact Us</Link>
                            <Link to="/help" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Support</Link>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2 text-[var(--text-main)]">Legal</h4>
                            <a href="#privacy" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Privacy Policy</a>
                            <a href="#terms" className="block text-[var(--text-sub)] hover:text-[var(--text-main)] transition">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className="text-center border-t border-[var(--border-color)] mt-8 pt-6">
                    <p className="text-[12px] text-[var(--text-sub)]">&copy; 2026 Social Square. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
