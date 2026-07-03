import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import useAuthStore from '../store/zustand/useAuthStore';
import PromoVideo from './components/PromoVideo';

import scene5 from '../assets/promo/scene_5.png';
import scene3 from '../assets/promo/scene_3.png';
import scene7 from '../assets/promo/scene_7.png';
import scene8 from '../assets/promo/scene_8.png';

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

            <main className="bg-white text-slate-800 dark:bg-neutral-950 dark:text-neutral-200 transition-colors duration-300">
                {/* Hero Section */}
                <section className="relative min-h-[80vh] flex items-center py-16">
                    <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 items-center gap-16 z-10">
                        <div className="space-y-6 text-center lg:text-left">
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold tracking-widest uppercase text-sm">The Future of Interaction</span>
                            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                                Social Square <br />
                                <span className="italic font-normal text-indigo-600 dark:text-indigo-400">AI-Powered Socializing</span>
                            </h1>
                            <p className="text-lg md:text-xl text-slate-600 dark:text-neutral-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                                Experience a premium, safe, and vibrant ecosystem designed for meaningful connection. Our AI-augmented social environment prioritizes intellectual clarity and architectural elegance.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                                <Link to="/signup" className="bg-indigo-600 text-white px-10 py-3 w-48 rounded-full font-bold hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all transform active:scale-95 shadow-md shadow-indigo-200 dark:shadow-none text-center">
                                    Get Started
                                </Link>
                                <Link to="/login" className="border border-slate-300 dark:border-neutral-700 w-48 text-slate-700 dark:text-neutral-300 bg-white dark:bg-neutral-900 px-10 py-3 rounded-full font-bold hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all transform active:scale-95 text-center">
                                    Sign In
                                </Link>
                            </div>
                            <div className="flex items-center justify-center lg:justify-start gap-2 pt-6 text-slate-500 dark:text-neutral-500 text-sm">
                                <i className="pi pi-verified text-indigo-500"></i>
                                <span>Curated Community. Advanced Privacy. AI Integration.</span>
                            </div>
                        </div>

                        {/* Premium Hero Visual / Promo Video */}
                        <div className="relative flex justify-center items-center w-full">
                            <div className="w-full max-w-xl">
                                <PromoVideo />
                            </div>
                            {/* AI Insight Float */}
                            <div className="absolute -bottom-6 -left-6 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md p-3 rounded-2xl max-w-[260px] shadow-lg border border-indigo-50/80 dark:border-neutral-800 hidden sm:block">
                                <div className="flex items-center gap-2 mb-2">
                                    <i className="pi pi-sparkles text-indigo-600 dark:text-indigo-400"></i>
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">AI Insight</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-neutral-400 italic">"Your digital presence is resonating with like-minded creators in the Community hub."</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bento Features Section */}
                <section className="py-20 transition-colors duration-300">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16 max-w-2xl mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 md:text-4xl leading-tight">Why Choose Social Square?</h2>
                            <p className="text-slate-600 dark:text-neutral-400">Explore the cutting-edge features that make us the next generation of social connectivity, where technology meets architectural luxury.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Feature Card 1 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-sparkles"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">AI Magic Tools</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Unleash your creativity with integrated AI. Generate stunning images and compelling captions directly in the post creator.
                                </p>
                            </div>
                            {/* Feature Card 2 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-video"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Multimedia Feed</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Experience a fluid, high-performance feed with interaction-based auto-play videos and seamless scrolling for absolute immersion.
                                </p>
                            </div>
                            {/* Feature Card 3 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-lock"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Privacy Redefined</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Share anonymously with confessions or set time-locks on your content. Your digital footprint is yours to control.
                                </p>
                            </div>
                            {/* Feature Card 4 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-users"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Collaboration</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Co-create with friends using collaborative posts. Join niche communities and groups that match your refined interests.
                                </p>
                            </div>
                            {/* Feature Card 5 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-gift"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Gamification</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Level up, maintain daily streaks, and earn exclusive badges. Our gamified experience makes high-quality interaction rewarding.
                                </p>
                            </div>
                            {/* Feature Card 6 */}
                            <div className="group p-8 bg-slate-50 dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl hover:border-indigo-500/20 dark:hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-115 transition-transform text-indigo-600 dark:text-indigo-400 text-xl">
                                    <i className="pi pi-comments"></i>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Real-time Chat</h3>
                                <p className="text-slate-600 dark:text-neutral-400 leading-relaxed text-sm">
                                    Instant messaging with presence tracking, typing indicators, and high-fidelity multimedia sharing for seamless, natural conversation.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Experience Preview Section (Gallery Style) */}
                <section className="py-20 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="flex flex-col lg:flex-row items-center gap-16">
                            <div className="lg:w-1/2 space-y-6 order-2 lg:order-1">
                                <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                                    Architectural <br />
                                    <span className="italic font-normal text-indigo-600 dark:text-indigo-400">Social Design</span>
                                </h2>
                                <p className="text-lg text-slate-600 dark:text-neutral-400 leading-relaxed">
                                    Our interface is a canvas, not a billboard. We've removed the noise to let your content—and your connections—breathe.
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5"></div>
                                        <p className="text-slate-700 dark:text-neutral-300 text-sm md:text-base">
                                            <strong className="text-slate-900 dark:text-white font-semibold">Fluid Grids:</strong> Layouts that adapt perfectly to your device, maintaining visual balance.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5"></div>
                                        <p className="text-slate-700 dark:text-neutral-300 text-sm md:text-base">
                                            <strong className="text-slate-900 dark:text-white font-semibold">Glassmorphism:</strong> Depth communicated through soft blurs and ethereal light.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1.5"></div>
                                        <p className="text-slate-700 dark:text-neutral-300 text-sm md:text-base">
                                            <strong className="text-slate-900 dark:text-white font-semibold">Calm UX:</strong> No red notifications. No anxiety. Just elegant exploration.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:w-1/2 order-1 lg:order-2 grid grid-cols-2 gap-4">
                                <div className="space-y-4 pt-12">
                                    <div className="aspect-[9/16] rounded-2xl overflow-hidden shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-500 border border-slate-200/60 dark:border-neutral-800">
                                        <img src={scene7} alt="Minimalist social design art" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="aspect-[9/16] rounded-2xl overflow-hidden shadow-lg transform rotate-2 hover:rotate-0 transition-transform duration-500 border border-slate-200/60 dark:border-neutral-800">
                                        <img src={scene5} alt="Sophisticated social space" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="aspect-[9/16] rounded-2xl overflow-hidden shadow-lg transform rotate-6 hover:rotate-0 transition-transform duration-500 border border-slate-200/60 dark:border-neutral-800">
                                        <img src={scene8} alt="Premium user experience" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="aspect-[9/16] rounded-2xl overflow-hidden shadow-lg transform -rotate-2 hover:rotate-0 transition-transform duration-500 border border-slate-200/60 dark:border-neutral-800">
                                        <img src={scene3} alt="Social Square frontier" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-16">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[2rem] p-12 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
                            <div className="relative z-10 space-y-6 max-w-3xl mx-auto">
                                <h2 className="text-3xl md:text-5xl font-bold leading-tight">Ready to elevate your <br />social experience?</h2>
                                <p className="text-base md:text-lg opacity-90">Join an exclusive community where human connection meets artificial intelligence in a space designed for you.</p>
                                <div className="pt-4">
                                    <Link to="/signup" className="inline-block bg-white text-indigo-600 dark:bg-neutral-900 dark:text-white px-10 py-3 rounded-full w-48 font-bold hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all transform active:scale-95 shadow-md shadow-black/10">
                                        Get Started
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
};

export default Landing;
