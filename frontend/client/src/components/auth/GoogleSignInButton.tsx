import React, { useState } from 'react';
import type { GoogleUser } from '../../services/GoogleSSOService';
import { googleSSOService } from '../../services/GoogleSSOService';

interface GoogleSignInButtonProps {
  onSuccess?: (user: GoogleUser) => void;
  onError?: (error: Error) => void;
  text?: string;
  className?: string;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  text = 'Sign in with Google',
  className = '',
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      const { user } = await googleSSOService.signIn();

      if (onSuccess) {
        onSuccess(user);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sign in failed');
      console.error('Google Sign-In failed: ', err);

      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignIn}
      disabled={disabled || isLoading}
      className={`google-sign-in-button ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 24px',
        backgroundColor: '#fff',
        border: '1px solid #dadce0',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 500,
        color: '#3c4043',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled || isLoading ? 0.6 : 1,
        boxShadow: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)'}}
      onMouseOver={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = '#f8f9fa';
          e.currentTarget.style.boxShadow =
            '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = '#fff';
        e.currentTarget.style.boxShadow =
          '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)';
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path
          fill="#4285F4"
          d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"
        />
        <path
          fill="#34A853"
          d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"
        />
        <path
          fill="#FBBC05"
          d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"
        />
        <path
          fill="#EA4335"
          d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"
        />
      </svg>
      <span>{isLoading ?'Signing in...' : text}</span>
    </button>
  );
};

export default GoogleSignInButton;
