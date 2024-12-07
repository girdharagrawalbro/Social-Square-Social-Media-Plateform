import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import Profile from './components/Profile';
import Feed from './components/Feed';
import OtherUserList from './components/OtherUserList';
import Loader from './components/Loader';
import { AuthContext } from '../context/AuthContext';
import Bg from './components/Bg';
import UserProfile from "./popups/UserProfile";

const Home = () => {
    const { userData, loading } = useContext(AuthContext);
    const token = localStorage.getItem('token');
    const [initialLoad, setInitialLoad] = useState(true);

    // Auto-reload logic
    useEffect(() => {
        const hasReloaded = sessionStorage.getItem('hasReloaded');
        if (!hasReloaded) {
            sessionStorage.setItem('hasReloaded', 'true'); // Set reload flag
            setTimeout(() => {
                window.location.reload(); // Reload the page after 2 seconds
            }, 2000);
        }
    }, []);

    // Remove initial loading state after first render
    useEffect(() => {
        if (!loading) {
            setInitialLoad(false);
        }
    }, [loading]);

    if (initialLoad || loading)
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
            {userData ? (
                <>
                    <OtherUserList userData={userData} />
                    <Feed userData={userData} />
                    <Profile userData={userData} /> {/* Pass user data to Profile */}
                    <UserProfile userData={userData} />
                </>
            ) : (
                <Loader />
            )}
        </>
    );
};

export default Home;
