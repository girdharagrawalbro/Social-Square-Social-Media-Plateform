import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    fullname: '',
    username: '',
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
      // Simulating a signup API call
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Signup successful! Redirecting...');
        // Redirect to Signup page or dashboard
      } else {
        setMessage(result.error || 'Something went wrong!');
      }
    } catch (error) {
      setMessage('Network error! Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="form-container border bg-white text-center">
      <h3 className='pacifico-regular'>Social Square</h3>
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
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
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
  );
};

export default Signup;
