import React, { useState } from 'react';
import { api } from '../../store/zustand/useAuthStore';
import toast from '../../utils/toast.js';

/**
 * SaveAsNoteModal — appears when user clicks "Save as Note" on any post.
 * Lets the user choose type (Note/Learning), add an annotation, then save.
 */
export default function SaveAsNoteModal({ post, onClose, onSaved }) {
    const [type, setType] = useState('note');
    const [annotation, setAnnotation] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!post?._id) return;
        setLoading(true);
        try {
            const res = await api.post('/api/knowledge/save', {
                postId: post._id,
                type,
                annotation,
            });
            toast.success(type === 'learning' ? '🎓 Saved as Learning!' : '📝 Saved as Note!');
            onSaved?.(res.data.note);
            onClose?.();
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error('Already saved!');
            } else {
                toast.error('Could not save. Try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 99998,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                }}
            />

            {/* Modal Card */}
            <div style={{
                position: 'fixed', zIndex: 99999,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '92%', maxWidth: 480,
                background: 'var(--surface-1)',
                borderRadius: 24,
                border: '1px solid var(--border-color)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                padding: '28px 28px 24px',
                fontFamily: 'Inter, sans-serif',
                animation: 'knModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
                <style>{`
                    @keyframes knModal {
                        from { opacity: 0; transform: translate(-50%, -48%) scale(0.94); }
                        to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    }
                `}</style>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
                            Save to Knowledge
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-sub)' }}>
                            AI will summarise this post for you ✨
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--surface-2, rgba(0,0,0,0.06))',
                            border: 'none', borderRadius: '50%',
                            width: 34, height: 34, cursor: 'pointer',
                            fontSize: 18, color: 'var(--text-sub)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >×</button>
                </div>

                {/* Post preview */}
                {post?.caption && (
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(128,139,245,0.1), rgba(99,102,241,0.08))',
                        borderRadius: 14, padding: '12px 16px', marginBottom: 20,
                        border: '1px solid rgba(128,139,245,0.2)',
                    }}>
                        <p style={{
                            margin: 0, fontSize: 13, color: 'var(--text-main)',
                            lineHeight: 1.5, display: '-webkit-box',
                            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                            {post.caption}
                        </p>
                    </div>
                )}

                {/* Type toggle */}
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Save As
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {[
                        { id: 'note', label: '📝 Note', desc: 'Quick reference' },
                        { id: 'learning', label: '🎓 Learning', desc: 'Deep insight' },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            id={`save-type-${opt.id}`}
                            onClick={() => setType(opt.id)}
                            style={{
                                flex: 1, padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                                border: type === opt.id
                                    ? '2px solid #808bf5'
                                    : '2px solid var(--border-color)',
                                background: type === opt.id
                                    ? 'linear-gradient(135deg, rgba(128,139,245,0.15), rgba(99,102,241,0.1))'
                                    : 'transparent',
                                transition: 'all 0.18s ease',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 15, fontWeight: 700, color: type === opt.id ? '#808bf5' : 'var(--text-main)' }}>
                                {opt.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3 }}>{opt.desc}</div>
                        </button>
                    ))}
                </div>

                {/* Annotation */}
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Your Note (optional)
                </p>
                <textarea
                    id="save-note-annotation"
                    value={annotation}
                    onChange={e => setAnnotation(e.target.value)}
                    placeholder="Add your personal insight, why this matters to you..."
                    rows={3}
                    maxLength={500}
                    style={{
                        width: '100%', boxSizing: 'border-box', resize: 'vertical',
                        borderRadius: 12, padding: '12px 14px',
                        border: '1.5px solid var(--border-color)',
                        background: 'transparent', color: 'var(--text-main)',
                        fontSize: 14, lineHeight: 1.5, outline: 'none',
                        fontFamily: 'inherit', marginBottom: 6,
                    }}
                    onFocus={e => e.target.style.borderColor = '#808bf5'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                <p style={{ margin: '0 0 20px', fontSize: 11, color: 'var(--text-sub)', textAlign: 'right' }}>
                    {annotation.length}/500
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '13px', borderRadius: 14, cursor: 'pointer',
                            border: '1.5px solid var(--border-color)', background: 'transparent',
                            color: 'var(--text-sub)', fontWeight: 600, fontSize: 14,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        id="save-note-submit-btn"
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                            flex: 2, padding: '13px', borderRadius: 14, cursor: loading ? 'not-allowed' : 'pointer',
                            border: 'none', opacity: loading ? 0.7 : 1,
                            background: 'linear-gradient(135deg, #808bf5, #6366f1, #4f46e5)',
                            color: 'white', fontWeight: 700, fontSize: 14,
                            boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
                            transition: 'opacity 0.2s',
                        }}
                    >
                        {loading ? '✨ Saving...' : `Save as ${type === 'learning' ? 'Learning' : 'Note'}`}
                    </button>
                </div>
            </div>
        </>
    );
}
