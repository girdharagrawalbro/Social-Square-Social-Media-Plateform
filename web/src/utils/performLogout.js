import useAuthStore, { clearToken } from "../store/zustand/useAuthStore";

async function performLogout() {
    clearToken();

    useAuthStore.setState({
        user: null,
        initialized: true,
    });

    window.location.href = "/";
}

export default performLogout;