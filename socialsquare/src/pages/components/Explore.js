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
const Explore = () => {
    const setPostDetailId = usePostStore(s => s.setPostDetailId);
    const { data: categories = [] } = useCategories();

    // ✅ TanStack Query hooks
    const { data: trendingData = [] } = useTrending();
    const [searchTerm, setSearchTerm] = useState('');
    const { data: searchData = { users: [], posts: [] }, isLoading: searchLoading } = useSearchUsers(searchTerm);

    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userProfileVisible, setUserProfileVisible] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);

    // ✅ Tab: 'discover' | 'confessions'
    const [activeTab, setActiveTab] = useState('discover');

    const debouncedSearch = useMemo(() =>
        debounce((term) => { setSearchTerm(term); }, 400),
        [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleSearchChange = (e) => {
        const term = e.target.value;
        if (term) debouncedSearch(term); else setSearchTerm('');
    };

    const handleCategoryClick = async (category) => {
        setActiveCategory(category);
        setSearchTerm(category); // Search by category term instead of old doSearch
    };

    const getImages = (post) => {
        if (post.image_urls?.length > 0) return post.image_urls;
        if (post.image_url) return [post.image_url];
        return [];
    };

    return (
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>

                {/* ── Tabs ── */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', borderRadius: '14px', padding: '4px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                    {[
                        { key: 'discover', label: '🔍 Discover' },
                        { key: 'confessions', label: '🎭 Confessions' },
                        { key: 'communities', label: '👥 Communities' },
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

                {/* ── DISCOVER TAB ── */}
                {activeTab === 'discover' && (
                    <>
                        {/* Search bar */}
                        <div style={{ position: 'relative', marginBottom: '20px' }}>
                            <i className="pi pi-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
                            <input
                                type="text"
                                placeholder="Search users, posts, categories..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: '24px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', fontSize: '14px', outline: 'none' }}
                                onFocus={e => e.target.style.borderColor = '#808bf5'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                            />
                        </div>

                        {/* Search results */}
                        {searchTerm && (
                            <div style={{ marginBottom: '24px' }}>
                                {searchLoading ? (
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Searching...</p>
                                ) : (searchData.users?.length > 0 || searchData.posts?.length > 0) ? (
                                    <>
                                        {searchData.users?.length > 0 && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>People</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {searchData.users.map(user => (
                                                        <button key={user._id} onClick={() => { setSelectedUserId(user._id); setUserProfileVisible(true); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--surface-2)', border: 'none', borderRadius: '12px', cursor: 'pointer', textAlign: 'left' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}>
                                                            <img src={user.profile_picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                                            <div>
                                                                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{user.fullname}</p>
                                                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{user.followers?.length || 0} followers</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    {searchData.posts?.length > 0 && (
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                                {searchData.posts.map(post => {
                                                        const imgs = getImages(post);
                                                        return (
                                                            <div key={post._id} onClick={() => setPostDetailId(post._id)} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-3)', position: 'relative', cursor: 'pointer' }}>
                                                                {imgs[0] ? <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>{post.caption?.slice(0, 40)}</div>}
                                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', padding: '4px 6px', fontSize: '10px', color: '#fff' }}>
                                                                    ❤️ {post.likes?.length || 0}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No results for "{searchTerm}"</p>
                                )}
                            </div>
                        )}

                        {/* Trending + categories (unchanged from your original) */}
                        {!searchTerm && (
                            <>
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>🔥 Trending</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {trendingData.length > 0 ? trendingData.map((item, i) => (
                                            <button key={item.category} onClick={() => handleCategoryClick(item.category)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: activeCategory === item.category ? 'var(--surface-accent-soft)' : 'var(--surface-2)', border: activeCategory === item.category ? '1px solid #808bf5' : '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left' }}
                                                onMouseEnter={e => { if (activeCategory !== item.category) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                                                onMouseLeave={e => { if (activeCategory !== item.category) e.currentTarget.style.background = 'var(--surface-2)'; }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ width: 28, height: 28, background: '#808bf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>#{i + 1}</span>
                                                    <div>
                                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: activeCategory === item.category ? '#808bf5' : 'var(--text-main)' }}>#{item.category}</p>
                                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{item.postCount} posts · {item.totalLikes} likes</p>
                                                    </div>
                                                </div>
                                                <i className="pi pi-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '12px' }}></i>
                                            </button>
                                        )) : (
                                            [1, 2, 3, 4, 5].map(i => (
                                                <div key={i} style={{ height: '60px', background: 'var(--surface-3)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {activeCategory && searchData?.posts?.length > 0 && (
                                    <div>
                                        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>#{activeCategory}</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                            {searchData.posts.map(post => {
                                                const imgs = getImages(post);
                                                return (
                                                    <div key={post._id} onClick={() => setPostDetailId(post._id)} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-3)', position: 'relative', cursor: 'pointer' }}>
                                                        {imgs[0] ? <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>{post.caption?.slice(0, 40)}</div>}
                                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', padding: '4px 6px', display: 'flex', gap: '6px', fontSize: '10px', color: '#fff' }}>
                                                            <span>❤️ {post.likes?.length || 0}</span>
                                                            <span>💬 {post.comments?.length || 0}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Browse Categories</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {categories.map((cat, i) => (
                                            <button key={i} onClick={() => handleCategoryClick(cat.category)}
                                                style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)', background: activeCategory === cat.category ? '#808bf5' : 'var(--surface-2)', color: activeCategory === cat.category ? '#fff' : 'var(--text-main)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                                                #{cat.category}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                <Dialog header="Profile" visible={userProfileVisible} style={{ width: '500px' }} onHide={() => setUserProfileVisible(false)}>
                    <UserProfile id={selectedUserId} />
                </Dialog>
            </div>
        );
};

export default Explore;