import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDeweBwr-a_C2292XUTsfYf0S1oMmfLslE",
  authDomain: "social-square-official.firebaseapp.com",
  projectId: "social-square-official",
  storageBucket: "social-square-official.firebasestorage.app",
  messagingSenderId: "438982943802",
  appId: "1:438982943802:web:your_web_app_id" // I might need the actual web app id if it exists
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
