'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirebaseAuth } from '@/lib/firebase/client';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSignOut = async () => {
    const auth = getFirebaseAuth();
    await auth.signOut();
  };

  const getIdToken = async () => {
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen onSignIn={signInWithGoogle} />;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut: handleSignOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-white/50 text-sm">Loading...</div>
    </div>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary bg-grid-pattern bg-gradient-radial flex items-center justify-center p-4">
      <div className="glass-panel p-8 rounded-xl max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-accent-green rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-black">67</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">67Ranked</h1>
        <p className="text-white/50 text-sm mb-6">Sign in to start playing</p>
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-sm bg-white text-black transition-all flex items-center justify-center gap-3 ${
            isSigningIn ? 'opacity-70 cursor-not-allowed' : 'hover:bg-white/90'
          }`}
        >
          <GoogleIcon />
          {isSigningIn ? 'Signing in...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
