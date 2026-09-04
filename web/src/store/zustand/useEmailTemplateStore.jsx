import { create } from 'zustand';

const useEmailTemplateStore = create((set) => ({
    editingId: null,
    editForm: { key: '', name: '', subject: '', html: '' },
    setEditingId: (id) => set({ editingId: id }),
    setEditForm: (form) => set({ editForm: form }),
    resetEditing: () => set({ editingId: null, editForm: { key: '', name: '', subject: '', html: '' } })
}));

export default useEmailTemplateStore;
