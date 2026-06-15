import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getToken, api } from '../../store/zustand/useAuthStore';
import useEmailTemplateStore from '../../store/zustand/useEmailTemplateStore';
import toast from 'react-hot-toast';
import { Dialog } from 'primereact/dialog';

export default function EmailTemplatesTab() {
    const queryClient = useQueryClient();
    const { editingId, editForm, setEditingId, setEditForm, resetEditing } = useEmailTemplateStore();

    const API_BASE_URL = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

    const { data: templates = [], isLoading: loading } = useQuery({
        queryKey: ['emailTemplates'],
        queryFn: async () => {
            const token = getToken();
            const res = await api.get(`${API_BASE_URL}/api/admin/email-templates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data.templates || [];
        }
    });

    const seedMutation = useMutation({
        mutationFn: async () => {
            const token = getToken();
            const res = await api.post(`${API_BASE_URL}/api/admin/email-templates/seed`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || 'Templates initialized');
            queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
        },
        onError: () => {
            toast.error('Failed to seed templates');
        }
    });

    const saveMutation = useMutation({
        mutationFn: async (key) => {
            const token = getToken();
            const res = await api.put(`${API_BASE_URL}/api/admin/email-templates/${key}`, editForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Template updated successfully');
            resetEditing();
            queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to update template');
        }
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const token = getToken();
            const res = await api.post(`${API_BASE_URL}/api/admin/email-templates`, editForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Template created successfully');
            resetEditing();
            queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Failed to create template');
        }
    });

    const handleSeed = () => seedMutation.mutate();

    const handleEdit = (tmpl) => {
        setEditingId(tmpl.key);
        setEditForm({ key: tmpl.key, name: tmpl.name, subject: tmpl.subject, html: tmpl.html, variables: tmpl.variables });
    };

    const handleAdd = () => {
        setEditingId('NEW');
        setEditForm({ key: '', name: '', subject: '', html: '', variables: [] });
    };

    const handleSave = () => {
        if (editingId === 'NEW') {
            createMutation.mutate();
        } else {
            saveMutation.mutate(editingId);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading templates...</div>;

    const isModalOpen = editingId !== null;

    return (
        <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl shadow-sm overflow-hidden p-3">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-main)] mb-1">Email Templates</h2>
                    <p className="text-sm text-[var(--text-sub)]">Manage dynamic email templates used across the platform.</p>
                </div>
                <div className="flex gap-2">
                    {templates.length === 0 && (
                        <button onClick={handleSeed} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all active:scale-95 text-sm shadow-md">
                            Initialize Default
                        </button>
                    )}
                    <button onClick={handleAdd} className="bg-[#808bf5] hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold transition-all active:scale-95 text-sm shadow-md flex items-center gap-2">
                        <i className="pi pi-plus"></i> Add Template
                    </button>
                </div>
            </div>

            <div className="flex flex-col border border-[var(--border-color)] rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-[var(--surface-2)] p-3 border-b border-[var(--border-color)] text-xs font-bold uppercase tracking-wider text-[var(--text-sub)]">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Key</div>
                    <div className="col-span-5">Subject</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>
                {templates.map(tmpl => (
                    <div key={tmpl.key} className="grid grid-cols-12 items-center p-3 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors">
                        <div className="col-span-3 font-bold text-[var(--text-main)] text-sm">{tmpl.name}</div>
                        <div className="col-span-3 font-mono text-xs text-[var(--text-sub)] bg-[var(--surface-1)] p-1 rounded inline-block w-max">{tmpl.key}</div>
                        <div className="col-span-5 text-sm text-[var(--text-sub)] truncate pr-4">{tmpl.subject}</div>
                        <div className="col-span-1 text-right">
                            <button
                                onClick={() => handleEdit(tmpl)}
                                className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors ml-auto border-0 cursor-pointer"
                                title="Edit Template"
                            >
                                <i className="pi pi-pencil text-xs"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {templates.length === 0 && !loading && (
                <div className="text-center p-12 bg-[var(--surface-2)] border border-dashed border-[var(--border-color)] rounded-b-xl">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="pi pi-inbox text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">No Templates Found</h3>
                    <p className="text-sm text-[var(--text-sub)] mb-6">Click the button above to initialize the default system templates.</p>
                </div>
            )}

            <Dialog
                header={editingId === 'NEW' ? 'Create New Template' : 'Edit Template'}
                visible={isModalOpen}
                style={{ width: '90vw', maxWidth: '1200px' }}
                onHide={resetEditing}
                className="bg-[var(--surface-1)]"
                contentClassName="p-4"
                headerClassName="p-4 border-b border-[var(--border-color)] bg-[var(--surface-2)]"
            >
                <div className="flex flex-col gap-4 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">Template Name</label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="e.g. Welcome Email"
                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg p-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">Template Key (Unique)</label>
                            <input
                                type="text"
                                value={editForm.key}
                                onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                                disabled={editingId !== 'NEW'}
                                placeholder="e.g. welcome_email"
                                className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg p-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">Subject</label>
                        <input
                            type="text"
                            value={editForm.subject}
                            onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                            className="w-full bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg p-2 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>

                    {editForm.variables && editForm.variables.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                            <span className="text-xs font-bold text-indigo-800 mr-2">Available Variables:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {editForm.variables.map(v => (
                                    <span key={v} className="bg-white border border-indigo-200 text-indigo-600 text-[11px] font-mono px-2 py-0.5 rounded-md shadow-sm">
                                        {v}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">Code</label>
                            <textarea
                                value={editForm.html}
                                onChange={(e) => setEditForm({ ...editForm, html: e.target.value })}
                                rows={20}
                                className="w-full h-[500px] bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg p-3 text-sm font-mono text-[var(--text-main)] outline-none focus:border-indigo-500 transition-all custom-scrollbar leading-relaxed"
                                spellCheck={false}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <i className="pi pi-eye"></i> Live Preview
                            </label>
                            <div
                                className="w-full h-[500px] bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto custom-scrollbar shadow-inner text-black pointer-events-auto"
                                dangerouslySetInnerHTML={{ __html: editForm.html }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                        <button onClick={resetEditing} className="px-4 py-2 bg-[var(--surface-2)] text-[var(--text-main)] rounded-lg font-bold text-sm hover:bg-[var(--surface-3)] transition-colors border-0 cursor-pointer">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saveMutation.isPending || createMutation.isPending}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 border-0 cursor-pointer"
                        >
                            {(saveMutation.isPending || createMutation.isPending) ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
