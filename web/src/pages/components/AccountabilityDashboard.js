import React, { useState } from 'react';
import { useGroupCheckIns, useSubmitCheckIn, useToggleCheckInStatus, useAddCheckInFeedback } from '../../hooks/queries/useAuthQueries';
import useAuthStore from '../../store/zustand/useAuthStore';
import toast from '../../utils/toast.js';
import { USER_DEFAULT_IMAGE } from '../../utils/constantMediaVariable';

const AccountabilityDashboard = ({ group, onClose }) => {
    const user = useAuthStore(s => s.user);
    const { data: checkins = [], isLoading } = useGroupCheckIns(group._id);
    const submitWip = useSubmitCheckIn();
    const toggleStatus = useToggleCheckInStatus();
    const addFeedback = useAddCheckInFeedback();

    const [wipText, setWipText] = useState('');
    const [feedbackTexts, setFeedbackTexts] = useState({}); // checkInId -> text
    const [selectedWeekStr, setSelectedWeekStr] = useState(null);

    // Helpers for start of week (Monday)
    const getStartOfWeek = (d = new Date()) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    };

    const formatDate = (dateVal) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const currentWeekStart = getStartOfWeek();
    const currentWeekStr = currentWeekStart.toISOString();

    // Group check-ins by week starting string
    const weeksMap = {};
    // Ensure current week exists in map
    weeksMap[currentWeekStr] = [];

    checkins.forEach(ci => {
        const key = new Date(ci.weekStarting).toISOString();
        if (!weeksMap[key]) {
            weeksMap[key] = [];
        }
        weeksMap[key].push(ci);
    });

    const weeks = Object.keys(weeksMap).sort((a, b) => new Date(b) - new Date(a));
    const activeWeek = selectedWeekStr || currentWeekStr;
    const activeCheckins = weeksMap[activeWeek] || [];

    // Check if current user has already submitted a check-in for the active week
    const myCheckin = activeCheckins.find(ci => (ci.user?._id || ci.user) === user?._id);

    const handleSubmitWip = async () => {
        if (!wipText.trim()) return toast.error('Commitment cannot be empty');
        if (wipText.length < 5) return toast.error('Please make your weekly commitment a bit more descriptive (at least 5 characters)');

        try {
            await submitWip.mutateAsync({ groupId: group._id, wipText });
            toast.success('Weekly commitment posted!');
            setWipText('');
        } catch (e) {
            toast.error('Failed to post commitment');
        }
    };

    const handleToggleStatus = async (checkin) => {
        const nextStatus = checkin.status === 'completed' ? 'pending' : 'completed';
        try {
            await toggleStatus.mutateAsync({
                groupId: group._id,
                checkInId: checkin._id,
                status: nextStatus
            });
            toast.success(`Marked as ${nextStatus}`);
        } catch (e) {
            toast.error('Failed to update status');
        }
    };

    const handleSendFeedback = async (checkInId) => {
        const text = feedbackTexts[checkInId] || '';
        if (!text.trim()) return;

        try {
            await addFeedback.mutateAsync({
                groupId: group._id,
                checkInId,
                text
            });
            setFeedbackTexts(prev => ({ ...prev, [checkInId]: '' }));
            toast.success('Feedback added!');
        } catch (e) {
            toast.error('Failed to send feedback');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#808bf5]"></div>
                <span className="text-xs text-[var(--text-sub)]">Loading circle dashboard...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="bg-gradient-to-br from-[#808bf5]/10 to-indigo-500/5 border border-[var(--border-color)] rounded-3xl p-5 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-500 bg-[#808bf5]/15 px-3 py-1 rounded-full uppercase tracking-wider">
                        🎯 Accountability Circle
                    </span>
                    <span className="text-xs font-bold text-[var(--text-sub)]">
                        {group.members?.length || 0} / {group.maxMembers || 10} Members
                    </span>
                </div>
                <div>
                    <h3 className="m-0 text-xl font-black text-[var(--text-main)]">{group.name}</h3>
                    <p className="m-0 text-xs text-[var(--text-sub)] mt-1.5 opacity-90">{group.description || 'No description provided.'}</p>
                </div>
            </div>

            {/* Week Selector Tab Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 border-b border-[var(--border-color)]" style={{ scrollbarWidth: 'none' }}>
                {weeks.map(wkStr => {
                    const isActive = activeWeek === wkStr;
                    const isCurrent = wkStr === currentWeekStr;
                    return (
                        <button
                            key={wkStr}
                            onClick={() => setSelectedWeekStr(wkStr)}
                            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold border cursor-pointer transition ${isActive ? 'bg-[#808bf5] text-white border-transparent shadow-lg shadow-[#808bf5]/20' : 'bg-[var(--surface-2)] text-[var(--text-sub)] border-[var(--border-color)] hover:bg-[var(--surface-3)]'}`}
                        >
                            {isCurrent ? '📅 This Week' : formatDate(wkStr)}
                        </button>
                    );
                })}
            </div>

            {/* Current user commitment entry (Only if active week is current week, and user hasn't posted one yet) */}
            {activeWeek === currentWeekStr && !myCheckin && (
                <div className="bg-[var(--surface-2)] border-2 border-dashed border-[#808bf5]/30 rounded-3xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🚀</span>
                        <h4 className="m-0 text-sm font-bold text-[var(--text-main)]">Set your commitment for this week</h4>
                    </div>
                    <p className="m-0 text-xs text-[var(--text-sub)] opacity-80">
                        What are you committing to ship or accomplish by the end of the week? Make it clear and measurable.
                    </p>
                    <div className="flex flex-col gap-2.5 mt-1">
                        <textarea
                            value={wipText}
                            onChange={e => setWipText(e.target.value)}
                            placeholder="e.g., I will finish the landing page design and write 3 blog posts."
                            rows={3}
                            className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-[#808bf5] transition resize-none"
                        />
                        <button
                            onClick={handleSubmitWip}
                            className="w-full bg-[#808bf5] text-white py-2.5 rounded-2xl text-xs font-bold border-0 cursor-pointer hover:opacity-90 transition active:scale-[0.98]"
                        >
                            Post Weekly Goal
                        </button>
                    </div>
                </div>
            )}

            {/* Check-ins lists */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                    <h4 className="m-0 text-xs font-black text-[var(--text-sub)] uppercase tracking-wider">
                        Weekly Check-ins ({activeCheckins.length})
                    </h4>
                    {activeWeek === currentWeekStr && myCheckin && (
                        <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            ✓ Goal Set
                        </span>
                    )}
                </div>

                {activeCheckins.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center gap-3">
                        <span className="text-3xl">📭</span>
                        <p className="text-xs text-[var(--text-sub)] m-0">No check-ins posted for this week yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {activeCheckins.map(ci => {
                            const isMe = (ci.user?._id || ci.user) === user?._id;
                            const isCompleted = ci.status === 'completed';
                            return (
                                <div key={ci._id} className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-3xl p-5 flex flex-col gap-4 hover:shadow-md transition">
                                    {/* User header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={ci.user?.profile_picture || USER_DEFAULT_IMAGE}
                                                alt={ci.user?.fullname || 'User'}
                                                className="w-9 h-9 rounded-full object-cover border border-[var(--border-color)]"
                                            />
                                            <div>
                                                <h5 className="m-0 text-xs font-bold text-[var(--text-main)]">{ci.user?.fullname || 'Member'}</h5>
                                                <span className="text-[10px] text-[var(--text-sub)]">@{ci.user?.username || 'member'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Status badge */}
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {isCompleted ? '✓ Completed' : '⚡ Pending'}
                                            </span>

                                            {/* Completed toggle checkbox (Only for own commitment) */}
                                            {isMe && activeWeek === currentWeekStr && (
                                                <button
                                                    onClick={() => handleToggleStatus(ci)}
                                                    className={`border-0 cursor-pointer px-3 py-1 rounded-xl text-[9px] font-bold transition ${isCompleted ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500 text-white hover:opacity-90'}`}
                                                >
                                                    {isCompleted ? 'Mark Pending' : 'Mark Completed'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Commitment text */}
                                    <div className="bg-[var(--surface-3)]/60 border border-[var(--border-color)]/30 rounded-2xl p-4 text-xs text-[var(--text-main)] leading-relaxed font-medium">
                                        "{ci.wipText}"
                                    </div>

                                    {/* Feedback section */}
                                    <div className="border-t border-[var(--border-color)]/55 pt-3.5 flex flex-col gap-3">
                                        <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wider px-1">
                                            🤝 Peer Feedback ({ci.feedback?.length || 0})
                                        </span>

                                        {ci.feedback?.length > 0 && (
                                            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                                                {ci.feedback.map(fb => (
                                                    <div key={fb._id} className="bg-[var(--surface-1)] border border-[var(--border-color)]/40 rounded-2xl p-3 flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <img
                                                                src={fb.user?.profile_picture || USER_DEFAULT_IMAGE}
                                                                alt=""
                                                                className="w-5 h-5 rounded-full object-cover"
                                                            />
                                                            <span className="text-[10px] font-bold text-[var(--text-main)]">
                                                                {fb.user?.fullname || 'Member'}
                                                            </span>
                                                            <span className="text-[9px] text-[var(--text-sub)] ml-auto opacity-75">
                                                                {new Date(fb.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        <p className="m-0 text-xs text-[var(--text-main)] font-normal leading-normal pl-7">
                                                            {fb.text}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Leave feedback form */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="text"
                                                placeholder="Write supportive feedback..."
                                                value={feedbackTexts[ci._id] || ''}
                                                onChange={e => setFeedbackTexts(prev => ({ ...prev, [ci._id]: e.target.value }))}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSendFeedback(ci._id);
                                                }}
                                                className="flex-1 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[#808bf5] transition"
                                            />
                                            <button
                                                onClick={() => handleSendFeedback(ci._id)}
                                                className="bg-[#808bf5] text-white w-9 h-9 rounded-2xl flex items-center justify-center border-0 cursor-pointer hover:opacity-90 active:scale-95 transition"
                                            >
                                                <i className="pi pi-send text-[10px]" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountabilityDashboard;
