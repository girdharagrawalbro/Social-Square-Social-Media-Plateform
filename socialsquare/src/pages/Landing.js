import React from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
    return (
        <div className="bg-gradient-to-r from-themeStart to-themeEnd text-white py-20 px-8">
            <section className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
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
    );
};

export default Landing;
