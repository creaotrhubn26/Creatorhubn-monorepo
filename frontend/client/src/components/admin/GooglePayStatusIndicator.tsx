/**
 * CreatorHub Norge - Google Pay Status Indicator
 * Real-time Google Pay connection status for admin dashboard
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Collapse,
  Button,
  Chip,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  CardMembership as MembershipIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Google as GoogleIcon,
  CreditCard as CreditCardIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { googlePayService } from '@/services/GooglePayService';
import { useToast } from '@/hooks/use-toast';
import { mockFetch } from '@/api/mockGooglePayApi';
import { useDemoMode, useDemoModeApi } from '@/contexts/DemoModeContext';
import { mockGooglePayConfiguration, mockGooglePayProducts, mockPaymentStatistics } from '@/api/mockGooglePayApi';
import { adminTokens } from './design-system';

interface GooglePayStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export default function GooglePayStatusIndicator({ 
  compact = false, 
  showDetails = false,
  className 
}: GooglePayStatusIndicatorProps) {
  const { auth } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [isGooglePayAvailable, setIsGooglePayAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check Google Pay availability
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await googlePayService.isGooglePayAvailable();
        setIsGooglePayAvailable(available);
        setIsInitialized(true);
        setLastChecked(new Date());
    } catch (error) {
        console.error('Error checking Google Pay availability:', error);
        setIsInitialized(true);
    }
  };

    checkAvailability();
    
    // Check every 30 seconds
    const interval = setInterval(checkAvailability, 30000);
    return () => clearInterval(interval);
}, []);

  // Fetch Google Pay configuration with demo mode support
  const { data: configData, isLoading: configLoading, refetch: refetchConfig, error: configError } = useDemoModeApi(
    ['/api/google-pay/configuration'],
    async () => {
      const authHeader = await auth.getAuthHeader();
      const response = await mockFetch('/api/google-pay/configuration', {
        headers: {
            ...authHeader,
            'Content-Type': 'application/json',
      },
    });
      
      // Verify authentication status
      if (response.status === 401) {
        throw new Error('Authentication required - please log in');
    }
      if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
    }
      if (!response.ok) {
        throw new Error(`Configuration fetch failed: ${response.status} ${response.statusText}`);
    }
      
      return response.json();
  },
    mockGooglePayConfiguration,
    {
      enabled: !!auth,
      refetchInterval: 60000, // Refetch every minute
      retry: (failureCount: number, error: any) => {
        // Don't retry on authentication errors
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
      }
        return failureCount < 3;
    },
  }
  );

  // Fetch Google Pay products with demo mode support
  const { data: productsData, isLoading: productsLoading, error: productsError } = useDemoModeApi(
    ['/api/google-pay/products'],
    async () => {
      const authHeader = await auth.getAuthHeader();
      const response = await mockFetch('/api/google-pay/products', {
        headers: {
            ...authHeader,
            'Content-Type': 'application/json',
      },
    });
      
      // Verify authentication status
      if (response.status === 401) {
        throw new Error('Authentication required - please log in');
    }
      if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
    }
      if (!response.ok) {
        throw new Error(`Products fetch failed: ${response.status} ${response.statusText}`);
    }
      
      return response.json();
  },
    mockGooglePayProducts,
    {
      enabled: !!auth,
      refetchInterval: 60000, // Refetch every minute
      retry: (failureCount: number, error: any) => {
        // Don't retry on authentication errors
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
      }
        return failureCount < 3;
    },
  }
  );

  // Fetch payment statistics with demo mode support
  const { data: statsData, isLoading: statsLoading, error: statsError } = useDemoModeApi(
    ['/api/google-pay/statistics'],
    async () => {
      const authHeader = await auth.getAuthHeader();
      const response = await mockFetch('/api/google-pay/statistics', {
        headers: {
            ...authHeader,
            'Content-Type': 'application/json',
      },
    });
      
      // Verify authentication status
      if (response.status === 401) {
        throw new Error('Authentication required - please log in');
    }
      if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
    }
      if (!response.ok) {
        throw new Error(`Statistics fetch failed: ${response.status} ${response.statusText}`);
    }
      
      return response.json();
  },
    mockPaymentStatistics,
    {
      enabled: !!auth,
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: (failureCount: number, error: any) => {
        // Don't retry on authentication errors
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
      }
        return failureCount < 3;
    },
  }
  );

  const handleRefresh = async () => {
    try {
      const available = await googlePayService.isGooglePayAvailable();
      setIsGooglePayAvailable(available);
      setLastChecked(new Date());
      
      await refetchConfig();
      
      toast({
        title: 'Google Pay status oppdatert',
        description: available 
          ? 'Google Pay er tilgjengelig og fungerer'
          : 'Google Pay er ikke tilgjengelig',
        variant: available ? 'default' : 'destructive',
    });
  } catch (error) {
      console.error('Error refreshing Google Pay status: ', error);
      toast({
        title: 'Feil ved oppdatering',
        description: isDemoMode 
          ? 'Demo-modus: Mock data oppdatert'
          : 'Server ikke tilgjengelig - sjekk at server kjører på port 5050',
        variant: 'destructive',
    });
  }
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'ready':
      case 'configured':
        return <CheckIcon sx={{ color: adminTokens.color.success }} />;
      case 'warning':
      case 'pending':
        return <WarningIcon sx={{ color: '#ff9800' }} />;
      case 'error':
      case 'failed':
        return <ErrorIcon sx={{ color: adminTokens.color.error }} />;
      default: return <WarningIcon sx={{ color: '#9e9e9e' }} />;
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'ready':
      case 'configured':
        return 'success';
      case 'warning':
      case 'pending':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'default';
  }
};

  const getOverallStatus = () => {
    if (!isInitialized) return 'loading';
    
    // Check for authentication errors first
    if (configError?.message?.includes('Authentication required') || 
        productsError?.message?.includes('Authentication required') ||
        statsError?.message?.includes('Authentication required')) {
      return 'error';
  }
    
    if (configError?.message?.includes('Access denied') || 
        productsError?.message?.includes('Access denied') ||
        statsError?.message?.includes('Access denied')) {
      return 'error';
  }
    
    if (!isGooglePayAvailable) return 'error';
    if (!(configData as any)?.merchantId) return 'warning';
    if (!(productsData as any)?.products?.length) return 'warning';
    return 'active';
};

  const overallStatus = getOverallStatus();

  if (compact) {
    return (
      <Tooltip title={`Google Pay: ${isGooglePayAvailable ? 'Tilgjengelig' : 'Ikke tilgjengelig'}`}>
        <Chip
          icon={getStatusIcon(overallStatus)}
          label="Google Pay"
          color={getStatusColor(overallStatus) as any}
          size="small"
          variant={overallStatus === 'active' ? 'filled' : 'outlined'}
          className={className}
        />
      </Tooltip>
    );
}

  return (
    <Card className={className} sx={{ position: 'relative' }}>
      <CardContent sx={{ p: 2 }}>
        <>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Badge
            color={getStatusColor(overallStatus) as any}
            variant="dot"
            overlap="circular"
          >
            <Avatar sx={{ bgcolor: '#4285F4', width: 32, height: 32 }}>
              <GoogleIcon sx={{ color: 'white' }} />
            </Avatar>
          </Badge>
          
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Google Pay Status`
                : 'Google Pay Status'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sist sjekket: {lastChecked.toLocaleTimeString('nb-NO')}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Oppdater status">
              <IconButton size="small" onClick={handleRefresh} disabled={!isInitialized} aria-label="Oppdater status">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            {showDetails && (
              <Tooltip title={isExpanded ? 'Skjul detaljer' : 'Vis detaljer'}>
                <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)} aria-label={isExpanded ? 'Skjul detaljer' : 'Vis detaljer'}>
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Status Overview */}
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={getStatusIcon(overallStatus)}
            label={overallStatus === 'active' ? 'Aktiv' : 
                   overallStatus === 'warning' ? 'Advarsel' : 
                   overallStatus === 'error' ? 'Feil' : 'Laster...'}
            color={getStatusColor(overallStatus) as any}
            size="small"
          />
          
          {isDemoMode && (
            <Chip
              icon={<GoogleIcon />}
              label="Demo Modus"
              color="info"
              size="small"
              variant="outlined"
            />
          )}
          
          <Chip
            icon={<SecurityIcon />}
            label={configError?.message.includes('Authentication required') ? 'Ikke autentisert' :
                   configError?.message.includes('Access denied') ? 'Ingen tilgang' :
                   'Autentisert'}
            color={configError?.message.includes('Authentication required') || configError?.message.includes('Access denied') ? 'error' : 'success'}
            size="small"
            variant="outlined"
          />
          
          <Chip
            icon={<PaymentIcon />}
            label={`${(productsData as any)?.products?.length || 0} produkter`}
            color="primary"
            size="small"
            variant="outlined"
          />
          
          <Chip
            icon={<SecurityIcon />}
            label={(configData as any)?.merchantId ? 'Konfigurert' : 'Ikke konfigurert'}
            color={(configData as any)?.merchantId ? 'success' : 'warning'}
            size="small"
            variant="outlined"
          />
        </Stack>

        {/* Quick Stats */}
        {statsData && (
          <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                {(statsData as any).todayPayments || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                I dag
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                {(statsData as any).successRate || 0}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Suksessrate
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                {(statsData as any).avgResponseTime || 0}ms
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Responstid
              </Typography>
            </Box>
          </Stack>
        )}

        {/* Authentication Error Alerts */}
        {(configError || productsError || statsError) && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => window.location.href = '/api/login'}
              >
                Logg inn
              </Button>
          }
          >
            <Typography variant="body2">
              <strong>Autentisering påkrevd: </strong> {configError?.message || productsError?.message || statsError?.message}
            </Typography>
          </Alert>
        )}

        {/* Detailed Information */}
        <Collapse in={isExpanded}>
          <Divider sx={{ my: 2 }} />
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon sx={{ color: adminTokens.color.success }} />
              </ListItemIcon>
              <ListItemText
                primary="Autentisering"
                secondary={configError?.message.includes('Authentication required') ? 'Ikke autentisert - logg inn' :
                          configError?.message.includes('Access denied') ? 'Ingen tilgang - kontakt admin' :
                          'Autentisert og klar'}
              />
              {getStatusIcon(configError?.message.includes('Authentication required') || configError?.message.includes('Access denied') ? 'error' : 'active')}
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <GoogleIcon sx={{ color: '#4285F4' }} />
              </ListItemIcon>
              <ListItemText
                primary="Google Pay SDK"
                secondary={isGooglePayAvailable ? 'Tilgjengelig' : 'Ikke tilgjengelig'}
              />
              {getStatusIcon(isGooglePayAvailable ? 'active' : 'error')}
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <SecurityIcon sx={{ color: adminTokens.color.success }} />
              </ListItemIcon>
              <ListItemText
                primary="Merchant ID"
                secondary={(configData as any)?.merchantId || '7115-4985-8029'}
              />
              {getStatusIcon((configData as any)?.merchantId ? 'active' : 'warning')}
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <MembershipIcon sx={{ color: '#ce93d8' }} />
              </ListItemIcon>
              <ListItemText
                primary="Google Wallet"
                secondary={(configData as any)?.walletIssuer ? 'Konfigurert' : 'Ikke konfigurert'}
              />
              {getStatusIcon((configData as any)?.walletIssuer ? 'active' : 'warning')}
            </ListItem>
            
            <ListItem>
              <ListItemIcon>
                <CreditCardIcon sx={{ color: '#ff9800' }} />
              </ListItemIcon>
              <ListItemText
                primary="Produkter"
                secondary={`${(productsData as any)?.products?.length || 0} aktive produkter`}
              />
              {getStatusIcon((productsData as any)?.products?.length > 0 ? 'active' : 'warning')}
            </ListItem>
          </List>

          {/* Environment Info */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Miljø:</strong> {(configData as any)?.environment || process.env.NODE_ENV} | 
              <strong> Merchant ID: </strong> 7115-4985-8029 | 
              <strong> Sist oppdatert:</strong> {lastChecked.toLocaleString('nb-NO')}
            </Typography>
          </Alert>
        </Collapse>

        {/* Loading State */}
        {!isInitialized && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Sjekker Google Pay tilkobling...
            </Typography>
          </Box>
        )}
        </>
      </CardContent>
    </Card>
  );
}
