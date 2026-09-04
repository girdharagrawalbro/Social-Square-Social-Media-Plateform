import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from '../../utils/toast';
import ActiveSessions from './ActiveSessions';
import {
    useActivityPosts, useActivitySaved, useActivityLiked,
    useActivityComments, useActivityStories, useActivityInteractions,
    useActivityMuted, useActivityNotInterested, useActivityInterested, useActivityTimeSpent,
    useActivityAccount,
} from '../../hooks/queries/useActivityQueries';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDur(secs) {
    if (!secs) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

function EmptyState({ icon, title, desc }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-5xl">{icon}</span>
            <p className="text-base font-bold text-gray-700 m-0">{title}</p>
            <p className="text-xs text-gray-400 m-0 max-w-xs">{desc}</p>
        </div>
    );
}

function Loader() {
    return (
        <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-4 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

const FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100%25" height="100%25" viewBox="0 0 24 24" fill="%23e2e8f0"%3E%3Cpath d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/%3E%3C/svg%3E';

function PostGrid({ posts }) {
    const navigate = useNavigate();
    if (!posts?.length) return <EmptyState icon="📭" title="Nothing here yet" desc="Posts you create, save, or like will appear here." />;
    return (
        <div className="grid grid-cols-3 gap-1">
            {posts.map(p => {
                const thumb = p.videoThumbnail || p.image_url || (p.image_urls && p.image_urls[0]);
                return (
                    <div key={p._id} onClick={() => navigate(`/post/${p._id}`)}
                        className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer group">
                        {thumb ? (
                            <img src={thumb} alt="" 
                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : p.video ? (
                            <video src={p.video} className="w-full h-full object-cover" muted />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-indigo-50 to-purple-50">
                                <p className="text-[10px] text-gray-600 line-clamp-4 text-center leading-tight">{p.caption || ''}</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-white text-xs font-bold">{timeAgo(p.createdAt)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── TAB: Posts & Content ─────────────────────────────────────────────────────
function PostsTab() {
    const [sub, setSub] = useState('my_posts');
    const { data: postsData, isLoading: l1 } = useActivityPosts();
    const { data: savedData, isLoading: l2 } = useActivitySaved();
    const { data: likedData, isLoading: l3 } = useActivityLiked();
    const { data: commentsData, isLoading: l4 } = useActivityComments();

    const subTabs = [
        { id: 'my_posts', label: 'My Posts' },
        { id: 'saved', label: 'Saved' },
        { id: 'liked', label: 'Liked' },
        { id: 'commented', label: 'Commented' },
    ];

    return (
        <div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                {subTabs.map(t => (
                    <button key={t.id} onClick={() => setSub(t.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-0 cursor-pointer transition-all ${sub === t.id ? 'bg-[#4f46e5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {t.label}
                    </button>
                ))}
            </div>
            {sub === 'my_posts' && (l1 ? <Loader /> : <PostGrid posts={postsData?.posts} />)}
            {sub === 'saved' && (l2 ? <Loader /> : <PostGrid posts={savedData?.posts} />)}
            {sub === 'liked' && (l3 ? <Loader /> : <PostGrid posts={likedData?.posts} />)}
            {sub === 'commented' && (
                l4 ? <Loader /> : !commentsData?.comments?.length ? (
                    <EmptyState icon="💬" title="No comments yet" desc="Comments you leave on posts will show here." />
                ) : (
                    <div className="space-y-3">
                        {commentsData.comments.map(c => {
                            const postThumb = c.postId?.image_url || (c.postId?.image_urls && c.postId.image_urls[0]);
                            return (
                                <div key={c._id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    {postThumb && <img src={postThumb} alt="" 
                                        onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-700 font-medium line-clamp-2 m-0">"{c.content}"</p>
                                        <p className="text-[10px] text-gray-400 m-0 mt-1">{timeAgo(c.createdAt)} · on {c.postId?.user?.fullname || 'a post'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}

// ─── TAB: Story Archive ───────────────────────────────────────────────────────
function StoryArchiveTab() {
    const { data, isLoading } = useActivityStories();
    if (isLoading) return <Loader />;
    const stories = data?.stories || [];
    if (!stories.length) return <EmptyState icon="🎞️" title="No stories yet" desc="All your stories — including expired ones — will appear here." />;
    return (
        <div>
            <p className="text-xs text-gray-400 mb-3 font-medium">Total: {data?.total || 0} stories · Showing {stories.length}</p>
            <div className="grid grid-cols-3 gap-2">
                {stories.map(s => (
                    <div key={s._id} className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-200 border border-gray-100">
                        {s.media?.type === 'video' ? (
                            <video src={s.media.url} className="w-full h-full object-cover" muted />
                        ) : (
                            <img src={s.media?.thumbnailUrl || s.media?.url} alt="" className="w-full h-full object-cover" />
                        )}
                        {s.isExpired && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold px-2 py-1 bg-black/40 rounded-full">Expired</span>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                            <p className="text-white text-[9px] m-0">{timeAgo(s.createdAt)}</p>
                            {s.viewers?.length > 0 && <p className="text-white/70 text-[9px] m-0">{s.viewers.length} views</p>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── TAB: Interactions Received ───────────────────────────────────────────────
function InteractionsTab() {
    const [filter, setFilter] = useState('');
    const { data, isLoading } = useActivityInteractions(filter);
    const filters = [
        { id: '', label: 'All' }, { id: 'like', label: '❤️ Likes' },
        { id: 'comment', label: '💬 Comments' }, { id: 'follow', label: '👤 Follows' },
        { id: 'mention', label: '@️ Mentions' },
    ];
    const typeIcon = { like: '❤️', comment: '💬', follow: '👤', mention: '@', follow_request: '📩' };
    const typeLabel = { like: 'liked your post', comment: 'commented on your post', follow: 'followed you', mention: 'mentioned you', follow_request: 'sent a follow request' };

    return (
        <div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                {filters.map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-0 cursor-pointer transition-all ${filter === f.id ? 'bg-[#4f46e5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {f.label}
                    </button>
                ))}
            </div>
            {isLoading ? <Loader /> : !data?.interactions?.length ? (
                <EmptyState icon="🔔" title="No interactions yet" desc="Likes, comments, and follows from others will appear here." />
            ) : (
                <div className="space-y-2">
                    {data.interactions.map(n => (
                        <div key={n._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <img src={n.sender?.profile_picture || '/default-avatar.png'} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-800 m-0">
                                    <span className="font-bold">{n.sender?.fullname}</span>
                                    <span className="text-gray-500"> {typeLabel[n.type] || n.type}</span>
                                </p>
                                <p className="text-[10px] text-gray-400 m-0 mt-0.5">{timeAgo(n.createdAt)}</p>
                            </div>
                            <span className="text-lg flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── TAB: Account Activity ────────────────────────────────────────────────────
function AccountTab() {
    const [sub, setSub] = useState('following');
    const { data, isLoading, unblock } = useActivityAccount();
    const { data: mutedData, isLoading: ml, unmute } = useActivityMuted();
    const navigate = useNavigate();

    const subTabs = [
        { id: 'following', label: 'Following' }, { id: 'followers', label: 'Followers' },
        { id: 'blocked', label: 'Blocked' }, { id: 'muted', label: 'Muted' },
    ];

    const UserRow = ({ u, action, actionLabel, actionColor = 'text-red-500' }) => (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <img src={u.profile_picture || '/default-avatar.png'} alt="" className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"
                onClick={() => navigate(`/profile/${u._id}`)} />
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${u._id}`)}>
                <p className="text-xs font-bold text-gray-800 m-0 truncate">{u.fullname}</p>
                <p className="text-[10px] text-gray-400 m-0">@{u.username}</p>
            </div>
            {action && (
                <button onClick={action} className={`text-xs font-bold border-0 bg-transparent cursor-pointer ${actionColor} hover:opacity-70 transition flex-shrink-0`}>
                    {actionLabel}
                </button>
            )}
        </div>
    );

    return (
        <div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                {subTabs.map(t => (
                    <button key={t.id} onClick={() => setSub(t.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-0 cursor-pointer transition-all ${sub === t.id ? 'bg-[#4f46e5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {t.label}
                    </button>
                ))}
            </div>
            {(sub === 'following' || sub === 'followers' || sub === 'blocked') && (
                isLoading ? <Loader /> : (() => {
                    const list = sub === 'following' ? data?.following : sub === 'followers' ? data?.followers : data?.blockedUsers;
                    if (!list?.length) return <EmptyState icon="👥" title={`No ${sub} yet`} desc="" />;
                    return (
                        <div className="space-y-2">
                            {list.map(u => (
                                <UserRow key={u._id} u={u}
                                    action={sub === 'blocked' ? () => {
                                        unblock.mutate(u._id, { onSuccess: () => toast.success(`Unblocked ${u.fullname}`) });
                                    } : null}
                                    actionLabel="Unblock"
                                />
                            ))}
                        </div>
                    );
                })()
            )}
            {sub === 'muted' && (
                ml ? <Loader /> : !mutedData?.mutedUsers?.length ? (
                    <EmptyState icon="🔇" title="No muted accounts" desc="Accounts you mute will appear here." />
                ) : (
                    <div className="space-y-2">
                        {mutedData.mutedUsers.map(u => (
                            <UserRow key={u._id} u={u}
                                action={() => unmute.mutate(u._id, { onSuccess: () => toast.success(`Unmuted ${u.fullname}`) })}
                                actionLabel="Unmute" actionColor="text-[#4f46e5]"
                            />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}

// ─── TAB: Interested ─────────────────────────────────────────────────────────
function InterestedTab() {
    const { data, isLoading, undo } = useActivityInterested();
    const navigate = useNavigate();
    if (isLoading) return <Loader />;
    const posts = data?.posts || [];
    if (!posts.length) return <EmptyState icon="👍" title="No interested posts" desc="Posts you mark as 'Interested' will appear here." />;
    return (
        <div className="space-y-3">
            {posts.map(p => {
                const thumb = p.videoThumbnail || p.image_url || (p.image_urls && p.image_urls[0]);
                return (
                    <div key={p._id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 items-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 cursor-pointer" onClick={() => navigate(`/post/${p._id}`)}>
                            {thumb ? <img src={thumb} alt="" 
                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                                className="w-full h-full object-cover" /> :
                                p.video ? <video src={p.video} className="w-full h-full object-cover" muted /> :
                                    <div className="w-full h-full flex items-center justify-center"><span className="text-gray-400 text-xs">📄</span></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 m-0 line-clamp-2">{p.caption || 'Post'}</p>
                            <p className="text-[10px] text-gray-400 m-0 mt-1">by {p.user?.fullname || 'Unknown'} · {timeAgo(p.createdAt)}</p>
                        </div>
                        <button onClick={() => undo.mutate(p._id, { onSuccess: () => toast.success('Removed!') })}
                            className="text-xs font-bold text-red-500 border border-red-500/20 bg-red-500/5 rounded-lg px-2 py-1 cursor-pointer hover:bg-red-500/10 transition flex-shrink-0">
                            Remove
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ─── TAB: Not Interested ─────────────────────────────────────────────────────
function NotInterestedTab() {
    const { data, isLoading, undo } = useActivityNotInterested();
    const navigate = useNavigate();
    if (isLoading) return <Loader />;
    const posts = data?.posts || [];
    if (!posts.length) return <EmptyState icon="🙈" title="Nothing dismissed" desc="Posts you mark as 'Not Interested' will appear here so you can undo." />;
    return (
        <div className="space-y-3">
            {posts.map(p => {
                const thumb = p.videoThumbnail || p.image_url || (p.image_urls && p.image_urls[0]);
                return (
                    <div key={p._id} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 items-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 cursor-pointer" onClick={() => navigate(`/post/${p._id}`)}>
                            {thumb ? <img src={thumb} alt="" 
                                onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE; }}
                                className="w-full h-full object-cover" /> :
                                p.video ? <video src={p.video} className="w-full h-full object-cover" muted /> :
                                    <div className="w-full h-full flex items-center justify-center"><span className="text-gray-400 text-xs">📄</span></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 m-0 line-clamp-2">{p.caption || 'Post'}</p>
                            <p className="text-[10px] text-gray-400 m-0 mt-1">by {p.user?.fullname || 'Unknown'} · {timeAgo(p.createdAt)}</p>
                        </div>
                        <button onClick={() => undo.mutate(p._id, { onSuccess: () => toast.success('Restored!') })}
                            className="text-xs font-bold text-[#4f46e5] border border-[#4f46e5]/20 bg-[#4f46e5]/5 rounded-lg px-2 py-1 cursor-pointer hover:bg-[#4f46e5]/10 transition flex-shrink-0">
                            Undo
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ─── TAB: Time Spent ─────────────────────────────────────────────────────────
function TimeSpentTab() {
    const { data, isLoading } = useActivityTimeSpent();
    if (isLoading) return <Loader />;
    const stats = data?.stats || [];
    const totalSecs = stats.reduce((a, s) => a + s.durationSeconds, 0);
    const maxSecs = Math.max(...stats.map(s => s.durationSeconds), 1);
    const last7 = stats.slice(-7);
    const avg7 = last7.reduce((a, s) => a + s.durationSeconds, 0) / 7;

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-[#4f46e5]/10 to-[#7c3aed]/10 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-[#4f46e5] uppercase tracking-wider m-0">This Month</p>
                    <p className="text-2xl font-black text-gray-800 m-0 mt-1">{fmtDur(totalSecs)}</p>
                    <p className="text-[10px] text-gray-400 m-0 mt-0.5">total time on app</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider m-0">Daily Avg (7d)</p>
                    <p className="text-2xl font-black text-gray-800 m-0 mt-1">{fmtDur(Math.round(avg7))}</p>
                    <p className="text-[10px] text-gray-400 m-0 mt-0.5">per day average</p>
                </div>
            </div>

            {/* Bar Chart */}
            <div>
                <p className="text-xs font-bold text-gray-600 mb-3">Last 30 Days</p>
                <div className="flex items-end gap-1 h-40 bg-gray-50 rounded-2xl p-4">
                    {stats.map((s, i) => {
                        const pct = (s.durationSeconds / maxSecs) * 100;
                        const isToday = i === stats.length - 1;
                        return (
                            <div key={s.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                    {fmtDur(s.durationSeconds)}
                                </div>
                                <div className="w-full rounded-t-sm transition-all duration-500"
                                    style={{
                                        height: `${Math.max(pct, s.durationSeconds > 0 ? 3 : 0)}%`,
                                        background: isToday ? '#4f46e5' : s.durationSeconds > 0 ? '#a5b4fc' : '#e5e7eb',
                                    }} />
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-1 px-4">
                    <span className="text-[9px] text-gray-400">30 days ago</span>
                    <span className="text-[9px] text-[#4f46e5] font-bold">Today</span>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs text-amber-700 m-0">
                    <span className="font-bold">ℹ️ Note:</span> Time is tracked only while the app is open in your browser. It is recorded when you close or switch tabs.
                </p>
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ActivityLog = () => {
    const [activeTab, setActiveTab] = useState('posts');

    const activityTabs = [
        { id: 'posts', label: 'Posts & Content', icon: 'pi-file', desc: 'Your posts, saves & likes' },
        { id: 'stories', label: 'Story Archive', icon: 'pi-clock', desc: 'All stories incl. expired' },
        { id: 'interactions', label: 'Interactions', icon: 'pi-heart', desc: 'Likes, comments & follows received' },
        { id: 'account', label: 'Account Activity', icon: 'pi-users', desc: 'Following, blocked & muted' },
        { id: 'not_interested', label: 'Not Interested', icon: 'pi-eye-slash', desc: 'Dismissed posts' },
        { id: 'time', label: 'Time Spent', icon: 'pi-chart-bar', desc: 'Daily usage graph' },
    ];

    const securityTabs = [
        { id: 'sessions', label: 'Active Sessions', icon: 'pi-shield', desc: 'Logged-in devices & 2FA' },
    ];

    return (
        <div className="px-4 py-4 max-w-5xl h-full mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Helmet><title>Activity & Security | Social Square</title></Helmet>

            <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center flex-shrink-0">
                    <i className="pi pi-history text-white text-sm"></i>
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[var(--text-main)] m-0">Activity & Security</h2>
                    <p className="text-xs text-[var(--text-sub)] opacity-70 tracking-wide font-medium m-0">Only you can see this · Your history & login activity</p>
                </div>
            </div>

            {/* Mobile horizontal tabs */}
            <div className="flex md:hidden overflow-x-auto gap-2 pb-3 mb-4 no-scrollbar">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider self-center whitespace-nowrap pr-1">Activity</span>
                {activityTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${activeTab === t.id ? 'bg-[#4f46e5] text-white border-[#4f46e5] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                        <i className={`pi ${t.icon} text-xs`}></i>{t.label}
                    </button>
                ))}
                <span className="w-px h-6 bg-gray-200 self-center mx-1 flex-shrink-0"></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider self-center whitespace-nowrap pr-1">Security</span>
                {securityTabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${activeTab === t.id ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                        <i className={`pi ${t.icon} text-xs`}></i>{t.label}
                    </button>
                ))}
            </div>

            {/* Desktop two-column */}
            <div className="flex flex-col md:flex-row gap-6 md:h-[calc(100vh-220px)]">
                {/* Desktop Sidebar — sticky, scrollable */}
                <div className="hidden md:flex flex-col w-60 flex-shrink-0 space-y-1 pr-4 border-r border-gray-100 overflow-y-auto no-scrollbar sticky top-0">
                    {/* Activity group */}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-0.5 m-0">Your Activity</p>
                    {activityTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-none cursor-pointer text-left transition-all ${activeTab === t.id ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}>
                            <i className={`pi ${t.icon} text-base`}></i>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs font-bold leading-snug">{t.label}</span>
                                <span className={`text-[9px] truncate mt-0.5 ${activeTab === t.id ? 'text-[#4f46e5]/70' : 'text-gray-400'}`}>{t.desc}</span>
                            </div>
                            {activeTab === t.id && <i className="pi pi-chevron-right text-[10px] opacity-40"></i>}
                        </button>
                    ))}

                    {/* Separator */}
                    <div className="border-t border-dashed border-gray-200 my-2 mx-4"></div>

                    {/* Security group */}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pb-0.5 m-0">Security</p>
                    {securityTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-none cursor-pointer text-left transition-all ${activeTab === t.id ? 'bg-red-50 text-red-500' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}>
                            <i className={`pi ${t.icon} text-base ${activeTab === t.id ? 'text-red-500' : ''}`}></i>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs font-bold leading-snug">{t.label}</span>
                                <span className={`text-[9px] truncate mt-0.5 ${activeTab === t.id ? 'text-red-400' : 'text-gray-400'}`}>{t.desc}</span>
                            </div>
                            {activeTab === t.id && <i className="pi pi-chevron-right text-[10px] opacity-40"></i>}
                        </button>
                    ))}
                </div>

                {/* Right Content Panel — scrollable */}
                <div className="flex-1 min-w-0 overflow-y-auto p-4 min-h-[400px] md:min-h-0">
                    {activeTab === 'posts' && <PostsTab />}
                    {activeTab === 'stories' && <StoryArchiveTab />}
                    {activeTab === 'interactions' && <InteractionsTab />}
                    {activeTab === 'account' && <AccountTab />}
                    {activeTab === 'not_interested' && <NotInterestedTab />}
                    {activeTab === 'interested' && <InterestedTab />}
                    {activeTab === 'time' && <TimeSpentTab />}
                    {activeTab === 'sessions' && (
                        <div className="animate-in fade-in duration-300">
                            <ActiveSessions />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { PostsTab, StoryArchiveTab, InteractionsTab, AccountTab, NotInterestedTab, InterestedTab, TimeSpentTab };
export default ActivityLog;
