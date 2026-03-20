import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useSelector } from 'react-redux';
import { Suspense, lazy } from 'react';
import "primereact/resources/themes/lara-light-cyan/theme.css";
import 'react-toastify/dist/ReactToastify.css';
import { PrimeReactProvider } from 'primereact/api';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import rootReducer from './store';
import { thunk } from 'redux-thunk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { HelmetProvider } from 'react-helmet-async';
import useTokenRefresh from './hooks/useTokenRefresh.js';
import { DarkModeProvider } from './context/DarkModeContext';

const NotificationToast = lazy(() => import('./pages/components/ui/NotificationToast'));
const Home             = lazy(() => import('./pages/Home'));
const Login            = lazy(() => import('./pages/Login'));
const Signup           = lazy(() => import('./pages/Signup'));
const Forgot           = lazy(() => import('./pages/Forgot'));
const Contact          = lazy(() => import('./pages/Contact'));
const Help             = lazy(() => import('./pages/Help'));
const Landing          = lazy(() => import('./pages/Landing'));
const ResetPassword    = lazy(() => import('./pages/ResetPassword'));
const VerifyOtp        = lazy(() => import('./pages/VerifyOtp'));
const ActiveSessions   = lazy(() => import('./pages/components/ActiveSessions'));
const PostDetail       = lazy(() => import('./pages/components/PostDetail'));
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'));

const PageLoader = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #808bf5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const store = createStore(rootReducer, applyMiddleware(thunk));
const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function AppContent() {
    useTokenRefresh();
    const { loggeduser } = useSelector(state => state.users);

    return (
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
            <Suspense fallback={null}>
                <NotificationToast userId={loggeduser?._id} />
            </Suspense>
            <PrimeReactProvider>
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
            </PrimeReactProvider>
        </GoogleOAuthProvider>
    );
}

function App() {
    return (
        <HelmetProvider>
            <Provider store={store}>
                <QueryClientProvider client={queryClient}>
                    <DarkModeProvider>
                        <AppContent />
                    </DarkModeProvider>
                </QueryClientProvider>
            </Provider>
        </HelmetProvider>
    );
}

export default App;