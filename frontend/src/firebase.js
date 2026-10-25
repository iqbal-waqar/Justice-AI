/**
 * Firebase configuration for JusticeAI.
 * Handles Google Sign-In and Email/Password auth.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDzJCwhsaznQ3LtWxLSMjAifnfsYI9zew8",
    authDomain: "justiceai-8a364.firebaseapp.com",
    projectId: "justiceai-8a364",
    storageBucket: "justiceai-8a364.firebasestorage.app",
    messagingSenderId: "211119597194",
    appId: "1:211119597194:web:10c48048be832108c12f73",
    measurementId: "G-1N52PKYPZB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
