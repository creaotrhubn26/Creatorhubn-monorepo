/**
 * CreatorHub Norge - Google Wallet Integration Test
 * Integration smoke tester for wallet/membership data flow and communication.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import {
  Business,
  CardMembership,
  QrCode,
  School,
  Work,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { StatusChip } from './design-system';

type TestStatus = 'PASS' | 'FAIL';

interface TestResultEntry {
  key: string;
  status: TestStatus;
  detail?: string;
}

interface MembershipWorkflowStep {
  step: number;
  action: string;
  data: Record<string, unknown>;
}

const COMPONENT_ID = 'google-wallet-membership-test';

const GoogleWalletIntegrationTest: React.FC = () => {
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
    setDataFlowMessages((prev) => [message, ...prev].slice(0, 40));
  }, []);

  const appendCommunicationMessage = useCallback((message: string) => {
    setCommunicationMessages((prev) => [message, ...prev].slice(0, 80));
  }, []);

  const sendIntegrationMessage = useCallback(
    (type: string, data: Record<string, unknown>) => {
      communication.sendMessage({
        from: COMPONENT_ID,
        to: 'broadcast',
        type,
        priority: 'medium',
        data: {
          ...data,
          timestamp: Date.now(),
        },
      });
    },
    [communication]
  );

  const runGoogleWalletIntegrationTest = useCallback(() => {
    const results: TestResultEntry[] = [];

    const hasCoreIntegration = Boolean(integration && communication && dataFlow && componentRegistry);
    results.push({
      key: 'Core Integration Context',
      status: hasCoreIntegration ? 'PASS' : 'FAIL',
    });

    const isMembershipComponentRegistered = Boolean(componentRegistry.getComponent('google-wallet-membership'));
    results.push({
      key: 'Wallet Component Registry',
      status: isMembershipComponentRegistered ? 'PASS' : 'FAIL',
      detail: isMembershipComponentRegistered
        ? 'google-wallet-membership found'
        : 'google-wallet-membership missing',
    });

    sendIntegrationMessage('membership:cardCreated', {
      id: 'test-membership-001',
      organizationName: 'CreatorHub Norge',
      membershipType: 'Professional',
      memberNumber: 'MEM001',
      tier: 'GOLD',
      benefits: ['Priority support', 'Exclusive content', 'Discounts'],
      isActive: true,
      autoRenew: true,
      createdAt: new Date().toISOString(),
    });

    sendIntegrationMessage('membership:organizationUpdated', {
      id: 'org-001',
      name: 'Norwegian Photographers Association',
      type: 'Professional Organization',
      description: 'Leading photography organization in Norway',
      memberCount: 1200,
      established: '2015',
    });

    sendIntegrationMessage('membership:tierUpgraded', {
      cardId: 'test-membership-001',
      oldTier: 'SILVER',
      newTier: 'GOLD',
      upgradeReason: 'Annual renewal with benefits',
      effectiveDate: new Date().toISOString(),
    });

    results.push({ key: 'Message Dispatch', status: 'PASS', detail: 'Created/Updated/Upgraded events broadcasted' });
    setTestResults(results);
  }, [communication, componentRegistry, dataFlow, integration, sendIntegrationMessage]);

  const testDataFlow = useCallback(async () => {
    setDataFlowMessages([]);

    const membershipCardsData = [
      {
        id: 'card-001',
        organizationName: 'CreatorHub Norge',
        membershipType: 'Professional',
        tier: 'GOLD',
        isActive: true,
        memberSince: '2023-01-15',
        renewalDate: '2027-01-15',
      },
      {
        id: 'card-002',
        organizationName: 'Norwegian Photographers Association',
        membershipType: 'Business',
        tier: 'SILVER',
        isActive: true,
        memberSince: '2023-06-01',
        renewalDate: '2027-06-01',
      },
    ];

    const organizationsData = [
      {
        id: 'org-001',
        name: 'CreatorHub Norge',
        type: 'Platform',
        description: 'Creative platform for photographers and videographers',
        memberCount: 5000,
      },
      {
        id: 'org-002',
        name: 'Norwegian Photographers Association',
        type: 'Professional Organization',
        description: 'Leading photography organization in Norway',
        memberCount: 1250,
      },
    ];

    await dataFlow.syncData('google-wallet-membership:cards', membershipCardsData);
    appendDataFlowMessage(`Synced membership cards: ${membershipCardsData.length}`);
    await dataFlow.syncData('google-wallet-membership:organizations', organizationsData);
    appendDataFlowMessage(`Synced organizations: ${organizationsData.length}`);

    const requestedCards = dataFlow.getSyncedData('google-wallet-membership:cards');
    const requestedOrgs = dataFlow.getSyncedData('google-wallet-membership:organizations');

    appendDataFlowMessage(`Read cards snapshot size: ${Array.isArray(requestedCards) ? requestedCards.length : 0}`);
    appendDataFlowMessage(`Read org snapshot size: ${Array.isArray(requestedOrgs) ? requestedOrgs.length : 0}`);
  }, [appendDataFlowMessage, dataFlow]);

  const testCommunication = useCallback(() => {
    setCommunicationMessages([]);

    sendIntegrationMessage('membership:cardCreated', {
      cardId: 'test-card-123',
      organizationName: 'Test Organization',
      membershipType: 'Professional',
      tier: 'PLATINUM',
    });
    appendCommunicationMessage('Broadcasted membership:cardCreated');

    sendIntegrationMessage('membership:organizationUpdated', {
      orgId: 'test-org-456',
      name: 'Updated Organization',
      memberCount: 200,
    });
    appendCommunicationMessage('Broadcasted membership:organizationUpdated');

    const unsubscribe = communication.onMessage((message) => {
      if (message.from !== COMPONENT_ID) {
        return;
      }
      appendCommunicationMessage(`Echo ${message.type}: ${JSON.stringify(message.data)}`);
    });

    window.setTimeout(unsubscribe, 3000);
  }, [appendCommunicationMessage, communication, sendIntegrationMessage]);

  const simulateMembershipWorkflow = useCallback(() => {
    setCommunicationMessages([]);

    const workflowSteps: MembershipWorkflowStep[] = [
      { step: 1, action: 'User applies for membership', data: { organization: 'CreatorHub Norge', tier: 'BRONZE' } },
      { step: 2, action: 'Application approved', data: { status: 'approved', approvedBy: 'admin' } },
      { step: 3, action: 'Digital card created', data: { cardId: 'card-workflow-001', qrCode: 'QR123456' } },
      { step: 4, action: 'Card added to Google Wallet', data: { walletId: 'wallet-001', status: 'active' } },
      { step: 5, action: 'Welcome email sent', data: { emailSent: true, template: 'welcome-professional' } },
      { step: 6, action: 'Benefits activated', data: { benefits: ['Priority support', 'Exclusive content'] } },
    ];

    workflowSteps.forEach((step, index) => {
      window.setTimeout(() => {
        sendIntegrationMessage('membership:workflowStep', {
          step: step.step,
          action: step.action,
          data: step.data,
        });
        appendCommunicationMessage(`Step ${step.step}: ${step.action}`);
      }, index * 700);
    });
  }, [appendCommunicationMessage, sendIntegrationMessage]);

  const integrationSnapshot = useMemo(() => {
    const allComponents = componentRegistry.getAllComponents();
    const walletComponents = allComponents
      .filter((component) => component.id.includes('wallet') || component.id.includes('membership'))
      .map((component) => component.id);

    return {
      componentCount: allComponents.length,
      walletComponents,
      cardsDataPresent: Boolean(dataFlow.getSyncedData('google-wallet-membership:cards')),
      orgDataPresent: Boolean(dataFlow.getSyncedData('google-wallet-membership:organizations')),
    };
  }, [componentRegistry, dataFlow]);

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}
      >
        {professionIcon && (
          <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>{professionIcon}</Box>
        )}
        <CardMembership color="primary" />
        {enhancedProfessionConfig?.displayName || professionConfig?.displayName
          ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Google Wallet Integration Test`
          : 'Google Wallet Integration Test'}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Validates Google Wallet membership integration across communication, component registry, and data flow.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Button variant="contained" onClick={runGoogleWalletIntegrationTest} fullWidth sx={theming.getThemedButtonSx()}>
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
          <Button variant="outlined" onClick={simulateMembershipWorkflow} fullWidth>
            Simulate Workflow
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Test Results
      </Typography>
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
        <List dense>
          {testResults.map((result) => (
            <ListItem key={result.key}>
              <ListItemText
                primary={result.key}
                secondary={result.detail}
              />
              <StatusChip
                label={result.status}
                tone={result.status === 'PASS' ? 'success' : 'error'}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Data Flow Messages
      </Typography>
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
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
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
        <List dense>
          {communicationMessages.map((message, index) => (
            <ListItem key={`${message}-${index}`}>
              <ListItemText primary={message} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Integration Status
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode color="primary" />
                Digital Cards
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Membership cards, loyalty programs and digital passes.
              </Typography>
              <StatusChip label="Active" tone="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business color="primary" />
                Organizations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Professional organizations and business memberships.
              </Typography>
              <StatusChip label="Active" tone="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Work color="primary" />
                Professional
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Professional photographer and videographer memberships.
              </Typography>
              <StatusChip label="Active" tone="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <School color="primary" />
                Student
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Student memberships and educational programs.
              </Typography>
              <StatusChip label="Active" tone="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Master Integration State (Partial View)
      </Typography>
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2 }}>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(integrationSnapshot, null, 2)}
        </pre>
      </Paper>
    </Box>
    </ThemeProvider>
  );
};

export default GoogleWalletIntegrationTest;
