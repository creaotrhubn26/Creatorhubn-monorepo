import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Google as GoogleIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Workspaces as WorkspacesIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface GoogleWorkspaceStatus {
  hasWorkspace: boolean;
  isVerified: boolean;
  domain?: string;
  plan?: string;
  users?: number;
  lastChecked: string;
  features: {
    gmail: boolean;
    drive: boolean;
    calendar: boolean;
    meet: boolean;
    docs: boolean;
    sheets: boolean;
  };
}

interface GoogleWorkspaceIntegrationProps {
  onWorkspaceDetected: (status: GoogleWorkspaceStatus) => void;
  onWorkspaceCreated: () => void;
  onSkip: () => void;
  profession: string;
}

const PROFESSION_BENEFITS: Record<string, string[]> = {
  photographer: [
    'Automatisk galleri og mappeflyt i Google Drive',
    'Kundemoter direkte i Google Calendar + Meet',
    'Kontrakter og leveranser i delt dokumentstruktur',
  ],
  videographer: [
    'Prosjektfiler og proxyflyt organisert i Drive',
    'Moteplan med team i Calendar',
    'Deling av review-lenker til kunder med Docs/Sheets',
  ],
  music_producer: [
    'Session- og stemmefiler i strukturert Drive-oppsett',
    'Artistmoter via Meet med kalenderinvitasjoner',
    'Royalty- og leveransesporing i Sheets',
  ],
  vendor: [
    'Ordre- og lagerark i Sheets',
    'Kundeoppfolging med domene-epost',
    'Mote- og leveringskalender for teamet',
  ],
};

const GENERIC_BENEFITS = [
  'Ett samlet identitetssystem for team og kunder',
  'Sikker filhåndtering med tilgangsstyring',
  'Direkte kobling mot CreatorHub arbeidsflyt',
];

function normalizeStatus(input: unknown): GoogleWorkspaceStatus {
  if (typeof input !== 'object' || input === null) {
    return {
      hasWorkspace: false,
      isVerified: false,
      lastChecked: new Date().toISOString(),
      features: {
        gmail: false,
        drive: false,
        calendar: false,
        meet: false,
        docs: false,
        sheets: false,
      },
    };
  }

  const raw = input as Partial<GoogleWorkspaceStatus>;

  return {
    hasWorkspace: raw.hasWorkspace === true,
    isVerified: raw.isVerified === true,
    domain: raw.domain,
    plan: raw.plan,
    users: typeof raw.users === 'number' ? raw.users : undefined,
    lastChecked: typeof raw.lastChecked === 'string' ? raw.lastChecked : new Date().toISOString(),
    features: {
      gmail: raw.features?.gmail === true,
      drive: raw.features?.drive === true,
      calendar: raw.features?.calendar === true,
      meet: raw.features?.meet === true,
      docs: raw.features?.docs === true,
      sheets: raw.features?.sheets === true,
    },
  };
}

export default function GoogleWorkspaceIntegration({
  onWorkspaceDetected,
  onWorkspaceCreated,
  onSkip,
  profession,
}: GoogleWorkspaceIntegrationProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['/api/google-workspace/check-status', profession],
    queryFn: async () => {
      try {
        const result = await apiRequest('/api/google-workspace/check-status');
        return normalizeStatus(result);
      } catch {
        return normalizeStatus(null);
      }
    },
    refetchOnWindowFocus: false,
  });

  const benefits = useMemo(
    () => PROFESSION_BENEFITS[profession] ?? GENERIC_BENEFITS,
    [profession],
  );

  useEffect(() => {
    if (workspaceQuery.data?.hasWorkspace) {
      onWorkspaceDetected(workspaceQuery.data);
    }
  }, [onWorkspaceDetected, workspaceQuery.data]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
      }
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const startPollingAfterSignup = () => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
    }
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
    }

    setPolling(true);

    pollIntervalRef.current = window.setInterval(async () => {
      const result = await workspaceQuery.refetch();
      if (result.data?.hasWorkspace) {
        setPolling(false);
        onWorkspaceCreated();
        if (pollIntervalRef.current !== null) {
          window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 20_000);

    pollTimeoutRef.current = window.setTimeout(() => {
      setPolling(false);
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }, 8 * 60 * 1000);
  };

  const beginWorkspaceCreation = () => {
    window.open('https://workspace.google.com/signup/business/starter', '_blank', 'noopener,noreferrer');
    setCreateDialogOpen(false);
    startPollingAfterSignup();
  };

  if (workspaceQuery.isLoading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6">Sjekker Google Workspace</Typography>
        <Typography variant="body2" color="text.secondary">
          Henter status for kontoen din.
        </Typography>
      </Box>
    );
  }

  const status = workspaceQuery.data;

  if (status?.hasWorkspace) {
    return (
      <Box>
        <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'success.main' }}>
            <CheckCircleIcon fontSize="large" />
          </Avatar>
          <Typography variant="h5" fontWeight={700} color="success.main">
            Google Workspace er klart
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Domene: {status.domain ?? 'ukjent'}
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Aktivert funksjonalitet
            </Typography>

            <Grid container spacing={1.5}>
              {Object.entries(status.features).map(([key, enabled]) => (
                <Grid item xs={6} md={4} key={key}>
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircleIcon color={enabled ? 'success' : 'disabled'} fontSize="small" />
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {key}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => workspaceQuery.refetch()}>
                Oppdater status
              </Button>
              <Button variant="contained" onClick={onWorkspaceCreated}>
                Fortsett onboarding
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main' }}>
          <GoogleIcon fontSize="large" />
        </Avatar>
        <Typography variant="h5" fontWeight={700}>
          Aktiver Google Workspace
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Logg inn med Google én gang for å få en komplett arbeidsflyt med e-post, kalender, filer og møteintegrasjon direkte i CreatorHub.
        </Typography>
      </Stack>

      {polling && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Vi sjekker automatisk om kontoen din er opprettet. Du kan fortsette når status er oppdatert.
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
            Fordeler for {profession}
          </Typography>
          <List dense>
            {benefits.map((benefit) => (
              <ListItem key={benefit}>
                <ListItemIcon>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={benefit} />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={() => setCreateDialogOpen(true)}>
          Opprett Workspace
        </Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => workspaceQuery.refetch()}>
          Sjekk igjen
        </Button>
        <Button variant="text" onClick={onSkip}>
          Hopp over
        </Button>
      </Stack>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <WorkspacesIcon />
            <Typography variant="h6">Opprett Google Workspace</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Du sendes til Googles registreringsside i ny fane. Etter opprettelse fortsetter denne siden automatisk med
            statuskontroll.
          </Typography>
          <Alert severity="info">CreatorHub starter automatisk polling i opptil 8 minutter etter at du åpner registreringen.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={beginWorkspaceCreation} startIcon={<OpenInNewIcon />}>
            Gå til Google
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
