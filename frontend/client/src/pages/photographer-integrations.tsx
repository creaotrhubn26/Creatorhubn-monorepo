// Slice 9X.9.B — integrasjoner for fotograf.
// Per nå kun PowerOffice GO (faktura-push). Tidsflyt sitt mønster:
// fotograf limer inn per-tenant ClientKey fra GO sin Innstillinger →
// API-klienter, vi verifiserer mot token-endpoint, lagrer kryptert,
// og bruker den for /OutgoingInvoices ved faktura-trigger.

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Stack, Button, TextField, CircularProgress,
  Alert, Chip, Divider, IconButton,
} from '@mui/material';
import {
  ArrowBack, AccountBalance, CheckCircle, ErrorOutline, Link as LinkIcon,
  LinkOff,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

interface PoStatus {
  connected: boolean;
  serverConfigured: boolean;
  label?: string | null;
  status?: 'active' | 'invalid' | 'disabled';
  lastVerifiedAt?: string | null;
  lastUsedAt?: string | null;
  lastError?: string | null;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PhotographerIntegrations() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [clientKey, setClientKey] = useState('');
  const [label, setLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PoStatus>({
    queryKey: ['/api/photographer/integrations/poweroffice/status'],
    queryFn: () => apiRequest('/api/photographer/integrations/poweroffice/status'),
  });

  const connect = useMutation<unknown, Error, { clientKey: string; label: string }>({
    mutationFn: (body) => apiRequest('/api/photographer/integrations/poweroffice/connect', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: () => {
      setClientKey('');
      setLabel('');
      setFormError(null);
      qc.invalidateQueries({ queryKey: ['/api/photographer/integrations/poweroffice/status'] });
    },
    onError: (err: any) => {
      try {
        const parsed = JSON.parse(String(err?.message || '{}'));
        setFormError(parsed?.message || parsed?.error || 'Ukjent feil ved tilkobling');
      } catch {
        setFormError(String(err?.message || 'Ukjent feil'));
      }
    },
  });

  const disconnect = useMutation<unknown, Error, void>({
    mutationFn: () => apiRequest('/api/photographer/integrations/poweroffice', {
      method: 'DELETE',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/photographer/integrations/poweroffice/status'] });
    },
  });

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/dashboard')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Integrasjoner</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Koble Creatorhubn til regnskaps- og produktivitetssystemer du allerede bruker.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <AccountBalance fontSize="large" color="primary" />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">PowerOffice GO</Typography>
            <Typography variant="caption" color="text.secondary">
              Norsk regnskapssystem — faktura, kunder, MVA-rapportering
            </Typography>
          </Box>
          {isLoading ? (
            <CircularProgress size={20} />
          ) : data?.connected ? (
            <Chip
              icon={data.status === 'active' ? <CheckCircle /> : <ErrorOutline />}
              color={data.status === 'active' ? 'success' : 'warning'}
              label={data.status === 'active' ? 'Tilkoblet' : `Ugyldig (${data.status})`}
              size="small"
            />
          ) : (
            <Chip label="Ikke tilkoblet" size="small" variant="outlined" />
          )}
        </Stack>

        {!data?.serverConfigured && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <strong>Server-side keys mangler.</strong> Be admin sette
            <code> POWEROFFICE_APPLICATION_KEY</code> og
            <code> POWEROFFICE_SUBSCRIPTION_KEY</code> i Render →
            creatorhub-backend → Environment. Tilkobling vil feile inntil de er på plass.
          </Alert>
        )}

        {data?.connected ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.5}>
              {data.label && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Etikett</Typography>
                  <Typography variant="body2">{data.label}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Sist verifisert</Typography>
                <Typography variant="body2">{formatDateTime(data.lastVerifiedAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Sist brukt (faktura)</Typography>
                <Typography variant="body2">{formatDateTime(data.lastUsedAt)}</Typography>
              </Box>
              {data.lastError && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Siste feil: {data.lastError}
                </Alert>
              )}
            </Stack>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                startIcon={<LinkOff />}
                color="error"
                variant="outlined"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                Koble fra
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Hvordan finne ClientKey:
              <Box component="ol" sx={{ pl: 3, mt: 1, mb: 0 }}>
                <li>Logg inn på PowerOffice GO</li>
                <li>Innstillinger → API-klienter → Ny klient</li>
                <li>Velg "API-klient" og lim inn appens navn (f.eks. "Creatorhubn")</li>
                <li>Kopier ClientKey og lim inn under</li>
              </Box>
            </Alert>
            <Stack spacing={2}>
              <TextField
                label="ClientKey"
                fullWidth
                size="small"
                type="password"
                placeholder="Lim inn fra PowerOffice GO"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                autoComplete="off"
              />
              <TextField
                label="Etikett (valgfritt)"
                fullWidth
                size="small"
                placeholder="Stine Larsen Foto AS"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              {formError && <Alert severity="error">{formError}</Alert>}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  startIcon={<LinkIcon />}
                  variant="contained"
                  disabled={!clientKey.trim() || connect.isPending || !data?.serverConfigured}
                  onClick={() => connect.mutate({ clientKey: clientKey.trim(), label: label.trim() })}
                >
                  Koble til
                </Button>
              </Box>
            </Stack>
          </>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3, opacity: 0.6 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AccountBalance fontSize="large" />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Tripletex / Fiken</Typography>
            <Typography variant="caption" color="text.secondary">
              Kommer — backend-klienter finnes (`tripletex.ts`), wire-up gjenstår
            </Typography>
          </Box>
          <Chip label="Kommer" size="small" variant="outlined" />
        </Stack>
      </Paper>
    </Box>
  );
}
