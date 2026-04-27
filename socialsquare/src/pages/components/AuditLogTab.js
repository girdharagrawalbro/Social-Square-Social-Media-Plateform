import { useState, useEffect, useCallback } from 'react';
import { api, getToken } from '../../store/zustand/useAuthStore';
import { useMemo } from 'react';

// ── mirrors useAdmin() in your AdminDashboard ────────────────────────────────
const useAdmin = () => {
    const token = getToken();
    return useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
};

// ── Action metadata ───────────────────────────────────────────────────────────
const ACTION_META = {
    ban_user:       { label: 'Banned user',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)',    icon: '🚫' },
    unban_user:     { label: 'Unbanned user',      color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.2)',    icon: '✅' },
    delete_user:    { label: 'Deleted account',    color: '#dc2626', bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.2)',    icon: '🗑️' },
    delete_post:    { label: 'Deleted post',       color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.2)',   icon: '📄' },
    delete_comment: { label: 'Deleted comment',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)',   icon: '💬' },
    resolve_report: { label: 'Resolved report',    color: '#808bf5', bg: 'rgba(128,139,245,0.1)',  border: 'rgba(128,139,245,0.2)', icon: '🛡️' },
    dismiss_report: { label: 'Dismissed report',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.2)', icon: '🙈' },
    trigger_digest: { label: 'Triggered digest',   color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.2)',  icon: '📡' },
    warn_user:      { label: 'Warned user',        color: '#eab308', bg: 'rgba(234,179,8,0.1)',    border: 'rgba(234,179,8,0.2)',   icon: '⚠️' },
    content_flagged: { label: 'Content flagged',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.2)',   icon: '⚠️' },
};

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)   return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60)   return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30)   return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
    <tr className="animate-pulse">
        {[140, 120, 200, 160, 100].map((w, i) => (
            <td key={i} style={{ padding: '16px 20px' }}>
                <div style={{ height: 12, width: w, borderRadius: 8, background: 'var(--surface-3)' }} />
            </td>
        ))}
    </tr>
);

// ── Main component ────────────────────────────────────────────────────────────
const AuditLogTab = () => {
    const { headers } = useAdmin();
    const [logs, setLogs]           = useState([]);
    const [total, setTotal]         = useState(0);
    const [adminList, setAdminList] = useState([]);
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(true);
    const [expanded, setExpanded]   = useState(null); // row id for detail expand
    const [filters, setFilters]     = useState({
        action:     'all',
        adminId:    'all',
        targetType: 'all',
        from:       '',
        to:         '',
    });

    const fetchLogs = useCallback(() => {
        setLoading(true);
        const params = { page, ...filters };
        // Remove empty date strings
        if (!params.from) delete params.from;
        if (!params.to)   delete params.to;

        api.get('/api/admin/audit', { headers, params })
            .then(r => {
                setLogs(r.data.logs || []);
                setTotal(r.data.total || 0);
                if (r.data.adminList?.length) setAdminList(r.data.adminList);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [page, filters, headers]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const setFilter = (key, value) => {
        setFilters(f => ({ ...f, [key]: value }));
        setPage(1);
    };

    const totalPages = Math.ceil(total / 20);

    return (
        <div className="flex flex-col gap-6">

            {/* ── Header strip ──────────────────────────────────────────── */}
            <div className="flex gap-3 flex-wrap items-center bg-[var(--surface-1)] p-4 rounded-[32px] border border-[var(--border-color)] shadow-sm">

                {/* Action filter */}
                <select
                    value={filters.action}
                    onChange={e => setFilter('action', e.target.value)}
                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xs font-black text-[var(--text-main)] outline-none hover:bg-[var(--surface-3)] cursor-pointer transition-all uppercase tracking-widest"
                >
                    <option value="all">All actions</option>
                    {Object.entries(ACTION_META).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>

                {/* Target type filter */}
                <select
                    value={filters.targetType}
                    onChange={e => setFilter('targetType', e.target.value)}
                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xs font-black text-[var(--text-main)] outline-none hover:bg-[var(--surface-3)] cursor-pointer transition-all uppercase tracking-widest"
                >
                    <option value="all">All targets</option>
                    <option value="user">Users</option>
                    <option value="post">Posts</option>
                    <option value="comment">Comments</option>
                    <option value="report">Reports</option>
                    <option value="system">System</option>
                </select>

                {/* Admin filter (populated from server) */}
                {adminList.length > 1 && (
                    <select
                        value={filters.adminId}
                        onChange={e => setFilter('adminId', e.target.value)}
                        className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-xs font-black text-[var(--text-main)] outline-none hover:bg-[var(--surface-3)] cursor-pointer transition-all uppercase tracking-widest"
                    >
                        <option value="all">All admins</option>
                        {adminList.map(a => (
                            <option key={a._id} value={a._id}>{a.fullname}</option>
                        ))}
                    </select>
                )}

                {/* Date range */}
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filters.from}
                        onChange={e => setFilter('from', e.target.value)}
                        className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-3 py-3 text-xs font-bold text-[var(--text-main)] outline-none focus:border-[#808bf5] transition-all"
                        title="From date"
                    />
                    <span className="text-[10px] font-black text-[var(--text-sub)] opacity-50">TO</span>
                    <input
                        type="date"
                        value={filters.to}
                        onChange={e => setFilter('to', e.target.value)}
                        className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-3 py-3 text-xs font-bold text-[var(--text-main)] outline-none focus:border-[#808bf5] transition-all"
                        title="To date"
                    />
                    {(filters.from || filters.to) && (
                        <button
                            onClick={() => { setFilter('from', ''); setFilter('to', ''); }}
                            className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-2xl px-3 py-3 text-[10px] font-black text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Total badge */}
                <div className="ml-auto px-5 py-3 bg-[#808bf5]/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#808bf5] animate-pulse shadow-[0_0_8px_rgba(128,139,245,0.5)]" />
                    <span className="text-[10px] font-black text-[#808bf5] uppercase tracking-widest">{total.toLocaleString()} Log Entries</span>
                </div>
            </div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className="bg-[var(--surface-1)] rounded-[32px] shadow-sm border border-[var(--border-color)] overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-color)' }}>
                                {['Timestamp', 'Admin', 'Action', 'Target', 'Reason / Note'].map(h => (
                                    <th
                                        key={h}
                                        style={{
                                            padding: '16px 20px',
                                            textAlign: 'left',
                                            fontSize: '10px',
                                            fontWeight: 900,
                                            color: 'var(--text-sub)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            opacity: 0.6,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '80px 20px' }}>
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <span style={{ fontSize: 48 }}>🕵️</span>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sub)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                No log entries found
                                            </p>
                                            <p style={{ fontSize: 11, color: 'var(--text-sub)', margin: 0 }}>
                                                Admin actions will appear here once recorded
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.map(log => {
                                const meta = ACTION_META[log.action] || {
                                    label: log.action, color: '#6b7280',
                                    bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)', icon: '📋',
                                };
                                const isExpanded = expanded === log._id;

                                return (
                                    <>
                                        <tr
                                            key={log._id}
                                            onClick={() => setExpanded(isExpanded ? null : log._id)}
                                            style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                            className={`hover:bg-[var(--surface-2)]/60 transition-colors ${isExpanded ? 'bg-[var(--surface-2)]/40' : ''}`}
                                        >
                                            {/* Timestamp */}
                                            <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                                                        {relativeTime(log.createdAt)}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-sub)', opacity: 0.5, fontWeight: 600 }}>
                                                        {new Date(log.createdAt).toLocaleString(undefined, {
                                                            month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Admin */}
                                            <td style={{ padding: '14px 20px' }}>
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={log.admin?.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'}
                                                        alt=""
                                                        style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }}
                                                    />
                                                    <div className="flex flex-col gap-0.5">
                                                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                                            {log.admin?.fullname || 'Unknown Admin'}
                                                        </span>
                                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#808bf5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                            Administrator
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Action badge */}
                                            <td style={{ padding: '14px 20px' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '6px 12px',
                                                    borderRadius: 12,
                                                    background: meta.bg,
                                                    border: `1px solid ${meta.border}`,
                                                    color: meta.color,
                                                    fontSize: 10,
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.08em',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    <span style={{ fontSize: 13 }}>{meta.icon}</span>
                                                    {meta.label}
                                                </span>
                                            </td>

                                            {/* Target */}
                                            <td style={{ padding: '14px 20px', maxWidth: 220 }}>
                                                <div className="flex items-center gap-3">
                                                    {log.targetSnapshot?.picture && (
                                                        <img
                                                            src={log.targetSnapshot.picture}
                                                            alt=""
                                                            style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                                                        />
                                                    )}
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 160 }}>
                                                            {log.targetSnapshot?.name || log.targetId || '—'}
                                                        </span>
                                                        {log.targetSnapshot?.email && (
                                                            <span style={{ fontSize: 10, color: 'var(--text-sub)', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 160 }}>
                                                                {log.targetSnapshot.email}
                                                            </span>
                                                        )}
                                                        <span style={{
                                                            fontSize: 9, fontWeight: 800, color: 'var(--text-sub)', opacity: 0.5,
                                                            textTransform: 'uppercase', letterSpacing: '0.08em',
                                                        }}>
                                                            {log.targetType}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Reason / expand toggle */}
                                            <td style={{ padding: '14px 20px' }}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span style={{ fontSize: 12, color: 'var(--text-sub)', fontStyle: log.meta?.reason ? 'normal' : 'italic', opacity: log.meta?.reason ? 0.8 : 0.4, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {log.meta?.reason || 'No note'}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-sub)', opacity: 0.4, flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
                                                        ▾
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── Expanded detail row ──────────────────────────── */}
                                        {isExpanded && (
                                            <tr key={`${log._id}-detail`}>
                                                <td colSpan={5} style={{ padding: '0 20px 16px', background: 'var(--surface-2)' }}>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                        gap: 12,
                                                        padding: '16px',
                                                        background: 'var(--surface-1)',
                                                        borderRadius: 20,
                                                        border: '1px solid var(--border-color)',
                                                    }}>
                                                        <DetailCell label="Log ID" value={log._id} mono />
                                                        <DetailCell label="Target ID" value={log.targetId || '—'} mono />
                                                        <DetailCell label="Target type" value={log.targetType} />
                                                        <DetailCell label="Admin email" value={log.admin?.email || '—'} />
                                                        <DetailCell label="IP address" value={log.meta?.ip || '—'} mono />
                                                        <DetailCell
                                                            label="Full timestamp"
                                                            value={new Date(log.createdAt).toLocaleString(undefined, {
                                                                weekday: 'short', year: 'numeric', month: 'long',
                                                                day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                            })}
                                                        />
                                                        {log.meta?.reason && (
                                                            <DetailCell label="Reason (full)" value={log.meta.reason} wide />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ────────────────────────────────────────── */}
                {total > 0 && (
                    <div className="flex justify-between items-center px-8 py-5 border-t border-[var(--border-color)]">
                        <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-sub)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
                            Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total.toLocaleString()} entries
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <i className="pi pi-chevron-left text-[8px]" /> Previous
                            </button>
                            <div className="flex items-center px-6 bg-[var(--surface-2)] rounded-2xl text-[10px] font-black text-[#808bf5] border border-[var(--border-color)] uppercase tracking-widest">
                                {page} / {totalPages || 1}
                            </div>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages}
                                className="flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] border border-[var(--border-color)] rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                Next <i className="pi pi-chevron-right text-[8px]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Small helper for the expanded detail cells ────────────────────────────────
const DetailCell = ({ label, value, mono, wide }) => (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
        <p style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.5, margin: '0 0 4px' }}>{label}</p>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)', margin: 0, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>{value}</p>
    </div>
);

export default AuditLogTab;
