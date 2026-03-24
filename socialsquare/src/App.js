import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import 'primereact/resources/themes/lara-light-cyan/theme.css';

// ✅ All imports from src/ root — no '../' needed
import useAuthStore from './store/zustand/useAuthStore';
import useConversationStore from './store/zustand/useConversationStore';
import { socket } from './socket';
import { DarkModeProvider } from './context/DarkModeContext';
import useTokenRefresh from './hooks/useTokenRefresh';

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
    const initAuth = useAuthStore(s => s.initAuth);
    const user = useAuthStore(s => s.user);
    const setOnlineUsers = useConversationStore(s => s.setOnlineUsers);

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
        return () => {
            socket.off('connect');
            socket.off('updateUserList');
        };
    }, [user?._id, setOnlineUsers]);

    return null;
}

function App() {
    return (
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <DarkModeProvider>
                    <AppInit />
                    <Router>
                        <Suspense fallback={<PageLoader />}>
                            <Routes>
                                <Route path="/landing" element={<Landing />} />
                                <Route path="/signup" element={<Signup />} />
                                <Route path="/forgot" element={<Forgot />} />
                                <Route path="/contact" element={<Contact />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/help" element={<Help />} />
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/verify-otp" element={<VerifyOtp />} />
                                <Route path="/admin" element={<AdminDashboard />} />
                                <Route path="/" element={<Home />} />
                            </Routes>
                        </Suspense>
                    </Router>
                </DarkModeProvider>
            </QueryClientProvider>
        </HelmetProvider>
    );
}

export default App;