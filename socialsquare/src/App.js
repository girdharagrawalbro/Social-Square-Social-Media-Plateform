import './App.css';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './queryClient';
import { HelmetProvider } from 'react-helmet-async';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
import 'primereact/resources/primereact.min.css';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';


import useAuthStore, { api } from './store/zustand/useAuthStore';
import useConversationStore from './store/zustand/useConversationStore';
import usePostStore from './store/zustand/usePostStore';
import { socket } from './socket';
import toast, { Toaster } from 'react-hot-toast';
import { DarkModeProvider } from './context/DarkModeContext';
import useTokenRefresh from './hooks/useTokenRefresh';
import Conversations from './pages/components/Conversations';
import SettingsLayout from './pages/components/SettingsLayout';
import useTabTitle from './hooks/useTabTitle';
import useFeedSocket from './hooks/useFeedSocket';
import useAuthCheck from './hooks/useAuthCheck';

// ─── LAYOUT COMPONENTS ────────────────────────────────────────────────────────
import Sidebar from './pages/components/Sidebar';
import Explore from './pages/components/Explore';
import Communities from './pages/components/Communities';
import BottomNav from './pages/components/BottomNav';
import Navbar from './pages/components/Navbar';
import { CreateStoryModal } from './pages/components/Stories';
import Footer from './pages/components/Footer';
import NotificationBell from './pages/components/ui/NotificationBell';
import Chatbot from './pages/components/Chatbot';
import PostDetail from './pages/components/PostDetail';
import UserProfile from './pages/components/UserProfile';
import { Dialog } from 'primereact/dialog';

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
const StoriesPage = lazy(() => import('./pages/StoriesPage'));

const PageLoader = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #808bf5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);



function AppInit() {
    const navigate = useNavigate();
    const initAuth = useAuthStore(s => s.initAuth);
    const user = useAuthStore(s => s.user);
    const { setOnlineUsers, addOnlineUser, removeOnlineUser, addNotification } = useConversationStore();
    const { setPostDetailId, setStoryDetailUserId } = usePostStore();
    useFeedSocket();

    useTokenRefresh(Boolean(user?._id));

    // ✅ On every page load/refresh — silently restore session from httpOnly cookie
    useEffect(() => {
        initAuth();
        if (Capacitor.isNativePlatform()) {
            GoogleAuth.initialize({
                clientId: '438982943802-70qgbbglo3ei6ufhubp5hp1asiuv0oov.apps.googleusercontent.com',
                scopes: ['profile', 'email'],
                grantOfflineAccess: true,
            });
        }
    }, [initAuth]);

    // ✅ Push Notifications + Initial State Fetch
    const { setNotifications } = useConversationStore();

    useEffect(() => {
        if (!user?._id) return;

        // ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────
        const setupPushNotifications = async () => {
            if (!Capacitor.isNativePlatform()) return;

            try {
                let permStatus = await PushNotifications.checkPermissions();

                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.warn('User denied push notification permissions');
                    return;
                }

                // ✅ STEP 1 — Attach ALL listeners BEFORE calling register()
                PushNotifications.addListener('registration', async (token) => {
                    console.log('✅ FCM Token:', token.value);
                    try {
                        // Save FCM token to your backend
                        await api.post('/api/user/fcm-token', { token: token.value });
                    } catch (err) {
                        console.error('Failed to save FCM token to backend:', err);
                    }
                });

                PushNotifications.addListener('registrationError', (err) => {
                    console.error('❌ Push registration error:', err.error);
                });

                // Fired when app is OPEN and notification arrives
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('📩 Foreground notification received:', notification);
                    toast(notification.title || 'New notification', {
                        icon: '🔔',
                        duration: 4000,
                        position: 'top-center',
                        style: {
                            borderRadius: '16px',
                            background: 'var(--surface-1)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                        },
                    });
                });

                // Fired when user TAPS a notification (app in background/killed)
                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    console.log('👆 Notification tapped:', action.notification);
                    const data = action.notification.data;
                    if (!data) return;

                    if (data.type === 'message' && data.senderId) {
                        navigate(`/conversation/${data.senderId}`);
                    } else if (data.postId) {
                        setPostDetailId(data.postId);
                    } else if (data.storyUserId) {
                        setStoryDetailUserId(data.storyUserId);
                    }
                });

                // ✅ STEP 2 — Register AFTER all listeners are attached
                await PushNotifications.register();

            } catch (err) {
                console.error('Push notification setup failed:', err);
            }
        };

        // ─── INITIAL DATA FETCH ───────────────────────────────────────────────
        const fetchInitialState = async () => {
            try {
                const notifRes = await api.get('/api/conversation/notifications?limit=1');
                if (notifRes.data.notifications) {
                    setNotifications(notifRes.data.notifications);
                }
            } catch (err) {
                console.error('Failed to fetch initial notifications:', err);
            }
        };

        setupPushNotifications();
        fetchInitialState();

        // ✅ Cleanup push listeners when user logs out or changes
        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners();
            }
        };
    }, [user?._id, setNotifications, navigate, setPostDetailId, setStoryDetailUserId]);

    // ─── SOCKET EVENTS ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?._id) return;
        if (!socket.connected) socket.connect();
        socket.emit('registerUser', user._id);
        socket.on('connect', () => localStorage.setItem('socketId', socket.id));
        socket.on('updateUserList', setOnlineUsers);
        socket.on('userOnline', addOnlineUser);
        socket.on('userOffline', removeOnlineUser);

        const handleNewNotification = (notification) => {
            if (!notification) return;

            const senderId = notification.sender?.id || notification.sender?._id;
            if (senderId === user?._id) return;

            addNotification(notification);

            const { type, message, post, story } = notification;
            const sender = notification.sender;

            if (type === 'message' && senderId) {
                if (window.location.pathname.includes(`/conversation/${senderId}`)) return;
            }

            let icon = '🔔';
            let actionText = 'sent a notification';
            if (type === 'like') { icon = '❤️'; actionText = story ? 'liked your story' : 'liked your post'; }
            if (type === 'comment') { icon = '💬'; actionText = 'commented on your post'; }
            if (type === 'follow') { icon = '👤'; actionText = 'started following you'; }
            if (type === 'follow_request') { icon = '👤'; actionText = 'sent you a follow request'; }
            if (type === 'message') { icon = '📩'; actionText = message?.content || 'sent you a message'; }
            if (type === 'system') { icon = '⚠️'; actionText = message?.content || 'Security Alert'; }
            if (type === 'new_post') { icon = '🖼️'; actionText = 'posted something new'; }
            if (type === 'new_story') { icon = '📸'; actionText = 'added a new story'; }

            toast(
                (t) => (
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', width: '100%', position: 'relative' }}
                        onClick={(e) => {
                            if (e.target.closest('.close-toast')) return;
                            if (type === 'message' && senderId) {
                                navigate(`/conversation/${senderId}`);
                            } else if ((type === 'like' && story) || type === 'new_story') {
                                setStoryDetailUserId(senderId);
                            } else if (post) {
                                setPostDetailId(post);
                            }
                            toast.dismiss(t.id);
                        }}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--primary)' }}>
                            <img
                                src={sender?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '20px' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{icon}</span> {sender?.fullname || 'System'}
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {actionText}
                            </p>
                        </div>
                        <button
                            className="close-toast"
                            onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                            style={{
                                position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: 'var(--text-sub)',
                                fontSize: '18px', cursor: 'pointer', padding: '8px'
                            }}
                        >×</button>
                    </div>
                ),
                {
                    duration: 5000,
                    position: 'top-center',
                    style: {
                        padding: '10px', borderRadius: '16px',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                    }
                }
            );
        };

        const handleNewStory = (story) => {
            const { user: storyUser } = story;
            if (storyUser._id === user?._id) return;

            toast(
                (t) => (
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', position: 'relative', width: '100%' }}
                        onClick={(e) => {
                            if (e.target.closest('.close-toast')) return;
                            setStoryDetailUserId(storyUser._id);
                            toast.dismiss(t.id);
                        }}
                    >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid #ff4b2b' }}>
                            <img
                                src={storyUser?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '20px' }}>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)' }}>
                                📸 {storyUser?.fullname}
                            </p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sub)' }}>Added a new story</p>
                        </div>
                        <button
                            className="close-toast"
                            onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                            style={{
                                position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: 'var(--text-sub)',
                                fontSize: '18px', cursor: 'pointer', padding: '8px'
                            }}
                        >×</button>
                    </div>
                ),
                {
                    duration: 5000,
                    position: 'top-center',
                    style: { padding: '10px', borderRadius: '16px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' }
                }
            );
        };

        const handleCollabInvite = ({ postCaption, invitedBy }) => {
            queryClient.invalidateQueries({ queryKey: ['posts', 'collab-invites', user?._id] });
            toast(`🤝 ${invitedBy} invited you to collaborate on a post`, {
                icon: '🤝',
                duration: 5000,
                position: 'top-center',
                style: { borderRadius: '12px', background: 'var(--surface-1)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
            });
        };

        socket.on('newNotification', handleNewNotification);
        socket.on('newStory', handleNewStory);
        socket.on('collaborationInvite', handleCollabInvite);

        return () => {
            socket.off('connect');
            socket.off('updateUserList');
            socket.off('userOnline');
            socket.off('userOffline');
            socket.off('newNotification', handleNewNotification);
            socket.off('newStory', handleNewStory);
            socket.off('collaborationInvite', handleCollabInvite);
        };
    }, [user?._id, user?.fullname, setOnlineUsers, addOnlineUser, removeOnlineUser, addNotification, setPostDetailId, setStoryDetailUserId, navigate]);

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
        if (storyId) window.sessionStorage.setItem('pendingStoryId', storyId);
        if (!initialized || loading) return;
        if (user?.username) {
            navigate(`/stories/${userId}${storyId ? `/${storyId}` : ''}`, { replace: true });
            return;
        }
        navigate(`/login?redirect=/stories/${userId}${storyId ? `/${storyId}` : ''}`, { replace: true });
    }, [userId, storyId, initialized, loading, user?.username, navigate]);

    return <PageLoader />;
}

// ─── LAYOUTS ──────────────────────────────────────────────────────────────────
function PublicLayout({ children }) {
    return (
        <div className="flex flex-col min-h-[100dvh] w-full">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
        </div>
    );
}

function MainLayout({ children }) {
    const user = useAuthStore(s => s.user);
    const location = useLocation();
    const isMessages = location.pathname.startsWith('/conversation');

    return (
        <div className="relative flex flex-col h-screen w-full overflow-hidden">
            <div className="lg:hidden">
                <Navbar />
            </div>
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

// ─── APP ──────────────────────────────────────────────────────────────────────
function App() {
    useTabTitle();
    const [isOffline, setIsOffline] = useState(false);
    const authState = useAuthCheck();
    const user = useAuthStore(s => s.user);

    useEffect(() => {
        const initNetwork = async () => {
            try {
                const status = await Network.getStatus();
                setIsOffline(!status.connected);
            } catch (err) {
                console.warn('Network status check failed:', err);
            }
        };

        const handler = Network.addListener('networkStatusChange', status => {
            setIsOffline(!status.connected);
        });

        initNetwork();

        return () => {
            handler.then(h => h.remove());
        };
    }, []);

    if (authState === 'loading') {
        return <PageLoader />;
    }

    return (
        <HelmetProvider>
            <Toaster
                position="top-center"
                toastOptions={{ duration: 3000 }}
                containerStyle={{ zIndex: 99999 }}
            />
            {isOffline && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    backgroundColor: '#f59e0b', color: 'white', fontSize: '11px',
                    fontWeight: 'bold', textAlign: 'center', padding: '8px',
                    letterSpacing: '1px', textTransform: 'uppercase'
                }}>
                    📶 You are currently offline. Some features may be limited.
                </div>
            )}
            <QueryClientProvider client={queryClient}>
                <DarkModeProvider>
                    <ConfirmDialog baseZIndex={1000000} />
                    <Router>
                        <AppInit />
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                {user ? (
                                    // ✅ AUTHENTICATED ROUTES
                                    <>
                                        <Route path="/" element={<Navigate to={`/${user.username}`} replace />} />
                                        <Route path="/signup" element={<Navigate to={`/${user.username}`} replace />} />
                                        <Route path="/login" element={<Navigate to={`/${user.username}`} replace />} />
                                        <Route path="/:username" element={<MainLayout><Home /></MainLayout>} />
                                        <Route path="/conversations" element={<MainLayout><Conversations /></MainLayout>} />
                                        <Route path="/conversation/:userId" element={<MainLayout><Conversations /></MainLayout>} />
                                        <Route path="/sessions/*" element={<MainLayout><SettingsLayout /></MainLayout>} />
                                        <Route path="/notifications" element={<MainLayout><NotificationsPage /></MainLayout>} />
                                        <Route path="/me" element={<MainLayout><ProfilePage /></MainLayout>} />
                                        <Route path="/profile/:userId" element={<MainLayout><ProfilePage /></MainLayout>} />
                                        <Route path="/post/:postId" element={<MainLayout><SharedPostRedirect /></MainLayout>} />
                                        <Route path="/story/:userId/:storyId" element={<MainLayout><SharedStoryRedirect /></MainLayout>} />
                                        <Route path="/story/:userId" element={<MainLayout><SharedStoryRedirect /></MainLayout>} />
                                        <Route path="/admin" element={<MainLayout><AdminDashboard /></MainLayout>} />
                                        <Route path="/explore" element={<MainLayout><Explore /></MainLayout>} />
                                        <Route path="/communities" element={<MainLayout><Communities /></MainLayout>} />
                                        <Route path="/discover" element={<MainLayout><UsersPage /></MainLayout>} />
                                        <Route path="/pulse" element={<MainLayout><Pulse /></MainLayout>} />
                                        <Route path="/stories/:username" element={<StoriesPage />} />
                                        <Route path="/stories/:username/:storyId" element={<StoriesPage />} />
                                        <Route path="/stories" element={<StoriesPage />} />
                                        <Route path="*" element={<Navigate to={`/${user.username}`} replace />} />
                                    </>
                                ) : (
                                    // ❌ UNAUTHENTICATED ROUTES
                                    <>
                                        <Route path="/" element={<PublicLayout><Landing /></PublicLayout>} />
                                        <Route path="/signup" element={<PublicLayout><Signup /></PublicLayout>} />
                                        <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
                                        <Route path="/forgot" element={<PublicLayout><Forgot /></PublicLayout>} />
                                        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
                                        <Route path="/help" element={<PublicLayout><Help /></PublicLayout>} />
                                        <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
                                        <Route path="/verify-otp" element={<PublicLayout><VerifyOtp /></PublicLayout>} />
                                        <Route path="/verify-email/:token" element={<PublicLayout><VerifyEmail /></PublicLayout>} />
                                        <Route path="/post/:postId" element={<PublicLayout><SharedPostRedirect /></PublicLayout>} />
                                        <Route path="/story/:userId/:storyId" element={<PublicLayout><SharedStoryRedirect /></PublicLayout>} />
                                        <Route path="/story/:userId" element={<PublicLayout><SharedStoryRedirect /></PublicLayout>} />
                                        <Route path="*" element={<Navigate to="/" replace />} />
                                    </>
                                )}
                            </Routes>
                            <GlobalOverlays />
                        </Suspense>
                    </Router>
                </DarkModeProvider>
            </QueryClientProvider>
        </HelmetProvider>
    );

}

// ─── GLOBAL OVERLAYS ──────────────────────────────────────────────────────────
function GlobalOverlays() {
    const { postDetailId, profileDetailId, setPostDetailId, setProfileDetailId, sharingPostToStory, clearSharingPostToStory } = usePostStore();
    const user = useAuthStore(s => s.user);
    const isStoryViewerOpen = usePostStore(s => s.isStoryViewerOpen);
    const location = useLocation();

    return (
        <>
            {!location.pathname.startsWith('/conversations') && !location.pathname.startsWith('/conversation') && <Chatbot />}

            <Dialog
                showHeader={false}
                visible={!!postDetailId}
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
                position="center"
                onHide={() => setPostDetailId(null)}
                dismissableMask
                blockScroll={true}
                closable={false}
                modal
                maskStyle={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
            >
                <div className="relative bg-[var(--surface-1)] h-full w-full shadow-2xl" style={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setPostDetailId(null)}
                        className="absolute top-4 left-4 z-[20005] bg-black/40 hover:bg-black/60 text-white border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer backdrop-blur-md transition-all shadow-lg"
                    >
                        <i className="pi pi-times text-sm"></i>
                    </button>
                    {postDetailId && <PostDetail postId={postDetailId} onHide={() => setPostDetailId(null)} />}
                </div>
            </Dialog>

            <Dialog
                header="Profile"
                visible={!!profileDetailId}
                style={{ width: '95vw', maxWidth: '500px' }}
                position={window.innerWidth < 768 ? 'bottom' : 'center'}
                onHide={() => setProfileDetailId(null)}
                baseZIndex={isStoryViewerOpen ? 20000 : 1000}
                appendTo={document.body}
                blockScroll
                draggable={false}
                resizable={false}
                className={window.innerWidth < 768 ? 'profile-dialog-mobile' : ''}
            >
                {profileDetailId && <UserProfile id={profileDetailId} />}
            </Dialog>

            {sharingPostToStory && (
                <CreateStoryModal
                    onClose={clearSharingPostToStory}
                    onCreated={() => queryClient.invalidateQueries(['story-feed'])}
                    loggeduser={user}
                    sharedPost={sharingPostToStory}
                />
            )}
        </>
    );
}

export default App;