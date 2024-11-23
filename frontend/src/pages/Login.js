import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Authnav from './components/Authnav';


const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '', // This can be either email or username
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
      // Simulating a login API call
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);
        setMessage('Login successful! Redirecting...');
        setTimeout(() => navigate('/'), 1500);
      } else {
        setMessage(result.error || 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      setMessage('Network error! Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className='auth-bg'>
      <Authnav />
      <div className="form-container border bg-white text-center d-flex gap-4 h-75">
        <div className="d-flex align-items-center">
          <div>
            <h3 className="pacifico-regular mb-3">Social Square</h3>
            <form onSubmit={handleSubmit}>
              <input
                className="px-3 py-2 bg-white text-dark w-100 my-2 border"
                type="text"
                name="identifier"
                placeholder="Email"
                value={formData.identifier}
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
                {loading ? 'Logging in...' : 'Log in'}
              </button>
            </form>
            <div className="text-danger mt-3">{message}</div>
            <Link to="/forgot" className="mt-4 text-primary text-decoration-none text-start">
              Forgot Password ?
            </Link>
            <div className="mt-3">
              <p>
                Don’t have an account?{' '}
                <Link to="/signup" className="text-primary text-decoration-none fw-bold">
                  Sign up
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

export default Login;
