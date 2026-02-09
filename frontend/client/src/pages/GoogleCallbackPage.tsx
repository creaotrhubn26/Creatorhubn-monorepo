import React, { useEffect, useState } from 'react';

/**
 * Google OAuth Callback Handler Page
 *
 * This page handles the OAuth redirect from Google.
 * It extracts the authorization code and sends it back to the parent window.
 */
export const GoogleCallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const state = urlParams.get('state');

        if (error) {
          setStatus('error');
          setMessage(`Authentication failed: ${error}`);

          // Send error to parent window
          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'google-oauth-callback',
                error,
                receivedState: state,
              },
              window.location.origin,
            );
          }

          // Close popup after a short delay
          setTimeout(() => window.close(), 2000);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received');

          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'google-oauth-callback',
                error: 'No authorization code received',
                receivedState: state,
              },
              window.location.origin,
            );
          }

          setTimeout(() => window.close(), 2000);
          return;
        }

        // Success - send code to parent window
        setStatus('success');
        setMessage('Authentication successful! Closing window...');

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'google-oauth-callback',
              code,
              receivedState: state,
            },
            window.location.origin,
          );
        }

        // Close popup after a short delay
        setTimeout(() => window.close(), 1000);
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred');
        console.error('Callback handling error: ', err);

        setTimeout(() => window.close(), 2000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont "Segoe UI", Roboto"Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#f5f5f5',
        padding: '20px',
      }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '40px',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
        {status === 'processing' && (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #4285F4',
                borderRadius: '50%',
                margin: '0 auto 20px',
                animation: 'spin 1s linear infinite',
              }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === 'success' && (
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#34A853',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="white" />
            </svg>
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#EA4335',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill="white"
              />
            </svg>
          </div>
        )}

        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '20px',
            fontWeight: 500,
            color: '#202124',
          }}>
          {status === 'processing' && 'Authenticating...'}
          {status === 'success' && 'Success!'}
          {status === 'error' && 'Error'}
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color:'#5f6368',
            lineHeight: 1.5
          }}>
          {message}
        </p>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
