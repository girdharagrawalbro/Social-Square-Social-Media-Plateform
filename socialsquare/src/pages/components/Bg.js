import React from 'react';
import Authnav from './Authnav';

const Bg = ({ children }) => {
    return (
        <div className="auth-bg">
            <Authnav />
            <div className="form-container border bg-white text-center d-flex gap-4">
                {children}
            </div>
        </div>
    );
}

export default Bg;
