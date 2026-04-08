import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccountCircle,
  Close,
  Google,
  SchoolOutlined,
} from '@mui/icons-material';
import { startCreatorHubGoogleLogin } from '@/lib/creatorhubGoogleAuth';
import { useAuth } from '@/hooks/useAuth';
import AcademyBrandMark from './AcademyBrandMark';

type AcademyLoginAudience = 'student' | 'instructor';

interface AcademyLoginModalProps {
  open: boolean;
  onClose: () => void;
  initialAudience?: AcademyLoginAudience | null;
  redirectTo?: string | null;
}

const OPTION_COPY: Record<
  AcademyLoginAudience,
  {
    title: string;
    description: string;
    emailLabel: string;
    passwordLabel: string;
    googleLabel: string;
    emailButton: string;
  }
> = {
  student: {
    title: 'Studentinnlogging',
    description:
      'Bruk dette hvis du skal inn i studentflaten, playeren, oppgaver eller læringsløpet i Academy.',
    emailLabel: 'Student-e-post',
    passwordLabel: 'Passord',
    googleLabel: 'Fortsett med Google som student',
    emailButton: 'Logg inn som student',
  },
  instructor: {
    title: 'Instruktørinnlogging',
    description:
      'Bruk dette hvis du skal inn i instruktørstudio, kursadministrasjon eller Academy-verktøyene.',
    emailLabel: 'Instruktør-e-post',
    passwordLabel: 'Passord',
    googleLabel: 'Fortsett med Google som instruktør',
    emailButton: 'Logg inn som instruktør',
  },
};

export default function AcademyLoginModal({
  open,
  onClose,
  initialAudience = null,
  redirectTo = null,
}: AcademyLoginModalProps) {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [selectedAudience, setSelectedAudience] = useState<AcademyLoginAudience | null>(initialAudience);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedAudience(initialAudience);
    setEmail('');
    setPassword('');
    setError(null);
    setIsLoading(false);
  }, [initialAudience, open]);

  const safeRedirectTo =
    typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : null;

  const postLoginRoute = useMemo(() => {
    if (safeRedirectTo) {
      return safeRedirectTo;
    }

    if (selectedAudience === 'student') {
      return '/academy/student-dashboard';
    }

    return '/academy-dashboard';
  }, [safeRedirectTo, selectedAudience]);

  const handleGoogleLogin = async () => {
    if (!selectedAudience) {
      setError('Velg om du skal inn som student eller instruktør først.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await startCreatorHubGoogleLogin({
        returnPath: postLoginRoute,
      });
    } catch (loginError) {
      setIsLoading(false);
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'Kunne ikke starte Google-innloggingen.',
      );
    }
  };

  const handleEmailLogin = async () => {
    if (!selectedAudience) {
      setError('Velg om du skal inn som student eller instruktør først.');
      return;
    }

    if (!email.trim()) {
      setError('Skriv inn e-postadressen din.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(email, password || 'auto');
      setLocation(postLoginRoute);
      onClose();
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : 'Innlogging feilet.',
      );
      setIsLoading(false);
    }
  };

  const handleRequestAccess = () => {
    onClose();
    setLocation('/request-access');
  };

  const activeCopy = selectedAudience ? OPTION_COPY[selectedAudience] : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '24px',
            background: 'rgba(10, 14, 22, 0.94)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.52), 0 0 40px rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.18)',
            overflow: 'visible',
          },
        },
      }}
    >
      <Box
        sx={{
          p: 3,
          pb: 2,
          position: 'relative',
          textAlign: 'center',
          borderBottom: '1px solid rgba(245, 158, 11, 0.12)',
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: 'rgba(255,255,255,0.55)',
            '&:hover': {
              color: '#f5a623',
              bgcolor: 'rgba(245,166,35,0.08)',
            },
          }}
        >
          <Close />
        </IconButton>

        <Stack spacing={1.2} alignItems="center">
          <AcademyBrandMark width={{ xs: 224, sm: 248 }} />
          <Typography sx={{ color: '#edf0f7', fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>
            Velg Academy-innlogging
          </Typography>
          <Typography sx={{ color: 'rgba(237,240,247,0.72)', maxWidth: 430, lineHeight: 1.55 }}>
            Academy bruker en egen innlogging med tydelig skille mellom studentflaten og instruktørstudioet.
          </Typography>
        </Stack>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={2.2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Button
              fullWidth
              startIcon={<SchoolOutlined />}
              onClick={() => setSelectedAudience('student')}
              variant={selectedAudience === 'student' ? 'contained' : 'outlined'}
              sx={{
                minHeight: 58,
                borderRadius: '14px',
                textTransform: 'none',
                justifyContent: 'flex-start',
                px: 2,
                fontWeight: 700,
                color: selectedAudience === 'student' ? '#111' : '#edf0f7',
                borderColor: 'rgba(245,166,35,0.22)',
                background:
                  selectedAudience === 'student'
                    ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                    : 'rgba(255,255,255,0.02)',
              }}
            >
              Student
            </Button>
            <Button
              fullWidth
              startIcon={<AccountCircle />}
              onClick={() => setSelectedAudience('instructor')}
              variant={selectedAudience === 'instructor' ? 'contained' : 'outlined'}
              sx={{
                minHeight: 58,
                borderRadius: '14px',
                textTransform: 'none',
                justifyContent: 'flex-start',
                px: 2,
                fontWeight: 700,
                color: selectedAudience === 'instructor' ? '#111' : '#edf0f7',
                borderColor: 'rgba(245,166,35,0.22)',
                background:
                  selectedAudience === 'instructor'
                    ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                    : 'rgba(255,255,255,0.02)',
              }}
            >
              Instruktør / admin
            </Button>
          </Stack>

          {activeCopy ? (
            <Box
              sx={{
                borderRadius: '16px',
                border: '1px solid rgba(245,166,35,0.16)',
                background: 'linear-gradient(145deg, rgba(19,24,36,0.9), rgba(10,13,20,0.96))',
                p: 2,
              }}
            >
              <Stack spacing={1.4}>
                <Box>
                  <Typography sx={{ color: '#edf0f7', fontWeight: 700, fontSize: 20 }}>
                    {activeCopy.title}
                  </Typography>
                  <Typography sx={{ mt: 0.6, color: 'rgba(237,240,247,0.7)', lineHeight: 1.55 }}>
                    {activeCopy.description}
                  </Typography>
                </Box>

                {error ? <Alert severity="error">{error}</Alert> : null}

                <Button
                  variant="contained"
                  startIcon={isLoading ? undefined : <Google />}
                  onClick={() => void handleGoogleLogin()}
                  disabled={isLoading}
                  sx={{
                    minHeight: 48,
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 700,
                    color: '#111',
                    background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                  }}
                >
                  {isLoading ? 'Starter innlogging...' : activeCopy.googleLabel}
                </Button>

                <TextField
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  label={activeCopy.emailLabel}
                  autoComplete="email"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#edf0f7',
                      borderRadius: '12px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.6)' },
                  }}
                />
                <TextField
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  label={activeCopy.passwordLabel}
                  type="password"
                  autoComplete="current-password"
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#edf0f7',
                      borderRadius: '12px',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                    },
                    '& .MuiInputLabel-root': { color: 'rgba(237,240,247,0.6)' },
                  }}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => void handleEmailLogin()}
                    disabled={isLoading}
                    sx={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 700,
                      color: '#edf0f7',
                      borderColor: 'rgba(245,166,35,0.22)',
                    }}
                  >
                    {activeCopy.emailButton}
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => setSelectedAudience(null)}
                    disabled={isLoading}
                    sx={{
                      minHeight: 46,
                      borderRadius: '12px',
                      textTransform: 'none',
                      color: 'rgba(237,240,247,0.68)',
                    }}
                  >
                    Tilbake til valg
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                borderRadius: '16px',
                border: '1px solid rgba(245,166,35,0.14)',
                background: 'rgba(255,255,255,0.02)',
                p: 2,
              }}
            >
              <Typography sx={{ color: 'rgba(237,240,247,0.74)', lineHeight: 1.6 }}>
                Velg først om du skal inn som student eller instruktør. Da får du riktig Academy-flyt og riktig redirect etter innlogging.
              </Typography>
            </Box>
          )}

          <Button
            variant="text"
            onClick={handleRequestAccess}
            sx={{
              textTransform: 'none',
              color: '#f8d56f',
              fontWeight: 700,
              justifyContent: 'flex-start',
            }}
          >
            Trenger du tilgang? Opprett bruker her
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
