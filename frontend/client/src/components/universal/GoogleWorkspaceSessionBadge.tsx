import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { startCreatorHubGoogleSso } from '@/lib/creatorhubGoogleAuth';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  Google as GoogleIcon,
  WarningAmberRounded,
} from '@mui/icons-material';

type GoogleWorkspaceSessionBadgeTone = 'creatorhub' | 'role-room';

interface GoogleWorkspaceSessionBadgeProps {
  userId: string;
  tone?: GoogleWorkspaceSessionBadgeTone;
  compact?: boolean;
}

interface GoogleWorkspaceStorageSnapshot {
  googleDriveConnected?: boolean;
  driveAccountEmail?: string | null;
  workspaceWarning?: string | null;
}

const toneStyles: Record<GoogleWorkspaceSessionBadgeTone, {
  border: string;
  background: string;
  text: string;
  subtle: string;
  activeBg: string;
  activeText: string;
  idleBg: string;
  idleText: string;
}> = {
  creatorhub: {
    border: 'rgba(37,99,235,0.16)',
    background: 'linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,0.92))',
    text: '#0f172a',
    subtle: '#64748b',
    activeBg: 'rgba(37,99,235,0.10)',
    activeText: '#1d4ed8',
    idleBg: 'rgba(245,158,11,0.12)',
    idleText: '#b45309',
  },
  'role-room': {
    border: 'rgba(251,191,36,0.18)',
    background: 'linear-gradient(180deg, rgba(120,53,15,0.14), rgba(15,23,42,0.62))',
    text: '#fef3c7',
    subtle: 'rgba(254,243,199,0.72)',
    activeBg: 'rgba(16,185,129,0.16)',
    activeText: '#bbf7d0',
    idleBg: 'rgba(251,191,36,0.16)',
    idleText: '#fde68a',
  },
};

export default function GoogleWorkspaceSessionBadge({
  userId,
  tone = 'creatorhub',
  compact = false,
}: GoogleWorkspaceSessionBadgeProps) {
  const { auth } = useEnhancedMasterIntegration();
  const [actionPending, setActionPending] = React.useState(false);
  const normalizedUserId = String(userId || '').trim();
  const styles = toneStyles[tone];

  const { data, isLoading } = useQuery<GoogleWorkspaceStorageSnapshot>({
    queryKey: ['/api/google-workspace/storage', normalizedUserId, 'session-badge'],
    enabled: normalizedUserId.length > 0 && normalizedUserId !== 'guest',
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-workspace/storage/${encodeURIComponent(normalizedUserId)}`, { headers });
    },
    // Slice 9X.64 — Real-time: poll hvert 30 sek + refetch når bruker
    // kommer tilbake til faneblad. Da reflekterer pillet status raskt
    // hvis bruker har koblet til/koblet fra Google i admin/annen fane.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const connected = Boolean(data?.googleDriveConnected);
  const email = typeof data?.driveAccountEmail === 'string' ? data.driveAccountEmail.trim() : '';
  const warning = typeof data?.workspaceWarning === 'string' ? data.workspaceWarning.trim() : '';
  const showAction = normalizedUserId.length > 0 && normalizedUserId !== 'guest' && (!connected || Boolean(warning));

  const handleWorkspaceSso = React.useCallback(async () => {
    if (actionPending) {
      return;
    }

    setActionPending(true);
    try {
      await startCreatorHubGoogleSso({
        targetConnectionUserId: normalizedUserId,
      });
    } catch (error) {
      console.error('Could not start shared Google SSO from session badge:', error);
      setActionPending(false);
    }
  }, [actionPending, normalizedUserId]);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        minWidth: 0,
        borderRadius: 3,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        px: compact ? 0.95 : 1.1,
        py: compact ? 0.75 : 0.9,
        boxShadow: tone === 'creatorhub' ? '0 12px 24px rgba(15,23,42,0.04)' : '0 12px 28px rgba(15,23,42,0.18)',
      }}
    >
      <Stack spacing={0.7} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#4285F4', tone === 'creatorhub' ? 0.12 : 0.18),
              color: '#4285F4',
              flexShrink: 0,
            }}
          >
            {isLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <GoogleIcon sx={{ fontSize: 18 }} />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: compact ? '0.7rem' : '0.74rem', fontWeight: 800, color: styles.text, lineHeight: 1.2 }}>
              Google Workspace
            </Typography>
            <Typography sx={{ fontSize: compact ? '0.66rem' : '0.7rem', color: styles.subtle, lineHeight: 1.35 }} noWrap>
              {normalizedUserId === 'guest'
                ? 'Venter på innlogging'
                : isLoading
                  ? 'Sjekker Google-økt'
                  : connected
                    ? 'Innlogget og aktiv'
                    : 'Google-økt mangler'}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            label={connected ? 'Google-SSO aktiv' : 'Google-SSO mangler'}
            sx={{
              height: 22,
              fontWeight: 700,
              fontSize: compact ? '0.64rem' : undefined,
              bgcolor: connected ? styles.activeBg : styles.idleBg,
              color: connected ? styles.activeText : styles.idleText,
            }}
          />
          {email ? (
            <Chip
              size="small"
              label={email}
              variant="outlined"
              sx={{
                height: 22,
                fontSize: compact ? '0.64rem' : undefined,
                color: styles.text,
                borderColor: alpha(styles.text, tone === 'creatorhub' ? 0.14 : 0.18),
              }}
            />
          ) : null}
          {warning ? (
            <Chip
              size="small"
              icon={<WarningAmberRounded sx={{ fontSize: 14 }} />}
              label="Trenger oppmerksomhet"
              sx={{
                height: 22,
                fontSize: compact ? '0.64rem' : undefined,
                bgcolor: styles.idleBg,
                color: styles.idleText,
              }}
            />
          ) : null}
          {showAction ? (
            <Button
              size="small"
              variant={tone === 'creatorhub' ? 'contained' : 'outlined'}
              onClick={() => {
                void handleWorkspaceSso();
              }}
              sx={{
                minHeight: 22,
                px: 1.1,
                borderRadius: 999,
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'none',
                ...(tone === 'creatorhub'
                  ? {
                      bgcolor: '#2563eb',
                      color: '#fff',
                      '&:hover': {
                        bgcolor: '#1d4ed8',
                      },
                    }
                  : {
                      borderColor: alpha('#fbbf24', 0.35),
                      color: '#fde68a',
                      '&:hover': {
                        borderColor: alpha('#fbbf24', 0.5),
                        bgcolor: alpha('#fbbf24', 0.08),
                      },
                    }),
              }}
            >
              {actionPending ? 'Starter…' : connected ? 'Forny SSO' : 'Aktiver Google-SSO'}
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
