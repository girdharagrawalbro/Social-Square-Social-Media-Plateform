import React from 'react';
import { useCreatorAnalytics } from '../../hooks/queries/useAuthQueries';

const CreatorAnalytics = ({ userId }) => {
    const { data: analytics, isLoading } = useCreatorAnalytics(userId);

    if (isLoading) return (
        <div className="p-4 flex flex-col gap-4 animate-pulse">
            <div className="h-32 bg-[var(--surface-2)] rounded-3xl" />
            <div className="h-64 bg-[var(--surface-2)] rounded-3xl" />
        </div>
    );

    if (!analytics) return <p className="text-center text-[var(--text-sub)] py-8">No analytics data available yet.</p>;

    const { stats, topPosts } = analytics;

    return (
        <div className="flex flex-col gap-6 p-1">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--surface-2)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Total Views</span>
                    <span className="text-2xl font-black text-[#808bf5]">{stats.totalViews.toLocaleString()}</span>
                    <span className="text-[9px] text-green-500 font-medium">↑ Growing</span>
                </div>
                <div className="bg-[var(--surface-2)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Engagement</span>
                    <span className="text-2xl font-black text-pink-500">{stats.engagementRate}%</span>
                    <span className="text-[9px] text-[var(--text-sub)]">Likes + Comments</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--surface-2)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Posts</span>
                    <span className="text-2xl font-black text-indigo-500">{stats.totalPosts}</span>
                </div>
                <div className="bg-[var(--surface-2)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider">Avg per Post</span>
                    <span className="text-2xl font-black text-orange-500">{Math.round(stats.totalViews / (stats.totalPosts || 1))}</span>
                </div>
            </div>

            {/* Top Posts */}
            <div>
                <h4 className="text-sm font-bold text-[var(--text-main)] mb-3 px-1">Top Performing Posts</h4>
                <div className="flex flex-col gap-2">
                    {topPosts.map((post, idx) => (
                        <div key={post.id} className="flex items-center gap-3 p-2 bg-[var(--surface-1)] rounded-2xl border border-[var(--border-color)] hover:bg-[var(--surface-2)] transition cursor-pointer">
                            <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] overflow-hidden flex-shrink-0">
                                {post.image ? <img src={post.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-center p-1">{post.caption?.slice(0, 20)}</div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-[var(--text-main)] truncate m-0">{post.caption || "No caption"}</p>
                                <div className="flex gap-3 mt-0.5">
                                    <span className="text-[10px] text-[var(--text-sub)]">👁️ {post.views}</span>
                                    <span className="text-[10px] text-[var(--text-sub)]">❤️ {post.likes}</span>
                                    <span className="text-[10px] text-[var(--text-sub)]">💬 {post.comments}</span>
                                </div>
                            </div>
                            <div className="text-xs font-bold text-[#808bf5] pr-2">#{idx + 1}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CreatorAnalytics;
