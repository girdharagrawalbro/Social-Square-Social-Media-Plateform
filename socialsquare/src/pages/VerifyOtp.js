import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { getFingerprint } from '../utils/fingerprint';

const VerifyOtp = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId;

  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);

  // Countdown for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) { toast.error('Please enter the 6-digit code'); return; }

    setLoading(true);
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, otp: otpValue, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        localStorage.setItem('token', result.token);
        toast.success('Verified! Redirecting...');
        setTimeout(() => navigate('/'), 1000);
      } else {
        toast.error(result.error || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch { toast.error('Network error. Please try again.'); }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // Re-trigger login to get new OTP (user must re-enter credentials)
      toast.success('Please login again to get a new code.');
      navigate('/login');
    } catch { toast.error('Failed to resend. Please try again.'); }
    setResending(false);
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔐</div>
          <h2 className="text-2xl font-bold mb-1">Verify your identity</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the 6-digit code sent to your email</p>

          <form onSubmit={handleSubmit}>
            <div className="flex justify-center gap-2 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  className="w-11 h-12 text-center text-xl font-bold border-2 rounded-lg focus:border-indigo-500 focus:outline-none"
                  style={{ borderColor: digit ? '#6366f1' : '#e5e7eb' }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <div className="mt-4 text-sm text-gray-500">
            {countdown > 0 ? (
              <span>Resend code in <strong>{countdown}s</strong></span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-indigo-600 font-semibold hover:underline"
              >
                {resending ? 'Sending...' : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </>
  );
};

export default VerifyOtp;