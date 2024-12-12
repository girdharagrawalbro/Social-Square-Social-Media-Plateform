// Links for react and redux 
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

// links of comoponents
import Bg from './components/Bg';
import Loader from './components/Loader';
import Header from './components/Header';
import OtherUsers from './components/OtherUsers';
import Search from './components/Search';
import Newpost from './components/Newpost';
import Feed from './components/Feed';
import Profile from './components/Profile';

// links of context and redux
import { fetchLoggedUser } from '../store/slices/userSlice'

const Home = () => {
    const token = localStorage.getItem('token');
    const [initialLoad, setInitialLoad] = useState(true);

    const dispatch = useDispatch();
    const { loading, error } = useSelector((state) => state.users);

    useEffect(() => {
        dispatch(fetchLoggedUser());
    }, [dispatch]);

    // Auto-reload logic
    useEffect(() => {
        const hasReloaded = sessionStorage.getItem('hasReloaded');
        if (!hasReloaded) {
            sessionStorage.setItem('hasReloaded', 'true'); // Set reload flag
            setTimeout(() => {
                window.location.reload(); // Reload the page after 2 seconds
            }, 100);
        }
    }, []);

    // Remove initial loading state after first render
    useEffect(() => {
        if (!loading.user) {
            setInitialLoad(false);
        }
    }, [loading.user]);


    if (error.loggeduser) return (
        <Bg>
            <div className="d-flex flex-column justify-content-center text-center align-items-center w-100 gap-3">
                Error :{error.user}
            </div>
        </Bg>
    );

    if (initialLoad || loading.loggeduser)
        return (
            <Bg>
                <div className="d-flex flex-column justify-content-center text-center align-items-center w-100 gap-3">
                    <Loader />
                </div>
            </Bg>
        );

    if (!token)
        return (
            <Bg>
                <div className="d-flex flex-column justify-content-center text-center align-items-center w-100 gap-3">
                    <h3>You are being logged out. Please login again..</h3>
                    <Link className="theme-bg py-2 px-3" to="/login">Go to Login</Link> {/* Add navigation */}
                </div>
            </Bg>
        );

    return (
        <>
                <section className='main-screen p-3'>
                    <div className="header">
                        <Header />
                        <OtherUsers />
                    </div>
                    <div className="feed px-3">
                        <Search />
                        <Newpost />
                        <Feed />
                    </div>
                    <div className="profile">
                        <Profile />
                    </div>
                </section>
        </>
    );
};

export default Home;
