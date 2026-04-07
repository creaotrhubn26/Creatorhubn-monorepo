import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  clearCreatorHubAuthSession,
  readCreatorHubSessionSnapshot,
  startCreatorHubGoogleLogin,
} from '@/lib/creatorhubGoogleAuth';

type AuthUser = ReturnType<typeof readCreatorHubSessionSnapshot>['user'];

interface AuthContextType {
  user: AuthUser;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncFromCreatorHubSession = () => {
      const snapshot = readCreatorHubSessionSnapshot();
      setUser(snapshot.user);
      setIsLoading(false);
    };

    syncFromCreatorHubSession();
    window.addEventListener('auth-changed', syncFromCreatorHubSession);

    return () => {
      window.removeEventListener('auth-changed', syncFromCreatorHubSession);
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      await startCreatorHubGoogleLogin();
    } catch (error) {
      setIsLoading(false);
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      clearCreatorHubAuthSession();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const snapshot = readCreatorHubSessionSnapshot();
      setUser(snapshot.user);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    signInWithGoogle,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
