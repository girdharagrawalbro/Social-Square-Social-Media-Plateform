    import  { useState, useEffect, useCallback, useMemo } from 'react';
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
            await api.post('/api/auth/verify-password', { password }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Incorrect password');
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)' }}>
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
const StatCard = ({ label, value, sub, color = '#808bf5', icon }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
        <div style={{ width: 48, height: 48, borderRadius: '12px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold m-0">{value?.toLocaleString()}</p>
            <p className="text-sm text-gray-500 m-0">{label}</p>
            {sub && <p className="text-xs text-green-500 m-0">{sub}</p>}
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
                <StatCard icon="🚫" label="Banned Users" value={overview.bannedUsers} color="#ef4444" />
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                            {['User', 'Email', 'Followers', 'Status', 'Joined', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading...</td></tr>
                        ) : users.map(user => (
                            <tr key={user._id} style={{ borderBottom: '1px solid #f9fafb' }}>
                                <td style={{ padding: '10px 12px' }}>
                                    <div className="flex items-center gap-2">
                                        <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                                        <div>
                                            <p className="text-xs font-medium m-0">{user.fullname}</p>
                                            {user.isAdmin && <span style={{ fontSize: '9px', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 5px' }}>Admin</span>}
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{user.email}</td>
                                <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center' }}>{user.followers?.length || 0}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: user.isBanned ? '#fee2e2' : '#d1fae5', color: user.isBanned ? '#ef4444' : '#059669' }}>
                                        {user.isBanned ? '🚫 Banned' : '✅ Active'}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <div className="flex gap-1">
                                        {user.isBanned
                                            ? <button onClick={() => unbanUser(user._id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Unban</button>
                                            : <button onClick={() => setBanData({ visible: true, userId: user._id, reason: '' })} style={{ fontSize: '11px', padding: '3px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Ban</button>
                                        }
                                        <button onClick={() => deleteUser(user._id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">Next →</button>
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

    const imgs = post => post.image_urls?.[0] || post.image_url;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
                <input type="text" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none flex-1" style={{ minWidth: '200px' }} />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="all">All posts</option>
                    <option value="reported">Reported</option>
                    <option value="anonymous">Anonymous</option>
                    <option value="timelocked">Time-locked</option>
                </select>
                <span className="text-sm text-gray-400 self-center">{total} posts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {loading ? [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ height: 200 }} />) :
                    posts.map(post => (
                        <div key={post._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            {imgs(post)
                                ? <img src={imgs(post)} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '80px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '12px', padding: '8px', textAlign: 'center' }}>{post.caption?.slice(0, 60)}</div>
                            }
                            <div style={{ padding: '8px' }}>
                                <p style={{ fontSize: '11px', color: '#374151', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || '(No caption)'}</p>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    {post.isAnonymous && <span style={{ fontSize: '9px', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 5px' }}>Anonymous</span>}
                                    {post.unlocksAt && new Date(post.unlocksAt) > Date.now() && <span style={{ fontSize: '9px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', padding: '1px 5px' }}>Time-locked</span>}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>❤️ {post.likes?.length || 0} · 💬 {post.comments?.length || 0}</span>
                                    <button onClick={() => deletePost(post._id)} style={{ fontSize: '10px', padding: '2px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
            <div className="flex justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">Next →</button>
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
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-center">
                <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="all">All</option>
                </select>
                <span className="text-sm text-gray-400">{total} reports</span>
            </div>
            <div className="flex flex-col gap-3">
                {loading ? <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div> :
                    reports.length === 0 ? <p className="text-center text-gray-400 py-8">No reports found</p> :
                        reports.map(report => (
                            <div key={report._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <img src={report.reporter?.profile_picture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium m-0">{report.reporter?.fullname || 'Unknown'}</p>
                                            <p className="text-xs text-gray-400 m-0">reported a <span className="font-bold text-indigo-500">{report.targetType}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: `${REASON_COLOR[report.reason]}20`, color: REASON_COLOR[report.reason] }}>
                                            {report.reason?.replace('_', ' ')}
                                        </span>
                                        <span style={{ fontSize: '10px', color: '#9ca3af' }}>{new Date(report.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {report.description && <p className="text-xs text-gray-500 mt-2 mb-0 italic">"{report.description}"</p>}
                                
                                {/* Target Context */}
                                <div className="mt-3 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    {report.targetType === 'post' && report.targetPost && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-xs text-gray-400 flex-shrink-0">Post:</span>
                                                <p className="text-xs text-gray-600 m-0 truncate italic">"{report.targetPost.caption || '(No caption)'}"</p>
                                                <button onClick={() => setPostPreview({ visible: true, postId: report.targetId })} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded hover:bg-indigo-600 hover:text-white transition cursor-pointer">View</button>
                                            </div>
                                            <button onClick={() => deletePost(report.targetId, report._id)} className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition cursor-pointer">Remove Post</button>
                                        </div>
                                    )}
                                    {report.targetType === 'comment' && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400 italic">Target Comment ID: {report.targetId}</span>
                                            <button onClick={() => deleteComment(report.targetId, report._id)} className="text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition cursor-pointer">Remove Comment</button>
                                        </div>
                                    )}
                                    {/* Action to ban the author/user */}
                                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                                        <span className="text-[10px] text-gray-400">Target User: {report.targetUser?.fullname || report.targetPost?.user?.fullname || 'Loading...'}</span>
                                        <button onClick={() => {
                                            const targetUid = report.targetUser?._id || report.targetPost?.user?._id;
                                            if (targetUid) banUser(targetUid, `Reported for ${report.reason}`, report._id);
                                        }} className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded hover:bg-orange-600 hover:text-white transition cursor-pointer">Ban Author</button>
                                    </div>
                                </div>

                                {report.status === 'pending' && (
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => resolve(report._id, 'resolved')} style={{ fontSize: '12px', padding: '4px 12px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>✓ Mark Resolved</button>
                                        <button onClick={() => resolve(report._id, 'dismissed')} style={{ fontSize: '12px', padding: '4px 12px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Dismiss</button>
                                    </div>
                                )}
                            </div>
                        ))
                }
            </div>
            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">Next →</button>
            </div>

            <Dialog header="Post Detail" visible={postPreview.visible} style={{ width: '95vw', maxWidth: '1000px', height: '80vh' }} onHide={() => setPostPreview({ visible: false, postId: null })} modal className="p-0">
                {postPreview.postId && <PostDetail postId={postPreview.postId} isModal={true} onClose={() => setPostPreview({ visible: false, postId: null })} />}
            </Dialog>
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
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', gap: '16px' }}>
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
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <ConfirmDialog />
            {/* Header */}
            <div className="bg-white border-b shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-gray-400 border-0 bg-transparent cursor-pointer p-0 mr-2">
                        <i className="pi pi-arrow-left"></i>
                    </button>
                    <h1 className="text-xl font-bold m-0">⚙️ Admin Dashboard</h1>
                    <span style={{ fontSize: '11px', background: '#ede9fe', color: '#6366f1', borderRadius: '10px', padding: '2px 8px' }}>Social Square</span>
                </div>
                <div className="flex items-center gap-3">
                    <img src={loggeduser.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-sm font-medium">{loggeduser.fullname}</span>
                    <button onClick={() => setVerified(false)} title="Lock dashboard"
                        style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                        🔒 Lock
                    </button>
                </div>
            </div>

            <div className="flex" style={{ minHeight: 'calc(100vh - 65px)' }}>
                {/* Sidebar */}
                <div className="bg-white border-r w-48 flex-shrink-0 p-3">
                    <div className="flex flex-col gap-1 mt-2">
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-0 cursor-pointer text-left w-full transition-all"
                                style={{ background: activeTab === tab.key ? '#ede9fe' : 'transparent', color: activeTab === tab.key ? '#6366f1' : '#6b7280' }}>
                                <span>{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-auto">
                    {activeTab === 'analytics' && <AnalyticsTab />}
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'posts' && <PostsTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;