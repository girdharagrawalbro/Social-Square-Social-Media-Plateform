import React, { useContext } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import Profile from './components/Profile';
import Feed from './components/Feed';
import OtherUserList from './components/OtherUserList';
import { AuthContext } from '../context/AuthContext';
import Bg from './components/Bg';
import UserProfile from "./popups/UserProfile";
import { useSelector } from 'react-redux';

const Home = () => {
    const { userData, loading } = useContext(AuthContext);
    const token = localStorage.getItem('token');
    const { isVisible, id } = useSelector((state) => state);


    if (loading) return <Bg>
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
            <OtherUserList userData={userData} />
            <Feed userData={userData} />
            <Profile userData={userData} /> {/* Pass user data to Profile */}
            {
                isVisible && (
                    <UserProfile userData={userData} userid={id} />
                )
            }

        </>
    );
};

export default Home;
