import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { encryptPassword } from '../utils/crypto';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const encryptedPassword = encryptPassword(password);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password: encryptedPassword }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success('Password reset! Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        toast.error(result.error || 'Reset failed. Link may have expired.');
      }
    } catch {
      toast.error('Network error! Please try again.');
    }
    setLoading(false);
  };

  if (!token || !email) {
    return (
      <div className="max-w-md mx-auto text-center mt-20">
        <p className="text-red-500">Invalid reset link.</p>
        <Link to="/forgot" className="text-themeStart">Request a new one</Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-md mx-auto bg-white border p-6 rounded shadow text-center mt-20">
        <h3 className="font-pacifico text-2xl mb-4">Reset Password</h3>
        <form onSubmit={handleSubmit}>
          <input
            className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
            type="password" placeholder="New password"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <input
            className="px-3 py-2 bg-white text-gray-800 w-full my-2 border rounded"
            type="password" placeholder="Confirm new password"
            value={confirm} onChange={e => setConfirm(e.target.value)} required
          />
          <button className="mt-2 bg-themeStart text-white w-full py-2 rounded" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
      <Toaster />
    </>
  );
};

export default ResetPassword;