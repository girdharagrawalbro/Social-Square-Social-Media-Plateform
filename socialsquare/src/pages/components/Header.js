import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('socketId');
    window.location.href = '/landing';
  };

  return (
    <div className='w-100'>
      <div className="bordershadow p-3 rounded theme-bg d-flex justify-content-between align-items-center">
        <Link to="/landing" className="text-white text-decoration-none" title="Go to Home">
          <i className="pi pi-home" style={{ fontSize: '1.5rem' }}></i>
        </Link>
        <h3 className="pacifico-regular mb-0 text-center flex-grow-1">
          Social Square
        </h3>
        <button 
          onClick={handleLogout} 
          className="btn btn-light btn-sm"
          title="Logout"
        >
          <i className="pi pi-sign-out"></i> Logout
        </button>
      </div>
    </div>
  );
};

export default Header;