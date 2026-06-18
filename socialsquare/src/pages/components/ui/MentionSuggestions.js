import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

const MentionSuggestions = ({ text, cursorPosition, onSelect }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [visible, setVisible] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!text || cursorPosition === undefined) {
            setVisible(false);
            return;
        }

        // Find the last "@" before the cursor position
        const textBeforeCursor = text.slice(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex === -1) {
            setVisible(false);
            return;
        }

        // Check if there are spaces between "@" and the cursor
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        if (/\s/.test(textAfterAt)) {
            setVisible(false);
            return;
        }

        // We have an active mention query!
        setQuery(textAfterAt);
        setVisible(true);
        setActiveIndex(0);
    }, [text, cursorPosition]);

    useEffect(() => {
        if (!visible) {
            setSuggestions([]);
            return;
        }

        const fetchSuggestions = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.post(`${BASE}/api/auth/search`,
                    { query: query || 'a' }, // default search term if query is empty
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                // Get matching users and exclude users without usernames
                const users = (res.data.users || []).filter(u => u.username);
                setSuggestions(users.slice(0, 5)); // Cap at 5 suggestions
            } catch (err) {
                console.error('[Mention Suggestions Fetch Error]:', err.message);
            }
        };

        const timer = setTimeout(fetchSuggestions, 200);
        return () => clearTimeout(timer);
    }, [query, visible]);

    // Keyboard navigation handlers
    useEffect(() => {
        if (!visible || suggestions.length === 0) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectUser(suggestions[activeIndex]);
            } else if (e.key === 'Escape') {
                setVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, suggestions, activeIndex]);

    const selectUser = (user) => {
        // Find last "@" before cursor to replace it correctly
        const textBeforeCursor = text.slice(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        const before = text.slice(0, lastAtIndex);
        const after = text.slice(cursorPosition);
        const completed = `${before}@${user.username} ${after}`;

        onSelect(completed);
        setVisible(false);
    };

    if (!visible || suggestions.length === 0) return null;

    return (
        <div
            ref={dropdownRef}
            className="bg-black absolute left-4 right-4 bottom-full mb-2 bg-[var(--surface-1)]/95 backdrop-blur-xl border border-[var(--border-color)] p-1 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] z-[9999] flex flex-col gap-0.5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ maxWidth: '300px' }}
        >
            {/* <div className="px-3 py-1.5 text-[10px] font-bold text-[#808bf5] uppercase tracking-wider border-b border-[var(--border-color)]/30 mb-1">
                Mention user
            </div> */}
            {suggestions.map((user, idx) => (
                <div
                    key={user._id}
                    onClick={() => selectUser(user)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${idx === activeIndex
                        ? 'bg-[#808bf5]/10'
                        : 'hover:bg-[var(--surface-2)]'
                        }`}
                >
                    <img
                        src={user.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                        alt={user.fullname}
                        className="w-7 h-7 rounded-full object-cover border border-[var(--border-color)]"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="m-0 text-xs font-bold text-[var(--text-main)] truncate">{user.fullname}</p>
                        <p className="m-0 text-[10px] text-[#808bf5] truncate">@{user.username}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MentionSuggestions;
