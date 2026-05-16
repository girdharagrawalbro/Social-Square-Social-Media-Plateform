import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';
import { useCategories, usePersonalizedSearch } from '../../hooks/queries/usePostQueries';
import useAuthStore from "../../store/zustand/useAuthStore";
import SkeletonSearch from './ui/SkeletonSearch';

const BASE = process.env.REACT_APP_BACKEND_URL;

const RECENT_KEY = 'recentSearches';
const MAX_RECENT = 8; // Increased slightly for better UX

const Search = ({ onClose }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isVisible, setVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
            // Migration/Cleanup: Ensure we don't have nulls or malformed data
            return saved.filter(Boolean);
        }
        catch { return []; }
    });
    const containerRef = useRef(null);
    const user = useAuthStore(s => s.user);
    const { data: catData = [] } = useCategories();
    const categories = catData;
    const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchCache, setSearchCache] = useState({});

    const [debouncedTerm, setDebouncedTerm] = useState("");

    // AI Recommendations — use debounced term to sync with search results
    const { data: aiResults = [] } = usePersonalizedSearch(user?._id, debouncedTerm);
    const loading = { search: searchLoading };

    const doSearch = async (term) => {
        const trimmedTerm = term.trim();
        if (!trimmedTerm) return;

        // 1. Check Cache First (5 minute TTL)
        if (searchCache[trimmedTerm] && (Date.now() - searchCache[trimmedTerm].timestamp < 300000)) {
            setSearchResults(searchCache[trimmedTerm].data);
            return;
        }

        setSearchLoading(true);
        try {
            const res = await fetch(`${BASE}/api/auth/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ query: trimmedTerm })
            });
            const data = await res.json();
            const results = { users: data.users || [], posts: data.posts || [] };
            
            setSearchResults(results);
            
            // 2. Update Cache
            setSearchCache(prev => ({
                ...prev,
                [trimmedTerm]: { data: results, timestamp: Date.now() }
            }));
        } catch (err) {
            console.error("Search failed:", err);
        }
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
            setDebouncedTerm(term.trim());
            if (term.trim()) doSearch(term.trim());
        }, 400),
        [searchCache] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // 3. Instant Local Matches from History
    const localMatches = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return recentSearches.filter(item => {
            if (typeof item === 'object') {
                return (item.fullname?.toLowerCase().includes(term)) || 
                       (item.username?.toLowerCase().includes(term));
            }
            return (typeof item === 'string') && item.toLowerCase().includes(term);
        });
    }, [searchTerm, recentSearches]);

    const handleInputChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.trim()) {
            debouncedSearch(term);
        } else {
            setDebouncedTerm("");
            setSearchResults({ users: [], posts: [] });
        }
    };

    const saveRecentSearch = (item) => {
        if (!item) return;
        
        // Identifiers for deduplication
        const itemId = typeof item === 'object' ? (item._id || item.id) : item;
        
        const updated = [item, ...recentSearches.filter(r => {
            const rId = typeof r === 'object' ? (r._id || r.id) : r;
            return rId !== itemId;
        })].slice(0, MAX_RECENT);
        
        setRecentSearches(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        localStorage.removeItem(RECENT_KEY);
    };

    const handleRecentClick = (item) => {
        if (typeof item === 'object') {
            handleUserClick(item);
        } else {
            setSearchTerm(item);
            setDebouncedTerm(item);
            doSearch(item);
        }
    };

    const navigate = useNavigate();

    const handleUserClick = (u) => {
        saveRecentSearch(u);
        setIsFocused(false);

        const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
        if (isMobile) {
            if (onClose) onClose();
            navigate(`/profile/${u._id}`);
            return;
        }

        setSelectedUserId(u._id);
        setVisible(true);
    };

    const handleCategoryClick = (category) => {
        const term = `#${category}`;
        setSearchTerm(term);
        setDebouncedTerm(term);
        doSearch(category);
        saveRecentSearch(term);
    };

    const handleClear = () => {
        setSearchTerm('');
        setDebouncedTerm('');
        setIsFocused(true);
    };

    const isTyping = searchTerm !== debouncedTerm;
    // Blend local matches with remote ones for "People"
    const blendedUsers = useMemo(() => {
        const remoteUsers = searchResults.users || [];
        const localUserMatches = localMatches.filter(m => typeof m === 'object');
        
        // Combine and deduplicate by ID
        const combined = [...localUserMatches];
        const seenIds = new Set(combined.map(u => u._id));
        
        remoteUsers.forEach(u => {
            if (!seenIds.has(u._id)) {
                combined.push(u);
            }
        });
        
        return combined;
    }, [searchResults.users, localMatches]);

    const hasResults = blendedUsers.length > 0 || searchResults?.posts?.length > 0 || aiResults?.length > 0;

    return (
        <>
            <div ref={containerRef} className="relative w-full">
                {/* Search input */}
                <div className="relative flex items-center group">
                    <i className="pi pi-search absolute left-4 text-[var(--text-sub)] transition-colors group-focus-within:text-[#808bf5]" style={{ fontSize: '15px' }}></i>
                    <input
                        placeholder="Search users, posts, categories..."
                        className="py-2.5 pl-11 pr-11 rounded-full bg-[var(--surface-2)] border border-[var(--border-color)] w-full text-sm outline-none focus:bg-[var(--surface-1)] focus:border-[#808bf5] focus:shadow-[0_0_0_4px_rgba(128,139,245,0.15)] placeholder:text-[var(--text-sub)] text-[var(--text-main)] transition-all duration-300"
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


                <div className={`absolute left-0 right-0 bg-[var(--surface-1)] rounded-2xl z-50 overflow-hidden mt-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl ${!isFocused && !searchTerm ? 'hidden' : 'block'} transition-all duration-300`} style={{ top: '100%', maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>

                    {/* Recent searches — shown when no search term */}
                    {!searchTerm && recentSearches.length > 0 && (
                        <div className="pt-3 px-1">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <p className="text-[10px] font-bold text-[var(--text-sub)] m-0 uppercase tracking-widest">Recent Searches</p>
                                <button onClick={clearRecentSearches} className="text-[10px] font-bold text-[#808bf5] border-0 bg-transparent cursor-pointer p-0 hover:underline uppercase mr-1">Clear</button>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                {recentSearches.map((item, i) => (
                                    <button key={i} onClick={() => handleRecentClick(item)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-transparent cursor-pointer text-left hover:bg-[var(--surface-2)] w-full transition-colors group">
                                        {typeof item === 'object' ? (
                                            <>
                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-[var(--border-color)]">
                                                    <img src={item.profile_picture || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-medium text-[var(--text-main)] block truncate">{item.fullname}</span>
                                                    <span className="text-[10px] text-[#808bf5] font-bold truncate block">@{item.username}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <i className="pi pi-clock text-[var(--text-sub)] group-hover:text-[#808bf5]" style={{ fontSize: '12px' }}></i>
                                                <span className="text-sm font-medium text-[var(--text-main)]">{item}</span>
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}



                    {!searchTerm && categories.length > 0 && (
                        <div className="p-2 mt-2">
                            <h3 className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-widest mb-2">Browse Categories</h3>
                            <div className="flex flex-wrap gap-2">
                                {categories.slice(0, 8).map((cat, i) => (
                                    <button key={i} onClick={() => handleCategoryClick(cat.category)}
                                        className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-main)] cursor-pointer text-xs font-bold hover:border-[#808bf5] transition-all">
                                        #{cat.category}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search results */}
                    {searchTerm && (
                        <div className="pt-3 px-1">
                            {(loading.search && blendedUsers.length === 0) ? (
                                <SkeletonSearch />
                            ) : hasResults ? (
                                <>
                                    {/* User results (Blended Local + Remote) */}
                                    {blendedUsers.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-[10px] font-bold text-[var(--text-sub)] mb-2 m-0 uppercase tracking-widest px-1 flex items-center justify-between">
                                                <span>People</span>
                                                {loading.search && <i className="pi pi-spin pi-spinner text-[10px] text-[#808bf5]"></i>}
                                            </p>
                                            <div className="flex flex-col gap-0.5">
                                                {blendedUsers.map(u => {
                                                    const isLocalMatch = localMatches.some(m => m._id === u._id);
                                                    return (
                                                        <button key={u._id} onClick={() => handleUserClick(u)}
                                                            className="flex items-center justify-between gap-3 px-1 py-2 rounded-2xl border-0 bg-transparent cursor-pointer text-left w-full hover:bg-[var(--surface-2)] transition-all group">
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-[var(--border-color)] shadow-sm group-hover:scale-105 transition-transform duration-300">
                                                                    <img src={u.profile_picture || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className="m-0 text-sm font-semibold text-[var(--text-main)] truncate">{u.fullname}</p>
                                                                        {isLocalMatch && <span className="text-[9px] bg-[var(--surface-3)] text-[var(--text-sub)] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">History</span>}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        {u.username && <p className="m-0 text-[11px] text-[#808bf5] font-bold truncate">@{u.username}</p>}
                                                                        <span className="text-[10px] text-[var(--text-sub)] opacity-40 flex-shrink-0">•</span>
                                                                        <p className="m-0 text-[11px] text-[var(--text-sub)] font-medium flex-shrink-0">{u.followerCount || 0} followers</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                {user?.following?.some(id => id?.toString() === u._id?.toString()) ? (
                                                                    <span className="text-[10px] bg-[#808bf5]/10 text-[#808bf5] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shadow-sm">Following</span>
                                                                ) : u.hasPendingRequest ? (
                                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shadow-sm">Requested</span>
                                                                ) : null}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
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
