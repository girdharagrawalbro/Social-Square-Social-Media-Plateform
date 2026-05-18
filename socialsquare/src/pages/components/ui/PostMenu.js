import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import toast from 'react-hot-toast';
import { api } from '../../../store/zustand/useAuthStore';

const PostMenu = ({ post, user, isOwner: passedIsOwner, onEdit, onDelete, onSave, isSaved, onReport, isSaving, onShareToStory, onMute, onBlock, buttonClassName, iconClassName }) => {
    const [visible, setVisible] = useState(false);
    const isOwner = passedIsOwner !== undefined ? passedIsOwner : (post.user._id === user?._id || post.user._id?.toString() === user?._id);

    const actionItems = [
        ...(isOwner ? [
            {
                label: 'Edit post',
                icon: 'pi pi-pencil',
                color: 'text-[var(--text-main)]',
                onClick: () => {
                    onEdit();
                    setVisible(false);
                }
            },
            {
                label: 'Share to Story',
                icon: 'pi pi-sparkles',
                color: 'text-[#808bf5]',
                onClick: () => {
                    onShareToStory();
                    setVisible(false);
                }
            },
            {
                label: 'Delete post',
                icon: 'pi pi-trash',
                color: 'text-red-500',
                onClick: () => {
                    onDelete();
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
            {
                label: user?.mutedUsers?.some(m => m?.toString() === post.user?._id?.toString()) ? 'Unmute user' : 'Mute user',
                icon: user?.mutedUsers?.some(m => m?.toString() === post.user?._id?.toString()) ? 'pi pi-volume-up' : 'pi pi-volume-off',
                color: 'text-[var(--text-main)]',
                onClick: () => {
                    onMute();
                    setVisible(false);
                }
            },
            {
                label: user?.blockedUsers?.some(b => b?.toString() === post.user?._id?.toString()) ? 'Unblock user' : 'Block user',
                icon: 'pi pi-ban',
                color: 'text-red-500',
                onClick: () => {
                    onBlock();
                    setVisible(false);
                }
            },
            {
                label: 'Report post',
                icon: 'pi pi-flag',
                color: 'text-red-500',
                onClick: () => {
                    onReport();
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

            <style>{`
                .post-menu-dialog .p-dialog-header {
                    padding: 1.25rem 1.5rem 0.5rem 1.5rem;
                    background: var(--surface-1);
                    color: var(--text-main);
                    border-top-left-radius: 1.5rem;
                    border-top-center-radius: 1.5rem;
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
        </div>
    );
};

export default PostMenu;
