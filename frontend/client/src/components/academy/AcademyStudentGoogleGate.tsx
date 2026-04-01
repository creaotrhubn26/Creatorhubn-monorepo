import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { Google, SchoolOutlined } from '@mui/icons-material';
import { useCreatorHubStoredSession } from '@/hooks/useCreatorHubStoredSession';
import {
  canAccessCreatorHubStudentAcademy,
  hasCreatorHubVerifiedGoogleSession,
  isCreatorHubAdminImpersonation,
  resolveCreatorHubAcademyAudience,
  startCreatorHubGoogleLogin,
} from '@/lib/creatorhubGoogleAuth';

interface AcademyStudentGoogleGateProps {
  children: React.ReactNode;
}

function AcademyStudentGoogleGate({ children }: AcademyStudentGoogleGateProps) {
  const {
    authenticated,
    user,
    googleLoginError,
    clearGoogleLoginError,
  } = useCreatorHubStoredSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasVerifiedGoogleSession = useMemo(() => {
    if (!authenticated || !user) return false;
    return hasCreatorHubVerifiedGoogleSession(user);
  }, [authenticated, user]);

  const isAdminImpersonation = useMemo(() => {
    if (!authenticated || !user) return false;
    return isCreatorHubAdminImpersonation(user);
  }, [authenticated, user]);

  const academyAudience = useMemo(
    () => resolveCreatorHubAcademyAudience(user),
    [user],
  );

  const hasStudentAcademyAccess = useMemo(() => {
    if (!authenticated || !user) return false;
    return canAccessCreatorHubStudentAcademy(user);
  }, [authenticated, user]);

  const canOpenStudentAcademy = hasStudentAcademyAccess
    && (hasVerifiedGoogleSession || isAdminImpersonation);

  useEffect(() => {
    if (canOpenStudentAcademy) {
      setIsRedirecting(false);
      setLocalError(null);
      return;
    }

    if (googleLoginError) {
      setIsRedirecting(false);
      setLocalError(googleLoginError);
    }
  }, [canOpenStudentAcademy, googleLoginError]);

  const handleGoogleLogin = useCallback(async () => {
    clearGoogleLoginError();
    setLocalError(null);
    setIsRedirecting(true);

    try {
      await startCreatorHubGoogleLogin();
    } catch (error) {
      setIsRedirecting(false);
      setLocalError(
        error instanceof Error
          ? error.message
          : 'Kunne ikke starte Google-innloggingen.',
      );
    }
  }, [clearGoogleLoginError]);

  if (canOpenStudentAcademy) {
    return <>{children}</>;
  }

  const roleLabel = user?.roleLabel || user?.role || 'bruker';
  const showRoleMismatch = authenticated && Boolean(user) && !hasStudentAcademyAccess;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        background:
          'radial-gradient(circle at 82% 18%, rgba(248,179,33,0.18), rgba(0,0,0,0) 38%), linear-gradient(180deg, rgba(10,13,20,0.96), rgba(6,8,13,1))',
      }}
    >
      <Box
        sx={{
          width: 'min(100%, 560px)',
          borderRadius: 2,
          border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
          background:
            'linear-gradient(145deg, rgba(20,24,36,0.94), rgba(11,14,22,0.98))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          p: { xs: 2.2, md: 3 },
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(248,179,33,0.14)',
                border: '1px solid rgba(248,179,33,0.24)',
                color: '#f8d56f',
              }}
            >
              <SchoolOutlined />
            </Box>
            <Stack spacing={0.25}>
              <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
                Studentinnlogging kreves
              </Typography>
              <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13 }}>
                {showRoleMismatch
                  ? 'Denne brukeren er ikke satt opp for studentflyten i Academy.'
                  : 'Academy-studentsiden er kun tilgjengelig med verifisert Google-konto.'}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {user?.email ? (
              <Chip
                label={`Nåværende økt: ${user.email}`}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#edf0f7',
                }}
              />
            ) : null}
            {user?.role ? (
              <Chip
                label={`Rolle: ${roleLabel}`}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(108,151,235,0.18)',
                  color: '#dfe8ff',
                }}
              />
            ) : null}
            {user?.profession ? (
              <Chip
                label={`Profesjon: ${user.profession}`}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(248,179,33,0.14)',
                  color: '#f8d56f',
                }}
              />
            ) : null}
          </Stack>

          <Typography sx={{ color: 'rgba(237,240,247,0.82)', lineHeight: 1.6 }}>
            {showRoleMismatch
              ? `Brukeren er tolket som ${academyAudience === 'instructor' ? 'instruktør' : 'admin'} basert på rolle og rettigheter fra admindashboardet. Bytt til en student-/standardbruker for å teste studentsiden, eller bruk admin-impersonation mot en studentkonto.`
              : 'For å åpne studentoversikt, player, ressurser og oppgaver må brukeren autentiseres via Google. Andre lokale eller midlertidige økter slipper ikke gjennom denne flaten.'}
          </Typography>

          {isAdminImpersonation ? (
            <Alert severity="info">
              Denne økten er startet via admin-impersonation og får derfor teste
              studentflyten uten en egen Google redirect.
            </Alert>
          ) : null}

          {localError ? (
            <Alert
              severity="error"
              onClose={() => {
                clearGoogleLoginError();
                setLocalError(null);
              }}
            >
              {localError}
            </Alert>
          ) : null}

          <Button
            variant="contained"
            startIcon={
              isRedirecting ? <CircularProgress size={18} color="inherit" /> : <Google />
            }
            onClick={() => void handleGoogleLogin()}
            disabled={isRedirecting}
            sx={{
              textTransform: 'none',
              minHeight: 48,
              borderRadius: 1.2,
              color: '#0f0f0f',
              fontWeight: 700,
              background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
              boxShadow: '0 10px 24px rgba(248,179,33,0.24)',
            }}
          >
            {isRedirecting
              ? 'Sender deg til Google...'
              : user?.email
                ? 'Bytt Google-konto'
                : 'Logg inn med Google'}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default AcademyStudentGoogleGate;
