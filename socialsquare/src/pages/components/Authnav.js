import React from 'react'
import { Link } from 'react-router-dom';

const Authnav = () => {
    return (
        <div className="flex gap-4 justify-center font-medium">
            <Link to="/" className="px-3 py-1 text-gray-600 hover:text-[#808bf5] no-underline transition-colors">Home</Link>
            <Link to="/contact" className="px-3 py-1 text-gray-600 hover:text-[#808bf5] no-underline transition-colors">Contact</Link>
            <Link to="/help" className="px-3 py-1 text-gray-600 hover:text-[#808bf5] no-underline transition-colors">Help</Link>
        </div>
    )
}

export default Authnav