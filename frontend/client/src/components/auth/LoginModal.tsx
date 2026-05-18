import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
  CircularProgress,
  Divider,
  TextField,
} from '@mui/material';
import {
  Google,
  AccountCircle,
  Security,
  ErrorOutline,
  Close,
} from '@mui/icons-material';
import { PrototypeTesterIcon } from '../icons/PrototypeTesterIcon';
import { startCreatorHubGoogleLogin, consumeCreatorHubGoogleLoginError } from '@/lib/creatorhubGoogleAuth';
import { useAuth } from '@/hooks/useAuth';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  context?: 'community' | 'academy' | 'general';
  initialError?: string | null;
  initialLoginType?: 'general' | 'prototype' | null;
  redirectTo?: string | null;
}

const AUTH_TOKEN_KEY = 'creatorhub_auth_token';
const AUTH_USER_KEY = 'creatorhub_auth_user';
const PROTOTYPE_GUEST_EMAIL = 'academy-guest@creatorhubn.com';
const PROTOTYPE_GUEST_PASSWORD = 'guest-access';
const IS_DEVELOPMENT =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.location.hostname === 'localhost');

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

export function LoginModal({
  open,
  onClose,
  context = 'general',
  initialError = null,
  initialLoginType = null,
  redirectTo = null,
}: LoginModalProps) {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [loginType, setLoginType] = useState<'general' | 'prototype' | null>(initialLoginType);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Get contextual title
  const contextTitle = getContextTitle(context);
  const safeRedirectTo =
    typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : null;

  const resolvePostLoginRoute = (role?: string | null): string => {
    if (safeRedirectTo) {
      return safeRedirectTo;
    }

    switch (String(role || '').toLowerCase()) {
      case 'vendor':
        return '/fotograf';
      case 'admin':
      case 'super_admin':
        return '/admin';
      default:
        return '/dashboard';
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    // Slice 9X.59 — Rydd opp i evt. stale Google-OAuth-feil fra forrige
    // forsøk slik at modalen ikke viser gammel "redirect_uri_mismatch"
    // etter at problemet er fikset i Google Cloud Console. Consume
    // tømmer sessionStorage som side-effekt.
    const staleGoogleError = consumeCreatorHubGoogleLoginError();

    setError(initialError ?? staleGoogleError ?? null);
    setLoginType(initialLoginType);
  }, [initialError, initialLoginType, open]);

  const handleGoogleLogin = async () => {
    if (!loginType) {
      setError('Please select a login type');
      return;
    }

    setIsLoading(true);
    setError(null);
    // Rydd evt. stale Google-error fra sessionStorage før nytt forsøk,
    // slik at hvis dette nye forsøket lykkes, kan ingen gammel feil dukke
    // opp på nytt etter redirect tilbake.
    consumeCreatorHubGoogleLoginError();

    try {
      console.log(`🔐 Attempting Google login with type: ${loginType}...`);
      await startCreatorHubGoogleLogin({
        returnPath: safeRedirectTo || undefined,
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  const handleEmailLogin = async () => {
    if (loginType !== 'general') {
      return;
    }

    if (!email.trim()) {
      setError('Skriv inn e-postadressen din.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await login(email, password || 'auto');
      setLocation(resolvePostLoginRoute(data?.user?.role || null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Innlogging feilet');
      setIsLoading(false);
      return;
    }
  };

  const handlePrototypeGuestLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: PROTOTYPE_GUEST_EMAIL,
          password: PROTOTYPE_GUEST_PASSWORD,
          type: 'prototype',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success || !data?.token || !data?.user) {
        throw new Error(data?.error || 'Prototype-innlogging feilet');
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      window.dispatchEvent(new Event('auth-changed'));
      onClose();
      setLocation('/academy-dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prototype-innlogging feilet';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setLoginType(initialLoginType);
    setIsLoading(false);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleBackToChoice = () => {
    setLoginType(null);
    setIsLoading(false);
    setError(null);
    setEmail('');
    setPassword('');
  };

  const handleRequestAccess = () => {
    setError(null);
    setIsLoading(false);
    setEmail('');
    setPassword('');
    setLocation('/request-access');
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
          src="/creatorhub-wordmark-light.png"
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

            <Box
              sx={{
                pt: 1,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255, 255, 255, 0.65)',
                  mb: 1.5,
                }}
              >
                Har du ikke bruker ennå?
              </Typography>
              <Button
                variant="outlined"
                onClick={handleRequestAccess}
                sx={{
                  borderColor: 'rgba(255,186,108,0.35)',
                  color: '#ffcf9c',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 2.5,
                  py: 1,
                  '&:hover': {
                    borderColor: '#ffba6c',
                    background: 'rgba(255,186,108,0.08)',
                  },
                }}
              >
                Opprett bruker / be om tilgang
              </Button>
            </Box>
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

            {loginType === 'general' && (
              <>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
                  eller logg inn med e-post
                </Divider>

                <Stack spacing={2}>
                  <TextField
                    label="E-postadresse"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isLoading}
                    autoComplete="email"
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.68)' } }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.04)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.35)' },
                        '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
                      },
                    }}
                  />
                  <TextField
                    label="Passord"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isLoading}
                    autoComplete="current-password"
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.68)' } }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.04)',
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(255,186,108,0.35)' },
                        '&.Mui-focused fieldset': { borderColor: '#ffba6c' },
                      },
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      void handleEmailLogin();
                    }}
                    disabled={isLoading || !email.trim()}
                    sx={{
                      borderColor: 'rgba(255,186,108,0.45)',
                      color: '#ffcf9c',
                      py: 1.3,
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 700,
                      '&:hover': {
                        borderColor: '#ffba6c',
                        background: 'rgba(255,186,108,0.08)',
                      },
                    }}
                  >
                    {isLoading ? 'Logger inn...' : 'Logg inn med e-post'}
                  </Button>

                  <Button
                    variant="text"
                    onClick={handleRequestAccess}
                    disabled={isLoading}
                    sx={{
                      color: 'rgba(255,255,255,0.7)',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        color: '#ffba6c',
                        background: 'transparent',
                      },
                    }}
                  >
                    Har du ikke bruker? Opprett bruker her
                  </Button>
                </Stack>
              </>
            )}

            {IS_DEVELOPMENT && loginType === 'prototype' && context === 'academy' && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mb: 1.5 }}
                >
                  eller
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AccountCircle />}
                  onClick={handlePrototypeGuestLogin}
                  disabled={isLoading}
                  sx={{
                    borderColor: 'rgba(139, 92, 246, 0.45)',
                    color: '#c4b5fd',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '12px',
                    px: 3,
                    py: 1.1,
                    '&:hover': {
                      borderColor: 'rgba(139, 92, 246, 0.8)',
                      background: 'rgba(139, 92, 246, 0.12)',
                    },
                    '&:disabled': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255, 255, 255, 0.35)',
                    },
                  }}
                >
                  Logg inn med academy-guest
                </Button>
              </Box>
            )}

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
              onClick={handleBackToChoice}
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
