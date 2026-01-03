import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { socket } from '../socket'; // Assume this is your socket connection file

// Component imports
import Bg from './components/Bg';
import Loader from './components/Loader';
import Header from './components/Header';
import OtherUsers from './components/OtherUsers';
import Search from './components/Search';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';

// Redux actions
import { fetchLoggedUser } from '../store/slices/userSlice';

const Home = () => {
    const token = localStorage.getItem('token');
    const [activeView, setActiveView] = useState('feed'); // 'feed', 'profile', or 'otherUsers'
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loggeduser, loading, error } = useSelector((state) => state.users);
    
    // Check token and redirect if not present
    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }
        dispatch(fetchLoggedUser());
    }, [dispatch, token, navigate]);

    useEffect(() => {
        if (loggeduser?._id) {
            if (!socket.connected) {
                socket.connect(); // Connect if not already connected
            }
            // Emit user registration only if loggeduser exists
            socket.emit('registerUser', loggeduser._id);
            socket.on('connect', () => {
                const socketId = socket.id; // Get the socket ID
                localStorage.setItem('socketId', socketId); // Store it in localStorage
            });
        }
        return () => {
            socket.off('connect'); // Clean up listener
        };
    }, [loggeduser]);

    // Handle authentication errors - redirect to login
    useEffect(() => {
        if (error.loggeduser && !loading.loggeduser) {
            // Clear invalid token and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('socketId');
            navigate('/login');
        }
    }, [error.loggeduser, loading.loggeduser, navigate]);

    if (loading.loggeduser) {
        return (
            <div className='d-flex h-100 mt-5 justify-content-center align-items-center'>
                <Loader />
            </div>
        );
    }

    // If no token, show loading while redirecting
    if (!token || !loggeduser) {
        return (
            <div className='d-flex h-100 mt-5 justify-content-center align-items-center'>
                <Loader />
            </div>
        );
    }

    const renderMobileView = () => {
        switch (activeView) {
            case 'feed':
                return (
                    <>
                        <Search />
                        <Newpost />
                        <Feed />
                    </>
                );
            case 'profile':
                return <Profile />;
            case 'otherUsers':
                return <OtherUsers />;
            case 'messages':
                return <Conversations />
            default:
                return null;
        }
    };

    return (
        <>
            <section className="main-screen">
                {/* PC Layout */}
                <div className="pc-layout">
                    <div className="header">
                        <Header />
                        <OtherUsers />
                    </div>
                    <div className="feed">
                        <Search />
                        <Newpost />
                        <Feed />
                    </div>
                    <div className="profile">
                        <Profile />
                        <Conversations />
                    </div>
                </div>

                {/* Mobile Layout */}
                <div className="mobile-layout">
                    <Header />

                    <div className="feed">{renderMobileView()}</div>
                    <div className="dock w-75">
                        <div className="d-flex border rounded py-2 w-100 justify-content-around">
                            <button
                                className={`btn ${activeView === 'feed' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveView('feed')}
                            >
                                <i className="pi pi-home"></i>
                            </button>

                            <button
                                className={`btn ${activeView === 'otherUsers' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveView('otherUsers')}
                            >
                                <i className="pi pi-users"></i>
                            </button>

                            <button className={`btn ${activeView === 'messages' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveView('messages')}
                            >
                                <i className="pi pi-envelope"></i>
                            </button>

                            <button
                                className={`btn ${activeView === 'profile' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => setActiveView('profile')}
                            >
                                <i className="pi pi-user"></i>
                            </button>
                        </div>
                    </div>
                </div>
              
            </section>
        </>
    );
};

export default Home;
