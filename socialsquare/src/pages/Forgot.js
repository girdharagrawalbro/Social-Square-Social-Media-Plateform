import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

const Forgot = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Simulating a forgot password API call
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('A password reset link has been sent to your email.');
      } else {
        setMessage(result.error || 'Failed to send the reset link. Please try again.');
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
          type="email"
          name="email"
          placeholder="Enter your email"
          value={email}
          onChange={handleChange}
          required
        />
        <button className="btn mt-2 btn-primary w-100" type="submit">
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
      <p className='mt-2'>Get your password ? {' '}
        <Link to="/login" className="text-primary text-decoration-none fw-bold">
          Login
        </Link>
      </p>
      <div className="text-danger mt-3">{message}</div>
    </div>
  );
};

export default Forgot;
