import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { socket } from '../socket';
import MainSkeleton from './components/MainSkeleton';
import OtherUsers from './components/OtherUsers';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';
import Conversations from './components/Conversations';
import Explore from './components/Explore';
import { fetchLoggedUser } from '../store/slices/userSlice';
import Navbar from './components/Navbar';

const Home = () => {
    const token = localStorage.getItem('token');
    const [activeView, setActiveView] = useState('feed');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loggeduser, loading, error } = useSelector(state => state.users);

    useEffect(() => {
        if (!token) { navigate('/landing'); return; }
        dispatch(fetchLoggedUser());
    }, [dispatch, token, navigate]);

    useEffect(() => {
        if (loggeduser?._id) {
            if (!socket.connected) socket.connect();
            socket.emit('registerUser', loggeduser._id);
            socket.on('connect', () => { localStorage.setItem('socketId', socket.id); });
        }
        return () => { socket.off('connect'); };
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
            case 'feed': return <><Newpost /><Feed /></>;
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
        <section className="min-h-screen w-full bg-gray-50">
            <Navbar />

            {/* Desktop layout */}
            <div className="hidden lg:flex gap-3 w-full max-w-8xl mx-auto p-3">
                <div className="w-25"><OtherUsers /></div>
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
                <div className="flex-1 overflow-auto p-2">{renderMobileView()}</div>
                <div className="fixed bottom-3 left-1/2 transform -translate-x-1/2 w-11/12 md:w-3/4 bg-white rounded-full p-2 shadow-md" style={{ zIndex: 100 }}>
                    <div className="flex justify-around">
                        {navItems.map(item => (
                            <button key={item.key}
                                className={`px-3 py-2 rounded-full ${activeView === item.key ? 'bg-[#808bf5] text-white' : 'bg-transparent border border-gray-200'}`}
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