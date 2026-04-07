import React, { useState, useMemo } from 'react';
import { useCategories, useTrending } from '../../hooks/queries/usePostQueries';
import { useConfessions, useSearchUsers } from '../../hooks/queries/useExploreQueries';
import usePostStore from '../../store/zustand/usePostStore';

import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import Groups from './Groups';
import { debounce } from 'lodash';

// ─── CONFESSIONS FEED ─────────────────────────────────────────────────────────
const ConfessionsFeed = () => {
    const [expanded, setExpanded] = useState(null);

    // ✅ TanStack Query for confessions - infinite scroll
    const confessionsQuery = useConfessions();
    const posts = confessionsQuery.data?.pages?.flatMap(p => p.posts) || [];
    const loading = confessionsQuery.isLoading;
    const loadingMore = confessionsQuery.isFetchingNextPage;

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{ height: '100px', background: 'var(--surface-3)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
            ))}
        </div>
    );

    if (posts.length === 0) return (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ fontSize: '36px', margin: 0 }}>🎭</p>
            <p style={{ fontWeight: 700, fontSize: '16px', margin: '12px 0 4px' }}>No confessions yet</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Be the first to post anonymously!</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {/* Info banner */}
            <div style={{ background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>🔒</span>
                <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>Anonymous Confessions</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#818cf8' }}>All identities are hidden. Post freely.</p>
                </div>
            </div>

            {posts.map((post, i) => {
                const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                const isExpanded = expanded === post._id;

                return (
                    <div key={post._id || i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
                        {/* Header — always anonymous */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', flexShrink: 0 }}>
                                🎭
                            </div>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '13px' }}>Anonymous</p>
                                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {post.category && <span style={{ background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 7px', fontSize: '10px', marginRight: '6px' }}>#{post.category}</span>}
                                    {post.mood && <span style={{ fontSize: '12px' }}>
                                        {({ happy: '😊', sad: '😢', excited: '🤩', angry: '😠', calm: '😌', romantic: '❤️', funny: '😂', inspirational: '💪', nostalgic: '🥹', neutral: '😐' })[post.mood]}
                                    </span>}
                                </p>
                            </div>
                        </div>

                        {/* Image */}
                        {imgs[0] && (
                            <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                                <img src={imgs[0]} alt="" style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', display: 'block' }} />
                            </div>
                        )}

                        {/* Caption */}
                        <div style={{ padding: '12px 14px' }}>
                            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--text-main)' }}>
                                {isExpanded || post.caption?.length <= 140
                                    ? post.caption
                                    : <>{post.caption?.slice(0, 140)}... <button onClick={() => setExpanded(post._id)} style={{ background: 'none', border: 'none', color: '#808bf5', cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: 0 }}>more</button></>
                                }
                                {isExpanded && post.caption?.length > 140 && (
                                    <button onClick={() => setExpanded(null)} style={{ background: 'none', border: 'none', color: '#808bf5', cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: '0 0 0 4px' }}>less</button>
                                )}
                            </p>

                            {/* Voice note */}
                            {post.voiceNote?.url && (
                                <audio src={post.voiceNote.url} controls style={{ width: '100%', height: '36px', marginTop: '8px' }} />
                            )}

                            {/* Likes count (no like button — keeps anonymity vibe) */}
                            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                ❤️ {post.likes?.length || 0} · 💬 {post.comments?.length || 0}
                            </p>
                        </div>
                    </div>
                );
            })}

            {/* Load more */}
            {confessionsQuery.hasNextPage && (
                <button onClick={() => confessionsQuery.fetchNextPage()} disabled={loadingMore}
                    style={{ padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#808bf5' }}>
                    {loadingMore ? 'Loading...' : 'Load more confessions'}
                </button>
            )}
        </div>
    );
};

// ─── MAIN EXPLORE ─────────────────────────────────────────────────────────────
const Communities = () => {


    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userProfileVisible, setUserProfileVisible] = useState(false);

    // ✅ Tab: 'discover' | 'confessions'
    const [activeTab, setActiveTab] = useState('communities');


    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', borderRadius: '14px', padding: '4px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                {[
                    { key: 'communities', label: '👥 Communities' },
                    { key: 'confessions', label: '🎭 Confessions' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                            background: activeTab === tab.key ? '#808bf5' : 'transparent',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CONFESSIONS TAB ── */}
            {activeTab === 'confessions' && <ConfessionsFeed />}

            {/* ── COMMUNITIES TAB ── */}
            {activeTab === 'communities' && <Groups />}


            <Dialog header="Profile" visible={userProfileVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setUserProfileVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </div>
    );
};

export default Communities;
