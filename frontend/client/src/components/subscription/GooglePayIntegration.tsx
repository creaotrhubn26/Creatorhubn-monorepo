/**
 * CreatorHub Norge - Google Pay Integration
 * Connects subscription flow with Google Pay Manager and configuration
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Stack,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Paper,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  CardMembership as MembershipIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { googlePayService } from '@/services/GooglePayService';
import { useToast } from '@/hooks/use-toast';

interface GooglePayIntegrationProps {
  onConfigurationUpdate?: (config: any) => void; 
}

export default function GooglePayIntegration({ onConfigurationUpdate }: GooglePayIntegrationProps) {
  const { auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  const { toast } = useToast();
  
  const [isGooglePayAvailable, setIsGooglePayAvailable] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [configuration, setConfiguration] = useState<any>(null);

  // Check Google Pay availability
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await googlePayService.isGooglePayAvailable();
        setIsGooglePayAvailable(available);
        setIsInitialized(true);
    } catch (error) {
        console.error('Error checking Google Pay availability: ', error);
        setIsInitialized(true);
    }
  };

    checkAvailability();
}, []);

  // Fetch Google Pay configuration
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['/api/google-pay/configuration'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/google-pay/configuration', {
        headers: {
          ...headers, 'Content-Type' : 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch configuration');
      return response.json();
    },
    enabled: !!auth,
  });

  // Fetch Google Pay products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['/api/google-pay/products'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/google-pay/products', {
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: !!auth,
  });

  // Update configuration when data changes
  useEffect(() => {
    if (configData) {
      setConfiguration(configData);
      onConfigurationUpdate?.(configData);
    }
  }, [configData, onConfigurationUpdate]);

  const handleTestConfiguration = async () => {
    try {
      const available = await googlePayService.isGooglePayAvailable();
      setIsGooglePayAvailable(available);

      toast({
        title: available ? 'Google Pay tilgjengelig' : 'Google Pay ikke tilgjengelig',
        description: available
          ? 'Google Pay er klar for bruk på denne enheten'
          : 'Google Pay er ikke tilgjengelig på denne enheten',
        variant: available ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Feil ved testing',
        description: 'Kunne ikke teste Google Pay konfigurasjon',
        variant: 'destructive',
      });
    }
  };

  const handleSyncProducts = async () => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/google-pay/sync-products', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to sync products');

      const result = await response.json();

      toast({
        title: 'Produkter synkronisert',
        description: `${result.syncedProducts || 0} produkter synkronisert med Google Pay`,
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Synkronisering feilet',
        description: 'Kunne ikke synkronisere produkter med Google Pay',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'ready':
      case 'configured':
        return <CheckCircleIcon color="success" />;
      case 'warning':
      case 'pending':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'failed':
        return <WarningIcon color="error" />;
      default:
        return <InfoIcon color="action" />;
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

  if (!isInitialized) {
    return (
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={{ textAlign: 'center', py:  4 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Initialiserer Google Pay...
          </Typography>
        </CardContent>
      </Card>
    );
}

  return (
    <Box>
      {/* Status Overview */}
      <Paper
        elevation={0}
        sx={{
          p:  3,
          mb:  3,
          background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
          color: 'white',
          borderRadius:  2}}
       sx={theming.getThemedCardSx()}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <PaymentIcon sx={{ fontSize: 32}} />
          <Box sx={{ flex:  1 }}>
            <Typography variant="h5" sx={{  fontWeight: 700, mb:  1  }}>
              Google Pay Integration
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9}}>
              CreatorHub Norge Payments Profile ID: 7115-4985-8029
            </Typography>
          </Box>
          <Button variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleTestConfiguration}
            sx={{
              bgcolor: 'rgba(25, 255, 255, 0.2)',
              color: 'white', '&:hover': { bgcolor: 'rgba(25, 255, 255, 0.3)' }}}
          >
            Test
          </Button>
        </Stack>
      </Paper>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Box sx={{ mb:  2 }}>
                {getStatusIcon(isGooglePayAvailable ? 'ready' : 'error')}
              </Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Google Pay
              </Typography>
              <Chip
                label={isGooglePayAvailable ? 'Tilgjengelig' : 'Ikke tilgjengelig'}
                color={getStatusColor(isGooglePayAvailable ? 'ready' : 'error') as any}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Box sx={{ mb:  2 }}>
                {getStatusIcon(configuration?.merchantId ? 'configured' : 'warning')}
              </Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Merchant ID
              </Typography>
              <Chip
                label={configuration?.merchantId ? 'Konfigurert' : 'Mangler'}
                color={getStatusColor(configuration?.merchantId ? 'configured' : 'warning') as any}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Box sx={{ mb:  2 }}>
                {getStatusIcon(configuration?.walletIssuer ? 'configured' : 'warning')}
              </Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Wallet Issuer
              </Typography>
              <Chip
                label={configuration?.walletIssuer ? 'Konfigurert' : 'Mangler'}
                color={getStatusColor(configuration?.walletIssuer ? 'configured' : 'warning') as any}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Box sx={{ mb:  2 }}>
                {getStatusIcon(productsData?.products?.length > 0 ? 'ready' : 'warning')}
              </Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Produkter
              </Typography>
              <Chip
                label={`${productsData?.products?.length || 0} produkter`}
                color={getStatusColor(productsData?.products?.length > 0 ? 'ready' : 'warning') as any}
                size="small"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Details */}
      {configuration && (
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
              <SettingsIcon />
              Konfigurasjonsdetaljer
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <PaymentIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Merchant ID"
                  secondary={configuration.merchantId || '7115-4985-8029'}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <MembershipIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Wallet Issuer ID"
                  secondary={configuration.walletIssuer || '7115-4985-8029'}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemIcon>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Environment"
                  secondary={configuration.environment || process.env.NODE_ENV}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      )}

      {/* Products Overview */}
      {productsData?.products && (
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
              <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <MembershipIcon />
                Google Pay Produkter
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleSyncProducts}
                size="small"
              >
                Synkroniser
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              {productsData.products.slice(0, 4).map((product: any, index: number) => (
                <Grid size={{ xs: 12, sm:  6, md:  3 }} key={index}>
                  <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {product.name}
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      {product.price} NOK
                    </Typography>
                    <Chip
                      label={product.isActive ? 'Aktiv' : 'Inaktiv'}
                      color={product.isActive ? 'success' : 'default'}
                      size="small"
                      sx={{ mt:  1 }}
                    />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Status Alert */}
      <Alert
        severity={isGooglePayAvailable ? 'success' : 'warning'}
        sx={{ mb: 3 }}
      >
        <Typography variant="body2">
          <strong>Status: </strong>
          {isGooglePayAvailable
            ? 'Google Pay er tilgjengelig og klar for bruk i abonnementsflyten' : 'Google Pay er ikke tilgjengelig på denne enheten. Brukere vil se alternative betalingsmetoder.'}
        </Typography>
      </Alert>
    </Box>
  );
}

















