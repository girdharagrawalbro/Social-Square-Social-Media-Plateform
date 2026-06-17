import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../store/zustand/useAuthStore';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import toast from 'react-hot-toast';

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

// ─── Post card for wiki page ──────────────────────────────────────────────────
function WikiPostCard({ post, onOpen }) {
    const thumb = post.image_url || post.image_urls?.[0];

    return (
        <div
            onClick={() => onOpen(post._id)}
            style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-color)',
                borderRadius: 18, overflow: 'hidden',
                cursor: 'pointer', transition: 'all 0.22s ease',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 10px 36px rgba(99,102,241,0.18)';
                e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {thumb && (
                <div style={{ height: 160, overflow: 'hidden' }}>
                    <img
                        src={thumb}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.35s ease' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                </div>
            )}
            <div style={{ padding: '14px 16px' }}>
                {/* Author */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <img
                        src={post.user?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                        alt=""
                        style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>
                            {post.user?.fullname || 'User'}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-sub)' }}>{timeAgo(post.createdAt)}</p>
                    </div>
                </div>

                {/* Caption */}
                {post.caption && (
                    <p style={{
                        margin: '0 0 12px', fontSize: 13, color: 'var(--text-sub)',
                        lineHeight: 1.55, display: '-webkit-box',
                        WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                        {post.caption}
                    </p>
                )}

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ❤️ {post.likes?.length || 0}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ⚡ {post.wikiScore || post.score || 0}
                    </span>
                    <span style={{
                        marginLeft: 'auto', fontSize: 11, padding: '2px 10px', borderRadius: 99,
                        background: 'rgba(128,139,245,0.12)', color: '#808bf5', fontWeight: 600,
                    }}>
                        {post.category}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function WikiPage() {
    const { slug } = useParams();
    const user = useAuthStore(s => s.user);
    const { setPostDetailId } = usePostStore();
    const [wiki, setWiki] = useState(null);
    const [loading, setLoading] = useState(true);
    const [contributing, setContributing] = useState(false);
    const [contributePostId, setContributePostId] = useState('');

    useEffect(() => {
        if (!slug) return;
        api.get(`/api/knowledge/wiki/${slug}`)
            .then(res => setWiki(res.data.wiki))
            .catch(() => toast.error('Wiki page not found'))
            .finally(() => setLoading(false));
    }, [slug]);

    const handleContribute = async () => {
        if (!contributePostId.trim()) return toast.error('Enter a post ID');
        try {
            await api.post(`/api/knowledge/wiki/${slug}/contribute`, { postId: contributePostId.trim() });
            toast.success('Post suggested for this wiki! 🎉');
            setContributePostId('');
            setContributing(false);
            // Refresh
            const res = await api.get(`/api/knowledge/wiki/${slug}`);
            setWiki(res.data.wiki);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not suggest post');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: '3px solid rgba(128,139,245,0.2)',
                    borderTopColor: '#808bf5',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (!wiki) {
        return (
            <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ fontSize: 52 }}>🔭</span>
                <h2 style={{ color: 'var(--text-main)', marginTop: 16 }}>Wiki page not found</h2>
                <Link to="/knowledge/wiki" style={{ color: '#808bf5' }}>← Back to Wiki</Link>
            </div>
        );
    }

    const posts = Array.isArray(wiki.topPosts) ? wiki.topPosts : [];

    return (
        <>
            <Helmet>
                <title>{wiki.topic} — Community Wiki · Social Square</title>
                <meta name="description" content={wiki.description || `Community-curated knowledge wiki about ${wiki.topic} on Social Square.`} />
            </Helmet>

            <div style={{ minHeight: '100vh', background: 'var(--surface-bg, var(--surface-1))', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>

                {/* ── HERO ── */}
                <div style={{
                    position: 'relative', overflow: 'hidden',
                    background: wiki.coverImage
                        ? 'transparent'
                        : `linear-gradient(135deg, hsl(${(wiki.topic.charCodeAt(0) * 13) % 360},70%,20%), hsl(${(wiki.topic.charCodeAt(0) * 13 + 60) % 360},70%,40%))`,
                    minHeight: 240,
                }}>
                    {wiki.coverImage && (
                        <img
                            src={wiki.coverImage}
                            alt={wiki.topic}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.7))',
                    }} />
                    <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
                        <Link to="/knowledge/wiki" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ← Community Wiki
                        </Link>

                        <h1 style={{ margin: '12px 0 8px', fontSize: 32, fontWeight: 900, color: 'white' }}>
                            🌐 {wiki.topic}
                        </h1>
                        {wiki.description && (
                            <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, maxWidth: 600 }}>
                                {wiki.description}
                            </p>
                        )}

                        {/* Meta row */}
                        <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
                            {[
                                { icon: '📄', val: posts.length, label: 'posts' },
                                { icon: '👥', val: wiki.contributors?.length || 0, label: 'contributors' },
                                { icon: '👁️', val: wiki.viewCount || 0, label: 'views' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                                    <span style={{ fontSize: 14, color: 'white', fontWeight: 700 }}>{m.val}</span>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{m.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CONTENT ── */}
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>

                    {/* Contribute CTA */}
                    {user && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(128,139,245,0.08), rgba(99,102,241,0.06))',
                            border: '1px solid rgba(128,139,245,0.2)',
                            borderRadius: 18, padding: '20px 24px', marginBottom: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                        }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: 15 }}>
                                    💡 Know a great post about {wiki.topic}?
                                </p>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-sub)' }}>
                                    Suggest it for this wiki page and help the community learn
                                </p>
                            </div>
                            <button
                                id="wiki-contribute-btn"
                                onClick={() => setContributing(c => !c)}
                                style={{
                                    padding: '10px 20px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #808bf5, #6366f1)',
                                    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                    boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                                }}
                            >
                                + Suggest a Post
                            </button>
                        </div>
                    )}

                    {/* Contribute input */}
                    {contributing && (
                        <div style={{
                            background: 'var(--surface-1)', border: '1px solid var(--border-color)',
                            borderRadius: 16, padding: '20px', marginBottom: 24,
                        }}>
                            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                                Paste the Post ID you want to suggest:
                            </p>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <input
                                    type="text"
                                    id="wiki-post-id-input"
                                    value={contributePostId}
                                    onChange={e => setContributePostId(e.target.value)}
                                    placeholder="Post ID (24 characters)"
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: 10,
                                        border: '1.5px solid var(--border-color)',
                                        background: 'transparent', color: 'var(--text-main)', fontSize: 14, outline: 'none',
                                    }}
                                />
                                <button
                                    onClick={handleContribute}
                                    style={{
                                        padding: '10px 20px', borderRadius: 10, border: 'none',
                                        background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    Submit
                                </button>
                            </div>
                            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--text-sub)' }}>
                                You can find a post ID in its URL: /post/[POST_ID]
                            </p>
                        </div>
                    )}

                    {/* Posts grid */}
                    {posts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <span style={{ fontSize: 48 }}>📭</span>
                            <h3 style={{ color: 'var(--text-main)', fontWeight: 700, margin: '16px 0 8px' }}>
                                No posts in this wiki yet
                            </h3>
                            <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>
                                Be the first to suggest a great post about {wiki.topic}!
                            </p>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
                                🏆 Top Community Posts
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                                {posts.map((post, i) => (
                                    <WikiPostCard
                                        key={post._id || i}
                                        post={post}
                                        onOpen={(id) => setPostDetailId(id)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
