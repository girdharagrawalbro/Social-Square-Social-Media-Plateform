import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../store/slices/postsSlice';
import { search } from '../../store/slices/userSlice';
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';

const BASE = process.env.REACT_APP_BACKEND_URL;

const Explore = () => {
    const dispatch = useDispatch();
    const { categories } = useSelector(state => state.posts);
    const { searchResults, loading } = useSelector(state => state.users);
    const { loggeduser } = useSelector(state => state.users);

    const [searchTerm, setSearchTerm] = useState('');
    const [trending, setTrending] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userProfileVisible, setUserProfileVisible] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [categoryPosts, setCategoryPosts] = useState([]);
    const [loadingCategoryPosts, setLoadingCategoryPosts] = useState(false);

    useEffect(() => {
        dispatch(fetchCategories());
        fetchTrending();
    }, [dispatch]);

    const fetchTrending = async () => {
        try {
            const res = await fetch(`${BASE}/api/post/trending`);
            const data = await res.json();
            setTrending(data);
        } catch { }
    };

    const debouncedSearch = useCallback(
        debounce((term) => { if (term) dispatch(search(term)); }, 400),
        [dispatch]
    );

    const handleSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        debouncedSearch(term);
    };

    const handleCategoryClick = async (category) => {
        setActiveCategory(category);
        setLoadingCategoryPosts(true);
        try {
            dispatch(search(category));
        } finally {
            setLoadingCategoryPosts(false);
        }
    };

    const getImages = (post) => {
        if (post.image_urls?.length > 0) return post.image_urls;
        if (post.image_url) return [post.image_url];
        return [];
    };

    const hasResults = searchResults?.users?.length > 0 || searchResults?.posts?.length > 0;

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>
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
                    {loading.search ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Searching...</p>
                    ) : hasResults ? (
                        <>
                            {/* User results */}
                            {searchResults.users?.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>People</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {searchResults.users.map(user => (
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

                            {/* Post results */}
                            {searchResults.posts?.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                        {searchResults.posts.map(post => {
                                            const imgs = getImages(post);
                                            return (
                                                <div key={post._id} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-3)', position: 'relative' }}>
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

            {/* Trending hashtags */}
            {!searchTerm && (
                <>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>🔥 Trending</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {trending.length > 0 ? trending.map((item, i) => (
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

                    {/* Category posts when selected */}
                    {activeCategory && searchResults?.posts?.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>#{activeCategory}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                {searchResults.posts.map(post => {
                                    const imgs = getImages(post);
                                    return (
                                        <div key={post._id} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-3)', position: 'relative' }}>
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

                    {/* Browse all categories */}
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

            <Dialog header="Profile" visible={userProfileVisible} style={{ width: '340px' }} onHide={() => setUserProfileVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </div>
    );
};

export default Explore;