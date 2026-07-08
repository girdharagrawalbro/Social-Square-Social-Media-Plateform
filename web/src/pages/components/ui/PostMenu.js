import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import toast from '../../../utils/toast.js';
import useAuthStore, { api } from '../../../store/zustand/useAuthStore';
import usePostStore from '../../../store/zustand/usePostStore';
import { useSavePost, useDeletePost, useUpdatePost } from '../../../hooks/queries/usePostQueries';
import { useMuteUser, useUnmuteUser, useBlockUser, useUnblockUser } from '../../../hooks/queries/useAuthQueries';
import ReportDialog from './ReportDialog';
import SaveAsNoteModal from '../SaveAsNoteModal';

const PostMenu = ({ 
    post, 
    user: passedUser, 
    isOwner: passedIsOwner, 
    onEdit, 
    onDelete, 
    onSave, 
    isSaved: passedIsSaved, 
    isSaving: passedIsSaving, 
    onReport, 
    onShareToStory, 
    onMute, 
    onBlock, 
    onSuccess,
    buttonClassName, 
    iconClassName 
}) => {
    const [visible, setVisible] = useState(false);
    const [reportVisible, setReportVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [editCaption, setEditCaption] = useState(post?.caption || '');
    const [saveAsKnowledgeVisible, setSaveAsKnowledgeVisible] = useState(false);

    const loggeduser = useAuthStore(s => s.user);
    const user = passedUser || loggeduser;
    
    // Check ownership
    const isOwner = passedIsOwner !== undefined 
        ? passedIsOwner 
        : (post.user?._id === user?._id || post.user?._id?.toString() === user?._id);

    // Save state helpers from Zustand store
    const storeIsSaved = usePostStore(s => s.isSaved);
    const storeToggleSaved = usePostStore(s => s.toggleSaved);
    const isSaved = passedIsSaved !== undefined 
        ? passedIsSaved 
        : (storeIsSaved ? storeIsSaved(post._id) : false);

    const setSharingPostToStory = usePostStore(s => s.setSharingPostToStory);

    // Queries & Mutations
    const saveMutation = useSavePost();
    const deleteMutation = useDeletePost();
    const updateMutation = useUpdatePost();
    const muteMutation = useMuteUser();
    const unmuteMutation = useUnmuteUser();
    const blockMutation = useBlockUser();
    const unblockMutation = useUnblockUser();

    const handleSave = () => {
        if (onSave) {
            onSave();
            return;
        }
        const wasSaved = isSaved;
        if (storeToggleSaved) storeToggleSaved(post._id, !wasSaved);
        saveMutation.mutate({ postId: post._id }, {
            onError: () => {
                if (storeToggleSaved) storeToggleSaved(post._id, wasSaved);
                toast.error('Failed to save');
            }
        });
    };

    const handleShareToStory = () => {
        if (onShareToStory) {
            onShareToStory();
        } else if (setSharingPostToStory) {
            setSharingPostToStory(post);
            toast.success('Sharing to story...');
        }
    };

    const handleLocalDelete = () => {
        if (onDelete) {
            onDelete();
            return;
        }
        confirmDialog({
            message: 'Are you sure you want to delete this post?',
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger border-0 rounded-xl',
            rejectClassName: 'p-button-text p-button-secondary rounded-xl',
            accept: () => {
                deleteMutation.mutate({ postId: post._id }, {
                    onSuccess: () => {
                        toast.success('Post deleted');
                        if (onSuccess) onSuccess('delete');
                    },
                });
            }
        });
    };

    const handleMute = () => {
        if (onMute) {
            onMute();
            return;
        }
        if (post.isAnonymous) return;
        const isMuted = user?.mutedUsers?.some(m => m?.toString() === post.user?._id?.toString());
        if (isMuted) {
            unmuteMutation.mutate({ targetUserId: post.user._id }, {
                onSuccess: () => {
                    toast.success(`Unmuted ${post.user.fullname || 'user'}`);
                    if (onSuccess) onSuccess('unmute');
                }
            });
        } else {
            confirmDialog({
                message: `Are you sure you want to mute ${post.user.fullname || 'this user'}? Their posts will be hidden from your feed.`,
                header: 'Mute User',
                icon: 'pi pi-volume-off',
                acceptLabel: 'Mute',
                acceptClassName: 'p-button-warning border-0 rounded-xl',
                rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                accept: () => muteMutation.mutate({ targetUserId: post.user._id }, {
                    onSuccess: () => {
                        toast.success(`Muted ${post.user.fullname || 'user'}`);
                        if (onSuccess) onSuccess('mute');
                    }
                }),
            });
        }
    };

    const handleBlock = () => {
        if (onBlock) {
            onBlock();
            return;
        }
        if (post.isAnonymous) return;
        const isBlocked = user?.blockedUsers?.some(b => b?.toString() === post.user?._id?.toString());
        if (isBlocked) {
            unblockMutation.mutate({ targetUserId: post.user._id }, {
                onSuccess: () => {
                    toast.success(`Unblocked ${post.user.fullname || 'user'}`);
                    if (onSuccess) onSuccess('unblock');
                }
            });
        } else {
            confirmDialog({
                message: `Are you sure you want to block ${post.user.fullname || 'this user'}? They won't be able to see your profile or posts, and you won't see theirs.`,
                header: 'Block Confirmation',
                icon: 'pi pi-ban',
                acceptLabel: 'Block',
                acceptClassName: 'p-button-danger border-0 rounded-xl',
                rejectClassName: 'p-button-text p-button-secondary rounded-xl',
                accept: () => blockMutation.mutate({ targetUserId: post.user._id }, {
                    onSuccess: () => {
                        toast.success(`Blocked ${post.user.fullname || 'user'}`);
                        if (onSuccess) onSuccess('block');
                    }
                }),
            });
        }
    };

    const submitReport = async (reason, customDetails) => {
        try {
            await api.post(`/api/moderation/report`, { postId: post._id, reason, details: customDetails });
            toast.success('Report submitted. Thank you!');
            setReportVisible(false);
            if (onSuccess) onSuccess('report');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleEditSubmit = () => {
        if (!editCaption.trim()) return;
        updateMutation.mutate({ postId: post._id, caption: editCaption }, {
            onSuccess: () => {
                toast.success('Caption updated successfully');
                setEditVisible(false);
            },
            onError: () => {
                toast.error('Failed to update caption');
            }
        });
    };

    const actionItems = [
        {
            label: isSaved ? 'Unsave post' : 'Save post',
            icon: isSaved ? 'pi pi-bookmark-fill' : 'pi pi-bookmark',
            color: isSaved ? 'text-[#808bf5]' : 'text-[var(--text-main)]',
            onClick: () => {
                handleSave();
                setVisible(false);
            }
        },
        {
            label: 'Save as Knowledge',
            icon: 'pi pi-book',
            color: 'text-[#10b981]',
            onClick: () => {
                setSaveAsKnowledgeVisible(true);
                setVisible(false);
            }
        },
        ...(isOwner ? [
            {
                label: 'Edit post',
                icon: 'pi pi-pencil',
                color: 'text-[var(--text-main)]',
                onClick: () => {
                    if (onEdit) {
                        onEdit();
                    } else {
                        setEditCaption(post.caption || '');
                        setEditVisible(true);
                    }
                    setVisible(false);
                }
            },
            {
                label: 'Share to Story',
                icon: 'pi pi-sparkles',
                color: 'text-[#808bf5]',
                onClick: () => {
                    handleShareToStory();
                    setVisible(false);
                }
            },
            {
                label: 'Delete post',
                icon: 'pi pi-trash',
                color: 'text-red-500',
                onClick: () => {
                    handleLocalDelete();
                    setVisible(false);
                }
            }
        ] : [
            {
                label: 'Interested',
                icon: 'pi pi-thumbs-up',
                color: 'text-green-500',
                onClick: async () => {
                    try {
                        await api.post('/api/recommendation/activity', { postId: post._id, action: 'interested' });
                        toast.success('We will show you more posts like this');
                    } catch (e) {
                        toast.error('Failed to update preference');
                    }
                    setVisible(false);
                }
            },
            {
                label: 'Not interested',
                icon: 'pi pi-thumbs-down',
                color: 'text-orange-500',
                onClick: async () => {
                    try {
                        await api.post('/api/recommendation/activity', { postId: post._id, action: 'not_interested' });
                        toast.success('We will show you fewer posts like this');
                    } catch (e) {
                        toast.error('Failed to update preference');
                    }
                    setVisible(false);
                }
            },
            ...(!post.isAnonymous ? [
                {
                    label: user?.mutedUsers?.some(m => m?.toString() === post.user?._id?.toString()) ? 'Unmute user' : 'Mute user',
                    icon: user?.mutedUsers?.some(m => m?.toString() === post.user?._id?.toString()) ? 'pi pi-volume-up' : 'pi pi-volume-off',
                    color: 'text-[var(--text-main)]',
                    onClick: () => {
                        handleMute();
                        setVisible(false);
                    }
                },
                {
                    label: user?.blockedUsers?.some(b => b?.toString() === post.user?._id?.toString()) ? 'Unblock user' : 'Block user',
                    icon: 'pi pi-ban',
                    color: 'text-red-500',
                    onClick: () => {
                        handleBlock();
                        setVisible(false);
                    }
                }
            ] : []),
            {
                label: 'Report post',
                icon: 'pi pi-flag',
                color: 'text-red-500',
                onClick: () => {
                    if (onReport) onReport();
                    else setReportVisible(true);
                    setVisible(false);
                }
            }
        ])
    ];

    return (
        <div className="relative post-menu-container">
            <button
                aria-label="Post options"
                onClick={(e) => { e.stopPropagation(); setVisible(true); }}
                className={buttonClassName || "bg-[var(--surface-2)] border-0 cursor-pointer p-2 rounded-full text-[var(--text-main)] hover:opacity-80 transition flex items-center justify-center shadow-sm"}
            >
                <i className={iconClassName || "pi pi-ellipsis-h"} style={{ fontSize: '16px', fontWeight: 'bold' }}></i>
            </button>

            <Dialog
                visible={visible}
                onHide={() => setVisible(false)}
                header="Post Options"
                style={{ width: '90vw', maxWidth: '400px' }}
                draggable={false}
                resizable={false}
                modal
                blockScroll
                className="post-menu-dialog"
            >
                <div className="flex flex-col gap-1 py-1">
                    {actionItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={item.onClick}
                            disabled={item.disabled}
                            className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border-0 bg-transparent hover:bg-[var(--surface-2)] transition cursor-pointer text-left group ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <i className={`${item.icon} text-lg ${item.color} group-hover:scale-110 transition-transform`}></i>
                            <span className={`font-semibold text-base ${item.color.includes('text-red') ? 'text-red-500' : 'text-[var(--text-main)]'}`}>
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </Dialog>

            {/* Self-contained Report Dialog if not handled by parent */}
            {!onReport && reportVisible && (
                <ReportDialog
                    visible={reportVisible}
                    onHide={() => setReportVisible(false)}
                    onSubmit={submitReport}
                />
            )}

            {/* Self-contained Edit Dialog if not handled by parent */}
            {!onEdit && editVisible && (
                <Dialog 
                    header={false} 
                    visible={editVisible} 
                    style={{ width: '95vw', maxWidth: '420px', borderRadius: '24px' }} 
                    onHide={() => setEditVisible(false)} 
                    closable={false}
                >
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="m-0 text-xl font-bold text-gray-900 font-outfit">Edit Post</h3>
                            <button onClick={() => setEditVisible(false)} className="bg-gray-100 border-0 rounded-full w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-200">✕</button>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl">
                            <img src={post.user?.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                            <span className="font-semibold text-sm">{post.user?.fullname}</span>
                        </div>
                        <div className="relative">
                            <textarea
                                value={editCaption}
                                onChange={e => setEditCaption(e.target.value)}
                                rows={6}
                                placeholder="Write your new caption..."
                                className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm resize-none focus:border-indigo-400 outline-none transition font-medium"
                            />
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button onClick={() => setEditVisible(false)} className="flex-1 py-3 border-2 border-gray-100 rounded-2xl bg-white cursor-pointer text-sm font-bold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                            <button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="flex-1 py-3 bg-[#808bf5] text-white border-0 rounded-2xl cursor-pointer text-sm font-bold shadow-lg shadow-indigo-200 hover:opacity-90 transition disabled:opacity-50">
                                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </Dialog>
            )}

            <style>{`
                .post-menu-dialog .p-dialog-header {
                    padding: 1.25rem 1.5rem 0.5rem 1.5rem;
                    background: var(--surface-1);
                    color: var(--text-main);
                    border-top-left-radius: 1.5rem;
                    border-top-right-radius: 1.5rem;
                }
                .post-menu-dialog .p-dialog-content {
                    padding: 0.5rem 1rem 1.5rem 1rem;
                    background: var(--surface-1);
                    border-bottom-left-radius: 1.5rem;
                    border-bottom-right-radius: 1.5rem;
                }
                  
                .post-menu-dialog .p-dialog-header .p-dialog-header-icon {
                    color: var(--text-sub);
                }
            `}</style>

            {/* Save as Knowledge Modal */}
            {saveAsKnowledgeVisible && (
                <SaveAsNoteModal
                    post={post}
                    onClose={() => setSaveAsKnowledgeVisible(false)}
                    onSaved={() => setSaveAsKnowledgeVisible(false)}
                />
            )}
        </div>
    );
};

export default PostMenu;
