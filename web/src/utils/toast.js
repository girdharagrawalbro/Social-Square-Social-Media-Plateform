import useToastStore from '../store/zustand/useToastStore';

const toast = (message, options = {}) => {
    return useToastStore.getState().show({
        message: typeof message === 'function' ? 'Notification' : message,
        type: 'info',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

toast.success = (message, options = {}) => {
    return useToastStore.getState().show({
        message,
        type: 'success',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

toast.error = (message, options = {}) => {
    return useToastStore.getState().show({
        message,
        type: 'error',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

toast.warning = (message, options = {}) => {
    return useToastStore.getState().show({
        message,
        type: 'warning',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

toast.confirm = (message, options = {}) => {
    return useToastStore.getState().show({
        message,
        type: 'confirm',
        position: options.position || 'top-center',
        duration: 0,
        ...options
    });
};

toast.dismiss = (id) => {
    useToastStore.getState().dismiss(id);
};

toast.loading = (message, options = {}) => {
    return useToastStore.getState().show({
        message,
        type: 'info',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

toast.custom = (message, options = {}) => {
    return useToastStore.getState().show({
        message: typeof message === 'string' ? message : 'Alert',
        type: 'info',
        position: options.position || 'top-right',
        duration: options.duration || 4000,
        ...options
    });
};

export default toast;
export { toast };
