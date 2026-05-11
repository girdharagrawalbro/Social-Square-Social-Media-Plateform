import React from 'react'
import { Link, useLocation } from 'react-router-dom';

const Authnav = () => {
    const location = useLocation();
    
    const getLinkClass = (path) => {
        return location.pathname === path 
            ? "px-3 py-1 text-[#808bf5] font-bold border-b-2 border-[#808bf5] no-underline transition-all" 
            : "px-3 py-1 text-gray-500 hover:text-[#808bf5] no-underline transition-colors";
    };

    return (
        <div className="flex gap-4 justify-center font-medium">
            <Link to="/" className={getLinkClass('/')}>Home</Link>
            <Link to="/contact" className={getLinkClass('/contact')}>Contact</Link>
            <Link to="/help" className={getLinkClass('/help')}>Help</Link>
        </div>
    )
}

export default Authnav
