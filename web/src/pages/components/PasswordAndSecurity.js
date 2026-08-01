import React, { useState } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import toast from '../../utils/toast';

const PasswordAndSecurity = () => {
    const user = useAuthStore(s => s.user);
    const setAuth = useAuthStore(s => s.setAuth);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Use local state for immediate feedback, initialize from user
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return toast.error('New passwords do not match');
        }
        if (newPassword.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        setLoading(true);
        try {
            await api.post('/api/auth/change-password', {
                currentPassword,
                newPassword
            });
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const toggle2FA = async () => {
        try {
            const res = await api.post('/api/auth/toggle-2fa');
            setTwoFactorEnabled(res.data.twoFactorEnabled);
            toast.success(res.data.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled');
            // Update global user state quietly if needed
            if (user) {
                setAuth({ user: { ...user, twoFactorEnabled: res.data.twoFactorEnabled }, token: useAuthStore.getState().token });
            }
        } catch (error) {
            toast.error('Failed to toggle 2FA');
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 m-0 pb-2 border-b border-gray-100">Password & Security</h2>
            
            {/* 2FA Section */}
            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 m-0">Two-Factor Authentication (2FA)</h3>
                        <p className="text-xs text-gray-500 m-0 mt-1 max-w-md">
                            Add an extra layer of security to your account. When enabled, you'll need to enter an OTP sent to your email whenever you log in from a new device.
                        </p>
                    </div>
                    <button 
                        onClick={toggle2FA}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${twoFactorEnabled ? 'bg-[#4f46e5]' : 'bg-gray-200'}`}
                    >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            {/* Change Password Section */}
            <div>
                <h3 className="text-sm font-semibold text-gray-900 m-0 mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password</label>
                        <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none"
                            placeholder="Enter current password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none"
                            placeholder="Enter new password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none"
                            placeholder="Confirm new password"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordAndSecurity;
