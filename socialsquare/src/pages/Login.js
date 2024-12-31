import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Bg from './components/Bg';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '', // This can be either email or username
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    // Check if the token exists in localStorage
    const token = localStorage.getItem('token');
    if (token) {
      toast.info("You are already logged in..", {
        position: "top-center",
      })
      navigate('/'); // Redirect to the home page or dashboard
    }
  }, [navigate]);

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
        toast.success("Login successful! Redirecting...")

        setTimeout(() => navigate('/'), 1500);
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      toast.error(error);
    }

    setLoading(false);
  };

  return (
    <>
      <Bg>
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

              <button
                className="py-2 mt-2 theme-bg w-100"
                type="submit"
                disabled={loading} // Disable the button when loading is true
              >
                {loading ? 'Logging in...' : 'Log in'}
              </button>
              <div className='text-danger py-2'>{message}</div>
            </form>

            <Link to="/forgot" className="mt-5 text-primary text-decoration-none text-start">
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
        <div className='pc'>
          <img src="http://localhost:3000/image.png" alt="" />
        </div>
      </Bg>

      <Toaster />
    </>
  );
};

export default Login;
