import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [otheruserData, setOtherUserData] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [ShowUserProfile, setShowUserProfile] = useState(false);

    const fetchUserData = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            setUserData(null);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/auth/get', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUserData(data);
            } else {
                localStorage.removeItem('token');
                setUserData(null);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            setUserData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchOtherUserData = async (id) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/other-uesrs/view', {
                method: 'GET',
                headers: {
                    'Authorization': `${id}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setOtherUserData(data);
            }
            else {
                alert("Something went wrong");
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            setUserData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    return (
        <AuthContext.Provider value={{ userData, setUserData, otheruserData, fetchOtherUserData, loading, fetchUserData, ShowUserProfile, setShowUserProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;
