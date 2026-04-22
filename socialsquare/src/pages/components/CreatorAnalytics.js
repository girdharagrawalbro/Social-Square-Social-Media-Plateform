import React from 'react';
import { useCreatorAnalytics } from '../../hooks/queries/useAuthQueries';

const CreatorAnalytics = ({ userId }) => {
    const { data: analytics, isLoading } = useCreatorAnalytics(userId);

    if (isLoading) return (
        <div className="p-4 flex flex-col gap-6 animate-pulse">
            <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-[var(--surface-2)] rounded-3xl" />
                <div className="h-24 bg-[var(--surface-2)] rounded-3xl" />
            </div>
            <div className="h-64 bg-[var(--surface-2)] rounded-3xl" />
        </div>
    );

    if (!analytics) return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 bg-[var(--surface-2)] rounded-full flex items-center justify-center mb-4 opacity-50">
                <i className="pi pi-chart-bar text-4xl text-[var(--text-sub)]"></i>
            </div>
            <h3 className="m-0 text-[var(--text-main)] font-bold text-lg">No Analytics Yet</h3>
            <p className="text-[var(--text-sub)] text-sm max-w-[240px] mt-2 leading-relaxed">
                Start posting content to see insights and engagement metrics here.
            </p>
        </div>
    );

    const { stats, topPosts } = analytics;

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Glassmorphic Stats Grid */}
            <div className="grid grid-cols-2 gap-4 px-1">
                <div className="relative overflow-hidden group bg-gradient-to-br from-indigo-500/10 to-blue-500/10 p-5 rounded-3xl border border-indigo-500/20 backdrop-blur-sm transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                    <span className="text-[10px] uppercase font-black text-indigo-500/70 tracking-widest block mb-2">Total Impressions</span>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-indigo-600 leading-none">{stats.totalViews.toLocaleString()}</span>
                        <span className="text-[10px] text-indigo-500 font-bold mb-1">Views</span>
                    </div>
                </div>

                <div className="relative overflow-hidden group bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-5 rounded-3xl border border-pink-500/20 backdrop-blur-sm transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-pink-500/10 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                    <span className="text-[10px] uppercase font-black text-pink-500/70 tracking-widest block mb-2">Engagement</span>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-pink-600 leading-none">{stats.engagementRate}%</span>
                        <span className="text-[10px] text-pink-500 font-bold mb-1">Rate</span>
                    </div>
                </div>

                <div className="bg-[var(--surface-2)] p-5 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center transition-all hover:bg-[var(--surface-1)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider mb-1">Content Count</span>
                    <span className="text-2xl font-black text-[var(--text-main)]">{stats.totalPosts}</span>
                    <span className="text-[10px] text-[var(--text-sub)] font-medium">Total Posts</span>
                </div>

                <div className="bg-[var(--surface-2)] p-5 rounded-3xl border border-[var(--border-color)] flex flex-col gap-1 items-center justify-center text-center transition-all hover:bg-[var(--surface-1)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider mb-1">Post Performance</span>
                    <span className="text-2xl font-black text-orange-500">{Math.round(stats.totalViews / (stats.totalPosts || 1))}</span>
                    <span className="text-[10px] text-[var(--text-sub)] font-medium">Avg. Views</span>
                </div>
            </div>

            {/* Performance Chart / List */}
            <div className="px-1">
                <div className="flex items-center justify-between mb-5">
                    <h4 className="text-base font-black text-[var(--text-main)] m-0">Hall of Fame</h4>
                    <span className="text-[10px] text-indigo-500 font-bold bg-indigo-500/10 px-2 py-1 rounded-full">Top Performers</span>
                </div>
                
                <div className="flex flex-col gap-3">
                    {topPosts.map((post, idx) => (
                        <div 
                            key={post.id} 
                            className="group flex items-center gap-4 p-3 bg-[var(--surface-2)] rounded-[24px] border border-[var(--border-color)] hover:border-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/5 active:scale-[0.98]"
                        >
                            <div className="relative w-14 h-14 rounded-2xl bg-[var(--surface-1)] overflow-hidden flex-shrink-0 shadow-sm border border-[var(--border-color)]">
                                {post.image ? (
                                    <img src={post.image} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-center p-2 text-[var(--text-sub)]">
                                        {post.caption?.slice(0, 15) || "📝"}
                                    </div>
                                )}
                                <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-br-lg shadow-sm">
                                    #{idx + 1}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--text-main)] truncate m-0 group-hover:text-indigo-600 transition-colors">
                                    {post.caption || "Untitled Post"}
                                </p>
                                <div className="flex gap-4 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <i className="pi pi-eye text-[10px] text-indigo-500"></i>
                                        <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.views.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <i className="pi pi-heart-fill text-[10px] text-pink-500"></i>
                                        <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.likes.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <i className="pi pi-comment text-[10px] text-blue-500"></i>
                                        <span className="text-[10px] font-bold text-[var(--text-sub)]">{post.comments.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="pi pi-chevron-right text-xs text-indigo-500"></i>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CreatorAnalytics;
