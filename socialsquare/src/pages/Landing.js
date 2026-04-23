import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import useAuthStore from '../store/zustand/useAuthStore';

import PromoVideo from './components/PromoVideo';

const Landing = () => {
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const initialized = useAuthStore(s => s.initialized);
    const loading = useAuthStore(s => s.loading);

    useEffect(() => {
        if (initialized && !loading && user?.username) {
            navigate(`/${user.username}`, { replace: true });
        }
    }, [initialized, loading, user, navigate]);

    return (
        <>
            <Helmet>
                <title>Welcome to Social Square | Next-Gen AI Social Platform</title>
                <meta name="description" content="Discover the future of social media with Social Square. AI-powered tools, real-time chat, and a vibrant community await you." />
                <link rel="canonical" href="https://socialsquare.vercel.app/" />
            </Helmet>
            <div className="bg-gradient-to-r from-themeStart to-themeEnd text-white py-20 px-8">
                <section className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                    <div className="flex-1 max-w-xl">
                        <h1 className="font-pacifico text-6xl md:text-7xl mb-4">Social Square</h1>
                        <p className="text-2xl font-semibold mb-4">AI-powered social platform with features you’ve never seen before</p>
                        <p className="text-lg leading-relaxed mb-8 opacity-95">
                            Join thousands of users sharing their moments, connecting with friends,
                            and building meaningful relationships in a safe and vibrant social space.
                        </p>
                        <div className="flex gap-4 flex-wrap">
                            <Link to="/signup" className="bg-white text-[#667eea] border-2 border-white px-6 py-3 rounded-lg font-semibold transition transform hover:-translate-y-1 hover:bg-[#667eea]">Get Started</Link>
                            <Link to="/login" className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold transition transform hover:-translate-y-1 hover:bg-[#667eea]">Sign In</Link>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center w-full">
                        <PromoVideo />
                    </div>
                </section>
            </div>
        </>
    );
};

export default Landing;
