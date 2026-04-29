import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useAuthStore, { api, getToken } from '../store/zustand/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import PostDetail from './components/PostDetail';
import AuditLogTab from './components/AuditLogTab';


const useAdmin = () => {
    const token = getToken();
    return useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
};

const Header = ({ user, onLock, onHome, onToggleSidebar }) => (
    <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[var(--surface-1)] border-b border-[var(--border-color)] px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
            <button onClick={onToggleSidebar} className="lg:hidden p-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] rounded-2xl transition-all border-0 cursor-pointer text-[var(--text-main)] shadow-sm flex items-center justify-center">
                <i className="pi pi-bars text-sm font-bold"></i>
            </button>
            <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight text-[var(--text-main)] m-0 flex items-center gap-2">
                    Admin
                </h1>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <img src={user?.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-[var(--surface-1)] shadow-sm" />
                <span className="text-xs font-bold text-[var(--text-main)]">{user?.fullname}</span>
            </div>
            <button onClick={onLock} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-2 rounded-2xl text-xs font-black transition-all border-0 cursor-pointer shadow-sm active:scale-95">
                <i className="pi pi-lock"></i> LOCK
            </button>
        </div>
    </div>
);

const UsersIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const PostsIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="7" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
);

const ReportIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16l-2 6 2 6H4z" />
    </svg>
);

const ChartIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="20" x2="20" y2="20" />
        <rect x="6" y="10" width="3" height="10" />
        <rect x="11" y="6" width="3" height="14" />
        <rect x="16" y="13" width="3" height="7" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="16" y1="3" x2="16" y2="7" />
        <line x1="8" y1="3" x2="8" y2="7" />
    </svg>
);

const FireIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2s4 4 4 8-4 8-4 8-4-3-4-8 4-8 4-8z" />
    </svg>
);
const AuditIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5h6M9 9h6M9 13h6M5 5h.01M5 9h.01M5 13h.01" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 3.46- .07-.02a1.65 1.65 0 0 0-2.18.66L15 21h-6l-.54-.98a1.65 1.65 0 0 0-2.18-.66l-.07.02-2-3.46.06-.06A1.65 1.65 0 0 0 4.6 15L4 14v-4l.6-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-3.46.07.02a1.65 1.65 0 0 0 2.18-.66L9 3h6l.54.98a1.65 1.65 0 0 0 2.18.66l.07-.02 2 3.46-.06.06A1.65 1.65 0 0 0 19.4 9l.6 1v4l-.6 1z" />
    </svg>
);
// ─── PASSWORD GATE ────────────────────────────────────────────────────────────
const PasswordGate = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPw, setShowPw] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) { setError('Enter your password'); return; }
        setLoading(true);
        setError('');
        try {
            const token = getToken();
            // Re-verify password via auth endpoint
            await api.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-password`, { password }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Incorrect password');
        }
        setLoading(false);
    };

    const isDark = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches ||
        document.body.classList.contains('dark');

    return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark
                ? 'radial-gradient(ellipse at 60% 40%, #1e1b4b 0%, #0d0d0d 60%, #000 100%)'
                : 'radial-gradient(ellipse at 60% 40%, #ede9fe 0%, #e0e7ff 60%, #c7d2fe 100%)',
            zIndex: 9999,
        }}>

            <div style={{
                position: 'relative',
                background: 'var(--surface-1)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                borderRadius: '18px',
                padding: '60px 48px',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
            }}>
                {/* Glowing icon */}
                <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 32px' }}>
                    <div style={{
                        width: 88, height: 88, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '36px',
                        boxShadow: '0 12px 40px rgba(99,102,241,0.5)',
                    }}>
                        🔐
                    </div>
                </div>

                <h2 style={{
                    margin: '0 0 10px', fontSize: '26px', fontWeight: 900,
                    textAlign: 'center', letterSpacing: '-0.5px',
                    color: 'var(--text-main)',
                }}>Admin Control Panel</h2>
                <p style={{
                    margin: '0 0 40px', fontSize: '13px', textAlign: 'center',
                    color: 'var(--text-sub)',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    opacity: 0.6,
                }}>
                    Identity Verification Required
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="Enter Admin Password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            autoFocus
                            style={{
                                width: '100%', padding: '16px 52px 16px 20px',
                                borderRadius: '20px',
                                border: error
                                    ? '2px solid #ef4444'
                                    : '1px solid var(--border-color)',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                transition: 'all 0.3s',
                                background: 'var(--surface-2)',
                                color: 'var(--text-main)',
                                fontWeight: '600',
                            }}
                            onFocus={e => {
                                e.target.style.borderColor = '#808bf5';
                                e.target.style.boxShadow = '0 0 0 4px rgba(128,139,245,0.2)';
                            }}
                            onBlur={e => {
                                if (!error) e.target.style.borderColor = 'var(--border-color)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                            style={{
                                position: 'absolute', right: '16px', top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: isDark ? '#64748b' : '#9ca3af',
                                fontSize: '16px', padding: 0, lineHeight: 1,
                            }}>
                            {showPw ? '🙈' : '👁️'}
                        </button>
                    </div>

                    {error && (
                        <div style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '16px', padding: '12px 16px',
                            display: 'flex', alignItems: 'center', gap: '10px',
                        }}>
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', tracking: '0.05em' }}>{error}</p>
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        padding: '16px',
                        background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #818cf8, #6366f1)',
                        color: '#fff', border: 'none',
                        borderRadius: '20px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '14px', fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        transition: 'all 0.3s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        boxShadow: loading ? 'none' : '0 10px 30px rgba(99,102,241,0.4)',
                    }}>
                        {loading ? (
                            <><div style={{ width: 18, height: 18, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Authenticating...</>
                        ) : '🔓 Authorization'}
                    </button>

                    <Link to="/" style={{ display: 'block', textDecoration: 'none' }}>
                        <button type="button" style={{
                            width: '100%', padding: '14px',
                            borderRadius: '18px',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-sub)',
                            fontSize: '13px', fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                            onMouseEnter={e => {
                                e.target.style.background = 'var(--surface-2)';
                                e.target.style.color = 'var(--text-main)';
                            }}
                            onMouseLeave={e => {
                                e.target.style.background = 'transparent';
                                e.target.style.color = 'var(--text-sub)';
                            }}
                        >
                            ← Return to Feed
                        </button>
                    </Link>
                </form>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.08); }
                }
            `}</style>
        </div>
    );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#6366f1', icon }) => (
    <div className="group relative overflow-hidden bg-[var(--surface-1)] rounded-[12px] px-3 py-2 shadow-sm border border-[var(--border-color)] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
        <div
            className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 group-hover:scale-125 transition-transform duration-700"
            style={{ background: color }}
        />
        <div className="relative flex items-start justify-between">
            <div>
                <p className="text-4xl font-black text-[var(--text-main)] m-0 tracking-tighter">{value?.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-sub)] mt-2 m-0 opacity-70">{label}</p>
                {sub && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <p className="text-[10px] font-black text-green-500 m-0 uppercase tracking-tight">{sub}</p>
                    </div>
                )}
            </div>
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-all duration-500 group-hover:rotate-12 group-hover:scale-110"
                style={{ background: `${color}15`, color: color, border: `1px solid ${color}20` }}
            >
                {icon}
            </div>
        </div>
    </div>
);

// ─── SIMPLE BAR CHART ─────────────────────────────────────────────────────────
const BarChart = ({ data, label }) => {
    if (!data?.length) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="flex flex-col h-full">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-5 m-0 opacity  -70">{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', padding: '0 0px' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                            style={{
                                width: '100%',
                                height: `${(d.count / max) * 100}%`,
                                background: 'linear-gradient(to top, #808bf5, #6366f1)',
                                borderRadius: '6px 6px 0px 0px',
                                minHeight: '6px',
                                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: '0 4px 15px rgba(99,102,241,0.2)'
                            }}
                            title={`${d._id}: ${d.count}`}
                        />
                        <span style={{ fontSize: '9px', color: 'var(--text-sub)', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>{d._id?.slice(8)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── DONUT CHART ──────────────────────────────────────────────────────────────
const DonutChart = ({ data }) => {
    if (!data?.length) return <p className="text-center text-[var(--text-sub)] text-xs p-4">No category data available</p>;

    const total = data.reduce((sum, d) => sum + d.count, 0);
    let currentAngle = 0;
    const colors = ['#808bf5', '#22c55e', '#f59e0b', '#ec4899', '#3b82f6', '#a855f7'];

    return (
        <div className="flex flex-col h-full">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-5 m-0 opacity-70">Category Breakdown</p>
            <div className="flex items-center gap-6 justify-center flex-1">
                <svg width="100" height="100" viewBox="0 0 42 42" className="transform -rotate-90 flex-shrink-0">
                    {data.map((d, i) => {
                        const percentage = (d.count / total) * 100;
                        const strokeDasharray = `${percentage} ${100 - percentage}`;
                        const strokeDashoffset = 100 - currentAngle + 25;
                        currentAngle += percentage;

                        return (
                            <circle
                                key={d._id}
                                cx="21"
                                cy="21"
                                r="15.91549430918954"
                                fill="transparent"
                                stroke={colors[i % colors.length]}
                                strokeWidth="4"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                            />
                        );
                    })}
                </svg>
                <div className="flex flex-col gap-1">
                    {data.slice(0, 5).map((d, i) => (
                        <div key={d._id} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="text-[10px] font-bold text-[var(--text-main)] truncate max-w-[80px]">{d._id || 'Other'}</span>
                            <span className="text-[9px] font-black text-[var(--text-sub)] opacity-60">({d.count})</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── COHORT CHART ─────────────────────────────────────────────────────────────
const CohortChart = ({ data }) => {
    if (!data?.length) return <p className="text-center text-[var(--text-sub)] text-xs p-4">No cohort data available</p>;

    return (
        <div className="flex flex-col h-full">
            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 m-0 opacity-70">Retention Cohorts</p>
            <div className="overflow-x-auto custom-scrollbar flex-1">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-color)' }}>
                            {['Cohort', 'Size', 'W1', 'W2', 'W4'].map(h => (
                                <th key={h} style={{ padding: '8px', textAlign: 'center', fontSize: '8px', fontWeight: 900, color: 'var(--text-sub)', textTransform: 'uppercase', opacity: 0.6 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                        {data.map(c => (
                            <tr key={c.week} className="hover:bg-[var(--surface-2)]/50 transition-all">
                                <td style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 900, color: 'var(--text-main)', textAlign: 'center' }}>{c.week}</td>
                                <td style={{ padding: '6px 8px', fontSize: '10px', color: 'var(--text-sub)', textAlign: 'center', fontWeight: 700 }}>{c.size}</td>
                                {[c.w1, c.w2, c.w4].map((w, idx) => {
                                    const opacity = Math.max(0.1, w / 100);
                                    return (
                                        <td key={idx} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                            <div className="rounded py-1 text-[9px] font-black" style={{ backgroundColor: `rgba(128, 139, 245, ${opacity})`, color: w > 50 ? '#fff' : 'var(--text-main)' }}>
                                                {w}%
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────
const AnalyticsTab = () => {
    const { headers } = useAdmin();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/admin/analytics', { headers })
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [headers]);

    if (loading) return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!data) return <p className="text-center text-gray-400 p-8">Failed to load analytics</p>;

    const { overview, charts, topPosts, recentUsers } = data;

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <StatCard icon={<UsersIcon />} label="Total Users" value={overview.totalUsers} sub={`+${overview.newUsersLast7} this week`} />

                <StatCard icon={<PostsIcon />} label="Total Posts" value={overview.totalPosts} sub={`+${overview.newPostsLast7} this week`} color="#22c55e" />

                <StatCard icon={<ReportIcon />} label="Pending Reports" value={overview.pendingReports} color="#f59e0b" />

                <StatCard icon={<ChartIcon />} label="Engagement Rate" value={overview.engagementRate} sub={`${overview.engagementDelta >= 0 ? '↑' : '↓'} ${overview.engagementDelta}% vs last week`} color="#3b82f6" />

                <StatCard icon={<CalendarIcon />} label="New Users (30d)" value={overview.newUsersLast30} color="#8b5cf6" />

                <StatCard icon={<FireIcon />} label="New Posts (30d)" value={overview.newPostsLast30} color="#ec4899" />
            </div>
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3  shadow-sm border border-[var(--border-color)]"><BarChart data={charts.postsPerDay} label="Posts per day (last 7 days)" /></div>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3  shadow-sm border border-[var(--border-color)]"><BarChart data={charts.usersPerDay} label="New users per day (last 7 days)" /></div>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3 shadow-sm border border-[var(--border-color)]"><DonutChart data={charts.categoryBreakdown} /></div>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3 shadow-sm border border-[var(--border-color)]"><CohortChart data={charts.cohorts} /></div>
            </div>
            <div className="grid grid-cols-2 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3 shadow-sm border border-[var(--border-color)]">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 m-0 opacity-70">
                        Top Posts
                    </p>
                    <div className="flex flex-col gap-2">
                        {topPosts.map(post => (
                            <div key={post._id} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-color)] transition-all group">
                                <p className="text-xs font-bold text-[var(--text-main)] m-0 truncate flex-1 mr-4">{post.caption?.slice(0, 50) || '(No caption)'}</p>
                                <div className="flex gap-3 text-[10px] font-black text-[var(--text-sub)] flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <span className="flex items-center gap-1"><i className="pi pi-heart-fill text-red-500"></i> {post.likes?.length || 0}</span>
                                    <span className="flex items-center gap-1"><i className="pi pi-comment text-[#808bf5]"></i> {post.comments?.length || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[var(--surface-1)] rounded-[12px] p-3 shadow-sm border border-[var(--border-color)]">
                    <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 m-0 opacity-70">
                        Recent Users
                    </p>
                    <div className="flex flex-col gap-2">
                        {recentUsers.map(user => (
                            <div key={user._id} className="flex items-center gap-4 px-3 py-2 rounded bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-2xl object-cover flex-shrink-0 border border-[var(--border-color)] shadow-sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-[var(--text-main)] m-0 truncate">{user.fullname}</p>
                                    <p className="text-[10px] font-bold text-[var(--text-sub)] m-0 truncate opacity-60 tracking-tight">{user.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── USERS TAB ────────────────────────────────────────────────────────────────
const UsersTab = () => {
    const { headers } = useAdmin();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [banData, setBanData] = useState({ visible: false, userId: null, reason: '' });
    const [strikes, setStrikes] = useState({});

    const [selectedUsers, setSelectedUsers] = useState([]);
    const [drawerUser, setDrawerUser] = useState(null);
    const [drawerPosts, setDrawerPosts] = useState([]);
    const [drawerLogs, setDrawerLogs] = useState([]);
    const [drawerLoading, setDrawerLoading] = useState(false);

    const fetchUsers = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/users', { headers, params: { page, search, filter } })
            .then(r => { setUsers(r.data.users); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, search, filter, headers]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const fetchDrawerDetails = async (user) => {
        setDrawerUser(user);
        setDrawerLoading(true);
        try {
            const [postsRes, logsRes] = await Promise.all([
                api.get('/api/admin/posts', { headers, params: { userId: user._id } }),
                api.get('/api/admin/audit', { headers, params: { targetId: user._id } })
            ]);
            setDrawerPosts(postsRes.data.posts || []);
            setDrawerLogs(logsRes.data.logs || []);
        } catch (err) {
            toast.error('Failed to load drawer details');
        } finally {
            setDrawerLoading(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(users.map(u => u._id));
        } else {
            setSelectedUsers([]);
        }
    };

    const handleSelectUser = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const handleBulkBan = async () => {
        if (!selectedUsers.length) return;
        const reason = prompt('Enter reason for banning these users:');
        if (reason === null) return;

        try {
            await api.post('/api/admin/users/bulk-ban', { userIds: selectedUsers, reason }, { headers });
            toast.success(`Successfully banned ${selectedUsers.length} users`);
            setSelectedUsers([]);
            fetchUsers();
        } catch (err) {
            toast.error('Bulk ban failed');
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedUsers.length) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) return;

        try {
            await api.post('/api/admin/users/bulk-delete', { userIds: selectedUsers }, { headers });
            toast.success(`Successfully deleted ${selectedUsers.length} users`);
            setSelectedUsers([]);
            fetchUsers();
        } catch (err) {
            toast.error('Bulk deletion failed');
        }
    };

    const exportUsersCSV = () => {
        if (!users.length) return;
        const headersCSV = ['ID', 'Fullname', 'Email', 'Banned', 'Created At'];
        const rows = users.map(u => [
            u._id,
            u.fullname,
            u.email,
            u.isBanned ? 'Yes' : 'No',
            new Date(u.created_at).toLocaleString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headersCSV.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `users_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const banUser = async () => {
        if (!banData.reason.trim()) return;
        try {
            await api.patch(`/api/admin/users/${banData.userId}/ban`, { reason: banData.reason }, { headers });
            toast.success('User banned');
            setBanData({ visible: false, userId: null, reason: '' });
            fetchUsers();
        }
        catch { toast.error('Failed'); }
    };
    const unbanUser = async (userId) => {
        try { await api.patch(`/api/admin/users/${userId}/unban`, {}, { headers }); toast.success('User unbanned'); fetchUsers(); }
        catch { toast.error('Failed'); }
    };
    const deleteUser = async (userId) => {
        confirmDialog({
            message: 'Are you sure you want to delete this user and all their posts?',
            header: 'Delete User Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try { await api.delete(`/api/admin/users/${userId}`, { headers }); toast.success('User deleted'); fetchUsers(); }
                catch { toast.error('Failed'); }
            }
        });
    };

    const warnUser = (userId) => {
        setStrikes(prev => {
            const current = (prev[userId] || 0) + 1;
            toast.success(`Warning issued (${current}/3 strikes)`);
            if (current >= 3) {
                api.patch(`/api/admin/users/${userId}/ban`, { reason: 'Accumulated 3 strikes' }, { headers })
                    .then(() => { toast.success('User auto-banned due to strikes'); fetchUsers(); })
                    .catch(() => toast.error('Auto-ban failed'));
            }
            return { ...prev, [userId]: current };
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 flex-wrap items-center bg-[var(--surface-1)] p-2 rounded border border-[var(--border-color)] shadow-sm">
                <div className="relative flex-1 min-w-[240px]">
                    <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)] opacity-50"></i>
                    <input type="text" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded py-2.5 pl-11 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/10 focus:border-[#808bf5] transition-all" />
                </div>
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded px-2 py-2 text-sm text-[var(--text-main)] outline-none hover:bg-[var(--surface-3)] cursor-point  er transition-all">
                    <option value="all">All members</option>
                    <option value="banned">Banned</option>
                    <option value="admin">Administrators</option>
                </select>
                <button onClick={exportUsersCSV} className="px-3 py-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-color)] rounded flex items-center gap-2 text-xs font-black text-[var(--text-main)] uppercase tracking-widest cursor-pointer transition-all shadow-sm">
                    📥 CSV
                </button>
                <div className="px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-color)] rounded flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#808bf5] animate-pulse"></span>
                    <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-tight">{total} Members</span>
                </div>
            </div>

            {selectedUsers.length > 0 && (
                <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-3xl shadow-sm animate-pulse">
                    <p className="text-xs font-black text-[#808bf5] m-0 uppercase tracking-widest">{selectedUsers.length} users selected</p>
                    <div className="flex gap-2">
                        <button onClick={handleBulkBan} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border-0 cursor-pointer hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">Bulk Ban</button>
                        <button onClick={handleBulkDelete} className="bg-[var(--surface-3)] text-[var(--text-main)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-gray-400/20 border border-[var(--border-color)] transition-all">Bulk Delete</button>
                    </div>
                </div>
            )}

            <div className="bg-[var(--surface-1)] rounded-[12px] shadow-sm border border-[var(--border-color)] overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead className="sticky top-0 z-10">
                            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', width: '40px' }}>
                                    <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} onChange={handleSelectAll} className="cursor-pointer w-4 h-4 rounded border-[var(--border-color)] bg-[var(--surface-2)] text-indigo-600 focus:ring-indigo-500" />
                                </th>
                                {['User', 'Email', 'Strikes', 'Status', 'Joined', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 900, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '64px', color: 'var(--text-sub)' }}>
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs font-black uppercase tracking-widest opacity-50">Syncing database...</span>
                                    </div>
                                </td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '64px', color: 'var(--text-sub)' }}>
                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                        <i className="pi pi-search text-4xl"></i>
                                        <span className="text-xs font-bold">No members found matching your criteria</span>
                                    </div>
                                </td></tr>
                            ) : users.map(user => (
                                <tr key={user._id} className="hover:bg-[var(--surface-2)]/50 transition-all duration-200 cursor-pointer">
                                    <td style={{ padding: '14px 20px', width: '40px' }}>
                                        <input type="checkbox" checked={selectedUsers.includes(user._id)} onChange={() => handleSelectUser(user._id)} className="cursor-pointer w-4 h-4 rounded border-[var(--border-color)] bg-[var(--surface-2)] text-indigo-600 focus:ring-indigo-500" />
                                    </td>
                                    <td onClick={() => fetchDrawerDetails(user)} style={{ padding: '14px 20px' }}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group/avatar">
                                                <img src={user.profile_picture} alt="" className="w-11 h-11 rounded-2xl object-cover border border-[var(--border-color)] shadow-sm group-hover/avatar:scale-105 transition-transform" />
                                                {user.isOnline && <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-[3px] border-[var(--surface-1)] rounded-full shadow-sm"></span>}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <p className="text-sm font-black text-[var(--text-main)] m-0">{user.fullname}</p>
                                                {user.isAdmin && <span className="text-[8px] font-black uppercase tracking-wider text-[#808bf5] bg-indigo-500/10 px-2 py-0.5 rounded-md w-fit border border-indigo-500/20">System Admin</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td onClick={() => fetchDrawerDetails(user)} style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-main)', fontWeight: 500 }}>{user.email}</td>
                                    <td onClick={() => fetchDrawerDetails(user)} style={{ padding: '14px 20px', fontSize: '12px', textAlign: 'center', fontWeight: 900, color: 'var(--text-main)' }}>{strikes[user._id] || 0} / 3</td>
                                    <td onClick={() => fetchDrawerDetails(user)} style={{ padding: '14px 20px' }}>
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest ${user.isBanned ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.isBanned ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}></span>
                                            {user.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td onClick={() => fetchDrawerDetails(user)} style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-sub)', fontWeight: 700, opacity: 0.7 }}>{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <div className="flex gap-2">
                                            {user.isBanned
                                                ? <button onClick={() => unbanUser(user._id)} className="bg-green-500 text-white hover:bg-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-green-500/20">Unban</button>
                                                : <button onClick={() => setBanData({ visible: true, userId: user._id, reason: '' })} className="bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-red-500/20">Ban</button>
                                            }
                                            <button onClick={() => warnUser(user._id)} className="bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 border border-orange-500/20">Warn</button>
                                            <button onClick={() => deleteUser(user._id)} className="bg-[var(--surface-3)] text-[var(--text-main)] hover:bg-gray-400/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 border border-[var(--border-color)]">Delete Account</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex justify-between items-center bg-[var(--surface-1)] p-2 border-t border-[var(--border-color)] rounded-b-[32px]">
                <p className="text-[10px] font-black text-[var(--text-sub)] m-0 uppercase tracking-widest opacity-60">Listing {Math.min(20, users.length)} of {total} Members</p>
                <div className="flex gap-3">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-3 py-2 px-3 text-[10px] font-black uppercase tracking-tighter text-[var(--text-main)] border border-[var(--border-color)] rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
                        <i className="pi pi-chevron-left text-[8px]"></i> Previous
                    </button>
                    <div className="flex items-center py-2 px-3 bg-[var(--surface-2)] rounded text-[10px] font-black text-[#808bf5] border border-[var(--border-color)] uppercase tracking-widest">
                        Page {page}
                    </div>
                    <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="flex items-center gap-3 py-2 px-3  text-[10px] font-black uppercase tracking-tighter text-[var(--text-main)] border border-[var(--border-color)] rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
                        Next <i className="pi pi-chevron-right text-[8px]"></i>
                    </button>
                </div>
            </div>

            <Dialog header="Ban Reason" visible={banData.visible} style={{ width: '320px' }} onHide={() => setBanData({ ...banData, visible: false })}>
                <div className="flex flex-col gap-3">
                    <textarea value={banData.reason} onChange={e => setBanData({ ...banData, reason: e.target.value })} placeholder="Enter reason for banning..." rows={3} className="w-full border border-gray-200 rounded-lg p-2 text-sm outline-none focus:border-red-500" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setBanData({ ...banData, visible: false })} className="px-3 py-1.5 border border-gray-200 rounded-lg bg-transparent text-gray-500 text-xs font-semibold cursor-pointer">Cancel</button>
                        <button onClick={banUser} disabled={!banData.reason.trim()} className="px-3 py-1.5 bg-red-500 text-white border-0 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50">Ban User</button>
                    </div>
                </div>
            </Dialog>

            {drawerUser && (
                <div className="fixed inset-y-0 right-0 w-[420px] bg-[var(--surface-1)] border-l border-[var(--border-color)] shadow-2xl z-[1000] flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--surface-2)]">
                        <div className="flex items-center gap-3">
                            <img src={drawerUser.profile_picture} alt="" className="w-12 h-12 rounded-2xl object-cover border border-[var(--border-color)]" />
                            <div>
                                <h3 className="m-0 text-base font-black text-[var(--text-main)]">{drawerUser.fullname}</h3>
                                <p className="m-0 text-xs font-bold text-[var(--text-sub)] opacity-60">{drawerUser.email}</p>
                            </div>
                        </div>
                        <button onClick={() => setDrawerUser(null)} className="px-3 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-color)] rounded-xl text-xs font-black uppercase cursor-pointer text-[var(--text-main)] transition-all">Close</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3 custom-scrollbar">
                        {drawerLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-8 h-8 border-4 border-[#808bf5] border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-black uppercase opacity-60">Gathering data...</span>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 opacity-70">Analytics</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="px-4 py-3 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-color)]">
                                            <p className="text-2xl font-black text-[var(--text-main)] m-0 tracking-tight">{drawerPosts.length}</p>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-sub)] m-0 mt-1 opacity-60">Posts</p>
                                        </div>
                                        <div className="px-4 py-3 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-color)]">
                                            <p className="text-2xl font-black text-[var(--text-main)] m-0 tracking-tight">{drawerLogs.length}</p>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-sub)] m-0 mt-1 opacity-60">Events</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 opacity-70">Recent Posts</p>
                                    <div className="flex flex-col gap-3">
                                        {drawerPosts.length === 0 ? (
                                            <p className="text-xs font-medium text-[var(--text-sub)] opacity-50 italic">No posts published</p>
                                        ) : drawerPosts.slice(0, 5).map(post => (
                                            <div key={post._id} className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-color)]">
                                                {post.image_urls?.[0] && <img src={post.image_urls[0]} alt="" className="w-10 h-10 rounded-xl object-cover" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[var(--text-main)] m-0 truncate">{post.caption || 'Shared moment'}</p>
                                                    <p className="text-[9px] font-medium text-[var(--text-sub)] m-0 mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] mb-3 opacity-70">Activity Timeline</p>
                                    <div className="flex flex-col gap-3">
                                        {drawerLogs.length === 0 ? (
                                            <p className="text-xs font-medium text-[var(--text-sub)] opacity-50 italic">No timeline events</p>
                                        ) : drawerLogs.slice(0, 10).map(log => (
                                            <div key={log._id} className="p-3 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-color)] text-[11px]">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className="font-black text-[var(--text-main)] uppercase tracking-tight">{log.action?.replace('_', ' ')}</span>
                                                    <span className="text-[8px] font-bold text-[var(--text-sub)] opacity-60">{new Date(log.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                {log.meta?.reason && <p className="m-0 mt-1 text-[10px] text-red-500 font-bold">Reason: {log.meta.reason}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── POSTS TAB ────────────────────────────────────────────────────────────────
const PostsTab = () => {
    const { headers } = useAdmin();
    const [posts, setPosts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchPosts = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/posts', { headers, params: { page, search, filter } })
            .then(r => { setPosts(r.data.posts); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, search, filter, headers]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const exportPostsCSV = () => {
        if (!posts.length) return;
        const headersCSV = ['Post ID', 'Author', 'Caption', 'LikesCount', 'CommentsCount', 'Created At'];
        const rows = posts.map(p => [
            p._id,
            p.user?.fullname || 'Anonymous',
            (p.caption || '').replace(/[\n,]/g, ' '),
            p.likesCount || 0,
            p.commentsCount || 0,
            new Date(p.createdAt).toLocaleString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headersCSV.join(','), ...rows.map(e => e.join(','))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `posts_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const deletePost = async (postId) => {
        confirmDialog({
            message: 'Delete this post?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try { await api.delete(`/api/admin/posts/${postId}`, { headers }); toast.success('Post deleted'); fetchPosts(); }
                catch { toast.error('Failed'); }
            }
        });
    };


    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 flex-wrap items-center bg-[var(--surface-1)] p-2 rounded border border-[var(--border-color)] shadow-sm ">
                <div className="relative flex-1 min-w-[240px]">
                    <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)] opacity-50"></i>
                    <input type="text" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="bg-[var(--surface-2)] px-6 py-3 border border-transparent hover:border-[var(--border-color)] rounded-[20px] text-sm text-[var(--text-main)] outline-none cursor-pointer hover:bg-[var(--surface-3)] transition-all font-bold" />
                </div>
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="bg-[var(--surface-2)] px-6 py-3 border border-transparent hover:border-[var(--border-color)] rounded-[20px] text-sm text-[var(--text-main)] outline-none bg-[var(--surface-2)] cursor-pointer hover:bg-[var(--surface-3)] transition-all font-bold">
                    <option value="all">Everywhere</option>
                    <option value="reported">Highly Reported</option>
                    <option value="anonymous">Anonymous Feed</option>
                    <option value="timelocked">Time-restricted</option>
                </select>
                <button onClick={exportPostsCSV} className="px-6 py-3 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-color)] rounded-[20px] text-xs font-black text-[var(--text-main)] uppercase tracking-widest cursor-pointer transition-all shadow-sm">
                    📥 CSV
                </button>
                <div className="px-6 py-3 bg-[#808bf5]/10 border border-indigo-500/20 rounded-[20px] flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#808bf5] shadow-[0_0_10px_rgba(128,139,245,0.4)]"></span>
                    <span className="text-xs font-black text-[#808bf5] uppercase tracking-widest">{total} Global Posts</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {loading ? [1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-[var(--surface-1)] rounded-[12px] p-4 border border-[var(--border-color)] shadow-sm animate-pulse">
                        <div className="aspect-[4/3] bg-[var(--surface-2)] rounded-[24px] flex items-center justify-center">
                            <i className="pi pi-image text-[var(--surface-3)] text-3xl"></i>
                        </div>
                        <div className="mt-4 flex flex-col gap-3">
                            <div className="h-4 w-3/4 bg-[var(--surface-2)] rounded-full"></div>
                            <div className="h-4 w-1/2 bg-[var(--surface-2)] rounded-full"></div>
                        </div>
                    </div>
                )) : posts.map(post => {
                    const postImg = post.image_urls?.[0] || post.image_url;
                    return (
                        <div key={post._id} className="group bg-[var(--surface-1)] rounded-[12px] border border-[var(--border-color)] shadow-sm overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                            <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
                                {postImg ? (
                                    <img src={postImg} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-8 text-center text-[var(--text-sub)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)]">
                                        <p className="text-xs italic leading-relaxed font-medium opacity-60">"{post.caption?.slice(0, 100) || 'Creative Content'}"</p>
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                                    {post.isAnonymous && <span className="bg-[var(--surface-1)]/80 backdrop-blur-md text-[#808bf5] text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-xl border border-[var(--border-color)] shadow-xl">Private Alias</span>}
                                    {post.unlocksAt && new Date(post.unlocksAt) > Date.now() && <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5"><i className="pi pi-lock text-[8px]"></i> Locked</span>}
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <img src={post.user?.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} alt="" className="w-7 h-7 rounded-lg object-cover border border-[var(--border-color)] shadow-sm" />
                                    <span className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest opacity-70 truncate">{post.user?.fullname || 'System Entity'}</span>
                                </div>
                                <p className="text-xs text-[var(--text-main)] font-semibold line-clamp-2 min-h-[36px] leading-relaxed mb-6 opacity-90">{post.caption || '(Meta description only)'}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                                    <div className="flex gap-4 text-[10px] font-black text-[var(--text-sub)] uppercase tracking-tighter opacity-60">
                                        <span className="flex items-center gap-1.5"><i className="pi pi-heart-fill text-red-500"></i> {post.likes?.length || 0}</span>
                                        <span className="flex items-center gap-1.5"><i className="pi pi-comment text-[#808bf5]"></i> {post.comments?.length || 0}</span>
                                    </div>
                                    <button onClick={() => deletePost(post._id)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-0 cursor-pointer transition-all active:scale-90 shadow-sm">Delete</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center gap-2 mt-4 pb-8">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all active:scale-95 shadow-sm">
                    <i className="pi pi-chevron-left"></i> Previous
                </button>
                <div className="flex items-center px-6 bg-white rounded-2xl text-xs font-black text-indigo-600 border border-indigo-100 shadow-sm">
                    Page {page}
                </div>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all active:scale-95 shadow-sm">
                    Next <i className="pi pi-chevron-right"></i>
                </button>
            </div>
        </div>
    );
};

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
const ReportsTab = () => {
    const { headers } = useAdmin();
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [postPreview, setPostPreview] = useState({ visible: false, postId: null });

    const fetchReports = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/reports', { headers, params: { status, page } })
            .then(r => { setReports(r.data.reports); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [status, page, headers]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const resolve = async (reportId, action) => {
        try { await api.patch(`/api/admin/reports/${reportId}/resolve`, { action }, { headers }); toast.success(`Report ${action}`); fetchReports(); }
        catch { toast.error('Failed'); }
    };

    const deletePost = async (postId, reportId) => {
        confirmDialog({
            message: 'Are you sure you want to remove this post?',
            header: 'Remove Post',
            icon: 'pi pi-trash',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete(`/api/admin/posts/${postId}`, { headers });
                    toast.success('Post removed');
                    if (reportId) resolve(reportId, 'resolved');
                } catch { toast.error('Failed to remove post'); }
            }
        });
    };

    const deleteComment = async (commentId, reportId) => {
        confirmDialog({
            message: 'Are you sure you want to remove this comment?',
            header: 'Remove Comment',
            icon: 'pi pi-trash',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    await api.delete(`/api/admin/comments/${commentId}`, { headers });
                    toast.success('Comment removed');
                    if (reportId) resolve(reportId, 'resolved');
                } catch { toast.error('Failed to remove comment'); }
            }
        });
    };

    const banUser = async (userId, reason, reportId) => {
        try {
            await api.patch(`/api/admin/users/${userId}/ban`, { reason }, { headers });
            toast.success('User banned');
            if (reportId) resolve(reportId, 'resolved');
        } catch { toast.error('Failed to ban user'); }
    };

    const REASON_COLOR = { spam: '#f59e0b', harassment: '#ef4444', hate_speech: '#dc2626', misinformation: '#f97316', nudity: '#ec4899', violence: '#b91c1c', other: '#6b7280' };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 flex-wrap items-center bg-[var(--surface-1)] p-2 rounded border border-[var(--border-color)] shadow-sm">
                <select value={status} onChange={e => setStatus(e.target.value)} className="bg-[var(--surface-2)] px-6 py-3 border border-transparent hover:border-[var(--border-color)] rounded-[20px] text-sm text-[var(--text-main)] outline-none cursor-pointer hover:bg-[var(--surface-3)] transition-all font-bold">
                    <option value="pending">Awaiting Review</option>
                    <option value="resolved">Resolved Cases</option>
                    <option value="dismissed">Dismissed Reports</option>
                    <option value="all">Complete Archive</option>
                </select>
                <div className="px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-[20px] flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.4)]"></span>
                    <span className="text-xs font-black text-red-500 uppercase tracking-widest">{total} Critical Alerts</span>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Scanning Reports...</p>
                        </div>
                    </div>
                ) : reports.length === 0 ? (
                    <div className="bg-[var(--surface-1)] rounded-[40px] p-20 border border-[var(--border-color)] shadow-sm text-center">
                        <span className="text-6xl mb-6 block">🛡️</span>
                        <h3 className="text-xl font-black text-[var(--text-main)] m-0 uppercase tracking-tight">System Integrity Intact</h3>
                        <p className="text-xs text-[var(--text-sub)] mt-3 opacity-60 font-bold tracking-wide">No pending reports found. All community guidelines are being followed.</p>
                    </div>
                ) : reports.map(report => (
                    <div key={report._id} className="bg-[var(--surface-1)] rounded-[12px] border border-[var(--border-color)] shadow-sm p-8 hover:shadow-2xl transition-all duration-300">
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <div className="relative group/reporter">
                                    <img src={report.reporter?.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} alt="" className="w-14 h-14 rounded-[20px] object-cover ring-4 ring-[var(--surface-2)] shadow-xl group-hover/reporter:scale-105 transition-transform" />
                                    <span className="absolute -bottom-2 -right-2 bg-[var(--surface-1)] p-1.5 rounded-xl shadow-lg text-xs border border-[var(--border-color)]">🚩</span>
                                </div>
                                <div>
                                    <p className="text-base font-black text-[var(--text-main)] m-0 tracking-tight">{report.reporter?.fullname || 'Anonymous Auditor'}</p>
                                    <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-[0.2em] m-0 flex items-center gap-2 mt-1 opacity-50">
                                        FLAGGED <span className="text-[#808bf5]">{report.targetType}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-3">
                                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', padding: '6px 14px', borderRadius: '12px', background: `${REASON_COLOR[report.reason]}20`, color: REASON_COLOR[report.reason], letterSpacing: '0.1em', border: `1px solid ${REASON_COLOR[report.reason]}30` }}>
                                    {report.reason?.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] font-black text-[var(--text-sub)] opacity-40 uppercase tracking-widest">{new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {report.description && (
                            <div className="mt-6 p-5 bg-[var(--surface-2)] rounded-[24px] border border-[var(--border-color)] italic relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#808bf5]/30"></div>
                                <p className="text-xs text-[var(--text-main)] m-0 relative z-10 leading-relaxed pr-6 font-medium opacity-90">{report.description}</p>
                            </div>
                        )}

                        {/* Target Context */}
                        <div className="mt-6 p-6 bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-1)] rounded-[24px] border border-[var(--border-color)] shadow-inner">
                            {report.targetType === 'post' && report.targetPost && (
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-4 overflow-hidden flex-1">
                                        <div className="w-1 h-10 bg-[#808bf5] rounded-full shadow-[0_0_8px_rgba(128,139,245,0.4)]"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black text-[var(--text-sub)] uppercase mb-1 tracking-widest opacity-50">Post Context</p>
                                            <p className="text-xs text-[var(--text-main)] m-0 truncate italic font-bold leading-relaxed">"{report.targetPost.caption || 'No verbal description'}"</p>
                                        </div>
                                        <button onClick={() => setPostPreview({ visible: true, postId: report.targetId })} className="bg-[#808bf5] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-0 cursor-pointer hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20 shrink-0">Investigate</button>
                                    </div>
                                    <button onClick={() => deletePost(report.targetId, report._id)} className="bg-red-500/10 text-red-500 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 cursor-pointer hover:bg-red-500 hover:text-white transition-all shrink-0">Delete Post</button>
                                </div>
                            )}

                            {report.targetType === 'comment' && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1 h-10 bg-pink-500 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.4)]"></div>
                                        <div>
                                            <p className="text-[9px] font-black text-[var(--text-sub)] uppercase mb-1 tracking-widest opacity-50">Comment Metadata</p>
                                            <span className="text-[11px] font-mono text-[var(--text-main)] font-bold">{report.targetId}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteComment(report.targetId, report._id)} className="bg-red-500/10 text-red-500 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 cursor-pointer hover:bg-red-500 hover:text-white transition-all">Delete Comment</button>
                                </div>
                            )}

                            {/* Author Row */}
                            <div className="mt-5 flex items-center justify-between border-t border-[var(--border-color)] pt-5">
                                <div className="flex items-center gap-3">
                                    <i className="pi pi-shield text-[#808bf5] text-xs"></i>
                                    <span className="text-[9px] font-black text-[var(--text-sub)] uppercase tracking-[0.1em] opacity-50">Content Origin:</span>
                                    <span className="text-[10px] font-black text-[var(--text-main)] tracking-tight uppercase">{report.targetUser?.fullname || report.targetPost?.user?.fullname || 'System Entity'}</span>
                                </div>
                                <button onClick={() => {
                                    const targetUid = report.targetUser?._id || report.targetPost?.user?._id;
                                    if (targetUid) banUser(targetUid, `Violation: ${report.reason}`, report._id);
                                }} className="bg-orange-500/10 text-orange-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-500/20 cursor-pointer hover:bg-orange-500 hover:text-white transition-all">Revoke Access</button>
                            </div>
                        </div>

                        {report.status === 'pending' && (
                            <div className="flex gap-4 mt-8 justify-end">
                                <button onClick={() => resolve(report._id, 'dismissed')} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-sub)] hover:bg-[var(--surface-2)] transition-all border border-[var(--border-color)] cursor-pointer">Dismiss</button>
                                <button onClick={() => resolve(report._id, 'resolved')} className="px-10 py-3 bg-[#808bf5] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-0 cursor-pointer hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-500/30">Resolve Case</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-4 mt-8 pb-16">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl">← Previous</button>
                <div className="flex items-center px-8 bg-[var(--surface-1)] rounded-2xl text-[10px] font-black text-[#808bf5] border border-[var(--border-color)] shadow-inner uppercase tracking-[0.2em]">Page {page}</div>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl">Next →</button>
            </div>

            <Dialog
                showHeader={false}
                visible={postPreview.visible}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                onHide={() => setPostPreview({ visible: false, postId: null })}
                contentStyle={{ padding: 0, borderRadius: '24px', overflow: 'hidden', background: 'transparent' }}
                baseZIndex={20000}
                dismissableMask
                blockScroll={true}
                closable={false}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                    <button
                        onClick={() => setPostPreview({ visible: false, postId: null })}
                        className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                    >
                        <i className="pi pi-times text-sm"></i>
                    </button>
                    {postPreview.postId && <PostDetail postId={postPreview.postId} onHide={() => setPostPreview({ visible: false, postId: null })} />}
                </div>
            </Dialog>
        </div>
    );
};

// ─── SYSTEM TAB ───────────────────────────────────────────────────────────────
const SystemTab = () => {
    const { headers } = useAdmin();
    const [loading, setLoading] = useState(false);

    const [flags, setFlags] = useState({
        ai_features: true,
        anonymous_posts: true,
        story_creation: true,
        maintenance_mode: false
    });
    const [flagsLoading, setFlagsLoading] = useState(false);

    const [broadcastContent, setBroadcastContent] = useState('');
    const [broadcastSegment, setBroadcastSegment] = useState('all');
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    useEffect(() => {
        const fetchFlags = async () => {
            try {
                const res = await api.get('/api/admin/system/flags', { headers });
                if (res.data?.success) setFlags(res.data.flags);
            } catch (err) {
                console.error('Failed to load flags');
            }
        };
        fetchFlags();
    }, [headers]);

    const toggleFlag = async (key) => {
        const updated = { ...flags, [key]: !flags[key] };
        setFlags(updated);
        setFlagsLoading(true);
        try {
            await api.post('/api/admin/system/flags', { flags: updated }, { headers });
            toast.success('Feature flag updated');
        } catch (err) {
            toast.error('Failed to update feature flag');
            setFlags(flags);
        } finally {
            setFlagsLoading(false);
        }
    };

    const triggerDigest = async () => {
        setLoading(true);
        try {
            const res = await api.post('/api/admin/debug/digest', {}, { headers });
            toast.success(res.data.message || 'Digest job triggered');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to trigger digest');
        } finally {
            setLoading(false);
        }
    };

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastContent.trim()) return;
        setBroadcastLoading(true);
        try {
            await api.post('/api/admin/broadcast', { content: broadcastContent, segment: broadcastSegment }, { headers });
            toast.success('Broadcast announcement sent');
            setBroadcastContent('');
        } catch (err) {
            toast.error('Broadcast failed');
        } finally {
            setBroadcastLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-3xl">
            {/* Feature Flags Panel */}
            <div className="bg-[var(--surface-1)] rounded-[40px] p-10 shadow-sm border border-[var(--border-color)]">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-[#808bf5]/10 flex items-center justify-center text-4xl border border-indigo-500/20">⚙️</div>
                    <div>
                        <h3 className="m-0 text-xl font-black text-[var(--text-main)] uppercase tracking-tight">Feature Flags</h3>
                        <p className="m-0 text-[var(--text-sub)] text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Enable or Disable System Modules</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(flags).map(([key, val]) => (
                        <div key={key} className="p-6 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-[12px] flex items-center justify-between shadow-inner">
                            <div>
                                <p className="text-xs font-black text-[var(--text-main)] m-0 capitalize tracking-wider">{key.replace(/_/g, ' ')}</p>
                                <p className="text-[9px] font-bold text-[var(--text-sub)] opacity-60 m-0 mt-1 uppercase tracking-widest">Live State Toggle</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={val} onChange={() => toggleFlag(key)} className="sr-only peer" disabled={flagsLoading} />
                                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Global Broadcast */}
            <div className="bg-[var(--surface-1)] rounded-[40px] p-10 shadow-sm border border-[var(--border-color)]">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 flex items-center justify-center text-4xl border border-indigo-500/20">📣</div>
                    <div>
                        <h3 className="m-0 text-xl font-black text-[var(--text-main)] uppercase tracking-tight">Broadcast Alerts</h3>
                        <p className="m-0 text-[var(--text-sub)] text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Push System Notifications globally</p>
                    </div>
                </div>

                <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
                    <textarea
                        value={broadcastContent}
                        onChange={e => setBroadcastContent(e.target.value)}
                        placeholder="Type a message to dispatch to your user segment..."
                        rows={4}
                        className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-3xl p-5 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/10 focus:border-[#808bf5] transition-all resize-none"
                    />

                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <select
                            value={broadcastSegment}
                            onChange={e => setBroadcastSegment(e.target.value)}
                            className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--text-main)] outline-none cursor-pointer"
                        >
                            <option value="all">All Members</option>
                            <option value="active">Recently Active</option>
                            <option value="admins">Administrators</option>
                        </select>

                        <button
                            type="submit"
                            disabled={broadcastLoading || !broadcastContent.trim()}
                            className="px-8 py-3 bg-[#808bf5] text-white rounded-2xl text-xs font-black uppercase tracking-widest border-0 cursor-pointer hover:bg-indigo-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {broadcastLoading ? 'Dispatching...' : 'Send Broadcast'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Original Cluster Digest Module */}
            <div className="bg-[var(--surface-1)] rounded-[40px] p-10 shadow-sm border border-[var(--border-color)]">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-[#808bf5]/10 flex items-center justify-center text-4xl shadow-inner border border-indigo-500/20">📡</div>
                    <div>
                        <h3 className="m-0 text-xl font-black text-[var(--text-main)] uppercase tracking-tight">Control Cluster</h3>
                        <p className="m-0 text-[var(--text-sub)] text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Global Activity & Service Engine</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-8 bg-[var(--surface-2)] rounded-[12px] border border-[var(--border-color)] shadow-inner">
                        <p className="text-xs font-black text-[var(--text-main)] mb-3 m-0 uppercase tracking-[0.2em] opacity-80">Manual Data Sync</p>
                        <p className="text-xs text-[var(--text-sub)] mb-8 m-0 leading-relaxed font-medium opacity-60">
                            Force an immediate broadcast of the daily activity digest. This will bypass the system cron and deliver
                            personalized updates to all registered users instantly.
                        </p>
                        <button
                            onClick={triggerDigest}
                            disabled={loading}
                            className={`flex items-center gap-3 px-8 py-4 rounded-[20px] text-[11px] font-black uppercase tracking-[0.2em] transition-all border-0 cursor-pointer shadow-2xl active:scale-95 ${loading ? 'bg-[var(--surface-3)] text-[var(--text-sub)]' : 'bg-[#808bf5] text-white hover:bg-indigo-600 hover:shadow-indigo-500/30'
                                }`}
                        >
                            {loading ? <i className="pi pi-spin pi-spinner"></i> : <i className="pi pi-bolt"></i>}
                            {loading ? 'Transmitting...' : 'Initiate Broadcast'}
                        </button>
                    </div>

                    <div className="p-6 border border-indigo-500/20 bg-indigo-500/5 rounded-[12px]">
                        <div className="flex gap-4">
                            <i className="pi pi-info-circle text-[#808bf5] mt-1 text-lg"></i>
                            <div className="text-[11px] text-[#808bf5] space-y-3 font-bold uppercase tracking-wider">
                                <p className="m-0 opacity-100">Core Schedule: 08:00 UTC Daily</p>
                                <p className="m-0 opacity-60 leading-relaxed">The engine is synchronized to provide 24-hour cycle transparency. Admins receive priority status reports regardless of system volatility.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// ─── CONTENT FILTER TAB ───────────────────────────────────────────────────────
const ContentFilterTab = () => {
    const { headers } = useAdmin();
    const [bannedWords, setBannedWords] = useState([]);
    const [newWord, setNewWord] = useState('');
    const [action, setAction] = useState('flag');

    const fetchWords = useCallback(() => {
        api.get('/api/admin/content-filter', { headers })
            .then(r => setBannedWords(r.data))
            .catch(() => { });
    }, [headers]);

    useEffect(() => { fetchWords(); }, [fetchWords]);

    const addWord = async (e) => {
        e.preventDefault();
        if (!newWord.trim()) return;
        try {
            await api.post('/api/admin/content-filter', { word: newWord, action }, { headers });
            toast.success('Word added');
            setNewWord('');
            fetchWords();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const removeWord = async (id) => {
        try {
            await api.delete(`/api/admin/content-filter/${id}`, { headers });
            toast.success('Word removed');
            fetchWords();
        } catch {
            toast.error('Failed');
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-3xl">
            <div className="bg-[var(--surface-1)] rounded-[40px] p-10 shadow-sm border border-[var(--border-color)]">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-orange-500/10 flex items-center justify-center text-4xl border border-orange-500/20">🛡️</div>
                    <div>
                        <h3 className="m-0 text-xl font-black text-[var(--text-main)] uppercase tracking-tight">Content Moderation Filter</h3>
                        <p className="m-0 text-[var(--text-sub)] text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Manage Banned Words & Policies</p>
                    </div>
                </div>

                <form onSubmit={addWord} className="flex gap-4 mb-8">
                    <input
                        type="text"
                        placeholder="Add new banned word/phrase..."
                        value={newWord}
                        onChange={e => setNewWord(e.target.value)}
                        className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-5 py-3 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/10 focus:border-[#808bf5] transition-all"
                    />
                    <button type="submit" className="px-8 py-3 bg-[#808bf5] text-white rounded-2xl text-xs font-black uppercase tracking-widest border-0 cursor-pointer hover:bg-indigo-600 transition-all shadow-lg">Add</button>
                </form>

                <div className="p-6 bg-[var(--surface-2)] rounded-[12px] border border-[var(--border-color)] mb-8">
                    <p className="text-xs font-black text-[var(--text-main)] mb-4 m-0 uppercase tracking-[0.2em] opacity-80">Currently Banned Words</p>
                    <div className="flex gap-2 flex-wrap">
                        {bannedWords.map(item => (
                            <span key={item._id} className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-main)] shadow-sm">
                                {item.word}
                                <button type="button" onClick={() => removeWord(item._id)} className="border-0 bg-transparent text-red-500 cursor-pointer font-bold hover:scale-110 transition-transform">×</button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 border border-[var(--border-color)] rounded-[12px]">
                    <div>
                        <p className="text-xs font-black text-[var(--text-main)] m-0 uppercase tracking-wider">Enforcement Policy</p>
                        <p className="text-[10px] text-[var(--text-sub)] m-0 mt-1 font-bold opacity-60">Choose what happens when a match is found.</p>
                    </div>
                    <select value={action} onChange={e => setAction(e.target.value)} className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider text-[var(--text-main)] outline-none cursor-pointer">
                        <option value="flag">Auto-Flag for Review</option>
                        <option value="block">Block Publication</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
const AdminDashboard = () => {
    const loggeduser = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const isAdminUser = Boolean(loggeduser?.isAdmin || loggeduser?.role === 'admin');
    const navigate = useNavigate();
    const [verified, setVerified] = useState(false);
    const [activeTab, setActiveTab] = useState('analytics');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sliderStyle, setSliderStyle] = useState({ top: 0, height: 0 });
    const navRefs = useRef({});

    useEffect(() => {
        const activeBtn = navRefs.current[activeTab];
        if (activeBtn) {
            setSliderStyle({
                top: activeBtn.offsetTop,
                height: activeBtn.offsetHeight
            });
        }
    }, [activeTab]);

    useEffect(() => {
        if (!initialized || loading) return;
        if (!loggeduser) navigate('/login');
    }, [initialized, loading, loggeduser, navigate]);

    // ✅ Redirect non-admins only after user is confirmed loaded
    useEffect(() => {
        if (!initialized || loading || !loggeduser) return;
        if (!isAdminUser) {
            toast.error('Admin access required');
            navigate('/');
        }
    }, [initialized, loading, loggeduser, isAdminUser, navigate]);

    // Still loading user
    if (!initialized || loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', gap: '16px' }}>
            <div style={{ width: 44, height: 44, border: '4px solid #ede9fe', borderTopColor: '#808bf5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Loading...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (!loggeduser) return null;

    // Not admin
    if (!isAdminUser) return null;

    // ✅ Password gate — shown before dashboard
    if (!verified) return <PasswordGate onSuccess={() => setVerified(true)} />;

    const tabs = [
        { key: 'analytics', icon: <ChartIcon />, label: 'Analytics' },
        { key: 'users', icon: <UsersIcon />, label: 'Users' },
        { key: 'posts', icon: <PostsIcon />, label: 'Posts' },
        { key: 'reports', icon: <ReportIcon />, label: 'Reports' },
        { key: 'audit_log', icon: <AuditIcon />, label: 'Audit Log' },
        { key: 'content_filter', icon: <ShieldIcon />, label: 'Content Filter' },
        { key: 'system', icon: <SettingsIcon />, label: 'System' },
    ];

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[var(--surface-2)] relative">

            <Header
                user={loggeduser}
                onLock={() => setVerified(false)}
                onHome={() => navigate('/')}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Sidebar Backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-[40] lg:hidden transition-opacity duration-300 animate-in fade-in"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <div className={`bg-[var(--surface-1)] border-r border-[var(--border-color)] w-64 flex-shrink-0 flex flex-col h-full shadow-lg 
                    fixed inset-y-0 left-0 z-[45] lg:static lg:z-0 lg:translate-x-0 transform transition-transform duration-300
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                    <div className="flex-1 overflow-y-auto py-2  flex flex-col gap-2 relative">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-sub)] p-4  opacity-50">Master Control</p>

                        {/* Sliding Active Indicator */}
                        <div
                            style={{
                                position: 'absolute',
                                left: 24,
                                right: 24,
                                top: sliderStyle.top,
                                height: sliderStyle.height,
                                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            className="bg-[#808bf5] rounded-2xl shadow-xl shadow-indigo-500/20 pointer-events-none"
                        />

                        {tabs.map(tab => (
                            <button
                                ref={el => navRefs.current[tab.key] = el}
                                key={tab.key}
                                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black border-0 cursor-pointer text-left w-full transition-all duration-300 relative z-10 ${activeTab === tab.key
                                    ? 'text-white lg:translate-x-2'
                                    : 'bg-transparent text-[var(--text-sub)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] translate-x-0'
                                    }`}
                            >
                                <span className={`text-xl transition-transform duration-300 ${activeTab === tab.key ? 'scale-110' : 'scale-100'}`}>{tab.icon}</span>
                                <span className="tracking-widest uppercase">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 h-full overflow-y-auto p-2 bg-[var(--surface-2)] custom-scrollbar">
                    <div className="max-w-[1440px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {activeTab === 'analytics' && <AnalyticsTab />}
                        {activeTab === 'users' && <UsersTab />}
                        {activeTab === 'posts' && <PostsTab />}
                        {activeTab === 'reports' && <ReportsTab />}
                        {activeTab === 'audit_log' && <AuditLogTab />}
                        {activeTab === 'content_filter' && <ContentFilterTab />}
                        {activeTab === 'system' && <SystemTab />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
