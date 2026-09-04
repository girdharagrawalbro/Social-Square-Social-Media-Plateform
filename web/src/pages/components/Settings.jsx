import React, { useState } from 'react';
import useAuthStore from '../../store/zustand/useAuthStore';
import { usePrivacySettings } from '../../hooks/queries/usePrivacyQueries';
import toast from '../../utils/toast';
import { Helmet } from 'react-helmet-async';
import NotificationSettings from './NotificationSettings';
import ActiveSessions from './ActiveSessions';
import FollowFollowingList from './FollowFollowingList';
import { PostsTab, StoryArchiveTab, InteractionsTab, AccountTab, InterestedTab, NotInterestedTab, TimeSpentTab } from './ActivityLog';
import PasswordAndSecurity from './PasswordAndSecurity';
import SecurityCheckup from './SecurityCheckup';
import AccountHistory from './AccountHistory';

const Settings = () => {
    const user = useAuthStore(s => s.user);
    const { data: settings, isLoading, updateSettings } = usePrivacySettings(user?._id);
    const [activeTab, setActiveTab] = useState('posts');

    const handleToggle = (key, label) => {
        const currentVal = settings?.[key];
        const newVal = !currentVal;

        const updated = {
            ...settings,
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

    const handleAllowedCommentersChange = (val) => {
        const updated = {
            ...settings,
            disableCommentsGlobally: val === 'no_one',
            allowedCommenters: val,
        };

        updateSettings.mutate(updated, {
            onSuccess: () => {
                toast.success('Updated comment permissions!');
            },
            onError: () => {
                toast.error('Failed to update comment permissions');
            }
        });
    };

    const handleModeChange = (mode) => {
        const updated = {
            ...settings,
            hideActivityStatus: mode !== 'visible',
            activityStatusMode: mode,
        };

        updateSettings.mutate(updated, {
            onSuccess: () => {
                toast.success(`Activity status set to ${mode === 'visible' ? 'Visible' : mode === 'stealth' ? 'Ghost Mode (Hide My Status Only)' : 'Reciprocal Hiding'}!`);
            },
            onError: () => {
                toast.error('Failed to update Activity Status mode');
            }
        });
    };

    const currentActivityMode = settings?.activityStatusMode || (settings?.hideActivityStatus ? 'hidden_both' : 'visible');

    const activityTabs = [
        { id: 'posts', label: 'Posts & Content', icon: 'pi-file', desc: 'Your posts, saves & likes' },
        { id: 'stories', label: 'Story Archive', icon: 'pi-clock', desc: 'All stories incl. expired' },
        { id: 'interactions', label: 'Interactions', icon: 'pi-heart', desc: 'Likes, comments & follows received' },
        { id: 'account', label: 'Account Activity', icon: 'pi-users', desc: 'Following, blocked & muted' },
        { id: 'interested', label: 'Interested', icon: 'pi-thumbs-up', desc: 'Posts you want more of' },
        { id: 'not_interested', label: 'Not Interested', icon: 'pi-eye-slash', desc: 'Dismissed posts' },
        { id: 'time', label: 'Time Spent', icon: 'pi-chart-bar', desc: 'Daily usage graph' },
    ];

    const accountCenterTabs = [
        { id: 'password_security', label: 'Password & Security', icon: 'pi-key', desc: 'Change password & 2FA' },
        { id: 'sessions', label: 'Active Sessions', icon: 'pi-desktop', desc: 'Review active sessions' },
        { id: 'security_checkup', label: 'Security Checkup', icon: 'pi-shield', desc: 'Review security steps' },
        { id: 'account_history', label: 'Account History', icon: 'pi-history', desc: 'Security event log' },
    ];

    const privacyTabs = [
        { id: 'notifications', label: 'Push Notifications', icon: 'pi-bell', desc: 'Manage your push alerts' },
        { id: 'close_friends', label: 'Close Friends', icon: 'pi-star-fill', desc: 'Manage your close friends list' },
        { id: 'activity_status', label: 'Activity Status', icon: 'pi-bolt', desc: 'Online presence & status visibility' },
        { id: 'counts', label: 'Counts & Visibility', icon: 'pi-eye-slash', desc: 'Likes, comments & shares visibility' },
        { id: 'comments', label: 'Comments & Permissions', icon: 'pi-comment', desc: 'Who can comment on your posts' },
        { id: 'mentions', label: 'Tags & Mentions', icon: 'pi-at', desc: 'Control who can @mention or tag you' },
        { id: 'story_replies', label: 'Stories & Replies', icon: 'pi-clock', desc: 'Story message replies & visibility' },
        { id: 'moderation', label: 'Hidden Words & Safety', icon: 'pi-filter', desc: 'Filter profanity & custom hidden words' }
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-9 h-9 border-4 border-[#4f46e5] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest animate-pulse">Loading privacy preferences...</span>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 max-w-5xl h-full mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
            <Helmet>
                <title>Settings & Privacy | Social Square</title>
            </Helmet>

            <div className="mb-6">
                <h2 className="text-2xl font-black text-[var(--text-main)] font-outfit">Settings & Privacy</h2>
                <p className="text-xs text-[var(--text-sub)] opacity-70 tracking-wide font-medium mt-1">Manage your account settings, preferences, and privacy</p>
            </div>

            {/* Desktop Two-Column Layout */}
            <div className="flex flex-col md:flex-row gap-6 md:h-[calc(100vh-110px)]">
                {/* Desktop Sidebar — fixed, scrolling */}
                <div className="hidden md:flex flex-col w-64 flex-shrink-0 space-y-1 pr-4 pb-12 border-r border-gray-100 overflow-y-auto sticky top-0 custom-scrollbar">
                    
                    {/* Activity Group */}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pt-1 pb-0.5 m-0">Your Activity</p>
                    {activityTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-none cursor-pointer text-left transition-all ${activeTab === t.id ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}>
                            <i className={`pi ${t.icon} text-lg`}></i>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs font-bold leading-snug">{t.label}</span>
                                <span className={`text-[9px] truncate mt-0.5 ${activeTab === t.id ? 'text-[#4f46e5]/70' : 'text-gray-400'}`}>{t.desc}</span>
                            </div>
                        </button>
                    ))}

                    <div className="border-t border-dashed border-gray-200 my-2 mx-4"></div>

                    {/* Account Center Group */}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pb-0.5 m-0">Account Center</p>
                    {accountCenterTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-none cursor-pointer text-left transition-all ${activeTab === t.id ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}>
                            <i className={`pi ${t.icon} text-lg`}></i>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs font-bold leading-snug">{t.label}</span>
                                <span className={`text-[9px] truncate mt-0.5 ${activeTab === t.id ? 'text-[#4f46e5]/70' : 'text-gray-400'}`}>{t.desc}</span>
                            </div>
                        </button>
                    ))}

                    <div className="border-t border-dashed border-gray-200 my-2 mx-4"></div>

                    {/* Privacy Group */}
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-4 pb-0.5 m-0">Privacy & Preferences</p>
                    {privacyTabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-none cursor-pointer text-left transition-all ${activeTab === t.id ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'bg-transparent text-gray-600 hover:bg-gray-50'}`}>
                            <i className={`pi ${t.icon} text-lg ${t.id === 'close_friends' ? 'text-green-500' : ''}`}></i>
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-xs font-bold leading-snug">{t.label}</span>
                                <span className={`text-[9px] truncate mt-0.5 ${activeTab === t.id ? 'text-[#4f46e5]/70' : 'text-gray-400'}`}>{t.desc}</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Right Content Panel — scrollable */}
                <div className="flex-1 min-w-0 overflow-y-auto p-3 min-h-[400px] md:min-h-0">
                    
                    {/* ACTIVITY TABS */}
                    {activeTab === 'posts' && <div className="animate-in fade-in duration-300"><PostsTab /></div>}
                    {activeTab === 'stories' && <div className="animate-in fade-in duration-300"><StoryArchiveTab /></div>}
                    {activeTab === 'interactions' && <div className="animate-in fade-in duration-300"><InteractionsTab /></div>}
                    {activeTab === 'account' && <div className="animate-in fade-in duration-300"><AccountTab /></div>}
                    {activeTab === 'interested' && <div className="animate-in fade-in duration-300"><InterestedTab /></div>}
                    {activeTab === 'not_interested' && <div className="animate-in fade-in duration-300"><NotInterestedTab /></div>}
                    {activeTab === 'time' && <div className="animate-in fade-in duration-300"><TimeSpentTab /></div>}

                    {/* ACCOUNT CENTER TABS */}
                    {activeTab === 'password_security' && <div className="animate-in fade-in duration-300"><PasswordAndSecurity /></div>}
                    {activeTab === 'sessions' && <div className="animate-in fade-in duration-300"><ActiveSessions /></div>}
                    {activeTab === 'security_checkup' && <div className="animate-in fade-in duration-300"><SecurityCheckup setActiveTab={setActiveTab} /></div>}
                    {activeTab === 'account_history' && <div className="animate-in fade-in duration-300"><AccountHistory /></div>}

                    {/* PRIVACY TABS */}
                    {activeTab === 'notifications' && (
                        <div className="animate-in fade-in duration-300">
                            <NotificationSettings />
                        </div>
                    )}
                    
                    {activeTab === 'close_friends' && (
                        <div className="animate-in fade-in duration-300">
                            <h3 className="text-base font-bold text-gray-900 font-outfit mb-4">Close Friends</h3>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <FollowFollowingList userId={user?._id} ids={user?.closeFriends || []} />
                            </div>
                        </div>
                    )}

                    {/* TAB: Activity Status */}
                    {activeTab === 'activity_status' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Activity Status</h3>
                                <p className="text-xs text-gray-500 mt-1">Choose how your online status and last active time are shown to friends and followers.</p>
                            </div>

                            <div className="space-y-3">
                                <div 
                                    onClick={() => handleModeChange('visible')}
                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${currentActivityMode === 'visible' ? 'border-[#4f46e5] bg-indigo-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="activityMode" 
                                        checked={currentActivityMode === 'visible'} 
                                        onChange={() => handleModeChange('visible')}
                                        className="mt-1 accent-[#4f46e5] cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-900">Show Activity Status</span>
                                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Visible</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Accounts you follow and anyone you message can see when you're online or were last active.</p>
                                    </div>
                                </div>

                                {/* Option 2: Ghost Mode */}
                                <div 
                                    onClick={() => handleModeChange('stealth')}
                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${currentActivityMode === 'stealth' ? 'border-[#4f46e5] bg-indigo-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="activityMode" 
                                        checked={currentActivityMode === 'stealth'} 
                                        onChange={() => handleModeChange('stealth')}
                                        className="mt-1 accent-[#4f46e5] cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-900">Ghost Mode (Hide My Status Only)</span>
                                            <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Stealth</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Others won't see when you're online, but you can still see who is online.</p>
                                    </div>
                                </div>

                                {/* Option 3: Reciprocal Hiding */}
                                <div 
                                    onClick={() => handleModeChange('hidden_both')}
                                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${currentActivityMode === 'hidden_both' ? 'border-[#4f46e5] bg-indigo-50/40' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="activityMode" 
                                        checked={currentActivityMode === 'hidden_both'} 
                                        onChange={() => handleModeChange('hidden_both')}
                                        className="mt-1 accent-[#4f46e5] cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-900">Reciprocal Hiding (Both Hidden)</span>
                                            <span className="bg-gray-200 text-gray-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full">Private</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1">Others won't see your activity status, and you won't see their activity status either.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Counts & Visibility */}
                    {activeTab === 'counts' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Counts & Visibility</h3>
                                <p className="text-xs text-gray-500 mt-1">Control who can view likes, comments, and shares on posts.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Hide Like Count on Others' Posts</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">You won't see the total number of likes on posts shared by other accounts in your feed.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.hideLikesOnOthersPosts ?? false}
                                            onChange={() => handleToggle('hideLikesOnOthersPosts', "Hide Likes on Others' Posts")}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Hide Like Count on Your Posts</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Other people won't see the total number of likes on posts you share. You can still see your own count.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.hideLikesOnMyPosts ?? false}
                                            onChange={() => handleToggle('hideLikesOnMyPosts', 'Hide Likes on Your Posts')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Hide Comment Count on Your Posts</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Other people won't see the total comment count on your posts.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.hideCommentCountOnMyPosts ?? false}
                                            onChange={() => handleToggle('hideCommentCountOnMyPosts', 'Hide Comment Count')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Hide Share Count on Your Posts</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Other people won't see the total share count on your posts.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.hideShareCountOnMyPosts ?? false}
                                            onChange={() => handleToggle('hideShareCountOnMyPosts', 'Hide Share Count')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Comments & Permissions */}
                    {activeTab === 'comments' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Comments & Permissions</h3>
                                <p className="text-xs text-gray-500 mt-1">Restrict who can comment on your posts or turn off comments globally.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900">Who Can Comment on Your Posts</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Choose who is allowed to comment on your posts across Social Square.</p>
                                    </div>
                                    <select 
                                        value={settings?.disableCommentsGlobally ? 'no_one' : (settings?.allowedCommenters || 'everyone')}
                                        onChange={(e) => handleAllowedCommentersChange(e.target.value)}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="everyone">Everyone</option>
                                        <option value="people_you_follow">People You Follow</option>
                                        <option value="followers">Your Followers</option>
                                        <option value="following_and_followers">People You Follow & Your Followers</option>
                                        <option value="no_one">No One (Disable Comments)</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Disable Comments Globally</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Turn off commenting on all your past and future posts. You can also override this per-post.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.disableCommentsGlobally ?? false}
                                            onChange={() => handleToggle('disableCommentsGlobally', 'Disable Comments Globally')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ef4444]"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: Tags & Mentions */}
                    {activeTab === 'mentions' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Tags & Mentions</h3>
                                <p className="text-xs text-gray-500 mt-1">Control who can tag you in photos or @mention your username.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900">Who Can @Mention You</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Control who can mention your @username in captions or comments.</p>
                                    </div>
                                    <select 
                                        value={settings?.allowedMentions || 'everyone'}
                                        onChange={(e) => {
                                            updateSettings.mutate({ ...settings, allowedMentions: e.target.value }, {
                                                onSuccess: () => toast.success('Updated mention settings!'),
                                                onError: () => toast.error('Failed to update mention settings')
                                            });
                                        }}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="everyone">Everyone</option>
                                        <option value="people_you_follow">People You Follow</option>
                                        <option value="no_one">No One</option>
                                    </select>
                                </div>

                                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900">Who Can Tag You</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Control who can tag you in photos or posts.</p>
                                    </div>
                                    <select 
                                        value={settings?.allowedTags || 'everyone'}
                                        onChange={(e) => {
                                            updateSettings.mutate({ ...settings, allowedTags: e.target.value }, {
                                                onSuccess: () => toast.success('Updated tag settings!'),
                                                onError: () => toast.error('Failed to update tag settings')
                                            });
                                        }}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="everyone">Everyone</option>
                                        <option value="people_you_follow">People You Follow</option>
                                        <option value="no_one">No One</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Manually Approve Tags</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Tagged posts won't appear on your profile until you review and approve them.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.manuallyApproveTags ?? false}
                                            onChange={() => handleToggle('manuallyApproveTags', 'Manually Approve Tags')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: Stories & Replies */}
                    {activeTab === 'stories' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Stories & Message Replies</h3>
                                <p className="text-xs text-gray-500 mt-1">Manage who can reply to your stories via Direct Message.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900">Allow Message Replies to Stories</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Determine who can swipe up or reply to your stories via Direct Message.</p>
                                    </div>
                                    <select 
                                        value={settings?.allowStoryMessageReplies || 'everyone'}
                                        onChange={(e) => {
                                            updateSettings.mutate({ ...settings, allowStoryMessageReplies: e.target.value }, {
                                                onSuccess: () => toast.success('Updated story reply settings!'),
                                                onError: () => toast.error('Failed to update story reply settings')
                                            });
                                        }}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                                    >
                                        <option value="everyone">Everyone</option>
                                        <option value="people_you_follow">People You Follow</option>
                                        <option value="off">Off (Disable Story Replies)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 6: Hidden Words & Safety */}
                    {activeTab === 'moderation' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 font-outfit">Hidden Words & Content Safety</h3>
                                <p className="text-xs text-gray-500 mt-1">Automatically hide offensive comments, spam, and custom blocked words.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-xs font-bold text-gray-900">Hide Offensive Comments & Profanity</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Automatically hide comments containing common offensive words, hate speech, or spam phrases.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={settings?.hideProfanity !== false}
                                            onChange={() => handleToggle('hideProfanity', 'Profanity Filter')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                                    </label>
                                </div>

                                <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-100 space-y-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-900">Custom Hidden Words & Emojis</h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Add custom words, phrases, or emojis separated by commas. Comments containing these will automatically be hidden behind "View Hidden Comments".</p>
                                    </div>
                                    <input
                                        type="text"
                                        defaultValue={(settings?.hiddenWords || []).join(', ')}
                                        onBlur={(e) => {
                                            const wordsArray = e.target.value.split(',').map(w => w.trim()).filter(Boolean);
                                            updateSettings.mutate({ ...settings, hiddenWords: wordsArray }, {
                                                onSuccess: () => toast.success('Updated custom hidden words!'),
                                                onError: () => toast.error('Failed to update hidden words')
                                            });
                                        }}
                                        placeholder="e.g. spam, crypto, scam, 🤬"
                                        className="w-full text-xs font-medium p-3 rounded-xl border border-gray-300 bg-white text-gray-800 outline-none focus:border-indigo-500 shadow-sm"
                                    />
                                    <span className="text-[10px] text-gray-400">Press enter or click outside to save changes.</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Settings;
