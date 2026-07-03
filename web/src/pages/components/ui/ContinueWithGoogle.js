import { Navigate } from 'react-router';
import useAuthStore from '../../../store/zustand/useAuthStore';
import { getFingerprint } from '../../../utils/fingerprint';
import toast from 'react-hot-toast';

const ContinueWithGoogle = () => {
    const googleLogin = useAuthStore(s => s.googleLogin);
    return (
        <button
            onClick={async () => {
                try {
                    const { auth, googleProvider } = await import('../../../lib/firebase');
                    const { signInWithPopup } = await import('firebase/auth');
                    const result = await signInWithPopup(auth, googleProvider);
                    const idToken = await result.user.getIdToken();
                    const fingerprint = await getFingerprint();
                    const loginResult = await googleLogin({
                        credential: idToken,
                        fingerprint
                    });

                    if (loginResult?.success) {
                        toast.success('Google login successful!');
                        Navigate(`/${loginResult.user.username}`);
                    } else {
                        toast.error(loginResult?.error || 'Google login failed');
                    }
                } catch (err) {
                    console.error('Google login error:', err);
                    if (err.code !== 'auth/popup-closed-by-user') {
                        toast.error('An error occurred during Google login');
                    }
                }
            }}
            className="flex items-center justify-center gap-3 px-6 py-2.5 w-full bg-white border border-gray-300 rounded-full text-gray-700 font-semibold transition-all hover:bg-gray-50 active:scale-[0.98] shadow-sm"
            style={{ maxWidth: '350px' }}
        >
            <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.956L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
            </svg>
            Continue with Google
        </button>

    )
}


export default ContinueWithGoogle;