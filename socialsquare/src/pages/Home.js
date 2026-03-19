import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { socket } from '../socket';

// Component imports
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Search from './components/Search';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';

// Redux actions
import { fetchLoggedUser } from '../store/slices/userSlice';
import Navbar from './components/Navbar';

const Home = () => {
    const token = localStorage.getItem('token');
    const [activeView, setActiveView] = useState('feed');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loggeduser, loading, error } = useSelector((state) => state.users);

    useEffect(() => {
        if (!token) {
            navigate('/landing');
            return;
        }
        dispatch(fetchLoggedUser());
    }, [dispatch, token, navigate]);

    useEffect(() => {
        if (loggeduser?._id) {
            if (!socket.connected) socket.connect();
            socket.emit('registerUser', loggeduser._id);
            socket.on('connect', () => {
                const socketId = socket.id;
                localStorage.setItem('socketId', socketId);
            });
        }
        return () => {
            socket.off('connect');
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
                return <Conversations />;
            default:
                return null;
        }
    };

    return (
        <>
            <section className="min-h-screen w-full bg-gray-50">
                <Navbar />

                {/* Desktop / tablet layout */}
                <div className="hidden lg:flex gap-3 h-[600px] w-full max-w-8xl mx-auto p-3">
                    <div className="w-25">
                        <OtherUsers />
                    </div>

                    <div className="w-50 overflow-y-scroll h-screen px-3">
                        <Newpost />
                        <Feed />
                    </div>

                    <div className="w-25">
                        <Profile />
                        <Conversations />
                    </div>
                </div>

                {/* Mobile layout */}
                <div className="flex lg:hidden flex-col h-screen">
                    <div className="flex-1 overflow-auto">{renderMobileView()}</div>

                    <div className="fixed bottom-3 left-1/2 transform -translate-x-1/2 w-11/12 md:w-3/4 lg:hidden bg-white rounded-full p-2 shadow-md">
                        <div className="flex justify-around">
                            <button className={`px-3 py-2 rounded-full ${activeView === 'feed' ? 'bg-themeStart text-white' : 'bg-transparent border border-gray-200'}`} onClick={() => setActiveView('feed')}>
                                <i className="pi pi-home"></i>
                            </button>
                            <button className={`px-3 py-2 rounded-full ${activeView === 'otherUsers' ? 'bg-themeStart text-white' : 'bg-transparent border border-gray-200'}`} onClick={() => setActiveView('otherUsers')}>
                                <i className="pi pi-users"></i>
                            </button>
                            <button className={`px-3 py-2 rounded-full ${activeView === 'messages' ? 'bg-themeStart text-white' : 'bg-transparent border border-gray-200'}`} onClick={() => setActiveView('messages')}>
                                <i className="pi pi-envelope"></i>
                            </button>
                            <button className={`px-3 py-2 rounded-full ${activeView === 'profile' ? 'bg-themeStart text-white' : 'bg-transparent border border-gray-200'}`} onClick={() => setActiveView('profile')}>
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
