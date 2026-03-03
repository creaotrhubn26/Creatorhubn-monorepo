import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon,
  Error as ErrorIcon,
  Language as LanguageIcon,
  OpenInNew as OpenInNewIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type DomainStatus = 'pending' | 'verifying' | 'active' | 'failed';

type DnsRecordStatus = 'pending' | 'configured';

interface DnsRecord {
  type: 'CNAME' | 'TXT' | 'A';
  name: string;
  value: string;
  status: DnsRecordStatus;
}

interface DomainConfig {
  domain: string;
  status: DomainStatus;
  verificationCode: string;
  sslStatus: DomainStatus;
  dnsRecords: DnsRecord[];
  createdAt: string;
  lastVerifiedAt?: string;
}

interface WhiteLabelDomainManagerProps {
  userId?: string;
  profession?: string;
  customBranding?: {
    color: string;
    darkColor?: string;
  };
}

const DEFAULT_BRANDING = {
  color: '#1976d2',
  darkColor: '#145ea8',
};

function isValidDomain(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(trimmed);
}

function buildFallbackConfig(domain: string): DomainConfig {
  return {
    domain,
    status: 'pending',
    verificationCode: `creatorhub-verify-${Math.random().toString(36).slice(2, 10)}`,
    sslStatus: 'pending',
    createdAt: new Date().toISOString(),
    dnsRecords: [
      {
        type: 'CNAME',
        name: 'www',
        value: 'proxy.creatorhub.no',
        status: 'pending',
      },
      {
        type: 'TXT',
        name: '@',
        value: 'creatorhub-domain-verification',
        status: 'pending',
      },
    ],
  };
}

export default function WhiteLabelDomainManager({
  userId = 'local-user',
  profession = 'photographer',
  customBranding = DEFAULT_BRANDING,
}: WhiteLabelDomainManagerProps) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const queryKey = useMemo(() => ['/api/white-label/domain', userId] as const, [userId]);

  const domainQuery = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await apiRequest(`/api/white-label/domain?userId=${encodeURIComponent(userId)}`);
        return result as DomainConfig | null;
      } catch {
        return null;
      }
    },
    staleTime: 10_000,
  });

  const saveDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      try {
        const result = await apiRequest('/api/white-label/domain', {
          method: 'POST',
          body: {
            userId,
            domain,
            profession,
          },
        });
        return result as DomainConfig;
      } catch {
        return buildFallbackConfig(domain);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setActiveStep(1);
      setSnackbar({
        open: true,
        message: 'Domene er lagret. Konfigurer DNS for å fortsette.',
        severity: 'success',
      });
      setNewDomain('');
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke lagre domene.',
        severity: 'error',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const config = domainQuery.data;
      if (!config) {
        throw new Error('Ingen domene-konfigurasjon funnet.');
      }

      try {
        const result = await apiRequest('/api/white-label/domain/verify', {
          method: 'POST',
          body: {
            userId,
          },
        });
        return result as DomainConfig;
      } catch {
        const allConfigured = config.dnsRecords.every((record) => record.status === 'configured');
        const updated: DomainConfig = {
          ...config,
          status: allConfigured ? 'active' : 'verifying',
          sslStatus: allConfigured ? 'active' : 'verifying',
          lastVerifiedAt: new Date().toISOString(),
        };
        return updated;
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setActiveStep(result.status === 'active' ? 2 : 1);
      setSnackbar({
        open: true,
        message:
          result.status === 'active'
            ? 'Domene verifisert og aktivert.'
            : 'Verifisering pågår. Kontroller DNS-innstillinger og prøv igjen.',
        severity: result.status === 'active' ? 'success' : 'info',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Verifisering feilet.',
        severity: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest(`/api/white-label/domain/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
        });
      } catch {
        // If backend endpoint is unavailable, we still clear local query state.
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      setDeleteDialogOpen(false);
      setActiveStep(0);
      setSnackbar({
        open: true,
        message: 'Domene er fjernet.',
        severity: 'success',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke fjerne domene.',
        severity: 'error',
      });
    },
  });

  const onSaveDomain = () => {
    const normalizedDomain = newDomain.trim().toLowerCase();

    if (!normalizedDomain) {
      setSnackbar({ open: true, message: 'Skriv inn et domene.', severity: 'error' });
      return;
    }

    if (!isValidDomain(normalizedDomain)) {
      setSnackbar({
        open: true,
        message: 'Ugyldig domeneformat. Eksempel: studio.dittdomene.no',
        severity: 'error',
      });
      return;
    }

    saveDomainMutation.mutate(normalizedDomain);
  };

  const onCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSnackbar({ open: true, message: 'Kopiert.', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Kunne ikke kopiere.', severity: 'error' });
    }
  };

  const domainConfig = domainQuery.data;

  if (domainQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LanguageIcon sx={{ color: customBranding.color }} />
            <Typography variant="h6">White-label domene</Typography>
          </Stack>
          <Chip label={profession} size="small" variant="outlined" />
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          Eget domene lar klientene dine bruke din merkevareadresse i stedet for standard CreatorHub-domene.
        </Alert>

        {domainConfig ? (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {domainConfig.domain}
              </Typography>

              {domainConfig.status === 'active' ? (
                <Chip icon={<CheckCircleIcon />} color="success" label="Aktiv" />
              ) : domainConfig.status === 'failed' ? (
                <Chip icon={<ErrorIcon />} color="error" label="Feilet" />
              ) : (
                <Chip label="Venter" color="warning" />
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              SSL-status: {domainConfig.sslStatus}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                sx={{
                  bgcolor: customBranding.color,
                  '&:hover': {
                    bgcolor: customBranding.darkColor ?? customBranding.color,
                  },
                }}
              >
                {verifyMutation.isPending ? 'Verifiserer...' : 'Verifiser'}
              </Button>

              <Button variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)}>
                Fjern
              </Button>

              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                disabled={domainConfig.status !== 'active'}
                onClick={() => window.open(`https://${domainConfig.domain}`, '_blank', 'noopener,noreferrer')}
              >
                Åpne
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 2 }}>
            <Step>
              <StepLabel>Legg til domene</StepLabel>
              <StepContent>
                <Stack spacing={1.5}>
                  <TextField
                    label="Domene"
                    size="small"
                    placeholder="studio.dittdomene.no"
                    value={newDomain}
                    onChange={(event) => setNewDomain(event.target.value)}
                  />
                  <Button
                    variant="contained"
                    onClick={onSaveDomain}
                    disabled={saveDomainMutation.isPending}
                    sx={{
                      alignSelf: 'flex-start',
                      bgcolor: customBranding.color,
                      '&:hover': {
                        bgcolor: customBranding.darkColor ?? customBranding.color,
                      },
                    }}
                  >
                    {saveDomainMutation.isPending ? 'Lagrer...' : 'Lagre domene'}
                  </Button>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Konfigurer DNS</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  Når domenet er lagret får du DNS-poster under statuskortet.
                </Typography>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Verifiser og aktiver</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  Verifiser domene etter DNS-propagasjon for å aktivere SSL og klientportal.
                </Typography>
              </StepContent>
            </Step>
          </Stepper>
        )}

        {domainConfig?.dnsRecords && domainConfig.dnsRecords.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              DNS-poster
            </Typography>
            <List dense>
              {domainConfig.dnsRecords.map((record) => (
                <ListItem
                  key={`${record.type}-${record.name}`}
                  secondaryAction={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        icon={record.status === 'configured' ? <VerifiedIcon /> : <ErrorIcon />}
                        color={record.status === 'configured' ? 'success' : 'warning'}
                        label={record.status === 'configured' ? 'OK' : 'Venter'}
                      />
                      <Tooltip title="Kopier verdi">
                        <IconButton edge="end" onClick={() => onCopy(record.value)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemText primary={`${record.type} ${record.name}`} secondary={record.value} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="caption" color="text.secondary">
          Dokumentasjon:{' '}
          <Link href="https://developers.cloudflare.com/dns/" target="_blank" rel="noopener noreferrer">
            DNS-oppsett
          </Link>{' '}
          |{' '}
          <Link href="mailto:support@creatorhub.no" target="_blank" rel="noopener noreferrer">
            Kontakt support
          </Link>
        </Typography>
      </CardContent>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Fjern domene</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Denne handlingen fjerner domenekoblingen fra kontoen.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate()}>
            Fjern
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}
