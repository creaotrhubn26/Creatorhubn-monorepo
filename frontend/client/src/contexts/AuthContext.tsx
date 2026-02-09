import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { googleSSOService, GoogleUser } from'../services/GoogleSSOService';

interface AuthContextType {
  user: GoogleUser | null;
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
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('creatorhub_auth_user');
      const storedToken = localStorage.getItem('creatorhub_auth_token');
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser) as GoogleUser);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      const { user: googleUser } = await googleSSOService.signIn();
      setUser(googleUser);
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await googleSSOService.signOut();
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
      const currentUser = await googleSSOService.getCurrentUser();
      setUser(currentUser);
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
