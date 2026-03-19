import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const Forgot = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        setSent(true);
        toast.success('Reset link sent! Check your email.');
      } else {
        toast.error(result.error || 'Failed to send reset link.');
      }
    } catch {
      toast.error('Network error! Please try again.');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="max-w-md mx-auto bg-white border p-6 rounded shadow text-center mt-20">
        <h3 className="font-pacifico text-2xl mb-4">Social Square</h3>
        {sent ? (
          <div>
            <div className="text-green-600 text-lg mb-3">✅ Check your email!</div>
            <p className="text-gray-500 text-sm">We sent a password reset link to <strong>{email}</strong>. It expires in 1 hour.</p>
            <Link to="/login" className="block mt-4 text-themeStart font-semibold">Back to Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-gray-500 text-sm mb-4">Enter your email and we'll send you a reset link.</p>
            <input
              className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
              type="email" placeholder="Enter your email"
              value={email} onChange={e => setEmail(e.target.value)} required
            />
            <button className="mt-2 bg-themeStart text-white w-full py-2 rounded" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <p className="mt-3 text-sm">Remembered? <Link to="/login" className="text-themeStart font-semibold">Login</Link></p>
          </form>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default Forgot;