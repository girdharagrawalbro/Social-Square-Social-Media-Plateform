import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './components/Navbar';

const Landing = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-r from-themeStart to-themeEnd text-white">
            <Navbar />
            <div className="flex-grow">
                <section className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between px-5 md:px-12 py-20 gap-12">
                    <div className="flex-1 max-w-xl">
                        <h1 className="font-pacifico text-6xl md:text-7xl mb-4">Social Square</h1>
                        <p className="text-2xl font-semibold mb-4">Connect, Share, and Engage with Your Community</p>
                        <p className="text-lg leading-relaxed mb-8 opacity-95">
                            Join thousands of users sharing their moments, connecting with friends,
                            and building meaningful relationships in a safe and vibrant social space.
                        </p>
                        <div className="flex gap-4 flex-wrap">
                            <Link to="/signup" className="bg-white text-themeStart border-2 border-white px-6 py-3 rounded-lg font-semibold transition transform hover:-translate-y-1 hover:bg-themeStart hover:text-white">Get Started</Link>
                            <Link to="/login" className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold transition hover:bg-white hover:text-themeStart">Sign In</Link>
                        </div>

                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <img className="max-w-full h-auto rounded-2xl shadow-2xl" src="https://i.ibb.co/3zgV9GB/image.png" alt="Social Square Community" />
                    </div>
                </section>
            </div>
            <footer className="bg-gray-800 text-white py-10 px-5">
                <div className="max-w-6xl mx-auto flex flex-wrap justify-between gap-8">
                    <div>
                        <h3 className="font-pacifico text-2xl">Social Square</h3>
                        <p className="opacity-80">Building connections that matter</p>
                    </div>
                    <div className="flex gap-8 flex-wrap">
                        <div>
                            <h4 className="font-semibold mb-2">Product</h4>
                            <Link to="/login" className="block text-gray-300 hover:text-white">Features</Link>
                            <Link to="/help" className="block text-gray-300 hover:text-white">Help Center</Link>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Company</h4>
                            <Link to="/contact" className="block text-gray-300 hover:text-white">Contact Us</Link>
                            <Link to="/help" className="block text-gray-300 hover:text-white">Support</Link>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Legal</h4>
                            <a href="#privacy" className="block text-gray-300 hover:text-white">Privacy Policy</a>
                            <a href="#terms" className="block text-gray-300 hover:text-white">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className="text-center border-t border-gray-700 pt-3">
                    <p>&copy; 2026 Social Square. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
