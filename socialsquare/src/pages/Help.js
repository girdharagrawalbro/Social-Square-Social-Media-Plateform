import React from 'react';
import { Link } from 'react-router-dom';
import Bg from './components/Bg';
import { useDarkMode } from '../context/DarkModeContext';

const Help = () => {
    const { isDark } = useDarkMode();

    return (
        <Bg>
            <div className="w-full max-w-4xl mx-auto text-left">
                <div className={`rounded-2xl border transition-all duration-200 p-4 sm:p-6 md:p-8 ${isDark ? 'bg-black/40 border-gray-800' : 'bg-white/95 border-gray-100'}`}>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Help & How It Works</h1>
                    <p className={`text-sm sm:text-base mb-6 sm:mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Getting started is simple: create an account, complete your profile, and begin posting or chatting with your community.
                    </p>

                    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Key Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                        {[
                            { emoji: '✨', title: 'Share Your Thoughts', desc: 'Post photos and updates. Others can like and comment on your posts.' },
                            { emoji: '💬', title: 'Engage with the Community', desc: 'Explore posts and interact with people you follow.' },
                            { emoji: '📡', title: 'Real-time Chat', desc: 'Message friends instantly through the chat panel.' },
                            { emoji: '🔔', title: 'Notifications', desc: 'Receive updates when someone interacts with your content.' }
                        ].map((feat, i) => (
                            <div key={i} className={`rounded-xl border p-4 transition-colors duration-200 ${isDark ? 'bg-white/5 border-gray-800 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">{feat.emoji}</span>
                                    <p className="font-bold text-base sm:text-lg">{feat.title}</p>
                                </div>
                                <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{feat.desc}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="text-lg sm:text-xl font-semibold mb-4">Quick Start</h2>
                    <ol className={`list-decimal list-inside space-y-3 text-sm sm:text-base mb-8 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <li>Create an account on the Sign Up page.</li>
                        <li>Complete your profile and add a photo.</li>
                        <li>Use the Newpost panel to publish your first post.</li>
                        <li>Follow users and join conversations.</li>
                    </ol>

                    <div className={`border-t pt-6 ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                        <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Need more help? Visit our{' '}
                            <Link to="/contact" className="text-[#808bf5] font-bold hover:underline">
                                Contact page
                            </Link>
                            .
                        </p>
                    </div>
                </div>
            </div>
        </Bg>
    );
}

export default Help;

