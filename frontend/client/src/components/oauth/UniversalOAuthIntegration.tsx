import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
	import { useAuth } from '@/hooks/useAuth';
	import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
	import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Collapse,
  IconButton,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CloudSync as CloudSyncIcon,
  Security as SecurityIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface VendorStatus {
  vendor: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  accountInfo?: {
    email?: string;
    accountType?: string;
    totalPlugins?: number;
};
  error?: string;
}

interface UniversalOAuthIntegrationProps {
  userProfession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  compact?: boolean;
  showAutoConnect?: boolean;
  showManualConnect?: boolean;
  // Integration props for universal workflow connectivity
  onSettingsUpdate?: (settings: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export default function UniversalOAuthIntegration({
  userProfession,
  compact = false,
  showAutoConnect = true,
  showManualConnect = true,
  onSettingsUpdate,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}: UniversalOAuthIntegrationProps) {
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorCredentials, setVendorCredentials] = useState({ email: ',', password: ', ',});
  const [showDetails, setShowDetails] = useState(false);

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Check user invite status first
  const { data: inviteStatus, isLoading: inviteLoading } = useQuery({
    queryKey: ['/api/user/invite-status', ],
    queryFn: async () => {
      return apiRequest('/api/user/invite-status', {
        headers: auth
  });
  },
    retry: false
});

  // Only fetch vendors if user has valid invite
  const { data: supportedVendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['/api/plugins/supported-vendors', ],
    enabled: inviteStatus?.hasValidInvite === true,
    queryFn: async () => {
      return apiRequest('/api/plugins/supported-vendors', {
        headers: auth
  });
  },
});

  // Fetch user's connected accounts (only if invited)
  const { data: userPlugins = [], isLoading: pluginsLoading } = useQuery({
    queryKey: ['/api/user/plugins', ],
    enabled: inviteStatus?.hasValidInvite === true,
    queryFn: async () => {
      return apiRequest('/api/user/plugins', {
        headers: auth
  });
  },
});

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent('UniversalOAuthIntegration', {
      type: 'oauth-service',
	      capabilities: ['oauth-integration','vendor-connection','account-management'],
	      dataFlow: {
	        sources: ['invite-status','supported-vendors','user-plugins'],
	        destinations: ['admin-dashboard','user-interface'],
	        processors: ['oauth-processing','vendor-processing'],
	      },
	    });

    // Set up data flow nodes
    dataFlow.registerNode('invite-status', {
      type: 'source',
      data: inviteStatus,
      metadata: { component: 'UniversalOAuthIntegration', type: 'invite-status' }
  });

    dataFlow.registerNode('supported-vendors', {
      type: 'source',
      data: supportedVendors,
      metadata: { component: 'UniversalOAuthIntegration', type: 'supported-vendors' }
  });

    dataFlow.registerNode('user-plugins', {
      type: 'source',
      data: userPlugins,
      metadata: { component: 'UniversalOAuthIntegration', type: 'user-plugins' }
  });

    // Listen for OAuth events
    communication.subscribe('oauth: auto-connect', () => {
      autoConnectMutation.mutate();
  });

    communication.subscribe('oauth: manual-connect', (data) => {
      if (data.vendor) {
        setSelectedVendor(data.vendor);
        setConnectDialogOpen(true);
    }
  });

    communication.subscribe('oauth: disconnect', (data) => {
      if (data.pluginId) {
        handleDisconnect(data.pluginId);
    }
  });

    return () => {
      componentRegistry.unregisterComponent('UniversalOAuthIntegration');
      dataFlow.unregisterNode('invite-status');
      dataFlow.unregisterNode('supported-vendors');
      dataFlow.unregisterNode('user-plugins');
  };
}, [inviteStatus, supportedVendors, userPlugins, componentRegistry, dataFlow, communication, autoConnectMutation]);

  // Auto-connect mutation (requires invite)
  const autoConnectMutation = useMutation({
    mutationFn: async () => {
      // Check invite status first
      if (!inviteStatus?.hasValidInvite) {
        throw new Error('Du må ha en gyldig invitasjon for å bruke OAuth-integrasjoner');
  }
      
      console.log('🔐 Starter universell OAuth auto-tilkobling for invitert bruker..., ');
      const response = await fetch('/api/plugins/auto-connect-oauth', {
        headers: {
	          ...auth, 'Content-Type' : 'application/json',
	        },
	        method: 'POST',
	      });
      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Tilgang nektet: Du må ha en gyldig invitasjon for å bruke OAuth-funksjoner');
    }
        throw new Error(result.error || 'OAuth-tilkobling feilet');
    }
      
      console.log('✅ Auto-tilkobling fullført for invitert bruker: ', result.message);
      return result;
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/plugins', ],});
  }
});

  // Manual connect mutation (requires invite)
  const connectVendorMutation = useMutation({
    mutationFn: async (data: { vendor: string; email: string; password: string }) => {
      // Check invite status first
      if (!inviteStatus?.hasValidInvite) {
        throw new Error('Du må ha en gyldig invitasjon for å bruke OAuth-integrasjoner');
    }
      
      console.log(`🔐 Forsøker manuell tilkobling til ${data.vendor} for invitert bruker...`);
      const response = await fetch('/api/user/vendor-accounts/connect', {
        headers: {
	          ...auth, 'Content-Type' : 'application/json',
	        },
	        method: 'POST',
	        body: JSON.stringify(data),
	      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Tilgang nektet: Du må ha en gyldig invitasjon for å bruke OAuth-funksjoner');
    }
        throw new Error(result.error || `Tilkobling til ${data.vendor} feilet, `);
    }
      
      console.log(`✅ Vellykket tilkobling til ${data.vendor} for invitert bruker`);
      return result;
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/plugins', ],});
      setConnectDialogOpen(false);
      setVendorCredentials({ email: ', ', password: ',',});
  }
});

  // Get vendor status
  const getVendorStatus = (vendorName: string): VendorStatus => {
    const connectedPlugin = userPlugins.find((p: any) => 
      p.vendor?.toLowerCase() === vendorName.toLowerCase()
    );

    if (connectedPlugin) {
      return {
        vendor: vendorName,
        status: 'connected',
        lastSync: connectedPlugin.lastSync,
        accountInfo: connectedPlugin.accountInfo
  };
  }

    return {
      vendor: vendorName,
      status: 'disconnected'
};
};

  const connectedCount = supportedVendors.filter((vendor: any) => 
    getVendorStatus(vendor.name).status === 'connected'
  ).length;

  // Show invite requirement message if no valid invite
  if (!inviteStatus?.hasValidInvite) {
    return (
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(2, 5, 5,193,7,0.1) 0%, rgba(2, 5, 5,152,0,0.1) 100%)',
        border: '1px solid rgba(25,193,7,0.2)'
    ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <SecurityIcon sx={{ color: '#FF8F00', fontSize: 32}} />
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
                OAuth Integrasjoner krever invitasjon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                For å få tilgang til profesjonelle plugin-integrasjoner må du først ha en gyldig invitasjon til CreatorHub Norge
              </Typography>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb:  2 }}>
            <Typography variant="body2">
              <strong>Plugin-integrasjoner inkluderer: </strong><br/>
              • Native Instruments, iZotope, Splice Sounds<br/>
              • FabFilter, Waves, Output, Celemony<br/>
              • Soundtoys, XLN Audio, Steinberg<br/>
              • Automatisk plugin-synkronisering og lisenshåndtering
            </Typography>
          </Alert>

          <Button variant="contained"
            onClick={() => window.location.href = '/invite-request'}
            sx={{ 
              background: 'linear-gradient(135deg, #FF8F00 0%, #F57C00 100%)', '&:hover': { background: 'linear-gradient(135deg, #FFB74D 0%, #FF8F00 100%)' }
          }}
            startIcon={<LinkIcon />}
          >
            Be om tilgang til plattformen
          </Button>

          <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
            Invite-status: {inviteStatus?.status || 'Ikke invitert'}
          </Typography>
        </CardContent>
      </Card>
    );
}

  const handleManualConnect = () => {
    if (!selectedVendor || !vendorCredentials.email || !vendorCredentials.password) {
      return;
  }
    
    connectVendorMutation.mutate({
      vendor: selectedVendor,
      email: vendorCredentials.email,
      password: vendorCredentials.password
});
};

  if (compact) {
    return (
      <Card sx={{ 
        background: 'linear-gradient(135deg, rgba(2, 5, 5,193,7,0.1) 0%, rgba(2, 5, 5,152,0,0.1) 100%)',
        border: '1px solid rgba(25,193,7,0.2)'
    ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <CloudSyncIcon sx={{ color: '#FF8F00' }} />
              <Typography variant="body2" fontWeight={600}>
                OAuth Integrasjoner
              </Typography>
              <Chip 
                label={`${connectedCount}/${supportedVendors.length}`}
                size="small"
                color={connectedCount === supportedVendors.length ? 'success' : 'warning'}
              />
            </Box>
            <IconButton 
              size="small" 
              onClick={() => setShowDetails(!showDetails)}
              sx={{ color: '#FF8F00' }}
            >
              <ExpandMoreIcon sx={{ 
                transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg, )',
                transition: 'transform 0.3s'
          }} />
            </IconButton>
          </Box>
          
          <Collapse in={showDetails}>
            <Box sx={{ mt:  2 }}>
              {showAutoConnect && (
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => autoConnectMutation.mutate()}
                  disabled={autoConnectMutation.isPending}
                  sx={{ 
                    mb:  1,
                    color: '#4CAF50',
                    borderColor: '#4CAF50','&:hover': { backgroundColor: 'rgba(6, 175, 80, 0.1)' }
                }}
                  startIcon={autoConnectMutation.isPending ? <RefreshIcon /> : <LinkIcon />}
                >
                  {autoConnectMutation.isPending ? 'Kobler til...' : 'Auto-koble alle'}
                </Button>
              )}
              
              <Grid container spacing={1}>
                {supportedVendors.slice(0, 6).map((vendor: any) => {
                  const status = getVendorStatus(vendor.name);
                  return (
                    <Grid size={{ xs: 4 }} key={vendor.name}>
                      <Chip
                        size="small"
                        label={vendor.name}
                        icon={status.status === 'connected' ? <CheckIcon /> : <WarningIcon />}
                        color={status.status === 'connected' ? 'success' : 'default'}
                        variant={status.status === 'connected' ? 'filled' : 'outlined'}
                      />
                    </Grid>
                  );
              })}
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    );
}

  return (
    <Card sx={{ 
      background: 'linear-gradient(135deg, rgba(2, 5, 5,193,7,0.1) 0%, rgba(2, 5, 5,152,0,0.1) 100%)',
      border: '1px solid rgba(25,193,7,0.2)'
  ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CloudSyncIcon sx={{ color: '#FF8F00', fontSize: 32}} />
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
              Plugin OAuth Integrasjoner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Koble til dine profesjonelle plugin-leverandører for automatisk synkronisering
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <Chip 
              label={`${connectedCount}/${supportedVendors.length} tilkoblet`}
              color={connectedCount === supportedVendors.length ? 'success' : 'warning'}
              icon={<SecurityIcon />}
            />
          </Box>
        </Box>

        {/* Quick Actions */}
        {(showAutoConnect || showManualConnect) && (
          <Box sx={{ mb:  3 }}>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Hurtighandlinger
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {showAutoConnect && (
                <Button variant="contained"
                  onClick={() => autoConnectMutation.mutate()}
                  disabled={autoConnectMutation.isPending}
                  sx={{ 
                    background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)','&:hover': { background: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 100%)' }
                }}
                  startIcon={autoConnectMutation.isPending ? <RefreshIcon /> : <LinkIcon />}
                >
                  {autoConnectMutation.isPending ? 'Kobler til alle...' : 'Auto-koble alle leverandører'}
                </Button>
              )}
              
              {showManualConnect && (
                <Button
                  variant="outlined"
                  onClick={() => setConnectDialogOpen(true)}
                  sx={{ 
                    color: '#FF8F00',
                    borderColor: '#FF8F00',
                    '&:hover': { backgroundColor: 'rgba(255, 143, 0, 0.1)' }
                  }}
                  startIcon={<SettingsIcon />}
                >
                  Manuell tilkobling
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* Vendor Status Grid */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" fontWeight={600}>
              Støttede leverandører ({supportedVendors.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {supportedVendors.map((vendor: any) => {
                const status = getVendorStatus(vendor.name);
                return (
                  <Grid size={{ xs: 12 }} md={6} key={vendor.name}>
                    <Box sx={{ 
                      p: 2, border: '1px solid rgba(25,193,7,0.2)',
                      borderRadius:  1,
                      backgroundColor: status.status === 'connected' 
                        ? 'rgba(6, 175, 80, 0.05)' 
                        : 'rgba(2, 5, 5, 1520.05)'
                  }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {vendor.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={status.status === 'connected' ? 'Tilkoblet' : 'Ikke tilkoblet'}
                          color={status.status === 'connected' ? 'success' : 'default'}
                          icon={status.status === 'connected' ? <CheckIcon /> : <WarningIcon />}
                        />
                      </Box>
                      
                      {status.status === 'connected' && status.accountInfo && (
                        <Box sx={{ mt:  1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {status.accountInfo.email}
                          </Typography>
                          {status.accountInfo.totalPlugins && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {status.accountInfo.totalPlugins} plugins tilgjengelig
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                );
            })}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Progress indicator */}
        {(autoConnectMutation.isPending || connectVendorMutation.isPending) && (
          <Box sx={{ mt:  2 }}>
            <LinearProgress sx={{ 
              backgroundColor: 'rgba(25,193,7,0.2)', '& .MuiLinearProgress-bar': { backgroundColor: '#FF8F00' }
          }} />
          </Box>
        )}

        {/* Error display */}
        {(autoConnectMutation.error || connectVendorMutation.error) && (
          <Alert severity="error" sx={{ mt:  2 }}>
            {autoConnectMutation.error?.message || connectVendorMutation.error?.message}
          </Alert>
        )}
      </CardContent>

      {/* Manual Connection Dialog */}
      <Dialog 
        open={connectDialogOpen}
        onClose={() => setConnectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manuell leverandørtilkobling</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Velg leverandør"
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
            >
              <option value="">Velg en leverandør</option>
              {supportedVendors.map((vendor: any) => (
                <option key={vendor.name} value={vendor.name}>
                  {vendor.name}
                </option>
              ))}
            </TextField>

            <TextField
              label="E-post"
              type="email"
              value={vendorCredentials.email}
              onChange={(e) => setVendorCredentials({ ...vendorCredentials, email: e.target.value })}
              fullWidth
            />

            <TextField
              label="Passord"
              type="password"
              value={vendorCredentials.password}
              onChange={(e) => setVendorCredentials({ ...vendorCredentials, password: e.target.value })}
              fullWidth
            />

            <Alert severity="info">
              Innloggingsinformasjon lagres kryptert og brukes kun for automatisk synkronisering av plugins og lisenser.
            </Alert>

            <Alert severity="warning">
              <strong>Test-kontoer for å teste feilhåndtering: </strong><br/>
              • <code>test@invalid.com</code> - Feil passord<br/>
              • <code>locked@example.com</code> - Låst konto<br/>
              • <code>maintenance@example.com</code> - Server vedlikehold<br/>
              • <code>ratelimit@example.com</code> - For mange forsøk<br/>
              • <code>success@example.com</code> - Vellykket tilkobling
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleManualConnect}
            disabled={!selectedVendor || !vendorCredentials.email || !vendorCredentials.password || connectVendorMutation.isPending}
            variant="contained"
            sx={{ 
              background: 'linear-gradient(135deg, #FF8F00 0%, #F57C00 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #FFB74D 0%, #FF8F00 100%)' },
              ...theming.getThemedButtonSx()
            }}>
            {connectVendorMutation.isPending ? 'Kobler til...' : 'Koble til'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}