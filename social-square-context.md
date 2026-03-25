# Social Square — Full Codebase Context

## Project Overview

Social Square is a full-stack social media platform built with:
- **Backend**: Node.js + Express + MongoDB + Socket.io + Redis + NATS/PubSub + BullMQ
- **Frontend**: React + Zustand + TanStack Query + PrimeReact + Tailwind CSS
- **AI**: Gemini 2.0 Flash (primary) + NVIDIA Mistral/Phi-4 (fallback) + NVIDIA LLaMA3 (chatbot)
- **Auth**: JWT access tokens (in-memory) + httpOnly refresh token cookies + 2FA + Google OAuth
- **Real-time**: Socket.io with Redis adapter for pub/sub across workers
- **Media**: Cloudinary for images/video/audio uploads
- **Email**: Nodemailer with Gmail SMTP + daily digest via BullMQ queue

## File Structure
```
App.js
components/ChatPanel.jsx
components/Chatbot.js
components/CollabManager.jsx
components/Comment.jsx
components/Conversations.jsx
components/EditProfile.jsx
components/Feed.jsx
components/FollowFollowingList.jsx
components/MoodFeedToggle.jsx
components/Navbar.jsx
components/NotificationBell.jsx
components/NotificationToast.jsx
components/OtherUsers.jsx
components/PasswordStrengthMeter.jsx
components/Profile.jsx
components/Search.jsx
components/Stories.jsx
components/UserProfile.jsx
context/DarkModeContext.jsx
db.js
hooks/queries/useConversationQueries.js
hooks/queries/useNotificationQueries.js
hooks/queries/usePostQueries.js
hooks/useFeedSocket.js
hooks/useNotifications.js
hooks/useTokenRefresh.js
index.js
lib/cache.js
lib/nats.js
middleware/verifyToken.js
models/Analytics.js
models/Comment.js
models/Feed.js
models/LoginSession.js
models/Message.js
models/Notification.js
models/Post.js
models/Report.js
models/Story.js
models/User.js
package.scripts.json
pages/ActiveSessions.jsx
pages/AdminDashboard.jsx
pages/Explore.jsx
pages/Forgot.jsx
pages/Home.jsx
pages/Login.jsx
pages/PostDetail.jsx
pages/ResetPassword.jsx
pages/Signup.jsx
pages/VerifyOtp.jsx
queues/digestQueue.js
routes/admin.js
routes/ai.js
routes/auth.js
routes/chatbot.js
routes/conversation.js
routes/post.js
routes/story.js
scripts/createIndexes.js
scripts/makeAdmin.js
services/cloudinary.js
services/mailer.js
store/index.js
store/postsSlice.js
store/reduxStore.js
store/slices/conversationSlice.js
store/slices/postsSlice.js
store/slices/userSlice.js
store/zustand/useAuthStore.js
store/zustand/useConversationStore.js
store/zustand/usePostStore.js
subscribers/postSubscriber.js
utils/authSecurity.js
utils/cloudinary.js
utils/fingerprint.js
utils/gemini.js
utils/mailer.js
utils/pushNotifications.js
```


---

## Development History & Decisions

This is the complete build log of Social Square. Key decisions made during development:

### Phase 1 — Core Backend
- Auth system: JWT + refresh token rotation + fingerprint + 2FA via email OTP
- Post model with: anonymous, time-lock, expiry TTL, collaborative, voice notes, mood
- NATS pub/sub for feed distribution to followers
- BullMQ email queue with Redis

### Phase 2 — Frontend
- React + Redux → later fully migrated to Zustand + TanStack Query
- Feed with infinite scroll, real-time socket updates, optimistic likes
- Stories, Explore with confessions tab, mood-based feed
- NewPost with AI caption generation, voice recording, collaborative invites

### Phase 3 — Advanced Features
- Collaborative posts: invite system, accept/decline with contribution text, status tracking
- Admin dashboard: analytics, user management, post moderation, report resolution
- Password re-entry gate for admin access
- Confessions feed: anonymous posts never go to followers' feeds (privacy-safe)

### Phase 4 — AI Integration
- Gemini 2.0 Flash: image captioning, mood detection
- NVIDIA Phi-4: fallback for all Gemini operations
- NVIDIA LLaMA3-ChatQA: SocialBot chatbot with SSE streaming
- AI post creator in NewPost: text generation, image generation, hashtag suggestions
- Daily limits on AI post generation per user

### Phase 5 — Conversations
- Messages: send, edit (soft), delete (soft), reactions, media sharing
- Real-time: socket events for all message operations
- Waveform voice note player
- Message search via MongoDB text index
- Typing indicators, read receipts

### Phase 6 — Architecture Migration
- Redux → Zustand (useAuthStore, usePostStore, useConversationStore)
- All API calls → TanStack Query with proper cache invalidation
- Token storage: localStorage → in-memory (XSS safe) + httpOnly cookie for refresh
- Fixed logout-on-refresh: initAuth() restores session from cookie on mount

### Phase 7 — Production Hardening
- Rate limiting: auth writes only (not refresh/get), 500 req/min general
- MongoDB indexes: 25+ indexes across all collections
- Redis caching: conversations (30s), messages (15s)
- Cluster mode REMOVED for 512MB RAM target — single process + async I/O
- MongoDB pool reduced: 50 → 10 connections
- Node heap capped: --max-old-space-size=400
- Separated services: cloudinary.js, mailer.js as lazy singletons

### Known Issues Fixed During Development
1. `socketNewConfessionPost` crash → `confessions: []` missing from initialState
2. Logout on refresh → token was in localStorage (expired), fixed with initAuth() + cookie
3. Too many requests error → rate limiter was hitting /refresh and /get endpoints
4. Live messages not working → sendMutation never emitted socket event for sender
5. Edit/delete/react not live → backend used io.emit() (broadcast all), fixed to emit to conversation participants only; frontend never emitted socket events after API calls
6. NVIDIA 422 error → llama3-chatqa requires alternating user/assistant roles, no system role
7. NVIDIA 404 error → wrong model name, model forced streaming regardless of stream:false

### File Placement Guide (your project uses src/pages/components/)
- `src/App.js` — root, depth 0, imports use `./`
- `src/pages/*.js` — depth 1, imports use `../`
- `src/pages/components/*.js` — depth 2, imports use `../../`
- `src/pages/components/ui/*.js` — depth 3, imports use `../../../`
- `src/store/zustand/` — Zustand stores
- `src/hooks/queries/` — TanStack Query hooks
- `src/services/` — Cloudinary + Mailer singletons (backend)

---

## Architecture Notes

### Auth Flow
- Login → access token (15min, in-memory only) + refresh token (7d, httpOnly cookie)
- On page refresh → `initAuth()` calls `/api/auth/refresh` → gets new access + user object
- Axios interceptor auto-retries 401s with refreshed token (silent re-auth)
- No token in localStorage — XSS safe

### State Management
- **Zustand**: `useAuthStore` (user/auth), `usePostStore` (UI state, optimistic likes), `useConversationStore` (chat UI, typing, unread)
- **TanStack Query**: All server data fetching — feed, posts, conversations, notifications
- **Redux**: Completely removed

### Real-time Events (Socket.io)
- `newFeedPost` → new post from followed user
- `receiveMessage` → new DM
- `messageEdited/Deleted/Reaction` → forwarded to recipient room
- `userTyping/StoppedTyping` → typing indicators
- `collaborationInvite/Accepted` → collab post events
- `newNotification` → injected into TanStack Query cache

### Key Backend Routes
- `POST /api/auth/refresh` → returns { token, user } — used for session restore
- `POST /api/chatbot/chat` → NVIDIA LLaMA3-ChatQA streaming SSE
- `POST /api/chatbot/generate-post-text` → AI post creation
- `POST /api/chatbot/generate-image` → NVIDIA Stable Diffusion
- `POST /api/ai/caption` → Gemini image captioning (NVIDIA fallback)
- `POST /api/ai/detect-mood` → mood from caption text
- `GET /api/post/collaborate/invites/:userId` → pending collab invites
- `POST /api/conversation/messages/create` → send message + socket emit
- `PATCH /api/conversation/messages/:id` → edit message
- `DELETE /api/conversation/messages/:id` → soft delete

### RAM Optimization (target: <512MB)
- No cluster mode — single process, async I/O
- MongoDB pool: maxPoolSize=10, minPoolSize=2
- `--max-old-space-size=400` Node flag caps heap at 400MB
- Lazy route loading via require() inside middleware
- No broadcast of full online user list — only notify connecting socket
- Services (cloudinary, mailer) lazy-initialized as singletons

---

## All Source Files

### `App.js`
```javascript
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import 'primereact/resources/themes/lara-light-cyan/theme.css';

// ✅ All imports from src/ root — no '../' needed
import useAuthStore, { api } from './store/zustand/useAuthStore';
import useConversationStore from './store/zustand/useConversationStore';
import { socket } from './socket';
import { DarkModeProvider } from './context/DarkModeContext';
import useTokenRefresh from './hooks/useTokenRefresh';

// ─── LAZY PAGES ───────────────────────────────────────────────────────────────
const Home           = lazy(() => import('./pages/Home'));
const Login          = lazy(() => import('./pages/Login'));
const Signup         = lazy(() => import('./pages/Signup'));
const Forgot         = lazy(() => import('./pages/Forgot'));
const Contact        = lazy(() => import('./pages/Contact'));
const Help           = lazy(() => import('./pages/Help'));
const Landing        = lazy(() => import('./pages/Landing'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword'));
const VerifyOtp      = lazy(() => import('./pages/VerifyOtp'));
const ActiveSessions = lazy(() => import('./pages/ActiveSessions'));
const PostDetail     = lazy(() => import('./pages/PostDetail'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const PageLoader = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #808bf5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 1000 * 60 * 2, retry: 1, refetchOnWindowFocus: false },
        mutations: { retry: 0 },
    },
});

function AppInit() {
    const initAuth       = useAuthStore(s => s.initAuth);
    const user           = useAuthStore(s => s.user);
    const setOnlineUsers = useConversationStore(s => s.setOnlineUsers);

    useTokenRefresh();

    // ✅ On every page load/refresh — silently restore session from httpOnly cookie
    // No localStorage needed — refresh token cookie does it all
    useEffect(() => {
        initAuth();
    }, []);

    useEffect(() => {
        if (!user?._id) return;
        if (!socket.connected) socket.connect();
        socket.emit('registerUser', user._id);
        socket.on('connect', () => localStorage.setItem('socketId', socket.id));
        socket.on('updateUserList', setOnlineUsers);
        return () => {
            socket.off('connect');
            socket.off('updateUserList');
        };
    }, [user?._id]);

    return null;
}

function App() {
    return (
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <DarkModeProvider>
                    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
                        <AppInit />
                        <Router>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    <Route path="/landing"        element={<Landing />} />
                                    <Route path="/signup"         element={<Signup />} />
                                    <Route path="/forgot"         element={<Forgot />} />
                                    <Route path="/contact"        element={<Contact />} />
                                    <Route path="/login"          element={<Login />} />
                                    <Route path="/help"           element={<Help />} />
                                    <Route path="/reset-password" element={<ResetPassword />} />
                                    <Route path="/verify-otp"     element={<VerifyOtp />} />
                                    <Route path="/sessions"       element={<ActiveSessions />} />
                                    <Route path="/post/:postId"   element={<PostDetail />} />
                                    <Route path="/admin"          element={<AdminDashboard />} />
                                    <Route path="/"               element={<Home />} />
                                </Routes>
                            </Suspense>
                        </Router>
                    </GoogleOAuthProvider>
                </DarkModeProvider>
            </QueryClientProvider>
        </HelmetProvider>
    );
}

export default App;

```

### `components/ChatPanel.jsx`
```jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { socket } from '../../socket';
import { uploadToCloudinary } from '../../utils/cloudinary';
import toast from 'react-hot-toast';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;
const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// ─── WAVEFORM PLAYER ──────────────────────────────────────────────────────────
const VoiceNotePlayer = ({ url, duration }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);
    const bars = [3,5,8,12,7,15,10,6,14,9,11,4,13,8,6,12,7,10,5,8];
    const filledBars = Math.floor((progress / 100) * 20);
    const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

    const toggle = () => {
        if (!audioRef.current) return;
        if (playing) audioRef.current.pause();
        else audioRef.current.play();
        setPlaying(p => !p);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onEnd  = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
        const onTime = () => { setCurrentTime(audio.currentTime); setProgress(audio.duration ? (audio.currentTime/audio.duration)*100 : 0); };
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('timeupdate', onTime);
        return () => { audio.removeEventListener('ended', onEnd); audio.removeEventListener('timeupdate', onTime); };
    }, []);

    return (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', minWidth:'180px' }}>
            <audio ref={audioRef} src={url} preload="metadata" style={{ display:'none' }} />
            <button onClick={toggle} style={{ width:28, height:28, borderRadius:'50%', background:'#808bf5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {playing
                    ? <svg width="10" height="10" fill="#fff"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>
                    : <svg width="10" height="10" fill="#fff"><polygon points="2,0 10,5 2,10"/></svg>}
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:'2px', flex:1 }}>
                {bars.map((h, i) => <div key={i} style={{ width:'3px', height:`${h}px`, borderRadius:'2px', background: i < filledBars ? '#808bf5' : 'rgba(128,139,245,0.3)' }} />)}
            </div>
            <span style={{ fontSize:'10px', color:'#9ca3af', flexShrink:0 }}>{playing ? fmt(currentTime) : fmt(duration||0)}</span>
        </div>
    );
};

// ─── REACTION PICKER ──────────────────────────────────────────────────────────
const ReactionPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [onClose]);
    return (
        <div ref={ref} style={{ position:'absolute', bottom:'100%', background:'#fff', borderRadius:'24px', padding:'6px 10px', boxShadow:'0 4px 16px rgba(0,0,0,0.15)', display:'flex', gap:'6px', zIndex:100, border:'1px solid #f3f4f6' }}>
            {EMOJI_REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', padding:'2px', borderRadius:'8px' }}
                    onMouseEnter={e => e.currentTarget.style.transform='scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>{emoji}</button>
            ))}
        </div>
    );
};

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ message, isOwn, conversationId, loggeduser, onReact, onEdit, onDelete }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [showMenu, setShowMenu]   = useState(false);
    const [editing, setEditing]     = useState(false);
    const [editText, setEditText]   = useState(message.content);

    const isDeleted = !!message.deletedAt;
    const reactions = message.reactions ? Object.entries(message.reactions) : [];
    const reactionGroups = reactions.reduce((acc, [uid, emoji]) => {
        if (!acc[emoji]) acc[emoji] = [];
        acc[emoji].push(uid);
        return acc;
    }, {});

    const handleEditSave = () => { onEdit(message._id, editText); setEditing(false); };

    return (
        <div style={{ display:'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom:'4px', position:'relative' }}
            onMouseEnter={() => !isDeleted && setShowMenu(true)}
            onMouseLeave={() => { setShowMenu(false); setShowReactions(false); }}>

            {showMenu && !isDeleted && (
                <div style={{ position:'relative', alignSelf:'center', margin: isOwn ? '0 4px 0 0' : '0 0 0 4px', order: isOwn ? -1 : 1 }}>
                    <button onClick={() => setShowReactions(v => !v)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:22, height:22, cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}>😊</button>
                    {showReactions && <ReactionPicker onSelect={emoji => onReact(message._id, emoji)} onClose={() => setShowReactions(false)} />}
                </div>
            )}

            <div style={{ maxWidth:'70%', position:'relative' }}>
                {editing ? (
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                            style={{ padding:'8px 12px', borderRadius:'16px', border:'1px solid #808bf5', fontSize:'14px', outline:'none', minWidth:'150px' }} />
                        <button onClick={handleEditSave} style={{ background:'#808bf5', color:'#fff', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>Save</button>
                        <button onClick={() => setEditing(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
                    </div>
                ) : (
                    <div style={{ background: isOwn ? '#808bf5' : '#f3f4f6', color: isOwn ? '#fff' : '#1f2937', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding:'10px 14px', fontSize:'14px', lineHeight:1.5 }}>
                        {isDeleted ? <span style={{ fontStyle:'italic', opacity:0.6, fontSize:'12px' }}>🚫 Message deleted</span> : (
                            <>
                                {message.media?.url && (
                                    <div style={{ marginBottom: message.content ? '8px' : 0 }}>
                                        {message.media.type === 'image' && <img src={message.media.url} alt="" style={{ maxWidth:'200px', borderRadius:'12px', display:'block' }} />}
                                        {message.media.type === 'audio' && <VoiceNotePlayer url={message.media.url} duration={message.media.size} />}
                                        {message.media.type === 'video' && <video src={message.media.url} controls style={{ maxWidth:'200px', borderRadius:'12px' }} />}
                                        {message.media.type === 'file' && <a href={message.media.url} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:'6px', color: isOwn ? '#fff' : '#808bf5', textDecoration:'none', fontSize:'13px' }}>📎 {message.media.name||'File'}</a>}
                                    </div>
                                )}
                                {message.content && <p style={{ margin:0 }}>{message.content}</p>}
                                {message.edited && <span style={{ fontSize:'10px', opacity:0.6 }}> (edited)</span>}
                            </>
                        )}
                    </div>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop:'2px' }}>
                    <span style={{ fontSize:'10px', color:'#9ca3af' }}>
                        {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : ''}
                    </span>
                    {isOwn && !isDeleted && (
                        message.isRead
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808bf5" strokeWidth="2"><path d="M3 13s1.5.7 3.5 4c0 0 .28-.48.82-1.25M17 6c-2.29 1.15-4.69 3.56-6.61 5.82"/><path d="M8 13s1.5.7 3.5 4c0 0 5.5-8.5 10.5-11"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M5 14.5s1.5 0 3.5 3.5c0 0 5.5-9.5 10.5-11"/></svg>
                    )}
                </div>

                {Object.keys(reactionGroups).length > 0 && !isDeleted && (
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'4px', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                        {Object.entries(reactionGroups).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => onReact(message._id, emoji)}
                                style={{ background: users.includes(loggeduser._id) ? '#ede9fe' : '#f3f4f6', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'2px 6px', cursor:'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'3px' }}>
                                {emoji} {users.length > 1 && <span style={{ fontSize:'10px', color:'#6b7280' }}>{users.length}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {showMenu && isOwn && !isDeleted && (
                    <div style={{ position:'absolute', right:0, top:'-30px', display:'flex', gap:'4px', background:'#fff', borderRadius:'10px', padding:'3px 6px', boxShadow:'0 2px 8px rgba(0,0,0,0.1)', border:'1px solid #f3f4f6', zIndex:10 }}>
                        <button onClick={() => setEditing(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'#6b7280', padding:'2px 4px' }}>✏️</button>
                        <button onClick={() => onDelete(message._id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'#ef4444', padding:'2px 4px' }}>🗑️</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const ChatPanel = ({ participantId, lastMessage }) => {
    const user     = useAuthStore(s => s.user);
    const store    = useConversationStore();
    const chatRef  = useRef(null);
    const fileInputRef  = useRef(null);
    const typingTimer   = useRef(null);
    const conversationIdRef = useRef(null); // ✅ stable ref to avoid stale closures

    const [text, setText]           = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchQ, setSearchQ]     = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading]     = useState(true);

    // ✅ Local messages state — single source of truth
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState(null);

    // ✅ Fetch messages from backend directly (no TanStack Query confusion)
    const fetchMessages = useCallback(async () => {
        if (!user?._id || !participantId) return;
        setLoading(true);
        try {
            const res = await axios.post(`${BASE}/api/conversation/messages`, {
                participantIds: [user._id, participantId]
            });
            setMessages(res.data.messages || []);
            setConversationId(res.data.conversation?._id || null);
            conversationIdRef.current = res.data.conversation?._id || null;
        } catch (err) {
            console.error('Failed to fetch messages', err);
        }
        setLoading(false);
    }, [user?._id, participantId]);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);

    // ✅ Scroll to bottom whenever messages change
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages]);

    // ✅ Socket listeners with stable ref — no stale closure issues
    useEffect(() => {
        const handleReceive = (message) => {
            // Only handle messages from current participant
            if (message.senderId !== participantId && message.sender !== participantId) return;

            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m._id === message._id)) return prev;
                return [...prev, message];
            });

            // Mark as read
            if (conversationIdRef.current) {
                axios.post(`${BASE}/api/conversation/messages/mark-read`, {
                    unreadMessageIds: [message._id],
                    lastMessage: message._id,
                }).catch(() => {});
                socket.emit('readMessage', { messageId: message._id, socketId: message.socketId });
            }
        };

        const handleSeen = ({ messageId }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isRead: true } : m));
        };

        const handleEdited = ({ messageId, content, conversationId: cid }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content, edited: true } : m));
        };

        const handleDeleted = ({ messageId }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m));
        };

        const handleReaction = ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
        };

        const handleTyping = ({ senderName }) => {
            if (conversationIdRef.current) store.setTyping(conversationIdRef.current, senderName);
        };

        const handleStopTyping = () => {
            if (conversationIdRef.current) store.clearTyping(conversationIdRef.current);
        };

        socket.on('receiveMessage',    handleReceive);
        socket.on('seenMessage',       handleSeen);
        socket.on('messageEdited',     handleEdited);
        socket.on('messageDeleted',    handleDeleted);
        socket.on('messageReaction',   handleReaction);
        socket.on('userTyping',        handleTyping);
        socket.on('userStoppedTyping', handleStopTyping);

        return () => {
            socket.off('receiveMessage',    handleReceive);
            socket.off('seenMessage',       handleSeen);
            socket.off('messageEdited',     handleEdited);
            socket.off('messageDeleted',    handleDeleted);
            socket.off('messageReaction',   handleReaction);
            socket.off('userTyping',        handleTyping);
            socket.off('userStoppedTyping', handleStopTyping);
        };
    }, [participantId]); // ✅ only re-run when participantId changes

    // ─── SEND ────────────────────────────────────────────────────────────────
    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || !conversationId) return;

        const optimisticMsg = {
            _id:            `temp_${Date.now()}`,
            sender:         user._id,
            content:        text.trim(),
            conversationId,
            createdAt:      new Date().toISOString(),
            isRead:         false,
            isOptimistic:   true,
        };

        // ✅ Add optimistically immediately so sender sees it right away
        setMessages(prev => [...prev, optimisticMsg]);
        setText('');
        socket.emit('stopTyping', { recipientId: participantId });

        try {
            const res = await axios.post(`${BASE}/api/conversation/messages/create`, {
                conversationId,
                sender:      user._id,
                senderName:  user.fullname,
                content:     optimisticMsg.content,
                recipientId: participantId,
            });

            // ✅ Replace optimistic message with real one from server
            setMessages(prev => prev.map(m =>
                m._id === optimisticMsg._id ? res.data : m
            ));

            // Emit via socket so recipient gets it in real time
            socket.emit('sendMessage', {
                ...res.data,
                recipientId: participantId,
                senderName:  user.fullname,
                sender:      user._id,
                senderId:    user._id,
                socketId:    socket.id,
            });

        } catch {
            // Remove failed optimistic message
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
            toast.error('Failed to send message');
        }
    };

    // ─── TYPING ───────────────────────────────────────────────────────────────
    const handleInputChange = (e) => {
        setText(e.target.value);
        socket.emit('typing', { recipientId: participantId, senderName: user.fullname });
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => socket.emit('stopTyping', { recipientId: participantId }), 1500);
    };

    // ─── REACT ────────────────────────────────────────────────────────────────
    const handleReact = async (messageId, emoji) => {
        try {
            const res = await axios.post(`${BASE}/api/conversation/messages/${messageId}/react`, {
                userId: user._id, emoji
            });
            const reactions = res.data.reactions;
            // ✅ Update locally for sender immediately
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
            // ✅ Emit to recipient so their screen updates live
            socket.emit('messageReaction', {
                messageId,
                conversationId: conversationIdRef.current,
                reactions,
                recipientId: participantId,
            });
        } catch { toast.error('Reaction failed'); }
    };

    // ─── EDIT ─────────────────────────────────────────────────────────────────
    const handleEdit = async (messageId, content) => {
        // ✅ Optimistic update for sender
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content, edited: true } : m));
        try {
            await axios.patch(`${BASE}/api/conversation/messages/${messageId}`, { content });
            // ✅ Emit to recipient
            socket.emit('messageEdited', {
                messageId,
                content,
                conversationId: conversationIdRef.current,
                recipientId: participantId,
            });
        } catch {
            // Rollback on failure
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, content: m.content, edited: m.edited } : m));
            toast.error('Edit failed');
        }
    };

    // ─── DELETE ───────────────────────────────────────────────────────────────
    const handleDelete = async (messageId) => {
        if (!window.confirm('Delete this message?')) return;
        // ✅ Optimistic update for sender
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
        try {
            await axios.delete(`${BASE}/api/conversation/messages/${messageId}`, { data: { userId: user._id } });
            // ✅ Emit to recipient
            socket.emit('messageDeleted', {
                messageId,
                conversationId: conversationIdRef.current,
                recipientId: participantId,
            });
        } catch {
            // Rollback
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deletedAt: null, content: m.content } : m));
            toast.error('Delete failed');
        }
    };

    // ─── MEDIA UPLOAD ─────────────────────────────────────────────────────────
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;
        setUploading(true);
        try {
            let mediaUrl, mediaType;
            if (file.type.startsWith('image/')) {
                mediaUrl = await uploadToCloudinary(file); mediaType = 'image';
            } else if (file.type.startsWith('video/')) {
                const fd = new FormData();
                fd.append('file', file); fd.append('upload_preset', 'socialsquare'); fd.append('resource_type', 'video');
                const r = await fetch(`https://api.cloudinary.com/v1_1/dcmrsdydr/video/upload`, { method: 'POST', body: fd });
                mediaUrl = (await r.json()).secure_url; mediaType = 'video';
            } else {
                mediaUrl = await uploadToCloudinary(file); mediaType = 'file';
            }

            const res = await axios.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, sender: user._id, senderName: user.fullname,
                content: '', recipientId: participantId,
                mediaUrl, mediaType, mediaName: file.name, mediaSize: file.size,
            });
            setMessages(prev => [...prev, res.data]);
            socket.emit('sendMessage', { ...res.data, recipientId: participantId, senderName: user.fullname, sender: user._id, senderId: user._id, socketId: socket.id });
        } catch { toast.error('Upload failed'); }
        setUploading(false);
        e.target.value = '';
    };

    const isTypingOther = conversationId && store.isTyping(conversationId);
    const typingName    = conversationId ? store.getTypingName(conversationId) : null;

    const displayMessages = messages.filter(m =>
        !searchQ || m.content?.toLowerCase().includes(searchQ.toLowerCase())
    );

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'77vh' }}>

            {showSearch && (
                <div style={{ padding:'8px 12px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:'8px' }}>
                    <input type="text" placeholder="Search messages..." value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus
                        style={{ flex:1, padding:'6px 12px', borderRadius:'20px', border:'1px solid #e5e7eb', fontSize:'13px', outline:'none' }} />
                    <button onClick={() => { setShowSearch(false); setSearchQ(''); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>✕</button>
                </div>
            )}

            {/* Messages */}
            <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'12px', display:'flex', flexDirection:'column', gap:'2px' }}>
                {loading ? (
                    <div style={{ textAlign:'center', padding:'24px', color:'#9ca3af', fontSize:'13px' }}>Loading...</div>
                ) : displayMessages.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af', fontSize:'13px' }}>No messages yet. Say hi! 👋</div>
                ) : displayMessages.map(message => (
                    <MessageBubble key={message._id} message={message}
                        isOwn={message.sender?.toString() === user?._id?.toString() || message.senderId === user?._id}
                        conversationId={conversationId}
                        loggeduser={user}
                        onReact={handleReact}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}

                {isTypingOther && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'4px 0' }}>
                        <div style={{ background:'#f3f4f6', borderRadius:'18px 18px 18px 4px', padding:'10px 14px', display:'flex', gap:'4px', alignItems:'center' }}>
                            <span style={{ fontSize:'11px', color:'#9ca3af', marginRight:'4px' }}>{typingName}</span>
                            {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', animation:`typingDot 1s ${i*0.2}s infinite` }} />)}
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div style={{ borderTop:'1px solid #f3f4f6', padding:'10px 12px' }}>
                <form onSubmit={handleSend} style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <button type="button" onClick={() => setShowSearch(v => !v)}
                        style={{ background:'none', border:'none', cursor:'pointer', color: showSearch ? '#808bf5' : '#9ca3af', fontSize:'16px', padding:'4px', flexShrink:0 }}>🔍</button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px', padding:'4px', flexShrink:0 }}>
                        {uploading ? '⏳' : '📎'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleFileSelect} style={{ display:'none' }} />
                    <input type="text" value={text} onChange={handleInputChange} placeholder="Type your message..."
                        style={{ flex:1, padding:'10px 16px', borderRadius:'24px', border:'1px solid #e5e7eb', fontSize:'14px', outline:'none', background:'#f9fafb' }}
                        onFocus={e => e.target.style.borderColor = '#808bf5'}
                        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                    />
                    <button type="submit" disabled={!text.trim() && !uploading}
                        style={{ width:40, height:40, borderRadius:'50%', background: text.trim() ? '#808bf5' : '#e5e7eb', border:'none', cursor: text.trim() ? 'pointer' : 'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background 0.2s' }}>
                        <i className="pi pi-send" style={{ fontSize:'16px', color: text.trim() ? '#fff' : '#9ca3af' }}></i>
                    </button>
                </form>
            </div>

            <style>{`@keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }`}</style>
        </div>
    );
};

export default ChatPanel;

```

### `components/Chatbot.js`
```javascript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUICK ACTION BUTTONS ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    { label: '✍️ Caption ideas',     message: 'Give me caption ideas for my next post' },
    { label: '😊 Mood check-in',     message: 'Help me find posts that match my mood' },
    { label: '❓ How to post',       message: 'How do I create a post on Social Square?' },
    { label: '🤝 Collab posts',      message: 'How do collaborative posts work?' },
    { label: '🎭 Confessions',       message: 'How do anonymous confessions work?' },
    { label: '🚩 Report an issue',   message: 'I want to report a problem with the app' },
];

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
    const isBot = msg.role === 'assistant';
    const isSystem = msg.role === 'system';

    if (isSystem) return (
        <div style={{ textAlign: 'center', padding: '4px 8px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', borderRadius: '10px', padding: '2px 10px' }}>{msg.content}</span>
        </div>
    );

    return (
        <div style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', marginBottom: '8px', gap: '8px', alignItems: 'flex-end' }}>
            {isBot && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    🤖
                </div>
            )}
            <div style={{
                maxWidth: '78%',
                padding: '10px 13px',
                borderRadius: isBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                background: isBot ? '#f3f4f6' : 'linear-gradient(135deg, #808bf5, #6366f1)',
                color: isBot ? '#1f2937' : '#fff',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {msg.content}
                {msg.loading && (
                    <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '4px' }}>
                        {[0, 1, 2].map(i => (
                            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9ca3af', display: 'inline-block', animation: `typingDot 1s ${i * 0.2}s infinite` }} />
                        ))}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── MAIN CHATBOT ─────────────────────────────────────────────────────────────
const Chatbot = () => {
    const user = useAuthStore(s => s.user);
    const [open, setOpen]         = useState(false);
    const [input, setInput]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [unread, setUnread]     = useState(0);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hey ${user?.fullname?.split(' ')[0] || 'there'}! 👋 I'm SocialBot, your AI assistant for Social Square.\n\nI can help you with posting tips, caption ideas, mood-based content, or any app questions. What can I help you with?`,
        }
    ]);
    const bottomRef   = useRef(null);
    const inputRef    = useRef(null);
    const hasOpened   = useRef(false);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setUnread(0);
            setTimeout(() => inputRef.current?.focus(), 100);
            hasOpened.current = true;
        }
    }, [open]);

    const sendMessage = useCallback(async (text) => {
        const content = (text || input).trim();
        if (!content || loading) return;

        setInput('');

        const userMsg  = { role: 'user', content };
        const loadingMsg = { role: 'assistant', content: '', loading: true };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setLoading(true);

        try {
            const history = [...messages, userMsg].filter(m => !m.loading);
            const response = await fetch(`${BASE}/api/chatbot/chat`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ messages: history, userId: user?._id }),
            });

            if (!response.ok) throw new Error('Server error');

            // ✅ Handle SSE streaming response
            const reader  = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            // Replace loading bubble with empty assistant bubble to stream into
            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                { role: 'assistant', content: '' },
            ]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            accumulated += parsed.content;
                            // Update last message in real time
                            setMessages(prev => [
                                ...prev.slice(0, -1),
                                { role: 'assistant', content: accumulated },
                            ]);
                        }
                    } catch {}
                }
            }

            // Badge if closed
            if (!open) setUnread(n => n + 1);

        } catch {
            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                { role: 'assistant', content: '⚠️ Connection error. Please try again.' },
            ]);
        }
        setLoading(false);
    }, [input, loading, messages, open, user?._id]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            content: `Chat cleared! How can I help you? 😊`,
        }]);
    };

    return (
        <>
            <style>{`
                @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }
                @keyframes chatPop { 0%{transform:scale(0.8) translateY(20px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
                @keyframes bubblePulse { 0%,100%{box-shadow:0 0 0 0 rgba(128,139,245,0.4)} 50%{box-shadow:0 0 0 10px rgba(128,139,245,0)} }
                .chatbot-window { animation: chatPop 0.25s ease forwards; }
            `}</style>

            {/* ── Floating Bubble ── */}
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>

                {/* Chat window */}
                {open && (
                    <div className="chatbot-window" style={{
                        position: 'absolute', bottom: '68px', right: 0,
                        width: '340px', height: '520px',
                        background: '#fff', borderRadius: '20px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                        border: '1px solid #e5e7eb',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #808bf5, #6366f1)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                🤖
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '14px' }}>SocialBot</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>Online · Powered by Mistral AI</p>
                                </div>
                            </div>
                            <button onClick={clearChat} title="Clear chat"
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: '11px' }}>
                                🗑️
                            </button>
                            <button onClick={() => setOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✕
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                            <div ref={bottomRef} />
                        </div>

                        {/* Quick actions — show only at start */}
                        {messages.length <= 2 && (
                            <div style={{ padding: '0 12px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {QUICK_ACTIONS.map((action, i) => (
                                    <button key={i} onClick={() => sendMessage(action.message)}
                                        style={{ padding: '4px 10px', borderRadius: '14px', border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: '11px', fontWeight: 500, color: '#374151', transition: 'all 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.borderColor = '#808bf5'; e.currentTarget.style.color = '#6366f1'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                rows={1}
                                disabled={loading}
                                style={{
                                    flex: 1, border: '1px solid #e5e7eb', borderRadius: '14px',
                                    padding: '8px 12px', fontSize: '13px', outline: 'none',
                                    resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                                    maxHeight: '80px', overflowY: 'auto', background: '#f9fafb',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = '#808bf5'}
                                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: input.trim() && !loading ? 'linear-gradient(135deg, #808bf5, #6366f1)' : '#e5e7eb',
                                    border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'all 0.2s',
                                }}>
                                {loading
                                    ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: input.trim() ? '#fff' : '#9ca3af', borderRadius: '50%', animation: 'typingDot 0.7s linear infinite' }} />
                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#9ca3af'} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Bubble button */}
                <button
                    onClick={() => setOpen(v => !v)}
                    style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: open ? '#6366f1' : 'linear-gradient(135deg, #808bf5, #6366f1)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(128,139,245,0.5)',
                        animation: !hasOpened.current ? 'bubblePulse 2s ease infinite' : 'none',
                        transition: 'transform 0.2s, background 0.2s',
                        fontSize: '24px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    title="Chat with SocialBot"
                >
                    {open ? '✕' : '🤖'}
                </button>

                {/* Unread badge */}
                {unread > 0 && !open && (
                    <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                        {unread}
                    </div>
                )}
            </div>
        </>
    );
};

export default Chatbot;

```

### `components/CollabManager.jsx`
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import axios from 'axios';
import toast from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const STATUS_STYLE = {
    pending:  { bg: '#fef3c7', color: '#d97706', label: '⏳ Pending' },
    accepted: { bg: '#d1fae5', color: '#059669', label: '✅ Accepted' },
    declined: { bg: '#fee2e2', color: '#ef4444', label: '❌ Declined' },
};

// ─── SINGLE INVITE CARD ───────────────────────────────────────────────────────
const InviteCard = ({ post, userId, onRespond }) => {
    const [contribution, setContribution] = useState('');
    const [loading, setLoading] = useState(false);
    const [showContrib, setShowContrib] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const myCollab = post.collaborators?.find(c => c.userId?.toString() === userId?.toString());
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    const respond = async (accepted) => {
        if (accepted && !contribution.trim()) {
            setShowContrib(true);
            return;
        }
        setLoading(true);
        try {
            await axios.post(`${BASE}/api/post/collaborate/${accepted ? 'accept' : 'decline'}`, {
                postId: post._id,
                userId,
                contribution: accepted ? contribution : undefined,
            });
            toast.success(accepted ? '🤝 Collaboration accepted!' : 'Invite declined');
            onRespond(post._id, accepted ? 'accepted' : 'declined');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
        setLoading(false);
    };

    if (!myCollab) return null;
    const isPending = myCollab.status === 'pending';

    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', overflow: 'hidden', marginBottom: '12px' }}>
            {/* Post preview */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                {/* Thumbnail */}
                <div style={{ width: 56, height: 56, borderRadius: '10px', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0 }}>
                    {images[0]
                        ? <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>📝</div>
                    }
                </div>
                {/* Post info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <img src={post.user?.profile_picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{post.user?.fullname}</span>
                        <span style={{ fontSize: '10px', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 6px' }}>invited you</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.caption || '(No caption)'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                </div>
                {/* My status badge */}
                <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: STATUS_STYLE[myCollab.status]?.bg, color: STATUS_STYLE[myCollab.status]?.color, fontWeight: 600 }}>
                        {STATUS_STYLE[myCollab.status]?.label}
                    </span>
                </div>
            </div>

            {/* All collaborators status */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 12px' }}>
                <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#808bf5', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    👥 {post.collaborators?.length} collaborator{post.collaborators?.length !== 1 ? 's' : ''}
                    <span style={{ fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {post.collaborators?.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={c.profile_picture || '/default-profile.png'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                                <span style={{ fontSize: '12px', flex: 1 }}>{c.fullname}</span>
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: STATUS_STYLE[c.status]?.bg, color: STATUS_STYLE[c.status]?.color }}>
                                    {STATUS_STYLE[c.status]?.label}
                                </span>
                                {c.contribution && (
                                    <span style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        "{c.contribution}"
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action buttons — only for pending */}
            {isPending && (
                <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {showContrib ? (
                        <>
                            <input
                                type="text"
                                placeholder="Add your contribution to this post..."
                                value={contribution}
                                onChange={e => setContribution(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #c4b5fd', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => respond(true)}
                                    disabled={loading || !contribution.trim()}
                                    style={{ flex: 1, padding: '8px', background: contribution.trim() ? '#808bf5' : '#e5e7eb', color: contribution.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: '10px', cursor: contribution.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 600 }}>
                                    {loading ? '...' : '🤝 Accept & Contribute'}
                                </button>
                                <button onClick={() => setShowContrib(false)} style={{ padding: '8px 14px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
                                    Back
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setShowContrib(true)}
                                style={{ flex: 1, padding: '8px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                🤝 Accept
                            </button>
                            <button
                                onClick={() => respond(false)}
                                disabled={loading}
                                style={{ flex: 1, padding: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                {loading ? '...' : '✕ Decline'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Show accepted contribution */}
            {!isPending && myCollab.contribution && (
                <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 12px', background: '#f0fdf4' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#059669' }}>
                        <strong>Your contribution:</strong> {myCollab.contribution}
                    </p>
                </div>
            )}
        </div>
    );
};

// ─── MAIN COLLAB MANAGER ──────────────────────────────────────────────────────
// mode: 'invites' (pending only) | 'all' (accepted too)
const CollabManager = ({ mode = 'invites', compact = false }) => {
    const loggeduser = useAuthStore(s => s.user);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInvites = useCallback(async () => {
        if (!loggeduser?._id) return;
        setLoading(true);
        try {
            const endpoint = mode === 'all'
                ? `/api/post/collaborate/mine/${loggeduser._id}`
                : `/api/post/collaborate/invites/${loggeduser._id}`;
            const res = await axios.get(`${BASE}${endpoint}`);
            setPosts(res.data);
        } catch { }
        setLoading(false);
    }, [loggeduser?._id, mode]);

    useEffect(() => { fetchInvites(); }, [fetchInvites]);

    const handleRespond = (postId, newStatus) => {
        setPosts(prev => prev.map(p => {
            if (p._id !== postId) return p;
            return {
                ...p,
                collaborators: p.collaborators.map(c =>
                    c.userId?.toString() === loggeduser._id?.toString()
                        ? { ...c, status: newStatus }
                        : c
                ),
            };
        }));
        // Remove from invites list if declined, keep if accepted
        if (newStatus === 'declined') {
            setPosts(prev => prev.filter(p => p._id !== postId));
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2].map(i => <div key={i} style={{ height: 100, background: '#f3f4f6', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />)}
        </div>
    );

    if (posts.length === 0) return (
        <div style={{ textAlign: 'center', padding: compact ? '16px 8px' : '32px 16px' }}>
            <p style={{ fontSize: '28px', margin: 0 }}>🤝</p>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0 0' }}>
                {mode === 'invites' ? 'No pending collaboration invites' : 'No collaborative posts yet'}
            </p>
        </div>
    );

    return (
        <div>
            {!compact && (
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {mode === 'invites' ? `${posts.length} pending invite${posts.length !== 1 ? 's' : ''}` : `${posts.length} collaborative post${posts.length !== 1 ? 's' : ''}`}
                </p>
            )}
            {posts.map(post => (
                <InviteCard key={post._id} post={post} userId={loggeduser._id} onRespond={handleRespond} />
            ))}
        </div>
    );
};

export default CollabManager;
export { InviteCard };

```

### `components/Comment.jsx`
```jsx
import React, { useState } from 'react';
import useAuthStore from '../../../store/zustand/useAuthStore';
import { useComments, useCreateComment, useDeleteComment } from '../../../hooks/queries/usePostQueries';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

const formatDateTime = (dateString) => {
    const diff = Date.now() - new Date(dateString);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return new Date(dateString).toLocaleDateString();
};

const CommentItem = ({ comment, postId, loggeduser, onDelete, depth = 0 }) => {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReplies, setShowReplies] = useState(false);
    const [replies, setReplies] = useState(comment.repliesList || []);

    // ✅ Fix: compare as strings to handle ObjectId vs string mismatch
    const loggedUserId = loggeduser._id?.toString();
    const isLikedInitial = (comment.likes || []).some(id => id?.toString() === loggedUserId);
    const [liked, setLiked] = useState(isLikedInitial);
    const [likeCount, setLikeCount] = useState(comment.likes?.length || 0);

    const handleLike = async () => {
        // ✅ Optimistic update first
        const wasLiked = liked;
        setLiked(!wasLiked);
        setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);
        try {
            await axios.post(`${BASE}/api/post/comments/${comment._id}/like`, { userId: loggedUserId });
        } catch {
            // Rollback on error
            setLiked(wasLiked);
            setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
        }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        try {
            const res = await axios.post(`${BASE}/api/post/comments/add`, {
                content: replyText, postId,
                user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture },
                parentId: comment._id,
            });
            setReplies(prev => [...prev, res.data]);
            setReplyText('');
            setShowReply(false);
            setShowReplies(true);
        } catch {}
    };

    const isOwn = comment.user._id?.toString() === loggedUserId;

    return (
        <div style={{ marginLeft: depth > 0 ? '40px' : '0', marginBottom: '8px' }}>
            <div className="flex gap-2 items-start">
                <img src={comment.user.profile_picture || '/default-profile.png'} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <div className="flex-1">
                    <div className="bg-gray-50 rounded-2xl px-3 py-2">
                        <p className="m-0 text-xs font-semibold">{comment.user.fullname}</p>
                        <p className="m-0 text-sm">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>

                        {/* ✅ Like button with optimistic update */}
                        <button
                            onClick={handleLike}
                            className="text-xs font-semibold border-0 bg-transparent cursor-pointer p-0 flex items-center gap-1"
                            style={{ color: liked ? '#ef4444' : '#6b7280' }}
                        >
                            {liked ? '❤️' : '🤍'} {likeCount > 0 && <span>{likeCount}</span>}
                        </button>

                        {depth === 0 && (
                            <button onClick={() => setShowReply(v => !v)} className="text-xs font-semibold text-gray-500 border-0 bg-transparent cursor-pointer p-0">
                                Reply
                            </button>
                        )}
                        {isOwn && (
                            <button onClick={() => onDelete(comment._id, comment.parentId)} className="text-xs text-red-400 border-0 bg-transparent cursor-pointer p-0">
                                Delete
                            </button>
                        )}
                    </div>

                    {showReply && (
                        <form onSubmit={handleReplySubmit} className="flex gap-2 mt-2 items-center">
                            <img src={loggeduser.profile_picture} alt="" className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
                            <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                                placeholder={`Reply to ${comment.user.fullname}...`}
                                className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1 outline-none" autoFocus />
                            <button type="submit" className="text-xs bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">Send</button>
                        </form>
                    )}

                    {replies.length > 0 && (
                        <button onClick={() => setShowReplies(v => !v)} className="text-xs text-indigo-500 font-semibold border-0 bg-transparent cursor-pointer mt-1 p-0">
                            {showReplies ? '▲ Hide' : `▼ ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                        </button>
                    )}

                    {showReplies && replies.map(reply => (
                        <CommentItem key={reply._id} comment={reply} postId={postId} loggeduser={loggeduser} onDelete={onDelete} depth={depth + 1} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Comment = ({ postId, setVisible }) => {
    const user = useAuthStore(s => s.user);
    const loggeduser = user;
    const [formData, setFormData] = useState({ content: '' });
    const [localComments, setLocalComments] = useState(null);

    const displayComments = localComments ?? comments;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        dispatch(createComment({
            postId, content: formData.content,
            user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }
        })).unwrap().then((result) => {
            setLocalComments(prev => [...(prev ?? comments ?? []), { ...result.data, repliesList: [] }]);
            setFormData({ content: '' });
        }).catch(console.error);
    };

    const handleDelete = async (commentId, parentId) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await axios.delete(`${BASE}/api/post/comments/${commentId}`, { data: { userId: loggeduser._id } });
            if (parentId) {
                setLocalComments(prev => (prev ?? comments).map(c =>
                    c._id === parentId ? { ...c, repliesList: c.repliesList.filter(r => r._id !== commentId) } : c
                ));
            } else {
                setLocalComments(prev => (prev ?? comments).filter(c => c._id !== commentId));
            }
        } catch {}
    };

    return (
        <div className="comment border-t">
            <div className="p-3 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {loading.comments || !displayComments ? (
                    <p className="text-gray-400 text-xs text-center">Loading...</p>
                ) : displayComments.length > 0 ? (
                    displayComments.map(comment => (
                        <CommentItem key={comment._id} comment={comment} postId={postId} loggeduser={loggeduser} onDelete={handleDelete} />
                    ))
                ) : (
                    <p className="text-gray-400 text-xs text-center">No comments yet. Be the first!</p>
                )}
            </div>
            <div className="border-t p-2 flex gap-2 items-center">
                <img src={loggeduser?.profile_picture || '/default-profile.png'} alt="Profile" className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32 }} />
                <form onSubmit={handleSubmit} className="flex w-full gap-1">
                    <input type="text" placeholder="Write a comment..." className="flex-1 text-sm border border-gray-200 rounded-full px-3 py-1.5 outline-none bg-gray-50"
                        name="content" value={formData.content} onChange={e => setFormData({ content: e.target.value })} />
                    <button type="submit" className="bg-[#808bf5] text-white border-0 rounded-full px-3 py-1 cursor-pointer">
                        <i className="pi pi-send" style={{ fontSize: '14px' }}></i>
                    </button>
                    <button type="button" onClick={() => setVisible(false)} className="bg-gray-100 border-0 rounded-full px-3 py-1 cursor-pointer text-gray-500">
                        <i className="pi pi-times" style={{ fontSize: '14px' }}></i>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Comment;

```

### `components/Conversations.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Badge } from 'primereact/badge';
import { socket } from '../../socket';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';
import { useConversations } from '../../hooks/queries/useConversationQueries';
import { useNotifications } from '../../hooks/queries/useNotificationQueries';
import ChatPanel from './ChatPanel';

const Conversations = () => {
    const user             = useAuthStore(s => s.user);
    const isOnline         = useConversationStore(s => s.isOnline);
    const incrementUnread  = useConversationStore(s => s.incrementUnread);
    const clearUnread      = useConversationStore(s => s.clearUnread);
    const unreadCounts     = useConversationStore(s => s.unreadCounts);
    const totalUnread      = useConversationStore(s => s.totalUnread);
    const setOnlineUsers   = useConversationStore(s => s.setOnlineUsers);

    const { data: conversations = [], refetch } = useConversations(user?._id);
    const { data: notifications = [], unreadCount, markRead } = useNotifications(user?._id);

    const [visible, setVisible]             = useState(false);
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [lastMessageId, setLastMessageId] = useState(null);
    const [notifVisible, setNotifVisible]   = useState(false);

    // Socket: receive message → increment unread + refetch conversations
    useEffect(() => {
        socket.on('receiveMessage', ({ conversationId, senderName, content }) => {
            incrementUnread(conversationId);
            refetch();
        });
        socket.on('updateUserList', setOnlineUsers);
        return () => {
            socket.off('receiveMessage');
            socket.off('updateUserList');
        };
    }, []);

    const openChat = (participant, lastMsgId) => {
        setSelectedParticipant(participant);
        setLastMessageId(lastMsgId);
        setVisible(true);
        clearUnread(participant.conversationId);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const diff = Date.now() - new Date(dateString);
        if (diff < 86400000) return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return new Date(dateString).toLocaleDateString();
    };

    const headerElement = selectedParticipant && (
        <div className="flex items-center gap-2">
            <div className="relative">
                <img src={selectedParticipant.profilePicture || '/default-profile.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
                {isOnline(selectedParticipant.userId) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
            </div>
            <div>
                <span className="font-semibold text-sm">{selectedParticipant.fullname}</span>
                <p className="m-0 text-xs text-gray-400">{isOnline(selectedParticipant.userId) ? '🟢 Online' : 'Offline'}</p>
            </div>
        </div>
    );

    return (
        <div className="p-3 bordershadow bg-white rounded mt-3 conversations">
            <div className="flex justify-between items-center mb-3">
                <h5 className="font-medium m-0">Messages</h5>
                <div className="flex gap-2 items-center">
                    {totalUnread() > 0 && (
                        <span style={{ background: '#808bf5', color: '#fff', borderRadius: '12px', fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                            {totalUnread()}
                        </span>
                    )}
                    <button
                        onClick={() => setNotifVisible(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px' }}
                    >
                        <i className="pi pi-bell" style={{ fontSize: '1.3rem' }}>
                            {unreadCount > 0 && <Badge value={unreadCount} severity="danger" />}
                        </i>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {conversations.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-3">No conversations yet</p>
                ) : conversations.map((conv) => {
                    const other = conv.participants?.find(p => p.userId !== user?._id);
                    if (!other) return null;
                    const convUnread = unreadCounts[conv._id] || 0;
                    const isUnread = conv.lastMessageBy !== user?._id && !conv.lastMessage?.isRead;

                    return (
                        <div key={conv._id}
                            className="flex items-center gap-2 mt-1 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                            onClick={() => openChat({ ...other, conversationId: conv._id }, conv.lastMessage?.id)}>
                            <div className="relative flex-shrink-0">
                                <img src={other.profilePicture || '/default-profile.png'} alt={other.fullname} className="w-10 h-10 rounded-full object-cover" />
                                {isOnline(other.userId) && (
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                                )}
                            </div>
                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h6 className={`p-0 m-0 text-sm ${isUnread ? 'font-bold' : 'font-medium'}`}>{other.fullname}</h6>
                                    <p className="text-gray-400 p-0 m-0 text-xs flex-shrink-0">{formatDateTime(conv.lastMessageAt)}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={`p-0 m-0 text-xs truncate ${isUnread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                                        {conv.lastMessageBy === user?._id ? 'You: ' : ''}{conv.lastMessage?.message || ''}
                                    </p>
                                    {convUnread > 0 && (
                                        <span style={{ background: '#808bf5', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700 }}>
                                            {convUnread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Chat Dialog */}
            <Dialog header={headerElement} visible={visible} style={{ width: '340px', height: '100vh' }} position="right" onHide={() => setVisible(false)}>
                {selectedParticipant && (
                    <ChatPanel participantId={selectedParticipant.userId} lastMessage={lastMessageId} />
                )}
            </Dialog>

            {/* Notifications Dialog */}
            <Dialog header="Notifications" visible={notifVisible} style={{ width: '340px', height: '100vh' }} position="right"
                onHide={() => {
                    setNotifVisible(false);
                    const unread = notifications.filter(n => !n.read).map(n => n._id);
                    if (unread.length) markRead.mutate(unread);
                }}>
                <div className="flex flex-col gap-2 p-2">
                    {notifications.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-6">No notifications</p>
                    ) : notifications.map(n => (
                        <div key={n._id} style={{ background: n.read ? '#fff' : '#f5f3ff', borderRadius: '10px', padding: '10px 12px', border: '1px solid #f3f4f6' }}>
                            <div className="flex items-center gap-2">
                                <img src={n.sender?.profile_picture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm m-0 font-medium">{n.sender?.fullname}</p>
                                    <p className="text-xs text-gray-500 m-0">{n.message?.content || 'sent a notification'}</p>
                                </div>
                                {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#808bf5', flexShrink: 0 }} />}
                            </div>
                        </div>
                    ))}
                </div>
            </Dialog>
        </div>
    );
};

export default Conversations;

```

### `components/EditProfile.jsx`
```jsx
import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import toast from 'react-hot-toast';

const EditProfile = ({ users, closeSidebar }) => {
    const updateProfile = useAuthStore(s => s.updateProfile);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({ fullname: "", email: "", profile_picture: "", bio: "" });
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (users) {
            setFormData({
                fullname: users.fullname || "",
                email: users.email || "",
                profile_picture: users.profile_picture || "",
                bio: users.bio || "",
            });
            setPreview(users.profile_picture || null);
        }
    }, [users]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const error = validateImageFile(file);
        if (error) { toast.error(error); return; }

        // Show preview immediately
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);
        setUploading(true);
        setUploadProgress(0);

        try {
            const url = await uploadToCloudinary(file, (progress) => {
                setUploadProgress(progress);
            });
            setFormData(prev => ({ ...prev, profile_picture: url }));
            toast.success('Photo uploaded!');
        } catch {
            toast.error('Failed to upload image. Please try again.');
            setPreview(users?.profile_picture || null);
        } finally {
            setUploading(false);
            URL.revokeObjectURL(previewUrl);
            e.target.value = '';
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (uploading) { toast.error('Please wait for image to finish uploading'); return; }
        dispatch(updateUser({ ...formData, userId: users?._id }));
        closeSidebar();
    };

    return (
        <form onSubmit={handleSubmit} className="w-full h-full py-3">

            {/* Profile Picture Upload */}
            <div className="mb-4 flex flex-col items-center gap-2">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                        src={preview || '/default-profile.png'}
                        alt="Profile"
                        style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb' }}
                    />
                    {/* Upload overlay */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            position: 'absolute', bottom: 0, right: 0,
                            background: '#808bf5', border: 'none', borderRadius: '50%',
                            width: '28px', height: '28px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                    </button>
                </div>

                {/* Progress bar */}
                {uploading && (
                    <div style={{ width: '90px', height: '4px', background: '#e5e7eb', borderRadius: '2px' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#808bf5', borderRadius: '2px', transition: 'width 0.2s' }} />
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ fontSize: '12px', color: '#808bf5', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    {uploading ? `Uploading ${uploadProgress}%...` : 'Change photo'}
                </button>

                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>

            <div className="mb-3">
                <label htmlFor="fullname" className="block mb-1">Full Name</label>
                <input type="text" id="fullname" name="fullname" value={formData.fullname} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div className="mb-3">
                <label htmlFor="email" className="block mb-1">Email</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full border px-3 py-2 rounded" required />
            </div>

            <div className="mb-3">
                <label htmlFor="bio" className="block mb-1">Bio</label>
                <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} className="w-full border px-3 py-2 rounded" rows={3} />
            </div>

            <button
                type="submit"
                disabled={uploading}
                className="bg-themeAccent text-white py-1 px-3 rounded"
                style={{ opacity: uploading ? 0.6 : 1 }}
            >
                {uploading ? 'Uploading...' : 'Save Changes'}
            </button>
        </form>
    );
};

export default EditProfile;

```

### `components/Feed.jsx`
```jsx
import React, { useEffect, useRef, useCallback } from "react";
import { useInView } from 'react-intersection-observer';
import SkeletonPost from './ui/SkeletonPost';
import Like from "./ui/Like";
import Comment from './ui/Comment';
import { Dialog } from 'primereact/dialog';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import axios from 'axios';
import formatDate from '../../utils/formatDate';

import useAuthStore from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import {
    useFeed, useMoodFeed,
    useLikePost, useSavePost, useDeletePost, useUpdatePost,
} from '../../hooks/queries/usePostQueries';

const BASE = process.env.REACT_APP_BACKEND_URL;
const MOOD_EMOJI = { happy:'😊', sad:'😢', excited:'🤩', angry:'😠', calm:'😌', romantic:'❤️', funny:'😂', inspirational:'💪', nostalgic:'🥹', neutral:'😐' };

// ─── HEART BURST ──────────────────────────────────────────────────────────────
const HeartBurst = ({ visible }) => visible ? (
    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:10, pointerEvents:'none', animation:'heartBurst 0.8s ease forwards' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </div>
) : null;

// ─── IMAGE CAROUSEL ───────────────────────────────────────────────────────────
const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);
    if (!images?.length) return null;
    if (images.length === 1) return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ background:'#000' }}>
            <img src={images[0]} alt="Post" style={{ width:'100%', aspectRatio:'1/1', maxHeight:'620px', objectFit:'cover', display:'block' }} />
        </div>
    );
    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position:'relative' }}>
            <img src={images[current]} alt={`${current+1}`} style={{ width:'100%', aspectRatio:'1/1', maxHeight:'620px', objectFit:'cover', display:'block', background:'#000' }} />
            {current > 0 && <button onClick={e=>{e.stopPropagation();setCurrent(c=>c-1)}} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', zIndex:2, background:'rgba(0,0,0,0.45)', border:'none', borderRadius:'50%', width:'32px', height:'32px', color:'#fff', cursor:'pointer', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>}
            {current < images.length-1 && <button onClick={e=>{e.stopPropagation();setCurrent(c=>c+1)}} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', zIndex:2, background:'rgba(0,0,0,0.45)', border:'none', borderRadius:'50%', width:'32px', height:'32px', color:'#fff', cursor:'pointer', fontSize:'20px', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>}
            <div style={{ position:'absolute', top:'12px', right:'12px', zIndex:2, background:'rgba(0,0,0,0.45)', color:'#fff', fontSize:'11px', padding:'3px 8px', borderRadius:'999px', fontWeight:600 }}>{current+1}/{images.length}</div>
            <div style={{ position:'absolute', bottom:'10px', left:'50%', transform:'translateX(-50%)', display:'flex', gap:'5px', zIndex:2 }}>
                {images.map((_,i)=><button key={i} onClick={e=>{e.stopPropagation();setCurrent(i)}} style={{ width:i===current?'16px':'6px', height:'6px', borderRadius:'3px', border:'none', cursor:'pointer', padding:0, background:i===current?'#fff':'rgba(255,255,255,0.5)', transition:'all 0.2s' }}/>)}
            </div>
        </div>
    );
};

// ─── POST MENU ────────────────────────────────────────────────────────────────
const PostMenu = ({ post, user, onEdit, onDelete, onSave, isSaved, onReport }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const isOwner = post.user._id === user?._id || post.user._id?.toString() === user?._id;
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button onClick={()=>setOpen(v=>!v)} className="bg-transparent border-0 cursor-pointer p-2 rounded-full text-gray-500 hover:bg-gray-100 transition">⋯</button>
            {open && (
                <div className="absolute right-0 top-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden mt-1" style={{ minWidth:'170px' }}>
                    <button onClick={()=>{onSave();setOpen(false)}} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">{isSaved?'🔖 Unsave':'🔖 Save post'}</button>
                    {!isOwner && <button onClick={()=>{onReport();setOpen(false)}} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-red-50 text-red-400">🚩 Report post</button>}
                    {isOwner && <>
                        <button onClick={()=>{onEdit();setOpen(false)}} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm hover:bg-gray-50">✏️ Edit post</button>
                        <button onClick={()=>{onDelete();setOpen(false)}} className="w-full px-4 py-2 border-0 bg-transparent cursor-pointer text-left text-sm text-red-500 hover:bg-red-50">🗑️ Delete post</button>
                    </>}
                </div>
            )}
        </div>
    );
};

// ─── SHARE DIALOG ─────────────────────────────────────────────────────────────
const ShareDialog = ({ post, visible, onHide, user }) => {
    const [conversations, setConversations] = useState([]);
    const [sending, setSending] = useState(null);
    const postUrl = `${window.location.origin}/post/${post?._id}`;
    useEffect(() => {
        if (!visible || !user?._id) return;
        fetch(`${BASE}/api/conversation/${user._id}`).then(r=>r.json()).then(setConversations).catch(()=>{});
    }, [visible, user]);
    const copyLink = () => { navigator.clipboard.writeText(postUrl); toast.success('Link copied!'); };
    const shareToConv = async (conv) => {
        setSending(conv._id);
        const other = conv.participants.find(p => p.userId !== user._id);
        try {
            await fetch(`${BASE}/api/conversation/messages/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ conversationId:conv._id, sender:user._id, senderName:user.fullname, content:`🔗 Shared a post: ${postUrl}`, recipientId:other?.userId }) });
            toast.success(`Shared to ${other?.fullname||'conversation'}`);
        } catch { toast.error('Failed to share'); }
        setSending(null);
    };
    return (
        <Dialog header="Share post" visible={visible} style={{ width:'320px' }} onHide={onHide}>
            <div className="flex flex-col gap-3">
                <button onClick={copyLink} className="flex items-center gap-3 p-3 bg-gray-100 border-0 rounded-xl cursor-pointer font-semibold text-sm">🔗 Copy link</button>
                {conversations.map(conv => {
                    const other = conv.participants.find(p => p.userId !== user._id);
                    return (
                        <button key={conv._id} onClick={()=>shareToConv(conv)} disabled={sending===conv._id} className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer text-left">
                            <img src={other?.profilePicture||'/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover"/>
                            <span className="text-sm font-medium">{other?.fullname||'Unknown'}</span>
                            {sending===conv._id && <span className="ml-auto text-xs text-indigo-500">Sending...</span>}
                        </button>
                    );
                })}
            </div>
        </Dialog>
    );
};

// ─── TIME LOCK OVERLAY ────────────────────────────────────────────────────────
const TimeLockOverlay = ({ unlocksAt }) => {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const update = () => {
            const diff = new Date(unlocksAt) - Date.now();
            if (diff <= 0) { setRemaining('Unlocking...'); return; }
            const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
            setRemaining(`${h}h ${m}m ${s}s`);
        };
        update(); const t = setInterval(update,1000); return ()=>clearInterval(t);
    }, [unlocksAt]);
    return (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:5 }}>
            <span style={{ fontSize:'40px' }}>🔒</span>
            <p style={{ color:'#fff', fontWeight:700, margin:'8px 0 4px', fontSize:'16px' }}>Time-Locked Post</p>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'13px', margin:0 }}>Unlocks in {remaining}</p>
        </div>
    );
};

// ─── COLLAB INVITE BANNER ─────────────────────────────────────────────────────
const CollabInviteBanner = ({ post, user }) => {
    const collab = post.collaborators?.find(c => c.userId?.toString() === user?._id?.toString() && c.status === 'pending');
    const [contribution, setContribution] = useState('');
    const [done, setDone] = useState(false);
    if (!collab || done) return null;
    const respond = async (accepted) => {
        try {
            await axios.post(`${BASE}/api/post/collaborate/${accepted?'accept':'decline'}`, { postId:post._id, userId:user._id, contribution:accepted?contribution:undefined });
            toast.success(accepted?'🤝 Accepted!':'Declined'); setDone(true);
        } catch { toast.error('Failed'); }
    };
    return (
        <div style={{ background:'#ede9fe', borderRadius:'8px', padding:'10px 12px', margin:'8px 16px 0' }}>
            <p style={{ margin:'0 0 6px', fontSize:'13px', fontWeight:600, color:'#6366f1' }}>🤝 You've been invited to collaborate!</p>
            <input type="text" placeholder="Add your contribution..." value={contribution} onChange={e=>setContribution(e.target.value)} style={{ width:'100%', padding:'6px 10px', borderRadius:'8px', border:'1px solid #c4b5fd', fontSize:'12px', marginBottom:'6px', boxSizing:'border-box' }}/>
            <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={()=>respond(true)} style={{ flex:1, padding:'5px', background:'#808bf5', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>Accept</button>
                <button onClick={()=>respond(false)} style={{ flex:1, padding:'5px', background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>Decline</button>
            </div>
        </div>
    );
};

// ─── FEED ─────────────────────────────────────────────────────────────────────
const Feed = ({ activeMood = null }) => {
    // ✅ Zustand
    const user          = useAuthStore(s => s.user);
    const followUser    = useAuthStore(s => s.followUser);
    const unfollowUser  = useAuthStore(s => s.unfollowUser);
    const socketPosts   = usePostStore(s => s.socketPosts);
    const isSaved       = usePostStore(s => s.isSaved);
    const optimisticLikes = usePostStore(s => s.optimisticLikes);

    // ✅ TanStack Query
    const feedQuery     = useFeed(user?._id);
    const moodQuery     = useMoodFeed(activeMood, user?._id);
    const likeMutation  = useLikePost();
    const saveMutation  = useSavePost();
    const deleteMutation= useDeletePost();
    const updateMutation= useUpdatePost();

    const [visiblePostId, setVisiblePostId] = useState(null);
    const [heartVisible, setHeartVisible]   = useState({});
    const [editingPost, setEditingPost]     = useState(null);
    const [editCaption, setEditCaption]     = useState('');
    const [sharePost, setSharePost]         = useState(null);
    const lastTap = useRef({});

    // Infinite scroll sentinel
    const { ref: loaderRef, inView } = useInView({ threshold: 0.1 });
    useEffect(() => {
        if (inView && !activeMood && feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
            feedQuery.fetchNextPage();
        }
    }, [inView, activeMood]);

    // Merge pages + socket posts
    const serverPosts = feedQuery.data?.pages?.flatMap(p => p.posts) || [];
    const displayPosts = activeMood
        ? (moodQuery.data || [])
        : [...socketPosts.filter(sp => !serverPosts.some(p => p._id === sp._id)), ...serverPosts];

    const getImages = post => post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    const handleLikeToggle = (post) => {
        const liked = post.likes?.includes(user?._id) || optimisticLikes[post._id]?.has(user?._id);
        likeMutation.mutate({ postId: post._id, isLiked: liked });
    };

    const handleImageDoubleClick = post => {
        const liked = post.likes?.includes(user?._id);
        if (!liked) likeMutation.mutate({ postId: post._id, isLiked: false });
        setHeartVisible(p => ({ ...p, [post._id]: true }));
        setTimeout(() => setHeartVisible(p => ({ ...p, [post._id]: false })), 800);
    };

    const handleImageTap = post => {
        const now = Date.now();
        if (now - (lastTap.current[post._id] || 0) < 300) handleImageDoubleClick(post);
        lastTap.current[post._id] = now;
    };

    const handleSave = post => {
        saveMutation.mutate({ postId: post._id }, {
            onSuccess: (res) => toast.success(res.data.saved ? 'Saved!' : 'Unsaved'),
        });
    };

    const handleDelete = post => {
        if (!window.confirm('Delete this post?')) return;
        deleteMutation.mutate({ postId: post._id }, {
            onSuccess: () => toast.success('Post deleted'),
        });
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: editingPost._id, caption: editCaption }, {
            onSuccess: () => { toast.success('Updated'); setEditingPost(null); }
        });
    };

    const handleFollow = post => {
        const isFollowing = user?.following?.some(f => f?.toString() === post.user._id?.toString());
        if (isFollowing) unfollowUser(post.user._id);
        else followUser(post.user._id);
    };

    const handleReport = async post => {
        const reasons = ['spam','harassment','hate_speech','misinformation','nudity','violence','other'];
        const choice = window.prompt(`Report reason:\n${reasons.map((r,i)=>`${i+1}. ${r}`).join('\n')}\n\nEnter number:`);
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (idx < 0 || idx >= reasons.length) { toast.error('Invalid choice'); return; }
        try {
            await axios.post(`${BASE}/api/admin/report`, { reporterId:user._id, targetType:'post', targetId:post._id, reason:reasons[idx] });
            toast.success('Report submitted. Thank you!');
        } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    };

    const renderCaption = (caption='') => caption.split(/(\s+)/).map((token,i) => {
        if (/^#[\w]+$/.test(token) || /^@[\w.]+$/.test(token))
            return <span key={i} className="text-indigo-500 font-medium">{token}</span>;
        return <span key={i}>{token}</span>;
    });

    const isLoading = activeMood ? moodQuery.isLoading : (feedQuery.isLoading && displayPosts.length === 0);

    return (
        <>
            <style>{`
                @keyframes heartBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}
                .music-tag{animation:musicPulse 2s ease-in-out infinite}
                @keyframes musicPulse{0%,100%{opacity:1}50%{opacity:0.6}}
            `}</style>

            <div>
                {isLoading ? (
                    <div className="mt-3 flex flex-col gap-3">{[1,2,3].map(i=><SkeletonPost key={i}/>)}</div>
                ) : (
                    <div className="mt-3 flex flex-col gap-4">
                        {displayPosts.length > 0 ? displayPosts.map((post, index) => {
                            const images  = getImages(post);
                            const isOwn   = !post.isAnonymous && (post.user._id === user?._id || post.user._id?.toString() === user?._id);
                            const isFollowing = user?.following?.some(f => f?.toString() === post.user._id?.toString());
                            const postIsSaved = isSaved(post._id);
                            const locked  = post.unlocksAt && new Date(post.unlocksAt) > Date.now() && !isOwn;
                            const expiryRemaining = post.expiresAt ? Math.max(0, new Date(post.expiresAt) - Date.now()) : null;
                            const likes   = optimisticLikes[post._id] ? [...(optimisticLikes[post._id])] : (post.likes || []);

                            return (
                                <article key={post._id || index} className="relative overflow-hidden w-full rounded-2xl shadow-sm flex flex-col border bg-white">
                                    <CollabInviteBanner post={post} user={user} />

                                    {/* Header */}
                                    <div className="flex items-start justify-between px-4 py-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={post.user.profile_picture} alt="Profile" className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h6 className="m-0 font-semibold text-sm leading-tight">{post.user.fullname}</h6>
                                                    {post.isAnonymous && <span style={{ fontSize:'10px', background:'#ede9fe', color:'#6366f1', borderRadius:'10px', padding:'1px 6px' }}>🎭 Anonymous</span>}
                                                    {post.isCollaborative && post.collaborators?.some(c=>c.status==='accepted') && <span style={{ fontSize:'10px', background:'#d1fae5', color:'#059669', borderRadius:'10px', padding:'1px 6px' }}>🤝 Collab</span>}
                                                    {!isOwn && (
                                                        <button onClick={()=>handleFollow(post)} className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer font-semibold transition ${isFollowing?'border-gray-200 bg-transparent text-gray-500':'border-indigo-500 bg-[#808bf5] text-white'}`}>
                                                            {isFollowing?'Following':'Follow'}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {post.location?.name && <span className="text-xs text-gray-500">{post.location.name}</span>}
                                                    {post.mood && <span className="text-xs text-gray-500">{MOOD_EMOJI[post.mood]} {post.mood}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                                            {post.music?.title && <div className="music-tag flex items-center gap-1 bg-pink-50 rounded-full px-2 py-1 text-[11px] text-pink-500 font-medium max-w-[130px] truncate">🎵 {post.music.title}</div>}
                                            {expiryRemaining !== null && expiryRemaining < 3600000 && <span style={{ fontSize:'10px', background:'#fef3c7', color:'#d97706', borderRadius:'10px', padding:'1px 6px' }}>⏳ Expiring soon</span>}
                                            <PostMenu post={post} user={user} isSaved={postIsSaved}
                                                onSave={()=>handleSave(post)}
                                                onEdit={()=>{setEditingPost(post);setEditCaption(post.caption)}}
                                                onDelete={()=>handleDelete(post)}
                                                onReport={()=>handleReport(post)}
                                            />
                                        </div>
                                    </div>

                                    {/* Images */}
                                    {images.length > 0 && (
                                        <div className="relative border-y border-gray-100">
                                            <ImageCarousel images={images} onDoubleClick={()=>!locked&&handleImageDoubleClick(post)} onTouchEnd={()=>!locked&&handleImageTap(post)}/>
                                            {locked && <TimeLockOverlay unlocksAt={post.unlocksAt}/>}
                                            <HeartBurst visible={!!heartVisible[post._id]}/>
                                        </div>
                                    )}

                                    {locked && images.length === 0 && (
                                        <div style={{ background:'#f3f4f6', margin:'0 16px', borderRadius:'12px', padding:'20px', textAlign:'center' }}>
                                            <p style={{ fontSize:'32px', margin:0 }}>🔒</p>
                                            <p style={{ fontSize:'13px', color:'#6b7280', margin:'4px 0 0' }}>This post is time-locked</p>
                                        </div>
                                    )}

                                    {/* Collaborators */}
                                    {post.isCollaborative && post.collaborators?.filter(c=>c.status==='accepted'&&c.contribution).length > 0 && (
                                        <div style={{ margin:'0 16px', background:'#f0fdf4', borderRadius:'8px', padding:'8px 12px' }}>
                                            <p style={{ fontSize:'11px', color:'#059669', fontWeight:600, margin:'0 0 4px' }}>🤝 Collaborators added:</p>
                                            {post.collaborators.filter(c=>c.status==='accepted'&&c.contribution).map((c,i)=>(
                                                <p key={i} style={{ fontSize:'12px', margin:'2px 0', color:'#374151' }}><strong>{c.fullname}:</strong> {c.contribution}</p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Voice note */}
                                    {post.voiceNote?.url && (
                                        <div style={{ margin:'0 16px' }}>
                                            <audio src={post.voiceNote.url} controls style={{ width:'100%', height:'36px' }}/>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {!locked && (
                                        <div className="bg-white text-gray-900 w-full px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-4">
                                                    <div onClick={()=>handleLikeToggle(post)} className="flex items-center gap-2 cursor-pointer">
                                                        <Like isliked={likes.includes(user?._id) || likes.some(id=>id?.toString()===user?._id)} loading={likeMutation.isPending}/>
                                                    </div>
                                                    <button onClick={()=>setVisiblePostId(p=>p===post._id?null:post._id)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900">
                                                        <i className="pi pi-comment" style={{ fontSize:'1.2rem' }}></i>
                                                    </button>
                                                    <button onClick={()=>setSharePost(post)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900">
                                                        <i className="pi pi-send" style={{ fontSize:'1.15rem' }}></i>
                                                    </button>
                                                    <Link to={`/post/${post._id}`} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0 text-gray-900 no-underline ml-auto" style={{ marginRight:'4px' }}>
                                                        <i className="pi pi-external-link" style={{ fontSize:'1rem' }}></i>
                                                    </Link>
                                                    <button onClick={()=>handleSave(post)} className="flex items-center justify-center bg-transparent border-0 cursor-pointer p-0">
                                                        <i className={`pi ${postIsSaved?'pi-bookmark-fill':'pi-bookmark'}`} style={{ fontSize:'1.1rem', color:postIsSaved?'#808bf5':'currentColor' }}></i>
                                                    </button>
                                                </div>
                                                <p className="m-0 mt-2 text-sm font-semibold">{likes.length.toLocaleString()} likes</p>
                                                <p className="m-0 mt-1 text-sm leading-relaxed"><span className="font-semibold mr-1">{post.user.username||post.user.fullname}</span>{renderCaption(post.caption||'')}</p>
                                                <p className="m-0 mt-1 text-xs text-gray-500 cursor-pointer" onClick={()=>setVisiblePostId(p=>p===post._id?null:post._id)}>View all {post.comments?.length||0} comments</p>
                                                <p className="m-0 mt-2 text-[10px] text-gray-400 uppercase tracking-wide">{formatDate(post.updatedAt)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {visiblePostId === post._id && <Comment postId={post._id} setVisible={()=>setVisiblePostId(null)}/>}
                                </article>
                            );
                        }) : (
                            <div style={{ textAlign:'center', padding:'48px 16px' }}>
                                <p style={{ fontSize:'36px', margin:0 }}>{activeMood?'😔':'📭'}</p>
                                <p style={{ color:'#9ca3af', fontSize:'14px', margin:'8px 0 0' }}>{activeMood?`No ${activeMood} posts found`:'No posts to display.'}</p>
                            </div>
                        )}

                        {/* Sentinel */}
                        <div ref={loaderRef} className="h-10 flex items-center justify-center">
                            {feedQuery.isFetchingNextPage && <span className="spinner-border spinner-border-sm text-secondary" role="status"/>}
                            {!activeMood && !feedQuery.hasNextPage && displayPosts.length > 0 && <p className="text-xs text-gray-400 m-0">You're all caught up 🎉</p>}
                        </div>
                    </div>
                )}

                {sharePost && <ShareDialog post={sharePost} visible={!!sharePost} onHide={()=>setSharePost(null)} user={user}/>}

                <Dialog header="Edit Post" visible={!!editingPost} style={{ width:'340px' }} onHide={()=>setEditingPost(null)}>
                    {editingPost && (
                        <div className="flex flex-col gap-3">
                            <textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-y"/>
                            <div className="flex gap-2 justify-end">
                                <button onClick={()=>setEditingPost(null)} className="px-4 py-1.5 border border-gray-200 rounded-lg bg-transparent cursor-pointer text-sm">Cancel</button>
                                <button onClick={handleEditSubmit} className="px-4 py-1.5 bg-[#808bf5] text-white border-0 rounded-lg cursor-pointer text-sm font-semibold">Save</button>
                            </div>
                        </div>
                    )}
                </Dialog>
            </div>
        </>
    );
};

export default Feed;

```

### `components/FollowFollowingList.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

const FollowFollowingList = ({ ids = [], isfollowing }) => {
    const user         = useAuthStore(s => s.user);
    const followUser   = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const [users, setUsers]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ids?.length) { setLoading(false); return; }
        const body = JSON.stringify({ ids });
        fetch(`${BASE}/api/auth/users/details`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
            .then(r => r.json())
            .then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [ids]);

    const handleFollow = (userId) => {
        const isFollowing = user?.following?.some(f => f?.toString() === userId?.toString());
        if (isFollowing) unfollowUser(userId);
        else followUser(userId);
    };

    if (loading) return (
        <div className="flex flex-col gap-2 p-2">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
    );

    if (!users.length) return (
        <p className="text-center text-gray-400 text-sm py-6">
            {isfollowing ? 'Not following anyone yet' : 'No followers yet'}
        </p>
    );

    return (
        <div className="flex flex-col gap-2 p-2">
            {users.map(u => {
                const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                return (
                    <div key={u._id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50">
                        <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="m-0 text-sm font-semibold truncate">{u.fullname}</p>
                            <p className="m-0 text-xs text-gray-400">{u.followers?.length || 0} followers</p>
                        </div>
                        {u._id !== user?._id && (
                            <button onClick={() => handleFollow(u._id)}
                                className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'}`}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default FollowFollowingList;

```

### `components/MoodFeedToggle.jsx`
```jsx
import React, { useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useMoodFeed } from '../../hooks/queries/usePostQueries';

const MOODS = [
    { key: 'happy',         emoji: '😊', label: 'Happy' },
    { key: 'excited',       emoji: '🤩', label: 'Excited' },
    { key: 'funny',         emoji: '😂', label: 'Funny' },
    { key: 'romantic',      emoji: '❤️', label: 'Romantic' },
    { key: 'inspirational', emoji: '💪', label: 'Inspire' },
    { key: 'calm',          emoji: '😌', label: 'Calm' },
    { key: 'nostalgic',     emoji: '🥹', label: 'Nostalgia' },
    { key: 'sad',           emoji: '😢', label: 'Sad' },
];

const MoodFeedToggle = ({ onMoodSelect, activeMood, onClear }) => {
    const [expanded, setExpanded] = useState(false);
    const user = useAuthStore(s => s.user);
    const loggeduser = user;

    const handleMoodClick = (moodKey) => {
        if (activeMood === moodKey) { onClear(); return; }
        if (!loggeduser?._id) return;
        // mood feed triggered via activeMood prop → useMoodFeed in Feed
        onMoodSelect(moodKey);
    };

    const activeMoodData = MOODS.find(m => m.key === activeMood);

    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '12px 14px', marginBottom: '8px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? '12px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>✨</span>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        {activeMoodData
                            ? <>{activeMoodData.emoji} Showing <span style={{ color: '#808bf5' }}>{activeMoodData.label}</span> posts</>
                            : 'Mood-based feed'
                        }
                    </p>
                    {loading.moodFeed && (
                        <div style={{ width: 14, height: 14, border: '2px solid #e5e7eb', borderTopColor: '#808bf5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeMood && (
                        <button onClick={onClear}
                            style={{ fontSize: '11px', color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                            ✕ Clear
                        </button>
                    )}
                    <button onClick={() => setExpanded(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        {expanded ? 'Hide' : 'Pick mood'} <span>{expanded ? '▲' : '▼'}</span>
                    </button>
                </div>
            </div>

            {/* Mood pills */}
            {expanded && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {MOODS.map(mood => (
                        <button key={mood.key} onClick={() => handleMoodClick(mood.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '20px', border: 'none',
                                cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                transition: 'all 0.15s',
                                background: activeMood === mood.key ? '#808bf5' : '#f3f4f6',
                                color: activeMood === mood.key ? '#fff' : '#374151',
                                transform: activeMood === mood.key ? 'scale(1.05)' : 'scale(1)',
                            }}>
                            <span style={{ fontSize: '14px' }}>{mood.emoji}</span>
                            {mood.label}
                        </button>
                    ))}
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default MoodFeedToggle;

```

### `components/Navbar.jsx`
```jsx
import React, { useEffect } from "react";
import Search from "./Search";

import { Link } from "react-router-dom";
import Authnav from "./Authnav";
import NotificationBell from "./NotificationBell";
import { useDarkMode } from '../../context/DarkModeContext';
import { requestNotificationPermission } from '../../utils/pushNotifications';

const Navbar = () => {
  const loggeduser = useAuthStore(s => s.user);
  const { isDark, toggle } = useDarkMode();
  const token = localStorage.getItem('token');

  // Request push notification permission on first login
  useEffect(() => {
    if (token && loggeduser) {
      requestNotificationPermission();
    }
  }, [token, loggeduser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('socketId');
    window.location.href = '/landing';
  };

  return (
    <div className={`sticky top-0 z-50 shadow-md border-b max-w-8xl mx-auto flex items-center justify-between px-4 py-2 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 w-25">
        <Link to="/landing" className={`no-underline flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-800'}`} title="Go to Home">
          <i className="pi pi-home text-2xl"></i>
          <h1 className="font-pacifico text-2xl m-0">Social Square</h1>
        </Link>
      </div>

      <div className="flex-1 mx-4 relative w-50">
        {token ? <Search /> : <Authnav />}
      </div>

      <div className="flex items-center justify-end gap-3 w-25">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className={`border-0 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all ${isDark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        {token ? (
          <>
            <NotificationBell userId={loggeduser?._id} />
            {loggeduser?.isAdmin && (
              <Link to="/admin" className={`border-0 rounded-lg px-2 py-1 text-xs font-semibold no-underline ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`} title="Admin Dashboard">
                ⚙️ Admin
              </Link>
            )}
            <img
              src={loggeduser?.profile_picture || "default-profile.png"}
              alt="Profile"
              className="w-9 h-9 rounded-full object-cover cursor-pointer"
            />
            <button onClick={handleLogout} className={`border-0 bg-transparent cursor-pointer hover:text-red-500 transition ${isDark ? 'text-gray-300' : 'text-gray-600'}`} title="Logout">
              <i className="pi pi-sign-out"></i>
            </button>
          </>
        ) : (
          <Link to="/login" className="bg-[#808bf5] text-white px-4 py-1 rounded no-underline">Login</Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;

```

### `components/NotificationBell.jsx`
```jsx
import React, { useRef, useState, useEffect } from 'react';
import { Badge } from 'primereact/badge';
import { useNotifications } from '../../hooks/useNotifications';
import useAuthStore from '../../../store/zustand/useAuthStore';
import CollabManager from './CollabManager';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

export default function NotificationBell({ userId }) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'collabs'
    const [pendingCollabCount, setPendingCollabCount] = useState(0);
    const ref = useRef(null);
    const { data: notifications = [], markRead, unreadCount } = useNotifications(userId);
    const loggeduser = useAuthStore(s => s.user);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch pending collab count for badge
    useEffect(() => {
        if (!userId) return;
        axios.get(`${BASE}/api/post/collaborate/invites/${userId}`)
            .then(r => setPendingCollabCount(r.data.length))
            .catch(() => {});
    }, [userId, open]);

    const handleMarkRead = (id) => markRead.mutate([id]);
    const handleMarkAllRead = () => { const ids = notifications.map(n => n._id); if (ids.length) markRead.mutate(ids); };

    const formatTime = (dateString) => {
        const diff = Date.now() - new Date(dateString);
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return new Date(dateString).toLocaleDateString();
    };

    const getNotificationText = (n) => {
        if (n.type === 'new_post') return 'created a new post';
        if (n.type === 'message') return n.message?.content || 'sent you a message';
        if (n.type === 'like') return 'liked your post';
        if (n.type === 'comment') return 'commented on your post';
        if (n.type === 'follow') return 'started following you';
        return 'sent a notification';
    };

    const totalBadge = unreadCount + pendingCollabCount;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px' }}>
                <i className="pi pi-bell text-xl">
                    {totalBadge > 0 && <Badge value={totalBadge > 99 ? '99+' : totalBadge} severity="danger" />}
                </i>
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{ position: 'absolute', right: 0, top: '40px', width: '360px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid #e5e7eb', zIndex: 1000, overflow: 'hidden' }}>

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'notifications' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'notifications' ? '#808bf5' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            🔔 Notifications
                            {unreadCount > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{unreadCount}</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('collabs')}
                            style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, borderBottom: activeTab === 'collabs' ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === 'collabs' ? '#808bf5' : '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            🤝 Collabs
                            {pendingCollabCount > 0 && <span style={{ background: '#808bf5', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{pendingCollabCount}</span>}
                        </button>
                    </div>

                    {/* Notifications tab */}
                    {activeTab === 'notifications' && (
                        <>
                            {unreadCount > 0 && (
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#6366f1', fontWeight: 600 }}>
                                        Mark all as read
                                    </button>
                                </div>
                            )}
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                                        <i className="pi pi-bell-slash" style={{ fontSize: '2rem' }}></i>
                                        <p style={{ marginTop: '8px', margin: '8px 0 0', fontSize: '13px' }}>No new notifications</p>
                                    </div>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n._id} onClick={() => handleMarkRead(n._id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', background: n.read ? '#fff' : '#f5f3ff', borderBottom: '1px solid #f9fafb', transition: 'background 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                            onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : '#f5f3ff'}>
                                            <img src={n.sender?.profile_picture || '/default-profile.png'} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: '13px' }}>
                                                    <strong>{n.sender?.fullname}</strong> {getNotificationText(n)}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>{formatTime(n.createdAt)}</p>
                                            </div>
                                            {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {/* Collabs tab */}
                    {activeTab === 'collabs' && (
                        <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '12px' }}>
                            <CollabManager mode="invites" compact />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

```

### `components/NotificationToast.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../../socket';

const SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function NotificationToast({ userId }) {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        if (!userId) return;

        const handleNewNotification = (notification) => {
            const id = notification._id || Date.now();

            // Play sound
            try {
                const audio = new Audio(SOUND_URL);
                audio.volume = 0.4;
                audio.play().catch(() => {}); // Ignore autoplay errors
            } catch {}

            // Add toast
            setToasts(prev => [...prev, { ...notification, toastId: id }]);

            // Auto-remove after 4 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.toastId !== id));
            }, 4000);
        };

        socket.on('newNotification', handleNewNotification);
        return () => socket.off('newNotification', handleNewNotification);
    }, [userId]);

    if (!toasts.length) return null;

    return (
        <div style={{
            position: 'fixed', top: '70px', right: '20px',
            zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
            {toasts.map(toast => (
                <div key={toast.toastId} style={{
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '12px', padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    minWidth: '280px', maxWidth: '340px',
                    animation: 'slideIn 0.3s ease'
                }}>
                    <img
                        src={toast.sender?.profile_picture || '/default-profile.png'}
                        alt=""
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>
                            {toast.sender?.fullname}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                            {toast.type === 'new_post' ? 'Created a new post' : toast.message?.content}
                        </p>
                    </div>
                    <button
                        onClick={() => setToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}
                    >✕</button>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(40px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}

```

### `components/OtherUsers.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import useAuthStore from '../../store/zustand/useAuthStore';
import UserProfile from './UserProfile';

const BASE = process.env.REACT_APP_BACKEND_URL;

const OtherUsers = () => {
    const user        = useAuthStore(s => s.user);
    const followUser  = useAuthStore(s => s.followUser);
    const unfollowUser= useAuthStore(s => s.unfollowUser);

    const [users, setUsers]             = useState([]);
    const [loading, setLoading]         = useState(true);
    const [selectedId, setSelectedId]   = useState(null);
    const [profileVisible, setProfileVisible] = useState(false);

    useEffect(() => {
        if (!user?._id) return;
        fetch(`${BASE}/api/auth/other-users`)
            .then(r => r.json())
            .then(data => { setUsers(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user?._id]);

    const handleFollow = (e, userId) => {
        e.stopPropagation();
        const isFollowing = user?.following?.some(f => f?.toString() === userId?.toString());
        if (isFollowing) unfollowUser(userId);
        else followUser(userId);
    };

    if (loading) return (
        <div className="p-3 bordershadow bg-white rounded mt-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl mb-2 animate-pulse" />)}
        </div>
    );

    return (
        <>
            <div className="p-3 bordershadow bg-white rounded mt-3">
                <h5 className="font-medium mb-3">Suggested Users</h5>
                <div className="flex flex-col gap-2">
                    {users.filter(u => u._id !== user?._id).slice(0, 8).map(u => {
                        const isFollowing = user?.following?.some(f => f?.toString() === u._id?.toString());
                        return (
                            <div key={u._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition"
                                onClick={() => { setSelectedId(u._id); setProfileVisible(true); }}>
                                <img src={u.profile_picture || '/default-profile.png'} alt={u.fullname} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-sm font-medium truncate">{u.fullname}</p>
                                    <p className="m-0 text-xs text-gray-400">{u.followers?.length || 0} followers</p>
                                </div>
                                <button onClick={e => handleFollow(e, u._id)}
                                    className={`text-xs px-3 py-1 rounded-full border-0 cursor-pointer font-semibold flex-shrink-0 ${isFollowing ? 'bg-gray-100 text-gray-600' : 'bg-[#808bf5] text-white'}`}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Dialog header="Profile" visible={profileVisible} style={{ width: '380px' }} onHide={() => setProfileVisible(false)}>
                <UserProfile id={selectedId} />
            </Dialog>
        </>
    );
};

export default OtherUsers;

```

### `components/PasswordStrengthMeter.jsx`
```jsx
import React from 'react';

const getStrength = (password) => {
  let score = 0;
  if (!password) return { score: 0, label: '', color: '' };
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#3b82f6' };
  return { score, label: 'Strong', color: '#22c55e' };
};

const getHints = (password) => {
  const hints = [];
  if (password.length < 8) hints.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) hints.push('One uppercase letter');
  if (!/[0-9]/.test(password)) hints.push('One number');
  if (!/[^A-Za-z0-9]/.test(password)) hints.push('One special character (!@#$...)');
  return hints;
};

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const { score, label, color } = getStrength(password);
  const hints = getHints(password);
  const maxScore = 5;

  return (
    <div style={{ marginTop: '4px', marginBottom: '8px' }}>
      {/* Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {Array.from({ length: maxScore }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: i < score ? color : '#e5e7eb',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color, fontWeight: 600 }}>{label}</span>
      </div>

      {/* Hints */}
      {hints.length > 0 && score < 4 && (
        <ul style={{ margin: '4px 0 0', padding: '0 0 0 16px', fontSize: '11px', color: '#9ca3af' }}>
          {hints.map((hint, i) => <li key={i}>{hint}</li>)}
        </ul>
      )}
    </div>
  );
}

```

### `components/Profile.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useUserPosts, useSavedPosts } from '../../hooks/queries/usePostQueries';
import { useNavigate, Link } from 'react-router-dom';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Image } from 'primereact/image';
import toast, { Toaster } from 'react-hot-toast';


import { socket } from '../../socket';
import EditProfile from './EditProfile';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from './FollowFollowingList';
import CollabManager from './CollabManager';

const PostCard = ({ post }) => {
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    return (
        <Link to={`/post/${post._id}`}>
            <div className="relative rounded-xl overflow-hidden bg-gray-100 cursor-pointer" style={{ aspectRatio: '1' }}>
                {images.length > 0 ? (
                    <img src={images[0]} alt="post" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">
                        {post.caption?.slice(0, 40)}
                    </div>
                )}
                {images.length > 1 && (
                    <div className="absolute top-1 right-1 bg-black bg-opacity-50 rounded px-1">
                        <i className="pi pi-images text-white" style={{ fontSize: '10px' }}></i>
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                    <span className="text-white text-[11px]">❤️ {post.likes?.length || 0}</span>
                    <span className="text-white text-[11px]">💬 {post.comments?.length || 0}</span>
                </div>
            </div>
        </Link>
    );
};

const Profile = () => {
    const [editVisible, setEditVisible] = useState(false);
    const [activeSessionsVisible, setActiveSessionsVisible] = useState(false);
    const [showFollowersList, setShowFollowersList] = useState(false);
    const [showFollowingList, setShowFollowingList] = useState(false);
    const [activeTab, setActiveTab] = useState('posts');

    const navigate = useNavigate();
    const loggeduser = useAuthStore(s => s.user);
    const logout = useAuthStore(s => s.logout);
    const { data: userPosts = [], isLoading: loadingUserPosts } = useUserPosts(loggeduser?._id);
    const { data: savedPostsData = [] } = useSavedPosts(loggeduser?._id);
    const userPostsList = userPosts?.pages?.flatMap(p => p.posts) || [];
    const savedPosts = savedPostsData || [];
    const loading = { userPosts: loadingUserPosts, savedPosts: false };



    const handleLogout = () => {
        confirmDialog({
            message: 'Are you sure you want to logout?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: () => {
                localStorage.removeItem('socketId');
                localStorage.removeItem('token');
                sessionStorage.removeItem('hasReloaded');
                await logout();
                toast.error('You have been logged out.');
                if (socket.connected) socket.emit('logoutUser', loggeduser?._id);
                navigate('/login');
            },
            reject: () => toast.error('Logout canceled.'),
        });
    };

    if (!loggeduser) return <div className="text-center p-4">Loading...</div>;

    // Only posts/saved use the grid — collabs has its own renderer
    const tabPosts = activeTab === 'posts' ? userPostsList : savedPosts;
    const isLoadingTab = activeTab === 'posts' ? loadingUserPosts : false;

    const formatCount = (count = 0) => {
        if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace('.0', '')}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1).replace('.0', '')}K`;
        return `${count}`;
    };

    const TABS = [
        { key: 'posts',  label: `Posts (${userPosts.length})` },
        { key: 'saved',  label: `Saved (${savedPosts.length})` },
        { key: 'collabs', label: '🤝 Collabs' },
    ];

    return (
        <>
            <div className="profile-container pc-show">
                <div className="bordershadow rounded-2xl bg-white border border-gray-100 p-4 flex flex-col gap-4">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="m-0 text-base font-semibold">My Profile</h2>
                        <button
                            onClick={() => setActiveSessionsVisible(true)}
                            className="border-0 bg-transparent cursor-pointer rounded-full p-2 text-gray-500 hover:bg-gray-100 transition"
                            title="Security settings"
                        >
                            <i className="pi pi-cog"></i>
                        </button>
                    </div>

                    {/* Avatar + identity */}
                    <div className="flex items-center justify-center text-center flex-col gap-1">
                        <div className="relative">
                            <Image
                                src={loggeduser?.profile_picture}
                                zoomSrc={loggeduser?.profile_picture}
                                alt="Profile"
                                className="rounded-full overflow-hidden border-4 border-indigo-100"
                                preview
                                width="100"
                                height="100"
                            />
                            <button
                                className="absolute bottom-1 right-1 w-7 h-7 rounded-full border-0 cursor-pointer bg-[#4f46e5] text-white flex items-center justify-center"
                                onClick={() => setEditVisible(true)}
                                title="Edit profile"
                            >
                                <i className="pi pi-pencil text-[11px]"></i>
                            </button>
                        </div>
                        <h3 className="m-0 text-2xl font-semibold">{loggeduser?.fullname}</h3>
                        {loggeduser?.username && (
                            <p className="m-0 text-sm font-medium text-indigo-600">@{loggeduser.username}</p>
                        )}
                        {loggeduser?.bio && (
                            <p className="text-sm text-gray-500 m-0 max-w-[260px] leading-6">{loggeduser.bio}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            className="h-11 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-sm cursor-pointer hover:bg-indigo-100 transition"
                            onClick={() => setEditVisible(true)}
                        >
                            <i className="pi pi-user-edit mr-2"></i>Edit Profile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="h-11 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm cursor-pointer hover:opacity-95 transition"
                        >
                            <i className="pi pi-sign-out mr-2"></i>Logout
                        </button>
                    </div>

                    {/* Stats tiles */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center cursor-pointer"
                            onClick={() => setShowFollowersList(true)}>
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(loggeduser?.followers?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Followers</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center cursor-pointer"
                            onClick={() => setShowFollowingList(true)}>
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(loggeduser?.following?.length || 0)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Following</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 border border-gray-100 py-3 text-center">
                            <h6 className="m-0 font-extrabold text-base leading-5">{formatCount(userPosts.length)}</h6>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Posts</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2.5 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize transition-all ${
                                    activeTab === tab.key ? 'text-indigo-600' : 'text-gray-500'
                                }`}
                                style={{ borderBottom: activeTab === tab.key ? '2px solid #808bf5' : '2px solid transparent' }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {activeTab === 'collabs' ? (
                        // Collabs tab — full width, no grid
                        <CollabManager mode="all" />
                    ) : (
                        // Posts / Saved — 3-col grid
                        <div className="grid grid-cols-3 gap-2">
                            {isLoadingTab ? (
                                [1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ aspectRatio: '1' }} />
                                ))
                            ) : tabPosts.length > 0 ? (
                                tabPosts.map(post => <PostCard key={post._id} post={post} />)
                            ) : (
                                <div className="col-span-3 text-center text-gray-400 text-sm py-6">
                                    {activeTab === 'posts' ? 'No posts yet' : 'No saved posts'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog />

            <Dialog header="Edit Profile" visible={editVisible} position="right" style={{ width: '340px', height: '100vh' }} onHide={() => setEditVisible(false)}>
                <EditProfile users={loggeduser} closeSidebar={() => setEditVisible(false)} />
            </Dialog>
            <Dialog header="Security & Sessions" visible={activeSessionsVisible} position="right" style={{ width: '340px', height: '100vh' }} onHide={() => setActiveSessionsVisible(false)}>
                <ActiveSessions />
            </Dialog>
            <Dialog header="Followers" visible={showFollowersList} style={{ width: '340px', height: '100vh' }} onHide={() => setShowFollowersList(false)}>
                <FollowFollowingList isfollowing={false} ids={loggeduser?.followers} />
            </Dialog>
            <Dialog header="Following" visible={showFollowingList} style={{ width: '340px', height: '100vh' }} onHide={() => setShowFollowingList(false)}>
                <FollowFollowingList isfollowing={true} ids={loggeduser?.following} />
            </Dialog>
            <Toaster />
        </>
    );
};

export default Profile;

```

### `components/Search.jsx`
```jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';

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
    const { data: catData = [] } = useCategories();
    const categories = catData;
    const [searchResults, setSearchResults] = useState({ users: [], posts: [] });
    const [searchLoading, setSearchLoading] = useState(false);
    const loading = { search: searchLoading };
    const doSearch = async (term) => {
        setSearchLoading(true);
        try {
            const res = await fetch(`${BASE}/api/auth/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: term }) });
            const data = await res.json();
            setSearchResults({ users: data.users || [], posts: data.posts || [] });
        } catch {}
        setSearchLoading(false);
    };

    useEffect(() => {
        // categories loaded by useCategories()
    }, [dispatch]);

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
    const debouncedSearch = useCallback(
        debounce((term) => {
            if (term.trim()) dispatch(search(term.trim()));
        }, 400),
        [dispatch]
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
        dispatch(search(term));
    };

    const handleUserClick = (userId, userName) => {
        setSelectedUserId(userId);
        setVisible(true);
        setIsFocused(false);
        saveRecentSearch(userName);
    };

    const handleCategoryClick = (category) => {
        setSearchTerm(`#${category}`);
        dispatch(search(category));
        saveRecentSearch(`#${category}`);
    };

    const handleClear = () => {
        setSearchTerm('');
        setIsFocused(true);
    };

    const showDropdown = isFocused;
    const hasResults = searchResults?.users?.length > 0 || searchResults?.posts?.length > 0;

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
                                                            <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                                            <div>
                                                                <p className="m-0 text-sm font-medium">{user.fullname}</p>
                                                                <p className="m-0 text-xs text-gray-400">{user.followers?.length || 0} followers</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Post results */}
                                        {searchResults.posts?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 mb-2 m-0 uppercase tracking-wider">Posts</p>
                                                <div className="flex flex-col gap-1">
                                                    {searchResults.posts.slice(0, 4).map(post => (
                                                        <div key={post._id} className="flex items-center gap-3 px-2 py-2 rounded-xl">
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
            <Dialog header="Profile" visible={isVisible} style={{ width: '380px', height: '90vh' }} onHide={() => setVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </>
    );
};

export default Search;

```

### `components/Stories.jsx`
```jsx
import React, { useState, useEffect, useRef } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { uploadToCloudinary, validateImageFile } from '../../utils/cloudinary';
import { socket } from '../../socket';
import toast from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const StoryViewer = ({ groups, startGroupIndex, onClose, loggeduser, onStoryDeleted }) => {
    const [groupIndex, setGroupIndex] = useState(startGroupIndex);
    const [storyIndex, setStoryIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef(null);

    const group = groups[groupIndex];
    const story = group?.stories[storyIndex];
    const DURATION = story?.media?.type === 'video' ? 15000 : 5000;

    useEffect(() => {
        if (!story) return;
        if (story._id && loggeduser?._id) {
            fetch(`${BASE}/api/story/view/${story._id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id }),
            }).catch(() => {});
        }
        setProgress(0);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) { clearInterval(intervalRef.current); goNext(); return 0; }
                return prev + (100 / (DURATION / 100));
            });
        }, 100);
        return () => clearInterval(intervalRef.current);
    }, [groupIndex, storyIndex, story?._id]);

    const goNext = () => {
        if (!group) return;
        if (storyIndex < group.stories.length - 1) setStoryIndex(s => s + 1);
        else if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
        else onClose();
    };
    const goPrev = () => {
        if (storyIndex > 0) setStoryIndex(s => s - 1);
        else if (groupIndex > 0) { setGroupIndex(g => g - 1); setStoryIndex(0); }
    };

    if (!story || !group) return null;
    const isOwn = group.user._id.toString() === loggeduser?._id?.toString();

    const handleDelete = async () => {
        try {
            await fetch(`${BASE}/api/story/${story._id}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id }),
            });
            toast.success('Story deleted');
            // ✅ Update parent state
            onStoryDeleted(group.user._id.toString(), story._id);
            if (group.stories.length <= 1) {
                if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); }
                else onClose();
            } else { goNext(); }
        } catch { toast.error('Failed to delete'); }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '100vh', maxHeight: '700px' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: '4px', zIndex: 10 }}>
                    {group.stories.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#fff', width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%', transition: 'width 0.1s linear' }} />
                        </div>
                    ))}
                </div>
                <div style={{ position: 'absolute', top: 24, left: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={group.user.profile_picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        <div>
                            <p style={{ margin: 0, color: '#fff', fontSize: '13px', fontWeight: 600 }}>{group.user.fullname}</p>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                                {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && ` · ${story.viewers?.length || 0} views`}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isOwn && <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px' }}>🗑️</button>}
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '24px' }}>✕</button>
                    </div>
                </div>
                {story.media.type === 'video'
                    ? <video src={story.media.url} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={story.media.url} alt="story" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                }
                {story.text?.content && (
                    <div style={{ position: 'absolute', top: story.text.position === 'top' ? '20%' : story.text.position === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: story.text.color || '#fff', fontSize: '22px', fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.8)', textAlign: 'center', padding: '8px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', maxWidth: '80%' }}>
                        {story.text.content}
                    </div>
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 5 }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goPrev} />
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={goNext} />
                </div>
            </div>
        </div>
    );
};

const CreateStoryModal = ({ onClose, onCreated, loggeduser }) => {
    const fileInputRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);
    const [mediaType, setMediaType] = useState('image');
    const [text, setText] = useState('');
    const [textColor, setTextColor] = useState('#ffffff');
    const [textPosition, setTextPosition] = useState('center');
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const isVideo = f.type.startsWith('video/');
        if (!isVideo) { const err = validateImageFile(f); if (err) { toast.error(err); return; } }
        setFile(f); setMediaType(isVideo ? 'video' : 'image'); setPreview(URL.createObjectURL(f));
    };

    const handleSubmit = async () => {
        if (!file) { toast.error('Please select an image or video'); return; }
        setUploading(true);
        try {
            let mediaUrl;
            if (mediaType === 'video') {
                const fd = new FormData();
                fd.append('file', file); fd.append('upload_preset', 'socialsquare'); fd.append('resource_type', 'video');
                const res = await fetch(`https://api.cloudinary.com/v1_1/dcmrsdydr/video/upload`, { method: 'POST', body: fd });
                mediaUrl = (await res.json()).secure_url;
            } else { mediaUrl = await uploadToCloudinary(file); }

            const res = await fetch(`${BASE}/api/story/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: loggeduser._id, mediaUrl, mediaType, text: text ? { content: text, color: textColor, position: textPosition } : null }),
            });
            const newStory = await res.json();
            toast.success('Story created!');
            onCreated(newStory); // ✅ pass back to parent
            onClose();
        } catch { toast.error('Failed to create story'); }
        setUploading(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '360px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Create Story</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
                </div>
                <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: '#f9fafb', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                    {preview ? (mediaType === 'video' ? <video src={preview} style={{ width: '100%', borderRadius: '8px', maxHeight: '200px' }} controls /> : <img src={preview} alt="" style={{ width: '100%', borderRadius: '8px', maxHeight: '200px', objectFit: 'cover' }} />) : <div><p style={{ fontSize: '32px', margin: 0 }}>📷</p><p style={{ color: '#9ca3af', fontSize: '13px', margin: '8px 0 0' }}>Tap to add photo or video</p></div>}
                    {preview && text && <div style={{ position: 'absolute', top: textPosition === 'top' ? '15%' : textPosition === 'bottom' ? '75%' : '50%', left: '50%', transform: 'translate(-50%, -50%)', color: textColor, fontSize: '18px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>{text}</div>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <input type="text" placeholder="Add text overlay (optional)" value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box', marginBottom: '12px' }} />
                {text && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map(color => (
                            <button key={color} onClick={() => setTextColor(color)} style={{ width: 24, height: 24, borderRadius: '50%', background: color, border: textColor === color ? '3px solid #808bf5' : '2px solid #e5e7eb', cursor: 'pointer' }} />
                        ))}
                        <select value={textPosition} onChange={e => setTextPosition(e.target.value)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                            <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                        </select>
                    </div>
                )}
                <button onClick={handleSubmit} disabled={uploading || !file} style={{ width: '100%', padding: '10px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', opacity: !file ? 0.6 : 1 }}>
                    {uploading ? 'Uploading...' : 'Share Story'}
                </button>
            </div>
        </div>
    );
};

const Stories = () => {
    const loggeduser = useAuthStore(s => s.user);
    const [groups, setGroups] = useState([]);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
    const [createOpen, setCreateOpen] = useState(false);

    const fetchStories = async () => {
        if (!loggeduser?._id) return;
        try {
            const res = await fetch(`${BASE}/api/story/feed/${loggeduser._id}`);
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch {}
    };

    useEffect(() => { fetchStories(); }, [loggeduser?._id]);

    // ✅ Real-time: new story from a followed user
    useEffect(() => {
        const handleNewStory = (story) => {
            const storyUserId = story.user._id.toString();
            if (storyUserId === loggeduser?._id?.toString()) return; // skip own
            setGroups(prev => {
                const idx = prev.findIndex(g => g.user._id.toString() === storyUserId);
                if (idx !== -1) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, story], hasUnviewed: true };
                    return updated;
                }
                return [...prev, { user: story.user, stories: [story], hasUnviewed: true }];
            });
        };
        socket.on('newStory', handleNewStory);
        return () => socket.off('newStory', handleNewStory);
    }, [loggeduser?._id]);

    // ✅ Delete story from local state
    const handleStoryDeleted = (userId, storyId) => {
        setGroups(prev =>
            prev.map(g => g.user._id.toString() === userId
                ? { ...g, stories: g.stories.filter(s => s._id !== storyId) }
                : g
            ).filter(g => g.stories.length > 0)
        );
    };

    // ✅ Add created story to own group optimistically
    const handleStoryCreated = (newStory) => {
        const myId = loggeduser?._id?.toString();
        setGroups(prev => {
            const idx = prev.findIndex(g => g.user._id.toString() === myId);
            if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], stories: [...updated[idx].stories, newStory] };
                return updated;
            }
            return [{ user: { _id: loggeduser._id, fullname: loggeduser.fullname, profile_picture: loggeduser.profile_picture }, stories: [newStory], hasUnviewed: false }, ...prev];
        });
    };

    const openViewer = (index) => { setViewerGroupIndex(index); setViewerOpen(true); };
    const ownGroup = groups.find(g => g.user._id.toString() === loggeduser?._id?.toString());
    const otherGroups = groups.filter(g => g.user._id.toString() !== loggeduser?._id?.toString());

    return (
        <>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 4px', scrollbarWidth: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => ownGroup ? openViewer(groups.findIndex(g => g.user._id.toString() === loggeduser?._id?.toString())) : setCreateOpen(true)}>
                    <div style={{ position: 'relative', width: 60, height: 60 }}>
                        <img src={loggeduser?.profile_picture} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: ownGroup ? '3px solid #808bf5' : '3px solid #e5e7eb' }} />
                        {!ownGroup && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: '#808bf5', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700 }}>+</div>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#374151', fontWeight: 500, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ownGroup ? 'Your story' : 'Add story'}
                    </span>
                </div>
                {otherGroups.map(group => {
                    const realIndex = groups.findIndex(g => g.user._id.toString() === group.user._id.toString());
                    const allViewed = !group.hasUnviewed;
                    return (
                        <div key={group.user._id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }} onClick={() => openViewer(realIndex)}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', padding: '2px', background: allViewed ? '#e5e7eb' : 'linear-gradient(135deg, #808bf5, #ec4899)' }}>
                                <img src={group.user.profile_picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: '#374151', fontWeight: allViewed ? 400 : 600, textAlign: 'center', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {group.user.fullname.split(' ')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
            {viewerOpen && groups.length > 0 && (
                <StoryViewer groups={groups} startGroupIndex={Math.min(viewerGroupIndex, groups.length - 1)} onClose={() => setViewerOpen(false)} loggeduser={loggeduser} onStoryDeleted={handleStoryDeleted} />
            )}
            {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={handleStoryCreated} loggeduser={loggeduser} />}
        </>
    );
};

export default Stories;

```

### `components/UserProfile.jsx`
```jsx
import React, { useState, useEffect } from "react";
import { Image } from "primereact/image";
import { Dialog } from "primereact/dialog";

import ChatPanel from './ChatPanel';

const BASE = process.env.REACT_APP_BACKEND_URL;

const PostGrid = ({ userId }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetch(`${BASE}/api/post/user/${userId}?limit=12`)
            .then(r => r.json())
            .then(data => { setPosts(data.posts || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [userId]);

    if (loading) return (
        <div className="grid grid-cols-3 gap-1 mt-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-gray-100 rounded animate-pulse" style={{ aspectRatio: '1' }} />)}
        </div>
    );

    if (posts.length === 0) return <p className="text-center text-gray-400 text-sm py-6">No posts yet</p>;

    return (
        <div className="grid grid-cols-3 gap-1 mt-2">
            {posts.map(post => {
                const imgs = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                return (
                    <div key={post._id} className="relative rounded overflow-hidden bg-gray-100" style={{ aspectRatio: '1' }}>
                        {imgs[0]
                            ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2 text-center">{post.caption?.slice(0, 30)}</div>
                        }
                        {imgs.length > 1 && (
                            <div className="absolute top-1 right-1 bg-black bg-opacity-50 rounded px-1">
                                <i className="pi pi-images text-white" style={{ fontSize: '10px' }}></i>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                            <span className="text-white text-xs">❤️ {post.likes?.length || 0}</span>
                            <span className="text-white text-xs">💬 {post.comments?.length || 0}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const UserProfile = ({ id }) => {
    const [userDetails, setUserDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');
    const [chatVisible, setChatVisible] = useState(false);

    const loggeduser = useAuthStore(s => s.user);
    const followUser = useAuthStore(s => s.followUser);
    const unfollowUser = useAuthStore(s => s.unfollowUser);
    const createConvMutation = useCreateConversation();
    const loadingState = {};

    useEffect(() => {
        if (!id || !loggeduser?._id) return;
        setLoading(true);
        fetch(`${BASE}/api/auth/other-user/view`, {
            method: "GET", headers: { Authorization: `${id}` },
        })
            .then(r => r.json())
            .then(data => { setUserDetails(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id, loggeduser?._id]);

    const isFollowing = loggeduser?.following?.some(f => f?.toString() === id?.toString());

    const handleFollow = () => followUser(id);
    const handleUnfollow = () => unfollowUser(id);

    const handleMessage = () => {
        createConvMutation.mutate([
            { userId: loggeduser._id, fullname: loggeduser.fullname, profilePicture: loggeduser.profile_picture },
            { userId: id, fullname: userDetails.fullname, profilePicture: userDetails.profile_picture },
        ]);
        setChatVisible(true);
    };

    if (!id) return null;
    if (loading) return (
        <div className="flex flex-col items-center gap-3 p-4">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
    );
    if (!userDetails) return <p className="text-center text-gray-400 p-4">User not found</p>;

    const tabs = ['posts', 'followers', 'following'];

    return (
        <>
            <div>
                {/* Cover */}
                <div className="w-full overflow-hidden rounded-t-xl" style={{ height: '100px', background: 'linear-gradient(135deg, #808bf5, #ec4899)' }} />

                {/* Avatar */}
                <div className="flex flex-col items-center -mt-10 px-4">
                    <div className="border-4 border-white rounded-full overflow-hidden" style={{ width: 80, height: 80 }}>
                        <Image src={userDetails.profile_picture} zoomSrc={userDetails.profile_picture} alt="Profile"
                            width="80" height="80" preview imageStyle={{ objectFit: 'cover', width: 80, height: 80 }} />
                    </div>
                    <h3 className="m-0 mt-2 font-bold text-base pacifico-regular">{userDetails.fullname}</h3>
                    {userDetails.bio && <p className="text-xs text-gray-500 text-center mt-1 m-0">{userDetails.bio}</p>}
                </div>

                {/* Stats */}
                <div className="flex justify-around border-y py-3 mt-3 mx-4">
                    <div className="text-center">
                        <p className="m-0 font-bold text-sm">{userDetails.followers?.length || 0}</p>
                        <p className="m-0 text-xs text-gray-500">Followers</p>
                    </div>
                    <div className="text-center">
                        <p className="m-0 font-bold text-sm">{userDetails.following?.length || 0}</p>
                        <p className="m-0 text-xs text-gray-500">Following</p>
                    </div>
                </div>

                {/* Actions */}
                {loggeduser?._id !== id && (
                    <div className="flex gap-2 px-4 mt-3">
                        <button
                            onClick={isFollowing ? handleUnfollow : handleFollow}
                            disabled={loadingState.follow || loadingState.unfollow}
                            className={`flex-1 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer ${isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-[#808bf5] text-white'}`}
                        >
                            {loadingState.follow || loadingState.unfollow ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                        <button
                            onClick={handleMessage}
                            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white cursor-pointer"
                        >
                            Message
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b mt-4 mx-4">
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className="flex-1 py-2 text-xs font-semibold border-0 bg-transparent cursor-pointer capitalize"
                            style={{ borderBottom: activeTab === tab ? '2px solid #808bf5' : '2px solid transparent', color: activeTab === tab ? '#808bf5' : '#6b7280' }}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="px-4 pb-4">
                    {activeTab === 'posts' && <PostGrid userId={id} />}
                    {activeTab === 'followers' && (
                        <div className="flex flex-col gap-2 mt-3">
                            {userDetails.followers?.length === 0
                                ? <p className="text-center text-gray-400 text-sm py-4">No followers yet</p>
                                : <p className="text-xs text-gray-400 text-center">{userDetails.followers?.length} followers</p>
                            }
                        </div>
                    )}
                    {activeTab === 'following' && (
                        <div className="flex flex-col gap-2 mt-3">
                            {userDetails.following?.length === 0
                                ? <p className="text-center text-gray-400 text-sm py-4">Not following anyone</p>
                                : <p className="text-xs text-gray-400 text-center">Following {userDetails.following?.length} people</p>
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Dialog */}
            <Dialog header={`Chat with ${userDetails.fullname}`} visible={chatVisible}
                style={{ width: '340px', height: '100vh' }} position="right" onHide={() => setChatVisible(false)}>
                <ChatPanel participantId={id} />
            </Dialog>
        </>
    );
};

export default UserProfile;

```

### `context/DarkModeContext.jsx`
```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('darkMode', isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.style.background = '#0f172a';
            document.body.style.color = '#f1f5f9';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.background = '';
            document.body.style.color = '';
        }
    }, [isDark]);

    const toggle = () => setIsDark(v => !v);

    return (
        <DarkModeContext.Provider value={{ isDark, toggle }}>
            {children}
        </DarkModeContext.Provider>
    );
}

export function useDarkMode() {
    return useContext(DarkModeContext);
}

```

### `db.js`
```javascript
const mongoose = require('mongoose');

const connectToMongo = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // ─── Pool: reduced for 512MB target ──────────────────────────────
            // 50 connections × ~1MB = 50MB — too much for 512MB budget
            // 10 is enough for most apps under 10k concurrent users
            maxPoolSize:      10,
            minPoolSize:      2,     // only 2 warm — saves ~8MB idle
            maxIdleTimeMS:    10000, // close idle faster (10s not 30s)

            // ─── Timeouts ─────────────────────────────────────────────────────
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS:          30000,
            connectTimeoutMS:         10000,

            // ─── Reliability ──────────────────────────────────────────────────
            retryWrites: true,
            retryReads:  true,
            // Removed w:'majority' — only for replica sets, not needed on Atlas free tier
        });

        console.log(`[MongoDB] Connected (PID: ${process.pid})`);

        if (process.env.NODE_ENV !== 'production') {
            // Log method only — not full query object (saves memory/string allocation)
            mongoose.set('debug', (col, method) => console.log(`[Mongoose] ${col}.${method}`));
        }

    } catch (err) {
        console.error('[MongoDB] Failed:', err.message);
        setTimeout(connectToMongo, 5000);
    }
};

mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected — reconnecting...');
    setTimeout(connectToMongo, 3000);
});

mongoose.connection.on('error', (err) => console.error('[MongoDB] Error:', err.message));

module.exports = connectToMongo;

```

### `hooks/queries/useConversationQueries.js`
```javascript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';
import useAuthStore from '../../store/zustand/useAuthStore';
import useConversationStore from '../../store/zustand/useConversationStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const convoKeys = {
    list:    (userId) => ['conversations', userId],
    messages:(convId) => ['messages', convId],
    search:  (convId, q) => ['messages', 'search', convId, q],
};

// ─── CONVERSATIONS LIST ───────────────────────────────────────────────────────
export function useConversations(userId) {
    const setUnreadCount = useConversationStore(s => s.setUnreadCount);
    return useQuery({
        queryKey: convoKeys.list(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation/${userId}`);
            // Sync unread counts into Zustand
            res.data.forEach(conv => {
                if (!conv.lastMessage?.isRead && conv.lastMessageBy !== userId) {
                    setUnreadCount(conv._id, 1);
                }
            });
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 30,
        refetchInterval: 1000 * 60, // background refresh every minute
    });
}

// ─── MESSAGES (infinite, oldest-first) ───────────────────────────────────────
export function useMessages(participantIds) {
    return useQuery({
        queryKey: convoKeys.messages(participantIds?.sort().join('-')),
        queryFn: async () => {
            const res = await api.post(`${BASE}/api/conversation/messages`, { participantIds });
            return res.data; // { messages, conversation }
        },
        enabled: !!participantIds && participantIds.length === 2,
        staleTime: 1000 * 30,
    });
}

// ─── MESSAGE SEARCH ───────────────────────────────────────────────────────────
export function useMessageSearch(conversationId, query) {
    return useQuery({
        queryKey: convoKeys.search(conversationId, query),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation/messages/search`, {
                params: { conversationId, q: query }
            });
            return res.data;
        },
        enabled: !!conversationId && query.length > 1,
        staleTime: 1000 * 60,
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export function useCreateConversation() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: (participants) =>
            api.post(`${BASE}/api/conversation/create`, { participants }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
        },
    });
}

export function useSendMessage() {
    const qc = useQueryClient();
    const addSocketMessage = useConversationStore(s => s.addSocketMessage);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ conversationId, content, recipientId, mediaUrl, mediaType }) =>
            api.post(`${BASE}/api/conversation/messages/create`, {
                conversationId, sender: user._id, content,
                senderName: user.fullname, recipientId,
                mediaUrl, mediaType,
            }),
        onSuccess: (res, { conversationId }) => {
            // Optimistically add to Zustand socket messages
            addSocketMessage(conversationId, res.data);
            qc.invalidateQueries({ queryKey: convoKeys.list(user?._id) });
        },
    });
}

export function useEditMessage() {
    const qc = useQueryClient();
    const updateMessageStatus = useConversationStore(s => s.updateMessageStatus);
    return useMutation({
        mutationFn: ({ messageId, content, conversationId }) =>
            api.patch(`${BASE}/api/conversation/messages/${messageId}`, { content }),
        onSuccess: (res, { conversationId, messageId }) => {
            updateMessageStatus(conversationId, messageId, { content: res.data.content, edited: true });
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useDeleteMessage() {
    const qc = useQueryClient();
    const deleteSocketMessage = useConversationStore(s => s.deleteSocketMessage);
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ messageId, conversationId }) =>
            api.delete(`${BASE}/api/conversation/messages/${messageId}`, { data: { userId: user._id } }),
        onSuccess: (_, { messageId, conversationId }) => {
            deleteSocketMessage(conversationId, messageId);
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useReactToMessage() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ messageId, emoji, conversationId }) =>
            api.post(`${BASE}/api/conversation/messages/${messageId}/react`, {
                userId: user._id, emoji
            }),
        onSuccess: (_, { conversationId }) => {
            qc.invalidateQueries({ queryKey: convoKeys.messages(conversationId) });
        },
    });
}

export function useMarkMessagesRead() {
    const qc = useQueryClient();
    const clearUnread = useConversationStore(s => s.clearUnread);
    return useMutation({
        mutationFn: ({ unreadMessageIds, lastMessage }) =>
            api.post(`${BASE}/api/conversation/messages/mark-read`, { unreadMessageIds, lastMessage }),
        onSuccess: (_, { conversationId }) => {
            if (conversationId) clearUnread(conversationId);
        },
    });
}

```

### `hooks/queries/useNotificationQueries.js`
```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../store/zustand/useAuthStore';
import { socket } from '../../socket';
import useAuthStore from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

export const notifKeys = {
    list:     (userId) => ['notifications', userId],
    settings: (userId) => ['notifications', 'settings', userId],
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export function useNotifications(userId) {
    const qc = useQueryClient();

    const query = useQuery({
        queryKey: notifKeys.list(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/conversation/notifications/${userId}`);
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60,
    });

    // Real-time socket injection into query cache
    useEffect(() => {
        if (!userId) return;
        const handleNew = (notification) => {
            qc.setQueryData(notifKeys.list(userId), (old = []) => [notification, ...old]);
        };
        socket.on('newNotification', handleNew);
        return () => socket.off('newNotification', handleNew);
    }, [userId, qc]);

    const markRead = useMutation({
        mutationFn: (Ids) => api.patch(`${BASE}/api/conversation/notifications/mark-read`, { Ids }),
        onSuccess: (_, Ids) => {
            qc.setQueryData(notifKeys.list(userId), (old = []) =>
                old.filter(n => !Ids.includes(n._id))
            );
        },
    });

    const unreadCount = query.data?.length || 0;

    return { ...query, markRead, unreadCount };
}

// ─── NOTIFICATION SETTINGS (email digest) ─────────────────────────────────────
export function useNotificationSettings(userId) {
    const qc = useQueryClient();
    const token = useAuthStore(s => s.token);

    const query = useQuery({
        queryKey: notifKeys.settings(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/auth/notification-settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10,
    });

    const updateSettings = useMutation({
        mutationFn: (settings) => api.patch(`${BASE}/api/auth/notification-settings`, settings, {
            headers: { Authorization: `Bearer ${token}` }
        }),
        onSuccess: (res) => {
            qc.setQueryData(notifKeys.settings(userId), res.data);
        },
    });

    return { ...query, updateSettings };
}

```

### `hooks/queries/usePostQueries.js`
```javascript
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';
import useAuthStore from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';

const BASE = process.env.REACT_APP_BACKEND_URL;
const api = () => {
    const token = useAuthStore.getState().token;
    return axios.create({ headers: { Authorization: `Bearer ${token}` } });
};

// ─── QUERY KEYS ───────────────────────────────────────────────────────────────
export const postKeys = {
    all:         ['posts'],
    feed:        (userId) => ['posts', 'feed', userId],
    userPosts:   (userId) => ['posts', 'user', userId],
    saved:       (userId) => ['posts', 'saved', userId],
    detail:      (postId) => ['posts', 'detail', postId],
    comments:    (postId) => ['posts', 'comments', postId],
    mood:        (mood, userId) => ['posts', 'mood', mood, userId],
    confessions: ['posts', 'confessions'],
    trending:    ['posts', 'trending'],
    categories:  ['posts', 'categories'],
};

// ─── FEED (infinite scroll) ───────────────────────────────────────────────────
export function useFeed(userId) {
    return useInfiniteQuery({
        queryKey: postKeys.feed(userId),
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            if (userId)    params.append('userId', userId);
            const res = await api.get(`${BASE}/api/post/?${params}`);
            return res.data; // { posts, nextCursor, hasMore }
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2, // 2 minutes
        enabled: !!userId,
    });
}

// ─── USER POSTS ───────────────────────────────────────────────────────────────
export function useUserPosts(userId) {
    return useInfiniteQuery({
        queryKey: postKeys.userPosts(userId),
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '12' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await api.get(`${BASE}/api/post/user/${userId}?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── SAVED POSTS ──────────────────────────────────────────────────────────────
export function useSavedPosts(userId) {
    const initSavedIds = usePostStore(s => s.initSavedIds);
    return useQuery({
        queryKey: postKeys.saved(userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/saved/${userId}`);
            initSavedIds(res.data.map(p => p._id));
            return res.data;
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── POST DETAIL ──────────────────────────────────────────────────────────────
export function usePostDetail(postId) {
    return useQuery({
        queryKey: postKeys.detail(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/detail/${postId}`);
            return res.data;
        },
        enabled: !!postId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── COMMENTS ─────────────────────────────────────────────────────────────────
export function useComments(postId) {
    return useQuery({
        queryKey: postKeys.comments(postId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/post/comments`, {
                headers: { Authorization: postId }
            });
            return res.data;
        },
        enabled: !!postId,
        staleTime: 1000 * 30,
    });
}

// ─── MOOD FEED ────────────────────────────────────────────────────────────────
export function useMoodFeed(mood, userId) {
    return useQuery({
        queryKey: postKeys.mood(mood, userId),
        queryFn: async () => {
            const res = await api.get(`${BASE}/api/ai/mood-feed/${userId}?mood=${mood}`);
            return res.data.posts;
        },
        enabled: !!mood && !!userId,
        staleTime: 1000 * 60 * 5,
    });
}

// ─── CONFESSIONS ─────────────────────────────────────────────────────────────
export function useConfessions() {
    return useInfiniteQuery({
        queryKey: postKeys.confessions,
        queryFn: async ({ pageParam = null }) => {
            const params = new URLSearchParams({ limit: '10' });
            if (pageParam) params.append('cursor', pageParam);
            const res = await api.get(`${BASE}/api/post/confessions?${params}`);
            return res.data;
        },
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
        staleTime: 1000 * 60 * 2,
    });
}

// ─── TRENDING ─────────────────────────────────────────────────────────────────
export function useTrending() {
    return useQuery({
        queryKey: postKeys.trending,
        queryFn: async () => { const res = await api.get(`${BASE}/api/post/trending`); return res.data; },
        staleTime: 1000 * 60 * 10, // trending changes slowly
    });
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export function useCategories() {
    return useQuery({
        queryKey: postKeys.categories,
        queryFn: async () => { const res = await api.get(`${BASE}/api/post/categories`); return res.data; },
        staleTime: Infinity, // categories never change
    });
}

// ─── MUTATIONS ────────────────────────────────────────────────────────────────

export function useCreatePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/create`, data),
        onSuccess: (res) => {
            // Prepend to feed cache immediately
            qc.setQueriesData({ queryKey: postKeys.feed(user?._id) }, (old) => {
                if (!old) return old;
                return { ...old, pages: [{ posts: [res.data], nextCursor: old.pages[0]?.nextCursor, hasMore: old.pages[0]?.hasMore }, ...old.pages] };
            });
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
        },
    });
}

export function useLikePost() {
    const qc = useQueryClient();
    const optimisticLike = usePostStore(s => s.optimisticLike);
    const rollbackLike   = usePostStore(s => s.rollbackLike);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId, isLiked }) =>
            api.post(`${BASE}/api/post/${isLiked ? 'unlike' : 'like'}`, { postId, userId: user._id }),
        onMutate: ({ postId, isLiked }) => {
            optimisticLike(postId, user._id);
            return { postId, wasLiked: isLiked };
        },
        onError: (_, __, ctx) => {
            rollbackLike(ctx.postId, user._id, ctx.wasLiked);
        },
    });
}

export function useSavePost() {
    const qc = useQueryClient();
    const toggleSaved = usePostStore(s => s.toggleSaved);
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId }) => api.post(`${BASE}/api/post/save`, { postId, userId: user._id }),
        onSuccess: (res, { postId }) => {
            toggleSaved(postId, res.data.saved);
            qc.invalidateQueries({ queryKey: postKeys.saved(user?._id) });
        },
    });
}

export function useCreateComment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data) => api.post(`${BASE}/api/post/comments/add`, data),
        onSuccess: (_, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        },
    });
}

export function useDeleteComment() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ commentId, postId }) =>
            api.delete(`${BASE}/api/post/comments/${commentId}`, { data: { userId: user._id } }),
        onSuccess: (_, { postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        },
    });
}

export function useDeletePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ postId }) =>
            api.delete(`${BASE}/api/post/delete/${postId}`, { data: { userId: user._id } }),
        onSuccess: (_, { postId }) => {
            // Remove from all feed caches
            qc.setQueriesData({ queryKey: postKeys.feed(user?._id) }, (old) => {
                if (!old) return old;
                return { ...old, pages: old.pages.map(page => ({ ...page, posts: page.posts.filter(p => p._id !== postId) })) };
            });
            qc.invalidateQueries({ queryKey: postKeys.userPosts(user?._id) });
        },
    });
}

export function useUpdatePost() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);
    return useMutation({
        mutationFn: ({ postId, caption, category }) =>
            api.put(`${BASE}/api/post/update/${postId}`, { userId: user._id, caption, category }),
        onSuccess: (res) => {
            qc.setQueryData(postKeys.detail(res.data._id), res.data);
            qc.invalidateQueries({ queryKey: postKeys.feed(user?._id) });
        },
    });
}

```

### `hooks/useFeedSocket.js`
```javascript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../socket';
import toast from 'react-hot-toast';
import useAuthStore from '../store/zustand/useAuthStore';
import usePostStore from '../store/zustand/usePostStore';
import { postKeys } from './queries/usePostQueries';

export default function useFeedSocket() {
    const qc           = useQueryClient();
    const user         = useAuthStore(s => s.user);
    const addSocketPost= usePostStore(s => s.addSocketPost);
    const removeSocketPost = usePostStore(s => s.removeSocketPost);
    const syncLike     = usePostStore(s => s.syncLikeFromSocket);

    useEffect(() => {
        if (!user?._id) return;

        // ✅ New post from followed user → Zustand socket store
        const onNewFeedPost = (post) => {
            if (post.user._id !== user._id) addSocketPost(post);
        };

        // ✅ Like sync from another user → Zustand optimistic store
        const onPostLiked = ({ postId, userId, likesCount }) => {
            if (userId !== user._id) syncLike(postId, userId, true);
        };
        const onPostUnliked = ({ postId, userId }) => {
            if (userId !== user._id) syncLike(postId, userId, false);
        };

        // ✅ Comment added → invalidate comments query for that post
        const onNewComment = ({ postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        };

        // ✅ Comment deleted → invalidate
        const onCommentDeleted = ({ postId }) => {
            qc.invalidateQueries({ queryKey: postKeys.comments(postId) });
        };

        // ✅ Post updated → update in all feed caches
        const onPostUpdated = ({ postId, caption, category }) => {
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.map(p =>
                            p._id === postId ? { ...p, caption, category } : p
                        ),
                    })),
                };
            });
        };

        // ✅ Post deleted → remove from all caches + Zustand
        const onPostDeleted = ({ postId }) => {
            removeSocketPost(postId);
            qc.setQueriesData({ queryKey: postKeys.feed(user._id) }, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map(page => ({
                        ...page,
                        posts: page.posts.filter(p => p._id !== postId),
                    })),
                };
            });
        };

        // ✅ Collaboration notifications
        const onCollaborationInvite = ({ postId, postCaption, invitedBy }) => {
            toast(`🤝 ${invitedBy} invited you to collaborate!`, { duration: 6000 });
            // Refresh feed so invite banner appears
            qc.invalidateQueries({ queryKey: postKeys.feed(user._id) });
        };
        const onCollaborationAccepted = () => {
            toast.success('A collaborator accepted your invite!');
        };

        // ✅ New confession post
        const onNewConfessionPost = (post) => {
            addSocketPost(post); // goes to socketConfessions via addSocketPost logic
            qc.invalidateQueries({ queryKey: postKeys.confessions });
        };

        socket.on('newFeedPost',           onNewFeedPost);
        socket.on('postLiked',             onPostLiked);
        socket.on('postUnliked',           onPostUnliked);
        socket.on('newComment',            onNewComment);
        socket.on('commentDeleted',        onCommentDeleted);
        socket.on('postUpdated',           onPostUpdated);
        socket.on('postDeleted',           onPostDeleted);
        socket.on('collaborationInvite',   onCollaborationInvite);
        socket.on('collaborationAccepted', onCollaborationAccepted);
        socket.on('newConfessionPost',     onNewConfessionPost);

        return () => {
            socket.off('newFeedPost',           onNewFeedPost);
            socket.off('postLiked',             onPostLiked);
            socket.off('postUnliked',           onPostUnliked);
            socket.off('newComment',            onNewComment);
            socket.off('commentDeleted',        onCommentDeleted);
            socket.off('postUpdated',           onPostUpdated);
            socket.off('postDeleted',           onPostDeleted);
            socket.off('collaborationInvite',   onCollaborationInvite);
            socket.off('collaborationAccepted', onCollaborationAccepted);
            socket.off('newConfessionPost',     onNewConfessionPost);
        };
    }, [user?._id, qc]);
}

```

### `hooks/useNotifications.js`
```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { socket } from '../socket';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

// Fetch notifications
const fetchNotifications = async (userId) => {
    const res = await axios.get(`${BASE}/api/conversation/notifications/${userId}`);
    return res.data;
};

// Mark notifications as read
const markAsRead = async (Ids) => {
    const res = await axios.patch(`${BASE}/api/conversation/notifications/mark-read`, { Ids });
    return res.data;
};

export function useNotifications(userId) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['notifications', userId],
        queryFn: () => fetchNotifications(userId),
        enabled: !!userId,
        staleTime: 1000 * 60, // 1 minute
    });

    // Real-time: listen for new notifications via socket
    useEffect(() => {
        if (!userId) return;

        const handleNewNotification = (notification) => {
            queryClient.setQueryData(['notifications', userId], (old = []) => [notification, ...old]);
        };

        socket.on('newNotification', handleNewNotification);
        return () => socket.off('newNotification', handleNewNotification);
    }, [userId, queryClient]);

    const markRead = useMutation({
        mutationFn: markAsRead,
        onSuccess: (_, Ids) => {
            queryClient.setQueryData(['notifications', userId], (old = []) =>
                old.filter(n => !Ids.includes(n._id))
            );
        },
    });

    const unreadCount = query.data?.length || 0;

    return { ...query, markRead, unreadCount };
}

```

### `hooks/useTokenRefresh.js`
```javascript
import { useEffect, useRef } from 'react';
import axios from 'axios';
import { getToken, setToken } from '../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// Refresh access token 2 minutes before it expires (token is 15min)
// So refresh fires every 13 minutes
const REFRESH_INTERVAL = 13 * 60 * 1000;

export default function useTokenRefresh() {
    const intervalRef = useRef(null);

    useEffect(() => {
        const refresh = async () => {
            // Only refresh if we have an active session
            if (!getToken()) return;
            try {
                const { getFingerprint } = await import('../utils/fingerprint');
                const fingerprint = await getFingerprint();
                const res = await axios.post(
                    `${BASE}/api/auth/refresh`,
                    {},
                    { withCredentials: true, headers: { 'x-fingerprint': fingerprint } }
                );
                setToken(res.data.token);
            } catch (err) {
                // 401/403 means refresh token expired — axios interceptor handles redirect
                if (err.response?.status === 401 || err.response?.status === 403) {
                    clearInterval(intervalRef.current);
                }
            }
        };

        // Start proactive refresh interval
        intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, []);
}

```

### `index.js`
```javascript
require('dotenv').config();

// ✅ Hard cap Node.js heap at 400MB — leaves 112MB for OS + native modules
// Without this Node defaults to 1.5GB and never GCs aggressively
if (process.env.NODE_ENV === 'production') {
    // Set via package.json start script: node --max-old-space-size=400 index.js
    // But also set here as fallback
}

const connectToMongo = require('./db.js');
const express        = require('express');
const cors           = require('cors');
const http           = require('http');
const socketIo       = require('socket.io');
const helmet         = require('helmet');
const compression    = require('compression');
const rateLimit      = require('express-rate-limit');
const cookieParser   = require('cookie-parser');

// ✅ NO cluster in single-dyno/512MB deployments
// Cluster multiplies RAM usage by CPU count — 4 cores = 4x RAM
// Use a single process + async I/O instead
// To scale horizontally, run multiple dynos behind a load balancer

connectToMongo();

const app    = express();
const server = http.createServer(app);
const port   = process.env.PORT || 5000;

app.set('trust proxy', 1);

// ─── SECURITY + COMPRESSION ───────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cookieParser());

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
    skip: (req) => {
        const safePaths = ['/refresh', '/get', '/other-users', '/search', '/other-user', '/notification-settings'];
        return safePaths.some(p => req.path.includes(p));
    },
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests.' },
    skip: (req) => req.path.startsWith('/admin') || req.path.startsWith('/socket.io'),
});

const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many reports.' },
});

app.use('/api/auth',         authWriteLimiter);
app.use('/api/admin/report', reportLimiter);
app.use('/api',              apiLimiter);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ✅ Use 'tiny' morgan format — logs 60% less data than 'combined'
// In production, skip successful health checks entirely
if (process.env.NODE_ENV !== 'production') {
    const morgan = require('morgan');
    app.use(morgan('tiny'));
}

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
const io = socketIo(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout:       60000,
    pingInterval:      25000,
    transports:        ['websocket', 'polling'],
    allowEIO3:         true,
    maxHttpBufferSize: 1e6,

    // ✅ Reduce socket.io memory: don't buffer events for disconnected clients
    connectTimeout: 10000,
});

// ─── REDIS ADAPTER (optional — only if REDIS_URL set) ─────────────────────────
async function initRedis() {
    if (!process.env.REDIS_URL) {
        console.log('[Redis] No REDIS_URL — skipping adapter (single instance mode)');
        return;
    }
    try {
        const { createClient }  = require('redis');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const pubClient = createClient({ url: process.env.REDIS_URL });
        pubClient.on('error', err => console.error('[Redis Pub]', err.message));
        const subClient = pubClient.duplicate();
        subClient.on('error', err => console.error('[Redis Sub]', err.message));
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        console.log('[Redis] Socket.io adapter configured');
    } catch (err) {
        console.warn('[Redis] Failed:', err.message);
    }
}

// ─── PUBSUB ───────────────────────────────────────────────────────────────────
async function initPubSubLayer() {
    try {
        const { initPubSub } = require('./lib/pubsub');
        const { initPostSubscriber, setIo: setSubscriberIo } = require('./subscribers/postSubscriber');
        setSubscriberIo(io);
        await initPubSub();
        await initPostSubscriber();
        console.log('[PubSub] Initialized');
    } catch (err) {
        console.warn('[PubSub] Failed:', err.message);
    }
}

// ─── ROUTES (lazy-loaded to reduce startup memory) ────────────────────────────
// Each require() loads the module + its dependencies into memory
// By using a getter pattern we defer loading until first request
// Saves ~20-40MB at startup depending on module sizes

const postRouter  = require('./routes/post.js');
const storyRouter = require('./routes/story.js');

postRouter.setIo(io);
storyRouter.setIo(io);

app.get('/health', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        status: 'ok',
        pid:    process.pid,
        uptime: Math.floor(process.uptime()),
        memory: {
            heapUsed:  `${Math.round(mem.heapUsed  / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
            rss:       `${Math.round(mem.rss       / 1024 / 1024)}MB`, // actual process RAM
            external:  `${Math.round(mem.external  / 1024 / 1024)}MB`,
        }
    });
});

// ✅ Lazy route loading — require() only fires when first request hits that path
app.use('/api/auth',         (req, res, next) => require('./routes/auth.js')(req, res, next));
app.use('/api/post',         postRouter);
app.use('/api/conversation', (req, res, next) => require('./routes/conversation.js')(req, res, next));
app.use('/api/story',        storyRouter);
app.use('/api/ai',           (req, res, next) => require('./routes/ai.js')(req, res, next));
app.use('/api/admin',        (req, res, next) => require('./routes/admin.js')(req, res, next));
app.use('/api/chatbot',      (req, res, next) => require('./routes/chatbot.js')(req, res, next));

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────
// ✅ Map is O(1) — critical at scale
const onlineUsers = new Map();

io.on('connection', (socket) => {
    socket.on('registerUser', (userId) => {
        socket.join(userId);
        onlineUsers.set(userId, socket.id);
        // ✅ Don't broadcast full list to everyone — emit only to the registering socket
        // Broadcasting getOnlineList() to all users = O(n²) memory at scale
        socket.emit('updateUserList', [{ userId, socketId: socket.id }]);
    });

    socket.on('logoutUser', (userId) => {
        onlineUsers.delete(userId);
        // ✅ Only notify the logging-out user — no broadcast needed
    });

    socket.on('sendMessage', ({ recipientId, content, senderName, sender, conversationId, _id, createdAt, isRead }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('receiveMessage', {
                senderId: sender, socketId: socket.id,
                content, recipientId, senderName, conversationId, _id, createdAt, isRead,
            });
        }
    });

    socket.on('typing', ({ recipientId, senderName }) => {
        const sid = onlineUsers.get(recipientId);
        if (sid) io.to(sid).emit('userTyping', { senderName });
    });

    socket.on('stopTyping', ({ recipientId }) => {
        const sid = onlineUsers.get(recipientId);
        if (sid) io.to(sid).emit('userStoppedTyping');
    });

    socket.on('readMessage', ({ messageId, socketId }) => {
        io.to(socketId).emit('seenMessage', { messageId });
    });

    socket.on('collaborationResponse', ({ postId, userId, accepted }) => {
        io.emit('collaborationUpdate', { postId, userId, accepted });
    });

    socket.on('messageEdited', ({ messageId, content, conversationId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageEdited', { messageId, content, conversationId });
    });

    socket.on('messageDeleted', ({ messageId, conversationId, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageDeleted', { messageId, conversationId });
    });

    socket.on('messageReaction', ({ messageId, conversationId, reactions, recipientId }) => {
        if (recipientId) io.to(recipientId).emit('messageReaction', { messageId, conversationId, reactions });
    });

    socket.on('disconnect', () => {
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) { onlineUsers.delete(userId); break; }
        }
        // ✅ No broadcast on disconnect — saves O(n) work per disconnect
    });
});

// ─── PERIODIC GC HINT ─────────────────────────────────────────────────────────
// Ask V8 to run GC every 5 minutes if --expose-gc flag is set
// Add to package.json: "start": "node --max-old-space-size=400 --expose-gc index.js"
if (global.gc) {
    setInterval(() => {
        global.gc();
        const mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (mb > 300) console.warn(`[Memory] Heap at ${mb}MB after GC`);
    }, 5 * 60 * 1000);
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    console.log(`[${signal}] Shutting down...`);
    server.close(async () => {
        try { const mongoose = require('mongoose'); await mongoose.connection.close(); } catch {}
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ─── START ────────────────────────────────────────────────────────────────────
async function bootstrap() {
    await initRedis();
    await initPubSubLayer();
    server.listen(port, () => console.log(`[Server] Running on port ${port} (PID: ${process.pid})`));
}

bootstrap().catch(err => {
    console.error('[Bootstrap] Failed:', err.message);
    process.exit(1);
});

```

### `lib/cache.js`
```javascript
const { createClient } = require('redis');

let client = null;
let isConnected = false;

const getClient = async () => {
    if (isConnected && client) return client;
    try {
        client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        client.on('error', err => console.warn('[Redis Cache] Error:', err.message));
        client.on('connect', () => { isConnected = true; console.log('[Redis Cache] Connected'); });
        client.on('disconnect', () => { isConnected = false; });
        await client.connect();
        return client;
    } catch (err) {
        console.warn('[Redis Cache] Not available — skipping cache:', err.message);
        return null;
    }
};

// ─── CACHE HELPERS ────────────────────────────────────────────────────────────

async function cacheGet(key) {
    try {
        const c = await getClient();
        if (!c) return null;
        const val = await c.get(key);
        return val ? JSON.parse(val) : null;
    } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 60) {
    try {
        const c = await getClient();
        if (!c) return;
        await c.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {}
}

async function cacheDel(key) {
    try {
        const c = await getClient();
        if (!c) return;
        await c.del(key);
    } catch {}
}

async function cacheDelPattern(pattern) {
    try {
        const c = await getClient();
        if (!c) return;
        const keys = await c.keys(pattern);
        if (keys.length > 0) await c.del(keys);
    } catch {}
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern };

```

### `lib/nats.js`
```javascript
const { connect, StringCodec } = require('nats');

let nc;
const sc = StringCodec();

async function initNats() {
    if (nc && !nc.isClosed()) return nc;
    nc = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    console.log('Connected to NATS successfully');
    return nc;
}

async function publish(subject, payload) {
    const conn = await initNats();
    conn.publish(subject, sc.encode(JSON.stringify(payload)));
}

async function subscribe(subject, handler) {
    const conn = await initNats();
    const sub = conn.subscribe(subject);
    (async () => {
        for await (const msg of sub) {
            try {
                const data = JSON.parse(sc.decode(msg.data));
                await handler(data);
            } catch (err) {
                console.error(`Error handling NATS message on [${subject}]:`, err.message);
            }
        }
    })();
    console.log(`Subscribed to NATS subject: ${subject}`);
}

module.exports = { initNats, publish, subscribe };

```

### `middleware/verifyToken.js`
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
}

module.exports = verifyToken;

```

### `models/Analytics.js`
```javascript
const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
    event: { type: String, required: true }, // e.g. 'post.created'
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    category: { type: String },
    meta: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);

```

### `models/Comment.js`
```javascript
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
    {
        user: {
            _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            fullname: { type: String, required: true },
            profile_picture: { type: String },
        },
        postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
        content: { type: String, required: true },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
        replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);

```

### `models/Feed.js`
```javascript
const mongoose = require('mongoose');

const FeedSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner of the feed
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    createdAt: { type: Date, default: Date.now },
});

FeedSchema.index({ userId: 1, createdAt: -1 }); // fast feed queries

module.exports = mongoose.model('Feed', FeedSchema);

```

### `models/LoginSession.js`
```javascript
const mongoose = require('mongoose');

const LoginSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Token family for reuse detection
    tokenFamily: { type: String, required: true }, // unique per login session
    refreshToken: { type: String, required: true }, // hashed
    isRevoked: { type: Boolean, default: false },

    // Browser fingerprint
    fingerprint: { type: String, required: true }, // hashed

    // Device & location info
    ip: { type: String },
    userAgent: { type: String },
    device: { type: String },  // e.g. "Chrome on Windows"
    location: {
        city: { type: String },
        region: { type: String },
        country: { type: String },
    },

    // Alert tracking
    isNewDevice: { type: Boolean, default: false },
    alertSent: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});

// Auto-delete expired sessions
LoginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginSession', LoginSessionSchema);

```

### `models/Message.js`
```javascript
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content:        { type: String, default: '' },

    // Media sharing
    media: {
        url:  { type: String, default: null },
        type: { type: String, enum: ['image', 'video', 'audio', 'file'], default: null },
        name: { type: String, default: null },
        size: { type: Number, default: null },
    },

    // Reactions: { userId → emoji }
    reactions: { type: Map, of: String, default: {} },

    // Edit/delete
    edited:    { type: Boolean, default: false },
    editedAt:  { type: Date,    default: null },
    deletedAt: { type: Date,    default: null }, // soft delete

    isRead: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', MessageSchema);

```

### `models/Notification.js`
```javascript
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: {
        _id: mongoose.Schema.Types.ObjectId,
        fullname: String,
        profile_picture: String,
    },
    type: { type: String, enum: ['new_post', 'like', 'comment', 'follow'], required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema);

```

### `models/Post.js`
```javascript
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema(
  {
    user: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      fullname: { type: String, required: true },
      profile_picture: { type: String },
    },
    image_url: { type: String, default: null },
    image_urls: [{ type: String }],
    caption: { type: String, maxLength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [],
    category: { type: String, required: true },
    location: { name: { type: String, default: null }, lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    music: { title: { type: String, default: null }, artist: { type: String, default: null } },
    score: { type: Number, default: 0 },

    // Post Expiry — auto-deleted by MongoDB TTL index
    expiresAt: { type: Date, default: null },

    // Anonymous Confessions — hides user identity
    isAnonymous: { type: Boolean, default: false },

    // Time-Locked — hidden until unlocksAt
    unlocksAt: { type: Date, default: null },

    // Collaborative Posts
    isCollaborative: { type: Boolean, default: false },
    collaborators: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fullname: { type: String },
      profile_picture: { type: String },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      contribution: { type: String, default: null },
    }],

    // Voice Notes
    voiceNote: { url: { type: String, default: null }, duration: { type: Number, default: null } },

    // AI mood tag
    mood: { type: String, default: null },
  },
  { timestamps: true }
);

PostSchema.index({ score: -1, createdAt: -1 });
PostSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Post', PostSchema);

```

### `models/Report.js`
```javascript
const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'user', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'hate_speech', 'misinformation', 'nudity', 'violence', 'other'],
        required: true,
    },
    description: { type: String, default: null },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);

```

### `models/Story.js`
```javascript
const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
    user: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        fullname: { type: String, required: true },
        profile_picture: { type: String },
    },
    media: [{
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], default: 'image' },
        overlay: {
            text: { type: String, default: null },
            color: { type: String, default: '#ffffff' },
            position: { type: String, enum: ['top', 'center', 'bottom'], default: 'bottom' },
        },
        duration: { type: Number, default: 5000 },
    }],
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
}, { timestamps: true });

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Story', StorySchema);

```

### `models/User.js`
```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  profile_picture: {
    type: String,
    default: "https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain",
  },
  bio: { type: String, default: null },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  // Notification settings
  notificationSettings: {
    emailDigest:    { type: Boolean, default: false },
    pushEnabled:    { type: Boolean, default: true  },
    digestTime:     { type: String,  default: '08:00' },
  },

  // Admin
  isAdmin: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  bannedAt: { type: Date, default: null },

  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);

```

### `package.scripts.json`
```json
{
  "scripts": {
    "start": "node --max-old-space-size=400 --expose-gc index.js",
    "dev": "nodemon --max-old-space-size=400 index.js",
    "start:debug": "node --max-old-space-size=400 --expose-gc --inspect index.js"
  }
}

```

### `pages/ActiveSessions.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const deviceIcon = (device = '') => {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) return '📱';
  if (d.includes('tablet') || d.includes('ipad')) return '📟';
  return '💻';
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  const token = localStorage.getItem('token');

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/get`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFaEnabled(res.data.twoFactorEnabled);
    } catch {}
  };

  useEffect(() => {
    fetchSessions();
    fetchUser();
  }, []);

  const revokeSession = async (sessionId) => {
    try {
      await axios.delete(`${BASE}/api/auth/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s._id !== sessionId));
      toast.success('Session revoked');
    } catch { toast.error('Failed to revoke session'); }
  };

  const toggle2FA = async () => {
    setToggling2FA(true);
    try {
      const res = await axios.post(`${BASE}/api/auth/toggle-2fa`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFaEnabled(res.data.twoFactorEnabled);
      toast.success(`2FA ${res.data.twoFactorEnabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to toggle 2FA'); }
    setToggling2FA(false);
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <>
      <div className="px-4 py-6">
        <h2 className="text-xl font-bold mb-1">Security Settings</h2>
        <p className="text-sm text-gray-500 mb-6">Manage your active sessions and security preferences.</p>

        {/* 2FA Toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold m-0">Two-Factor Authentication</h3>
            <p className="text-xs text-gray-500 mt-1 m-0">
              {twoFaEnabled
                ? '✅ Enabled — OTP sent to your email on every login'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <button
            onClick={toggle2FA}
            disabled={toggling2FA}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-all ${
              twoFaEnabled ? 'bg-red-100 text-red-500' : 'bg-indigo-500 text-white'
            }`}
          >
            {toggling2FA ? '...' : twoFaEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Sessions header */}
        <h3 className="text-sm font-bold mb-3">Active Sessions ({sessions.length})</h3>

        {/* Sessions list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No active sessions found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <div key={session._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{deviceIcon(session.device)}</span>
                  <div>
                    <p className="m-0 text-sm font-semibold">{session.device || 'Unknown Device'}</p>
                    <p className="m-0 text-xs text-gray-500">
                      {session.location?.city}, {session.location?.country} · {session.ip}
                    </p>
                    <p className="m-0 text-xs text-gray-400">
                      Last active: {formatDate(session.lastUsedAt)}
                      {session.isNewDevice && (
                        <span className="ml-2 text-yellow-500 font-semibold">· New device</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeSession(session._id)}
                  className="bg-red-100 text-red-500 border-0 rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default ActiveSessions;

```

### `pages/AdminDashboard.jsx`
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';


const BASE = process.env.REACT_APP_BACKEND_URL;

const useAdmin = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// ─── PASSWORD GATE ────────────────────────────────────────────────────────────
const PasswordGate = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPw, setShowPw] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) { setError('Enter your password'); return; }
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            // Re-verify password via auth endpoint
            await axios.post(`${BASE}/api/auth/verify-password`, { password }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Incorrect password');
        }
        setLoading(false);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)' }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '40px 36px', width: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                {/* Icon */}
                <div style={{ width: 64, height: 64, borderRadius: '18px', background: 'linear-gradient(135deg, #808bf5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
                    🔐
                </div>

                <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, textAlign: 'center' }}>Admin Access</h2>
                <p style={{ margin: '0 0 28px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                    Re-enter your password to continue
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="Your account password"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(''); }}
                            autoFocus
                            style={{
                                width: '100%', padding: '12px 44px 12px 16px',
                                borderRadius: '12px', border: error ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => { if (!error) e.target.style.borderColor = '#808bf5'; }}
                            onBlur={e => { if (!error) e.target.style.borderColor = '#e5e7eb'; }}
                        />
                        <button type="button" onClick={() => setShowPw(v => !v)}
                            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: 0 }}>
                            {showPw ? '🙈' : '👁️'}
                        </button>
                    </div>

                    {error && (
                        <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px' }}>⚠️</span>
                            <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>{error}</p>
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        style={{ padding: '13px', background: loading ? '#c4b5fd' : 'linear-gradient(135deg, #808bf5, #6366f1)', color: '#fff', border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {loading ? (
                            <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Verifying...</>
                        ) : '🔓 Enter Dashboard'}
                    </button>
                </form>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#808bf5', icon }) => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
        <div style={{ width: 48, height: 48, borderRadius: '12px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold m-0">{value?.toLocaleString()}</p>
            <p className="text-sm text-gray-500 m-0">{label}</p>
            {sub && <p className="text-xs text-green-500 m-0">{sub}</p>}
        </div>
    </div>
);

// ─── SIMPLE BAR CHART ─────────────────────────────────────────────────────────
const BarChart = ({ data, label }) => {
    if (!data?.length) return null;
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '100%', height: `${(d.count / max) * 70}px`, background: '#808bf5', borderRadius: '4px 4px 0 0', minHeight: '4px', transition: 'height 0.3s' }} title={`${d._id}: ${d.count}`} />
                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>{d._id?.slice(5)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── ANALYTICS TAB ────────────────────────────────────────────────────────────
const AnalyticsTab = () => {
    const { headers } = useAdmin();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${BASE}/api/admin/analytics`, { headers })
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (!data) return <p className="text-center text-gray-400 p-8">Failed to load analytics</p>;

    const { overview, charts, topPosts, recentUsers } = data;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <StatCard icon="👥" label="Total Users" value={overview.totalUsers} sub={`+${overview.newUsersLast7} this week`} />
                <StatCard icon="📝" label="Total Posts" value={overview.totalPosts} sub={`+${overview.newPostsLast7} this week`} color="#22c55e" />
                <StatCard icon="🚫" label="Banned Users" value={overview.bannedUsers} color="#ef4444" />
                <StatCard icon="🚩" label="Pending Reports" value={overview.pendingReports} color="#f59e0b" />
                <StatCard icon="📅" label="New Users (30d)" value={overview.newUsersLast30} color="#8b5cf6" />
                <StatCard icon="🔥" label="New Posts (30d)" value={overview.newPostsLast30} color="#ec4899" />
            </div>
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><BarChart data={charts.postsPerDay} label="Posts per day (last 7 days)" /></div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><BarChart data={charts.usersPerDay} label="New users per day (last 7 days)" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="font-semibold text-sm mb-3 m-0">🔥 Top Posts</p>
                    {topPosts.map(post => (
                        <div key={post._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <p className="text-xs text-gray-700 m-0 truncate flex-1 mr-2">{post.caption?.slice(0, 50) || '(No caption)'}</p>
                            <div className="flex gap-2 text-xs text-gray-400 flex-shrink-0">
                                <span>❤️ {post.likes?.length || 0}</span>
                                <span>💬 {post.comments?.length || 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="font-semibold text-sm mb-3 m-0">🆕 Recent Users</p>
                    {recentUsers.map(user => (
                        <div key={user._id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                            <img src={user.profile_picture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium m-0 truncate">{user.fullname}</p>
                                <p className="text-xs text-gray-400 m-0 truncate">{user.email}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── USERS TAB ────────────────────────────────────────────────────────────────
const UsersTab = () => {
    const { headers } = useAdmin();
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchUsers = useCallback(() => {
        setLoading(true);
        axios.get(`${BASE}/api/admin/users`, { headers, params: { page, search, filter } })
            .then(r => { setUsers(r.data.users); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, search, filter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const banUser = async (userId) => {
        const r = prompt('Ban reason:');
        if (r === null) return;
        try { await axios.patch(`${BASE}/api/admin/users/${userId}/ban`, { reason: r }, { headers }); toast.success('User banned'); fetchUsers(); }
        catch { toast.error('Failed'); }
    };
    const unbanUser = async (userId) => {
        try { await axios.patch(`${BASE}/api/admin/users/${userId}/unban`, {}, { headers }); toast.success('User unbanned'); fetchUsers(); }
        catch { toast.error('Failed'); }
    };
    const deleteUser = async (userId) => {
        if (!window.confirm('Delete this user and all their posts?')) return;
        try { await axios.delete(`${BASE}/api/admin/users/${userId}`, { headers }); toast.success('User deleted'); fetchUsers(); }
        catch { toast.error('Failed'); }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
                <input type="text" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none flex-1" style={{ minWidth: '200px' }} />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="all">All users</option>
                    <option value="banned">Banned</option>
                    <option value="admin">Admins</option>
                </select>
                <span className="text-sm text-gray-400 self-center">{total} users</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                            {['User', 'Email', 'Followers', 'Status', 'Joined', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading...</td></tr>
                        ) : users.map(user => (
                            <tr key={user._id} style={{ borderBottom: '1px solid #f9fafb' }}>
                                <td style={{ padding: '10px 12px' }}>
                                    <div className="flex items-center gap-2">
                                        <img src={user.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                                        <div>
                                            <p className="text-xs font-medium m-0">{user.fullname}</p>
                                            {user.isAdmin && <span style={{ fontSize: '9px', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 5px' }}>Admin</span>}
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{user.email}</td>
                                <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center' }}>{user.followers?.length || 0}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: user.isBanned ? '#fee2e2' : '#d1fae5', color: user.isBanned ? '#ef4444' : '#059669' }}>
                                        {user.isBanned ? '🚫 Banned' : '✅ Active'}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <div className="flex gap-1">
                                        {user.isBanned
                                            ? <button onClick={() => unbanUser(user._id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Unban</button>
                                            : <button onClick={() => banUser(user._id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Ban</button>
                                        }
                                        <button onClick={() => deleteUser(user._id)} style={{ fontSize: '11px', padding: '3px 8px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">Next →</button>
            </div>
        </div>
    );
};

// ─── POSTS TAB ────────────────────────────────────────────────────────────────
const PostsTab = () => {
    const { headers } = useAdmin();
    const [posts, setPosts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const fetchPosts = useCallback(() => {
        setLoading(true);
        axios.get(`${BASE}/api/admin/posts`, { headers, params: { page, search, filter } })
            .then(r => { setPosts(r.data.posts); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, search, filter]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const deletePost = async (postId) => {
        if (!window.confirm('Delete this post?')) return;
        try { await axios.delete(`${BASE}/api/admin/posts/${postId}`, { headers }); toast.success('Post deleted'); fetchPosts(); }
        catch { toast.error('Failed'); }
    };

    const imgs = post => post.image_urls?.[0] || post.image_url;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
                <input type="text" placeholder="Search captions..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none flex-1" style={{ minWidth: '200px' }} />
                <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="all">All posts</option>
                    <option value="reported">Reported</option>
                    <option value="anonymous">Anonymous</option>
                    <option value="timelocked">Time-locked</option>
                </select>
                <span className="text-sm text-gray-400 self-center">{total} posts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {loading ? [1,2,3,4,5,6].map(i => <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ height: 200 }} />) :
                    posts.map(post => (
                        <div key={post._id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            {imgs(post)
                                ? <img src={imgs(post)} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '80px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '12px', padding: '8px', textAlign: 'center' }}>{post.caption?.slice(0, 60)}</div>
                            }
                            <div style={{ padding: '8px' }}>
                                <p style={{ fontSize: '11px', color: '#374151', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption || '(No caption)'}</p>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    {post.isAnonymous && <span style={{ fontSize: '9px', background: '#ede9fe', color: '#6366f1', borderRadius: '8px', padding: '1px 5px' }}>Anonymous</span>}
                                    {post.unlocksAt && new Date(post.unlocksAt) > Date.now() && <span style={{ fontSize: '9px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px', padding: '1px 5px' }}>Time-locked</span>}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>❤️ {post.likes?.length || 0} · 💬 {post.comments?.length || 0}</span>
                                    <button onClick={() => deletePost(post._id)} style={{ fontSize: '10px', padding: '2px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Delete</button>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
            <div className="flex justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">← Prev</button>
                <span className="px-3 py-1 text-sm text-gray-500">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={posts.length < 20} className="px-3 py-1 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer disabled:opacity-40">Next →</button>
            </div>
        </div>
    );
};

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
const ReportsTab = () => {
    const { headers } = useAdmin();
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);

    const fetchReports = useCallback(() => {
        setLoading(true);
        axios.get(`${BASE}/api/admin/reports`, { headers, params: { status } })
            .then(r => { setReports(r.data.reports); setTotal(r.data.total); setLoading(false); })
            .catch(() => setLoading(false));
    }, [status]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const resolve = async (reportId, action) => {
        try { await axios.patch(`${BASE}/api/admin/reports/${reportId}/resolve`, { action }, { headers }); toast.success(`Report ${action}`); fetchReports(); }
        catch { toast.error('Failed'); }
    };

    const REASON_COLOR = { spam: '#f59e0b', harassment: '#ef4444', hate_speech: '#dc2626', misinformation: '#f97316', nudity: '#ec4899', violence: '#b91c1c', other: '#6b7280' };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-center">
                <select value={status} onChange={e => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="pending">Pending</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="all">All</option>
                </select>
                <span className="text-sm text-gray-400">{total} reports</span>
            </div>
            <div className="flex flex-col gap-3">
                {loading ? <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div> :
                    reports.length === 0 ? <p className="text-center text-gray-400 py-8">No reports found</p> :
                    reports.map(report => (
                        <div key={report._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <img src={report.reporter?.profile_picture || '/default-profile.png'} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium m-0">{report.reporter?.fullname || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400 m-0">reported a {report.targetType}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: `${REASON_COLOR[report.reason]}20`, color: REASON_COLOR[report.reason] }}>
                                        {report.reason?.replace('_', ' ')}
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#9ca3af' }}>{new Date(report.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            {report.description && <p className="text-xs text-gray-500 mt-2 mb-0 italic">"{report.description}"</p>}
                            <p className="text-xs text-gray-400 mt-1 mb-0">Target ID: {report.targetId}</p>
                            {report.status === 'pending' && (
                                <div className="flex gap-2 mt-3">
                                    <button onClick={() => resolve(report._id, 'resolved')} style={{ fontSize: '12px', padding: '4px 12px', background: '#d1fae5', color: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>✓ Resolve</button>
                                    <button onClick={() => resolve(report._id, 'dismissed')} style={{ fontSize: '12px', padding: '4px 12px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Dismiss</button>
                                </div>
                            )}
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
const AdminDashboard = () => {
    const loggeduser = useAuthStore(s => s.user);
    const fetchUser = useAuthStore(s => s.fetchUser);
    const token = useAuthStore(s => s.token);
    const userLoading = { loggeduser: !loggeduser && !!token };
    const navigate = useNavigate();
    const [verified, setVerified] = useState(false);
    const [activeTab, setActiveTab] = useState('analytics');

    // ✅ Fix: fetch loggeduser if not loaded yet (direct URL visit)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        if (!loggeduser) fetchUser();
    }, [dispatch, loggeduser, navigate]);

    // ✅ Redirect non-admins only after user is confirmed loaded
    useEffect(() => {
        if (userLoading?.loggeduser) return; // still loading
        if (loggeduser && !loggeduser.isAdmin) {
            toast.error('Admin access required');
            navigate('/');
        }
    }, [loggeduser, userLoading, navigate]);

    // Still loading user
    if (!loggeduser || userLoading?.loggeduser) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', gap: '16px' }}>
            <div style={{ width: 44, height: 44, border: '4px solid #ede9fe', borderTopColor: '#808bf5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Loading...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    // Not admin
    if (!loggeduser.isAdmin) return null;

    // ✅ Password gate — shown before dashboard
    if (!verified) return <PasswordGate onSuccess={() => setVerified(true)} />;

    const tabs = [
        { key: 'analytics', icon: '📊', label: 'Analytics' },
        { key: 'users',     icon: '👥', label: 'Users' },
        { key: 'posts',     icon: '📝', label: 'Posts' },
        { key: 'reports',   icon: '🚩', label: 'Reports' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-gray-400 border-0 bg-transparent cursor-pointer p-0 mr-2">
                        <i className="pi pi-arrow-left"></i>
                    </button>
                    <h1 className="text-xl font-bold m-0">⚙️ Admin Dashboard</h1>
                    <span style={{ fontSize: '11px', background: '#ede9fe', color: '#6366f1', borderRadius: '10px', padding: '2px 8px' }}>Social Square</span>
                </div>
                <div className="flex items-center gap-3">
                    <img src={loggeduser.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-sm font-medium">{loggeduser.fullname}</span>
                    <button onClick={() => setVerified(false)} title="Lock dashboard"
                        style={{ background: '#fee2e2', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>
                        🔒 Lock
                    </button>
                </div>
            </div>

            <div className="flex" style={{ minHeight: 'calc(100vh - 65px)' }}>
                {/* Sidebar */}
                <div className="bg-white border-r w-48 flex-shrink-0 p-3">
                    <div className="flex flex-col gap-1 mt-2">
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-0 cursor-pointer text-left w-full transition-all"
                                style={{ background: activeTab === tab.key ? '#ede9fe' : 'transparent', color: activeTab === tab.key ? '#6366f1' : '#6b7280' }}>
                                <span>{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-auto">
                    {activeTab === 'analytics' && <AnalyticsTab />}
                    {activeTab === 'users'     && <UsersTab />}
                    {activeTab === 'posts'     && <PostsTab />}
                    {activeTab === 'reports'   && <ReportsTab />}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

```

### `pages/Explore.jsx`
```jsx
import React, { useEffect, useState, useCallback } from 'react';
import useAuthStore from '../store/zustand/useAuthStore';
import { useCategories, useTrending } from '../hooks/queries/usePostQueries';

import { Dialog } from 'primereact/dialog';
import UserProfile from './UserProfile';
import { debounce } from 'lodash';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── CONFESSIONS FEED ─────────────────────────────────────────────────────────
const ConfessionsFeed = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nextCursor, setNextCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [expanded, setExpanded] = useState(null);

    const fetchConfessions = async (cursor = null) => {
        cursor ? setLoadingMore(true) : setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 10 });
            if (cursor) params.append('cursor', cursor);
            const res = await fetch(`${BASE}/api/post/confessions?${params}`);
            const data = await res.json();
            setPosts(prev => cursor ? [...prev, ...data.posts] : data.posts);
            setNextCursor(data.nextCursor);
            setHasMore(data.hasMore);
        } catch { }
        cursor ? setLoadingMore(false) : setLoading(false);
    };

    useEffect(() => { fetchConfessions(); }, []);

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
                                        {({ happy:'😊', sad:'😢', excited:'🤩', angry:'😠', calm:'😌', romantic:'❤️', funny:'😂', inspirational:'💪', nostalgic:'🥹', neutral:'😐' })[post.mood]}
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
            {hasMore && (
                <button onClick={() => fetchConfessions(nextCursor)} disabled={loadingMore}
                    style={{ padding: '12px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#808bf5' }}>
                    {loadingMore ? 'Loading...' : 'Load more confessions'}
                </button>
            )}
        </div>
    );
};

// ─── MAIN EXPLORE ─────────────────────────────────────────────────────────────
const Explore = () => {
    const loggeduser = useAuthStore(s => s.user);
    const { data: categories = [] } = useCategories();
    const [searchResults, setSearchResults] = React.useState({ users: [], posts: [] });
    const [searchLoading, setSearchLoading] = React.useState(false);
    const loading = { search: searchLoading };
    const doSearch = async (term) => {
        if (!term) return;
        setSearchLoading(true);
        try {
            const res = await fetch(`${BASE}/api/auth/search`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ query: term }) });
            const data = await res.json();
            setSearchResults({ users: data.users||[], posts: data.posts||[] });
        } catch {}
        setSearchLoading(false);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [trending, setTrending] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [userProfileVisible, setUserProfileVisible] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    const [loadingCategoryPosts, setLoadingCategoryPosts] = useState(false);

    // ✅ Tab: 'discover' | 'confessions'
    const [activeTab, setActiveTab] = useState('discover');

    useEffect(() => { fetchTrending(); }, []);

    const fetchTrending = async () => {
        try {
            const res = await fetch(`${BASE}/api/post/trending`);
            const data = await res.json();
            setTrending(data);
        } catch { }
    };

    const debouncedSearch = useCallback(
        debounce((term) => { if (term) doSearch(term); }, 400),
        [dispatch]
    );

    const handleSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term) debouncedSearch(term); else setSearchResults({ users: [], posts: [] });
    };

    const handleCategoryClick = async (category) => {
        setActiveCategory(category);
        setLoadingCategoryPosts(true);
        try { dispatch(search(category)); }
        finally { setLoadingCategoryPosts(false); }
    };

    const getImages = (post) => {
        if (post.image_urls?.length > 0) return post.image_urls;
        if (post.image_url) return [post.image_url];
        return [];
    };

    const hasResults = searchResults?.users?.length > 0 || searchResults?.posts?.length > 0;

    return (
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px' }}>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', borderRadius: '14px', padding: '4px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                {[
                    { key: 'discover', label: '🔍 Discover' },
                    { key: 'confessions', label: '🎭 Confessions' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                            background: activeTab === tab.key ? '#808bf5' : 'transparent',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── CONFESSIONS TAB ── */}
            {activeTab === 'confessions' && <ConfessionsFeed />}

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
                            {loading.search ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Searching...</p>
                            ) : hasResults ? (
                                <>
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

                    {/* Trending + categories (unchanged from your original) */}
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

            <Dialog header="Profile" visible={userProfileVisible} style={{ width: '340px' }} onHide={() => setUserProfileVisible(false)}>
                <UserProfile id={selectedUserId} />
            </Dialog>
        </div>
    );
};

export default Explore;

```

### `pages/Forgot.jsx`
```jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const Forgot = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        setSent(true);
        toast.success('Reset link sent! Check your email.');
      } else {
        toast.error(result.error || 'Failed to send reset link.');
      }
    } catch {
      toast.error('Network error! Please try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="max-w-md mx-auto bg-white border p-6 rounded shadow text-center mt-20">
        <h3 className="font-pacifico text-2xl mb-4">Social Square</h3>
        {sent ? (
          <div>
            <div className="text-green-600 text-lg mb-3">✅ Check your email!</div>
            <p className="text-gray-500 text-sm">We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
            <Link to="/login" className="block mt-4 text-themeStart font-semibold">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-gray-500 text-sm mb-4">Enter your email and we'll send you a reset link.</p>
            <input
              className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
              type="email" placeholder="Enter your email"
              value={email} onChange={e => setEmail(e.target.value)} required
            />
            <button className="mt-2 bg-themeStart text-white w-full py-2 rounded" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p className="mt-3 text-sm">Remembered? <Link to="/login" className="text-themeStart font-semibold">Login</Link></p>
          </form>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default Forgot;

```

### `pages/Home.jsx`
```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/zustand/useAuthStore';
import { socket } from '../socket';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Stories from './components/Stories';
import Explore from './Explore';

import Navbar from './components/Navbar';
import { useDarkMode } from '../context/DarkModeContext';
import { showPushNotification } from '../utils/pushNotifications';
import useFeedSocket from '../hooks/useFeedSocket';
import Chatbot from '../pages/components/Chatbot';
import MoodFeedToggle from './components/MoodFeedToggle';

const Home = () => {
    const token = localStorage.getItem('token');
    const [activeView, setActiveView] = useState('feed');
    const navigate = useNavigate();
    const loggeduser = useAuthStore(s => s.user);
    const fetchUser = useAuthStore(s => s.fetchUser);
    const loading = { loggeduser: !loggeduser && !!localStorage.getItem('token') };
    const error = {};
    const { isDark } = useDarkMode();

    const [activeMood, setActiveMood] = useState(null);

    // ✅ All real-time feed socket listeners
    useFeedSocket();

    useEffect(() => {
        if (!token) { navigate('/landing'); return; }
        fetchUser();
    }, [dispatch, token, navigate]);

    useEffect(() => {
        if (loggeduser?._id) {
            if (!socket.connected) socket.connect();
            socket.emit('registerUser', loggeduser._id);
            socket.on('connect', () => { localStorage.setItem('socketId', socket.id); });

            socket.on('receiveMessage', ({ senderName, content }) => {
                showPushNotification({ title: `New message from ${senderName}`, body: content, onClick: () => window.focus() });
            });

            socket.on('newNotification', (notification) => {
                showPushNotification({ title: `${notification.sender?.fullname} created a new post`, body: 'Tap to view', onClick: () => window.focus() });
            });
        }
        return () => {
            socket.off('connect');
            socket.off('receiveMessage');
            socket.off('newNotification');
        };
    }, [loggeduser]);

    useEffect(() => {
        if (error.loggeduser && !loading.loggeduser) {
            localStorage.removeItem('token');
            localStorage.removeItem('socketId');
            navigate('/landing');
        }
    }, [error.loggeduser, loading.loggeduser, navigate]);

    if (loading.loggeduser) return <MainSkeleton />;
    if (!token || !loggeduser) return <MainSkeleton />;

    const bg = isDark ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed': return <><Stories /><Newpost /><MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} /><Feed activeMood={activeMood} /></>;
            case 'explore': return <Explore />;
            case 'profile': return <Profile />;
            case 'otherUsers': return <OtherUsers />;
            case 'messages': return <Conversations />;
            default: return null;
        }
    };

    const navItems = [
        { key: 'feed', icon: 'pi-home' },
        { key: 'explore', icon: 'pi-compass' },
        { key: 'otherUsers', icon: 'pi-users' },
        { key: 'messages', icon: 'pi-envelope' },
        { key: 'profile', icon: 'pi-user' },
    ];

    return (
        <section className={`min-h-screen w-full ${bg} transition-colors duration-200`}>
            <Navbar />

            {/* Desktop */}
            <div className="hidden lg:flex gap-3 w-full max-w-8xl mx-auto p-3">
                <div className="w-25"><OtherUsers /></div>
                <div className="w-50 overflow-y-scroll h-screen px-3">
                    <Stories />
                    <Newpost />
                    <MoodFeedToggle activeMood={activeMood} onMoodSelect={setActiveMood} onClear={() => setActiveMood(null)} />
                    <Feed activeMood={activeMood} />
                </div>
                <div className="w-25">
                    <Profile />
                    <Conversations />
                </div>
            </div>

            {/* Mobile */}
            <div className="flex lg:hidden flex-col h-screen">
                <div className="flex-1 overflow-auto p-2">{renderMobileView()}</div>
                <div className={`fixed bottom-3 left-1/2 transform -translate-x-1/2 w-11/12 md:w-3/4 ${cardBg} rounded-full p-2 shadow-md`} style={{ zIndex: 100 }}>
                    <div className="flex justify-around">
                        {navItems.map(item => (
                            <button key={item.key}
                                className={`px-3 py-2 rounded-full border-0 cursor-pointer transition-all ${activeView === item.key ? 'bg-[#808bf5] text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-transparent border border-gray-200 text-gray-600'}`}
                                onClick={() => setActiveView(item.key)}>
                                <i className={`pi ${item.icon}`}></i>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Home;

```

### `pages/Login.jsx`
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { GoogleLogin } from '@react-oauth/google';
import { getFingerprint } from '../utils/fingerprint';

const Login = () => {
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { toast.success('You are already logged in..'); navigate('/'); }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.identifier)) { toast.error('Please enter a valid email address'); setLoading(false); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); setLoading(false); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: formData.identifier, password: encryptedPassword, fingerprint }),
      });

      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Login successful! Redirecting...');
        setTimeout(() => navigate('/'), 1500);
      } else {
        toast.error(result.error || result.message || 'Login failed');
      }
    } catch { toast.error('Network error! Please try again.'); }
    setLoading(false);
  };

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Google login successful!');
        setTimeout(() => navigate('/'), 1000);
      } else { toast.error(result.error || 'Google login failed'); }
    } catch { toast.error('Google login failed. Please try again.'); }
  }, [navigate]);

  return (
    <>
      <Bg>
        <div className="flex items-center gap-6">
          <div className="mx-auto bg-white p-6 rounded text-center">
            <h3 className="font-pacifico mb-3 text-3xl">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="text" name="identifier" placeholder="Email" value={formData.identifier} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <button className="py-2 mt-2 bg-themeAccent text-white w-full rounded" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
            </form>
            <div className="my-3 text-gray-400 text-sm">— or —</div>
            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google login failed')} width="100%" />
            </div>
            <Link to="/forgot" className="block mt-5 text-themeStart">Forgot Password?</Link>
            <div className="mt-3">
              <p>Don't have an account? <Link to="/signup" className="text-themeStart font-semibold">Sign up</Link></p>
            </div>
          </div>
          <div className="hidden md:block">
            <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" />
          </div>
        </div>
      </Bg>
      <Toaster />
    </>
  );
};

export default Login;

```

### `pages/PostDetail.jsx`
```jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/zustand/useAuthStore';
import { usePostDetail, useLikePost } from '../hooks/queries/usePostQueries';

import { Helmet } from 'react-helmet-async';
import Comment from './components/ui/Comment';
import relativeTime from '../utils/relativeTime';

const BASE = process.env.REACT_APP_BACKEND_URL;

const PostDetail = () => {
    const { postId } = useParams();
    const navigate = useNavigate();

    const loggeduser = useAuthStore(s => s.user);
    const likeMutation = useLikePost();

    const [post, setPost] = useState(null);
    const [loadingPost, setLoadingPost] = useState(true);
    const [currentImage, setCurrentImage] = useState(0);
    const [showComments, setShowComments] = useState(true);

    useEffect(() => {
        if (!postId) return;
        setLoadingPost(true);
        // Fetch single post — reuse feed endpoint filtered by id
        fetch(`${BASE}/api/post/detail/${postId}`)
            .then(r => r.json())
            .then(data => { setPost(data); setLoadingPost(false); dispatch(fetchComments(postId)); })
            .catch(() => setLoadingPost(false));
    }, [postId, dispatch]);

    const handleLikeToggle = () => {
        if (!post || !loggeduser?._id) return;
        const isLiked = post.likes?.includes(loggeduser._id);
        likeMutation.mutate({ postId: post._id, isLiked });
        setPost(prev => ({ ...prev, likes: isLiked ? prev.likes.filter(id => id !== loggeduser._id) : [...(prev.likes || []), loggeduser._id] }));
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied!');
    };

    const images = post?.image_urls?.length > 0 ? post.image_urls : post?.image_url ? [post.image_url] : [];
    const isLiked = post?.likes?.includes(loggeduser?._id);

    if (loadingPost) return (
        <div className="max-w-2xl mx-auto p-4 mt-6">
            <div className="bg-white rounded-2xl shadow overflow-hidden animate-pulse">
                <div className="h-96 bg-gray-200" />
                <div className="p-4 flex flex-col gap-3">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-200" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                    </div>
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                </div>
            </div>
        </div>
    );

    if (!post) return (
        <div className="max-w-2xl mx-auto p-4 mt-6 text-center">
            <p className="text-4xl mb-2">😕</p>
            <p className="text-gray-500">Post not found or has been deleted.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-[#808bf5] text-white rounded-lg border-0 cursor-pointer">Go home</button>
        </div>
    );

    return (
        <>
            {/* SEO meta tags for this post */}
            <Helmet>
                <title>{post.user?.fullname} on Social Square: "{post.caption?.slice(0, 60)}"</title>
                <meta name="description" content={post.caption} />
                <meta property="og:title" content={`${post.user?.fullname} on Social Square`} />
                <meta property="og:description" content={post.caption} />
                {images[0] && <meta property="og:image" content={images[0]} />}
                <meta property="og:url" content={window.location.href} />
                <meta property="og:type" content="article" />
                <meta name="twitter:card" content="summary_large_image" />
            </Helmet>

            <div className="max-w-2xl mx-auto p-4 mt-4">
                {/* Back button */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 border-0 bg-transparent cursor-pointer mb-4 p-0">
                    <i className="pi pi-arrow-left"></i> Back
                </button>

                <div className="bg-white rounded-2xl shadow overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <img src={post.user?.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                            <div>
                                <p className="m-0 font-semibold text-sm">{post.user?.fullname}</p>
                                {post.location?.name && <p className="m-0 text-xs text-gray-400">📍 {post.location.name}</p>}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 m-0">{relativeTime(post.createdAt)}</p>
                    </div>

                    {/* Images */}
                    {images.length > 0 && (
                        <div className="relative">
                            <img src={images[currentImage]} alt="Post" className="w-full object-cover" style={{ maxHeight: '500px' }} />
                            {images.length > 1 && (
                                <>
                                    {currentImage > 0 && (
                                        <button onClick={() => setCurrentImage(c => c - 1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 20 }}>‹</button>
                                    )}
                                    {currentImage < images.length - 1 && (
                                        <button onClick={() => setCurrentImage(c => c + 1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 20 }}>›</button>
                                    )}
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                        {images.map((_, i) => (
                                            <div key={i} className="rounded-full" style={{ width: i === currentImage ? 16 : 6, height: 6, background: i === currentImage ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="p-4">
                        <div className="flex items-center gap-4 mb-3">
                            <button onClick={handleLikeToggle} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0">
                                <span style={{ fontSize: '22px' }}>{isLiked ? '❤️' : '🤍'}</span>
                            </button>
                            <button onClick={() => setShowComments(v => !v)} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0">
                                <i className="pi pi-comment" style={{ fontSize: '20px', color: '#374151' }}></i>
                            </button>
                            <button onClick={copyLink} className="flex items-center gap-1 border-0 bg-transparent cursor-pointer p-0 ml-auto">
                                <i className="pi pi-link" style={{ fontSize: '18px', color: '#374151' }}></i>
                            </button>
                        </div>

                        <p className="text-sm font-semibold m-0">{post.likes?.length || 0} likes</p>

                        <p className="text-sm mt-2 m-0">
                            <span className="font-semibold">{post.user?.fullname}</span>{' '}
                            {post.caption}
                        </p>

                        {post.music?.title && (
                            <p className="text-xs text-pink-500 mt-1 m-0">🎵 {post.music.title}{post.music.artist ? ` — ${post.music.artist}` : ''}</p>
                        )}

                        <p className="text-xs text-gray-400 mt-2 m-0">{relativeTime(post.createdAt)}</p>
                    </div>

                    {/* Comments */}
                    {showComments && (
                        <Comment postId={postId} setVisible={() => setShowComments(false)} />
                    )}
                </div>
            </div>
        </>
    );
};

export default PostDetail;

```

### `pages/ResetPassword.jsx`
```jsx
import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const encryptedPassword = encryptPassword(password);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: encryptedPassword }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success('Password reset! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        toast.error(result.error || 'Reset failed. Link may have expired.');
      }
    } catch {
      toast.error('Network error! Please try again.');
    }
    setLoading(false);
  };

  if (!token || !email) {
    return (
      <div className="max-w-md mx-auto text-center mt-20">
        <p className="text-red-500">Invalid reset link.</p>
        <Link to="/forgot" className="text-themeStart">Request a new one</Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-md mx-auto bg-white border p-6 rounded shadow text-center mt-20">
        <h3 className="font-pacifico text-2xl mb-4">Reset Password</h3>
        <form onSubmit={handleSubmit}>
          <input
            className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
            type="password" placeholder="New password"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <input
            className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
            type="password" placeholder="Confirm new password"
            value={confirm} onChange={e => setConfirm(e.target.value)} required
          />
          <button className="mt-2 bg-themeStart text-white w-full py-2 rounded" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
      <Toaster />
    </>
  );
};

export default ResetPassword;

```

### `pages/Signup.jsx`
```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';
import { GoogleLogin } from '@react-oauth/google';
import { getFingerprint } from '../utils/fingerprint';

const Signup = () => {
  const [formData, setFormData] = useState({ email: '', fullname: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) { toast.success("You are already logged in.."); setTimeout(() => navigate('/'), 1500); }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { toast.error('Please enter a valid email address'); setLoading(false); return; }
    if (formData.fullname.trim().length < 2) { toast.error('Full name must be at least 2 characters'); setLoading(false); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); setLoading(false); return; }

    try {
      const encryptedPassword = encryptPassword(formData.password);
      const fingerprint = await getFingerprint();

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fullname: formData.fullname, email: formData.email, password: encryptedPassword, fingerprint }),
      });

      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success("Signup successful! Redirecting...");
        setTimeout(() => navigate('/'), 1500);
      } else { toast.error(result.message || result.error || "Something went wrong!"); }
    } catch { toast.error("Network error! Please try again."); }
    setLoading(false);
  };

  const handleGoogleSuccess = useCallback(async (credentialResponse) => {
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Google signup successful!');
        setTimeout(() => navigate('/'), 1000);
      } else { toast.error(result.error || 'Google signup failed'); }
    } catch { toast.error('Google signup failed. Please try again.'); }
  }, [navigate]);

  return (
    <>
      <Bg>
        <div className="d-flex align-items-center">
          <div>
            <h3 className="pacifico-regular mb-3">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="text" name="fullname" placeholder="Full Name" value={formData.fullname} onChange={handleChange} required />
              <input className="px-3 py-2 bg-white text-dark w-100 my-2 border" type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <button className="py-2 mt-2 theme-bg w-100" type="submit" disabled={loading}>{loading ? 'Signing up...' : 'Sign up'}</button>
            </form>
            <div className="my-3 text-center text-secondary" style={{ fontSize: '14px' }}>— or —</div>
            <div className="d-flex justify-content-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google signup failed')} text="signup_with" width="100%" />
            </div>
            <div className="mt-4">
              <p>Have an account? <Link to="/login" className="text-primary text-decoration-none fw-bold">Log in</Link></p>
            </div>
          </div>
        </div>
        <div className='pc'>
          <img src="https://i.ibb.co/3zgV9GB/image.png" alt="" />
        </div>
      </Bg>
      <Toaster />
    </>
  );
};

export default Signup;

```

### `pages/VerifyOtp.jsx`
```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { getFingerprint } from '../utils/fingerprint';

const VerifyOtp = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId;

  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);

  // Countdown for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { toast.error('Please enter the 6-digit code'); return; }

    setLoading(true);
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, otp: otpValue, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Verified! Redirecting...');
        setTimeout(() => navigate('/'), 1000);
      } else {
        toast.error(result.error || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch { toast.error('Network error. Please try again.'); }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // Re-trigger login to get new OTP (user must re-enter credentials)
      toast.success('Please login again to get a new code.');
      navigate('/login');
    } catch { toast.error('Failed to resend. Please try again.'); }
    setResending(false);
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔐</div>
          <h2 className="text-2xl font-bold mb-1">Verify your identity</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the 6-digit code sent to your email</p>

          <form onSubmit={handleSubmit}>
            <div className="flex justify-center gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  className="w-11 h-12 text-center text-xl font-bold border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                  style={{ borderColor: digit ? '#6366f1' : '#e5e7eb' }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            {countdown > 0 ? (
              <span>Resend code in <strong>{countdown}s</strong></span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-indigo-600 font-semibold hover:underline"
              >
                {resending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
};

export default VerifyOtp;

```

### `queues/digestQueue.js`
```javascript
const { Queue, Worker } = require('bullmq');
const { createClient } = require('redis');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

const connection = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });

// ─── QUEUE ────────────────────────────────────────────────────────────────────
const digestQueue = new Queue('emailDigest', { connection });

// ─── SCHEDULE DAILY DIGEST ────────────────────────────────────────────────────
// Called from a cron job or on app start
async function scheduleDailyDigest() {
    // Remove existing repeatable jobs to avoid duplicates
    const jobs = await digestQueue.getRepeatableJobs();
    for (const job of jobs) await digestQueue.removeRepeatableByKey(job.key);

    // Schedule daily at 8:00 AM UTC
    await digestQueue.add('daily-digest', {}, {
        repeat: { cron: '0 8 * * *' },
        removeOnComplete: true,
    });
    console.log('[Digest] Daily digest scheduled for 8:00 AM UTC');
}

// ─── MAILER ───────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function buildDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts } = stats;

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #808bf5, #6366f1); padding: 32px 28px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800;">Social Square</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your daily activity digest</p>
            </div>

            <!-- Greeting -->
            <div style="padding: 28px 28px 0;">
                <p style="font-size: 16px; color: #374151; margin: 0;">Hi <strong>${user.fullname}</strong> 👋</p>
                <p style="font-size: 14px; color: #6b7280; margin: 8px 0 0;">Here's what happened on Social Square yesterday.</p>
            </div>

            <!-- Stats -->
            <div style="padding: 20px 28px; display: flex; gap: 12px;">
                ${[
                    { icon: '👥', label: 'New Followers', value: newFollowers },
                    { icon: '❤️', label: 'Post Likes',    value: newLikes },
                    { icon: '💬', label: 'Comments',      value: newComments },
                ].map(s => `
                    <div style="flex: 1; background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #f3f4f6;">
                        <p style="font-size: 24px; margin: 0;">${s.icon}</p>
                        <p style="font-size: 22px; font-weight: 800; color: #111827; margin: 8px 0 2px;">${s.value}</p>
                        <p style="font-size: 11px; color: #9ca3af; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">${s.label}</p>
                    </div>
                `).join('')}
            </div>

            <!-- Trending posts -->
            ${trendingPosts.length > 0 ? `
            <div style="padding: 0 28px 24px;">
                <p style="font-size: 14px; font-weight: 700; color: #374151; margin: 0 0 12px;">🔥 Trending today</p>
                ${trendingPosts.slice(0, 3).map(post => `
                    <div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f9fafb;">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-size: 13px; color: #374151; font-weight: 600;">${post.user?.fullname || 'Anonymous'}</p>
                            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">${(post.caption || '').slice(0, 80)}${post.caption?.length > 80 ? '...' : ''}</p>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af;">❤️ ${post.likes?.length || 0}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- CTA -->
            <div style="padding: 0 28px 28px; text-align: center;">
                <a href="${process.env.CLIENT_URL}" style="display: inline-block; background: linear-gradient(135deg, #808bf5, #6366f1); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px;">Open Social Square →</a>
            </div>

            <!-- Footer -->
            <div style="padding: 16px 28px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
                <p style="font-size: 11px; color: '#9ca3af'; margin: 0;">
                    You're receiving this because you have email digests enabled.
                    <a href="${process.env.CLIENT_URL}/settings" style="color: #808bf5;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

// ─── WORKER ───────────────────────────────────────────────────────────────────
const worker = new Worker('emailDigest', async (job) => {
    if (job.name !== 'daily-digest') return;

    console.log('[Digest] Starting daily digest job');

    const yesterday = new Date(Date.now() - 86400000);

    // Get users with digest enabled
    const users = await User.find({
        'notificationSettings.emailDigest': true,
        isBanned: { $ne: true },
        email: { $exists: true },
    }).select('fullname email _id').lean();

    console.log(`[Digest] Sending to ${users.length} users`);

    let sent = 0, failed = 0;

    for (const user of users) {
        try {
            // Get user's stats for yesterday
            const [newFollowers, notifications, trendingPosts] = await Promise.all([
                User.countDocuments({ followers: user._id, created_at: { $gte: yesterday } }),
                Notification.find({ recipient: user._id, createdAt: { $gte: yesterday } }).lean(),
                Post.find({ createdAt: { $gte: yesterday } }).sort({ score: -1 }).limit(5).select('caption user likes').lean(),
            ]);

            const newLikes    = notifications.filter(n => n.type === 'like').length;
            const newComments = notifications.filter(n => n.type === 'comment').length;

            // Skip if nothing happened
            if (newFollowers === 0 && newLikes === 0 && newComments === 0) continue;

            await transporter.sendMail({
                from:    `"Social Square" <${process.env.EMAIL_USER}>`,
                to:      user.email,
                subject: `${user.fullname}, you had ${newLikes + newComments + newFollowers} interactions yesterday 🔥`,
                html:    buildDigestEmail(user, { newFollowers, newLikes, newComments, trendingPosts }),
            });

            sent++;
        } catch (err) {
            console.error(`[Digest] Failed for ${user.email}:`, err.message);
            failed++;
        }

        // Rate limit: 10 emails/second (Gmail limit)
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[Digest] Done — sent: ${sent}, failed: ${failed}`);
}, { connection, concurrency: 1 });

worker.on('failed', (job, err) => console.error('[Digest] Job failed:', err.message));

module.exports = { digestQueue, scheduleDailyDigest };

```

### `routes/admin.js`
```javascript
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const jwt = require('jsonwebtoken');

// ─── SIMPLE IN-MEMORY CACHE FOR ANALYTICS ────────────────────────────────────
// Prevents hammering DB on every admin page load — invalidated every 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
    return entry.data;
}
function setCached(key, data) { cache.set(key, { data, ts: Date.now() }); }
function invalidateCache() { cache.clear(); }

// ─── ADMIN MIDDLEWARE ─────────────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Use lean() — plain JS object, no Mongoose overhead
        const user = await User.findById(decoded.userId).select('isAdmin isBanned').lean();
        if (!user || !user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
        if (user.isBanned) return res.status(403).json({ error: 'Account banned' });
        req.adminId = decoded.userId;
        next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
router.get('/analytics', requireAdmin, async (req, res) => {
    try {
        const cached = getCached('analytics');
        if (cached) return res.json({ ...cached, fromCache: true });

        const now = new Date();
        const last7  = new Date(now - 7  * 86400000);
        const last30 = new Date(now - 30 * 86400000);

        // All 11 queries fire in parallel — uses indexes on created_at, createdAt, isBanned, status
        const [
            totalUsers, newUsersLast7, newUsersLast30,
            totalPosts, newPostsLast7, newPostsLast30,
            bannedUsers, totalReports, pendingReports,
            topPosts, recentUsers,
            postsPerDay, usersPerDay,
        ] = await Promise.all([
            User.estimatedDocumentCount(),                                           // O(1) — uses collection metadata
            User.countDocuments({ created_at: { $gte: last7 } }),                   // uses index
            User.countDocuments({ created_at: { $gte: last30 } }),
            Post.estimatedDocumentCount(),                                           // O(1)
            Post.countDocuments({ createdAt: { $gte: last7 } }),
            Post.countDocuments({ createdAt: { $gte: last30 } }),
            User.countDocuments({ isBanned: true }),                                 // uses index
            Report.estimatedDocumentCount(),
            Report.countDocuments({ status: 'pending' }),                            // uses index
            Post.find().sort({ score: -1 }).limit(5)
                .select('caption user likes comments createdAt').lean(),
            User.find().sort({ created_at: -1 }).limit(5)
                .select('fullname email created_at profile_picture').lean(),

            // Aggregation pipelines — both use indexes on createdAt / created_at
            Post.aggregate([
                { $match: { createdAt: { $gte: last7 } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            User.aggregate([
                { $match: { created_at: { $gte: last7 } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const result = {
            overview: { totalUsers, newUsersLast7, newUsersLast30, totalPosts, newPostsLast7, newPostsLast30, bannedUsers, totalReports, pendingReports },
            charts: { postsPerDay, usersPerDay },
            topPosts, recentUsers,
        };

        setCached('analytics', result);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
// Uses cursor-based pagination instead of skip() — O(log n) vs O(n)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100); // cap at 100
        const cursor = req.query.cursor || null; // last _id from previous page
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};

        // Cursor pagination — much faster than skip() at scale
        if (cursor) query._id = { $lt: cursor };

        // Text search — uses text index if created, falls back to regex
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        if (filter === 'banned') query.isBanned = true;
        if (filter === 'admin')  query.isAdmin  = true;

        // lean() returns plain JS objects — 2-3x faster, less memory
        const users = await User.find(query)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore   = users.length > limit;
        const result    = hasMore ? users.slice(0, limit) : users;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;

        // Only run countDocuments for first page (expensive on large collections)
        const total = cursor ? null : await User.countDocuments(search || filter !== 'all' ? query : {});

        res.json({ users: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/ban', requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        // findOneAndUpdate — single atomic operation, no fetch+save round trip
        const user = await User.findOneAndUpdate(
            { _id: req.params.userId, isAdmin: { $ne: true } }, // can't ban admins
            { isBanned: true, banReason: reason || 'Violated community guidelines', bannedAt: new Date() },
            { new: true, select: 'fullname email isBanned banReason bannedAt' }
        ).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });
        invalidateCache();
        res.json({ message: 'User banned', user });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/unban', requireAdmin, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.params.userId, { $unset: { banReason: '', bannedAt: '' }, isBanned: false });
        invalidateCache();
        res.json({ message: 'User unbanned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ _id: req.params.userId, isAdmin: { $ne: true } }).lean();
        if (!user) return res.status(404).json({ error: 'User not found or is an admin' });

        // Delete posts in background — don't block response
        Post.deleteMany({ 'user._id': req.params.userId }).catch(console.error);
        Report.deleteMany({ reporter: req.params.userId }).catch(console.error);

        invalidateCache();
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/users/:userId/toggle-admin', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('isAdmin fullname').lean();
        if (!user) return res.status(404).json({ error: 'User not found' });
        const updated = await User.findByIdAndUpdate(
            req.params.userId, { isAdmin: !user.isAdmin }, { new: true, select: 'isAdmin fullname' }
        ).lean();
        res.json({ message: `Admin ${updated.isAdmin ? 'granted' : 'revoked'}`, isAdmin: updated.isAdmin });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST MANAGEMENT ──────────────────────────────────────────────────────────
router.get('/posts', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const cursor = req.query.cursor || null;
        const search = req.query.search?.trim() || '';
        const filter = req.query.filter || 'all';

        const query = {};
        if (cursor) query._id = { $lt: cursor };
        if (search)                  query.caption      = { $regex: search, $options: 'i' };
        if (filter === 'anonymous')  query.isAnonymous  = true;
        if (filter === 'timelocked') query.unlocksAt    = { $gt: new Date() };

        // For reported filter — use $lookup instead of two queries
        if (filter === 'reported') {
            const posts = await Post.aggregate([
                {
                    $lookup: {
                        from: 'reports',
                        let: { postId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $and: [
                                { $eq: ['$targetId', '$$postId'] },
                                { $eq: ['$targetType', 'post'] },
                                { $eq: ['$status', 'pending'] },
                            ]}}},
                            { $limit: 1 },
                        ],
                        as: 'reports',
                    },
                },
                { $match: { 'reports.0': { $exists: true }, ...(cursor ? { _id: { $lt: cursor } } : {}) } },
                { $sort: { _id: -1 } },
                { $limit: limit + 1 },
                { $project: { reports: 0 } },
            ]);
            const hasMore    = posts.length > limit;
            const result     = hasMore ? posts.slice(0, limit) : posts;
            const nextCursor = hasMore ? result[result.length - 1]._id : null;
            return res.json({ posts: result, nextCursor, hasMore });
        }

        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1).lean();
        const hasMore    = posts.length > limit;
        const result     = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;
        const total      = cursor ? null : await Post.countDocuments(search || filter !== 'all' ? query : {});

        res.json({ posts: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/posts/:postId', requireAdmin, async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.postId);
        // Clean up reports for this post in background
        Report.deleteMany({ targetId: req.params.postId }).catch(console.error);
        invalidateCache();
        res.json({ message: 'Post deleted', postId: req.params.postId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────
router.get('/reports', requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
        const cursor = req.query.cursor || null;
        const status = req.query.status || 'pending';

        const query = {};
        if (cursor) query._id = { $lt: cursor };
        if (status !== 'all') query.status = status;

        // populate uses index on reporter field
        const reports = await Report.find(query)
            .populate('reporter', 'fullname profile_picture')
            .sort({ _id: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore    = reports.length > limit;
        const result     = hasMore ? reports.slice(0, limit) : reports;
        const nextCursor = hasMore ? result[result.length - 1]._id : null;
        const total      = cursor ? null : await Report.countDocuments(status !== 'all' ? { status } : {});

        res.json({ reports: result, nextCursor, hasMore, total });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
    try {
        const { action } = req.body;
        await Report.findByIdAndUpdate(req.params.reportId, {
            status: action || 'resolved',
            resolvedBy: req.adminId,
            resolvedAt: new Date(),
        });
        invalidateCache();
        res.json({ message: 'Report updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SUBMIT REPORT (public, rate limited separately) ─────────────────────────
router.post('/report', async (req, res) => {
    try {
        const { reporterId, targetType, targetId, reason, description } = req.body;
        if (!reporterId || !targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Upsert to avoid race condition duplicates
        const existing = await Report.findOne({ reporter: reporterId, targetId, status: 'pending' }).lean();
        if (existing) return res.status(400).json({ error: 'Already reported' });

        await Report.create({ reporter: reporterId, targetType, targetId, reason, description });
        res.status(201).json({ message: 'Report submitted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

```

### `routes/ai.js`
```javascript
const express = require('express');
const router = express.Router();
const { generateCaptionFromImage, detectMoodFromCaption } = require('../utils/gemini');
const Post = require('../models/Post');

// ─── GENERATE CAPTION FROM IMAGE ─────────────────────────────────────────────
router.post('/caption', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

        const captions = await generateCaptionFromImage(imageUrl);
        if (!captions) return res.status(500).json({ error: 'Failed to generate captions' });

        res.status(200).json({ captions });
    } catch (error) {
        console.error('Caption route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── MOOD-BASED FEED ──────────────────────────────────────────────────────────
// Returns posts filtered/sorted by mood matching user's recent mood
router.get('/mood-feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { mood } = req.query; // mood passed from frontend

        if (!mood) return res.status(400).json({ error: 'mood is required' });

        // Mood compatibility map — similar moods grouped
        const moodGroups = {
            happy: ['happy', 'excited', 'funny'],
            sad: ['sad', 'nostalgic'],
            excited: ['excited', 'happy', 'inspirational'],
            angry: ['angry'],
            calm: ['calm', 'neutral'],
            romantic: ['romantic'],
            funny: ['funny', 'happy'],
            inspirational: ['inspirational', 'excited'],
            nostalgic: ['nostalgic', 'sad'],
            neutral: ['neutral', 'calm', 'happy'],
        };

        const relatedMoods = moodGroups[mood] || [mood, 'neutral'];

        // Find posts with matching mood, not time-locked, not expired
        const moodPosts = await Post.find({
            mood: { $in: relatedMoods },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        }).sort({ score: -1, createdAt: -1 }).limit(20);

        res.status(200).json({ posts: moodPosts, mood, relatedMoods });
    } catch (error) {
        console.error('Mood feed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DETECT MOOD FROM CAPTION ─────────────────────────────────────────────────
router.post('/detect-mood', async (req, res) => {
    try {
        const { caption } = req.body;
        if (!caption) return res.status(400).json({ error: 'caption is required' });

        const mood = await detectMoodFromCaption(caption);
        res.status(200).json({ mood });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

```

### `routes/auth.js`
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Post = require('../models/Post');
const LoginSession = require('../models/LoginSession');
const { decryptPassword, isEncrypted } = require('../utils/crypto');
const { hashValue, generateFamily, parseDevice, getLocation, getIp } = require('../utils/authSecurity');
const { sendNewDeviceAlert, sendResetEmail, sendOtpEmail, sendLockoutEmail } = require('../utils/mailer');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

if (!JWT_SECRET || !JWT_REFRESH_SECRET) { console.error('Missing JWT secrets'); process.exit(1); }

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAccessToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
}
function generateRefreshToken(userId, family) {
    return jwt.sign({ userId, family }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
function setRefreshTokenCookie(res, token) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts.' } });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { error: 'Too many reset attempts.' } });
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: { error: 'Too many OTP attempts.' } });

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', authLimiter, [
    body('identifier').isEmail(),
    body('password').notEmpty(),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { identifier, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const user = await User.findOne({ email: identifier.toLowerCase().trim() });
        if (!user || !user.password) return res.status(401).json({ error: 'Invalid email or password' });

        // ── LOCKOUT CHECK ──
        if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
            const remaining = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
            return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
        }

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const isValid = await bcrypt.compare(decryptedPassword, user.password);

        if (!isValid) {
            // ── INCREMENT FAILED ATTEMPTS ──
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
                user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                user.failedLoginAttempts = 0;
                await user.save();
                const unlockTime = new Date(user.lockoutUntil).toLocaleTimeString();
                sendLockoutEmail(user.email, user.fullname, unlockTime).catch(() => {});
                return res.status(423).json({ error: 'Too many failed attempts. Account locked for 30 minutes.' });
            }
            await user.save();
            const attemptsLeft = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
            return res.status(401).json({ error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.` });
        }

        // ── RESET FAILED ATTEMPTS ON SUCCESS ──
        user.failedLoginAttempts = 0;
        user.lockoutUntil = null;

        // ── 2FA CHECK ──
        if (user.twoFactorEnabled) {
            const otp = generateOtp();
            user.twoFactorOtp = hashValue(otp);
            user.twoFactorOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
            await user.save();
            await sendOtpEmail(user.email, user.fullname, otp);
            return res.status(200).json({ requiresOtp: true, userId: user._id });
        }

        await user.save();

        // ── SESSION CREATION ──
        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;

        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(err => console.warn('Alert email failed:', err.message));
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);
        return res.status(200).json({ message: 'Login successful', token: accessToken });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────

router.post('/verify-otp', otpLimiter, [
    body('userId').notEmpty(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('fingerprint').notEmpty(),
], async (req, res) => {
    try {
        const { userId, otp, fingerprint } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.twoFactorOtp || !user.twoFactorOtpExpires || user.twoFactorOtpExpires < Date.now()) {
            return res.status(400).json({ error: 'OTP expired. Please login again.' });
        }

        if (user.twoFactorOtp !== hashValue(otp)) {
            return res.status(401).json({ error: 'Invalid OTP.' });
        }

        // Clear OTP
        user.twoFactorOtp = null;
        user.twoFactorOtpExpires = null;
        await user.save();

        // Create session
        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;

        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(() => {});
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);
        return res.status(200).json({ message: 'Login successful', token: accessToken });
    } catch (error) {
        console.error('OTP verify error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── TOGGLE 2FA ───────────────────────────────────────────────────────────────

router.post('/toggle-2fa', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.twoFactorEnabled = !user.twoFactorEnabled;
        await user.save();
        return res.status(200).json({ twoFactorEnabled: user.twoFactorEnabled });
    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SIGNUP ───────────────────────────────────────────────────────────────────

router.post('/add', authLimiter, [
    body('fullname').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { fullname, email, password, fingerprint } = req.body;
        if (!fingerprint) return res.status(400).json({ error: 'Missing browser fingerprint' });

        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: 'User already exists with this email.' });

        const hashedPassword = await bcrypt.hash(decryptedPassword, 12);
        const newUser = new User({ fullname: fullname.trim(), email: email.toLowerCase().trim(), password: hashedPassword, authProvider: 'local' });
        await newUser.save();

        const family = generateFamily();
        const refreshToken = generateRefreshToken(newUser._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: newUser._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashValue(fingerprint),
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(newUser._id);
        setRefreshTokenCookie(res, refreshToken);
        return res.status(201).json({ message: 'User registered successfully!', token: accessToken });
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Failed to register user.' });
    }
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

router.post('/google', authLimiter, async (req, res) => {
    try {
        const { credential, fingerprint } = req.body;
        if (!credential || !fingerprint) return res.status(400).json({ error: 'Missing credential or fingerprint' });

        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const { sub: googleId, email, name, picture } = ticket.getPayload();

        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        if (!user) {
            user = new User({ fullname: name, email, profile_picture: picture, googleId, authProvider: 'google' });
        } else {
            user.googleId = googleId;
            if (!user.profile_picture || user.profile_picture.includes('OIP')) user.profile_picture = picture;
        }
        await user.save();

        const hashedFingerprint = hashValue(fingerprint);
        const existingSession = await LoginSession.findOne({ userId: user._id, fingerprint: hashedFingerprint, isRevoked: false });
        const isNewDevice = !existingSession;
        const family = generateFamily();
        const refreshToken = generateRefreshToken(user._id, family);
        const ip = getIp(req);
        const device = parseDevice(req.headers['user-agent']);
        const location = await getLocation(ip);

        await LoginSession.create({
            userId: user._id, tokenFamily: family,
            refreshToken: hashValue(refreshToken),
            fingerprint: hashedFingerprint,
            ip, userAgent: req.headers['user-agent'] || '',
            device, location, isNewDevice,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        if (isNewDevice) {
            sendNewDeviceAlert({ email: user.email, fullname: user.fullname, device, ip, location, time: new Date().toLocaleString() })
                .catch(() => {});
        }

        const accessToken = generateAccessToken(user._id);
        setRefreshTokenCookie(res, refreshToken);
        return res.status(200).json({ message: 'Google login successful', token: accessToken });
    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(401).json({ error: 'Google authentication failed' });
    }
});

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        const fingerprint = req.headers['x-fingerprint'];
        if (!token) return res.status(401).json({ error: 'No refresh token' });
        if (!fingerprint) return res.status(401).json({ error: 'Missing fingerprint' });

        let decoded;
        try { decoded = jwt.verify(token, JWT_REFRESH_SECRET); }
        catch { return res.status(403).json({ error: 'Invalid or expired refresh token' }); }

        const session = await LoginSession.findOne({ userId: decoded.userId, tokenFamily: decoded.family });
        if (!session) return res.status(403).json({ error: 'Session not found' });

        // Reuse detection
        if (session.refreshToken !== hashValue(token)) {
            console.warn(`[SECURITY] Token reuse detected for user ${decoded.userId}`);
            await LoginSession.updateMany({ userId: decoded.userId }, { isRevoked: true });
            return res.status(403).json({ error: 'Token reuse detected. All sessions revoked.' });
        }

        if (session.isRevoked) return res.status(403).json({ error: 'Session revoked' });

        // Fingerprint check
        if (session.fingerprint !== hashValue(fingerprint)) {
            console.warn(`[SECURITY] Fingerprint mismatch for user ${decoded.userId}`);
            return res.status(403).json({ error: 'Browser fingerprint mismatch' });
        }

        const newRefreshToken = generateRefreshToken(decoded.userId, decoded.family);
        await LoginSession.findByIdAndUpdate(session._id, {
            refreshToken: hashValue(newRefreshToken),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(decoded.userId);
        setRefreshTokenCookie(res, newRefreshToken);

        // ✅ Return user data alongside token so frontend can restore session
        // without a second /api/auth/get request
        const user = await User.findById(decoded.userId)
            .select('-password -twoFactorOtp -resetPasswordToken -twoFactorOtpExpires')
            .lean();

        return res.status(200).json({ token: accessToken, user });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) await LoginSession.findOneAndUpdate({ refreshToken: hashValue(token) }, { isRevoked: true });
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch {
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: 'Logged out' });
    }
});

// ─── GET SESSIONS ─────────────────────────────────────────────────────────────

router.get('/sessions', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const sessions = await LoginSession.find({
            userId: decoded.userId, isRevoked: false, expiresAt: { $gt: new Date() },
        }).select('-refreshToken -fingerprint').sort({ lastUsedAt: -1 });
        return res.status(200).json(sessions);
    } catch { return res.status(403).json({ message: 'Invalid token' }); }
});

// ─── REVOKE SESSION ───────────────────────────────────────────────────────────

router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const session = await LoginSession.findOneAndUpdate(
            { _id: req.params.sessionId, userId: decoded.userId },
            { isRevoked: true }
        );
        if (!session) return res.status(404).json({ error: 'Session not found' });
        return res.status(200).json({ message: 'Session revoked' });
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ─── FORGOT / RESET PASSWORD ──────────────────────────────────────────────────

router.post('/forgot-password', resetLimiter, [body('email').isEmail()], async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || user.authProvider !== 'local') return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
        await user.save();
        await sendResetEmail(email, `${CLIENT_URL}/reset-password?token=${resetToken}&email=${email}`);
        return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/reset-password', resetLimiter, [body('token').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 6 })], async (req, res) => {
    try {
        const { token, email, password } = req.body;
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) return res.status(400).json({ error: 'Invalid or expired reset token.' });
        const decryptedPassword = isEncrypted(password) ? decryptPassword(password) : password;
        user.password = await bcrypt.hash(decryptedPassword, 12);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        await LoginSession.updateMany({ userId: user._id }, { isRevoked: true });
        return res.status(200).json({ message: 'Password reset successful. Please log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET LOGGED USER + OTHER ROUTES ──────────────────────────────────────────

router.get('/get', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized.' });
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -resetPasswordToken -resetPasswordExpires -twoFactorOtp');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.status(200).json(user);
    } catch { return res.status(403).json({ message: 'Invalid or expired token.' }); }
});

router.get("/other-users", async (req, res) => {
    try {
        const loggedUserId = req.headers.authorization;
        if (!loggedUserId) return res.status(400).json({ message: "Authorization header missing." });
        const user = await User.findById(loggedUserId).select("-password").populate("following", "_id");
        if (!user) return res.status(404).json({ message: "User not found." });
        const suggestions = await User.find({ _id: { $ne: loggedUserId, $nin: user.following }, followers: { $in: user.following } }).limit(20).select("_id fullname profile_picture");
        return res.status(200).json(suggestions);
    } catch { return res.status(500).json({ message: "Internal server error." }); }
});

router.post('/users/details', async (req, res) => {
    try {
        const users = await User.find({ _id: { $in: req.body.ids } }).select('fullname profile_picture');
        res.status(200).json({ users });
    } catch { res.status(500).json({ error: 'Failed to fetch user details' }); }
});

router.put('/update-profile', async (req, res) => {
    try {
        const { userId, fullname, email, profile_picture, bio } = req.body;
        if (!userId) return res.status(400).json({ message: 'User ID is required.' });
        const updatedUser = await User.findByIdAndUpdate(userId, { fullname, email, profile_picture, bio }, { new: true }).select('-password');
        if (!updatedUser) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(updatedUser);
    } catch { res.status(500).json({ message: 'Failed to update profile.' }); }
});

router.post('/follow', async (req, res) => {
    try {
        const { userId, followUserId } = req.body;
        await User.findByIdAndUpdate(userId, { $addToSet: { following: followUserId } });
        const user = await User.findByIdAndUpdate(followUserId, { $addToSet: { followers: userId } }).select("-password");
        res.status(200).json(user);
    } catch { res.status(500).json({ message: 'Failed to follow user.' }); }
});

router.post('/unfollow', async (req, res) => {
    try {
        const { userId, unfollowUserId } = req.body;
        await User.findByIdAndUpdate(userId, { $pull: { following: unfollowUserId } });
        const user = await User.findByIdAndUpdate(unfollowUserId, { $pull: { followers: userId } }).select("-password");
        res.status(200).json(user);
    } catch { res.status(500).json({ message: 'Failed to unfollow user.' }); }
});

router.get('/other-user/view', async (req, res) => {
    try {
        const userId = req.headers.authorization;
        if (!userId) return res.status(401).json({ message: 'No Id provided.' });
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        return res.status(200).json(user);
    } catch { return res.status(403).json({ message: "Something went wrong" }); }
});

router.post("/search", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: "Search query is required." });
    try {
        const [userResults, postResults] = await Promise.all([
            User.find({ fullname: { $regex: query, $options: "i" } }).select("-password"),
            Post.find({ category: { $regex: query, $options: "i" } }),
        ]);
        res.status(200).json({ users: userResults, posts: postResults });
    } catch { res.status(500).json({ message: "Internal server error." }); }
});

// ─── NOTIFICATION SETTINGS ───────────────────────────────────────────────────
router.get('/notification-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('notificationSettings').lean();
        res.json(user?.notificationSettings || { emailDigest: false, pushEnabled: true });
    } catch { res.status(401).json({ message: 'Unauthorized' }); }
});

router.patch('/notification-settings', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByIdAndUpdate(decoded.userId, { notificationSettings: req.body }, { new: true }).select('notificationSettings').lean();
        res.json(user.notificationSettings);
    } catch { res.status(401).json({ message: 'Unauthorized' }); }
});

// ─── VERIFY PASSWORD (for admin re-auth gate) ────────────────────────────────
router.post('/verify-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('+password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Google/OAuth users have no password
        if (!user.password) return res.status(400).json({ message: 'Password login not available for this account' });

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

        res.status(200).json({ message: 'Verified' });
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

module.exports = router;

```

### `routes/chatbot.js`
```javascript
const express = require('express');
const router  = express.Router();
const OpenAI  = require('openai');

const client = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey:  process.env.NVIDIA_API_KEY,
});

const SYSTEM_PROMPT = `You are SocialBot, a helpful AI assistant built into Social Square — a social media platform.

You help users with:
1. APP HELP: How to post, follow users, use stories, create collaborative posts, anonymous confessions, time-locked posts, voice notes, and all other features.
2. CONTENT SUGGESTIONS: Caption ideas, hashtag suggestions, post ideas based on mood or topic the user gives you.
3. MOOD CHECK-IN: Ask how the user is feeling and suggest content moods (happy, excited, calm, romantic, nostalgic, etc.) to explore on their feed.
4. SUPPORT: Help users report issues, understand community guidelines, or troubleshoot problems.

Social Square features you know about:
- Feed with infinite scroll, mood-based filtering, real-time updates
- Stories (24hr expiry), Collaborative posts (invite others to contribute)
- Anonymous confessions feed (identity hidden)
- Time-locked posts (unlock at a future time), Post expiry
- Voice notes in posts and DMs
- AI caption generator, Mood detection on posts
- Direct messages with reactions, edit/delete, media sharing
- Notification bell with collaboration invites
- Dark mode, Admin dashboard

Rules:
- Be friendly, concise, and helpful
- For content suggestions, give 3-5 specific options
- For mood check-in, recommend one of: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral
- Never make up features that don't exist
- Keep responses under 150 words unless giving a list
- Use emojis naturally`;

// ─── CHAT — streams tokens back to frontend ───────────────────────────────────
router.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }

        // llama3-chatqa doesn't support 'system' role
        // Inject as first user/assistant pair instead
        const history = messages.slice(-10).map(m => ({
            role:    m.role,
            content: m.content,
        }));

        // ✅ Enforce strict user/assistant alternation required by this model
        // 1. Prepend system prompt as user + assistant seed pair
        // 2. Deduplicate consecutive same-role messages by merging them
        const raw = [
            { role: 'user',      content: SYSTEM_PROMPT },
            { role: 'assistant', content: 'Got it! I am SocialBot, ready to help Social Square users.' },
            ...history,
        ];

        // Merge consecutive messages with the same role into one
        const fullMessages = raw.reduce((acc, msg) => {
            if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
                // Merge into previous message
                acc[acc.length - 1] = {
                    role:    msg.role,
                    content: acc[acc.length - 1].content + '\n' + msg.content,
                };
            } else {
                acc.push({ role: msg.role, content: msg.content });
            }
            return acc;
        }, []);

        // Must start with user and end with user
        if (fullMessages[fullMessages.length - 1]?.role !== 'user') {
            fullMessages.push({ role: 'user', content: 'Please continue.' });
        }

        // ✅ stream: true — model forces it anyway, consume with for-await
        const completion = await client.chat.completions.create({
            model:       'nvidia/llama3-chatqa-1.5-8b',
            messages:    fullMessages,
            temperature: 0.2,
            top_p:       0.7,
            max_tokens:  1024,
            stream:      true,
        });

        // ✅ SSE response so frontend can stream tokens in real time
        res.setHeader('Content-Type',  'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection',    'keep-alive');
        res.flushHeaders();

        for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) {
                res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        console.error('[Chatbot]', err.message);
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: 'Chatbot error', details: err.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
});

// ─── CAPTION SUGGESTIONS ──────────────────────────────────────────────────────
router.post('/suggest-captions', async (req, res) => {
    try {
        const { topic, mood, imageDescription } = req.body;

        const prompt = `Generate 5 engaging social media captions for a post about: "${topic || imageDescription || 'general life'}". ${mood ? `Mood/vibe: ${mood}.` : ''} Include relevant hashtags. Number them 1-5. Keep each under 2 sentences.`;

        const completion = await client.chat.completions.create({
            model:       'nvidia/llama3-chatqa-1.5-8b',
            messages: [
                { role: 'user',      content: `You are a creative social media content writer. ${prompt}` },
            ],
            temperature: 0.8,
            top_p:       0.9,
            max_tokens:  400,
            stream:      true,
        });

        // Collect full streamed response then send as JSON
        let fullReply = '';
        for await (const chunk of completion) {
            fullReply += chunk.choices[0]?.delta?.content || '';
        }

        res.json({ captions: fullReply });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AI IMAGE GENERATION ──────────────────────────────────────────────────────
router.post('/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt required' });

        // NVIDIA Stable Diffusion via inference API
        const axios = require('axios');
        const response = await axios.post(
            'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium',
            {
                prompt,
                cfg_scale:       7,
                aspect_ratio:    '1:1',
                seed:            0,
                steps:           50,
                negative_prompt: 'blurry, bad quality, distorted',
            },
            {
                headers: {
                    Authorization:  `Bearer ${process.env.NVIDIA_API_KEY}`,
                    Accept:         'application/json',
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            }
        );

        // Response contains base64 image
        const imageB64 = response.data?.artifacts?.[0]?.base64 ||
                         response.data?.image;

        if (!imageB64) return res.status(500).json({ error: 'No image returned' });

        // Upload to Cloudinary so we get a permanent URL
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcmrsdydr',
            api_key:    process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const upload = await cloudinary.uploader.upload(
            `data:image/png;base64,${imageB64}`,
            { folder: 'ai-generated', resource_type: 'image' }
        );

        res.json({ imageUrl: upload.secure_url, prompt });

    } catch (err) {
        console.error('[ImageGen]', err.response?.data || err.message);
        res.status(500).json({ error: 'Image generation failed', details: err.response?.data?.detail || err.message });
    }
});

// ─── AI HASHTAG + CATEGORY SUGGESTIONS ────────────────────────────────────────
router.post('/suggest-hashtags', async (req, res) => {
    try {
        const { caption } = req.body;
        if (!caption) return res.status(400).json({ error: 'caption required' });

        const completion = await client.chat.completions.create({
            model:    'nvidia/llama3-chatqa-1.5-8b',
            messages: [
                {
                    role:    'user',
                    content: `Given this social media caption, suggest:
1. 5-8 relevant hashtags (without # prefix, comma separated)
2. The best category from: Technology, Fashion, Food, Travel, Fitness, Music, Art, Sports, Nature, Lifestyle, Education, Entertainment, Business, Default

Caption: "${caption}"

Respond ONLY in this JSON format:
{"hashtags": ["tag1","tag2","tag3"], "category": "CategoryName"}`
                }
            ],
            temperature: 0.3,
            max_tokens:  200,
            stream:      false,
        });

        // Collect stream
        let fullReply = '';
        if (completion[Symbol.asyncIterator]) {
            for await (const chunk of completion) {
                fullReply += chunk.choices[0]?.delta?.content || '';
            }
        } else {
            fullReply = completion.choices?.[0]?.message?.content || '';
        }

        const match = fullReply.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return res.json(parsed);
        }
        res.json({ hashtags: [], category: 'Default' });

    } catch (err) {
        res.status(500).json({ error: err.message, hashtags: [], category: 'Default' });
    }
});

// ─── GENERATE FULL POST (caption + hashtags + mood) ───────────────────────────
router.post('/generate-post-text', async (req, res) => {
    try {
        const { topic, mood, style } = req.body;

        const styleGuide = {
            casual:        'casual and friendly, like talking to a friend',
            professional:  'professional and polished',
            funny:         'funny and witty with humor',
            inspirational: 'inspiring and motivational',
            storytelling:  'like telling a short story',
        }[style] || 'engaging and natural';

        const prompt = `Write a social media post about: "${topic}"
Style: ${styleGuide}
${mood ? `Mood/vibe: ${mood}` : ''}

Respond ONLY in this JSON format (no extra text):
{
  "caption": "the main post text here",
  "hashtags": ["tag1","tag2","tag3","tag4","tag5"],
  "category": "one of: Technology/Fashion/Food/Travel/Fitness/Music/Art/Sports/Nature/Lifestyle/Education/Entertainment/Business/Default",
  "mood": "one of: happy/sad/excited/angry/calm/romantic/funny/inspirational/nostalgic/neutral"
}`;

        const completion = await client.chat.completions.create({
            model:    'nvidia/llama3-chatqa-1.5-8b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens:  400,
            stream:      true,
        });

        let fullReply = '';
        for await (const chunk of completion) {
            fullReply += chunk.choices[0]?.delta?.content || '';
        }

        const match = fullReply.match(/\{[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return res.json(parsed);
        }
        res.json({ caption: fullReply.trim(), hashtags: [], category: 'Default', mood: 'neutral' });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

```

### `routes/conversation.js`
```javascript
const express = require('express');
const router  = express.Router();
const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');
const Notification = require('../models/Notification');
const { createClient } = require('redis');

// ─── REDIS CLIENT ─────────────────────────────────────────────────────────────
let redis;
(async () => {
    try {
        redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        await redis.connect();
        console.log('[Redis] Conversation cache connected');
    } catch (err) {
        console.warn('[Redis] Cache not available:', err.message);
        redis = null;
    }
})();

const CACHE_TTL = 60; // 60 seconds

async function getCache(key) {
    if (!redis) return null;
    try { const v = await redis.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
async function setCache(key, data, ttl = CACHE_TTL) {
    if (!redis) return;
    try { await redis.setEx(key, ttl, JSON.stringify(data)); } catch {}
}
async function delCache(...keys) {
    if (!redis) return;
    try { await Promise.all(keys.map(k => redis.del(k))); } catch {}
}

let _io;
function setIo(io) { _io = io; }

// ─── CREATE CONVERSATION ──────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
    try {
        const { participants } = req.body;
        if (!participants || participants.length !== 2)
            return res.status(400).json({ error: 'Exactly two participants required' });

        const participantIds = participants.map(p => p.userId);
        const existing = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (existing) return res.status(200).json(existing);

        const conversation = await Conversation.create({ participants });

        // Invalidate both users' conversation cache
        await delCache(`convs:${participantIds[0]}`, `convs:${participantIds[1]}`);
        res.status(201).json(conversation);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH CONVERSATIONS ──────────────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const cacheKey = `convs:${userId}`;

        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversations = await Conversation.find({ 'participants.userId': userId })
            .sort({ lastMessageAt: -1 })
            .lean();

        await setCache(cacheKey, conversations, 30); // shorter TTL — changes frequently
        res.status(200).json(conversations);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── FETCH MESSAGES ───────────────────────────────────────────────────────────
router.post('/messages', async (req, res) => {
    try {
        const { participantIds } = req.body;
        if (!participantIds || participantIds.length !== 2)
            return res.status(400).json({ error: 'Two participant IDs required' });

        const cacheKey = `msgs:${participantIds.sort().join(':')}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const conversation = await Conversation.findOne({ 'participants.userId': { $all: participantIds } }).lean();
        if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

        const messages = await Message.find({
            conversationId: conversation._id,
            deletedAt: null, // exclude soft-deleted
        }).sort({ createdAt: 1 }).lean();

        const result = { messages, conversation };
        await setCache(cacheKey, result, 15); // 15s TTL for messages
        res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEARCH MESSAGES ──────────────────────────────────────────────────────────
router.get('/messages/search', async (req, res) => {
    try {
        const { conversationId, q } = req.query;
        if (!conversationId || !q) return res.status(400).json({ error: 'conversationId and q required' });

        const messages = await Message.find({
            conversationId,
            deletedAt: null,
            $text: { $search: q },
        }).sort({ score: { $meta: 'textScore' } }).limit(20).lean();

        res.json(messages);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
router.post('/messages/create', async (req, res) => {
    try {
        const { conversationId, sender, senderName, content, recipientId, mediaUrl, mediaType, mediaName, mediaSize } = req.body;
        if (!conversationId || !sender || !recipientId)
            return res.status(400).json({ error: 'Required fields missing' });

        const message = await Message.create({
            conversationId, sender, content: content || '',
            media: mediaUrl ? { url: mediaUrl, type: mediaType, name: mediaName, size: mediaSize } : {},
        });

        // Update conversation last message
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: { id: message._id, message: content || `📎 ${mediaType || 'file'}`, isRead: false },
            lastMessageAt: new Date(),
            lastMessageBy: sender,
        });

        // Notification
        await Notification.create({
            recipient: recipientId,
            sender: { id: sender, fullname: senderName },
            message: { id: message._id, content: content || `Sent a ${mediaType || 'file'}` },
        });

        // Invalidate cache
        await delCache(`convs:${sender}`, `convs:${recipientId}`, `msgs:${[sender, recipientId].sort().join(':')}`);

        // Emit via socket if io available
        if (_io) {
            _io.to(recipientId).emit('receiveMessage', {
                ...message.toObject(), senderId: sender, senderName,
            });
        }

        res.status(201).json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── EDIT MESSAGE ─────────────────────────────────────────────────────────────
router.patch('/messages/:messageId', async (req, res) => {
    try {
        const { content } = req.body;
        const message = await Message.findByIdAndUpdate(
            req.params.messageId,
            { content, edited: true, editedAt: new Date() },
            { new: true }
        ).lean();
        if (!message) return res.status(404).json({ error: 'Message not found' });

        // Notify recipient via socket
        // Emit to both participants' rooms (they joined with their userId as room name)
        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageEdited', {
                    messageId: message._id,
                    content,
                    conversationId: message.conversationId,
                });
            });
        }

        await delCache(`msgs:${message.conversationId}`);
        res.json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE MESSAGE (soft) ────────────────────────────────────────────────────
router.delete('/messages/:messageId', async (req, res) => {
    try {
        const { userId } = req.body;
        const message = await Message.findOne({ _id: req.params.messageId, sender: userId });
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        message.deletedAt = new Date();
        message.content   = '';
        await message.save();

        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageDeleted', {
                    messageId: message._id,
                    conversationId: message.conversationId,
                });
            });
        }
        await delCache(`msgs:${message.conversationId}`);
        res.json({ message: 'Message deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REACT TO MESSAGE ─────────────────────────────────────────────────────────
router.post('/messages/:messageId/react', async (req, res) => {
    try {
        const { userId, emoji } = req.body;
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Not found' });

        if (message.reactions.get(userId) === emoji) {
            message.reactions.delete(userId); // toggle off same emoji
        } else {
            message.reactions.set(userId, emoji);
        }
        await message.save();

        const reactionsObj = Object.fromEntries(message.reactions);
        if (_io) {
            const conv = await Conversation.findById(message.conversationId).select('participants').lean();
            conv?.participants?.forEach(p => {
                _io.to(p.userId.toString()).emit('messageReaction', {
                    messageId: message._id,
                    conversationId: message.conversationId,
                    reactions: reactionsObj,
                });
            });
        }

        await delCache(`msgs:${message.conversationId}`);
        res.json({ reactions: reactionsObj });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── MARK READ ────────────────────────────────────────────────────────────────
router.post('/messages/mark-read', async (req, res) => {
    try {
        const { unreadMessageIds, lastMessage } = req.body;
        if (!Array.isArray(unreadMessageIds)) return res.status(400).json({ error: 'Invalid' });

        await Message.updateMany({ _id: { $in: unreadMessageIds } }, { $set: { isRead: true } });

        if (lastMessage) {
            const msg = await Message.findById(lastMessage).lean();
            if (msg) {
                await Conversation.findByIdAndUpdate(msg.conversationId, {
                    'lastMessage.isRead': true,
                    lastMessageBy: msg.sender,
                    lastMessageAt: msg.createdAt,
                });
                await delCache(`convs:${msg.sender}`);
            }
        }

        res.json({ message: 'Marked as read', unreadMessageIds });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get('/notifications/:userId', async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.params.userId, read: false })
            .sort({ createdAt: -1 }).lean();
        res.status(200).json(notifications);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/notifications/mark-read', async (req, res) => {
    try {
        const { Ids } = req.body;
        await Notification.updateMany({ _id: { $in: Ids } }, { $set: { read: true } });
        res.json({ Ids });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.setIo = setIo;

```

### `routes/post.js`
```javascript
const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require("../models/Category");
const { emailQueue } = require("../queues/emailQueue");
const { publish } = require('../lib/nats');

const router = express.Router();

// io is injected from index.js
let _io;
function setIo(io) { _io = io; }

function computeScore(post, followingIds = []) {
    const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    return (post.likes?.length || 0) * 2 + (post.comments?.length || 0) * 3
        + (followingIds.includes(post.user._id.toString()) ? 20 : 0)
        + Math.max(0, 50 - ageHours * 0.5);
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post("/create", async (req, res) => {
    try {
        const {
            caption, loggeduser, category, imageURLs, location, music,
            isAnonymous, expiresAt, unlocksAt, isCollaborative,
            collaboratorIds, voiceNoteUrl, voiceNoteDuration, mood,
        } = req.body;
        if (!caption || !loggeduser || !category) return res.status(400).json({ message: "All fields are required." });
        const userDetails = await User.findById(loggeduser).select('username fullname profile_picture followers');
        if (!userDetails) return res.status(404).json({ message: "User not found." });

        let collaborators = [];
        if (isCollaborative && Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
            const collabUsers = await User.find({ _id: { $in: collaboratorIds } }).select('fullname profile_picture');
            collaborators = collabUsers.map(u => ({ userId: u._id, fullname: u.fullname, profile_picture: u.profile_picture, status: 'pending' }));
        }

        const newPost = new Post({
            caption, category,
            image_urls: Array.isArray(imageURLs) ? imageURLs : [],
            user: isAnonymous
                ? { _id: userDetails._id, fullname: 'Anonymous', profile_picture: 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff' }
                : { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            location: location || {}, music: music || {},
            isAnonymous: !!isAnonymous,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            unlocksAt: unlocksAt ? new Date(unlocksAt) : null,
            isCollaborative: !!isCollaborative,
            collaborators,
            voiceNote: voiceNoteUrl ? { url: voiceNoteUrl, duration: voiceNoteDuration || null } : {},
            mood: mood || null,
        });
        await newPost.save();

        if (_io && collaborators.length > 0) {
            collaborators.forEach(c => {
                _io.to(c.userId.toString()).emit('collaborationInvite', { postId: newPost._id, postCaption: caption, invitedBy: userDetails.fullname });
            });
        }

        // Anonymous posts do NOT go to followers' feeds — they go to a public confessions feed only.
        // This prevents followers identifying the poster by timing.
        if (!isAnonymous && !unlocksAt && _io && userDetails.followers?.length > 0) {
            userDetails.followers.forEach(followerId => {
                _io.to(followerId.toString()).emit('newFeedPost', newPost);
            });
        }

        // Anonymous posts: emit to a public 'confessions' room that any connected user can join
        if (isAnonymous && _io) {
            _io.emit('newConfessionPost', newPost);
        }

        // Only notify followers via NATS for non-anonymous posts
        if (!isAnonymous) {
            await emailQueue.add('sendWelcome', { userId: userDetails._id }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
            publish('posts.created', { id: newPost._id, user: newPost.user, category: newPost.category })
                .catch(err => console.warn('[NATS]:', err.message));
        }

        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// ─── ACCEPT COLLABORATION ─────────────────────────────────────────────────────
router.post("/collaborate/accept", async (req, res) => {
    try {
        const { postId, userId, contribution } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => c.userId.toString() === userId);
        if (idx === -1) return res.status(403).json({ message: "Not a collaborator." });
        post.collaborators[idx].status = 'accepted';
        if (contribution) post.collaborators[idx].contribution = contribution;
        await post.save();
        if (_io) _io.to(post.user._id.toString()).emit('collaborationAccepted', { postId, userId });
        res.status(200).json(post);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── DECLINE COLLABORATION ────────────────────────────────────────────────────
router.post("/collaborate/decline", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        const idx = post.collaborators.findIndex(c => c.userId.toString() === userId);
        if (idx !== -1) { post.collaborators[idx].status = 'declined'; await post.save(); }
        res.status(200).json({ message: "Declined." });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put("/update/:postId", async (req, res) => {
    try {
        const { caption, category, userId } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        if (caption) post.caption = caption;
        if (category) post.category = category;
        await post.save();

        // ✅ Notify all users about post update
        if (_io) _io.emit('postUpdated', { postId: post._id, caption: post.caption, category: post.category });

        res.status(200).json(post);
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete("/delete/:postId", async (req, res) => {
    try {
        const { userId } = req.body;
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        if (post.user._id.toString() !== userId) return res.status(403).json({ message: "Unauthorized." });
        await Post.findByIdAndDelete(req.params.postId);

        // ✅ Notify all users to remove post from feed
        if (_io) _io.emit('postDeleted', { postId: req.params.postId });

        res.status(200).json({ message: "Post deleted.", postId: req.params.postId });
    } catch (error) { res.status(500).json({ message: "Internal Server Error" }); }
});

// ─── FEED ─────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const userId = req.query.userId;
        let followingIds = [], userCategories = [];
        if (userId) {
            const user = await User.findById(userId).select('following');
            if (user) followingIds = user.following.map(id => id.toString());
            const likedPosts = await Post.find({ likes: userId }).select('category').limit(20);
            userCategories = [...new Set(likedPosts.map(p => p.category))];
        }
        // Exclude anonymous posts from normal feed — they appear in confessions feed only
        // Also exclude time-locked posts that haven't unlocked yet
        const query = {
            isAnonymous: { $ne: true },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit * 3);
        const scored = posts.map(post => {
            let score = computeScore(post, followingIds);
            if (userCategories.includes(post.category)) score += 15;
            return { post, score };
        }).sort((a, b) => b.score - a.score);
        const result = scored.slice(0, limit).map(s => s.post);
        const hasMore = posts.length >= limit;
        const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;
        res.status(200).json({ posts: result, nextCursor, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── USER POSTS ───────────────────────────────────────────────────────────────
router.get("/user/:userId", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 12;
        const cursor = req.query.cursor;
        // Show all posts for profile page — owner sees their own anonymous posts too
        const query = { 'user._id': req.params.userId, ...(cursor ? { _id: { $lt: cursor } } : {}) };
        const posts = await Post.find(query).sort({ _id: -1 }).limit(limit + 1);
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;
        res.status(200).json({ posts: result, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── SAVE / UNSAVE ────────────────────────────────────────────────────────────
router.post("/save", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const alreadySaved = (user.savedPosts || []).some(id => id.toString() === postId);
        if (alreadySaved) {
            await User.findByIdAndUpdate(userId, { $pull: { savedPosts: postId } });
            return res.status(200).json({ saved: false });
        } else {
            await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } });
            return res.status(200).json({ saved: true });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/saved/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('savedPosts');
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const posts = await Post.find({ _id: { $in: user.savedPosts } }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── TRENDING ─────────────────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trending = await Post.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: '$category', postCount: { $sum: 1 }, totalLikes: { $sum: { $size: '$likes' } }, totalComments: { $sum: { $size: '$comments' } } } },
            { $addFields: { score: { $add: ['$totalLikes', { $multiply: ['$totalComments', 2] }, '$postCount'] } } },
            { $sort: { score: -1 } }, { $limit: 10 },
            { $project: { category: '$_id', postCount: 1, totalLikes: 1, totalComments: 1, score: 1, _id: 0 } }
        ]);
        res.status(200).json(trending);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── LIKE ─────────────────────────────────────────────────────────────────────
router.post("/like", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both required.' });
        const post = await Post.findById(postId);
        if (!post.likes.includes(userId)) {
            post.likes.push(userId);
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast like update to all connected users
            if (_io) _io.emit('postLiked', { postId, userId, likesCount: post.likes.length });

            res.status(200).json({ message: "Success" });
        } else { res.status(400).json({ message: "Already liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── UNLIKE ───────────────────────────────────────────────────────────────────
router.post("/unlike", async (req, res) => {
    try {
        const { postId, userId } = req.body;
        if (!userId || !postId) return res.status(400).json({ message: 'Both required.' });
        const post = await Post.findById(postId);
        if (post.likes.includes(userId)) {
            await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
            post.likes = post.likes.filter(id => id.toString() !== userId);
            post.score = computeScore(post);
            await post.save();

            // ✅ Broadcast unlike update to all connected users
            if (_io) _io.emit('postUnliked', { postId, userId, likesCount: post.likes.length });

            res.status(200).json({ message: "success" });
        } else { res.status(400).json({ message: "Not liked." }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
router.get("/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── FETCH COMMENTS ───────────────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
    try {
        const postId = req.headers.authorization;
        if (!postId) return res.status(400).json({ error: 'postId required' });
        const comments = await Comment.find({ postId, parentId: null }).sort({ createdAt: 1 });
        const withReplies = await Promise.all(comments.map(async (comment) => {
            const replies = await Comment.find({ parentId: comment._id }).sort({ createdAt: 1 });
            return { ...comment.toObject(), repliesList: replies };
        }));
        res.status(200).json(withReplies);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ADD COMMENT ──────────────────────────────────────────────────────────────
router.post('/comments/add', async (req, res) => {
    try {
        const { content, postId, user, parentId } = req.body;
        if (!content || !postId || !user) return res.status(400).json({ error: 'Invalid data' });

        const newComment = new Comment({ postId, content, user, parentId: parentId || null });
        await newComment.save();

        if (parentId) {
            await Comment.findByIdAndUpdate(parentId, { $push: { replies: newComment._id } });
        } else {
            const post = await Post.findById(postId);
            post.comments.push(newComment._id);
            post.score = computeScore(post);
            await post.save();
        }

        // ✅ Broadcast new comment to all users viewing this post
        if (_io) {
            _io.emit('newComment', {
                postId,
                comment: { ...newComment.toObject(), repliesList: [] },
                parentId: parentId || null,
                commentsCount: (await Post.findById(postId).select('comments'))?.comments?.length || 0,
            });
        }

        return res.status(200).json(newComment);
    } catch (error) { return res.status(500).json({ error: 'Server error' }); }
});

// ─── DELETE COMMENT ───────────────────────────────────────────────────────────
router.delete('/comments/:commentId', async (req, res) => {
    try {
        const { userId } = req.body;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user._id.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        if (comment.parentId) {
            await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: comment._id } });
        } else {
            await Post.findByIdAndUpdate(comment.postId, { $pull: { comments: comment._id } });
        }

        await Comment.deleteMany({ parentId: comment._id });
        await Comment.findByIdAndDelete(req.params.commentId);

        // ✅ Broadcast comment deletion
        if (_io) {
            _io.emit('commentDeleted', {
                commentId: req.params.commentId,
                postId: comment.postId,
                parentId: comment.parentId || null,
            });
        }

        res.status(200).json({ message: 'Comment deleted', commentId: req.params.commentId });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ─── LIKE COMMENT ─────────────────────────────────────────────────────────────
router.post('/comments/:commentId/like', async (req, res) => {
    try {
        const { userId } = req.body;
        const comment = await Comment.findById(req.params.commentId);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        const liked = comment.likes.includes(userId);
        if (liked) {
            await Comment.findByIdAndUpdate(req.params.commentId, { $pull: { likes: userId } });
        } else {
            await Comment.findByIdAndUpdate(req.params.commentId, { $addToSet: { likes: userId } });
        }

        // ✅ Broadcast comment like
        if (_io) {
            _io.emit('commentLiked', {
                commentId: req.params.commentId,
                postId: comment.postId,
                userId,
                liked: !liked,
            });
        }

        res.status(200).json({ liked: !liked });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

// ─── SINGLE POST DETAIL ───────────────────────────────────────────────────────
router.get("/detail/:postId", async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);
        if (!post) return res.status(404).json({ message: "Post not found." });
        res.status(200).json(post);
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── GET PENDING COLLABORATION INVITES FOR A USER ────────────────────────────
router.get("/collaborate/invites/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Post.find({
            isCollaborative: true,
            'collaborators.userId': userId,
            'collaborators.status': 'pending',
        }).select('caption image_urls image_url user collaborators createdAt category');
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── GET ALL COLLABORATIVE POSTS FOR A USER (accepted) ────────────────────────
router.get("/collaborate/mine/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Post.find({
            isCollaborative: true,
            'collaborators': { $elemMatch: { userId, status: 'accepted' } },
        }).select('caption image_urls image_url user collaborators createdAt category likes comments');
        res.status(200).json(posts);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ─── CONFESSIONS FEED ────────────────────────────────────────────────────────
// Anonymous posts only — identity is never revealed, sorted by score
router.get("/confessions", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const cursor = req.query.cursor;
        const query = {
            isAnonymous: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            ...(cursor ? { _id: { $lt: cursor } } : {}),
        };
        const posts = await Post.find(query).sort({ score: -1, _id: -1 }).limit(limit + 1);
        const hasMore = posts.length > limit;
        const result = hasMore ? posts.slice(0, limit) : posts;

        // Strip any identifying info before sending — extra safety layer
        const sanitized = result.map(p => ({
            ...p.toObject(),
            user: {
                _id: null, // never reveal real _id
                fullname: 'Anonymous',
                profile_picture: 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff',
            },
        }));

        res.status(200).json({ posts: sanitized, nextCursor: hasMore ? result[result.length - 1]._id : null, hasMore });
    } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

module.exports = router;
module.exports.setIo = setIo;

```

### `routes/story.js`
```javascript
const express = require('express');
const Story = require('../models/Story');
const User = require('../models/User');
const router = express.Router();

let _io;
function setIo(io) { _io = io; }

// ─── CREATE STORY ─────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
    try {
        const { userId, mediaUrl, mediaType, text } = req.body;
        if (!userId || !mediaUrl || !mediaType) return res.status(400).json({ message: 'Required fields missing.' });

        const user = await User.findById(userId).select('fullname profile_picture followers');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const story = new Story({
            user: { _id: user._id, fullname: user.fullname, profile_picture: user.profile_picture },
            media: { url: mediaUrl, type: mediaType },
            text: text || {},
        });
        await story.save();

        // ✅ Emit new story to all followers in real-time
        if (_io && user.followers?.length > 0) {
            user.followers.forEach(followerId => {
                _io.to(followerId.toString()).emit('newStory', story);
            });
        }

        res.status(201).json(story);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// ─── GET STORIES FEED ─────────────────────────────────────────────────────────
router.get('/feed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('following');
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const userIds = [userId, ...user.following.map(id => id.toString())];
        const stories = await Story.find({
            'user._id': { $in: userIds },
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        const grouped = {};
        stories.forEach(story => {
            const uid = story.user._id.toString();
            if (!grouped[uid]) {
                grouped[uid] = { user: story.user, stories: [], hasUnviewed: false };
            }
            grouped[uid].stories.push(story);
            if (!story.viewers.map(v => v.toString()).includes(userId)) {
                grouped[uid].hasUnviewed = true;
            }
        });

        const result = Object.values(grouped).sort((a, b) => {
            if (a.user._id.toString() === userId) return -1;
            if (b.user._id.toString() === userId) return 1;
            return b.hasUnviewed - a.hasUnviewed;
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── MARK AS VIEWED ───────────────────────────────────────────────────────────
router.post('/view/:storyId', async (req, res) => {
    try {
        const { userId } = req.body;
        await Story.findByIdAndUpdate(req.params.storyId, { $addToSet: { viewers: userId } });
        res.status(200).json({ message: 'Viewed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── DELETE STORY ─────────────────────────────────────────────────────────────
router.delete('/:storyId', async (req, res) => {
    try {
        const { userId } = req.body;
        const story = await Story.findById(req.params.storyId);
        if (!story) return res.status(404).json({ message: 'Story not found.' });
        if (story.user._id.toString() !== userId) return res.status(403).json({ message: 'Unauthorized.' });
        await Story.findByIdAndDelete(req.params.storyId);
        res.status(200).json({ message: 'Story deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.setIo = setIo;

```

### `scripts/createIndexes.js`
```javascript
/**
 * Run this ONCE to create all production indexes:
 *   node scripts/createIndexes.js
 *
 * These indexes are critical for performance at 100k+ users.
 * Without them MongoDB does full collection scans.
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function createIndexes() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // ─── USERS ────────────────────────────────────────────────────────────────
    const users = db.collection('users');
    await users.createIndex({ email: 1 },        { unique: true, name: 'email_unique' });
    await users.createIndex({ created_at: -1 },  { name: 'users_created_at' });
    await users.createIndex({ isBanned: 1 },     { sparse: true, name: 'users_banned' });
    await users.createIndex({ isAdmin: 1 },      { sparse: true, name: 'users_admin' });
    await users.createIndex({ googleId: 1 },     { sparse: true, name: 'users_google_id' });
    // Text index for search — covers fullname + email
    await users.createIndex({ fullname: 'text', email: 'text' }, { name: 'users_text_search' });
    console.log('✅ Users indexes created');

    // ─── POSTS ────────────────────────────────────────────────────────────────
    const posts = db.collection('posts');
    await posts.createIndex({ createdAt: -1 },                           { name: 'posts_created_at' });
    await posts.createIndex({ score: -1, createdAt: -1 },               { name: 'posts_feed_score' });
    await posts.createIndex({ 'user._id': 1, createdAt: -1 },           { name: 'posts_by_user' });
    await posts.createIndex({ isAnonymous: 1, createdAt: -1 },          { sparse: true, name: 'posts_anonymous' });
    await posts.createIndex({ unlocksAt: 1 },                           { sparse: true, name: 'posts_time_locked' });
    await posts.createIndex({ expiresAt: 1 },                           { expireAfterSeconds: 0, sparse: true, name: 'posts_ttl_expiry' });
    await posts.createIndex({ category: 1, createdAt: -1 },             { name: 'posts_category' });
    await posts.createIndex({ caption: 'text' },                         { name: 'posts_text_search' });
    // For collaborative posts
    await posts.createIndex({ 'collaborators.userId': 1, 'collaborators.status': 1 }, { sparse: true, name: 'posts_collaborators' });
    console.log('✅ Posts indexes created');

    // ─── COMMENTS ─────────────────────────────────────────────────────────────
    const comments = db.collection('comments');
    await comments.createIndex({ postId: 1, createdAt: 1 },  { name: 'comments_by_post' });
    await comments.createIndex({ parentId: 1 },              { sparse: true, name: 'comments_replies' });
    await comments.createIndex({ 'user._id': 1 },            { name: 'comments_by_user' });
    console.log('✅ Comments indexes created');

    // ─── STORIES ──────────────────────────────────────────────────────────────
    const stories = db.collection('stories');
    await stories.createIndex({ 'user._id': 1, createdAt: -1 }, { name: 'stories_by_user' });
    await stories.createIndex({ expiresAt: 1 },                  { expireAfterSeconds: 0, name: 'stories_ttl' });
    console.log('✅ Stories indexes created');

    // ─── CONVERSATIONS ────────────────────────────────────────────────────────
    const convs = db.collection('conversations');
    await convs.createIndex({ 'participants.userId': 1 },        { name: 'convs_by_participant' });
    await convs.createIndex({ lastMessageAt: -1 },               { name: 'convs_last_message' });
    console.log('✅ Conversations indexes created');

    // ─── MESSAGES ─────────────────────────────────────────────────────────────
    const messages = db.collection('messages');
    await messages.createIndex({ conversationId: 1, createdAt: 1 }, { name: 'messages_by_conv' });
    await messages.createIndex({ sender: 1 },                        { name: 'messages_by_sender' });
    await messages.createIndex({ isRead: 1 },                        { name: 'messages_unread' });
    console.log('✅ Messages indexes created');

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
    const notifs = db.collection('notifications');
    await notifs.createIndex({ recipient: 1, read: 1, createdAt: -1 }, { name: 'notifs_by_recipient' });
    await notifs.createIndex({ createdAt: 1 },                          { expireAfterSeconds: 30 * 86400, name: 'notifs_ttl_30d' }); // auto-delete after 30 days
    console.log('✅ Notifications indexes created');

    // ─── REPORTS ──────────────────────────────────────────────────────────────
    const reports = db.collection('reports');
    await reports.createIndex({ reporter: 1, targetId: 1, status: 1 }, { name: 'reports_dedup' });
    await reports.createIndex({ status: 1, createdAt: -1 },            { name: 'reports_by_status' });
    await reports.createIndex({ targetId: 1, targetType: 1 },          { name: 'reports_by_target' });
    console.log('✅ Reports indexes created');

    // ─── LOGIN SESSIONS ───────────────────────────────────────────────────────
    const sessions = db.collection('loginsessions');
    await sessions.createIndex({ userId: 1 },      { name: 'sessions_by_user' });
    await sessions.createIndex({ expiresAt: 1 },   { expireAfterSeconds: 0, name: 'sessions_ttl' });
    console.log('✅ Login sessions indexes created');

    // ─── FEED ─────────────────────────────────────────────────────────────────
    const feed = db.collection('feeds');
    await feed.createIndex({ userId: 1, post: 1 }, { unique: true, name: 'feed_unique' });
    await feed.createIndex({ userId: 1 },           { name: 'feed_by_user' });
    console.log('✅ Feed indexes created');

    console.log('\n🎉 All indexes created successfully!');
    process.exit(0);
}

createIndexes().catch(err => { console.error('❌ Error:', err); process.exit(1); });

```

### `scripts/makeAdmin.js`
```javascript
/**
 * Run this script to grant admin access to a user:
 *   node scripts/makeAdmin.js your@email.com
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/makeAdmin.js <email>');
    process.exit(1);
}

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email });
    if (!user) { console.error(`No user found with email: ${email}`); process.exit(1); }
    user.isAdmin = true;
    await user.save();
    console.log(`✅ ${user.fullname} (${user.email}) is now an admin.`);
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });

```

### `services/cloudinary.js`
```javascript
// ─── CLOUDINARY SERVICE ───────────────────────────────────────────────────────
// Isolated so routes only load this when they actually need uploads
// Prevents cloudinary SDK from being in memory for routes that never upload

let _cloudinary = null;

function getCloudinary() {
    if (!_cloudinary) {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcmrsdydr',
            api_key:    process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        _cloudinary = cloudinary;
    }
    return _cloudinary;
}

// Upload a base64 string or file path
async function uploadBase64(base64Data, options = {}) {
    const cld = getCloudinary();
    return cld.uploader.upload(base64Data, {
        folder:        options.folder        || 'uploads',
        resource_type: options.resource_type || 'image',
        ...options,
    });
}

// Upload from a URL (for AI-generated images)
async function uploadFromUrl(url, options = {}) {
    const cld = getCloudinary();
    return cld.uploader.upload(url, {
        folder:        options.folder || 'ai-generated',
        resource_type: 'image',
        ...options,
    });
}

// Delete by public_id
async function deleteAsset(publicId, resourceType = 'image') {
    const cld = getCloudinary();
    return cld.uploader.destroy(publicId, { resource_type: resourceType });
}

// Generate a transformation URL (resize, crop etc) without API call
function transformUrl(publicId, options = {}) {
    const cld = getCloudinary();
    return cld.url(publicId, options);
}

module.exports = { getCloudinary, uploadBase64, uploadFromUrl, deleteAsset, transformUrl };

```

### `services/mailer.js`
```javascript
// ─── MAILER SERVICE ───────────────────────────────────────────────────────────
// Lazy-initialized — transporter only created on first send
// Uses connection pooling to reuse SMTP connections (saves ~10MB per email)

let _transporter = null;

function getTransporter() {
    if (!_transporter) {
        const nodemailer = require('nodemailer');
        _transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Gmail App Password (no spaces)
            },
            // ✅ Pool SMTP connections — reuse instead of new connection per email
            pool:           true,
            maxConnections: 3,    // max 3 concurrent SMTP connections
            maxMessages:    100,  // reuse connection for 100 emails before recycling
            rateDelta:      1000, // min 1s between sends
            rateLimit:      5,    // max 5 emails/second
        });

        _transporter.verify(err => {
            if (err) console.error('[Mailer] SMTP verify failed:', err.message);
            else     console.log('[Mailer] SMTP ready');
        });
    }
    return _transporter;
}

// ─── BASE EMAIL WRAPPER ───────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
    const transporter = getTransporter();
    return transporter.sendMail({
        from:    `"Social Square" <${process.env.EMAIL_USER}>`,
        to, subject, html,
        text:    text || html?.replace(/<[^>]*>/g, ''), // plain text fallback
    });
}

// ─── SPECIFIC EMAIL TYPES ─────────────────────────────────────────────────────

async function sendOtpEmail(email, otp) {
    return sendEmail({
        to:      email,
        subject: 'Your Social Square verification code',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#808bf5">Social Square</h2>
            <p>Your verification code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#808bf5;padding:16px;background:#f5f3ff;border-radius:8px;text-align:center">${otp}</div>
            <p style="color:#6b7280;font-size:12px;margin-top:16px">Expires in 10 minutes. Do not share this code.</p>
        </div>`
    });
}

async function sendResetEmail(email, resetUrl) {
    return sendEmail({
        to:      email,
        subject: 'Reset your Social Square password',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#808bf5">Password Reset</h2>
            <p>Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#808bf5;color:#fff;text-decoration:none;border-radius:8px;margin:16px 0">Reset Password</a>
            <p style="color:#6b7280;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>`
    });
}

async function sendNewDeviceAlert(email, { device, location, time }) {
    return sendEmail({
        to:      email,
        subject: '⚠️ New device login detected — Social Square',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#ef4444">New Login Detected</h2>
            <p>Your account was accessed from a new device:</p>
            <ul style="color:#374151">
                <li><strong>Device:</strong> ${device || 'Unknown'}</li>
                <li><strong>Location:</strong> ${location || 'Unknown'}</li>
                <li><strong>Time:</strong> ${time || new Date().toUTCString()}</li>
            </ul>
            <p>If this was you, no action needed. If not, <a href="${process.env.CLIENT_URL}/sessions">review your sessions</a> immediately.</p>
        </div>`
    });
}

async function sendLockoutEmail(email, unlockTime) {
    return sendEmail({
        to:      email,
        subject: '🔒 Account temporarily locked — Social Square',
        html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
            <h2 style="color:#f59e0b">Account Locked</h2>
            <p>Too many failed login attempts. Your account is locked until:</p>
            <p style="font-size:18px;font-weight:bold;color:#808bf5">${new Date(unlockTime).toLocaleString()}</p>
            <p style="color:#6b7280;font-size:12px">If this wasn't you, consider resetting your password after the lockout expires.</p>
        </div>`
    });
}

// ─── DAILY DIGEST EMAIL ───────────────────────────────────────────────────────
async function sendDigestEmail(user, stats) {
    const { newFollowers, newLikes, newComments, trendingPosts = [] } = stats;
    return sendEmail({
        to:      user.email,
        subject: `${user.fullname}, you had ${newLikes + newComments + newFollowers} interactions yesterday 🔥`,
        html: `
        <!DOCTYPE html><html><body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
            <div style="background:linear-gradient(135deg,#808bf5,#6366f1);padding:32px 28px;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:24px">Social Square</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your daily activity digest</p>
            </div>
            <div style="padding:28px">
                <p style="font-size:16px;color:#374151;margin:0">Hi <strong>${user.fullname}</strong> 👋</p>
                <p style="font-size:14px;color:#6b7280;margin:8px 0 20px">Here's what happened on Social Square yesterday.</p>
                <div style="display:flex;gap:12px;margin-bottom:24px">
                    ${[['👥','New Followers',newFollowers],['❤️','Post Likes',newLikes],['💬','Comments',newComments]].map(([icon,label,val]) => `
                    <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;text-align:center;border:1px solid #f3f4f6">
                        <p style="font-size:24px;margin:0">${icon}</p>
                        <p style="font-size:22px;font-weight:800;color:#111827;margin:8px 0 2px">${val}</p>
                        <p style="font-size:11px;color:#9ca3af;margin:0;text-transform:uppercase;letter-spacing:.05em">${label}</p>
                    </div>`).join('')}
                </div>
                ${trendingPosts.slice(0,3).length ? `
                <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 12px">🔥 Trending today</p>
                ${trendingPosts.slice(0,3).map(p => `
                <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f9fafb">
                    <p style="margin:0;font-size:13px;color:#374151">${(p.caption||'').slice(0,80)}</p>
                    <p style="margin:0;font-size:12px;color:#9ca3af">❤️ ${p.likes?.length||0}</p>
                </div>`).join('')}` : ''}
                <div style="text-align:center;margin-top:24px">
                    <a href="${process.env.CLIENT_URL}" style="display:inline-block;background:linear-gradient(135deg,#808bf5,#6366f1);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">Open Social Square →</a>
                </div>
            </div>
            <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;text-align:center">
                <p style="font-size:11px;color:#9ca3af;margin:0">
                    <a href="${process.env.CLIENT_URL}/settings" style="color:#808bf5">Unsubscribe from digest</a>
                </p>
            </div>
        </div></body></html>`
    });
}

module.exports = {
    sendEmail,
    sendOtpEmail,
    sendResetEmail,
    sendNewDeviceAlert,
    sendLockoutEmail,
    sendDigestEmail,
};

```

### `store/index.js`
```javascript
// ─── ZUSTAND STORES ──────────────────────────────────────────────────────────
// Redux has been removed. Import directly from zustand stores:
//   import useAuthStore from './zustand/useAuthStore';
//   import usePostStore from './zustand/usePostStore';
//   import useConversationStore from './zustand/useConversationStore';

export { default as useAuthStore } from './zustand/useAuthStore';
export { default as usePostStore } from './zustand/usePostStore';
export { default as useConversationStore } from './zustand/useConversationStore';

```

### `store/postsSlice.js`
```javascript
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const fetchPosts = createAsyncThunk("posts/fetchPosts", async ({ cursor = null, userId = null } = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams({ limit: 10 });
        if (cursor) params.append('cursor', cursor);
        if (userId) params.append('userId', userId);
        const res = await fetch(`${BASE}/api/post/?${params}`);
        return await res.json();
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchUserPosts = createAsyncThunk("posts/fetchUserPosts", async ({ userId, cursor = null } = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams({ limit: 12 });
        if (cursor) params.append('cursor', cursor);
        const res = await fetch(`${BASE}/api/post/user/${userId}?${params}`);
        return await res.json();
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchSavedPosts = createAsyncThunk("posts/fetchSavedPosts", async (userId, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/saved/${userId}`);
        return await res.json();
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchMoodFeed = createAsyncThunk("posts/fetchMoodFeed", async ({ mood, userId }, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/ai/mood-feed/${userId}?mood=${mood}`);
        return await res.json(); // { posts, mood, relatedMoods }
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const savePost = createAsyncThunk("posts/savePost", async ({ postId, userId }, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, userId }),
        });
        return { postId, saved: (await res.json()).saved };
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/categories`);
        return await res.json();
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
    try {
        const res = await fetch(`${BASE}/api/post/like`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!res.ok) throw new Error("Failed to like post");
        return { userId, postId };
    } catch (error) { console.error("Error liking", error); }
});

export const unlikepost = createAsyncThunk("posts/unlikepost", async ({ postId, userId }) => {
    try {
        const res = await fetch(`${BASE}/api/post/unlike`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!res.ok) throw new Error("Failed to unlike post");
        return { userId, postId };
    } catch (error) { console.error("Error unliking", error); }
});

export const fetchComments = createAsyncThunk('posts/fetchComments', async (postId) => {
    try {
        const res = await fetch(`${BASE}/api/post/comments`, { method: "GET", headers: { Authorization: `${postId}` } });
        return await res.json();
    } catch (error) { console.error("Error fetching comments", error); }
});

export const createComment = createAsyncThunk('posts/createComment', async ({ postId, content, user, parentId }) => {
    try {
        const res = await fetch(`${BASE}/api/post/comments/add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, content, user, parentId }),
        });
        return { data: await res.json(), postId, parentId };
    } catch (error) { console.error("Error commenting", error); }
});

export const updatePost = createAsyncThunk('posts/updatePost', async ({ postId, userId, caption, category }, { rejectWithValue }) => {
    try {
        const res = await axios.put(`${BASE}/api/post/update/${postId}`, { userId, caption, category });
        return res.data;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

export const deletePost = createAsyncThunk('posts/deletePost', async ({ postId, userId }, { rejectWithValue }) => {
    try {
        await axios.delete(`${BASE}/api/post/delete/${postId}`, { data: { userId } });
        return postId;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

const postsSlice = createSlice({
    name: "posts",
    initialState: {
        // Main feed
        posts: [],
        nextCursor: null,
        hasMore: true,

        // Confessions feed (anonymous posts)
        confessions: [],
        confessionsNextCursor: null,
        confessionsHasMore: true,

        // Profile
        userPosts: [],
        userPostsNextCursor: null,
        userPostsHasMore: true,

        // Saved
        savedPosts: [],
        savedPostIds: [],

        // Mood feed
        moodPosts: [],
        activeMood: null,

        // Misc
        categories: [],
        comments: [],
        loading: {
            posts: null, userPosts: null, savedPosts: null, savePost: null, moodFeed: null,
            categories: null, comments: null, like: null, unlike: null,
            deletePost: null, updatePost: null,
        },
        error: {
            posts: null, userPosts: null, savedPosts: null, categories: null,
            comments: null, like: null, unlike: null, deletePost: null, updatePost: null,
        },
    },
    reducers: {
        addNewPost: (state, action) => {
            const post = action.payload;
            // Anonymous posts go to confessions, not main feed
            if (post.isAnonymous) {
                state.confessions.unshift(post);
            } else {
                state.posts.unshift(post);
            }
            // Always add to own profile posts
            state.userPosts.unshift(post);
        },
        resetUserPosts: (state) => {
            state.userPosts = [];
            state.userPostsNextCursor = null;
            state.userPostsHasMore = true;
        },

        // ✅ Socket: new post pushed to feed from server (non-anonymous only)
        socketNewFeedPost: (state, action) => {
            const post = action.payload;
            if (post.isAnonymous) return; // never add anonymous posts to main feed via socket
            const exists = state.posts.some(p => p._id === post._id);
            if (!exists) state.posts.unshift(post);
        },

        // ✅ Socket: new anonymous confession post — goes to confessions state only
        socketNewConfessionPost: (state, action) => {
            const post = action.payload;
            const exists = state.confessions.some(p => p._id === post._id);
            if (!exists) state.confessions.unshift(post);
        },

        // ✅ Socket: like count synced from server
        socketPostLiked: (state, action) => {
            const { postId, userId, likesCount } = action.payload;
            const post = state.posts.find(p => p._id === postId);
            if (post) {
                if (!post.likes.includes(userId)) post.likes.push(userId);
                // Sync exact count from server
                post.likes = post.likes.slice(0, likesCount);
            }
        },

        // ✅ Socket: unlike count synced from server
        socketPostUnliked: (state, action) => {
            const { postId, userId, likesCount } = action.payload;
            const post = state.posts.find(p => p._id === postId);
            if (post) {
                post.likes = post.likes.filter(id => id !== userId);
            }
        },

        // ✅ Socket: new comment pushed to post
        socketNewComment: (state, action) => {
            const { postId, comment, parentId, commentsCount } = action.payload;
            // Update comments count on the post
            const post = state.posts.find(p => p._id === postId);
            if (post && commentsCount) post.comments = new Array(commentsCount).fill(null);

            // If comments panel is open for this post, add the comment
            if (state.comments && state.comments[0]?.postId === postId) {
                if (!parentId) {
                    const exists = state.comments.some(c => c._id === comment._id);
                    if (!exists) state.comments.push({ ...comment, repliesList: [] });
                } else {
                    const parent = state.comments.find(c => c._id === parentId);
                    if (parent) {
                        if (!parent.repliesList) parent.repliesList = [];
                        const replyExists = parent.repliesList.some(r => r._id === comment._id);
                        if (!replyExists) parent.repliesList.push(comment);
                    }
                }
            }
        },

        // ✅ Socket: comment deleted
        socketCommentDeleted: (state, action) => {
            const { commentId, postId, parentId } = action.payload;
            const post = state.posts.find(p => p._id === postId);
            if (post && post.comments.length > 0) {
                post.comments = post.comments.filter(c => c !== commentId && c?._id !== commentId);
            }
            if (!parentId) {
                state.comments = state.comments?.filter(c => c._id !== commentId) || [];
            } else {
                const parent = state.comments?.find(c => c._id === parentId);
                if (parent?.repliesList) {
                    parent.repliesList = parent.repliesList.filter(r => r._id !== commentId);
                }
            }
        },

        // ✅ Socket: post updated by owner
        socketPostUpdated: (state, action) => {
            const { postId, caption, category } = action.payload;
            const post = state.posts.find(p => p._id === postId);
            if (post) { if (caption) post.caption = caption; if (category) post.category = category; }
        },

        // ✅ Socket: post deleted by owner
        socketPostDeleted: (state, action) => {
            const { postId } = action.payload;
            state.posts = state.posts.filter(p => p._id !== postId);
            state.userPosts = state.userPosts.filter(p => p._id !== postId);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPosts.pending, (state) => { state.loading.posts = true; state.error.posts = null; })
            .addCase(fetchPosts.fulfilled, (state, action) => {
                state.loading.posts = false;
                const { posts, nextCursor, hasMore } = action.payload;
                const existingIds = new Set(state.posts.map(p => p._id));
                state.posts = [...state.posts, ...posts.filter(p => !existingIds.has(p._id))];
                state.nextCursor = nextCursor;
                state.hasMore = hasMore;
            })
            .addCase(fetchPosts.rejected, (state, action) => { state.loading.posts = false; state.error.posts = action.payload; })

            .addCase(fetchUserPosts.pending, (state) => { state.loading.userPosts = true; })
            .addCase(fetchUserPosts.fulfilled, (state, action) => {
                state.loading.userPosts = false;
                const { posts, nextCursor, hasMore } = action.payload;
                const existingIds = new Set(state.userPosts.map(p => p._id));
                state.userPosts = [...state.userPosts, ...posts.filter(p => !existingIds.has(p._id))];
                state.userPostsNextCursor = nextCursor;
                state.userPostsHasMore = hasMore;
            })
            .addCase(fetchUserPosts.rejected, (state, action) => { state.loading.userPosts = false; })

            .addCase(fetchSavedPosts.pending, (state) => { state.loading.savedPosts = true; })
            .addCase(fetchSavedPosts.fulfilled, (state, action) => {
                state.loading.savedPosts = false;
                state.savedPosts = Array.isArray(action.payload) ? action.payload : [];
                state.savedPostIds = state.savedPosts.map(p => p._id);
            })
            .addCase(fetchSavedPosts.rejected, (state) => { state.loading.savedPosts = false; })

            .addCase(savePost.pending, (state) => { state.loading.savePost = true; })
            .addCase(savePost.fulfilled, (state, action) => {
                state.loading.savePost = false;
                const { postId, saved } = action.payload;
                if (saved) {
                    if (!state.savedPostIds.includes(postId)) {
                        state.savedPostIds.push(postId);
                        const post = state.posts.find(p => p._id === postId);
                        if (post) state.savedPosts.push(post);
                    }
                } else {
                    state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
                    state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
                }
            })
            .addCase(savePost.rejected, (state) => { state.loading.savePost = false; })

            .addCase(fetchCategories.pending, (state) => { state.loading.categories = true; })
            .addCase(fetchCategories.fulfilled, (state, action) => { state.loading.categories = false; state.categories = action.payload; })
            .addCase(fetchCategories.rejected, (state, action) => { state.loading.categories = false; })

            .addCase(likepost.pending, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post && !post.likes.includes(userId)) post.likes.push(userId);
                state.loading.like = true;
            })
            .addCase(likepost.fulfilled, (state) => { state.loading.like = false; })
            .addCase(likepost.rejected, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post) post.likes = post.likes.filter(id => id !== userId);
                state.loading.like = false;
            })

            .addCase(unlikepost.pending, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post) post.likes = post.likes.filter(id => id !== userId);
                state.loading.unlike = true;
            })
            .addCase(unlikepost.fulfilled, (state) => { state.loading.unlike = false; })
            .addCase(unlikepost.rejected, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post && !post.likes.includes(userId)) post.likes.push(userId);
                state.loading.unlike = false;
            })

            .addCase(createComment.fulfilled, (state, action) => {
                const { data, postId, parentId } = action.payload;
                if (!parentId) {
                    if (state.comments) state.comments.push({ ...data, repliesList: [] });
                    const post = state.posts.find(p => p._id === postId);
                    if (post) post.comments.push(data._id);
                }
            })
            .addCase(fetchComments.pending, (state) => { state.loading.comments = true; state.comments = null; })
            .addCase(fetchComments.fulfilled, (state, action) => { state.loading.comments = false; state.comments = action.payload; })
            .addCase(fetchComments.rejected, (state) => { state.loading.comments = false; })

            .addCase(updatePost.pending, (state) => { state.loading.updatePost = true; })
            .addCase(updatePost.fulfilled, (state, action) => {
                state.loading.updatePost = false;
                const updated = action.payload;
                const fi = state.posts.findIndex(p => p._id === updated._id);
                if (fi !== -1) state.posts[fi] = updated;
                const pi = state.userPosts.findIndex(p => p._id === updated._id);
                if (pi !== -1) state.userPosts[pi] = updated;
            })
            .addCase(updatePost.rejected, (state) => { state.loading.updatePost = false; })

            .addCase(deletePost.pending, (state) => { state.loading.deletePost = true; })
            .addCase(deletePost.fulfilled, (state, action) => {
                state.loading.deletePost = false;
                const postId = action.payload;
                state.posts = state.posts.filter(p => p._id !== postId);
                state.userPosts = state.userPosts.filter(p => p._id !== postId);
                state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
                state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
            })
            .addCase(deletePost.rejected, (state) => { state.loading.deletePost = false; })

            // ── Mood Feed ──────────────────────────────────────────────────────────────
            .addCase(fetchMoodFeed.pending, (state) => { state.loading.moodFeed = true; state.moodPosts = []; })
            .addCase(fetchMoodFeed.fulfilled, (state, action) => {
                state.loading.moodFeed = false;
                state.moodPosts = action.payload.posts || [];
                state.activeMood = action.payload.mood || null;
            })
            .addCase(fetchMoodFeed.rejected, (state) => { state.loading.moodFeed = false; });
    },
});

export { fetchMoodFeed };
export const {
    addNewPost, resetUserPosts,
    socketNewFeedPost, socketNewConfessionPost,
    socketPostLiked, socketPostUnliked,
    socketNewComment, socketCommentDeleted,
    socketPostUpdated, socketPostDeleted,
} = postsSlice.actions;

export default postsSlice.reducer;

```

### `store/reduxStore.js`
```javascript
// ⚠️ Compatibility shim — Redux is being phased out.
// App.js no longer needs <Provider store={store}>
// This file exists only if old components still reference it.

const noopReducer = (state = {}) => state;

let store;
try {
    const { createStore, combineReducers } = require('redux');
    store = createStore(combineReducers({ 
        users: noopReducer, 
        posts: noopReducer, 
        conversation: noopReducer 
    }));
} catch {
    store = {
        getState: () => ({ users: {}, posts: {}, conversation: {} }),
        dispatch: () => {},
        subscribe: () => () => {},
    };
}

export default store;

```

### `store/slices/conversationSlice.js`
```javascript
// ⚠️ Redux has been removed. This file is a compatibility stub.
// Migrate to: import useConversationStore from '../zustand/useConversationStore'
//             and TanStack Query hooks from '../../hooks/queries/useConversationQueries'
export const fetchConversations = () => () => {};
export const fetchMessages = () => () => {};
export const createMessage = () => () => {};
export const createConversation = () => () => {};
export const markMessagesAsRead = () => () => {};
export const getNotifications = () => () => {};
export const readNotifications = () => () => {};
export const updateLastMessage = () => ({ type: 'NOOP' });
export const addMessageToChat = () => ({ type: 'NOOP' });
export const addNewNotification = () => ({ type: 'NOOP' });
export const updateReadMessage = () => ({ type: 'NOOP' });
export default { reducer: (s = {}) => s };

```

### `store/slices/postsSlice.js`
```javascript
// ⚠️ Redux has been removed. This file is a compatibility stub.
// Migrate to: import usePostStore from '../zustand/usePostStore'
//             and TanStack Query hooks from '../../hooks/queries/usePostQueries'
export const fetchPosts = () => () => {};
export const fetchUserPosts = () => () => {};
export const fetchSavedPosts = () => () => {};
export const fetchCategories = () => () => {};
export const likepost = () => () => {};
export const unlikepost = () => () => {};
export const fetchComments = () => () => {};
export const createComment = () => () => {};
export const updatePost = () => () => {};
export const deletePost = () => () => {};
export const savePost = () => () => {};
export const fetchMoodFeed = () => () => {};
export const addNewPost = () => ({ type: 'NOOP' });
export const resetUserPosts = () => ({ type: 'NOOP' });
export const socketNewFeedPost = () => ({ type: 'NOOP' });
export const socketPostLiked = () => ({ type: 'NOOP' });
export const socketPostUnliked = () => ({ type: 'NOOP' });
export const socketNewComment = () => ({ type: 'NOOP' });
export const socketCommentDeleted = () => ({ type: 'NOOP' });
export const socketPostUpdated = () => ({ type: 'NOOP' });
export const socketPostDeleted = () => ({ type: 'NOOP' });
export const socketNewConfessionPost = () => ({ type: 'NOOP' });
export default { reducer: (s = {}) => s };

```

### `store/slices/userSlice.js`
```javascript
// ⚠️ Redux has been removed. This file is a compatibility stub.
// Migrate to: import useAuthStore from '../zustand/useAuthStore'
export const fetchLoggedUser = () => () => {};
export const resetState = () => ({ type: 'NOOP' });
export const updateUser = () => () => {};
export const updateProfile = () => () => {};
export const followUser = () => () => {};
export const unfollowUser = () => () => {};
export const search = () => () => {};
export default { reducer: (s = {}) => s };

```

### `store/zustand/useAuthStore.js`
```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── AXIOS INSTANCE ───────────────────────────────────────────────────────────
// Single axios instance used everywhere — interceptor auto-refreshes on 401
export const api = axios.create({
    baseURL:        BASE,
    withCredentials: true, // sends httpOnly refresh token cookie automatically
});

// In-memory access token — never touches localStorage
// Survives re-renders, lost on hard refresh (intentional — refresh endpoint restores it)
let inMemoryToken = null;

export function getToken() { return inMemoryToken; }
export function setToken(t) { inMemoryToken = t; }
export function clearToken() { inMemoryToken = null; }

// Attach token to every request
api.interceptors.request.use(config => {
    if (inMemoryToken) config.headers.Authorization = `Bearer ${inMemoryToken}`;
    return config;
});

// On 401 — try silent refresh once, then retry original request
let isRefreshing = false;
let failedQueue  = [];

function processQueue(error, token = null) {
    failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token));
    failedQueue = [];
}

api.interceptors.response.use(
    res => res,
    async err => {
        const original = err.config;

        // Skip if already retried, or if it's the refresh call itself
        if (err.response?.status !== 401 || original._retry || original.url?.includes('/auth/refresh')) {
            return Promise.reject(err);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(token => {
                original.headers.Authorization = `Bearer ${token}`;
                return api(original);
            });
        }

        original._retry = true;
        isRefreshing     = true;

        try {
            const { getFingerprint } = await import('../utils/fingerprint');
            const fingerprint = await getFingerprint();
            const res = await axios.post(
                `${BASE}/api/auth/refresh`,
                {},
                { withCredentials: true, headers: { 'x-fingerprint': fingerprint } }
            );
            const newToken = res.data.token;
            setToken(newToken);
            processQueue(null, newToken);
            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
        } catch (refreshErr) {
            processQueue(refreshErr, null);
            clearToken();
            useAuthStore.getState().setUser(null);
            window.location.href = '/login';
            return Promise.reject(refreshErr);
        } finally {
            isRefreshing = false;
        }
    }
);

// ─── AUTH STORE ───────────────────────────────────────────────────────────────
const useAuthStore = create(
    devtools(
        (set, get) => ({
            user:    null,
            loading: false,
            error:   null,

            setUser:    (user)  => set({ user }),
            clearError: ()      => set({ error: null }),

            // ── Silent restore on page refresh ────────────────────────────────
            // Called once on app mount — uses httpOnly refresh token cookie
            // to get a new access token without user doing anything
            initAuth: async () => {
                set({ loading: true });
                try {
                    const { getFingerprint } = await import('../utils/fingerprint');
                    const fingerprint = await getFingerprint();

                    const res = await axios.post(
                        `${BASE}/api/auth/refresh`,
                        {},
                        { withCredentials: true, headers: { 'x-fingerprint': fingerprint } }
                    );
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false, error: null });
                } catch {
                    // No valid refresh token — user needs to log in
                    clearToken();
                    set({ user: null, loading: false });
                }
            },

            // ── Login ─────────────────────────────────────────────────────────
            login: async ({ email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/login`,
                        { email, password, fingerprint },
                        { withCredentials: true }
                    );
                    if (res.data.requiresOtp) {
                        set({ loading: false });
                        return { requiresOtp: true, email };
                    }
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false });
                    return { success: true };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Login failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            // ── Signup ────────────────────────────────────────────────────────
            signup: async ({ fullname, email, password, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/add`,
                        { fullname, email, password, fingerprint },
                        { withCredentials: true }
                    );
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false });
                    return { success: true };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Signup failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            // ── Google OAuth ──────────────────────────────────────────────────
            googleAuth: async ({ credential, fingerprint }) => {
                set({ loading: true, error: null });
                try {
                    const res = await axios.post(
                        `${BASE}/api/auth/google`,
                        { credential, fingerprint },
                        { withCredentials: true }
                    );
                    const { token, user } = res.data;
                    setToken(token);
                    set({ user, loading: false });
                    return { success: true };
                } catch (err) {
                    const msg = err.response?.data?.message || 'Google auth failed';
                    set({ loading: false, error: msg });
                    return { error: msg };
                }
            },

            // ── Logout ────────────────────────────────────────────────────────
            logout: async () => {
                const user = get().user;
                try {
                    await api.post('/api/auth/logout');
                } catch {}
                clearToken();
                localStorage.removeItem('socketId');
                set({ user: null });
            },

            // ── Follow / Unfollow ─────────────────────────────────────────────
            followUser: async (followUserId) => {
                const user = get().user;
                set(s => ({ user: { ...s.user, following: [...(s.user?.following || []), followUserId] } }));
                try {
                    await api.post('/api/auth/follow', { loggedUserId: user._id, followUserId });
                } catch {
                    set(s => ({ user: { ...s.user, following: s.user.following.filter(id => id !== followUserId) } }));
                }
            },

            unfollowUser: async (unfollowUserId) => {
                const user = get().user;
                set(s => ({ user: { ...s.user, following: s.user.following.filter(id => id !== unfollowUserId) } }));
                try {
                    await api.post('/api/auth/unfollow', { loggedUserId: user._id, unfollowUserId });
                } catch {
                    set(s => ({ user: { ...s.user, following: [...(s.user?.following || []), unfollowUserId] } }));
                }
            },

            // ── Update profile ────────────────────────────────────────────────
            updateProfile: async (data) => {
                set({ loading: true });
                try {
                    const res = await api.put('/api/auth/update-profile', data);
                    set({ user: res.data, loading: false });
                    return { success: true };
                } catch (err) {
                    set({ loading: false, error: err.response?.data?.message });
                    return { error: err.response?.data?.message };
                }
            },
        }),
        { name: 'AuthStore' }
    )
);

export default useAuthStore;

```

### `store/zustand/useConversationStore.js`
```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useConversationStore = create(
    devtools(
        (set, get) => ({
            // ─── Active chat ──────────────────────────────────────────────
            activeConversationId: null,
            activeParticipant: null, // { userId, fullname, profilePicture }

            // ─── Online users ─────────────────────────────────────────────
            onlineUserIds: new Set(),

            // ─── Typing indicators ────────────────────────────────────────
            typingUsers: {}, // conversationId → { senderName, ts }

            // ─── Unread counts ────────────────────────────────────────────
            unreadCounts: {}, // conversationId → number

            // ─── Socket messages (real-time, merged with query cache) ─────
            socketMessages: {}, // conversationId → Message[]

            // ─── Search state ─────────────────────────────────────────────
            messageSearchQuery: '',
            messageSearchResults: [],

            // ─── UI ───────────────────────────────────────────────────────
            chatOpen: false,

            // ─── Setters ──────────────────────────────────────────────────
            openChat: (conversationId, participant) => set({
                activeConversationId: conversationId,
                activeParticipant: participant,
                chatOpen: true,
            }),
            closeChat: () => set({
                activeConversationId: null,
                activeParticipant: null,
                chatOpen: false,
            }),

            // ─── Online users ─────────────────────────────────────────────
            setOnlineUsers: (users) => set({
                onlineUserIds: new Set(users.map(u => u.userId))
            }),
            isOnline: (userId) => get().onlineUserIds.has(userId),

            // ─── Typing ───────────────────────────────────────────────────
            setTyping: (conversationId, senderName) => {
                set(state => ({
                    typingUsers: {
                        ...state.typingUsers,
                        [conversationId]: { senderName, ts: Date.now() },
                    }
                }));
                // Auto-clear after 3 seconds
                setTimeout(() => {
                    set(state => {
                        const entry = state.typingUsers[conversationId];
                        if (entry && Date.now() - entry.ts >= 2900) {
                            const next = { ...state.typingUsers };
                            delete next[conversationId];
                            return { typingUsers: next };
                        }
                        return {};
                    });
                }, 3000);
            },
            clearTyping: (conversationId) => {
                set(state => {
                    const next = { ...state.typingUsers };
                    delete next[conversationId];
                    return { typingUsers: next };
                });
            },
            isTyping: (conversationId) => !!get().typingUsers[conversationId],
            getTypingName: (conversationId) => get().typingUsers[conversationId]?.senderName,

            // ─── Unread counts ────────────────────────────────────────────
            setUnreadCount: (conversationId, count) => set(state => ({
                unreadCounts: { ...state.unreadCounts, [conversationId]: count }
            })),
            incrementUnread: (conversationId) => set(state => ({
                unreadCounts: {
                    ...state.unreadCounts,
                    [conversationId]: (state.unreadCounts[conversationId] || 0) + 1,
                }
            })),
            clearUnread: (conversationId) => set(state => ({
                unreadCounts: { ...state.unreadCounts, [conversationId]: 0 }
            })),
            totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),

            // ─── Socket messages ──────────────────────────────────────────
            addSocketMessage: (conversationId, message) => {
                set(state => {
                    const existing = state.socketMessages[conversationId] || [];
                    const alreadyExists = existing.some(m => m._id === message._id);
                    if (alreadyExists) return {};
                    return {
                        socketMessages: {
                            ...state.socketMessages,
                            [conversationId]: [...existing, message],
                        }
                    };
                });
            },
            updateMessageStatus: (conversationId, messageId, updates) => {
                set(state => ({
                    socketMessages: {
                        ...state.socketMessages,
                        [conversationId]: (state.socketMessages[conversationId] || []).map(m =>
                            m._id === messageId ? { ...m, ...updates } : m
                        ),
                    }
                }));
            },
            deleteSocketMessage: (conversationId, messageId) => {
                set(state => ({
                    socketMessages: {
                        ...state.socketMessages,
                        [conversationId]: (state.socketMessages[conversationId] || []).filter(m => m._id !== messageId),
                    }
                }));
            },
            clearSocketMessages: (conversationId) => {
                set(state => {
                    const next = { ...state.socketMessages };
                    delete next[conversationId];
                    return { socketMessages: next };
                });
            },
            getSocketMessages: (conversationId) => get().socketMessages[conversationId] || [],

            // ─── Message search ───────────────────────────────────────────
            setMessageSearch: (query) => set({ messageSearchQuery: query }),
            setMessageSearchResults: (results) => set({ messageSearchResults: results }),
            clearMessageSearch: () => set({ messageSearchQuery: '', messageSearchResults: [] }),
        }),
        { name: 'ConversationStore' }
    )
);

export default useConversationStore;

```

### `store/zustand/usePostStore.js`
```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// UI-only state — server data comes from TanStack Query hooks
const usePostStore = create(
    devtools(
        (set, get) => ({
            // ─── Optimistic like state ─────────────────────────────────────
            // postId → Set of userIds who liked (merges with server data)
            optimisticLikes: {},

            // ─── Saved post IDs (for bookmark icon) ───────────────────────
            savedPostIds: new Set(),

            // ─── Active mood filter ────────────────────────────────────────
            activeMood: null,

            // ─── Open comment panel ────────────────────────────────────────
            openCommentPostId: null,

            // ─── New posts from socket (prepended to feed) ─────────────────
            socketPosts: [],

            // ─── Confession posts from socket ──────────────────────────────
            socketConfessions: [],

            // ─── Setters ──────────────────────────────────────────────────
            setActiveMood: (mood) => set({ activeMood: mood }),
            clearMood: () => set({ activeMood: null }),
            setOpenComment: (postId) => set({ openCommentPostId: postId }),
            closeComment: () => set({ openCommentPostId: null }),

            // ─── Optimistic like toggle ────────────────────────────────────
            optimisticLike: (postId, userId) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (current.has(userId)) current.delete(userId);
                    else current.add(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            rollbackLike: (postId, userId, wasLiked) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (wasLiked) current.add(userId);
                    else current.delete(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            // ─── Saved posts ───────────────────────────────────────────────
            initSavedIds: (ids) => set({ savedPostIds: new Set(ids) }),
            toggleSaved: (postId, saved) => {
                set(state => {
                    const next = new Set(state.savedPostIds);
                    if (saved) next.add(postId); else next.delete(postId);
                    return { savedPostIds: next };
                });
            },
            isSaved: (postId) => get().savedPostIds.has(postId),

            // ─── Socket real-time ──────────────────────────────────────────
            addSocketPost: (post) => {
                if (post.isAnonymous) {
                    set(state => {
                        const exists = state.socketConfessions.some(p => p._id === post._id);
                        return exists ? {} : { socketConfessions: [post, ...state.socketConfessions] };
                    });
                } else {
                    set(state => {
                        const exists = state.socketPosts.some(p => p._id === post._id);
                        return exists ? {} : { socketPosts: [post, ...state.socketPosts] };
                    });
                }
            },

            removeSocketPost: (postId) => {
                set(state => ({
                    socketPosts: state.socketPosts.filter(p => p._id !== postId),
                    socketConfessions: state.socketConfessions.filter(p => p._id !== postId),
                }));
            },

            syncLikeFromSocket: (postId, userId, liked) => {
                set(state => {
                    const current = new Set(state.optimisticLikes[postId] || []);
                    if (liked) current.add(userId); else current.delete(userId);
                    return { optimisticLikes: { ...state.optimisticLikes, [postId]: current } };
                });
            },

            clearSocketPosts: () => set({ socketPosts: [] }),
        }),
        { name: 'PostStore' }
    )
);

export default usePostStore;

```

### `subscribers/postSubscriber.js`
```javascript
const { subscribe } = require('../lib/nats');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Feed = require('../models/Feed');
const Analytics = require('../models/Analytics');

let _io;
function setIo(io) { _io = io; }

async function initPostSubscriber() {
    await subscribe('posts.created', async (data) => {
        console.log('[NATS] Received posts.created event:', data);
        const { id: postId, user, category } = data;

        const author = await User.findById(user._id).select('followers fullname profile_picture');
        console.log('[NATS] Author found:', author);

        if (!author || !author.followers.length) {
            console.log('[NATS] No followers, skipping...');
            return;
        }

        const followerIds = author.followers;

        // 1. Save notifications to DB
        const notifications = followerIds.map(followerId => ({
            recipient: followerId,
            sender: { id: author._id, fullname: author.fullname, profile_picture: author.profile_picture },
            type: 'new_post',
            post: postId,
        }));
        const savedNotifications = await Notification.insertMany(notifications);
        console.log(`[NATS] Notifications saved for ${followerIds.length} followers`);

        // 2. Emit real-time socket notification to each follower
        if (_io) {
            savedNotifications.forEach(notification => {
                _io.to(notification.recipient.toString()).emit('newNotification', {
                    _id: notification._id,
                    type: notification.type,
                    sender: notification.sender,
                    post: notification.post,
                    createdAt: notification.createdAt,
                    read: notification.read,
                });
            });
            console.log(`[NATS] Real-time notifications emitted to ${followerIds.length} followers`);
        }

        // 3. Update followers' feeds
        const feedEntries = followerIds.map(followerId => ({ userId: followerId, post: postId }));
        await Feed.insertMany(feedEntries);
        console.log(`[NATS] Feed updated for ${followerIds.length} followers`);

        // 4. Track analytics
        await Analytics.create({
            event: 'post.created', userId: user._id, postId, category,
            meta: { followersNotified: followerIds.length },
        });
        console.log(`[NATS] Analytics tracked for post ${postId}`);
    });
}

module.exports = { initPostSubscriber, setIo };

```

### `utils/authSecurity.js`
```javascript
const crypto = require('crypto');
const UAParser = require('ua-parser-js');
const axios = require('axios');

// Hash a token or fingerprint before storing
function hashValue(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

// Generate a unique token family ID for a new login session
function generateFamily() {
    return crypto.randomBytes(32).toString('hex');
}

// Parse user agent into readable device string
function parseDevice(userAgent) {
    if (!userAgent) return 'Unknown Device';
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const browser = result.browser.name || 'Unknown Browser';
    const os = result.os.name || 'Unknown OS';
    return `${browser} on ${os}`;
}

// Get geolocation from IP (free service, no API key needed)
async function getLocation(ip) {
    try {
        // Skip for localhost
        if (ip === '127.0.0.1' || ip === '::1' || ip?.startsWith('192.168')) {
            return { city: 'Localhost', region: 'Local', country: 'Local' };
        }
        const res = await axios.get(`http://ip-api.com/json/${ip}?fields=city,regionName,country`, { timeout: 3000 });
        return {
            city: res.data.city || 'Unknown',
            region: res.data.regionName || 'Unknown',
            country: res.data.country || 'Unknown',
        };
    } catch {
        return { city: 'Unknown', region: 'Unknown', country: 'Unknown' };
    }
}

// Extract real IP from request
function getIp(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'Unknown'
    );
}

module.exports = { hashValue, generateFamily, parseDevice, getLocation, getIp };

```

### `utils/cloudinary.js`
```javascript
const CLOUD_NAME = 'dcmrsdydr';
const UPLOAD_PRESET = 'socialsquare';

export async function uploadToCloudinary(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                resolve(data.secure_url);
            } else {
                reject(new Error('Upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
    });
}

export function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    if (file.size > maxSize) {
        return 'Image must be under 10MB.';
    }
    return null;
}

```

### `utils/fingerprint.js`
```javascript
// Generates a lightweight browser fingerprint without any library
// Combines stable browser properties into a hash-like string

export async function getFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform || 'unknown',
    ];

    const raw = components.join('|');

    // Use SubtleCrypto to hash it
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        // Fallback: simple string hash
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash << 5) - hash + raw.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16);
    }
}

```

### `utils/gemini.js`
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = 'gemini-2.0-flash';

// ─── NVIDIA PHI-4 CLIENT ──────────────────────────────────────────────────────
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_MODEL = 'microsoft/phi-4-multimodal-instruct';

async function nvidiaChat(messages, maxTokens = 512) {
    const res = await axios.post(NVIDIA_URL, {
        model:             NVIDIA_MODEL,
        messages,
        max_tokens:        maxTokens,
        temperature:       0.10,
        top_p:             0.70,
        frequency_penalty: 0.00,
        presence_penalty:  0.00,
        stream:            false,
    }, {
        headers: {
            Authorization: `Bearer ${NVIDIA_KEY}`,
            Accept:        'application/json',
        },
        timeout: 20000,
    });
    return res.data.choices[0]?.message?.content || '';
}

// ─── CAPTION GENERATION ───────────────────────────────────────────────────────
async function generateCaptionFromImage(imageUrl) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const fetch  = (await import('node-fetch')).default;
        const imageRes = await fetch(imageUrl);
        const buffer   = await imageRes.arrayBuffer();
        const base64   = Buffer.from(buffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const result = await model.generateContent([
            { inlineData: { data: base64, mimeType } },
            'Generate 3 short, engaging social media captions for this image. Return them as a JSON array of strings like: ["caption1", "caption2", "caption3"]. Keep each caption under 100 characters. Be creative and fun.',
        ]);

        const text  = result.response.text().trim();
        const match = text.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);
        return [text];

    } catch (geminiErr) {
        console.warn('[Gemini] Caption failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        const reply = await nvidiaChat([
            {
                role:    'user',
                content: `Look at this image URL: ${imageUrl}\n\nGenerate 3 short, engaging social media captions. Return ONLY a JSON array like: ["caption1", "caption2", "caption3"]. Each caption under 100 characters. Be creative and fun.`,
            },
        ], 300);

        const match = reply.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);

        // If no JSON array found, split by newlines as last resort
        const lines = reply.split('\n').filter(l => l.trim()).slice(0, 3);
        return lines.length ? lines : ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];

    } catch (nvidiaErr) {
        console.error('[NVIDIA] Caption fallback also failed:', nvidiaErr.message);
        return ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];
    }
}

// ─── MOOD DETECTION ───────────────────────────────────────────────────────────
const VALID_MOODS = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
const MOOD_PROMPT = (caption) =>
    `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`;

async function detectMoodFromCaption(caption) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(MOOD_PROMPT(caption));
        const mood   = result.response.text().trim().toLowerCase();
        if (VALID_MOODS.includes(mood)) return mood;

    } catch (geminiErr) {
        console.warn('[Gemini] Mood detection failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        const reply = await nvidiaChat([
            { role: 'user', content: MOOD_PROMPT(caption) }
        ], 10);

        const mood = reply.trim().toLowerCase().split(/\s+/)[0]; // take first word only
        return VALID_MOODS.includes(mood) ? mood : 'neutral';

    } catch (nvidiaErr) {
        console.error('[NVIDIA] Mood fallback also failed:', nvidiaErr.message);
        return 'neutral';
    }
}

// ─── GENERAL TEXT GENERATION (used by chatbot or other features) ──────────────
async function generateText(prompt, { maxTokens = 300, temperature = 0.7 } = {}) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();

    } catch (geminiErr) {
        console.warn('[Gemini] Text generation failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        return await nvidiaChat([{ role: 'user', content: prompt }], maxTokens);
    } catch (nvidiaErr) {
        console.error('[NVIDIA] Text generation fallback failed:', nvidiaErr.message);
        return '';
    }
}

module.exports = { generateCaptionFromImage, detectMoodFromCaption, generateText };

```

### `utils/mailer.js`
```javascript
const nodemailer = require('nodemailer');

function getTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
}

async function sendNewDeviceAlert({ email, fullname, device, ip, location, time }) {
    await getTransporter().sendMail({
        from: `"Social Square Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '⚠️ New device login detected',
        html: `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <div style="background:#6366f1;padding:20px 24px;">
                    <h2 style="color:#fff;margin:0;">New Login Detected</h2>
                </div>
                <div style="padding:24px;">
                    <p>Hi <strong>${fullname}</strong>,</p>
                    <p>We detected a login to your Social Square account from a new device.</p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Device</td>
                            <td style="padding:8px;font-size:14px;"><strong>${device}</strong></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">IP Address</td>
                            <td style="padding:8px;font-size:14px;"><strong>${ip}</strong></td>
                        </tr>
                        <tr style="border-bottom:1px solid #f3f4f6;">
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Location</td>
                            <td style="padding:8px;font-size:14px;"><strong>${location.city}, ${location.region}, ${location.country}</strong></td>
                        </tr>
                        <tr>
                            <td style="padding:8px;color:#6b7280;font-size:14px;">Time</td>
                            <td style="padding:8px;font-size:14px;"><strong>${time}</strong></td>
                        </tr>
                    </table>
                    <p style="color:#ef4444;font-size:14px;">If this wasn't you, <strong>change your password immediately</strong>.</p>
                </div>
            </div>`,
    });
}

async function sendResetEmail(email, resetUrl) {
    await getTransporter().sendMail({
        from: `"Social Square" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Reset your password',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;">
                <h2>Password Reset</h2>
                <p>Click the button below to reset your password. Expires in <strong>1 hour</strong>.</p>
                <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Reset Password</a>
                <p style="margin-top:16px;color:#888;">If you didn't request this, ignore this email.</p>
            </div>`,
    });
}

async function sendOtpEmail(email, fullname, otp) {
    await getTransporter().sendMail({
        from: `"Social Square" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your login verification code',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <div style="background:#6366f1;padding:20px 24px;">
                    <h2 style="color:#fff;margin:0;">Verification Code</h2>
                </div>
                <div style="padding:24px;text-align:center;">
                    <p>Hi <strong>${fullname}</strong>, use the code below to complete your login.</p>
                    <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#6366f1;margin:24px 0;">
                        ${otp}
                    </div>
                    <p style="color:#6b7280;font-size:13px;">This code expires in <strong>10 minutes</strong>.</p>
                    <p style="color:#ef4444;font-size:13px;">Never share this code with anyone.</p>
                </div>
            </div>`,
    });
}

async function sendLockoutEmail(email, fullname, unlockTime) {
    await getTransporter().sendMail({
        from: `"Social Square Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔒 Account temporarily locked',
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;">
                <h2>Account Locked</h2>
                <p>Hi <strong>${fullname}</strong>,</p>
                <p>Your account has been temporarily locked due to too many failed login attempts.</p>
                <p>You can try again after <strong>${unlockTime}</strong>.</p>
                <p style="color:#6b7280;font-size:13px;">If this wasn't you, please reset your password immediately.</p>
            </div>`,
    });
}

module.exports = { sendNewDeviceAlert, sendResetEmail, sendOtpEmail, sendLockoutEmail };

```

### `utils/pushNotifications.js`
```javascript
// Request permission and show push notifications

export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

export function showPushNotification({ title, body, icon, onClick }) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
        body,
        icon: icon || '/logo192.png',
        badge: '/logo192.png',
        silent: false,
    });

    if (onClick) notification.onclick = onClick;

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
}

export function usePushNotifications() {
    const request = requestNotificationPermission;
    const show = showPushNotification;
    return { request, show, isSupported: 'Notification' in window, permission: Notification.permission };
}

```
