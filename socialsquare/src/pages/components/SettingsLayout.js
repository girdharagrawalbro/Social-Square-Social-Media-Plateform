import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ActiveSessions from './ActiveSessions';
import toast from 'react-hot-toast';

const MockFeedSettings = () => {
    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--text-main)]">Feed Preferences</h2>
            <p className="text-[var(--text-sub)] mb-6">Customize what you see on your feed.</p>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg">
                    <div>
                        <h4 className="font-semibold text-[var(--text-main)] m-0">Show recommendations</h4>
                        <p className="text-sm text-[var(--text-sub)] m-0 mt-1">Include posts from accounts you don't follow.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked onChange={() => toast.success("Preference updated")} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#808bf5]"></div>
                    </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg">
                    <div>
                        <h4 className="font-semibold text-[var(--text-main)] m-0">Autoplay videos</h4>
                        <p className="text-sm text-[var(--text-sub)] m-0 mt-1">Automatically play videos on Wi-Fi.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked onChange={() => toast.success("Preference updated")} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#808bf5]"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

const MockPrivacySettings = () => {
    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--text-main)]">Account Privacy</h2>
            <p className="text-[var(--text-sub)] mb-6">Manage how others interact with your account.</p>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg">
                    <div>
                        <h4 className="font-semibold text-[var(--text-main)] m-0">Private Account</h4>
                        <p className="text-sm text-[var(--text-sub)] m-0 mt-1">Only approved followers can see your posts.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" onChange={() => toast.success("Privacy updated")} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#808bf5]"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

const SettingsLayout = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/settings', label: 'Active Sessions', icon: 'pi pi-desktop' },
        { path: '/settings/feed', label: 'Feed Preferences', icon: 'pi pi-list' },
        { path: '/settings/privacy', label: 'Account Privacy', icon: 'pi pi-lock' }
    ];

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] w-full">
            {/* Sidebar for settings */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--border-color)] bg-[var(--surface-0)]">
                <div className="p-6 pb-2">
                    <h2 className="text-xl font-bold m-0 text-[var(--text-main)]">Settings</h2>
                </div>
                <div className="p-4 flex flex-row md:flex-col gap-2 overflow-x-auto">
                    {menuItems.map(item => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={item.path} 
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg no-underline transition-colors whitespace-nowrap ${isActive ? 'bg-[#ede9fe] text-[#6366f1] font-semibold dark:bg-[#6366f1] dark:bg-opacity-20 dark:text-[#808bf5]' : 'text-[var(--text-main)] hover:bg-[var(--surface-1)]'}`}
                            >
                                <i className={item.icon}></i>
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-[var(--surface-0)] overflow-y-auto">
                <Routes>
                    <Route path="/" element={<ActiveSessions />} />
                    <Route path="/feed" element={<MockFeedSettings />} />
                    <Route path="/privacy" element={<MockPrivacySettings />} />
                </Routes>
            </div>
        </div>
    );
};

export default SettingsLayout;
