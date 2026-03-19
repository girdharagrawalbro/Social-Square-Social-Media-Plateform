import React from 'react';
import Authnav from './Authnav';
import Navbar from './Navbar';

const Bg = ({ children }) => {
    return (
        <>
            <Navbar />
            <div className="w-full min-h-screen flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: "url('https://i.ibb.co/tKbHYTv/bg.jpg')" }}>
                <div className="border bg-white text-center flex p-6 rounded-lg shadow-md max-w-4xl mx-auto">
                    {children}
                </div>
            </div>
        </>
    );
}

export default Bg;
