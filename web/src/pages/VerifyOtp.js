import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from '../utils/toast.js';
import { getFingerprint } from '../utils/fingerprint';
import useAuthStore, { setToken } from '../store/zustand/useAuthStore';

const VerifyOtp = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(() => {
    const resendUntil = localStorage.getItem('otpResendUntil');
    if (resendUntil) {
      const remaining = Math.ceil((parseInt(resendUntil, 10) - Date.now()) / 1000);
      if (remaining > 0) return remaining;
    }
    return 0;
  });
  const [expiryCountdown, setExpiryCountdown] = useState(() => {
    const expiresAt = localStorage.getItem('otpExpiresAt');
    if (expiresAt) {
      const remaining = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (remaining > 0) return remaining;
    }
    return 0;
  });
  const inputs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId;
  const setUser = useAuthStore(s => s.setUser);
  const setInitialized = useAuthStore(s => s.setInitialized);
  const BASE = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;
  useEffect(() => {
    if (!userId) navigate('/login');
  }, [userId, navigate]);

  // Countdown for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => {
      setCountdown(c => {
        const nextVal = c - 1;
        if (nextVal <= 0) {
          localStorage.removeItem('otpResendUntil');
        }
        return nextVal;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Countdown for OTP expiration
  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const t = setTimeout(() => {
      setExpiryCountdown(c => {
        const nextVal = c - 1;
        if (nextVal <= 0) {
          localStorage.removeItem('otpExpiresAt');
        }
        return nextVal;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [expiryCountdown]);

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
      const response = await fetch(`${BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, otp: otpValue, fingerprint }),
      });
      const result = await response.json();
      if (response.ok) {
        setToken(result.token);
        if (result.user) {
          setUser(result.user);
        }
        setInitialized(true);
        toast.success('Verified...');
        localStorage.removeItem('otpResendUntil');
        localStorage.removeItem('otpExpiresAt');
        navigate('/');
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
      const response = await fetch(`${BASE}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message || 'OTP resent successfully!');
        const duration = result.resendDuration || 60;
        localStorage.setItem('otpResendUntil', (Date.now() + duration * 1000).toString());
        if (result.otpExpireTime) {
          localStorage.setItem('otpExpiresAt', result.otpExpireTime);
          const remaining = Math.ceil((new Date(result.otpExpireTime).getTime() - Date.now()) / 1000);
          setExpiryCountdown(remaining > 0 ? remaining : 600);
        }
        setCountdown(duration);
      } else {
        toast.error(result.error || 'Failed to resend code.');
      }
    } catch {
      toast.error('Failed to resend. Please try again.');
    }
    setResending(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔐</div>
          <h2 className="text-2xl font-bold mb-1">Verify your identity</h2>
          <p className="text-gray-500 text-sm mb-2">Enter the 6-digit code sent to your email</p>
          <p className={`text-xs font-semibold mb-6 ${expiryCountdown <= 60 ? 'text-red-500 font-bold' : 'text-indigo-600'}`}>
            {expiryCountdown > 0 ? `Code expires in ${formatTime(expiryCountdown)}` : 'Code has expired. Please resend.'}
          </p>

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
      
    </>
  );
};

export default VerifyOtp;
