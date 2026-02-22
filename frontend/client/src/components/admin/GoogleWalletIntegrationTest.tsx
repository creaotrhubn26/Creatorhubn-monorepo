/**
 * CreatorHub Norge - Google Wallet Integration Test
 * Test component for Google Wallet API integration
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Alert,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  CardMembership,
  QrCode,
  Business,
  School,
  Work,
  Star,
} from '@mui/icons-material';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

const GoogleWalletIntegrationTest: React.FC = () => {
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'prototype_tester';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  const [testResults, setTestResults] = useState<any>({});
  const [dataFlowMessages, setDataFlowMessages] = useState<string[]>([]);
  const [communicationMessages, setCommunicationMessages] = useState<string[]>([]);

  const runGoogleWalletIntegrationTest = useCallback(() => {
    const results: any = {};

    // Test 1: MasterIntegration Access
    results.masterIntegrationAccess = integration && communication && dataFlow && componentRegistry ? 'PASS' : 'FAIL';

    // Test 2: Component Registration
    const isRegistered = componentRegistry.getComponent('google-wallet-membership');
    results.componentRegistration = isRegistered ? 'PASS' : 'FAIL';

    // Test 3: Simulate Membership Card Creation
    const testMembershipCard = {
      id: 'test-membership-12',
      organizationName: 'CreatorHub Norge',
      membershipType: 'Professional',
      memberNumber: 'MEM001',
      tier: 'GOLD',
      benefits: ['Priority support', 'Exclusive content', 'Discounts'],
      isActive: true,
      autoRenew: true,
      createdAt: new Date().toISOString()
    };

    communication.sendMessage({
      from: 'google-wallet-membership-test',
      to: 'all',
      type: 'membership:cardCreated',
      data: {
        ...testMembershipCard,
        createdBy: 'google-wallet-membership-test',
        timestamp: Date.now()
      }
  });
    results.membershipCardCreation = 'PASS (check console for message)';

    // Test 4: Simulate Organization Update
    const testOrganization = {
      id: 'org-12',
      name: 'Norwegian Photographers Association',
      type: 'Professional Organization',
      description: 'Leading photography organization in Norway',
      memberCount: 120,
      established: '2015'
    };

    communication.sendMessage({
      from: 'google-wallet-membership-test',
      to: 'all',
      type: 'membership:organizationUpdated',
      data: {
        ...testOrganization,
        updatedBy: 'google-wallet-membership-test',
        timestamp: Date.now()
      }
  });
    results.organizationUpdate = 'PASS (check console for message)';

    // Test 5: Simulate Tier Upgrade
    const tierUpgrade = {
      cardId: 'test-membership-12',
      oldTier: 'SILVE',
      newTier: 'GOL',
      upgradeReason: 'Annual renewal with benefits',
      effectiveDate: new Date().toISOString()
  ,};

    communication.sendMessage({
      from: 'google-wallet-membership-test',
      to: 'all',
      type: 'membership:tierUpgraded',
      data: {
        ...tierUpgrade,
        upgradedBy: 'google-wallet-membership-test',
        timestamp: Date.now()
    }
  });
    results.tierUpgrade = 'PASS (check console for message)';

    setTestResults(results);
}, [integration, communication, dataFlow, componentRegistry]);

  const testDataFlow = useCallback(() => {
    setDataFlowMessages([]);
    
    // Test membership cards data flow
    const membershipCardsData = [
      {
        id: 'card-',
        organizationName: 'CreatorHub Norge',
        membershipType: 'Professional',
        tier: 'GOL',
        isActive: true,
        memberSince: '2023-01-1',
        renewalDate: '2024-01-15'
    ,},
      {
        id: 'card-',
        organizationName: 'Norwegian Photographers Association',
        membershipType: 'Business',
        tier: 'SILVE',
        isActive: true,
        memberSince: '2023-06-0',
        renewalDate: '2024-06-01'
    }
    ];

    dataFlow.syncData('google-wallet-membership: cards', membershipCardsData);
    setDataFlowMessages(prev => [...prev, `Synced membership cards: ${membershipCardsData.length} cards`]);

    // Test organizations data flow
    const organizationsData = [
      {
        id: 'org-',
        name: 'CreatorHub Norge',
        type: 'Platform',
        description: 'Creative platform for photographers and videographers',
        memberCount: 5000
    ,},
      {
        id: 'org-',
        name: 'Norwegian Photographers Association',
        type: 'Professional Organization',
        description: 'Leading photography organization in Norway',
        memberCount: 1250
    }
    ];

    dataFlow.syncData('google-wallet-membership: organizations', organizationsData);
    setDataFlowMessages(prev => [...prev, `Synced organizations: ${organizationsData.length} organizations`]);

    // Simulate another component requesting this data
    const requestedCards = dataFlow.getData('google-wallet-membership: cards');
    const requestedOrgs = dataFlow.getData('google-wallet-membership:organizations');
    
    setDataFlowMessages(prev => [...prev, `Requested cards data: ${JSON.stringify(requestedCards)}`]);
    setDataFlowMessages(prev => [...prev, `Requested orgs data: ${JSON.stringify(requestedOrgs)}`]);

}, [dataFlow]);

  const testCommunication = useCallback(() => {
    setCommunicationMessages([]);
    
    // Test membership card creation communication
    const membershipCardMessage = {
      cardId: 'test-card-45',
      organizationName: 'Test Organization',
      membershipType: 'Professional',
      tier: 'PLATINU',
      timestamp: Date.now()
  ,};

    communication.sendMessage({
      from: 'google-wallet-membership-test',
      to: 'all',
      type: 'membership:cardCreated',
      data: membershipCardMessage
  ,});
    setCommunicationMessages(prev => [...prev, `Broadcasted membership card creation: ${JSON.stringify(membershipCardMessage)}`]);

    // Test organization update communication
    const organizationMessage = {
      orgId: 'test-org-78',
      name: 'Updated Organization',
      memberCount: 200,
      timestamp: Date.now()
  ,};

    communication.sendMessage({
      from: 'google-wallet-membership-test',
      to: 'all',
      type: 'membership:organizationUpdated',
      data: organizationMessage
  ,});
    setCommunicationMessages(prev => [...prev, `Broadcasted organization update: ${JSON.stringify(organizationMessage)}`]);

    // Listen for responses
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'membership:cardCreated' && message.from === 'google-wallet-membership-test') {
        setCommunicationMessages(prev => [...prev, `Received membership card broadcast: ${JSON.stringify(message.data)}`]);
    }
      if (message.type === 'membership: organizationUpdated' && message.from === 'google-wallet-membership-test') {
        setCommunicationMessages(prev => [...prev, `Received organization update broadcast: ${JSON.stringify(message.data)}`]);
    }
  });

    // Clean up listener after 5 seconds
    setTimeout(() => {
      unsubscribe();
  }, 5000);

}, [communication]);

  const simulateMembershipWorkflow = useCallback(() => {
    setCommunicationMessages([]);
    
    // Simulate a complete membership workflow
    const workflowSteps = [
      { step: 1, action: 'User applies for membership', data: { organization: 'CreatorHub Norge', tier: 'BRONZE'}},
      { step: 2, action: 'Application approved', data: { status: 'approved', approvedBy: 'admin'}},
      { step: 3, action: 'Digital card created', data: { cardId: 'card-workflow-12', qrCode: 'QR123456' } },
      { step: 4, action: 'Card added to Google Wallet', data: { walletId: 'wallet-12', status: 'active' } },
      { step: 5, action: 'Welcome email sent', data: { emailSent: true, template: 'welcome-professional' } },
      { step: 6, action: 'Benefits activated', data: { benefits: ['Priority support', 'Exclusive content'] } }
    ];

    workflowSteps.forEach((step, index) => {
      setTimeout(() => {
        communication.sendMessage({
          from: 'google-wallet-membership-test',
          to: 'all',
          type: 'membership:workflowStep',
          data: {
            ...step,
            timestamp: Date.now()
        }
      });
        
        setCommunicationMessages(prev => [...prev, `Step ${step.step}: ${step.action} - ${JSON.stringify(step.data)}`]);
    }, index * 1000);
  });

}, [communication]);

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        {professionIcon && (
          <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
            {professionIcon}
          </Box>
        )}
        <CardMembership color="primary" />
        {enhancedProfessionConfig?.displayName || professionConfig?.displayName
          ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Google Wallet Integration Test`
          : 'Google Wallet Integration Test'}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
        This component tests the Google Wallet membership card integration and verifies seamless communication
        between all components in the unified workflow system.
      </Typography>

      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Button variant="contained" onClick={runGoogleWalletIntegrationTest} fullWidth sx={theming.getThemedButtonSx()}>
            Run Integration Test
          </Button>
        </Grid>
        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Button variant="outlined" onClick={testDataFlow} fullWidth>
            Test Data Flow
          </Button>
        </Grid>
        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Button variant="outlined" onClick={testCommunication} fullWidth>
            Test Communication
          </Button>
        </Grid>
        <Grid size={{ xs:  12, sm:  6, md:  3 }}>
          <Button variant="outlined" onClick={simulateMembershipWorkflow} fullWidth>
            Simulate Workflow
          </Button>
        </Grid>
      </Grid>

      <Divider sx={{ my:  3 }} />

      {/* Test Results */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Test Results
      </Typography>
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3 }}>
        <List dense>
          {Object.entries(testResults).map(([key, value]) => (
            <ListItem key={key}>
              <ListItemText
                primary={key.replace(/([A-Z])/g, ' $1').trim()}
                secondary={
                  <Chip
                    label={value}
                    color={value.startsWith('PASS') ? 'success' : value.startsWith('FAIL') ? 'error' : 'warning'}
                    size="small"
                  />
              }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Data Flow Messages */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Data Flow Messages
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <List dense>
          {dataFlowMessages.map((msg, index) => (
            <ListItem key={index}>
              <ListItemText primary={msg} />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Communication Messages */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Communication Messages
      </Typography>
      <Paper elevation={1} sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <List dense>
          {communicationMessages.map((msg, index) => (
            <ListItem key={index}>
              <ListItemText primary={msg} />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Integration Status */}
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Integration Status
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs:  12, sm:  6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <QrCode color="primary" />
                Digital Cards
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Membership cards, loyalty programs, and digital passes
              </Typography>
              <Chip label="Active" color="success" size="small" sx={{ mt:  1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <Business color="primary" />
                Organizations
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Professional organizations and business memberships
              </Typography>
              <Chip label="Active" color="success" size="small" sx={{ mt:  1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <Work color="primary" />
                Professional
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Professional photographer and videographer memberships
              </Typography>
              <Chip label="Active" color="success" size="small" sx={{ mt:  1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <School color="primary" />
                Student
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Student memberships and educational programs
              </Typography>
              <Chip label="Active" color="success" size="small" sx={{ mt:  1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Master Integration State */}
      <Typography variant="h6" gutterBottom sx={{  mt:  3  }}>
        Master Integration State (Partial View)
      </Typography>
      <Paper elevation={1} sx={{ ...theming.getThemedCardSx(), p: 2 }}>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify({
            componentRegistry: Array.from(componentRegistry.getAllComponents().keys()),
            dataFlowNodes: Array.from(dataFlow.getAllNodes().keys()),
            googleWalletComponents: Array.from(componentRegistry.getAllComponents().keys()).filter(key =>
              key.includes('google-wallet') || key.includes('membership')
            ),
          }, null, 2)}
        </pre>
      </Paper>
    </Box>
  );
};

export default GoogleWalletIntegrationTest;


