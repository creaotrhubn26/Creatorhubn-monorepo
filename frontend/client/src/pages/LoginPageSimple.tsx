import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Container,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Person,
  Lock,
  CameraAlt,
} from '@mui/icons-material';

const ADMIN_DEMO_EMAIL = 'academy-guest@creatorhubn.com';
const ADMIN_DEMO_PASSWORD = 'guest-access';
const IS_DEVELOPMENT =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.location.hostname === 'localhost');

export default function LoginPageSimple() {
  const { login, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const redirectTarget = (() => {
    if (typeof window === 'undefined') return null;
    const candidate = new URLSearchParams(window.location.search).get('redirect');
    return candidate && candidate.startsWith('/') ? candidate : null;
  })();
  const hasStoredToken = (() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem('creatorhub_auth_token'));
  })();
  const currentRole = String(user?.role || '').toLowerCase();
  const currentUserCanAccessRedirect =
    !redirectTarget ||
    redirectTarget !== '/admin' ||
    currentRole === 'admin' ||
    currentRole === 'super_admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated && hasStoredToken && currentUserCanAccessRedirect) {
    setLocation(redirectTarget || '/dashboard');
    return null;
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const effectivePassword =
        IS_DEVELOPMENT &&
        !password.trim() &&
        normalizedEmail === ADMIN_DEMO_EMAIL
          ? ADMIN_DEMO_PASSWORD
          : password || 'auto';
      const data = await login(email, effectivePassword);
      if (redirectTarget) {
        setLocation(redirectTarget);
      } else if (data.user?.role === 'couple') {
        setLocation('/dashboard');
      } else if (data.user?.role === 'vendor') {
        setLocation('/fotograf');
      } else if (data.user?.role === 'admin' || data.user?.role === 'super_admin') {
        setLocation('/admin');
      } else {
        setLocation('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Innlogging feilet');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, login, redirectTarget, setLocation]);

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Container maxWidth="sm">
        <Card sx={{
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}>
          <Box sx={{
            background: 'linear-gradient(90deg, #e94560, #0f3460)',
            p: 4,
            textAlign: 'center'
          }}>
            <CameraAlt sx={{ fontSize: 48, color: 'white', mb: 1 }} />
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 700 }}>
              CreatorHub
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
              Logg inn for å fortsette
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <form onSubmit={handleSubmit}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {error && (
                  <Alert severity="error">{error}</Alert>
                )}

                {isAuthenticated && hasStoredToken && !currentUserCanAccessRedirect && (
                  <Alert severity="info">
                    Du er allerede logget inn med en konto uten admin-tilgang. Logg inn på nytt med admin-kontoen for å fortsette til admin.
                  </Alert>
                )}

                <TextField
                  fullWidth
                  label="E-postadresse"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  required
                  disabled={isLoading}
                  autoFocus
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="action" />
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  fullWidth
                  label="Passord"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  disabled={isLoading}
                  helperText={
                    IS_DEVELOPMENT
                      ? `Admin demo: ${ADMIN_DEMO_EMAIL} / ${ADMIN_DEMO_PASSWORD}`
                      : undefined
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isLoading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={isLoading || !email}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(90deg, #e94560, #0f3460)',
                    '&:hover': { background: 'linear-gradient(90deg, #d63851, #0d2d50)' }
                  }}
                >
                  {isLoading ? 'Logger inn...' : 'Logg inn'}
                </Button>
              </Box>
            </form>

            {IS_DEVELOPMENT ? (
              <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                Demo-kontoer:
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                <strong>Admin:</strong> {ADMIN_DEMO_EMAIL}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                <strong>Passord:</strong> {ADMIN_DEMO_PASSWORD}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Tomt passord fungerer også for denne demo-kontoen.
              </Typography>
              </Box>
            ) : null}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
