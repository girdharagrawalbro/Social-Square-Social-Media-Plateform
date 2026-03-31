import { useEffect, useState, useRef, useMemo } from "react";
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';
import { useCategories, usePersonalizedSearch } from '../../hooks/queries/usePostQueries';
import useAuthStore from "../../store/zustand/useAuthStore";

const BASE = process.env.REACT_APP_BACKEND_URL;

const RECENT_KEY = 'recentSearches';
const MAX_RECENT = 5;

const Search = () => {
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

    const handleUserClick = (userId, userName) => {
        setSelectedUserId(userId);
        setVisible(true);
        setIsFocused(false);
        saveRecentSearch(userName);
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
            <div ref={containerRef} className="relative w-full">
                {/* Search input */}
                <div className="relative flex items-center">
                    <i className="pi pi-search absolute left-3 text-gray-400" style={{ fontSize: '14px' }}></i>
                    <input
                        placeholder="Search users, posts, categories..."
                        className="py-2 pl-9 pr-9 rounded-full bg-gray-100 w-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all"
                        type="text"
                        value={searchTerm}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                    />
                    {searchTerm && (
                        <button onClick={handleClear} className="absolute right-3 bg-transparent border-0 cursor-pointer text-gray-400 p-0">
                            <i className="pi pi-times" style={{ fontSize: '12px' }}></i>
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {showDropdown && (
                    <div className="absolute left-0 right-0 bg-white shadow-xl rounded-2xl z-50 overflow-hidden mt-1" style={{ top: '100%', maxHeight: '420px', overflowY: 'auto', border: '1px solid #e5e7eb' }}>

                        {/* Recent searches — shown when no search term */}
                        {!searchTerm && recentSearches.length > 0 && (
                            <div className="p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs font-bold text-gray-500 m-0 uppercase tracking-wider">Recent</p>
                                    <button onClick={clearRecentSearches} className="text-xs text-indigo-500 border-0 bg-transparent cursor-pointer p-0">Clear all</button>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {recentSearches.map((term, i) => (
                                        <button key={i} onClick={() => handleRecentClick(term)}
                                            className="flex items-center gap-2 px-2 py-2 rounded-lg border-0 bg-transparent cursor-pointer text-left hover:bg-gray-50 w-full">
                                            <i className="pi pi-clock text-gray-400" style={{ fontSize: '12px' }}></i>
                                            <span className="text-sm text-gray-700">{term}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Categories — always show when no search term */}
                        {!searchTerm && categories.length > 0 && (
                            <div className="px-3 pb-3">
                                <p className="text-xs font-bold text-gray-500 mb-2 m-0 uppercase tracking-wider">Categories</p>
                                <div className="flex gap-2 flex-wrap">
                                    {categories.slice(0, 8).map((cat, i) => (
                                        <button key={i} onClick={() => handleCategoryClick(cat.category)}
                                            className="text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-medium"
                                            style={{ background: '#ede9fe', color: '#808bf5' }}>
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
                                                <p className="text-xs font-bold text-gray-500 mb-2 m-0 uppercase tracking-wider">People</p>
                                                <div className="flex flex-col gap-1">
                                                    {searchResults.users.map(user => (
                                                        <button key={user._id} onClick={() => handleUserClick(user._id, user.fullname)}
                                                            className="flex items-center gap-3 px-2 py-2 rounded-xl border-0 bg-transparent cursor-pointer text-left w-full hover:bg-gray-50">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-100">
                                                                <img src={user.profile_picture} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <p className="m-0 text-sm font-medium">{user.fullname}</p>
                                                                <p className="m-0 text-xs text-gray-400">{user.followers?.length || 0} followers</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* AI Recommended results */}
                                        {aiResults.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-bold text-indigo-500 mb-3 m-0 uppercase tracking-wider">✨ AI Recommended</p>
                                                <div className="flex flex-col gap-1">
                                                    {aiResults.slice(0, 3).map(post => (
                                                        <div key={post._id} className="flex items-center gap-3 px-2 py-2 rounded-xl bg-indigo-50/50">
                                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                                                                {(post.image_urls?.[0] || post.image_url)
                                                                    ? <img src={post.image_urls?.[0] || post.image_url} alt="" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center"><i className="pi pi-file text-gray-400" style={{ fontSize: '10px' }}></i></div>
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="m-0 text-[10px] text-indigo-500 font-bold uppercase">#{post.category}</p>
                                                                <p className="m-0 text-xs text-gray-600 truncate">{post.caption}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Post results */}
                                        {searchResults.posts?.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-xs font-bold text-gray-500 mb-2 m-0 uppercase tracking-wider">Posts</p>
                                                <div className="flex flex-col gap-1">
                                                    {searchResults.posts.slice(0, 4).map(post => (
                                                        <div key={post._id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                                                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                                {(post.image_urls?.[0] || post.image_url)
                                                                    ? <img src={post.image_urls?.[0] || post.image_url} alt="" className="w-full h-full object-cover" />
                                                                    : <div className="w-full h-full flex items-center justify-center"><i className="pi pi-file text-gray-400" style={{ fontSize: '12px' }}></i></div>
                                                                }
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="m-0 text-xs text-indigo-500 font-medium">#{post.category}</p>
                                                                <p className="m-0 text-xs text-gray-600 truncate">{post.caption}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-2xl mb-1">🔍</p>
                                        <p className="text-sm text-gray-400 m-0">No results for "<strong>{searchTerm}</strong>"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* User Profile Dialog */}
            <Dialog header="Profile" visible={isVisible} style={{ width: '500px', height: '90vh' }} onHide={() => setVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </>
    );
};

export default Search;