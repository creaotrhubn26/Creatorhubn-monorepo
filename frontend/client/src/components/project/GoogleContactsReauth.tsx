/**
 * CreatorHub Norge - Google Contacts Re-authorization Component
 * Handles OAuth scope upgrades for Google People API access
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Chip,
  Stack,
} from '@mui/material';
import {
  ContactPage,
  Security,
  CheckCircle,
  Warning,
  Launch,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';";

interface GoogleContactsReauthProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void
}

export default function GoogleContactsReauth({ open, onClose, onSuccess }: GoogleContactsReauthProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent('GoogleContactsReauth', {
      type: 'google-service',
      capabilities: ['contacts-reauth', 'oauth-scope-upgrade','people-api-access'],
      dataFlow: {
        sources: ['scope-status', 'reauth-data','auth-status'],
        destinations: ['admin-dashboard','user-interface'],
        processors: ['oauth-processing','scope-processing']
    }
  });

    // Set up data flow nodes
    dataFlow.registerNode('scope-status', {
      type: 'source',
      data: scopeStatus,
      metadata: { component: 'GoogleContactsReauth', type: 'scope-status',}
  });

    dataFlow.registerNode('reauth-data', {
      type: 'source',
      data: reauthData,
      metadata: { component: 'GoogleContactsReauth', type: 'reauth-data',}
  });

    dataFlow.registerNode('auth-status', {
      type: 'source',
      data: { isAuthorizing, open },
      metadata: { component: 'GoogleContactsReauth', type: 'auth-status',}
  });

    // Listen for contacts reauth events
    communication.subscribe('google-contacts: reauth-required', () => {
      // Component is already open, just ensure it's visible
  });

    communication.subscribe('google-contacts: scope-upgrade', (data) => {
      if (data.scopes) {
        // Handle scope upgrade request
        handleAuthorize();
    }
  });

    return () => {
      componentRegistry.unregisterComponent('GoogleContactsReauth');
      dataFlow.unregisterNode('scope-status');
      dataFlow.unregisterNode('reauth-data');
      dataFlow.unregisterNode('auth-status');
  };
}, [scopeStatus, reauthData, isAuthorizing, open, componentRegistry, dataFlow, communication]);

  // Check current OAuth scope status
  const { data: scopeStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['/api/oauth/scope-status', ],
    enabled: open,
    queryFn: async () => {
      return apiRequest('/api/oauth/scope-status', {
        headers: auth
  });
  },
    retry: false
});

  // Get re-authorization URL
  const { data: reauthData, isLoading: loadingReauth } = useQuery({
    queryKey: ['/api/oauth/reauth-url', ],
    enabled: open && scopeStatus?.needsReauth,
    queryFn: async () => {
      return apiRequest('/api/oauth/reauth-url', {
        headers: auth
  });
  },
    retry: false
});

  // Test People API access
  const testPeopleApiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/oauth/test-people-api');
}
});

  const handleAuthorize = () => {
    if (reauthData?.authUrl) {
      setIsAuthorizing(true);
      // Open authorization URL in new window
      window.open(reauthData.authUrl'_blank', 'width=600,height=700');
      
      // Poll for success (simplified - in production use postMessage)
      const pollInterval = setInterval(() => {
        testPeopleApiMutation.mutate(undefined, {
          onSuccess: (result) => {
            if (result.success) {
              clearInterval(pollInterval);
              setIsAuthorizing(false);
              onSuccess();
              onClose();
        }
        },
          onError: () => {
            // Continue polling on error
      }
      });
    }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsAuthorizing(false);
    }, 120000);
  }
};

  if (loadingStatus || loadingReauth) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ py:  4, textAlign: 'center'}}>
            <LinearProgress sx={{ mb:  2 }} />
            <Typography>Sjekker Google tilgangsstatus...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
}

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
              Gi tilgang til Google kontakter for samarbeidspartnere
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {scopeStatus?.hasContactsAccess ? (
          <Alert severity="success" sx={{ mb:  2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {theming.getThemedIcon('checkCircle')}
              <Typography>
                Google kontakter er allerede tilgjengelig!
              </Typography>
            </Box>
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb:  2 }}>
            <Box display="flex" alignItems="center" gap={1}>
              {theming.getThemedIcon('warning')}
              <Typography>
                Google kontakter krever utvidet tilgang
              </Typography>
            </Box>
          </Alert>
        )}

        <Typography variant="subtitle1" gutterBottom sx={{ mt:  2 }}>
          Hva får du tilgang til: </Typography>

        <Stack spacing={1} sx={{ mb:  3 }}>
          <Chip 
            icon={<ContactPage />}
            label="Søk i dine Google kontakter"
            variant="outlined"
            color="primary"
          />
          <Chip 
            icon={<ContactPage />}
            label="Lagre nye samarbeidspartnere automatisk"
            variant="outlined"
            color="primary"
          />
          <Chip 
            icon={theming.getThemedIcon('security')}}
            label="Sikker OAuth 2.0 integrasjon"
            variant="outlined"
            color="primary"
          />
        </Stack>

        {reauthData?.newFeatures && (
          <Box sx={{ mb:  2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Nye funksjoner som blir tilgjengelige: </Typography>
            <ul>
              {reauthData.newFeatures.map((feature: string, index: number) => (
                <li key={index}>
                  <Typography variant="body2">{feature}</Typography>
                </li>
              ))}
            </ul>
          </Box>
        )}

        <Alert severity="info">
          <Typography variant="body2">
            📱 Du blir sendt til Google for å bekrefte tilgangene. 
            Dette er helt trygt og du kan tilbakekalle tilgang når som helst.
          </Typography>
        </Alert>

        {isAuthorizing && (
          <Box sx={{ mt:  2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Venter på autorisering... Du kan lukke Google-vinduet når du er ferdig.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Avbryt
        </Button>
        {!scopeStatus?.hasContactsAccess && (
          <Button variant="contained"
            onClick={handleAuthorize}
            disabled={!reauthData?.authUrl || isAuthorizing}
            startIcon={theming.getThemedIcon('launch')}
           sx={theming.getThemedButtonSx()}>
            {isAuthorizing ? 'Autoriserer...' : 'Gi tilgang til Google kontakter'}
          </Button>
        )}
        {scopeStatus?.hasContactsAccess && (
          <Button variant="contained"
            onClick={() => {
              onSuccess();
              onClose();
          }}
            startIcon={theming.getThemedIcon('checkCircle')}
          >
            Fortsett
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}