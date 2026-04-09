import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';
import { useCategories, usePersonalizedSearch } from '../../hooks/queries/usePostQueries';
import useAuthStore from "../../store/zustand/useAuthStore";

const BASE = process.env.REACT_APP_BACKEND_URL;

const RECENT_KEY = 'recentSearches';
const MAX_RECENT = 5;

const Search = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isVisible, setVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [recentSearches, setRecentSearches] = useState(() => {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
        catch { return []; }
    });
    const containerRef = useRef(null);
    const user = useAuthStore(s => s.user);
    const { data: catData = [] } = useCategories();
    const categories = catData;
    const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
    const [searchLoading, setSearchLoading] = useState(false);

    // AI Recommendations
    const { data: aiResults = [] } = usePersonalizedSearch(user?._id, searchTerm);
    const loading = { search: searchLoading };
    const doSearch = async (term) => {
        setSearchLoading(true);
        try {
            const res = await fetch(`${BASE}/api/auth/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: term }) });
            const data = await res.json();
            setSearchResults({ users: data.users || [], posts: data.posts || [] });
        } catch { }
        setSearchLoading(false);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Debounced search — fires 400ms after user stops typing
    const debouncedSearch = useMemo(() =>
        debounce((term) => {
            if (term.trim()) doSearch(term.trim());
        }, 400),
        [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    const handleInputChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.trim()) { debouncedSearch(term); } else { setSearchResults({ users: [], posts: [] }); }
    };

    const saveRecentSearch = (term) => {
        if (!term.trim()) return;
        const updated = [term, ...recentSearches.filter(r => r !== term)].slice(0, MAX_RECENT);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_KEY);
    };

    const handleRecentClick = (term) => {
        setSearchTerm(term);
        doSearch(term);
    };

    const navigate = useNavigate();

    const handleUserClick = (userId, userName) => {
        saveRecentSearch(userName);
        setIsFocused(false);

        const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
        if (isMobile) {
            // On mobile, navigate to the full profile page instead of opening the popup
            if (onClose) onClose();
            navigate(`/profile/${userId}`);
            return;
        }

        // Desktop/tablet: open inline profile dialog
        setSelectedUserId(userId);
        setVisible(true);
    };

    const handleCategoryClick = (category) => {
        setSearchTerm(`#${category}`);
        doSearch(category);
        saveRecentSearch(`#${category}`);
    };

    const handleClear = () => {
        setSearchTerm('');
        setIsFocused(true);
    };

    const showDropdown = isFocused;
    const hasResults = searchResults?.users?.length > 0 || searchResults?.posts?.length > 0 || aiResults?.length > 0;

    return (
        <>
            <div ref={containerRef} className="relative w-full mt-3">
                {/* Search input */}
                <div className="relative flex items-center group">
                    <i className="pi pi-search absolute left-4 text-[var(--text-sub)] transition-colors group-focus-within:text-[#808bf5]" style={{ fontSize: '15px' }}></i>
                    <input
                        placeholder="Search users, posts, categories..."
                        className="py-2.5 pl-11 pr-11 rounded-full bg-[var(--surface-2)] border border-[var(--border-color)] w-full text-sm outline-none focus:bg-[var(--surface-1)] focus:ring-2 focus:ring-[#808bf5]/20 placeholder:text-[var(--text-sub)] text-[var(--text-main)] transition-all "
                        type="text"
                        value={searchTerm}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchTerm.trim()) {
                                saveRecentSearch(searchTerm.trim());
                                doSearch(searchTerm.trim());
                            }
                        }}
                    />
                    {searchTerm && (
                        <button onClick={handleClear} className="absolute right-3 bg-transparent border-0 cursor-pointer text-[var(--text-sub)] hover:text-[var(--text-main)] p-2 rounded-full transition-colors flex items-center justify-center">
                            <i className="pi pi-times" style={{ fontSize: '12px' }}></i>
                        </button>
                    )}
                </div>


                <div className="absolute left-0 right-0 bg-[var(--surface-1)] ring-1 ring-black/5 rounded-2xl z-50 overflow-hidden mt-1 shadow-2xl backdrop-blur-xl" style={{ top: '100%', maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>

                    {/* Recent searches — shown when no search term */}
                    {!searchTerm && recentSearches.length > 0 && (
                        <div className="p-3">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <p className="text-[10px] font-bold text-[var(--text-sub)] m-0 uppercase tracking-widest">Recent Searches</p>
                                <button onClick={clearRecentSearches} className="text-[10px] font-bold text-[#808bf5] border-0 bg-transparent cursor-pointer p-0 hover:underline uppercase">Clear all</button>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {recentSearches.map((term, i) => (
                                    <button key={i} onClick={() => handleRecentClick(term)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-transparent cursor-pointer text-left hover:bg-[var(--surface-2)] w-full transition-colors group">
                                        <i className="pi pi-clock text-[var(--text-sub)] group-hover:text-[#808bf5]" style={{ fontSize: '12px' }}></i>
                                        <span className="text-sm font-medium text-[var(--text-main)]">{term}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}



                    {!searchTerm && categories.length > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Browse Categories</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {categories.slice(0, 8).map((cat, i) => (
                                    <button key={i} onClick={() => handleCategoryClick(cat.category)}
                                        style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                        #{cat.category}
                                    </button>
                                ))}

                            </div>
                        </div>
                    )}

                    {/* Search results */}
                    {searchTerm && (
                        <div className="p-3">
                            {loading.search ? (
                                <div className="flex items-center gap-2 py-4 justify-center">
                                    <span className="spinner-border spinner-border-sm text-indigo-500" role="status" />
                                    <span className="text-sm text-gray-500">Searching...</span>
                                </div>
                            ) : hasResults ? (
                                <>
                                    {/* User results */}
                                    {searchResults.users?.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-[10px] font-bold text-[var(--text-sub)] mb-2 m-0 uppercase tracking-widest px-1">People</p>
                                            <div className="flex flex-col gap-0.5">
                                                {searchResults.users.map(u => (
                                                    <button key={u._id} onClick={() => handleUserClick(u._id, u.fullname)}
                                                        className="flex items-center gap-3 px-2 py-2.5 rounded-2xl border-0 bg-transparent cursor-pointer text-left w-full hover:bg-[var(--surface-2)] transition-colors group">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-[var(--border-color)] shadow-sm">
                                                            <img src={u.profile_picture} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="m-0 text-sm font-bold text-[var(--text-main)] truncate">{u.fullname}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {u.username && <p className="m-0 text-[11px] text-[#808bf5] font-bold">@{u.username}</p>}
                                                                <span className="text-[10px] text-[var(--text-sub)] opacity-40">•</span>
                                                                <p className="m-0 text-[11px] text-[var(--text-sub)] font-medium">{u.followers?.length || 0} followers</p>
                                                                {user?.following?.some(id => id?.toString() === u._id?.toString()) && (
                                                                    <span className="text-[9px] bg-[#808bf5]/10 text-[#808bf5] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">Following</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <i className="pi pi-chevron-right text-[10px] text-[var(--text-sub)] opacity-0 group-hover:opacity-100 transition-opacity pr-2"></i>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Recommended results */}
                                    {aiResults.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[10px] font-bold text-[#808bf5] mb-2 m-0 uppercase tracking-widest px-1">✨ AI Recommended</p>
                                            <div className="flex flex-col gap-1.5">
                                                {aiResults.slice(0, 3).map(post => (
                                                    <div key={post._id} className="flex items-center gap-4 px-3 py-3 rounded-2xl bg-[#808bf5]/5 border border-[#808bf5]/10 hover:bg-[#808bf5]/10 transition-colors cursor-pointer group">
                                                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--surface-2)] flex-shrink-0 shadow-sm">
                                                            {(post.image_urls?.[0] || post.image_url)
                                                                ? <img src={post.image_urls?.[0] || post.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                : <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)]"><i className="pi pi-file text-[var(--text-sub)] opacity-20" style={{ fontSize: '14px' }}></i></div>
                                                            }
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="m-0 text-[9px] font-bold text-[#808bf5] uppercase tracking-wider mb-1">#{post.category}</p>
                                                            <p className="m-0 text-sm font-medium text-[var(--text-main)] truncate">{post.caption || '(No caption)'}</p>
                                                        </div>
                                                        <i className="pi pi-sparkles text-[var(--text-sub)] opacity-30 group-hover:opacity-100 transition-opacity"></i>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Post results */}
                                    {searchResults.posts?.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[10px] font-bold text-[var(--text-sub)] mb-2 m-0 uppercase tracking-widest px-1">Posts</p>
                                            <div className="flex flex-col gap-0.5">
                                                {searchResults.posts.slice(0, 4).map(post => (
                                                    <div
                                                        key={post._id}
                                                        onClick={() => saveRecentSearch(post.caption)}
                                                        className="flex items-center gap-4 px-3 py-2.5 rounded-2xl hover:bg-[var(--surface-2)] transition-colors cursor-pointer group"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[var(--surface-3)] flex-shrink-0 shadow-sm">
                                                            {(post.image_urls?.[0] || post.image_url)
                                                                ? <img src={post.image_urls?.[0] || post.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                : <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)]"><i className="pi pi-file text-[var(--text-sub)] opacity-20" style={{ fontSize: '12px' }}></i></div>
                                                            }
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="m-0 text-[9px] font-bold text-[#808bf5] uppercase tracking-wider mb-1">#{post.category}</p>
                                                            <p className="m-0 text-sm font-medium text-[var(--text-main)] truncate">{post.caption || '(No caption)'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-6 ">
                                    <p className="text-2xl mb-1">🔍</p>
                                    <p className="text-sm text-gray-400 m-0">No results for "<strong>{searchTerm}</strong>"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* User Profile Dialog - Popup/Dialog Mode */}
            {/* Uses UserProfile with compact=true: minimal UI, 3 posts max, card-like styling, posts preview with blur */}
            <Dialog header="Profile" visible={isVisible} style={{ width: '95vw', maxWidth: '500px', maxHeight: '90vh' }} onHide={() => setVisible(false)} >
                <UserProfile id={selectedUserId} onClose={() => {
                    setVisible(false);
                    setIsFocused(false);
                    setSearchTerm('');
                    if (onClose) onClose();


                }} maxPosts={3} />
            </Dialog>
        </>
    );
};

export default Search;