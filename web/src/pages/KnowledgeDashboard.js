import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../store/zustand/useAuthStore';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import toast from '../utils/toast.js';

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString() ?? '0';

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const TYPE_BADGE = {
    note: { label: '📝 Note', color: '#6366f1' },
    learning: { label: '🎓 Learning', color: '#10b981' },
};

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({ note, onDelete, onEdit }) {
    const badge = TYPE_BADGE[note.type] || TYPE_BADGE.note;
    const [expanded, setExpanded] = useState(false);
    const displayText = note.aiSummary || note.content || note.originalCaption || '';

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '20px 22px',
            position: 'relative',
            transition: 'box-shadow 0.2s',
            cursor: 'default',
        }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
            {/* Type badge + topic */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: badge.color + '20', color: badge.color, letterSpacing: 0.5,
                }}>
                    {badge.label}
                </span>
                {note.topic && (
                    <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 99,
                        background: 'rgba(128,139,245,0.1)', color: '#808bf5', fontWeight: 600,
                    }}>
                        {note.topic}
                    </span>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-sub)', marginLeft: 'auto' }}>
                    {timeAgo(note.createdAt)}
                </span>
            </div>

            {/* Title */}
            {note.title && (
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.35 }}>
                    {note.title}
                </h3>
            )}

            {/* AI summary / content */}
            {displayText && (
                <p style={{
                    margin: '0 0 10px', fontSize: 13, color: 'var(--text-sub)',
                    lineHeight: 1.6,
                    display: expanded ? 'block' : '-webkit-box',
                    WebkitLineClamp: expanded ? 'none' : 3,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                    {displayText}
                </p>
            )}
            {displayText.length > 200 && (
                <button
                    onClick={() => setExpanded(e => !e)}
                    style={{ background: 'none', border: 'none', color: '#808bf5', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 10, fontWeight: 600 }}
                >
                    {expanded ? 'Show less' : 'Read more'}
                </button>
            )}

            {/* User annotation */}
            {note.annotation && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(128,139,245,0.08), rgba(99,102,241,0.06))',
                    border: '1px solid rgba(128,139,245,0.2)',
                    borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                    borderLeft: '3px solid #808bf5',
                }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-main)', fontStyle: 'italic', lineHeight: 1.5 }}>
                        💭 "{note.annotation}"
                    </p>
                </div>
            )}

            {/* Tags */}
            {note.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {note.tags.slice(0, 5).map((t, i) => (
                        <span key={i} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 99,
                            background: 'var(--surface-2, rgba(0,0,0,0.05))', color: 'var(--text-sub)',
                        }}>
                            {t}
                        </span>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                    onClick={() => onEdit?.(note)}
                    style={{
                        background: 'var(--surface-2, rgba(0,0,0,0.05))', border: 'none',
                        borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-sub)', fontWeight: 600,
                    }}
                >
                    ✏️ Edit
                </button>
                <button
                    onClick={() => onDelete?.(note._id)}
                    style={{
                        background: 'rgba(239,68,68,0.1)', border: 'none',
                        borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                        fontSize: 12, color: '#ef4444', fontWeight: 600,
                    }}
                >
                    🗑️ Delete
                </button>
            </div>
        </div>
    );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, gradient }) {
    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '22px 24px',
            display: 'flex', flexDirection: 'column', gap: 8,
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 100, height: 100, borderRadius: '50%',
                background: gradient, opacity: 0.12,
            }} />
            <span style={{ fontSize: 28 }}>{icon}</span>
            <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                {fmt(value)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 500 }}>{label}</span>
        </div>
    );
}

// ─── Topic Tree Sidebar ────────────────────────────────────────────────────────
function TopicTree({ tree, activeTopic, onSelect }) {
    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '20px',
            position: 'sticky', top: 20,
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                🌳 Knowledge Tree
            </h3>

            <button
                onClick={() => onSelect('')}
                style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    padding: '9px 12px', borderRadius: 10, marginBottom: 4,
                    background: !activeTopic ? 'linear-gradient(135deg,#808bf5,#6366f1)' : 'transparent',
                    color: !activeTopic ? 'white' : 'var(--text-main)',
                    fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
            >
                <span>📚 All topics</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>
                    {tree.reduce((acc, t) => acc + (t.noteCount || 0), 0)}
                </span>
            </button>

            {tree.map(t => (
                <button
                    key={t.topic}
                    onClick={() => onSelect(t.topic)}
                    style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                        padding: '9px 12px', borderRadius: 10, marginBottom: 4,
                        background: activeTopic === t.topic ? 'linear-gradient(135deg,rgba(128,139,245,0.15),rgba(99,102,241,0.1))' : 'transparent',
                        color: activeTopic === t.topic ? '#808bf5' : 'var(--text-main)',
                        fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                >
                    <span>{t.icon || '📂'} {t.topic}</span>
                    <span style={{ fontSize: 11, opacity: 0.65 }}>{t.noteCount}</span>
                </button>
            ))}

            {tree.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', textAlign: 'center', padding: '20px 0' }}>
                    Save your first post to grow your tree 🌱
                </p>
            )}
        </div>
    );
}

// ─── Weekly Activity bar chart ────────────────────────────────────────────────
function ActivityChart({ data }) {
    if (!data?.length) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Fill last 7 days
    const slots = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const found = data.find(x => x._id === key);
        slots.push({ day: days[d.getDay()], count: found?.count || 0 });
    }

    return (
        <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '20px 24px',
            marginBottom: 24,
        }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                📅 Weekly Activity
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 64 }}>
                {slots.map((s, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                            width: '100%', borderRadius: 6,
                            height: `${Math.max((s.count / max) * 48, 4)}px`,
                            background: s.count > 0
                                ? 'linear-gradient(180deg, #808bf5, #6366f1)'
                                : 'var(--border-color)',
                            transition: 'height 0.4s ease',
                        }} />
                        <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>{s.day}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function KnowledgeDashboard() {
    const [dashboard, setDashboard] = useState(null);
    const [tree, setTree] = useState([]);
    const [notes, setNotes] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
    const [activeTopic, setActiveTopic] = useState('');
    const [activeType, setActiveType] = useState('');
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [loading, setLoading] = useState(true);
    const [notesLoading, setNotesLoading] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [editAnnotation, setEditAnnotation] = useState('');

    const fetchDashboard = useCallback(async () => {
        try {
            const [dashRes, treeRes] = await Promise.all([
                api.get('/api/knowledge/dashboard'),
                api.get('/api/knowledge/tree'),
            ]);
            setDashboard(dashRes.data);
            setTree(treeRes.data.tree || []);
        } catch (err) {
            console.error('Dashboard fetch error', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchNotes = useCallback(async (page = 1) => {
        setNotesLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 12, sort });
            if (activeTopic) params.set('topic', activeTopic);
            if (activeType) params.set('type', activeType);
            if (search) params.set('search', search);

            const res = await api.get(`/api/knowledge/notes?${params}`);
            setNotes(res.data.notes || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            console.error('Notes fetch error', err);
        } finally {
            setNotesLoading(false);
        }
    }, [activeTopic, activeType, search, sort]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
    useEffect(() => { fetchNotes(1); }, [fetchNotes]);

    const handleDelete = async (noteId) => {
        if (!window.confirm('Delete this note?')) return;
        try {
            await api.delete(`/api/knowledge/notes/${noteId}`);
            toast.success('Note deleted');
            setNotes(n => n.filter(x => x._id !== noteId));
            fetchDashboard();
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleEditSave = async () => {
        if (!editingNote) return;
        try {
            await api.put(`/api/knowledge/notes/${editingNote._id}`, { annotation: editAnnotation });
            toast.success('Note updated!');
            setNotes(n => n.map(x => x._id === editingNote._id ? { ...x, annotation: editAnnotation } : x));
            setEditingNote(null);
        } catch {
            toast.error('Update failed');
        }
    };  

    const stats = dashboard?.stats;

    return (
        <>
            <Helmet>
                <title>Knowledge Dashboard — Social Square</title>
                <meta name="description" content="Your personal learning hub on Social Square. Save posts as notes, build knowledge trees, and grow from the community." />
            </Helmet>

            <div style={{
                minHeight: '100vh',
                background: 'var(--surface-bg, var(--surface-1))',
                fontFamily: 'Inter, sans-serif',
                paddingBottom: 80,
            }}>

                {/* ── HERO HEADER ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 70%, #6366f1 100%)',
                    padding: '40px 24px 48px',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Decorative circles */}
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.04)',
                            width: [300, 200, 150, 100][i],
                            height: [300, 200, 150, 100][i],
                            top: [-50, 20, -30, 40][i],
                            right: [-80, -40, 80, 120][i],
                        }} />
                    ))}

                    <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                            <span style={{ fontSize: 40 }}>🧠</span>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'white' }}>
                                    Knowledge Dashboard
                                </h1>
                                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                                    Your personal learning library, powered by AI
                                </p>
                            </div>
                        </div>

                        {/* Quick nav */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                            <Link to="/knowledge/wiki" style={{
                                padding: '8px 18px', borderRadius: 99,
                                background: 'rgba(255,255,255,0.15)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                color: 'white', fontWeight: 600, fontSize: 13,
                                textDecoration: 'none',
                                transition: 'background 0.2s',
                            }}>
                                🌐 Community Wiki
                            </Link>
                        </div>
                    </div>
                </div>

                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>

                    {/* ── STATS ── */}
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} style={{ height: 120, borderRadius: 20, background: 'var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
                            <StatCard icon="📚" value={stats?.totalNotes} label="Total saved" gradient="#6366f1" />
                            <StatCard icon="🎓" value={stats?.learningCount} label="Learnings" gradient="#10b981" />
                            <StatCard icon="📝" value={stats?.noteCount} label="Notes" gradient="#f59e0b" />
                            <StatCard icon="🌳" value={stats?.topicCount} label="Topics" gradient="#ec4899" />
                        </div>
                    )}

                    {/* ── ACTIVITY + TREE ── */}
                    {!loading && (
                        <ActivityChart data={dashboard?.weeklyActivity} />
                    )}

                    {/* ── MAIN LAYOUT ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>

                        {/* Tree sidebar */}
                        <div style={{ display: window.innerWidth < 700 ? 'none' : 'block' }}>
                            <TopicTree
                                tree={tree}
                                activeTopic={activeTopic}
                                onSelect={setActiveTopic}
                            />
                        </div>

                        {/* Notes panel */}
                        <div>
                            {/* Filter row */}
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
                                <input
                                    type="text"
                                    id="knowledge-search"
                                    placeholder="🔍 Search notes..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 180, padding: '10px 16px',
                                        borderRadius: 12, border: '1.5px solid var(--border-color)',
                                        background: 'var(--surface-1)', color: 'var(--text-main)',
                                        fontSize: 14, outline: 'none',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#808bf5'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                                />

                                {['', 'note', 'learning'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setActiveType(t)}
                                        style={{
                                            padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                            border: '1.5px solid ' + (activeType === t ? '#808bf5' : 'var(--border-color)'),
                                            background: activeType === t ? 'rgba(128,139,245,0.12)' : 'transparent',
                                            color: activeType === t ? '#808bf5' : 'var(--text-sub)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {t === '' ? 'All' : t === 'note' ? '📝 Notes' : '🎓 Learnings'}
                                    </button>
                                ))}

                                <select
                                    value={sort}
                                    onChange={e => setSort(e.target.value)}
                                    style={{
                                        padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                                        border: '1.5px solid var(--border-color)',
                                        background: 'var(--surface-1)', color: 'var(--text-main)', fontSize: 13,
                                    }}
                                >
                                    <option value="newest">Newest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="topic">By Topic</option>
                                </select>
                            </div>

                            {/* Notes grid */}
                            {notesLoading ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} style={{ height: 180, borderRadius: 20, background: 'var(--border-color)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                    ))}
                                </div>
                            ) : notes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                    <span style={{ fontSize: 56 }}>🌱</span>
                                    <h3 style={{ margin: '16px 0 8px', color: 'var(--text-main)', fontWeight: 700 }}>
                                        {activeTopic || activeType || search ? 'No notes match this filter' : 'Your knowledge library is empty'}
                                    </h3>
                                    <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
                                        {activeTopic || activeType || search
                                            ? 'Try a different filter or search term'
                                            : 'Save posts as Notes or Learnings from the feed to start growing 🚀'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                                        {notes.map(note => (
                                            <NoteCard
                                                key={note._id}
                                                note={note}
                                                onDelete={handleDelete}
                                                onEdit={(n) => { setEditingNote(n); setEditAnnotation(n.annotation || ''); }}
                                            />
                                        ))}
                                    </div>

                                    {/* Pagination */}
                                    {pagination.pages > 1 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                                            {[...Array(pagination.pages)].map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => fetchNotes(i + 1)}
                                                    style={{
                                                        width: 36, height: 36, borderRadius: 9, border: 'none', cursor: 'pointer',
                                                        background: pagination.page === i + 1 ? '#6366f1' : 'var(--surface-1)',
                                                        color: pagination.page === i + 1 ? 'white' : 'var(--text-main)',
                                                        fontWeight: 700, fontSize: 13,
                                                    }}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── EDIT MODAL ── */}
            {editingNote && (
                <>
                    <div onClick={() => setEditingNote(null)} style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
                    <div style={{
                        position: 'fixed', zIndex: 99999,
                        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '90%', maxWidth: 460,
                        background: 'var(--surface-1)', borderRadius: 20,
                        border: '1px solid var(--border-color)',
                        padding: '24px', fontFamily: 'Inter, sans-serif',
                    }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>Edit Note</h3>
                        <textarea
                            value={editAnnotation}
                            onChange={e => setEditAnnotation(e.target.value)}
                            placeholder="Your personal insight..."
                            rows={4}
                            style={{
                                width: '100%', boxSizing: 'border-box', borderRadius: 12,
                                padding: '12px', border: '1.5px solid var(--border-color)',
                                background: 'transparent', color: 'var(--text-main)',
                                fontSize: 14, outline: 'none', resize: 'vertical',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button onClick={() => setEditingNote(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-sub)', fontWeight: 600 }}>Cancel</button>
                            <button onClick={handleEditSave} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#808bf5,#6366f1)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </>
    );
}
