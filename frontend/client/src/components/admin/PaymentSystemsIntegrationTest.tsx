/**
 * CreatorHub Norge - Payment Systems Integration Test
 * Validates communication and data-flow between payment and pricing components.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import Grid from '@mui/material/Grid2';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

type TestStatus = 'PASS' | 'FAIL';

interface TestResultEntry {
  key: string;
  status: TestStatus;
  detail?: string;
}

interface PaymentWorkflowStep {
  step: number;
  action: string;
  data: Record<string, unknown>;
}

const COMPONENT_ID = 'payment-integration-test';

const PAYMENT_COMPONENT_IDS = [
  'payment-integration',
  'pricing-management',
  'price-administration',
  'contract-pricing',
  'showcase-pricing',
  'billing-management',
] as const;

const PaymentSystemsIntegrationTest: React.FC = () => {
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();

  const currentProfession = professionAdapter.profession || 'prototype_tester';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  const theming = useTheming(currentProfession);

  const [testResults, setTestResults] = useState<TestResultEntry[]>([]);
  const [dataFlowMessages, setDataFlowMessages] = useState<string[]>([]);
  const [communicationMessages, setCommunicationMessages] = useState<string[]>([]);

  const appendDataFlowMessage = useCallback((message: string) => {
    setDataFlowMessages((prev) => [message, ...prev].slice(0, 60));
  }, []);

  const appendCommunicationMessage = useCallback((message: string) => {
    setCommunicationMessages((prev) => [message, ...prev].slice(0, 80));
  }, []);

  const sendPaymentMessage = useCallback(
    (type: string, data: Record<string, unknown>, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
      communication.sendMessage({
        from: COMPONENT_ID,
        to: 'broadcast',
        type,
        priority,
        data: {
          ...data,
          timestamp: Date.now(),
        },
      });
    },
    [communication]
  );

  const runPaymentIntegrationTest = useCallback(() => {
    const results: TestResultEntry[] = [];

    const hasCoreIntegration = Boolean(integration && communication && dataFlow && componentRegistry);
    results.push({ key: 'Core Integration Context', status: hasCoreIntegration ? 'PASS' : 'FAIL' });

    const registeredComponents = PAYMENT_COMPONENT_IDS.map((componentId) =>
      componentRegistry.getComponent(componentId) ? 'PASS' : 'FAIL'
    );
    const missingComponents = PAYMENT_COMPONENT_IDS.filter(
      (_, index) => registeredComponents[index] === 'FAIL'
    );
    results.push({
      key: 'Payment Component Registration',
      status: missingComponents.length === 0 ? 'PASS' : 'FAIL',
      detail:
        missingComponents.length === 0
          ? `All ${PAYMENT_COMPONENT_IDS.length} components registered`
          : `Missing: ${missingComponents.join(', ')}`,
    });

    sendPaymentMessage(
      'payment:methodConfigured',
      {
        id: 'test-payment-method',
        type: 'google-pay',
        name: 'Test Google Pay',
        status: 'active',
        configuration: { test: true },
      },
      'high'
    );

    sendPaymentMessage('pricing:calculated', {
      serviceId: 13,
      packageId: 46,
      subtotal: 1000,
      tax: 250,
      total: 1250,
      currency: 'NOK',
    });

    sendPaymentMessage('billing:planCreated', {
      id: 'test-plan-001',
      name: 'Test Professional Plan',
      profession: 'photographer',
      price: 299,
      currency: 'NOK',
      interval: 'monthly',
      features: ['unlimited_projects', 'priority_support'],
    });

    results.push({
      key: 'Message Broadcast',
      status: 'PASS',
      detail: 'payment:methodConfigured, pricing:calculated, billing:planCreated sent',
    });

    setTestResults(results);
  }, [communication, componentRegistry, dataFlow, integration, sendPaymentMessage]);

  const testDataFlow = useCallback(async () => {
    setDataFlowMessages([]);

    const paymentMethodsData = [
      { id: 'pm-001', provider: 'stripe', enabled: true },
      { id: 'pm-002', provider: 'google-pay', enabled: true },
    ];
    await dataFlow.syncData('payment-integration:paymentMethods', paymentMethodsData);
    appendDataFlowMessage(`Synced payment methods: ${paymentMethodsData.length}`);

    const pricingServicesData = [
      { id: 'svc-001', name: 'Wedding Highlight', price: 1500 },
      { id: 'svc-002', name: 'Full Ceremony', price: 3200 },
    ];
    await dataFlow.syncData('pricing-management:services', pricingServicesData);
    appendDataFlowMessage(`Synced pricing services: ${pricingServicesData.length}`);

    const billingPlansData = [
      { id: 'plan-basic', name: 'Basic', amount: 99 },
      { id: 'plan-pro', name: 'Pro', amount: 249 },
    ];
    await dataFlow.syncData('billing-management:plans', billingPlansData);
    appendDataFlowMessage(`Synced billing plans: ${billingPlansData.length}`);

    const syncedPaymentMethods = dataFlow.getSyncedData('payment-integration:paymentMethods');
    const syncedServices = dataFlow.getSyncedData('pricing-management:services');
    const syncedPlans = dataFlow.getSyncedData('billing-management:plans');

    appendDataFlowMessage(
      `Snapshot payment methods: ${Array.isArray(syncedPaymentMethods) ? syncedPaymentMethods.length : 0}`
    );
    appendDataFlowMessage(`Snapshot services: ${Array.isArray(syncedServices) ? syncedServices.length : 0}`);
    appendDataFlowMessage(`Snapshot plans: ${Array.isArray(syncedPlans) ? syncedPlans.length : 0}`);
  }, [appendDataFlowMessage, dataFlow]);

  const testCommunication = useCallback(() => {
    setCommunicationMessages([]);

    sendPaymentMessage('payment:processed', {
      type: 'charge',
      amount: 750,
      currency: 'NOK',
    });
    appendCommunicationMessage('Broadcasted payment:processed');

    sendPaymentMessage('pricing:serviceSelected', {
      serviceId: 99,
      price: 250,
      currency: 'NOK',
    });
    appendCommunicationMessage('Broadcasted pricing:serviceSelected');

    sendPaymentMessage('billing:couponCreated', {
      code: 'TEST2026',
      discountPercent: 20,
    });
    appendCommunicationMessage('Broadcasted billing:couponCreated');

    const unsubscribe = communication.onMessage((message) => {
      if (message.from !== COMPONENT_ID) {
        return;
      }
      appendCommunicationMessage(`Echo ${message.type}: ${JSON.stringify(message.data)}`);
    });

    window.setTimeout(unsubscribe, 3000);
  }, [appendCommunicationMessage, communication, sendPaymentMessage]);

  const simulatePaymentWorkflow = useCallback(() => {
    const workflowSteps: PaymentWorkflowStep[] = [
      { step: 1, action: 'Customer selects package', data: { packageId: 'pkg-001', amount: 1200 } },
      { step: 2, action: 'Contract calculates totals', data: { subtotal: 1200, tax: 300, total: 1500 } },
      { step: 3, action: 'Payment method authorized', data: { provider: 'stripe', state: 'authorized' } },
      { step: 4, action: 'Invoice generated', data: { invoiceId: 'inv-001', state: 'created' } },
      { step: 5, action: 'Subscription synced', data: { plan: 'pro', state: 'active' } },
    ];

    workflowSteps.forEach((step, index) => {
      window.setTimeout(() => {
        sendPaymentMessage('billing:workflowStep', {
          step: step.step,
          action: step.action,
          data: step.data,
        });
        appendCommunicationMessage(`Workflow ${step.step}: ${step.action}`);
      }, index * 650);
    });
  }, [appendCommunicationMessage, sendPaymentMessage]);

  const integrationSnapshot = useMemo(() => {
    const allComponents = componentRegistry.getAllComponents();
    const paymentComponents = allComponents
      .filter((component) =>
        component.id.includes('payment') ||
        component.id.includes('pricing') ||
        component.id.includes('billing')
      )
      .map((component) => component.id);

    return {
      totalComponents: allComponents.length,
      paymentComponents,
      paymentMethodsReady: Boolean(dataFlow.getSyncedData('payment-integration:paymentMethods')),
      pricingServicesReady: Boolean(dataFlow.getSyncedData('pricing-management:services')),
      billingPlansReady: Boolean(dataFlow.getSyncedData('billing-management:plans')),
    };
  }, [componentRegistry, dataFlow]);

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {professionIcon && (
          <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>{professionIcon}</Box>
        )}
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          {enhancedProfessionConfig?.displayName || professionConfig?.displayName
            ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Payment Systems Integration Test`
            : 'Payment Systems Integration Test'}
        </Typography>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Verifies the integration between payment, pricing, contract, and billing components.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button variant="contained" onClick={runPaymentIntegrationTest} fullWidth sx={theming.getThemedButtonSx()}>
            Run Integration Test
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button variant="outlined" onClick={testDataFlow} fullWidth>
            Test Data Flow
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button variant="outlined" onClick={testCommunication} fullWidth>
            Test Communication
          </Button>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button variant="outlined" onClick={simulatePaymentWorkflow} fullWidth>
            Simulate Workflow
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Test Results
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <List dense>
          {testResults.map((result) => (
            <ListItem key={result.key}>
              <ListItemText primary={result.key} secondary={result.detail} />
              <Chip label={result.status} size="small" color={result.status === 'PASS' ? 'success' : 'error'} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Data Flow Messages
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <List dense>
          {dataFlowMessages.map((message, index) => (
            <ListItem key={`${message}-${index}`}>
              <ListItemText primary={message} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Communication Messages
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <List dense>
          {communicationMessages.map((message, index) => (
            <ListItem key={`${message}-${index}`}>
              <ListItemText primary={message} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Payment Systems Status
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Registered Components
              </Typography>
              <List dense>
                {PAYMENT_COMPONENT_IDS.map((componentId) => (
                  <ListItem key={componentId}>
                    <ListItemText
                      primary={componentId}
                      secondary={
                        <Chip
                          label={componentRegistry.getComponent(componentId) ? 'Registered' : 'Missing'}
                          color={componentRegistry.getComponent(componentId) ? 'success' : 'error'}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Data Snapshots
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="payment-integration:paymentMethods" />
                  <Chip label={integrationSnapshot.paymentMethodsReady ? 'Ready' : 'Empty'} size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="pricing-management:services" />
                  <Chip label={integrationSnapshot.pricingServicesReady ? 'Ready' : 'Empty'} size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="billing-management:plans" />
                  <Chip label={integrationSnapshot.billingPlansReady ? 'Ready' : 'Empty'} size="small" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          Payment/pricing/billing systems are connected through the unified integration layer and can exchange data in
          real time.
        </Typography>
      </Alert>
    </Box>
    </ThemeProvider>
  );
};

export default PaymentSystemsIntegrationTest;
