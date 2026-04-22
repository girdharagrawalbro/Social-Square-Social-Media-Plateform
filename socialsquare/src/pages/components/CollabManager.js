import React, { useState, useEffect, useCallback } from 'react';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import { useAcceptCollaboration, useDeclineCollaboration } from '../../hooks/queries/usePostOperationsQueries';
import toast from 'react-hot-toast';

const STATUS_STYLE = {
    pending:  { bg: 'var(--surface-2)', color: '#d97706', label: '⏳ Pending' },
    accepted: { bg: '#d1fae5', color: '#059669', label: '✅ Accepted' },
    declined: { bg: '#fee2e2', color: '#ef4444', label: '❌ Declined' },
};

// ─── SINGLE INVITE CARD ───────────────────────────────────────────────────────
const InviteCard = ({ post, userId, onRespond }) => {
    const [contribution, setContribution] = useState('');
    const [showContrib, setShowContrib] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const acceptMut = useAcceptCollaboration();
    const declineMut = useDeclineCollaboration();

    const myCollab = post.collaborators?.find(c => c.userId?.toString() === userId?.toString());
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    const respond = async (accepted) => {
        if (accepted && !contribution.trim()) {
            setShowContrib(true);
            return;
        }
        try {
            if (accepted) {
                await acceptMut.mutateAsync({ postId: post._id, contribution });
            } else {
                await declineMut.mutateAsync({ postId: post._id });
            }
            toast.success(accepted ? '🤝 Collaboration accepted!' : 'Invite declined');
            onRespond(post._id, accepted ? 'accepted' : 'declined');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
    };

    if (!myCollab) return null;
    const isPending = myCollab.status === 'pending';

    return (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', marginBottom: '12px' }} className="shadow-sm">
            {/* Post preview */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px' }}>
                {/* Thumbnail */}
                <div style={{ width: 56, height: 56, borderRadius: '10px', overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
                    {images[0]
                        ? <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>📝</div>
                    }
                </div>
                {/* Post info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <img src={post.user?.profile_picture} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{post.user?.fullname}</span>
                        <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.1)', color: '#808bf5', borderRadius: '8px', padding: '1px 6px', fontWeight: 600 }}>invited you</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {post.caption || '(No caption)'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-sub)' }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                </div>
                {/* My status badge */}
                <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '10px', background: STATUS_STYLE[myCollab.status]?.bg, color: STATUS_STYLE[myCollab.status]?.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                        {STATUS_STYLE[myCollab.status]?.label}
                    </span>
                </div>
            </div>

            {/* All collaborators status */}
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 12px' }}>
                <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#808bf5', fontWeight: 700, padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    👥 {post.collaborators?.length} collaborator{post.collaborators?.length !== 1 ? 's' : ''}
                    <span style={{ fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {post.collaborators?.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={c.profile_picture || 'https://th.bing.com/th/id/OIP.S171c9HYsokHyCPs9brbPwHaGP?rs=1&pid=ImgDetMain'} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                <span style={{ fontSize: '12px', flex: 1, color: 'var(--text-main)' }}>{c.fullname}</span>
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '8px', background: STATUS_STYLE[c.status]?.bg, color: STATUS_STYLE[c.status]?.color, fontWeight: 600 }}>
                                    {STATUS_STYLE[c.status]?.label}
                                </span>
                                {c.contribution && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-sub)', fontStyle: 'italic', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        "{c.contribution}"
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action buttons — only for pending */}
            {isPending && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {showContrib ? (
                        <>
                            <input
                                type="text"
                                placeholder="Add your contribution to this post..."
                                value={contribution}
                                onChange={e => setContribution(e.target.value)}
                                autoFocus
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '2px solid #808bf5', background: 'var(--surface-2)', color: 'var(--text-main)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => respond(true)}
                                    disabled={acceptMut.isPending || !contribution.trim()}
                                    style={{ flex: 1, padding: '10px', background: contribution.trim() ? '#808bf5' : 'var(--surface-3)', color: contribution.trim() ? '#fff' : 'var(--text-sub)', border: 'none', borderRadius: '12px', cursor: contribution.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 700, transition: 'all 0.2s' }}>
                                    {acceptMut.isPending ? '...' : '🤝 Accept & Contribute'}
                                </button>
                                <button onClick={() => setShowContrib(false)} style={{ padding: '10px 16px', background: 'var(--surface-2)', color: 'var(--text-main)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                                    Back
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowContrib(true)}
                                style={{ flex: 1, padding: '12px', background: '#808bf5', color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 12px rgba(128, 139, 245, 0.3)' }}>
                                🤝 Accept
                            </button>
                            <button
                                onClick={() => respond(false)}
                                disabled={declineMut.isPending}
                                style={{ flex: 1, padding: '12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                                {declineMut.isPending ? '...' : '✕ Decline'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Show accepted contribution */}
            {!isPending && myCollab.contribution && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '10px 12px', background: 'rgba(5, 150, 105, 0.05)' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#059669' }}>
                        <strong style={{ fontWeight: 700 }}>Your contribution:</strong> {myCollab.contribution}
                    </p>
                </div>
            )}
        </div>
    );
};

// ─── MAIN COLLAB MANAGER ──────────────────────────────────────────────────────
// mode: 'invites' (pending only) | 'all' (accepted too)
const CollabManager = ({ mode = 'invites', compact = false }) => {
    const loggeduser = useAuthStore(s => s.user);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInvites = useCallback(async () => {
        if (!loggeduser?._id) return;
        setLoading(true);
        try {
            const endpoint = mode === 'all'
                ? `/api/post/collaborate/mine/${loggeduser._id}`
                : `/api/post/collaborate/invites/${loggeduser._id}`;
            const res = await api.get(endpoint);
            setPosts(res.data);
        } catch { }
        setLoading(false);
    }, [loggeduser?._id, mode]);

    useEffect(() => { fetchInvites(); }, [fetchInvites]);

    const handleRespond = (postId, newStatus) => {
        setPosts(prev => prev.map(p => {
            if (p._id !== postId) return p;
            return {
                ...p,
                collaborators: p.collaborators.map(c =>
                    c.userId?.toString() === loggeduser._id?.toString()
                        ? { ...c, status: newStatus }
                        : c
                ),
            };
        }));
        // Remove from invites list if declined, keep if accepted
        if (newStatus === 'declined') {
            setPosts(prev => prev.filter(p => p._id !== postId));
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2].map(i => <div key={i} style={{ height: 100, background: '#f3f4f6', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />)}
        </div>
    );

    if (posts.length === 0) return (
        <div style={{ textAlign: 'center', padding: compact ? '16px 8px' : '32px 16px' }}>
            <p style={{ fontSize: '28px', margin: 0 }}>🤝</p>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0 0' }}>
                {mode === 'invites' ? 'No pending collaboration invites' : 'No collaborative posts yet'}
            </p>
        </div>
    );

    const acceptedPosts = posts.filter(p => {
        const myCollab = p.collaborators?.find(c => c.userId?.toString() === loggeduser._id?.toString());
        const isOwner = p.user?._id?.toString() === loggeduser._id?.toString();
        return isOwner || (myCollab && myCollab.status === 'accepted');
    });

    const pendingInvites = posts.filter(p => {
        const myCollab = p.collaborators?.find(c => c.userId?.toString() === loggeduser._id?.toString());
        return myCollab && myCollab.status === 'pending';
    });

    return (
        <div className="flex flex-col gap-6">
            {!compact && pendingInvites.length > 0 && (
                <div>
                     <p className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider mb-3 px-2">
                        Pending Invites ({pendingInvites.length})
                    </p>
                    {pendingInvites.map(post => (
                        <InviteCard key={post._id} post={post} userId={loggeduser._id} onRespond={handleRespond} />
                    ))}
                </div>
            )}

            {!compact && acceptedPosts.length > 0 && (
                 <div>
                    <p className="text-[10px] uppercase font-bold text-[var(--text-sub)] tracking-wider mb-3 px-2">
                        Collaborative Posts ({acceptedPosts.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2 pr-1">
                        {acceptedPosts.map(post => {
                            const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
                            return (
                                <div 
                                    key={post._id} 
                                    className="aspect-square relative group cursor-pointer rounded-xl overflow-hidden bg-[var(--surface-2)]"
                                    onClick={() => {
                                      // Trigger parent's post detail if possible, 
                                      // but CollabManager is often inside a Dialog.
                                      // For now, we'll use a simple alert or standard detail logic
                                      window.location.href = `/${loggeduser.username}?post=${post._id}`;
                                    }}
                                >
                                    {images[0] ? (
                                        <img src={images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[var(--surface-2)] text-2xl opacity-40">📝</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-4 text-white opacity-0 group-hover:opacity-100">
                                        <span className="flex items-center gap-1 text-xs font-bold"><i className="pi pi-heart-fill"></i> {post.likes?.length || 0}</span>
                                        <span className="flex items-center gap-1 text-xs font-bold"><i className="pi pi-comment"></i> {post.comments?.length || 0}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {compact && posts.map(post => (
                 <InviteCard key={post._id} post={post} userId={loggeduser._id} onRespond={handleRespond} />
            ))}
        </div>
    );
};

export default CollabManager;
export { InviteCard };
