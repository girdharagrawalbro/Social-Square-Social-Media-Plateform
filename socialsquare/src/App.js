import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NotificationToast from './pages/components/ui/NotificationToast';
import { useSelector } from 'react-redux';
import "primereact/resources/themes/lara-light-cyan/theme.css";
import 'react-toastify/dist/ReactToastify.css';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Forgot from './pages/Forgot';
import Contact from './pages/Contact';
import Help from './pages/Help';
import Landing from './pages/Landing';
import ResetPassword from './pages/ResetPassword';
import VerifyOtp from './pages/VerifyOtp';
import { PrimeReactProvider } from 'primereact/api';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import rootReducer from './store';
import { thunk } from 'redux-thunk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import useTokenRefresh from './hooks/useTokenRefresh.js';
import { DarkModeProvider } from './context/DarkModeContext';

const store = createStore(rootReducer, applyMiddleware(thunk));
const queryClient = new QueryClient();

function AppContent() {
  useTokenRefresh();
  const { loggeduser } = useSelector(state => state.users);

  return (
    <>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
        <NotificationToast userId={loggeduser?._id} />
        <PrimeReactProvider>
          <Router>
            <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot" element={<Forgot />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/help" element={<Help />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </Router>
        </PrimeReactProvider>
      </GoogleOAuthProvider>
    </>
  );
}

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <DarkModeProvider>
          <AppContent />
        </DarkModeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;