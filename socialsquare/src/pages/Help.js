import React from 'react';
import { Link } from 'react-router-dom';
import Bg from './components/Bg';

const Help = () => {
    return (
        <Bg>
            <div className="w-full max-w-4xl mx-auto text-left">
                <div className="rounded-2xl border border-gray-200 bg-white/95 p-4 sm:p-6 md:p-8">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Help & How It Works</h1>
                    <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">
                        Getting started is simple: create an account, complete your profile, and begin posting or chatting with your community.
                    </p>

                    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Key Features</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                        <div className="rounded-xl border border-gray-200 p-3 sm:p-4 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">✨</span>
                                <p className="font-semibold">Share Your Thoughts</p>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600">Post photos and updates. Others can like and comment on your posts.</p>
                        </div>

                        <div className="rounded-xl border border-gray-200 p-3 sm:p-4 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">💬</span>
                                <p className="font-semibold">Engage with the Community</p>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600">Explore posts and interact with people you follow.</p>
                        </div>

                        <div className="rounded-xl border border-gray-200 p-3 sm:p-4 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">📡</span>
                                <p className="font-semibold">Real-time Chat</p>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600">Message friends instantly through the chat panel.</p>
                        </div>

                        <div className="rounded-xl border border-gray-200 p-3 sm:p-4 bg-gray-50">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">🔔</span>
                                <p className="font-semibold">Notifications</p>
                            </div>
                            <p className="text-sm sm:text-base text-gray-600">Receive updates when someone interacts with your content.</p>
                        </div>
                    </div>

                    <h2 className="text-lg sm:text-xl font-semibold mb-3">Quick Start</h2>
                    <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-gray-700 mb-6">
                        <li>Create an account on the Sign Up page.</li>
                        <li>Complete your profile and add a photo.</li>
                        <li>Use the Newpost panel to publish your first post.</li>
                        <li>Follow users and join conversations.</li>
                    </ol>

                    <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm sm:text-base text-gray-700">
                            Need more help? Visit our{' '}
                            <Link to="/contact" className="text-themeStart font-semibold underline">
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
