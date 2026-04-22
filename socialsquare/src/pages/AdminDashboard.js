import { useState, useEffect, useCallback, useMemo } from 'react';
import useAuthStore, { api, getToken } from '../store/zustand/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import PostDetail from './components/PostDetail';


const useAdmin = () => {
    const token = getToken();
    return useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
};

const Header = ({ user, onLock, onHome }) => (
    <div className="sticky top-0 z-50 w-full backdrop-blur-xl bg-[var(--surface-1)] border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={onHome} className="p-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] rounded-2xl transition-all border-0 cursor-pointer text-[var(--text-main)] shadow-sm">
                <i className="pi pi-arrow-left text-sm font-bold"></i>
            </button>
            <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight text-[var(--text-main)] m-0 flex items-center gap-2">
                    <span className="text-2xl">⚙️</span> Control Center
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-[#808bf5] font-black m-0">Social Square Admin</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3.5 py-1.5 bg-[var(--surface-2)] rounded-2xl border border-[var(--border-color)]">
                <img src={user?.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-[var(--surface-1)] shadow-sm" />
                <span className="text-xs font-bold text-[var(--text-main)]">{user?.fullname}</span>
            </div>
            <button onClick={onLock} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 py-2.5 rounded-2xl text-xs font-black transition-all border-0 cursor-pointer shadow-sm active:scale-95">
                <i className="pi pi-lock"></i> LOCK
            </button>
        </div>
    </div>
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
            {/* Decorative glow blobs */}
            <div style={{ position: 'absolute', top: '15%', left: '20%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(128,139,245,0.15)', filter: 'blur(80px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 260, height: 260, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', filter: 'blur(70px)', pointerEvents: 'none' }} />

            <div style={{
                position: 'relative',
                background: 'var(--surface-1)',
                backdropFilter: 'blur(32px)',
                WebkitBackdropFilter: 'blur(32px)',
                borderRadius: '40px',
                padding: '60px 48px',
                width: '100%',
                maxWidth: '420px',
                margin: '0 16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
            }}>
                {/* Glowing icon */}
                <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 32px' }}>
                    <div style={{
                        position: 'absolute', inset: -12,
                        borderRadius: '32px',
                        background: 'radial-gradient(circle, rgba(128,139,245,0.4) 0%, transparent 70%)',
                        animation: 'pulse 3s ease-in-out infinite',
                    }} />
                    <div style={{
                        width: 88, height: 88, borderRadius: '28px',
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
    <div className="group relative overflow-hidden bg-[var(--surface-1)] rounded-[32px] p-6 shadow-sm border border-[var(--border-color)] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
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
            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-sub)] mb-5 m-0 opacity-70">{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', padding: '0 4px' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                            style={{
                                width: '100%',
                                height: `${(d.count / max) * 100}%`,
                                background: 'linear-gradient(to top, #808bf5, #6366f1)',
                                borderRadius: '12px 12px 4px 4px',
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
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <StatCard icon="👥" label="Total Users" value={overview.totalUsers} sub={`+${overview.newUsersLast7} this week`} />
                <StatCard icon="📝" label="Total Posts" value={overview.totalPosts} sub={`+${overview.newPostsLast7} this week`} color="#22c55e" />
                <StatCard icon="🚩" label="Pending Reports" value={overview.pendingReports} color="#f59e0b" />
                <StatCard icon="📅" label="New Users (30d)" value={overview.newUsersLast30} color="#8b5cf6" />
                <StatCard icon="🔥" label="New Posts (30d)" value={overview.newPostsLast30} color="#ec4899" />
            </div>
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><BarChart data={charts.postsPerDay} label="Posts per day (last 7 days)" /></div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><BarChart data={charts.usersPerDay} label="New users per day (last 7 days)" /></div>
            </div>
            <div className="grid grid-cols-2 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                <div className="bg-[var(--surface-1)] rounded-[32px] p-6 shadow-sm border border-[var(--border-color)]">
                    <p className="font-black text-sm mb-5 m-0 text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                        <span className="text-xl">🔥</span> Top Posts
                    </p>
                    <div className="flex flex-col gap-2">
                        {topPosts.map(post => (
                            <div key={post._id} className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-color)] transition-all group">
                                <p className="text-xs font-bold text-[var(--text-main)] m-0 truncate flex-1 mr-4">{post.caption?.slice(0, 50) || '(No caption)'}</p>
                                <div className="flex gap-3 text-[10px] font-black text-[var(--text-sub)] flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <span className="flex items-center gap-1"><i className="pi pi-heart-fill text-red-500"></i> {post.likes?.length || 0}</span>
                                    <span className="flex items-center gap-1"><i className="pi pi-comment text-[#808bf5]"></i> {post.comments?.length || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-[var(--surface-1)] rounded-[32px] p-6 shadow-sm border border-[var(--border-color)]">
                    <p className="font-black text-sm mb-5 m-0 text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                        <span className="text-xl">🆕</span> Recent Users
                    </p>
                    <div className="flex flex-col gap-2">
                        {recentUsers.map(user => (
                            <div key={user._id} className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--surface-2)] border border-transparent hover:border-[var(--border-color)] transition-all">
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

    const fetchUsers = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/users', { headers, params: { page, search, filter } })
            .then(r => { setUsers(r.data.users); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, search, filter, headers]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex gap-4 flex-wrap items-center bg-[var(--surface-1)] p-4 rounded-3xl border border-[var(--border-color)] shadow-sm">
                <div className="relative flex-1 min-w-[240px]">
                    <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)] opacity-50"></i>
                    <input type="text" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl py-3 pl-11 pr-4 text-sm text-[var(--text-main)] outline-none focus:ring-2 ring-indigo-500/10 focus:border-[#808bf5] transition-all" />
                </div>
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-5 py-3 text-sm text-[var(--text-main)] outline-none hover:bg-[var(--surface-3)] cursor-pointer transition-all">
                    <option value="all">All members</option>
                    <option value="banned">Banned</option>
                    <option value="admin">Administrators</option>
                </select>
                <div className="px-5 py-3 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#808bf5] animate-pulse"></span>
                    <span className="text-xs font-black text-[var(--text-main)] uppercase tracking-tight">{total} Members</span>
                </div>
            </div>
            <div className="bg-[var(--surface-1)] rounded-[32px] shadow-sm border border-[var(--border-color)] overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead className="sticky top-0 z-10">
                            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-color)' }}>
                                {['User', 'Email', 'Followers', 'Status', 'Joined', 'Actions'].map(h => (
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
                                <tr key={user._id} className="hover:bg-[var(--surface-2)]/50 transition-all duration-200">
                                    <td style={{ padding: '14px 20px' }}>
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
                                    <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-main)', fontWeight: 500 }}>{user.email}</td>
                                    <td style={{ padding: '14px 20px', fontSize: '12px', textAlign: 'center', fontWeight: 900, color: 'var(--text-main)' }}>{user.followers?.length || 0}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-widest ${user.isBanned ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.isBanned ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`}></span>
                                            {user.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 20px', fontSize: '11px', color: 'var(--text-sub)', fontWeight: 700, opacity: 0.7 }}>{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    <td style={{ padding: '14px 20px' }}>
                                        <div className="flex gap-2">
                                            {user.isBanned
                                                ? <button onClick={() => unbanUser(user._id)} className="bg-green-500 text-white hover:bg-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-green-500/20">Unban</button>
                                                : <button onClick={() => setBanData({ visible: true, userId: user._id, reason: '' })} className="bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 shadow-lg shadow-red-500/20">Ban</button>
                                            }
                                            <button onClick={() => deleteUser(user._id)} className="bg-[var(--surface-3)] text-[var(--text-main)] hover:bg-gray-400/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border-0 cursor-pointer transition-all active:scale-95 border border-[var(--border-color)]">Delete Account</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex justify-between items-center bg-[var(--surface-1)] px-8 py-5 border-t border-[var(--border-color)] rounded-b-[32px]">
                <p className="text-[10px] font-black text-[var(--text-sub)] m-0 uppercase tracking-widest opacity-60">Listing {Math.min(20, users.length)} of {total} Members</p>
                <div className="flex gap-3">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-tighter text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
                        <i className="pi pi-chevron-left text-[8px]"></i> Previous
                    </button>
                    <div className="flex items-center px-6 bg-[var(--surface-2)] rounded-2xl text-[10px] font-black text-[#808bf5] border border-[var(--border-color)] uppercase tracking-widest">
                        Page {page}
                    </div>
                    <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="flex items-center gap-3 px-6 py-3 text-[10px] font-black uppercase tracking-tighter text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95">
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
        <div className="flex flex-col gap-6">
            <div className="flex gap-4 items-center bg-[var(--surface-1)] p-4 rounded-[32px] border border-[var(--border-color)] shadow-sm flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                    <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)] opacity-50"></i>
                    <input type="text" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-[var(--surface-2)] pl-11 pr-4 py-3 border border-transparent focus:border-[var(--border-color)] rounded-[20px] text-sm text-[var(--text-main)] outline-none focus:ring-4 ring-indigo-500/5 transition-all font-medium" />
                </div>
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="bg-[var(--surface-2)] px-6 py-3 border border-transparent hover:border-[var(--border-color)] rounded-[20px] text-sm text-[var(--text-main)] outline-none bg-[var(--surface-2)] cursor-pointer hover:bg-[var(--surface-3)] transition-all font-bold">
                    <option value="all">Everywhere</option>
                    <option value="reported">Highly Reported</option>
                    <option value="anonymous">Anonymous Feed</option>
                    <option value="timelocked">Time-restricted</option>
                </select>
                <div className="px-6 py-3 bg-[#808bf5]/10 border border-indigo-500/20 rounded-[20px] flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#808bf5] shadow-[0_0_10px_rgba(128,139,245,0.4)]"></span>
                    <span className="text-xs font-black text-[#808bf5] uppercase tracking-widest">{total} Global Posts</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {loading ? [1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-[var(--surface-1)] rounded-[32px] p-4 border border-[var(--border-color)] shadow-sm animate-pulse">
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
                        <div key={post._id} className="group bg-[var(--surface-1)] rounded-[32px] border border-[var(--border-color)] shadow-sm overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
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
        <div className="flex flex-col gap-6">
            <div className="flex gap-4 items-center bg-[var(--surface-1)] p-4 rounded-[32px] border border-[var(--border-color)] shadow-sm">
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
                    <div key={report._id} className="bg-[var(--surface-1)] rounded-[32px] border border-[var(--border-color)] shadow-sm p-8 hover:shadow-2xl transition-all duration-300">
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

    const triggerDigest = async () => {
        setLoading(true);
        try {
            const res = await api.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin/debug/digest`, {}, { headers });
            toast.success(res.data.message || 'Digest job triggered');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to trigger digest');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="bg-[var(--surface-1)] rounded-[40px] p-10 shadow-sm border border-[var(--border-color)] max-w-3xl">
                <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-[#808bf5]/10 flex items-center justify-center text-4xl shadow-inner border border-indigo-500/20">📡</div>
                    <div>
                        <h3 className="m-0 text-xl font-black text-[var(--text-main)] uppercase tracking-tight">Control Cluster</h3>
                        <p className="m-0 text-[var(--text-sub)] text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Global Activity & Service Engine</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-8 bg-[var(--surface-2)] rounded-[32px] border border-[var(--border-color)] shadow-inner">
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

                    <div className="p-6 border border-indigo-500/20 bg-indigo-500/5 rounded-[32px]">
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


// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
const AdminDashboard = () => {
    const loggeduser = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);
    const isAdminUser = Boolean(loggeduser?.isAdmin || loggeduser?.role === 'admin');
    const navigate = useNavigate();
    const [verified, setVerified] = useState(false);
    const [activeTab, setActiveTab] = useState('analytics');

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
        { key: 'analytics', icon: '📊', label: 'Analytics' },
        { key: 'users', icon: '👥', label: 'Users' },
        { key: 'posts', icon: '📝', label: 'Posts' },
        { key: 'reports', icon: '🚩', label: 'Reports' },
        { key: 'system', icon: '⚙️', label: 'System' },
    ];


    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[var(--surface-2)]">

            <Header
                user={loggeduser}
                onLock={() => setVerified(false)}
                onHome={() => navigate('/')}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="bg-[var(--surface-1)] border-r border-[var(--border-color)] w-64 flex-shrink-0 flex flex-col h-full shadow-lg">
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-sub)] mb-6 px-4 opacity-50">Master Control</p>
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-3.5 px-6 py-4 rounded-2xl text-[11px] font-black border-0 cursor-pointer text-left w-full transition-all duration-300 ${activeTab === tab.key
                                    ? 'bg-[#808bf5] text-white shadow-xl shadow-indigo-500/20 translate-x-2'
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
                <div className="flex-1 h-full overflow-y-auto p-8 bg-[var(--surface-2)] custom-scrollbar">
                    <div className="max-w-[1440px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
                        {activeTab === 'analytics' && <AnalyticsTab />}
                        {activeTab === 'users' && <UsersTab />}
                        {activeTab === 'posts' && <PostsTab />}
                        {activeTab === 'reports' && <ReportsTab />}
                        {activeTab === 'system' && <SystemTab />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
