import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../store/zustand/useAuthStore';
import toast from '../utils/toast.js';



// ─── Wiki Card for the listing page ──────────────────────────────────────────
function WikiCard({ wiki }) {
    return (
        <Link
            to={`/knowledge/wiki/${wiki.slug}`}
            style={{ textDecoration: 'none' }}
        >
            <div style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-color)',
                borderRadius: 20, overflow: 'hidden',
                transition: 'all 0.22s ease',
                cursor: 'pointer',
                height: '100%', display: 'flex', flexDirection: 'column',
            }}
                onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.18)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                {/* Cover image */}
                {wiki.coverImage ? (
                    <div style={{ height: 140, overflow: 'hidden' }}>
                        <img
                            src={wiki.coverImage}
                            alt={wiki.topic}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                ) : (
                    <div style={{
                        height: 140,
                        background: `linear-gradient(135deg,
                            hsl(${(wiki.topic.charCodeAt(0) * 13) % 360}, 70%, 35%),
                            hsl(${(wiki.topic.charCodeAt(0) * 13 + 60) % 360}, 70%, 55%))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 52,
                    }}>
                        📚
                    </div>
                )}

                <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>
                        {wiki.topic}
                    </h3>
                    {wiki.description && (
                        <p style={{
                            margin: 0, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5,
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1,
                        }}>
                            {wiki.description}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            📄 {wiki.postCount || 0} posts
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            👥 {wiki.contributorCount || 0} contributors
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            👁️ {wiki.viewCount || 0}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default function WikiListPage() {
    const [wikis, setWikis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        api.get('/api/knowledge/wiki')
            .then(res => setWikis(res.data.wikis || []))
            .catch(() => toast.error('Could not load wiki pages'))
            .finally(() => setLoading(false));
    }, []);

    const filtered = wikis.filter(w =>
        w.topic.toLowerCase().includes(search.toLowerCase()) ||
        w.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <Helmet>
                <title>Community Wiki — Social Square</title>
                <meta name="description" content="Explore community-curated knowledge wikis on Social Square, built from the top posts on every topic." />
            </Helmet>

            <div style={{ minHeight: '100vh', background: 'var(--surface-bg, var(--surface-1))', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>

                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
                    padding: '40px 24px 52px',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {[260, 180, 120].map((s, i) => (
                        <div key={i} style={{
                            position: 'absolute', borderRadius: '50%',
                            background: 'rgba(128,139,245,0.08)',
                            width: s, height: s,
                            bottom: [-s / 2 + 20 * i],
                            right: [60, 180, 320][i],
                        }} />
                    ))}

                    <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <Link to="/knowledge" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none' }}>
                                    ← Knowledge Hub
                                </Link>
                                <h1 style={{ margin: '8px 0 6px', fontSize: 28, fontWeight: 800, color: 'white' }}>
                                    🌐 Community Wiki
                                </h1>
                                <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                                    Curated from the community's top posts, powered by AI
                                </p>
                            </div>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            id="wiki-search"
                            placeholder="Search topics..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                marginTop: 24, width: '100%', maxWidth: 440,
                                padding: '13px 20px', borderRadius: 14,
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(10px)',
                                color: 'white', fontSize: 14, outline: 'none',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Wiki grid */}
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
                    {loading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                            {[...Array(6)].map((_, i) => (
                                <div key={i} style={{ height: 280, borderRadius: 20, background: 'var(--border-color)', animation: 'pulse 1.5s infinite' }} />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                            <span style={{ fontSize: 52 }}>🔭</span>
                            <h3 style={{ color: 'var(--text-main)', fontWeight: 700, margin: '16px 0 8px' }}>
                                {search ? 'No topics found' : 'No wiki pages yet'}
                            </h3>
                            <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
                                {search ? 'Try a different search term' : 'Wiki pages are auto-generated as the community creates top-scoring posts. Check back soon!'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <p style={{ margin: '0 0 20px', color: 'var(--text-sub)', fontSize: 13 }}>
                                {filtered.length} topic{filtered.length !== 1 ? 's' : ''} available
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                                {filtered.map(wiki => <WikiCard key={wiki.slug} wiki={wiki} />)}
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </>
    );
}
