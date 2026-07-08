import React, { useState, useEffect } from 'react';
import toast from '../../utils/toast.js';
import { api } from '../../store/zustand/useAuthStore';
import PostCard from './ui/PostCard';
import PostDetail from './PostDetail';

const GoalWall = ({ userId, isOwner }) => {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [newMilestones, setNewMilestones] = useState(['']);
    const [posts, setPosts] = useState([]);
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    // Edit Goal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editTargetDate, setEditTargetDate] = useState('');
    const [editStatus, setEditStatus] = useState('');
    const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

    // Fetch goals and user posts to associate posts with goals
    useEffect(() => {
        const fetchGoals = async () => {
            try {
                const res = await api.get(`/api/goal/user/${userId}`);
                setGoals(res.data || []);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load roadmap.");
            } finally {
                setLoading(false);
            }
        };

        const fetchUserPosts = async () => {
            try {
                const res = await api.get(`/api/post/user/${userId}`);
                setPosts(res.data.posts || []);
            } catch (err) {
                console.error(err);
            }
        };

        fetchGoals();
        fetchUserPosts();
    }, [userId]);

    const handleAddMilestoneInput = () => {
        setNewMilestones([...newMilestones, '']);
    };

    const handleMilestoneInputChange = (index, value) => {
        const updated = [...newMilestones];
        updated[index] = value;
        setNewMilestones(updated);
    };

    const handleRemoveMilestoneInput = (index) => {
        setNewMilestones(newMilestones.filter((_, i) => i !== index));
    };

    const handleCreateGoal = async (e) => {
        e.preventDefault();
        if (!title.trim() || !targetDate) {
            toast.error("Title and target date are required.");
            return;
        }

        const filteredMilestones = newMilestones
            .filter(m => m.trim())
            .map(m => ({ title: m.trim() }));

        try {
            const res = await api.post('/api/goal/create', {
                title: title.trim(),
                description: description.trim(),
                targetDate,
                milestones: filteredMilestones
            });
            setGoals([res.data, ...goals]);
            setShowCreateModal(false);
            setTitle('');
            setDescription('');
            setTargetDate('');
            setNewMilestones(['']);
            toast.success("Goal added to your roadmap!");
        } catch (err) {
            toast.error("Failed to create goal.");
        }
    };

    const handleToggleMilestone = async (goalId, milestoneId) => {
        if (!isOwner) return;
        try {
            const res = await api.put(`/api/goal/${goalId}/milestone/${milestoneId}`);
            setGoals(goals.map(g => g._id === goalId ? res.data : g));
            toast.success("Milestone updated!");
        } catch (err) {
            toast.error("Failed to update milestone.");
        }
    };

    const handleCheerGoal = async (goalId) => {
        try {
            const res = await api.post(`/api/goal/${goalId}/cheer`);
            setGoals(goals.map(g => g._id === goalId ? res.data : g));
        } catch (err) {
            toast.error("Failed to send cheer.");
        }
    };

    const handleCheerMilestone = async (goalId, milestoneId) => {
        try {
            const res = await api.post(`/api/goal/${goalId}/milestone/${milestoneId}/cheer`);
            setGoals(goals.map(g => g._id === goalId ? res.data : g));
        } catch (err) {
            toast.error("Failed to cheer milestone.");
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm("Are you sure you want to delete this goal?")) return;
        try {
            await api.delete(`/api/goal/${goalId}`);
            setGoals(goals.filter(g => g._id !== goalId));
            toast.success("Goal removed.");
        } catch (err) {
            toast.error("Failed to delete goal.");
        }
    };

    // Edit Goal handlers
    const openEditModal = (goal) => {
        setSelectedGoal(goal);
        setEditTitle(goal.title);
        setEditDescription(goal.description || '');
        setEditTargetDate(goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '');
        setEditStatus(goal.status || 'active');
        setNewMilestoneTitle('');
        setShowEditModal(true);
    };

    const handleUpdateGoal = async (e) => {
        e.preventDefault();
        try {
            const res = await api.put(`/api/goal/${selectedGoal._id}`, {
                title: editTitle,
                description: editDescription,
                targetDate: editTargetDate,
                status: editStatus
            });
            setGoals(goals.map(g => g._id === selectedGoal._id ? { ...g, ...res.data } : g));
            setShowEditModal(false);
            toast.success("Goal updated!");
        } catch (err) {
            toast.error("Failed to update goal.");
        }
    };

    const handleAddMilestone = async () => {
        if (!newMilestoneTitle.trim()) return;
        try {
            const res = await api.post(`/api/goal/${selectedGoal._id}/milestone`, {
                title: newMilestoneTitle.trim()
            });
            setGoals(goals.map(g => g._id === selectedGoal._id ? res.data : g));
            setSelectedGoal(res.data);
            setNewMilestoneTitle('');
            toast.success("Milestone added!");
        } catch (err) {
            toast.error("Failed to add milestone.");
        }
    };

    const handleDeleteMilestone = async (milestoneId) => {
        try {
            const res = await api.delete(`/api/goal/${selectedGoal._id}/milestone/${milestoneId}`);
            setGoals(goals.map(g => g._id === selectedGoal._id ? res.data : g));
            setSelectedGoal(res.data);
            toast.success("Milestone deleted!");
        } catch (err) {
            toast.error("Failed to delete milestone.");
        }
    };

    const handleOpenPostDetail = (post) => {
        setSelectedPost(post);
        setPostDetailVisible(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-2 flex flex-col gap-3 mb-14 md:mb-0">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-black tracking-wide text-[var(--text-main)] m-0">🏁 Public Roadmap</h3>
                {isOwner && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-xl text-xs font-bold cursor-pointer transition shadow-md flex items-center gap-1.5"
                    >
                        <i className="pi pi-plus text-[10px]"></i> Create Goal
                    </button>
                )}
            </div>

            {goals.length === 0 ? (
                <div className="text-center py-12 bg-[var(--surface-2)] rounded-3xl border border-dashed border-[var(--border-color)]">
                    <i className="pi pi-flag text-4xl text-[var(--text-sub)] opacity-20 mb-3 block"></i>
                    <p className="text-sm font-semibold text-[var(--text-sub)] m-0">No goals posted yet.</p>
                    {isOwner && <p className="text-xs text-[var(--text-sub)] opacity-60 mt-1">Add your first goal to share your journey!</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {goals.map(goal => {
                        const goalPosts = posts.filter(p => p.goalId?._id === goal._id || p.goalId === goal._id);
                        return (
                            <div key={goal._id} className="bg-[var(--surface-2)] rounded-xl p-3 border border-[var(--border-color)] shadow-sm relative overflow-hidden flex flex-col gap-3">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${goal.status === 'completed' ? 'bg-green-500/15 text-green-500 border border-green-500/20' : goal.status === 'failed' ? 'bg-red-500/15 text-red-500 border border-red-500/20' : 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/20'}`}>
                                                {goal.status}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-sub)] font-bold">
                                                Target: {new Date(goal.targetDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-black text-[var(--text-main)] m-0 leading-snug">{goal.title}</h4>
                                        {goal.description && <p className="text-xs text-[var(--text-sub)] mt-1.5 mb-0 leading-relaxed">{goal.description}</p>}
                                    </div>

                                    {isOwner && (
                                        <div className="flex gap-1.5">
                                            <button
                                                onClick={() => openEditModal(goal)}
                                                className="w-7 h-7 rounded-full border-0 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 flex items-center justify-center cursor-pointer transition"
                                                title="Edit Goal"
                                            >
                                                <i className="pi pi-pencil text-xs"></i>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGoal(goal._id)}
                                                className="w-7 h-7 rounded-full border-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition"
                                                title="Delete Goal"
                                            >
                                                <i className="pi pi-trash text-xs"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[11px] font-black text-[var(--text-sub)]">
                                        <span>Progress</span>
                                        <span>{goal.progress}%</span>
                                    </div>
                                    <div className="w-full bg-[var(--surface-1)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#808bf5] to-[#6366f1] transition-all duration-500"
                                            style={{ width: `${goal.progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Milestones */}
                                {goal.milestones?.length > 0 && (
                                    <div className="flex flex-col gap-2 bg-[var(--surface-1)]/50 p-3.5 rounded-2xl border border-[var(--border-color)]">
                                        <span className="text-[10px] font-black uppercase text-[var(--text-sub)] tracking-wider">Milestones</span>
                                        <div className="flex flex-col gap-2.5 mt-1">
                                            {goal.milestones.map(m => (
                                                <div key={m._id} className="flex items-center justify-between gap-3 group/item">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        {isOwner ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={m.isCompleted}
                                                                onChange={() => handleToggleMilestone(goal._id, m._id)}
                                                                className="w-4 h-4 rounded border-[var(--border-color)] text-[#6366f1] focus:ring-[#6366f1] cursor-pointer"
                                                            />
                                                        ) : (
                                                            <span className={`text-xs ${m.isCompleted ? 'text-green-500' : 'text-gray-400'}`}>
                                                                {m.isCompleted ? '✅' : '⚪'}
                                                            </span>
                                                        )}
                                                        <span className={`text-xs font-medium truncate ${m.isCompleted ? 'line-through text-[var(--text-sub)] opacity-50' : 'text-[var(--text-main)]'}`}>
                                                            {m.title}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleCheerMilestone(goal._id, m._id)}
                                                        className={`px-2 py-1 rounded-lg border border-transparent text-[10px] font-bold cursor-pointer transition flex items-center gap-1 shrink-0 ${m.cheers?.includes(userId) ? 'bg-orange-500/10 text-orange-500' : 'bg-transparent text-[var(--text-sub)] hover:bg-[var(--surface-3)]'}`}
                                                    >
                                                        👏 {m.cheers?.length || 0}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Cheers & Actions */}
                                <div className="flex justify-between items-center border-t border-[var(--border-color)]/60 pt-3">
                                    <button
                                        onClick={() => handleCheerGoal(goal._id)}
                                        className={`px-3 py-1.5 rounded-xl border text-xs font-black cursor-pointer transition flex items-center gap-1.5 ${goal.cheers?.includes(userId) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-[var(--surface-1)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--surface-3)]'}`}
                                    >
                                        🔥 Cheer Goal <span className="opacity-80 font-bold">({goal.cheers?.length || 0})</span>
                                    </button>
                                    <span className="text-[10px] text-[var(--text-sub)] font-bold">
                                        Roadmap item created
                                    </span>
                                </div>

                                {/* Linked Journey Posts */}
                                {goalPosts.length > 0 && (
                                    <div className="flex flex-col gap-2 border-t border-[var(--border-color)]/40 pt-4">
                                        <span className="text-[10px] font-black uppercase text-[var(--text-sub)] tracking-wider">Journey Updates ({goalPosts.length})</span>
                                        <div className="grid grid-cols-4 gap-2 mt-1">
                                            {goalPosts.map(post => (
                                                <div key={post._id} className="relative group">
                                                    <PostCard post={post} onClick={handleOpenPostDetail} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Goal Dialog/Modal */}
            {showCreateModal && (
                <div style={{ zIndex: 100 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--surface-1)] rounded-3xl border border-[var(--border-color)] w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center">
                            <h4 className="text-base font-black text-[var(--text-main)] m-0">🎯 Add Roadmap Goal</h4>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="w-8 h-8 rounded-full border-0 bg-[var(--surface-2)] text-[var(--text-sub)] hover:bg-[var(--surface-3)] flex items-center justify-center cursor-pointer"
                            >
                                <i className="pi pi-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateGoal} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Goal Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Launching my SaaS in 90 days"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Description</label>
                                <textarea
                                    placeholder="Explain your journey and why this matters..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Target Date *</label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={e => setTargetDate(e.target.value)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase flex justify-between items-center">
                                    <span>Milestones</span>
                                    <button
                                        type="button"
                                        onClick={handleAddMilestoneInput}
                                        className="text-[10px] font-black text-indigo-500 bg-transparent border-0 cursor-pointer"
                                    >
                                        + Add Milestone
                                    </button>
                                </label>
                                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                    {newMilestones.map((m, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                placeholder={`Milestone ${idx + 1}`}
                                                value={m}
                                                onChange={e => handleMilestoneInputChange(idx, e.target.value)}
                                                className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-indigo-500"
                                            />
                                            {newMilestones.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMilestoneInput(idx)}
                                                    className="w-7 h-7 rounded-full border-0 bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer"
                                                >
                                                    <i className="pi pi-minus text-xs"></i>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0 rounded-xl cursor-pointer transition shadow-md"
                            >
                                Publish Goal to Roadmap
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Goal Dialog/Modal */}
            {showEditModal && selectedGoal && (
                <div style={{ zIndex: 100 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--surface-1)] rounded-3xl border border-[var(--border-color)] w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center">
                            <h4 className="text-base font-black text-[var(--text-main)] m-0">🔧 Edit Roadmap Goal</h4>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="w-8 h-8 rounded-full border-0 bg-[var(--surface-2)] text-[var(--text-sub)] hover:bg-[var(--surface-3)] flex items-center justify-center cursor-pointer"
                            >
                                <i className="pi pi-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleUpdateGoal} className="flex flex-col gap-3.5">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Goal Title *</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 font-medium"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Description</label>
                                <textarea
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-3 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 resize-none font-medium"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Target Date *</label>
                                <input
                                    type="date"
                                    value={editTargetDate}
                                    onChange={e => setEditTargetDate(e.target.value)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 font-medium"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Status</label>
                                <select
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value)}
                                    className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 cursor-pointer font-bold"
                                >
                                    <option value="active">🚀 Active</option>
                                    <option value="completed">✅ Completed</option>
                                    <option value="failed">❌ Failed</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-[var(--border-color)]/60 pt-3">
                                <label className="text-[10px] font-bold text-[var(--text-sub)] uppercase">Manage Milestones</label>
                                
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add milestone title..."
                                        value={newMilestoneTitle}
                                        onChange={e => setNewMilestoneTitle(e.target.value)}
                                        className="flex-1 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-indigo-500 font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddMilestone}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-xl text-xs font-bold cursor-pointer transition shadow-md"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1 mt-2">
                                    {selectedGoal.milestones?.map(m => (
                                        <div key={m._id} className="flex justify-between items-center bg-[var(--surface-2)] p-2 rounded-xl border border-[var(--border-color)]/30">
                                            <span className="text-xs text-[var(--text-main)] truncate max-w-[200px] font-medium">{m.title}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteMilestone(m._id)}
                                                className="w-6 h-6 rounded-full border-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition"
                                                title="Delete Milestone"
                                            >
                                                <i className="pi pi-trash text-[10px]"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0 rounded-xl cursor-pointer transition shadow-md"
                            >
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Post Detail Dialog/Modal */}
            {postDetailVisible && selectedPost && (
                <PostDetail
                    postId={selectedPost._id}
                    visible={postDetailVisible}
                    onHide={() => {
                        setPostDetailVisible(false);
                        setSelectedPost(null);
                    }}
                />
            )}
        </div>
    );
};

export default GoalWall;
