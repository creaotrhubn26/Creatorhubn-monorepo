import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  Stack,
  IconButton,
  Card as MuiCard,
  CardContent,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Google,
  AccountCircle,
  Security,
  ErrorOutline,
  Close,
} from '@mui/icons-material';
import { PrototypeTesterIcon } from '../icons/PrototypeTesterIcon';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  context?: 'community' | 'academy' | 'general';
}

interface AuthMessage {
  type: 'AUTH_SUCCESS' | 'AUTH_FAILED' | 'AUTH_CANCELLED';
  user?: any;
  error?: string;
}

// Context-based title mapping
const getContextTitle = (context?: string) => {
  switch (context) {
    case 'community':
      return 'CreatorHub Community';
    case 'academy':
      return 'CreatorHub Academy';
    default:
      return 'CreatorHub Norge';
  }
};

export function LoginModal({ open, onClose, context = 'general' }: LoginModalProps) {
  const [loginType, setLoginType] = useState<'general' | 'prototype' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contextual title
  const contextTitle = getContextTitle(context);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.authenticated) {
        console.log('✅ User authenticated: ', data.user);
        // Trigger auth state refresh in EnhancedMasterIntegrationProvider
        window.dispatchEvent(new Event('auth-changed'));
        onClose();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to check auth status: ', error);
      return false;
    }
  }, [onClose]);

  // Handle messages from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent<AuthMessage>) => {
      // Security: Verify message origin
      if (event.origin !== window.location.origin) {
        console.warn('Received message from untrusted origin:', event.origin);
        return;
      }

      const { type, user, error: authError } = event.data;

      if (type === 'AUTH_SUCCESS') {
        console.log('✅ Authentication successful via postMessage: ', user);
        setIsLoading(false);
        setError(null);

        // Trigger auth state refresh
        window.dispatchEvent(new Event('auth-changed'));
        onClose();
      } else if (type === 'AUTH_FAILED') {
        console.error('❌ Authentication failed:', authError);
        setIsLoading(false);
        setError(authError || 'Authentication failed. Please try again.');
      } else if (type === 'AUTH_CANCELLED') {
        console.log('⚠️ Authentication cancelled by user');
        setIsLoading(false);
        setError(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  const handleGoogleLogin = async () => {
    if (!loginType) {
      setError('Please select a login type');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`🔐 Attempting Google login with type: ${loginType}...`);

      // ✅ FIX #1: Pass login type to backend
      const authUrl = `${window.location.origin}/api/auth/google?type=${loginType}`;
        const authWindow = window.open(
          authUrl,
          'googleAuth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

      // ✅ FIX #5: Check if popup was blocked
      if (!authWindow) {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      console.log('📱 OAuth popup opened successfully');

      // ✅ FIX #5: Timeout if auth takes too long (2 minutes)
      const timeout = setTimeout(() => {
        if (authWindow && !authWindow.closed) {
          authWindow.close();
          setIsLoading(false);
          setError('Authentication timed out. Please try again.');
          console.error('⏱️ Authentication timeout');
        }
      }, 120000);

      // ✅ FIX #2: Monitor popup closure and check auth status
      const checkClosed = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);

          console.log('🔍 OAuth popup closed, checking authentication status...');

          // ✅ FIX #4: Validate session after popup closes
          setTimeout(async () => {
            const isAuthenticated = await checkAuthStatus();

            if (!isAuthenticated) {
              // User closed popup without completing auth
              setIsLoading(false);
              console.log('⚠️ Popup closed without completing authentication');
            }
          }, 500); // Small delay to allow session to be set
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Login error:', error);
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  const resetModal = () => {
    setLoginType(null);
    setIsLoading(false);
};

  const handleClose = () => {
    resetModal();
    onClose();
};

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '24px',
            background: 'rgba(26, 26, 46, 0.92)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            overflow: 'visible'
          }
        }
      }}
    >
      {/* Header with Logo and Contextual Title */}
      <Box sx={{ 
        p: 3,
        pb: 2,
        position: 'relative',
        textAlign: 'center',
        borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
      }}>
        {/* Close Button */}
        <IconButton
          onClick={handleClose}
          sx={{ 
            position: 'absolute',
            top: 12,
            right: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            '&:hover': {
              color: '#f59e0b',
              bgcolor: 'rgba(245, 158, 11, 0.1)',
            },
          }}
        >
          <Close />
        </IconButton>

        {/* CreatorHub Logo */}
        <Box
          component="img"
          src="/creatorhub-logo-amber.svg"
          alt="CreatorHub"
          sx={{
            width: 500,
            height: 'auto',
            objectFit: 'contain',
            mb: 2,
          }}
        />

        {/* Contextual Title */}
        <Typography 
          variant="h5" 
          sx={{
            fontWeight: 700,
            color: '#fff',
            mb: 0.5,
          }}
        >
          {contextTitle}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          {!loginType 
            ? 'Logg inn for å fortsette'
            : loginType === 'prototype' 
              ? 'Test nye funksjoner og gi tilbakemelding'
              : 'Tilgang til alle plattformfunksjoner'
          }
        </Typography>
      </Box>

      <DialogContent sx={{ p: 3, pt: 2 }}>
        {!loginType ? (
          // Login Type Selection
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ 
              color: 'rgba(255, 255, 255, 0.5)', 
              textAlign: 'center',
              mb: 1,
            }}>
              Hvilken type tilgang trenger du?
            </Typography>
            
            <Stack spacing={2}>
              {/* General Login */}
              <MuiCard
                onClick={() => setLoginType('general')}
                sx={{
                  cursor: 'pointer',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)',
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    mx: 'auto',
                    mb: 2,
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                  }}>
                    <AccountCircle sx={{ fontSize: 28 }} />
                  </Box>

                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    color: '#fff',
                    mb: 1,
                  }}>
                    Generell Tilgang
                  </Typography>

                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: 1.6,
                  }}>
                    Full tilgang til alle CreatorHub Norge funksjoner for fotografer, videografer og musikk produsenter
                  </Typography>
                </CardContent>
              </MuiCard>

              {/* Prototype Tester Login */}
              <MuiCard
                onClick={() => setLoginType('prototype')}
                sx={{
                  cursor: 'pointer',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    border: '1px solid rgba(139, 92, 246, 0.5)',
                    background: 'rgba(139, 92, 246, 0.1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.2)',
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box sx={{
                    width: 56,
                    height: 56,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    mx: 'auto',
                    mb: 2,
                    boxShadow: '0 6px 20px rgba(139, 92, 246, 0.4)',
                  }}>
                    <PrototypeTesterIcon size={28} />
                  </Box>

                  <Typography variant="h6" sx={{
                    fontWeight: 700,
                    color: '#fff',
                    mb: 1,
                  }}>
                    Prototype Tester
                  </Typography>

                  <Typography variant="body2" sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: 1.6,
                  }}>
                    Test nye funksjoner, gi tilbakemelding og hjelp oss å forbedre plattformen
                  </Typography>
                </CardContent>
              </MuiCard>
            </Stack>
          </Stack>
        ) : (
          // Google Login for Selected Type
          <Stack spacing={3}>
            {/* Error Alert */}
            {error && (
              <Alert
                severity="error"
                onClose={() => setError(null)}
                sx={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#fca5a5',
                  '& .MuiAlert-icon': { color: '#ef4444' },
                }}
                icon={<ErrorOutline />}
              >
                <Typography variant="body2" sx={{ color: '#fca5a5' }}>{error}</Typography>
              </Alert>
            )}

            {/* Info Alert */}
            <Alert
              severity={loginType === 'prototype' ? 'info' : 'success'}
              sx={{
                backgroundColor: loginType === 'prototype'
                  ? 'rgba(139, 92, 246, 0.15)'
                  : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${loginType === 'prototype' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                borderRadius: '12px',
                color: loginType === 'prototype' ? '#c4b5fd' : '#fcd34d',
                '& .MuiAlert-icon': { 
                  color: loginType === 'prototype' ? '#8b5cf6' : '#f59e0b',
                },
              }}
            >
              <Typography variant="body2" sx={{ color: 'inherit' }}>
                {loginType === 'prototype'
                  ? 'Du logger inn som prototype tester. Du vil få tilgang til beta-funksjoner og feedback-verktøy.'
                  : 'Du logger inn med full tilgang til alle CreatorHub Norge funksjoner.'
                }
              </Typography>
            </Alert>

            <Box sx={{ textAlign: 'center' }}>
              <Button 
                variant="contained"
                size="large"
                startIcon={isLoading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Google />}
                onClick={() => handleGoogleLogin()}
                disabled={isLoading}
                sx={{
                  background: 'linear-gradient(135deg, #4285f4 0%, #1976d2 100%)',
                  color: 'white',
                  py: 1.5,
                  px: 4,
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  textTransform: 'none',
                  minWidth: '220px',
                  boxShadow: '0 4px 16px rgba(66, 133, 244, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(66, 133, 244, 0.5)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)',
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                }}
              >
                {isLoading ? 'Logger inn...' : 'Fortsett med Google'}
              </Button>
            </Box>

            <Box sx={{ 
              textAlign: 'center',
              pt: 2,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}>
                <Security sx={{ fontSize: 16 }} />
                Sikker innlogging med Google OAuth 2.0
              </Typography>
            </Box>

            <Button
              variant="text"
              onClick={resetModal}
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'none',
                '&:hover': {
                  color: '#f59e0b',
                  bgcolor: 'transparent',
                },
              }}
            >
              ← Tilbake til valg
            </Button>
          </Stack>
        )}
      </DialogContent>

      {/* GDPR Notice */}
      <Box sx={{ 
        p: 2,
        pt: 1,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <Typography variant="caption" sx={{ 
          color: 'rgba(255, 255, 255, 0.6)',
          textAlign: 'center',
          display: 'block',
          lineHeight: 1.6,
        }}>
          Ved å logge inn godtar du våre{' '}
          <Box
            component="a"
            href="/terms-and-conditions"
            sx={{
              color: '#f59e0b',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            vilkår
          </Box>
          {' '}og{' '}
          <Box
            component="a"
            href="/privacy-policy"
            sx={{
              color: '#f59e0b',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            personvernregler
          </Box>
          .
        </Typography>
      </Box>
    </Dialog>
  );
}

export default LoginModal;