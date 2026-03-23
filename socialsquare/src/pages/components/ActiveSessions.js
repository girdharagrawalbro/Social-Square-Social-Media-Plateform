import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const deviceIcon = (device = '') => {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) return '📱';
  if (d.includes('tablet') || d.includes('ipad')) return '📟';
  return '💻';
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  const token = localStorage.getItem('token');

  const fetchSessions = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }, [token]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/get`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFaEnabled(res.data.twoFactorEnabled);
    } catch { }
  }, [token]);

  useEffect(() => {
    fetchSessions();
    fetchUser();
  }, [fetchSessions, fetchUser]);

  const revokeSession = async (sessionId) => {
    try {
      await axios.delete(`${BASE}/api/auth/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s._id !== sessionId));
      toast.success('Session revoked');
    } catch { toast.error('Failed to revoke session'); }
  };

  const toggle2FA = async () => {
    setToggling2FA(true);
    try {
      const res = await axios.post(`${BASE}/api/auth/toggle-2fa`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFaEnabled(res.data.twoFactorEnabled);
      toast.success(`2FA ${res.data.twoFactorEnabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed to toggle 2FA'); }
    setToggling2FA(false);
  };

  const formatDate = (d) => new Date(d).toLocaleString();

  return (
    <>
      <div className="p-2">
        <p className="text-sm text-gray-500 mb-6">Manage your active sessions and security preferences.</p>

        {/* 2FA Toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold m-0">Two-Factor Authentication</h3>
            <p className="text-xs text-gray-500 mt-1 m-0">
              {twoFaEnabled
                ? '✅ Enabled — OTP sent to your email on every login'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <button
            onClick={toggle2FA}
            disabled={toggling2FA}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-all ${twoFaEnabled ? 'bg-red-100 text-red-500' : 'bg-indigo-500 text-white'
              }`}
          >
            {toggling2FA ? '...' : twoFaEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Sessions header */}
        <h3 className="text-sm font-bold mb-3">Active Sessions ({sessions.length})</h3>

        {/* Sessions list */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No active sessions found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <div key={session._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{deviceIcon(session.device)}</span>
                  <div>
                    <p className="m-0 text-sm font-semibold">{session.device || 'Unknown Device'}</p>
                    <p className="m-0 text-xs text-gray-500">
                      {session.location?.city}, {session.location?.country} · {session.ip}
                    </p>
                    <p className="m-0 text-xs text-gray-400">
                      Last active: {formatDate(session.lastUsedAt)}
                      {session.isNewDevice && (
                        <span className="ml-2 text-yellow-500 font-semibold">· New device</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeSession(session._id)}
                  className="bg-red-100 text-red-500 border-0 rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Toaster />
    </>
  );
};

export default ActiveSessions;