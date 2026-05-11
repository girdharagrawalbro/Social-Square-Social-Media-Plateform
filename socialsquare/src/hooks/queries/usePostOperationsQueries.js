import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../store/zustand/useAuthStore';

// ─── ACCEPT COLLABORATION INVITATION ────────────────────────────────────────
export function useAcceptCollaboration() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, contribution }) =>
            api.post(`/api/post/collaborate/accept`, {
                postId, contribution
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['posts', 'collab-invites'] });
            qc.invalidateQueries({ queryKey: ['posts'] });
        },
    });
}

// ─── DECLINE COLLABORATION INVITATION ───────────────────────────────────────
export function useDeclineCollaboration() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ postId }) =>
            api.post(`/api/post/collaborate/decline`, {
                postId
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['posts', 'collab-invites'] });
        },
    });
}

// ─── REPORT POST ────────────────────────────────────────────────────────────
export function useReportPost() {
    return useMutation({
        mutationFn: ({ postId, reason }) =>
            api.post(`/api/admin/report`, {
                targetType: 'post',
                targetId: postId,
                reason
            }),
    });
}

// ─── REPORT USER ───────────────────────────────────────────────────────────
export function useReportUser() {
    return useMutation({
        mutationFn: ({ userId, reason }) =>
            api.post(`/api/admin/report`, {
                targetType: 'user',
                targetId: userId,
                reason
            }),
    });
}

// ─── REPORT COMMENT ────────────────────────────────────────────────────────
export function useReportComment() {
    return useMutation({
        mutationFn: ({ commentId, reason }) =>
            api.post(`/api/admin/report`, {
                targetType: 'comment',
                targetId: commentId,
                reason
            }),
    });
}
