import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import toast from '../../utils/toast.js';
import { api } from '../../store/zustand/useAuthStore';

const Graveyard = ({ userId, isOwner }) => {
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form / Modal State
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editingIdea, setEditingIdea] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [killedReason, setKilledReason] = useState('');
    const [lessonsLearned, setLessonsLearned] = useState('');
    const [tagInput, setTagInput] = useState('');

    const fetchIdeas = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/api/idea/user/${userId}`);
            setIdeas(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load graveyard ideas.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) fetchIdeas();
    }, [userId, fetchIdeas]);

    const openCreateDialog = () => {
        setEditingIdea(null);
        setTitle('');
        setDescription('');
        setKilledReason('');
        setLessonsLearned('');
        setTagInput('');
        setDialogVisible(true);
    };

    const openEditDialog = (idea) => {
        setEditingIdea(idea);
        setTitle(idea.title);
        setDescription(idea.description);
        setKilledReason(idea.killedReason);
        setLessonsLearned(idea.lessonsLearned || '');
        setTagInput((idea.tags || []).join(', '));
        setDialogVisible(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim() || !killedReason.trim()) {
            toast.error('Please fill in all required fields.');
            return;
        }

        const tags = tagInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const payload = { title, description, killedReason, lessonsLearned, tags };

        try {
            if (editingIdea) {
                // Update
                const res = await api.put(`/api/idea/${editingIdea._id}`, payload);
                setIdeas(prev => prev.map(i => i._id === editingIdea._id ? res.data : i));
                toast.success('Killed idea updated.');
            } else {
                // Create
                const res = await api.post('/api/idea/create', payload);
                setIdeas(prev => [res.data, ...prev]);
                toast.success('Killed idea added to graveyard.');
            }
            setDialogVisible(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save idea.');
        }
    };

    const handleDelete = async (ideaId) => {
        if (!window.confirm('Are you sure you want to delete this killed idea?')) return;

        try {
            await api.delete(`/api/idea/${ideaId}`);
            setIdeas(prev => prev.filter(i => i._id !== ideaId));
            toast.success('Idea deleted from graveyard.');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete idea.');
        }
    };

    return (
        <div className="p-2 w-full max-w-3xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                <div>
                    <h2 className="m-0 text-2xl font-black text-[var(--text-main)] flex items-center gap-2.5 font-outfit">
                        <i className="pi pi-history text-rose-500 text-xl"></i> Idea Graveyard
                    </h2>
                    <p className="m-0 text-sm text-[var(--text-sub)] mt-1.5 leading-relaxed">
                    Honoring the kills, the pivots, and the lessons carried forward.
                    </p>
                </div>
                {isOwner && (
                    <button
                        onClick={openCreateDialog}
                        className="px-3 py-2.5 bg-gradient-to-r from-red-500/20 via-rose-500/20 to-red-500/20 hover:from-red-500/30 hover:to-rose-500/30 text-rose-500 border border-rose-500/30 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-md shadow-rose-500/5 select-none sm:mt-1"
                    >
                        <span>💀</span> Log Failure
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-44 w-full bg-[var(--surface-2)] rounded-3xl animate-pulse" />
                    ))}
                </div>
            ) : ideas.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-[var(--text-sub)] bg-[var(--surface-2)]/40 rounded-3xl border border-dashed border-[var(--border-color)]">
                    <div className="text-5xl mb-4 select-none">🪦</div>
                    <h3 className="m-0 text-lg font-bold text-[var(--text-main)] mb-1.5">Graveyard is Empty</h3>
                    <p className="m-0 text-center text-xs leading-relaxed max-w-[280px]">
                        No dead ideas logged here yet. Normalizing failure starts with sharing what didn't work!
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {ideas.map((idea) => (
                        <div
                            key={idea._id}
                            className="relative overflow-hidden bg-[var(--surface-2)] border border-[var(--border-color)] p-3 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                        >
                            {/* Tags list */}
                            {idea.tags && idea.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {idea.tags.map((tag, idx) => (
                                        <span key={idx} className="bg-[var(--surface-3)] text-[var(--text-sub)] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex justify-between items-start gap-4">
                                <h3 className="m-0 text-lg font-extrabold text-[var(--text-main)] font-outfit">
                                    {idea.title}
                                </h3>
                                {isOwner && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            aria-label="Edit idea"
                                            onClick={() => openEditDialog(idea)}
                                            className="w-8 h-8 rounded-full border-0 bg-[var(--surface-3)] hover:bg-[var(--surface-1)] text-[var(--text-sub)] hover:text-[#808bf5] flex items-center justify-center cursor-pointer transition-colors"
                                        >
                                            <i className="pi pi-pencil text-xs"></i>
                                        </button>
                                        <button
                                            aria-label="Delete idea"
                                            onClick={() => handleDelete(idea._id)}
                                            className="w-8 h-8 rounded-full border-0 bg-[var(--surface-3)] hover:bg-red-500/10 text-[var(--text-sub)] hover:text-red-500 flex items-center justify-center cursor-pointer transition-colors"
                                        >
                                            <i className="pi pi-trash text-xs"></i>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <p className="m-0 text-sm text-[var(--text-main)] leading-relaxed mt-2.5 font-medium whitespace-pre-wrap">
                                {idea.description}
                            </p>

                            {/* Details layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {/* Killed Reason */}
                                <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <i className="pi pi-times-circle"></i> Why it Died
                                    </span>
                                    <p className="m-0 text-xs text-[var(--text-main)] leading-relaxed font-semibold whitespace-pre-wrap">
                                        {idea.killedReason}
                                    </p>
                                </div>

                                {/* Lessons Learned */}
                                {idea.lessonsLearned && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex flex-col gap-1.5">
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                            💡 Key Lesson
                                        </span>
                                        <p className="m-0 text-xs text-[var(--text-main)] leading-relaxed font-semibold whitespace-pre-wrap">
                                            {idea.lessonsLearned}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog
                header={`${editingIdea ? '🔧 Update Log' : '💀 Log Dead Idea'}`}
                visible={dialogVisible}
                style={{ width: '95vw', maxWidth: '480px', borderRadius: '28px' }}
                onHide={() => setDialogVisible(false)}
                closable={true}
                modal
            >
                <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Idea Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., AI Wardrobe Stylist"
                            className="w-full border-2 border-[var(--border-color)] rounded-2xl py-2 px-3 text-sm bg-[var(--surface-1)] text-[var(--text-main)] focus:border-indigo-400 outline-none transition font-medium"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Description *</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="What was the idea and how did it work?"
                            className="w-full border-2 border-[var(--border-color)] rounded-2xl py-2 px-2.5 text-sm bg-[var(--surface-1)] text-[var(--text-main)] focus:border-indigo-400 outline-none transition font-medium resize-none"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Why did you kill it? *</label>
                        <textarea
                            value={killedReason}
                            onChange={e => setKilledReason(e.target.value)}
                            rows={3}
                            placeholder="e.g., High server API costs, no clear target market, lost interest..."
                            className="w-full border-2 border-[var(--border-color)] rounded-2xl py-2 px-2.5 text-sm bg-[var(--surface-1)] text-[var(--text-main)] focus:border-indigo-400 outline-none transition font-medium resize-none"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Lessons Learned (Optional)</label>
                        <textarea
                            value={lessonsLearned}
                            onChange={e => setLessonsLearned(e.target.value)}
                            rows={2.5}
                            placeholder="What key takeaways are you bringing to the next project?"
                            className="w-full border-2 border-[var(--border-color)] rounded-2xl py-2 px-2.5 text-sm bg-[var(--surface-1)] text-[var(--text-main)] focus:border-indigo-400 outline-none transition font-medium resize-none"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-sub)]">Tags (Comma-separated)</label>
                        <input
                            type="text"
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            placeholder="AI, SaaS, Mobile"
                            className="w-full border-2 border-[var(--border-color)] rounded-2xl py-2 px-2.5 text-sm bg-[var(--surface-1)] text-[var(--text-main)] focus:border-indigo-400 outline-none transition font-medium"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setDialogVisible(false)}
                            className="flex-1 py-2 border-2 border-[var(--border-color)] rounded-2xl bg-transparent cursor-pointer text-sm font-bold text-[var(--text-sub)] hover:bg-[var(--surface-2)] transition"
                        >Cancel</button>
                        <button
                            type="submit"
                            className="flex-1 py-2 bg-rose-500 text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-rose-200 dark:shadow-none hover:opacity-90 transition"
                        >
                            {editingIdea ? 'Save Changes' : 'Bury Idea'}
                        </button>
                    </div>
                </form>
            </Dialog>
        </div>
    );
};

export default Graveyard;
