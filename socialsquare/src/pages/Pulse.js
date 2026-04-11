import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../store/zustand/useAuthStore';
import { useNavigate } from 'react-router-dom';

const Pulse = () => {
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['pulse-trending'],
        queryFn: async () => {
            const res = await api.get('/api/post/trending');
            return res.data;
        },
        refetchInterval: 30000 // Refresh every 30s for 'live' pulse
    });

    const handleHaptic = () => {
        if (navigator.vibrate) navigator.vibrate(5);
    };

    return (
        <div className="w-full">
            <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
                {/* Header Header */}
                <div className="flex flex-col gap-2 mb-8 animate-float">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl pulse-gradient flex items-center justify-center text-white shadow-lg overflow-hidden relative">
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            <i className="pi pi-bolt text-xl relative z-10"></i>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-[var(--text-main)] to-[#808bf5] bg-clip-text text-transparent">
                            Social Pulse
                        </h1>
                    </div>
                    <p className="text-[var(--text-sub)] font-medium">What's happening right now across Social Square.</p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-[var(--surface-2)] rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                        {/* 1. Trending Hashtags */}
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-pink-500">#</span> Trending Tags
                            </h2>
                            <div className="flex flex-col gap-2">
                                {data?.hashtags?.map((t, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { handleHaptic(); navigate(`/search?q=${t.tag.slice(1)}`); }}
                                        className="group flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-2)] border border-transparent hover:border-[#808bf5] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg group-hover:text-[#808bf5] transition">{t.tag}</span>
                                            <span className="text-xs text-[var(--text-sub)]">{t.count} posts this week</span>
                                        </div>
                                        <i className="pi pi-arrow-right text-[var(--text-sub)] group-hover:translate-x-1 transition"></i>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 2. Top Creators (Rising Stars) */}
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-yellow-500">⭐</span> Rising Stars
                            </h2>
                            <div className="flex flex-col gap-3">
                                {data?.topUsers?.map((u, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { handleHaptic(); navigate(`/profile/${u.user._id}`); }}
                                        className="group flex items-center gap-4 p-3 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                                    >
                                        <div className="relative">
                                            <div className={`w-14 h-14 rounded-full overflow-hidden border-2 ${u.user.isOnline ? 'presence-glow' : 'border-white/10'}`}>
                                                <img src={u.user.profile_picture} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            {u.user.isOnline && <div className="presence-dot w-3 h-3 border-2 border-[var(--surface-2)]" />}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center">
                                            <span className="font-bold block leading-tight">{u.user.fullname}</span>
                                            <span className="text-xs text-[var(--text-sub)]">@{u.user.username}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-black text-[#808bf5]">{u.totalLikes}</span>
                                            <span className="text-[10px] text-[var(--text-sub)] uppercase">Likes</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 3. Hot Categories */}
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-blue-500">🔥</span> Hot Topics
                            </h2>
                            <div className="grid grid-cols-1 gap-4">
                                {data?.categories?.map((c, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { handleHaptic(); navigate(`/search?q=${c._id}`); }}
                                        className="relative p-5 rounded-3xl overflow-hidden group cursor-pointer"
                                        style={{ background: 'var(--surface-2)' }}
                                    >
                                        <div className="absolute top-0 right-0 w-32 h-32 pulse-gradient opacity-10 blur-3xl group-hover:opacity-30 transition" />
                                        <div className="relative z-10 flex flex-col">
                                            <span className="text-xs font-bold uppercase tracking-widest text-[#808bf5]">{i + 1}. Global Trend</span>
                                            <span className="text-2xl font-black mt-1 mb-2 capitalize">{c._id}</span>
                                            <div className="flex items-center gap-3 text-xs text-[var(--text-sub)] font-medium">
                                                <span>📊 {c.postCount} posts</span>
                                                <span>❤️ {c.totalLikes} likes</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                )}
            </div>
        </div>
    );
};

export default Pulse;
