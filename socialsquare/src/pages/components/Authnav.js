import React from 'react'
import { Link } from 'react-router-dom';

const Authnav = () => {
    return (
        <div className="flex gap-4 justify-center font-medium text-gray-800">
            <Link to="/landing" className="px-3 py-1 text-gray-700 hover:text-themeStart">Home</Link>
            <Link to="/contact" className="px-3 py-1 text-gray-700 hover:text-themeStart">Contact Us</Link>
            <Link to="/help" className="px-3 py-1 text-gray-700 hover:text-themeStart">Help</Link>
        </div>
    )
}

export default Authnav