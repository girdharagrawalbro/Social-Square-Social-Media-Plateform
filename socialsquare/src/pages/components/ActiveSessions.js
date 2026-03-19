import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const BASE = process.env.REACT_APP_BACKEND_URL;

const deviceIcon = (device = '') => {
  if (device.toLowerCase().includes('mobile') || device.toLowerCase().includes('android') || device.toLowerCase().includes('iphone')) return '📱';
  if (device.toLowerCase().includes('tablet') || device.toLowerCase().includes('ipad')) return '📟';
  return '💻';
};

const ActiveSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [toggling2FA, setToggling2FA] = useState(false);

  const token = localStorage.getItem('token');

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  };

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${BASE}/api/auth/get`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTwoFaEnabled(res.data.twoFactorEnabled);
    } catch {}
  };

  useEffect(() => {
    fetchSessions();
    fetchUser();
  }, []);

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
      <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 16px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Security Settings</h2>
        <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '14px' }}>Manage your active sessions and security preferences.</p>

        {/* 2FA Toggle */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Two-Factor Authentication</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              {twoFaEnabled ? '✅ Enabled — OTP sent to your email on every login' : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <button
            onClick={toggle2FA}
            disabled={toggling2FA}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
              background: twoFaEnabled ? '#fee2e2' : '#6366f1',
              color: twoFaEnabled ? '#ef4444' : '#fff',
            }}
          >
            {toggling2FA ? '...' : twoFaEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Active Sessions */}
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Active Sessions ({sessions.length})</h3>

        {loading ? (
          <p style={{ color: '#9ca3af' }}>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No active sessions found.</p>
        ) : (
          sessions.map(session => (
            <div key={session._id} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
              padding: '16px 20px', marginBottom: '12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '28px' }}>{deviceIcon(session.device)}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px' }}>{session.device || 'Unknown Device'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                    {session.location?.city}, {session.location?.country} · {session.ip}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                    Last active: {formatDate(session.lastUsedAt)}
                    {session.isNewDevice && <span style={{ marginLeft: '8px', color: '#f59e0b', fontWeight: 600 }}>· New device</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => revokeSession(session._id)}
                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
      <Toaster />
    </>
  );
};

export default ActiveSessions;