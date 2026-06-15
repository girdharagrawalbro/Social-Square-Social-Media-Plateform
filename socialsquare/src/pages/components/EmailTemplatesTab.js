import React, { useState, useEffect } from 'react';
import { getToken, api } from '../../store/zustand/useAuthStore';
import toast from 'react-hot-toast';

export default function EmailTemplatesTab() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // The template currently being edited
    const [editForm, setEditForm] = useState({ subject: '', html: '' });

    const API_BASE_URL = process.env.REACT_APP_NGINIX === "true" ? "" : process.env.REACT_APP_BACKEND_URL;

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const token = getToken();
            const res = await api.get(`${API_BASE_URL}/api/admin/email-templates`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTemplates(res.data.templates || []);
        } catch (err) {
            toast.error('Failed to load email templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSeed = async () => {
        try {
            const token = getToken();
            const res = await api.post(`${API_BASE_URL}/api/admin/email-templates/seed`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(res.data.message);
            fetchTemplates();
        } catch (err) {
            toast.error('Failed to seed templates');
        }
    };

    const handleEdit = (tmpl) => {
        setEditing(tmpl.key);
        setEditForm({ subject: tmpl.subject, html: tmpl.html });
    };

    const handleSave = async (key) => {
        try {
            const token = getToken();
            await api.put(`${API_BASE_URL}/api/admin/email-templates/${key}`, editForm, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Template updated successfully');
            setEditing(null);
            fetchTemplates();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update template');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading templates...</div>;

    return (
        <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl shadow-sm overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-[var(--text-main)] mb-1">Email Templates</h2>
                    <p className="text-sm text-[var(--text-sub)]">Manage dynamic email templates used across the platform.</p>
                </div>
                {templates.length === 0 && (
                    <button onClick={handleSeed} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-all active:scale-95 text-sm shadow-md">
                        Initialize Default Templates
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-6">
                {templates.map(tmpl => (
                    <div key={tmpl.key} className="bg-[var(--surface-2)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-[var(--text-main)]">{tmpl.name}</h3>
                                <p className="text-xs text-[var(--text-sub)] font-mono mt-1">Key: {tmpl.key}</p>
                            </div>
                            {editing !== tmpl.key ? (
                                <button onClick={() => handleEdit(tmpl)} className="text-indigo-500 hover:text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors">
                                    Edit Template
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-700 font-bold text-sm bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={() => handleSave(tmpl.key)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-md transition-all active:scale-95">
                                        Save Changes
                                    </button>
                                </div>
                            )}
                        </div>

                        {tmpl.variables && tmpl.variables.length > 0 && (
                            <div className="mb-4 bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                                <span className="text-xs font-bold text-indigo-800 mr-2">Available Variables:</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {tmpl.variables.map(v => (
                                        <span key={v} className="bg-white border border-indigo-200 text-indigo-600 text-[11px] font-mono px-2 py-0.5 rounded-md shadow-sm">
                                            {v}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {editing === tmpl.key ? (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">Subject</label>
                                    <input
                                        type="text"
                                        value={editForm.subject}
                                        onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                        className="w-full bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg p-3 text-sm text-[var(--text-main)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2">HTML Code</label>
                                        <textarea
                                            value={editForm.html}
                                            onChange={(e) => setEditForm({ ...editForm, html: e.target.value })}
                                            rows={14}
                                            className="w-full h-[400px] bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg p-3 text-sm font-mono text-[var(--text-main)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all custom-scrollbar leading-relaxed"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <i className="pi pi-eye"></i> Live Preview
                                        </label>
                                        <div 
                                            className="w-full h-[400px] bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto custom-scrollbar shadow-inner"
                                            dangerouslySetInnerHTML={{ __html: editForm.html }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 opacity-80 pointer-events-none">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-1">Subject</label>
                                    <div className="text-sm font-medium text-[var(--text-main)] bg-[var(--surface-1)] border border-[var(--border-color)] p-2 rounded-lg">{tmpl.subject}</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider mb-1">HTML Preview</label>
                                    <div className="text-sm font-mono text-[var(--text-main)] bg-[var(--surface-1)] border border-[var(--border-color)] p-3 rounded-lg max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                        {tmpl.html}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {templates.length === 0 && !loading && (
                    <div className="text-center p-12 bg-[var(--surface-2)] border border-dashed border-[var(--border-color)] rounded-xl">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="pi pi-inbox text-2xl"></i>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">No Templates Found</h3>
                        <p className="text-sm text-[var(--text-sub)] mb-6">Click the button above to initialize the default system templates.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
