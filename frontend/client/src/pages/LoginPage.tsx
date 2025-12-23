import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';

export const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect location from state, or default to home
  const from = (location.state as any)?.from?.pathname || '/';

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: '-apple-system, BlinkMacSystemFont "Segoe UI", Roboto"Helvetica Neue", Arial, sans-serif',
        padding: '20px',
      }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '48px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
        {/* Logo/Brand */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '32px',
          }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: '28px',
              fontWeight: 600
              color: '#202124',
            }}>
            Welcome Back
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#5f6368',
            }}>
            Sign in to continue to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '24px',
              backgroundColor: '#fce8e6',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#d93025',
              fontSize: '14px',
            }}>
            {error}
          </div>
        )}

        {/* Google Sign In */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
          <GoogleSignInButton
            onSuccess={handleGoogleSignIn}
            onError={(err) => setError(err.message)}
            text="Sign in with Google"
          />
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0',
            fontSize: '14px',
            color: '#5f6368',
          }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#dadce0' }} />
          <span style={{ padding: '0 12px' }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#dadce0' }} />
        </div>

        {/* Alternative Sign In Options */}
        <div
          style={{
            textAlign: 'center',
          }}>
          <button
            style={{
              width: '100%',
              padding: '10px 24px',
              backgroundColor: 'transparent',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 50,
              color: '#3c4043',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Sign in with Email
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #dadce0',
            textAlign: 'center',
            fontSize: '12px',
            color: '#5f6368',
          }}>
          <p style={{ margin: '0 0 8px' }}>
            Don't have an account?{', '}
            <a
              href="/signup"
              style={{
                color: '#1a73e8',
                textDecoration: 'none',
                fontWeight: 50,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }
            >
              Sign up
            </a>
          </p>
          <p style={{ margin: 0 }}>
            By signing in, you agree to our{' '}
            <a
              href="/terms"
              style={{
                color: '#1a73e8',
                textDecoration: 'none',
              }}>
              Terms
            </a>{' '}
            and{''}
            <a
              href="/privacy"
              style={{
                color: '#1a73e8',
                textDecoration: 'none',
              }}>
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
