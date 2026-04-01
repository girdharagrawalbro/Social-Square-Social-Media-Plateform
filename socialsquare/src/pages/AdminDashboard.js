import { useState, useEffect, useCallback, useMemo } from 'react';
import useAuthStore, { api, getToken } from '../store/zustand/useAuthStore';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import PostDetail from './components/PostDetail';


const useAdmin = () => {
    const token = getToken();
    return useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
};

const Header = ({ user, onLock, onHome }) => (
    <div className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 border-b border-gray-100 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <button onClick={onHome} className="p-2 hover:bg-gray-100 rounded-full transition-colors border-0 bg-transparent cursor-pointer text-gray-500">
                <i className="pi pi-arrow-left text-lg"></i>
            </button>
            <div className="flex flex-col">
                <h1 className="text-xl font-extrabold tracking-tight text-gray-900 m-0 flex items-center gap-2">
                    <span className="text-2xl">⚙️</span> Control Center
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold m-0">Social Square Admin</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
                <img src={user?.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm" />
                <span className="text-xs font-bold text-gray-700">{user?.fullname}</span>
            </div>
            <button onClick={onLock} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-xs font-bold transition-all border-0 cursor-pointer shadow-sm active:scale-95">
                <i className="pi pi-lock"></i> Lock
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

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)' }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                {/* Icon */}
                <div style={{ width: 64, height: 64, borderRadius: '18px', background: 'linear-gradient(135deg, #808bf5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
                    🔐
                </div>

                <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, textAlign: 'center' }}>Admin Access</h2>
                <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                    Re-enter your password to continue
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="Your account password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            autoFocus
                            style={{
                                width: '100%', padding: '12px 44px 12px 16px',
                                borderRadius: '12px', border: error ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => { if (!error) e.target.style.borderColor = '#808bf5'; }}
                            onBlur={e => { if (!error) e.target.style.borderColor = '#e5e7eb'; }}
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: 0 }}>
                            {showPw ? '🙈' : '👁️'}
                        </button>
                    </div>

                    {error && (
                        <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>{error}</p>
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        style={{ padding: '13px', background: loading ? '#c4b5fd' : 'linear-gradient(135deg, #808bf5, #6366f1)', color: '#fff', border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {loading ? (
                            <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Verifying...</>
                        ) : '🔓 Enter Dashboard'}
                    </button>


                    <Link to="/">
                        <button className="bg-gray-200 w-full text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none py-2 px-4 rounded-md transition-colors duration-200">
                            Back
                        </button>
                    </Link>
                </form>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#6366f1', icon }) => (
    <div className="group relative overflow-hidden bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div
            className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 group-hover:scale-110 transition-transform duration-500"
            style={{ background: color }}
        />
        <div className="relative flex items-start justify-between">
            <div>
                <p className="text-3xl font-black text-gray-800 m-0 tracking-tight">{value?.toLocaleString()}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-1 m-0">{label}</p>
                {sub && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 rounded-full">
                        <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                        <p className="text-[10px] font-black text-green-600 m-0">{sub}</p>
                    </div>
                )}
            </div>
            <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner transition-transform group-hover:rotate-12"
                style={{ background: `${color}10`, color: color }}
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
        <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '100%', height: `${(d.count / max) * 70}px`, background: '#808bf5', borderRadius: '4px 4px 0 0', minHeight: '4px', transition: 'height 0.3s' }} title={`${d._id}: ${d.count}`} />
                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>{d._id?.slice(5)}</span>
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
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="font-semibold text-sm mb-3 m-0">🔥 Top Posts</p>
                    {topPosts.map(post => (
                        <div key={post._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <p className="text-xs text-gray-700 m-0 truncate flex-1 mr-2">{post.caption?.slice(0, 50) || '(No caption)'}</p>
                            <div className="flex gap-2 text-xs text-gray-400 flex-shrink-0">
                                <span>❤️ {post.likes?.length || 0}</span>
                                <span>💬 {post.comments?.length || 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="font-semibold text-sm mb-3 m-0">🆕 Recent Users</p>
                    {recentUsers.map(user => (
                        <div key={user._id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                            <img src={user.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium m-0 truncate">{user.fullname}</p>
                                <p className="text-xs text-gray-400 m-0 truncate">{user.email}</p>
                            </div>
                        </div>
                    ))}
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
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
                <input type="text" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none flex-1" style={{ minWidth: '200px' }} />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="all">All users</option>
                    <option value="banned">Banned</option>
                    <option value="admin">Admins</option>
                </select>
                <span className="text-sm text-gray-400 self-center">{total} users</span>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 min-h-0 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead className="sticky top-0 z-10">
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                                {['User', 'Email', 'Followers', 'Status', 'Joined', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                        <span>Loading Users...</span>
                                    </div>
                                </td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>No users found</td></tr>
                            ) : users.map(user => (
                                <tr key={user._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td style={{ padding: '12px 16px' }}>
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img src={user.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-50" />
                                                {user.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 m-0">{user.fullname}</p>
                                                {user.isAdmin && <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">Admin</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280' }}>{user.email}</td>
                                    <td style={{ padding: '12px 16px', fontSize: '12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>{user.followers?.length || 0}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.isBanned ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                            {user.isBanned ? 'BANNED' : 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>{new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div className="flex gap-2">
                                            {user.isBanned
                                                ? <button onClick={() => unbanUser(user._id)} className="bg-green-50 text-green-600 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold border-0 cursor-pointer transition-all active:scale-95">Unban</button>
                                                : <button onClick={() => setBanData({ visible: true, userId: user._id, reason: '' })} className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold border-0 cursor-pointer transition-all active:scale-95">Ban</button>
                                            }
                                            <button onClick={() => deleteUser(user._id)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-[10px] font-bold border-0 cursor-pointer transition-all active:scale-95">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="flex justify-between items-center bg-white px-6 py-4 border-t rounded-b-2xl">
                <p className="text-xs font-bold text-gray-400 m-0">Showing {Math.min(20, users.length)} of {total} results</p>
                <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 border border-gray-100 rounded-xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all active:scale-95">
                        <i className="pi pi-chevron-left"></i> Prev
                    </button>
                    <div className="flex items-center px-4 bg-gray-50 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-100">
                        Page {page}
                    </div>
                    <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 border border-gray-100 rounded-xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all active:scale-95">
                        Next <i className="pi pi-chevron-right"></i>
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
            <div className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                    <i className="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-11 pr-4 py-3 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                </div>
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="px-4 py-3 border border-gray-100 rounded-xl text-sm outline-none bg-white cursor-pointer hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                    <option value="all">All posts</option>
                    <option value="reported">Reported</option>
                    <option value="anonymous">Anonymous</option>
                    <option value="timelocked">Time-locked</option>
                </select>
                <div className="px-4 py-3 bg-indigo-50 rounded-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span className="text-xs font-bold text-indigo-700">{total} Posts</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {loading ? [1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm">
                        <div className="aspect-[4/3] bg-gray-50 rounded-2xl animate-pulse flex items-center justify-center">
                            <i className="pi pi-image text-gray-200 text-3xl"></i>
                        </div>
                        <div className="mt-3 flex flex-col gap-2">
                            <div className="h-4 w-3/4 bg-gray-50 rounded animate-pulse"></div>
                            <div className="h-4 w-1/2 bg-gray-50 rounded animate-pulse"></div>
                        </div>
                    </div>
                )) : posts.map(post => {
                    const postImg = post.image_urls?.[0] || post.image_url;
                    return (
                        <div key={post._id} className="group bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                                {postImg ? (
                                    <img src={postImg} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-6 text-center text-gray-400 bg-gradient-to-br from-gray-50 to-indigo-50/30">
                                        <p className="text-xs italic leading-relaxed">"{post.caption?.slice(0, 100) || 'No visual media'}"</p>
                                    </div>
                                )}
                                <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                                    {post.isAnonymous && <span className="bg-white/90 backdrop-blur-md text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-white shadow-sm">Anonymous</span>}
                                    {post.unlocksAt && new Date(post.unlocksAt) > Date.now() && <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-sm">Frozen</span>}
                                </div>
                            </div>
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <img src={post.user?.profile_picture || '/default-profile.png'} alt="" className="w-6 h-6 rounded-full object-cover border-2 border-white shadow-sm" />
                                    <span className="text-[10px] font-bold text-gray-500 truncate">{post.user?.fullname || 'Anonymous'}</span>
                                </div>
                                <p className="text-xs text-gray-700 font-medium line-clamp-2 min-h-[32px] leading-relaxed mb-4">{post.caption || '(No caption)'}</p>
                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex gap-3 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                        <span className="flex items-center gap-1"><i className="pi pi-heart-fill text-red-400"></i> {post.likes?.length || 0}</span>
                                        <span className="flex items-center gap-1"><i className="pi pi-comment text-indigo-400"></i> {post.comments?.length || 0}</span>
                                    </div>
                                    <button onClick={() => deletePost(post._id)} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-4 py-1.5 rounded-xl text-[10px] font-bold border-0 cursor-pointer transition-all active:scale-95">Remove</button>
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
            <div className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <select value={status} onChange={e => setStatus(e.target.value)} className="px-4 py-3 border border-gray-100 rounded-xl text-sm outline-none bg-white cursor-pointer hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                    <option value="pending">Pending Reports</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="all">All Records</option>
                </select>
                <div className="px-4 py-3 bg-red-50 rounded-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-red-700">{total} Active Reports</span>
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
                    <div className="bg-white rounded-3xl p-12 border border-gray-100 shadow-sm text-center">
                        <span className="text-5xl mb-4 block">✨</span>
                        <h3 className="text-lg font-bold text-gray-800 m-0">Zero pending reports</h3>
                        <p className="text-xs text-gray-400 mt-2">The platform is clean and safe for now.</p>
                    </div>
                ) : reports.map(report => (
                    <div key={report._id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <img src={report.reporter?.profile_picture || '/default-profile.png'} alt="" className="w-12 h-12 rounded-2xl object-cover ring-4 ring-gray-50 shadow-sm" />
                                    <span className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm text-[10px]">🚩</span>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-800 m-0">{report.reporter?.fullname || 'Unknown'}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest m-0 flex items-center gap-1.5 mt-0.5">
                                        REPORTED A <span className="text-indigo-600 font-black">{report.targetType}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '8px', background: `${REASON_COLOR[report.reason]}15`, color: REASON_COLOR[report.reason], letterSpacing: '0.05em', border: `1px solid ${REASON_COLOR[report.reason]}30` }}>
                                    {report.reason?.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] font-bold text-gray-300">{new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {report.description && (
                            <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 italic relative">
                                <span className="absolute -left-2 -top-2 text-2xl text-gray-100 font-serif">“</span>
                                <p className="text-xs text-gray-600 m-0 relative z-10 leading-relaxed pr-4">{report.description}</p>
                            </div>
                        )}

                        {/* Target Context */}
                        <div className="mt-5 p-5 bg-gradient-to-br from-[#fafaff] to-white rounded-2xl border border-indigo-100/50 shadow-inner">
                            {report.targetType === 'post' && report.targetPost && (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        <div className="w-1 h-8 bg-indigo-200 rounded-full"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Target Post Content</p>
                                            <p className="text-xs text-gray-700 m-0 truncate italic font-medium leading-relaxed">"{report.targetPost.caption || '(No caption)'}"</p>
                                        </div>
                                        <button onClick={() => setPostPreview({ visible: true, postId: report.targetId })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100 shrink-0">View Post</button>
                                    </div>
                                    <button onClick={() => deletePost(report.targetId, report._id)} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer hover:bg-red-600 hover:text-white transition-all shrink-0">Remove Post</button>
                                </div>
                            )}

                            {report.targetType === 'comment' && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 bg-pink-200 rounded-full"></div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Target Comment ID</p>
                                            <span className="text-xs font-mono text-gray-500">{report.targetId}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteComment(report.targetId, report._id)} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-bold border-0 cursor-pointer hover:bg-red-600 hover:text-white transition-all">Remove Comment</button>
                                </div>
                            )}

                            {/* Author Row */}
                            <div className="mt-4 flex items-center justify-between border-t border-gray-100/50 pt-4">
                                <div className="flex items-center gap-2">
                                    <i className="pi pi-user text-gray-300 text-[10px]"></i>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Content Author:</span>
                                    <span className="text-[10px] font-black text-indigo-700">{report.targetUser?.fullname || report.targetPost?.user?.fullname || 'Loading...'}</span>
                                </div>
                                <button onClick={() => {
                                    const targetUid = report.targetUser?._id || report.targetPost?.user?._id;
                                    if (targetUid) banUser(targetUid, `Reported for ${report.reason}`, report._id);
                                }} className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-xl text-[10px] font-bold border-0 cursor-pointer hover:bg-orange-600 hover:text-white transition-all">Ban Author</button>
                            </div>
                        </div>

                        {report.status === 'pending' && (
                            <div className="flex gap-3 mt-6 justify-end">
                                <button onClick={() => resolve(report._id, 'dismissed')} className="px-6 py-2.5 rounded-2xl text-[11px] font-bold text-gray-500 hover:bg-gray-50 transition-all border-0 cursor-pointer">Ignore Request</button>
                                <button onClick={() => resolve(report._id, 'resolved')} className="px-8 py-2.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black tracking-wide border-0 cursor-pointer hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Fix & Resolve</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-4 pb-8">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all shadow-sm">← Prev</button>
                <div className="flex items-center px-6 bg-white rounded-2xl text-xs font-black text-indigo-600 border border-indigo-100 shadow-sm">Page {page}</div>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-6 py-2.5 text-xs font-bold text-gray-600 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition-all shadow-sm">Next →</button>
            </div>

            <Dialog header="Post Detail" visible={postPreview.visible} style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }} onHide={() => setPostPreview({ visible: false, postId: null })} modal className="p-0">
                {postPreview.postId && <PostDetail postId={postPreview.postId} isModal={true} onClose={() => setPostPreview({ visible: false, postId: null })} />}
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
        <div className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 max-w-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl">📧</div>
                    <div>
                        <h3 className="m-0 text-lg font-bold text-gray-900">Email Digest System</h3>
                        <p className="m-0 text-gray-500 text-sm">Manage and verify the daily activity digest background jobs.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-sm font-bold text-gray-700 mb-2 m-0">Manual Trigger</p>
                        <p className="text-xs text-gray-500 mb-4 m-0 leading-relaxed">
                            Immediately add a 'daily-digest' job to the processing queue. This will send emails to all eligible users
                            (and administrators) immediately. Use this to verify the mailer and template logic.
                        </p>
                        <button
                            onClick={triggerDigest}
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all border-0 cursor-pointer shadow-sm active:scale-95 ${loading ? 'bg-gray-200 text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            {loading ? <i className="pi pi-spin pi-spinner"></i> : <i className="pi pi-bolt"></i>}
                            {loading ? 'Triggering...' : 'Trigger Daily Digest Now'}
                        </button>
                    </div>

                    <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-2xl">
                        <div className="flex gap-3">
                            <i className="pi pi-info-circle text-indigo-500 mt-0.5"></i>
                            <div className="text-xs text-indigo-700 space-y-2">
                                <p className="m-0 font-bold">System Schedule: Daily at 8:00 AM UTC</p>
                                <p className="m-0">The automatic job is configured to run every 24 hours. Administrators will receive a status digest even if there is zero system activity for verification purposes.</p>
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
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
            <ConfirmDialog />
            <Header
                user={loggeduser}
                onLock={() => setVerified(false)}
                onHome={() => navigate('/')}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="bg-white border-r w-64 flex-shrink-0 flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-4">Menu</p>
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-xs font-bold border-0 cursor-pointer text-left w-full transition-all duration-200 ${activeTab === tab.key
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1'
                                    : 'bg-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                            >
                                <span className="text-lg">{tab.icon}</span>
                                <span className="tracking-wide">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="p-6 border-t bg-white">
                        <div className="bg-indigo-50 rounded-3xl p-5 border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest m-0 mb-1">System Version</p>
                            <p className="text-xs font-bold text-indigo-700 m-0">v2.4.0-Stable</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 h-full overflow-y-auto p-8 bg-[#fdfdff]">
                    <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
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