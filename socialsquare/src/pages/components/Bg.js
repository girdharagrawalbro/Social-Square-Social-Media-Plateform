import React from 'react';
import Navbar from './Navbar';

const Bg = ({ children }) => {
    return (
        <>
            <Navbar />
            <div className="w-full min-h-screen flex items-center justify-center bg-cover bg-center px-3 py-6 sm:px-6" style={{ backgroundImage: "url('https://i.ibb.co/tKbHYTv/bg.jpg')" }}>
                <div className="w-full max-w-4xl border bg-white text-center flex p-4 sm:p-6 rounded-lg shadow-md mx-auto">
                    {children}
                </div>
            </div>
        </>
    );
}

export default Bg;
