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
            <div className="bg-gradient-to-r from-themeStart to-themeEnd text-white py-20 px-8 min-h-[60vh] flex items-center">
                <section className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                    <div className="flex-1 max-w-xl">
                        <h1 className="font-pacifico text-6xl md:text-7xl mb-4">Social Square</h1>
                        <p className="text-2xl font-semibold mb-4">AI-powered social platform with features you’ve never seen before</p>
                        <p className="text-lg leading-relaxed mb-8 opacity-95">
                            Join thousands of users sharing their moments, connecting with friends,
                            and building meaningful relationships in a safe and vibrant social space.
                        </p>
                        <div className="flex gap-4 flex-wrap">
                            <Link to="/signup" className="bg-white text-[#6366f1] border-2 border-white px-8 py-3 rounded-xl font-bold transition transform hover:-translate-y-1 hover:shadow-lg">Get Started</Link>
                            <Link to="/login" className="border-2 border-white text-white px-8 py-3 rounded-xl font-bold transition transform hover:-translate-y-1 hover:bg-white/10 backdrop-blur-sm">Sign In</Link>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center w-full">
                        <PromoVideo />
                    </div>
                </section>
            </div>

            {/* Features Section */}
            <section className="py-24 px-8 bg-[var(--surface-1)]">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-[var(--text-main)] mb-4">Why Choose Social Square?</h2>
                        <p className="text-lg text-[var(--text-sub)] max-w-2xl mx-auto">Explore the cutting-edge features that make us the next generation of social connectivity.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-[#6366f1]/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-[#6366f1]/10 rounded-2xl flex items-center justify-center mb-6 text-[#6366f1] text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-sparkles"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">AI Magic Tools</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Unleash your creativity with integrated AI. Generate stunning images and compelling captions directly in the post creator.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-pink-500/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6 text-pink-500 text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-video"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Multimedia Feed</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Experience a fluid, high-performance feed with intersection-based auto-play videos and seamless scrolling.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-purple-500/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-500 text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-lock"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Privacy Redefined</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Share anonymously with confessions or set time-locks on your content. Your privacy is our priority.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-orange-500/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 text-orange-500 text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-users"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Collaboration</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Co-create with friends using collaborative posts. Join communities and groups that match your interests.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-green-500/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 text-green-500 text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-chart-line"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Gamification</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Level up, maintain daily streaks, and earn XP. Our gamified experience makes social interaction rewarding.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="p-8 rounded-3xl bg-[var(--surface-2)] border border-[var(--border-color)] hover:border-cyan-500/50 transition-all duration-300 group hover:-translate-y-2">
                            <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 text-cyan-500 text-2xl group-hover:scale-110 transition-transform">
                                <i className="pi pi-comments"></i>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-3">Real-time Chat</h3>
                            <p className="text-[var(--text-sub)] leading-relaxed">
                                Instant messaging with presence tracking, typing indicators, and multimedia sharing for seamless conversation.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

        </>
    );
};

export default Landing;
