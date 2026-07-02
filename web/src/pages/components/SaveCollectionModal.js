import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';
import { api } from '../../store/zustand/useAuthStore';

export default function SaveCollectionModal({ post, visible, onHide, onStatusChanged }) {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (visible && post?._id) {
            const fetchCollectionStatuses = async () => {
                setLoading(true);
                try {
                    const res = await api.get(`/api/post/collections/post-status/${post._id}`);
                    setCollections(res.data || []);
                } catch (error) {
                    toast.error('Failed to load collections');
                } finally {
                    setLoading(false);
                }
            };

            fetchCollectionStatuses();
        }
    }, [visible, post?._id]);

    // const fetchCollectionStatuses = async () => {
    //     setLoading(true);
    //     try {
    //         const res = await api.get(`/api/post/collections/post-status/${post._id}`);
    //         setCollections(res.data || []);
    //     } catch (error) {
    //         toast.error('Failed to load collections');
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const handleToggleCollection = async (collectionId, currentHasPost) => {
        try {
            const res = await api.post('/api/post/collections/toggle-post', {
                collectionId,
                postId: post._id
            });

            if (res.data.success) {
                // Update local state
                setCollections(prev => prev.map(c =>
                    c._id === collectionId ? { ...c, hasPost: !currentHasPost } : c
                ));
                toast.success(!currentHasPost ? 'Added to collection' : 'Removed from collection');

                if (onStatusChanged) {
                    onStatusChanged(post._id, res.data.saved);
                }
            }
        } catch (error) {
            toast.error('Failed to update collection');
        }
    };

const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    setCreating(true);
    try {
        await api.post('/api/post/collections/create', {
            name: newCollectionName.trim(),
            postId: post._id
        });
        
        toast.success(`Created collection "${newCollectionName}"`);
        setNewCollectionName('');
        
        // Fetch collections after creation
        setLoading(true);
        const res = await api.get(`/api/post/collections/post-status/${post._id}`);
        setCollections(res.data || []);
        setLoading(false);
        
        if (onStatusChanged) {
            onStatusChanged(post._id, true);
        }
    } catch (error) {
        const msg = error.response?.data?.message || 'Failed to create collection';
        toast.error(msg);
    } finally {
        setCreating(false);
    }
};

    return (
        <Dialog
            header="Save to Collection"
            visible={visible}
            style={{ width: '90vw', maxWidth: '400px' }}
            onHide={onHide}
            dismissableMask
            baseZIndex={21000}
            contentClassName="p-4"
        >
            <div className="flex flex-col gap-4">
                {/* Collection List */}
                <div className="flex flex-col max-h-[260px] overflow-y-auto gap-2 pr-1">
                    {loading ? (
                        <div className="flex flex-col gap-2 py-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-10 bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : collections.length === 0 ? (
                        <p className="text-center text-xs text-[var(--text-sub)] my-6">You don't have any collections yet.</p>
                    ) : (
                        collections.map(c => (
                            <label
                                key={c._id}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--surface-2)] cursor-pointer border border-[var(--border-color)] transition-all"
                            >
                                <span className="text-sm font-semibold text-[var(--text-main)]">{c.name}</span>
                                <input
                                    type="checkbox"
                                    checked={c.hasPost}
                                    onChange={() => handleToggleCollection(c._id, c.hasPost)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                />
                            </label>
                        ))
                    )}
                </div>

                {/* Create New Collection Form */}
                <form onSubmit={handleCreateCollection} className="border-t border-[var(--border-color)] pt-4 flex flex-col gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)]">Create New Collection</span>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Collection name..."
                            value={newCollectionName}
                            onChange={e => setNewCollectionName(e.target.value)}
                            disabled={creating}
                            maxLength={30}
                            style={{
                                flex: 1,
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--surface-2)',
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={creating || !newCollectionName.trim()}
                            className="bg-[#808bf5] hover:bg-[#6366f1] text-white font-bold text-xs rounded-xl px-4 py-2.5 cursor-pointer border-0 disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
                        >
                            {creating ? '...' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </Dialog>
    );
}
