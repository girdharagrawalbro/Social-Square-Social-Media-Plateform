import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import Authnav from './components/Authnav';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    fullname: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // Initialize useNavigate

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Simulating a signup API call
      const response = await fetch('http://localhost:5000/api/auth/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);
        setMessage('Signup successful! Redirecting...');
        setTimeout(() => navigate('/'), 1500); // Redirect after 1.5 seconds
      } else {
        setMessage(result.error || 'Something went wrong!');
      }
    } catch (error) {
      setMessage('Network error! Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <Authnav />
      <div className="form-container border bg-white text-center d-flex gap-4 h-75">
        <div className="d-flex align-items-center">
          <div>
            <h3 className="pacifico-regular mb-3">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input
                className="px-3 py-2 bg-white text-dark w-100 my-2 border"
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <input
                className="px-3 py-2 bg-white text-dark w-100 my-2 border"
                type="text"
                name="fullname"
                placeholder="Full Name"
                value={formData.fullname}
                onChange={handleChange}
                required
              />
              <input
                className="px-3 py-2 bg-white text-dark w-100 my-2 border"
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              <button className="btn mt-2 btn-primary w-100" type="submit">
                {loading ? 'Signing up...' : 'Sign up'}
              </button>
            </form>
            <div className="text-danger mt-3">{message}</div>
            <div className="mt-4">
              <p>
                Have an account?{' '}
                <Link to="/login" className="text-primary text-decoration-none fw-bold">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
        <div>
          <img src="image.png" alt="" />
        </div>
      </div>
    </div>
  );
};

export default Signup;
