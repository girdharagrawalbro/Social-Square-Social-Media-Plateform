import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore from '../../store/zustand/useAuthStore';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── ACCEPT COLLABORATION INVITATION ────────────────────────────────────────
export function useAcceptCollaboration() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId, contribution }) =>
            axios.post(`${BASE}/api/post/collaborate/accept`, {
                postId, userId: user._id, contribution
            }),
        onSuccess: () => {
            // Invalidate collab invites cache
            qc.invalidateQueries({ queryKey: ['posts', 'collab-invites'] });
            qc.invalidateQueries({ queryKey: ['posts'] }); // Invalidate posts that user collaborated on
        },
    });
}

// ─── DECLINE COLLABORATION INVITATION ───────────────────────────────────────
export function useDeclineCollaboration() {
    const qc = useQueryClient();
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId }) =>
            axios.post(`${BASE}/api/post/collaborate/decline`, {
                postId, userId: user._id
            }),
        onSuccess: () => {
            // Invalidate collab invites cache
            qc.invalidateQueries({ queryKey: ['posts', 'collab-invites'] });
        },
    });
}

// ─── REPORT POST ────────────────────────────────────────────────────────────
export function useReportPost() {
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ postId, reason }) =>
            axios.post(`${BASE}/api/admin/report`, {
                reporterId: user._id,
                targetType: 'post',
                targetId: postId,
                reason
            }),
    });
}

// ─── REPORT USER ───────────────────────────────────────────────────────────
export function useReportUser() {
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ userId, reason }) =>
            axios.post(`${BASE}/api/admin/report`, {
                reporterId: user._id,
                targetType: 'user',
                targetId: userId,
                reason
            }),
    });
}

// ─── REPORT COMMENT ────────────────────────────────────────────────────────
export function useReportComment() {
    const user = useAuthStore(s => s.user);

    return useMutation({
        mutationFn: ({ commentId, reason }) =>
            axios.post(`${BASE}/api/admin/report`, {
                reporterId: user._id,
                targetType: 'comment',
                targetId: commentId,
                reason
            }),
    });
}
