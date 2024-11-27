import React, { useContext } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import Profile from './components/Profile';
import Feed from './components/Feed';
import FollowingList from './components/FollowingList';
import { AuthContext } from '../context/AuthContext';
import Bg from './components/Bg';

const Home = () => {
    const { userData, loading } = useContext(AuthContext);
    const token = localStorage.getItem('token');

    if (loading && !userData) return <Bg>
        <div className="d-flex flex-column justify-content-center text-center align-items-center w-100 gap-3"><h3>Loading...</h3>
        </div></Bg>;
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
            <FollowingList userData={userData} />
            <Feed userData={userData} />
            <Profile userData={userData} /> {/* Pass user data to Profile */}
        </>
    );
};

export default Home;
