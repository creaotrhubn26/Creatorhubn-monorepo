import React, { useMemo } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { LockOutlined, SchoolOutlined } from '@mui/icons-material';
import { useCreatorHubStoredSession } from '@/hooks/useCreatorHubStoredSession';
import { resolveCreatorHubAcademyAudience } from '@/lib/creatorhubGoogleAuth';

type AcademyAccessRequirement = 'authenticated' | 'instructor';

interface AcademyAccessGateProps {
  children: React.ReactNode;
  requirement?: AcademyAccessRequirement;
}

function readAcademyRedirectTarget(): string {
  if (typeof window === 'undefined') {
    return '/academy';
  }

  const { pathname, search, hash } = window.location;
  const target = `${pathname}${search}${hash}`;
  return /^\/academy(?:$|[/-])/.test(pathname) || pathname === '/academy-dashboard'
    ? target
    : '/academy';
}

export default function AcademyAccessGate({
  children,
  requirement = 'authenticated',
}: AcademyAccessGateProps) {
  const { authenticated, user, token, isValidating } = useCreatorHubStoredSession();
  const audience = useMemo(
    () => resolveCreatorHubAcademyAudience(user),
    [user],
  );

  const hasRequiredAccess = useMemo(() => {
    if (!authenticated || !user) {
      return false;
    }

    if (requirement === 'instructor') {
      return audience === 'instructor' || audience === 'admin';
    }

    return true;
  }, [audience, authenticated, requirement, user]);

  if (isValidating && token) {
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
        <Stack spacing={1.25} alignItems="center" sx={{ color: '#edf0f7' }}>
          <CircularProgress size={26} sx={{ color: '#f8d56f' }} />
          <Typography sx={{ fontWeight: 600 }}>
            Verifiserer Academy-tilgang...
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (hasRequiredAccess) {
    return <>{children}</>;
  }

  const loginTarget = readAcademyRedirectTarget();
  const loginHref = `/login?redirect=${encodeURIComponent(loginTarget)}`;
  const title =
    requirement === 'instructor'
      ? 'Instruktorinnlogging kreves'
      : 'Innlogging kreves';
  const description =
    requirement === 'instructor'
      ? 'Denne Academy-studioflaten er kun tilgjengelig for instruktorer og administratorer.'
      : 'Denne Academy-flaten krever en aktiv CreatorHub-innlogging.';
  const showRoleMismatch = authenticated && Boolean(user) && !hasRequiredAccess;

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
              {requirement === 'instructor' ? <SchoolOutlined /> : <LockOutlined />}
            </Box>
            <Stack spacing={0.25}>
              <Typography sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
                {title}
              </Typography>
              <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13 }}>
                {description}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {user?.email ? (
              <Chip
                label={`Navaerende oekt: ${user.email}`}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#edf0f7',
                }}
              />
            ) : null}
            {user?.role ? (
              <Chip
                label={`Rolle: ${user.role}`}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(108,151,235,0.18)',
                  color: '#dfe8ff',
                }}
              />
            ) : null}
          </Stack>

          {showRoleMismatch ? (
            <Alert severity="warning">
              Kontoen din er innlogget, men har ikke tilgang til denne Academy-flaten.
            </Alert>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            {!authenticated ? (
              <Button
                variant="contained"
                href={loginHref}
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
                Logg inn
              </Button>
            ) : null}
            <Button
              variant="outlined"
              href={audience === 'student' ? '/academy/student-dashboard' : '/academy'}
              sx={{
                textTransform: 'none',
                minHeight: 48,
                borderRadius: 1.2,
                borderColor: 'rgba(248,179,33,0.24)',
                color: '#edf0f7',
              }}
            >
              {audience === 'student' ? 'Gaa til studentoversikt' : 'Gaa til Academy'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
