import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate
import Bg from './components/Bg';
import { ToastContainer, toast } from 'react-toastify';

const Signup = () => {

  const [formData, setFormData] = useState({
    email: '',
    fullname: '',
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
        theme: "colored",
        autoClose: 1500
      })
      setTimeout(() => navigate('/'), 1500);
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
    setMessage('');

    try {
      // Simulating a signup API call
      const response = await fetch('https://social-square-social-media-plateform.onrender.com/api/auth/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success("Signup successful! Redirecting...")
        setTimeout(() => navigate('/'), 1500); // Redirect after 1.5 seconds
      } else {
        toast.error("Something went wrong!")
        toast.error(result.error)
      }
    } catch (error) {
      toast.error("Network error! Please try again.");
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

              <button
                className="py-2 mt-2 theme-bg w-100"
                type="submit"
                disabled={loading} // Disable the button when loading is true
              >
                {loading ? 'Signing up...' : 'Sign up'}

              </button>

              <div className='text-danger py-2'>{message}</div>

            </form>
            <ToastContainer
              theme='light'
            />
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
        <div className='pc'>
          <img src="image.png" alt="" />
        </div>
      </Bg >
    </>
  );
};

export default Signup;
