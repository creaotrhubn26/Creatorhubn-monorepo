/**
 * Google Contacts Re-authorization
 * Upgrades OAuth scope to include Google People API access.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  ContactPage,
  Launch,
  Security,
  Warning,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface GoogleContactsReauthProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ScopeStatus {
  hasContactsAccess: boolean;
  needsReauth: boolean;
  missingScopes: string[];
}

interface ReauthData {
  authUrl: string | null;
  newFeatures: string[];
}

interface TestPeopleApiResponse {
  success: boolean;
}

function toScopeStatus(payload: unknown): ScopeStatus {
  const fallback: ScopeStatus = {
    hasContactsAccess: false,
    needsReauth: true,
    missingScopes: [],
  };

  if (typeof payload !== 'object' || payload === null) {
    return fallback;
  }

  const candidate = payload as {
    hasContactsAccess?: unknown;
    needsReauth?: unknown;
    missingScopes?: unknown;
  };

  return {
    hasContactsAccess: candidate.hasContactsAccess === true,
    needsReauth: candidate.needsReauth !== false,
    missingScopes: Array.isArray(candidate.missingScopes)
      ? candidate.missingScopes.filter((scope): scope is string => typeof scope === 'string')
      : [],
  };
}

function toReauthData(payload: unknown): ReauthData {
  if (typeof payload !== 'object' || payload === null) {
    return { authUrl: null, newFeatures: [] };
  }

  const candidate = payload as { authUrl?: unknown; newFeatures?: unknown };
  return {
    authUrl: typeof candidate.authUrl === 'string' ? candidate.authUrl : null,
    newFeatures: Array.isArray(candidate.newFeatures)
      ? candidate.newFeatures.filter((feature): feature is string => typeof feature === 'string')
      : [],
  };
}

export default function GoogleContactsReauth({
  open,
  onClose,
  onSuccess,
}: GoogleContactsReauthProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const theming = useTheming('photographer');

  const { data: scopeStatus, isLoading: loadingStatus, refetch: refetchScopeStatus } = useQuery({
    queryKey: ['/api/oauth/scope-status'],
    queryFn: async () => {
      const payload = await apiRequest('/api/oauth/scope-status');
      return toScopeStatus(payload);
    },
    enabled: open,
    retry: false,
  });

  const { data: reauthData, isLoading: loadingReauth } = useQuery({
    queryKey: ['/api/oauth/reauth-url'],
    queryFn: async () => {
      const payload = await apiRequest('/api/oauth/reauth-url');
      return toReauthData(payload);
    },
    enabled: open && Boolean(scopeStatus?.needsReauth),
    retry: false,
  });

  const testPeopleApiMutation = useMutation({
    mutationFn: async (): Promise<TestPeopleApiResponse> => {
      const payload = await apiRequest('/api/oauth/test-people-api');
      if (typeof payload === 'object' && payload !== null && 'success' in payload) {
        return { success: (payload as { success?: unknown }).success === true };
      }
      return { success: false };
    },
  });

  const canStartAuthorize = useMemo(() => {
    return Boolean(reauthData?.authUrl) && !isAuthorizing;
  }, [isAuthorizing, reauthData?.authUrl]);

  const handleAuthorize = async () => {
    if (!reauthData?.authUrl) {
      return;
    }

    setIsAuthorizing(true);
    window.open(reauthData.authUrl, '_blank', 'width=640,height=780');

    const startedAt = Date.now();
    const timeoutMs = 2 * 60 * 1000;

    const poll = async () => {
      const result = await testPeopleApiMutation.mutateAsync();
      if (result.success) {
        await refetchScopeStatus();
        setIsAuthorizing(false);
        onSuccess();
        onClose();
        return true;
      }
      return false;
    };

    const timerId = window.setInterval(() => {
      void (async () => {
        const done = await poll();
        const timedOut = Date.now() - startedAt > timeoutMs;
        if (done || timedOut) {
          window.clearInterval(timerId);
          setIsAuthorizing(false);
        }
      })();
    }, 2000);
  };

  const handleContinue = () => {
    onSuccess();
    onClose();
  };

  if (loadingStatus || loadingReauth) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography>Sjekker Google tilgangsstatus...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  const hasAccess = scopeStatus?.hasContactsAccess === true;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <ContactPage color="primary" />
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Google Kontakter Tilgang
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gi tilgang til Google People API for kontaktsynk.
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {hasAccess ? (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
            Google kontakter er allerede tilgjengelig.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
            Google kontakter krever utvidet OAuth-tilgang.
          </Alert>
        )}

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
          Hva blir aktivert:
        </Typography>

        <Stack spacing={1} sx={{ mb: 3 }}>
          <Chip icon={<ContactPage />} label="Sok i dine Google kontakter" variant="outlined" />
          <Chip icon={<ContactPage />} label="Opprett kontakter for samarbeidspartnere" variant="outlined" />
          <Chip icon={<Security />} label="Sikker OAuth 2.0-scope oppgradering" variant="outlined" />
        </Stack>

        {reauthData?.newFeatures.length ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Nye funksjoner:
            </Typography>
            <ul>
              {reauthData.newFeatures.map((feature) => (
                <li key={feature}>
                  <Typography variant="body2">{feature}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        ) : null}

        {scopeStatus?.missingScopes.length ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Manglende scope: {scopeStatus.missingScopes.join(', ')}
          </Alert>
        ) : null}

        <Alert severity="info">
          Du sendes til Google for godkjenning i nytt vindu. Etter godkjenning oppdateres status
          automatisk her.
        </Alert>

        {isAuthorizing ? (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Venter pa autorisering...
            </Typography>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        {!hasAccess ? (
          <Button
            variant="contained"
            startIcon={<Launch />}
            onClick={() => void handleAuthorize()}
            disabled={!canStartAuthorize}
          >
            {isAuthorizing ? 'Autoriserer...' : 'Gi tilgang til Google kontakter'}
          </Button>
        ) : (
          <Button variant="contained" startIcon={<CheckCircle />} onClick={handleContinue}>
            Fortsett
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

