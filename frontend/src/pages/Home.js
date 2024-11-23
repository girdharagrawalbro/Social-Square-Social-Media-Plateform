import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import Profile from './components/Profile';
import Feed from './components/Feed';
import FollowingList from './components/FollowingList';

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('You are logged out! Please log in.');
            navigate('/login'); // Redirect to the login page
        }
    }, [navigate]); // Dependency array includes navigate to prevent warnings

    return (
        <>
            <FollowingList />
            <Feed />
            <Profile />
        </>
    );
};

export default Home;
