import { create } from 'zustand';

const useToastStore = create((set) => ({
    toasts: [],
    show: (toast) => {
        const id = toast.id || 'toast_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        const newToast = {
            id,
            type: 'info', // 'success' | 'error' | 'warning' | 'confirm' | 'info'
            position: toast.type === 'confirm' ? 'top-center' : 'bottom-center', // sensible defaults
            duration: toast.type === 'confirm' ? 0 : 4000,
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            ...toast,
        };

        set((state) => ({
            toasts: [...state.toasts, newToast],
        }));

        if (newToast.duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id),
                }));
            }, newToast.duration);
        }

        return id;
    },
    dismiss: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },
}));

export default useToastStore;
