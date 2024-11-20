import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '', // This can be either email or username
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Login successful! Redirecting...');
        // Redirect to dashboard or home page
      } else {
        setMessage(result.error || 'Invalid credentials. Please try again.');
      }
    } catch (error) {
      setMessage('Network error! Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="form-container border bg-white text-center">
      <h3 className="pacifico-regular">Social Square</h3>
      <form onSubmit={handleSubmit}>
        <input
          className="px-3 py-2 bg-white text-dark w-100 my-2 border"
          type="text"
          name="identifier"
          placeholder="Username or Email"
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
  );
};

export default Login;
