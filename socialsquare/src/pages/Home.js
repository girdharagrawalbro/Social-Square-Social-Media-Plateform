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
import { CardTitle } from '@chakra-ui/react';

const Home = () => {
    const token = localStorage.getItem('token');

    const dispatch = useDispatch();
    const { loading, error } = useSelector((state) => state.users);

    useEffect(() => {
        dispatch(fetchLoggedUser());
    }, [dispatch]);

    if (error.loggeduser) return (
        <>
            Error :{error.user}
        </>
    );

    if (loading.loggeduser)
        return (
            <div className='d-flex h-100 mt-5 justify-content-center align-items-center'>
                <Loader />
            </div>
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
