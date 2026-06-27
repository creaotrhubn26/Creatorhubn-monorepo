// client/src/components/admin/PaymentIntegrationPanel.tsx
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  InputAdornment,
} from '@mui/material';
import {
  Payment,
  Google,
  CreditCard,
  Phone,
  TrendingUp,
  AttachMoney,
  Receipt,
  Settings,
  Refresh,
  Add,
  Edit,
  Delete,
  Visibility,
  CheckCircle,
  Error,
  Warning,
  Info,
  MonetizationOn,
  AccountBalance,
  LocalAtm,
  Search,
} from '@mui/icons-material';
import { useToast } from '../../hooks/use-toast';
import { googlePayService } from '../../services/GooglePayService';
import { paymentProcessingService } from '../../services/PaymentProcessingService';
import { pricingService } from '../../services/PricingService';
import { AdminButton, StatusChip, AdminTableContainer, useIsMobile } from './design-system';

interface PaymentIntegrationPanelProps {
  className?: string;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

interface PaymentMethod {
  id: string;
  type: 'google-pay' | 'stripe' | 'vipps';
  name: string;
  status: 'active' | 'inactive' | 'error';
  configuration: any;
  lastUsed?: string;
  transactionsCount: number;
  totalAmount: number;
}

interface PaymentStats {
  totalRevenue: number;
  monthlyRevenue: number;
  activeSubscriptions: number;
  conversionRate: number;
  averageOrderValue: number;
  topPaymentMethod: string;
  recentTransactions: any[];
}

export default function PaymentIntegrationPanel({ 
  className,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: PaymentIntegrationPanelProps) {
  const [tabValue, setTabValue] = useState(0);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Initialize pricing service
  useEffect(() => {
    pricingService.initializePricing();
  }, []);

  // Register component and data flow nodes with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('payment-integration', 'payment', [
      'data:read', 'data:write', 'event:emit', 'event:listen', 'ui:update', 'payment:process', 'payment:configure', 'payment:test', 'notification:create', 'project:update', 'client:update'
    ]);

    dataFlow.registerNode({
      type: 'source',
      componentId: 'payment-integration',
      dataKey: 'payment-integration:paymentMethods',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'payment-integration',
      dataKey: 'payment-integration:paymentStats',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'payment-integration',
      dataKey: 'payment-integration:transactions',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    return () => {
      communication.unregisterComponent('payment-integration');
  };
}, [communication, dataFlow]);

  // Listen to global events from other components
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        console.log('💳 Payment Integration: Project selected', message.data);
        // Update payment context based on selected project
    }
      if (message.type === 'client: selected' && message.data) {
        console.log('💳 Payment Integration: Client selected', message.data);
        // Update payment context based on selected client
    }
      if (message.type === 'data: sync' && message.data.dataKey === 'payment-integration:paymentMethods') {
        console.log('💳 Payment Integration: Payment methods synced', message.data.data);
    }
  });
    return unsubscribe;
}, [communication]);

  // Integration handlers for unified workflow system
  const handlePaymentMethodConfigured = (methodData: any) => {
    console.log('💳 Payment Method Configured: ', methodData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'payment-integration',
      to: 'all',
      type: 'payment:methodConfigured',
      priority: 'medium',
      data: {
        ...methodData,
        configuredBy: 'payment-integration',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('payment-integration:paymentMethods', methodData);
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `payment_method_configured_${Date.now()}`,
        type: 'payment_method_configured',
        title: 'Payment Method Configured',
        message: `Payment method "${methodData.name}," has been configured`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'payment_integration'
  });
  }
};

  const handlePaymentProcessed = (transactionData: any) => {
    console.log('💳 Payment Processed:', transactionData);
    
    // Broadcast to other components
    communication.sendMessage({
      from: 'payment-integration',
      to: 'all',
      type: 'payment:processed',
      priority: 'medium',
      data: {
        ...transactionData,
        processedBy: 'payment-integration',
        timestamp: Date.now()
  }
  });

    // Sync data flow
    dataFlow.syncData('payment-integration:transactions', transactionData);
    
    if (onProjectUpdate && selectedProject) {
      onProjectUpdate({
        ...selectedProject,
        lastPayment: transactionData,
        lastPaymentUpdate: new Date().toISOString()
  });
  }
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `payment_processed_${Date.now()}`,
        type: 'payment_processed',
        title: 'Payment Processed',
        message: `Payment of ${transactionData.amount} NOK processed successfully`,
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'payment_integration'
  });
  }
};

  // Mock data - in real implementation, this would come from API
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'google-pay',
      type: 'google-pay',
      name: 'Google Pay',
      status: 'active',
      configuration: {
        merchantId: process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID || '1234567890123456789',
        environment: 'TES',
        gateway: 'stripe',
    },
      lastUsed: '2024-01-15T10:30:00',
      transactionsCount: 127,
      totalAmount: 4567890, // in øre
  },
    {
      id: 'stripe',
      type: 'stripe',
        name: 'Stripe (Kort)',
      status: 'active',
      configuration: {
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
        secretKey: 'sk_test_...',
        webhookSecret: 'whsec_...',
    },
      lastUsed: '2024-01-15T09:15:00',
      transactionsCount: 216,
      totalAmount: 7891230,
  },
    {
      id: 'vipps',
      type: 'vipps',
      name: 'Vipps',
      status: 'active',
      configuration: {
        clientId: process.env.VIPPS_CLIENT_ID || 'vipps_client_id',
        clientSecret: 'vipps_client_secret',
        merchantSerialNumber: '12345',
    },
      lastUsed: '2024-01-15T08:45:00',
      transactionsCount: 82,
      totalAmount: 2345670,
  },
  ];

  const paymentStats: PaymentStats = {
    totalRevenue: 14804790, // in øre
    monthlyRevenue: 2345670,
    activeSubscriptions: 127,
    conversionRate: 12.5,
    averageOrderValue: 1180, // in øre
    topPaymentMethod: 'Stripe',
    recentTransactions: [
      {
        id: 'tx_001',
        amount: 2990,
        currency: 'NO',
        status: 'succeeded',
        paymentMethod: 'google-pay',
        customer: 'john@example.com',
        timestamp: '2024-01-15T10:30:00',
    },
      {
        id: 'tx_002',
        amount: 5990,
        currency: 'NO',
        status: 'succeeded',
        paymentMethod: 'stripe',
        customer: 'jane@example.com',
        timestamp: '2024-01-15T09:15:00',
    },
    ],
};

  // Test Google Pay availability
  const { data: googlePayAvailable, isLoading: googlePayLoading } = useQuery({
    queryKey: ['google-pay-available'],
    queryFn: () => googlePayService.isGooglePayAvailable(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Get payment methods
  const { data: userPaymentMethods = [] } = useQuery({
    queryKey: ['user-payment-methods'],
    queryFn: () => paymentProcessingService.getPaymentMethods('user-id')
  });

  // Get user subscriptions
  const { data: userSubscriptionsRaw = [] } = useQuery({
    queryKey: ['user-subscriptions'],
    queryFn: () => paymentProcessingService.getUserSubscriptions('user-id')
  });
  const userSubscriptions = Array.isArray(userSubscriptionsRaw) ? userSubscriptionsRaw : [];

  const handleTestPayment = async (paymentMethod: PaymentMethod) => {
    try {
      setLoading(true);
      
      // Create a test payment intent
      const result = await paymentProcessingService.createPaymentIntent(
        'test-feature',
        'monthly',
        paymentMethod.type,
        'test-user'
      );

      if (result.success) {
        // Trigger unified workflow events
        const testTransaction = {
          id: `test_${Date.now()}`,
          amount: 2990, // Test amount
          currency: 'NO',
          paymentMethod: paymentMethod.type,
          status: 'succeeded',
          timestamp: new Date().toISOString()
    };
        
        handlePaymentProcessed(testTransaction);
        
        // Update payment stats and sync
        const updatedStats = {
          ...paymentStats,
          totalRevenue: paymentStats.totalRevenue + testTransaction.amount,
          monthlyRevenue: paymentStats.monthlyRevenue + testTransaction.amount,
          recentTransactions: [testTransaction, ...paymentStats.recentTransactions.slice(0, 9)]
      };
        
        dataFlow.syncData('payment-integration:paymentStats', updatedStats);
        
        toast({
          title: 'Test Payment Created',
          description: `Test payment intent created for ${paymentMethod.name}`,
          variant: 'default',
      });
    } else {
        toast({
          title: 'Test Payment Failed',
          description: result.error || 'Failed to create test payment',
          variant: 'destructive',
      });
    }
  } catch (error) {
      console.error('Test payment error:', error);
      toast({
        title: 'Test Payment Error',
        description: 'An error occurred while testing payment',
        variant: 'destructive',
    });
  } finally {
      setLoading(false);
  }
};

  const handleConfigurePaymentMethod = (paymentMethod: PaymentMethod) => {
    setSelectedPaymentMethod(paymentMethod);
    setShowConfigDialog(true);
    
    // Trigger unified workflow events for payment method configuration
    handlePaymentMethodConfigured(paymentMethod);
};

  // Sync payment data on component mount
  useEffect(() => {
    dataFlow.syncData('payment-integration:paymentMethods', paymentMethods);
    dataFlow.syncData('payment-integration:paymentStats', paymentStats);
    dataFlow.syncData('payment-integration:transactions', paymentStats.recentTransactions);
  }, [dataFlow]);

  // Handle tab changes and broadcast them
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    // Broadcast tab change to other components
      communication.sendMessage({
      from: 'payment-integration',
      to: 'all',
      type: 'payment:tabChanged',
      priority: 'low',
      data: {
        tabValue: newValue, 
        tabName: ['Betalingsmetoder','Transaksjoner','Abonnementer', 'Konfigurasjon', 'Rapporter'][newValue] || 'Unknown',
        timestamp: Date.now()
  }
  });
};

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NO',
  }).format(amount / 100);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle />;
      case 'inactive':
        return <Warning />;
      case 'error':
        return <Error />;
      default:
        return <Info />;
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'google-pay':
        return <Google />;
      case 'stripe':
        return <CreditCard />;
      case 'vipps':
        return <Phone />;
      default:
        return <Payment />;
    }
  };

  return (
    <Box className={className}>
      <Typography variant="h4" component="h2" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <Payment color="primary" aria-hidden="true" />
        Betalingsintegrasjon
      </Typography>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'}}
                >
                  <MonetizationOn />
                </Box>
                <Box>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    {formatAmount(paymentStats.totalRevenue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total omsetning
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'}}
                >
                  {theming.getThemedIcon('trendingUp')}
                </Box>
                <Box>
                  <Typography variant="h6" color="success.main" sx={{ ...{}, color: theming.colors.primary }}>
                    {formatAmount(paymentStats.monthlyRevenue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Månedlig omsetning
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: 'info.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'}}
                >
                  <AccountBalance />
                </Box>
                <Box>
                  <Typography variant="h6" color="info.main" sx={{ ...{}, color: theming.colors.primary }}>
                    {paymentStats.activeSubscriptions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive abonnementer
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 1,
                    bgcolor: 'warning.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'}}
                >
                  <LocalAtm />
                </Box>
                <Box>
                  <Typography variant="h6" color="warning.main" sx={{ ...{}, color: theming.colors.primary }}>
                    {paymentStats.conversionRate}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Konverteringsrate
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Betalingsmetoder" />
          <Tab label="Transaksjoner" />
          <Tab label="Abonnementer" />
          <Tab label="Konfigurasjon" />
          <Tab label="Rapporter" />
        </Tabs>
      </Box>

      {/* Payment Methods Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {paymentMethods.map((method) => (
            <Grid item xs={12} md={6} key={method.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getPaymentMethodIcon(method.type)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{method.name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          icon={getStatusIcon(method.status)}
                          label={method.status}
                          color={getStatusColor(method.status) as any}
                          size="small"
                        />
                        {method.type === 'google-pay' && (
                          <Chip
                            label={googlePayAvailable ? 'Tilgjengelig' : 'Ikke tilgjengelig'}
                            color={googlePayAvailable ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Transaksjoner: {method.transactionsCount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total: {formatAmount(method.totalAmount)}
                    </Typography>
                    {method.lastUsed && (
                      <Typography variant="body2" color="text.secondary">
                        Sist brukt: {new Date(method.lastUsed).toLocaleDateString(', ')}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Settings />}
                      onClick={() => handleConfigurePaymentMethod(method)}
                    >
                      Konfigurer
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => handleTestPayment(method)}
                      disabled={loading}
                    >
                      Test
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Transactions Tab */}
      {tabValue === 1 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" component="h3" sx={{ mb: 2, color: theming.colors.primary }}>
              Siste transaksjoner
            </Typography>
            <AdminTableContainer ariaLabel="Siste transaksjoner">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Beløp</TableCell>
                    <TableCell>Metode</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tidspunkt</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentStats.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {transaction.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{transaction.customer}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatAmount(transaction.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getPaymentMethodIcon(transaction.paymentMethod)}
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {transaction.paymentMethod}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          label={transaction.status}
                          tone={transaction.status === 'succeeded' ? 'success' : 'neutral'}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(transaction.timestamp).toLocaleString('no-NO')}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" aria-label="Vis transaksjonsdetaljer">
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Tab */}
      {tabValue === 2 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" component="h3" sx={{ mb: 2, color: theming.colors.primary }}>
              Abonnementer
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              {userSubscriptions.length} aktive abonnementer funnet
            </Alert>
            <TextField
              size="small"
              fullWidth
              placeholder="Søk etter produkt eller kunde …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <AdminTableContainer ariaLabel="Abonnementer">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Produkt</TableCell>
                    <TableCell>Kunde</TableCell>
                    <TableCell>Beløp</TableCell>
                    <TableCell>Syklus</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Startdato</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userSubscriptions
                    .filter((subscription: any) =>
                      [subscription.productId, subscription.userId]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase()
                        .includes(search.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((subscription: any) => (
                    <TableRow key={subscription.d}>
                      <TableCell>{subscription.productId}</TableCell>
                      <TableCell>{subscription.userId}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatAmount(subscription.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={subscription.billingCycle}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          label={subscription.status}
                          tone={subscription.status === 'active' ? 'success' : 'neutral'}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(subscription.startDate).toLocaleDateString('no-NO')}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" aria-label="Vis abonnementsdetaljer">
                          <Visibility />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tab */}
      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{ mb: 2, color: theming.colors.primary }}>
                  Google Pay Konfigurasjon
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Google color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Merchant ID"
                      secondary={process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID || 'Ikke satt'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Settings />
                    </ListItemIcon>
                    <ListItemText
                      primary="Miljø"
                      secondary={process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color={googlePayAvailable ? 'success' : 'error'} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Tilgjengelighet"
                      secondary={googlePayAvailable ? 'Tilgjengelig' : 'Ikke tilgjengelig'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{ mb: 2, color: theming.colors.primary }}>
                  Stripe Konfigurasjon
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CreditCard color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Publishable Key"
                      secondary={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'Satt' : 'Ikke satt'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Settings />
                    </ListItemIcon>
                    <ListItemText
                      primary="Webhook Secret"
                      secondary={process.env.STRIPE_WEBHOOK_SECRET ? 'Satt' : 'Ikke satt'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Reports Tab */}
      {tabValue === 4 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" component="h3" sx={{ mb: 2, color: theming.colors.primary }}>
              Betalingsrapporter
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Omsetning per betalingsmetode
                </Typography>
                <List>
                  {paymentMethods.map((method) => (
                    <ListItem key={method.id}>
                      <ListItemIcon>
                        {getPaymentMethodIcon(method.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={method.name}
                        secondary={`${formatAmount(method.totalAmount)} (${method.transactionsCount} transaksjoner)`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Nøkkeltall
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Gjennomsnittlig ordreverdi"
                      secondary={formatAmount(paymentStats.averageOrderValue)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Mest populære betalingsmetode"
                      secondary={paymentStats.topPaymentMethod}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Konverteringsrate"
                      secondary={`${paymentStats.conversionRate}%`}
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onClose={() => setShowConfigDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          Konfigurer {selectedPaymentMethod?.name}
        </DialogTitle>
        <DialogContent>
          {selectedPaymentMethod && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Konfigurasjonsdetaljer for {selectedPaymentMethod.name}
              </Typography>
              <pre style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize:'12px'
              }}>
                {JSON.stringify(selectedPaymentMethod.configuration, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowConfigDialog(false)}>
            Lukk
          </AdminButton>
          <AdminButton tone="primary">
            Lagre endringer
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
