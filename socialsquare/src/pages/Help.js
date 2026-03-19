import React from 'react';
import { Link } from 'react-router-dom';
import Bg from './components/Bg';

const Help = () => {
    return (
        <Bg>
            <div className="max-w-4xl mx-auto p-4 items-center text-center">
                <h1 className="text-3xl font-semibold mb-4">Help & How It Works</h1>
                <p className="text-gray-600 mb-6">
                    Getting started is easy! Register with your email, full name and a secure password. After registering you can log in and start sharing.
                </p>

                <h2 className="text-xl font-semibold mb-3 flex flex-col items-center justify-center">Key Features</h2>
                <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-3">
                        <span className="text-2xl">✨</span>
                        <div>
                            <div className="font-semibold">Share Your Thoughts</div>
                            <div className="text-gray-600">Post photos and updates; others can like and comment.</div>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-2xl">💬</span>
                                                
                        <div>
                            <div className="font-semibold">Engage with the Community</div>
                            <div className="text-gray-600">Explore posts and interact with people you follow.</div>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-2xl">📡</span>
                        <div>
                            <div className="font-semibold">Real-time Chat</div>
                            <div className="text-gray-600">Message friends instantly using our chat panel.</div>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                            <div className="font-semibold">Notifications</div>
                            <div className="text-gray-600">Receive updates when someone interacts with your content.</div>
                        </div>
                    </li>
                </ul>

                <h2 className="text-xl font-semibold mb-3">Quick Start</h2>
                <ol className="list-decimal list-inside space-y-2 mb-6 text-gray-600">
                    <li>Create an account on the Sign Up page.</li>
                    <li>Complete your profile and add a photo.</li>
                    <li>Use the "Newpost" panel to publish a post.</li>
                    <li>Follow users and join conversations.</li>
                </ol>
                <p>
                    Need more help? Visit our <Link to="/contact" className="text-blue-600">Contact</Link> page.
                </p>
            </div>
        </Bg>
    );
}

export default Help;
