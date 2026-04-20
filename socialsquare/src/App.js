import './App.css';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
import 'primereact/resources/primereact.min.css';
import { ConfirmDialog } from 'primereact/confirmdialog';

// ✅ All imports from src/ root — no '../' needed
import useAuthStore from './store/zustand/useAuthStore';
import useConversationStore from './store/zustand/useConversationStore';
import usePostStore from './store/zustand/usePostStore';
import { socket } from './socket';
import toast, { Toaster } from 'react-hot-toast';
import { DarkModeProvider } from './context/DarkModeContext';
import useTokenRefresh from './hooks/useTokenRefresh';
import Conversations from './pages/components/Conversations';
import SettingsLayout from './pages/components/SettingsLayout';
import useTabTitle from './hooks/useTabTitle';

// ─── LAYOUT COMPONENTS ────────────────────────────────────────────────────────
import Sidebar from './pages/components/Sidebar';
import Explore from './pages/components/Explore';
import Communities from './pages/components/Communities';
import BottomNav from './pages/components/BottomNav';
import Navbar from './pages/components/Navbar';

import Footer from './pages/components/Footer';
import NotificationBell from './pages/components/ui/NotificationBell';

// ─── LAZY PAGES ───────────────────────────────────────────────────────────────
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Forgot = lazy(() => import('./pages/Forgot'));
const Contact = lazy(() => import('./pages/Contact'));
const Help = lazy(() => import('./pages/Help'));
const Landing = lazy(() => import('./pages/Landing'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const Pulse = lazy(() => import('./pages/Pulse'));

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
    const navigate = useNavigate();
    const initAuth = useAuthStore(s => s.initAuth);
    const user = useAuthStore(s => s.user);
    const { setOnlineUsers, addOnlineUser, removeOnlineUser, addNotification } = useConversationStore();
    const { setPostDetailId, setStoryDetailUserId } = usePostStore();

    useTokenRefresh(Boolean(user?._id));

    // ✅ On every page load/refresh — silently restore session from httpOnly cookie
    // No localStorage needed — refresh token cookie does it all
    useEffect(() => {
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!user?._id) return;
        if (!socket.connected) socket.connect();
        socket.emit('registerUser', user._id);
        socket.on('connect', () => localStorage.setItem('socketId', socket.id));
        socket.on('updateUserList', setOnlineUsers);
        socket.on('userOnline', addOnlineUser);
        socket.on('userOffline', removeOnlineUser);

        socket.on('newNotification', (notification) => {
            addNotification(notification);

            // Show toast
            const { sender, type, message, post, story } = notification;
            let icon = '🔔';
            if (type === 'like') icon = '❤️';
            if (type === 'comment') icon = '💬';
            if (type === 'message') icon = '📩';
            if (type === 'system') icon = '⚠️';
            if (type === 'new_post') icon = '🖼️';
            if (type === 'new_story') icon = '📸';

            toast(
                (t) => (
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        onClick={() => {
                            if (type === 'message' && sender) {
                                const targetId = sender._id || sender.id;
                                if (targetId) navigate(`/messages/${targetId}`);
                            } else if ((type === 'like' && story) || type === 'new_story') {
                                setStoryDetailUserId(sender._id);
                            } else if (post) {
                                setPostDetailId(post);
                            }
                            toast.dismiss(t.id);
                        }}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--primary)' }}>
                            <img src={sender.profile_picture || '/default-profile.png'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{icon}</span> {sender.fullname}
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {type === 'like' && (story ? 'liked your story' : 'liked your post')}
                                {type === 'comment' && 'commented on your post'}
                                {type === 'new_post' && 'posted something new'}
                                {type === 'new_story' && 'added a new story'}
                                {type === 'message' && (message?.content || 'sent you a message')}
                                {type === 'system' && (message?.content || 'Security Alert')}
                            </p>
                        </div>
                    </div>
                ),
                { duration: 5000, position: 'top-center', style: { padding: '10px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' } }
            );
        });

        socket.on('newStory', (story) => {
            const { user: storyUser } = story;
            if (storyUser._id === user?._id) return;

            toast(
                (t) => (
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        onClick={() => {
                            setStoryDetailUserId(storyUser._id);
                            toast.dismiss(t.id);
                        }}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #ff4b2b' }}>
                            <img src={storyUser.profile_picture || '/default-profile.png'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)' }}>
                                📸 {user.fullname}
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub)' }}>Added a new story</p>
                        </div>
                    </div>
                ),
                { duration: 5000, position: 'top-center', style: { padding: '10px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' } }
            );
        });

        socket.on('collaborationInvite', ({ postCaption, invitedBy }) => {
            queryClient.invalidateQueries({ queryKey: ['posts', 'collab-invites', user?._id] });
            toast(`🤝 ${invitedBy} invited you to collaborate on a post`, {
                icon: '🤝',
                duration: 5000,
                position: 'top-center',
                style: { borderRadius: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
            });
        });

        return () => {
            socket.off('connect');
            socket.off('updateUserList');
            socket.off('userOnline');
            socket.off('userOffline');
            socket.off('newNotification');
            socket.off('collaborationInvite');
        };
    }, [user?._id, setOnlineUsers, addOnlineUser, removeOnlineUser, addNotification, setPostDetailId, setStoryDetailUserId, navigate]);

    return null;
}

function SharedPostRedirect() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);

    useEffect(() => {
        if (!postId) return;

        window.sessionStorage.setItem('pendingPostId', postId);

        if (!initialized || loading) return;

        if (user?.username) {
            navigate(`/${user.username}?post=${postId}`, { replace: true });
            return;
        }

        navigate(`/login?post=${postId}`, { replace: true });
    }, [postId, initialized, loading, user?.username, navigate]);

    return <PageLoader />;
}


function SharedStoryRedirect() {
    const { userId, storyId } = useParams();
    const navigate = useNavigate();
    const user = useAuthStore(s => s.user);
    const loading = useAuthStore(s => s.loading);
    const initialized = useAuthStore(s => s.initialized);

    useEffect(() => {
        if (!userId) return;

        window.sessionStorage.setItem('pendingStoryUserId', userId);
        if (storyId) {
            window.sessionStorage.setItem('pendingStoryId', storyId);
        }

        if (!initialized || loading) return;

        if (user?.username) {
            navigate(`/${user.username}?storyUser=${userId}${storyId ? `&story=${storyId}` : ''}`, { replace: true });
            return;
        }

        navigate(`/login?storyUser=${userId}${storyId ? `&story=${storyId}` : ''}`, { replace: true });
    }, [userId, storyId, initialized, loading, user?.username, navigate]);

    return <PageLoader />;
}

// ─── MAIN LAYOUT WITH NAVBAR & SIDEBAR ────────────────────────────────────────
function PublicLayout({ children }) {
    return (
        <div className="flex flex-col min-h-[100dvh] w-full">
            <Navbar />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </div>
    );
}

function MainLayout({ children }) {
    const user = useAuthStore(s => s.user);
    const location = useLocation();
    const isMessages = location.pathname.startsWith('/messages');

    return (
        <div className="relative flex flex-col h-screen w-full overflow-hidden">
            <div className="lg:hidden">
                <Navbar />
            </div>
            {/* Desktop Notification Bell (Top Right) - Hide in Chat Panel */}
            {!isMessages && (
                <div className="hidden lg:block fixed top-6 right-8 z-50">
                    <NotificationBell userId={user?._id} showLabel={false} />
                </div>
            )}
            <div className="flex w-full flex-1 min-h-0">
                <Sidebar />
                <main className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar relative">
                    {children}
                    <BottomNav />
                </main>
            </div>
        </div>
    );
}

function App() {
    useTabTitle();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <HelmetProvider>
            <Toaster
                position="top-center"
                toastOptions={{ duration: 3000 }}
                containerStyle={{ zIndex: 99999 }}
            />
            {isOffline && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    padding: '8px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                }}>
                    📶 You are currently offline. Some features may be limited.
                </div>
            )}
            <QueryClientProvider client={queryClient}>
                <DarkModeProvider>
                    <ConfirmDialog />
                    <Router>
                        <AppInit />
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                {/* Public Routes - With PublicLayout (Navbar) */}
                                <Route path="/" element={<PublicLayout><Landing /></PublicLayout>} />
                                <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
                                <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
                                <Route path="/forgot" element={<PublicLayout><Forgot /></PublicLayout>} />
                                <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
                                <Route path="/help" element={<PublicLayout><Help /></PublicLayout>} />
                                <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
                                <Route path="/verify-otp" element={<PublicLayout><VerifyOtp /></PublicLayout>} />
                                <Route path="/verify-email/:token" element={<PublicLayout><VerifyEmail /></PublicLayout>} />

                                {/* Protected Routes - With MainLayout (Navbar + Sidebar) */}
                                <Route path="/:username" element={<MainLayout><Home /></MainLayout>} />
                                <Route path="/messages" element={<MainLayout><Conversations /></MainLayout>} />
                                <Route path="/messages/:userId" element={<MainLayout><Conversations /></MainLayout>} />
                                <Route path="/settings/*" element={<MainLayout><SettingsLayout /></MainLayout>} />
                                <Route path="/notifications" element={<MainLayout><NotificationsPage /></MainLayout>} />
                                <Route path="/profile/:userId" element={<MainLayout><ProfilePage /></MainLayout>} />
                                <Route path="/post/:postId" element={<MainLayout><SharedPostRedirect /></MainLayout>} />
                                <Route path="/story/:userId/:storyId" element={<MainLayout><SharedStoryRedirect /></MainLayout>} />
                                <Route path="/story/:userId" element={<MainLayout><SharedStoryRedirect /></MainLayout>} />
                                <Route path="/admin" element={<MainLayout><AdminDashboard /></MainLayout>} />
                                <Route path="/explore" element={<MainLayout><Explore /></MainLayout>} />
                                <Route path="/communities" element={<MainLayout><Communities /></MainLayout>} />
                                <Route path="/users" element={<MainLayout><UsersPage /></MainLayout>} />
                                <Route path="/pulse" element={<MainLayout><Pulse /></MainLayout>} />

                            </Routes>
                        </Suspense>
                    </Router>
                </DarkModeProvider>
            </QueryClientProvider>
        </HelmetProvider>
    );
}

export default App;