import React from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useNotificationSettings } from '../../hooks/queries/useNotificationQueries';
import toast from '../../utils/toast.js';

const NotificationSettings = () => {
    const user = useAuthStore(s => s.user);
    const { data: settings, isLoading, updateSettings } = useNotificationSettings(user?._id);

    const handleToggle = (key, label, isDefaultTrue = true) => {
        const currentVal = settings?.[key];
        const newVal = isDefaultTrue
            ? (currentVal !== false ? false : true)
            : (currentVal ? false : true);

        const updated = {
            emailDigest: settings?.emailDigest ?? false,
            pushEnabled: settings?.pushEnabled ?? true,
            postNotifications: settings?.postNotifications ?? true,
            userNotifications: settings?.userNotifications ?? true,
            chatNotifications: settings?.chatNotifications ?? true,
            [key]: newVal
        };

        updateSettings.mutate(updated, {
            onSuccess: () => {
                toast.success(`${label} ${newVal ? 'enabled' : 'disabled'}!`);
            },
            onError: () => {
                toast.error(`Failed to update ${label}`);
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 border-4 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest animate-pulse">Loading preferences...</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-3 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-xl font-black mb-1 text-[var(--text-main)]">Notification Preferences</h2>
            <p className="text-xs text-[var(--text-sub)] opacity-70 mb-6 tracking-wider font-bold">Customize how you interact with Social Square</p>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-6">

                {/* 🔔 Global Push */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                            🔔 Push Notifications ( Global )
                        </h3>
                        <p className="mt-1 mb-0 text-xs text-[var(--text-sub)] leading-relaxed">
                            Pause all push alerts. Note: login security alerts and chat notifications will always bypass this pause.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                            type="checkbox"
                            checked={settings?.pushEnabled !== false}
                            onChange={() => handleToggle('pushEnabled', 'Global Push Notifications', true)}
                            className="sr-only peer"
                            disabled={updateSettings.isPending}
                        />
                        <div className="relative w-11 h-6 rounded-full bg-gray-200
    peer-checked:bg-[#4f46e5]
    after:content-['']
    after:absolute
    after:top-[2px]
    after:left-[2px]
    after:h-5
    after:w-5
    after:rounded-full
    after:bg-white
    after:transition-all
    peer-checked:after:translate-x-full"></div>
                    </label>
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* 📝 Post Interactions */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                            📝 Post Interactions
                        </h3>
                        <p className="mt-1 mb-0 text-xs text-[var(--text-sub)] leading-relaxed">
                            Receive notifications when someone likes or comments on your posts. Disabling this stops database notification records and push alerts.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                            type="checkbox"
                            checked={settings?.postNotifications !== false}
                            onChange={() => handleToggle('postNotifications', 'Post notifications', true)}
                            className="sr-only peer"
                            disabled={updateSettings.isPending}
                        />
                        <div className="relative w-11 h-6 rounded-full bg-gray-200
    peer-checked:bg-[#4f46e5]
    after:content-['']
    after:absolute
    after:top-[2px]
    after:left-[2px]
    after:h-5
    after:w-5
    after:rounded-full
    after:bg-white
    after:transition-all
    peer-checked:after:translate-x-full"></div>
                    </label>
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* 👥 Social & Follows */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                            👥 Social & Follows
                        </h3>
                        <p className="mt-1 mb-0 text-xs text-[var(--text-sub)] leading-relaxed">
                            Receive notifications when you get new followers. Follow requests will always appear in your request list regardless of this setting, but push notifications will be paused.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                            type="checkbox"
                            checked={settings?.userNotifications !== false}
                            onChange={() => handleToggle('userNotifications', 'Social & Follows notifications', true)}
                            className="sr-only peer"
                            disabled={updateSettings.isPending}
                        />
                        <div className="relative w-11 h-6 rounded-full bg-gray-200
    peer-checked:bg-[#4f46e5]
    after:content-['']
    after:absolute
    after:top-[2px]
    after:left-[2px]
    after:h-5
    after:w-5
    after:rounded-full
    after:bg-white
    after:transition-all
    peer-checked:after:translate-x-full"></div>
                    </label>
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* 💬 Chat Messages */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                            💬 Chat Notifications
                        </h3>
                        <p className="mt-1 mb-0 text-xs text-[var(--text-sub)] leading-relaxed">
                            Receive push notifications for new messages. This is always active but can be paused here individually.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                            type="checkbox"
                            checked={settings?.chatNotifications !== false}
                            onChange={() => handleToggle('chatNotifications', 'Chat notifications', true)}
                            className="sr-only peer"
                            disabled={updateSettings.isPending}
                        />
                        <div className="relative w-11 h-6 rounded-full bg-gray-200
    peer-checked:bg-[#4f46e5]
    after:content-['']
    after:absolute
    after:top-[2px]
    after:left-[2px]
    after:h-5
    after:w-5
    after:rounded-full
    after:bg-white
    after:transition-all
    peer-checked:after:translate-x-full"></div>
                    </label>
                </div>

                <div className="border-t border-gray-100 my-4"></div>

                {/* 📬 Email Digest */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="m-0 text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                            📬 Daily Email Digest
                        </h3>
                        <p className="mt-1 mb-0 text-xs text-[var(--text-sub)] leading-relaxed">
                            Receive a daily compiled newsletter of your new interactions, likes, comments, and trending posts.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                        <input
                            type="checkbox"
                            checked={!!settings?.emailDigest}
                            onChange={() => handleToggle('emailDigest', 'Daily Email Digest', false)}
                            className="sr-only peer"
                            disabled={updateSettings.isPending}
                        />
                        <div className="relative w-11 h-6 rounded-full bg-gray-200
    peer-checked:bg-[#4f46e5]
    after:content-['']
    after:absolute
    after:top-[2px]
    after:left-[2px]
    after:h-5
    after:w-5
    after:rounded-full
    after:bg-white
    after:transition-all
    peer-checked:after:translate-x-full"></div>
                    </label>
                </div>

            </div>
            
        </div>
    );
};

export default NotificationSettings;
