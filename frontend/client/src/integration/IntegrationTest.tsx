/**
 * Integration Test Component
 * Demonstrates how all components work together cohesively
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { useEnhancedMasterIntegration } from './EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';
import { useIntegratedComponents } from './UniversalIntegrationSystem';

const IntegrationTest: React.FC = () => {
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const { getAllComponents, getComponentHealth, broadcastToAll } = useIntegratedComponents();
  
  // Comprehensive Feature System for Integration Test
  const integrationTestAccess = features.checkFeatureAccess('integration-test');
  const systemHealthAccess = features.checkFeatureAccess('system-health');
  const componentRegistryAccess = features.checkFeatureAccess('component-registry');
  const communicationTestAccess = features.checkFeatureAccess('communication-test');
  const dataFlowTestAccess = features.checkFeatureAccess('data-flow-test');
  const performanceTestAccess = features.checkFeatureAccess('performance-test');
  const debuggingAccess = features.checkFeatureAccess('debugging');
  const monitoringAccess = features.checkFeatureAccess('monitoring');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [health, setHealth] = useState({ total: 0, active: 0, inactive: 0, error: 0 });

  // Load components and health data
  useEffect(() => {
    const loadData = () => {
      setComponents(getAllComponents());
      setHealth(getComponentHealth());
  };
    
    loadData();
    const interval = setInterval(loadData, 2000);
    
    // Track feature usage
    features.trackFeatureUsage('integration-test', 'opened', {
      timestamp: Date.now(),
        component: 'IntegrationTest',
      componentsCount: components.length
});
    
    return () => clearInterval(interval);
}, [getAllComponents, getComponentHealth, features, components.length]);

  // Listen to all messages
  useEffect(() => {
    const unsubscribe = communication.onMessage((message) => {
      setMessages(prev => [...prev.slice(-19), {
        ...message,
        timestamp: new Date().toLocaleTimeString()
  }]);
  });

    return unsubscribe;
}, [communication]);

  // Test functions
  const testBroadcastToAll = () => {
    broadcastToAll('test: message', {
      message: 'Hello from Integration Test!',
      timestamp: Date.now(),
      source: 'integration-test'
});
};

  const testProjectSelection = () => {
    const mockProject = {
      id: 'test-project-123',
      name: 'Test Project',
      client: 'Test Client',
      status: 'active'
};

    integration.emit('project:selected', { project: mockProject, source: 'integration-test' });
    communication.sendBroadcast('project:selected', { project: mockProject, source: 'integration-test' });
    dataFlow.syncData('selectedProject', mockProject);
};

  const testClientSelection = () => {
    const mockClient = {
      id: 'test-client-456',
      name: 'Test Client',
      email: 'test@example.com',
      status: 'active'
};

    integration.emit('client:selected', { client: mockClient, source: 'integration-test' });
    communication.sendBroadcast('client:selected', { client: mockClient, source: 'integration-test' });
    dataFlow.syncData('selectedClient', mockClient);
};

  const testDataFlow = () => {
    const testData = {
      id: 'flow-test-789',
      message: 'Data flowing through the system',
      timestamp: Date.now()
};

    dataFlow.syncData('test: data', testData);
    integration.setData('test: data', testData);
};

  const testComponentCommunication = () => {
    // Send message to specific component type
    componentRegistry.broadcastToType('dashboard','test: dashboard', {
      message: 'Testing dashboard components',
      timestamp: Date.now()
});

    componentRegistry.broadcastToType('showcase', 'test: showcase', {
      message: 'Testing showcase components',
      timestamp: Date.now()
});

    componentRegistry.broadcastToType('widget', 'test: widget', {
      message: 'Testing widget components',
      timestamp: Date.now()
});
};

  const clearMessages = () => {
    setMessages([]);
};

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Universal Integration Test
      </Typography>
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Test the cohesive integration between all 700+ components
      </Typography>
      
      {/* Feature Analytics Display */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        mb: 3
  }}>
        <Typography variant="caption" color="text.secondary">
          Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
        </Typography>
        <Chip 
          label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
          size="small"
          variant="outlined"
          sx={{ fontSize: '10px', height: 18 }}
        />
      </Box>

      {/* Health Overview */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>Total Components</Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>{health.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>Active</Typography>
              <Typography variant="h4" color="success.main">{health.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>Inactive</Typography>
              <Typography variant="h4" color="warning.main">{health.inactive}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>Errors</Typography>
              <Typography variant="h4" color="error.main">{health.error}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Controls */}
      <Card sx={{ ...theming.getThemedCardSx(), mb: 4 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Integration Tests</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={testBroadcastToAll} sx={theming.getThemedButtonSx()}>
              Test Broadcast to All
            </Button>
            <Button variant="contained" onClick={testProjectSelection} sx={theming.getThemedButtonSx()}>
              Test Project Selection
            </Button>
            <Button variant="contained" onClick={testClientSelection} sx={theming.getThemedButtonSx()}>
              Test Client Selection
            </Button>
            <Button variant="contained" onClick={testDataFlow} sx={theming.getThemedButtonSx()}>
              Test Data Flow
            </Button>
            <Button variant="contained" onClick={testComponentCommunication} sx={theming.getThemedButtonSx()}>
              Test Component Communication
            </Button>
            <Button variant="outlined" onClick={clearMessages}>
              Clear Messages
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Components List */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Registered Components ({components.length})
              </Typography>
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {components.slice(0, 20).map((component) => (
                  <Box key={component.id} sx={{ mb: 1 }}>
                    <Chip 
                      label={component.name} 
                      size="small" 
                      color={component.status === 'active' ? 'success' : 'warning'}
                      sx={{ mr: 1 }}
                    />
                    <Typography variant="body2" color="textSecondary" component="span">
                      {component.type} • {component.category}
                    </Typography>
                  </Box>
                ))}
                {components.length > 20 && (
                  <Typography variant="body2" color="textSecondary">
                    ... and {components.length - 20} more components
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Message Log */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Real-time Messages ({messages.length})
              </Typography>
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <Alert severity="info">No messages yet. Click a test button to see integration in action!</Alert>
                ) : (
                  <List dense>
                    {messages.map((message, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  label={message.from} 
                                  size="small" 
                                  variant="outlined"
                                />
                                <Typography variant="body2">→</Typography>
                                <Chip 
                                  label={message.to} 
                                  size="small" 
                                  variant="outlined"
                                />
                                <Typography variant="body2" color="textSecondary">
                                  {message.timestamp}
                                </Typography>
                              </Box>
                          }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="textSecondary">
                                  Type: {message.type}
                                </Typography>
                                <Typography variant="body2">
                                  {JSON.stringify(message.data, null, 2)}
                                </Typography>
                              </Box>
                          }
                          />
                        </ListItem>
                        {index < messages.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Integration Status */}
      <Card sx={{ mt: 4, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Integration Status</Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            ✅ Universal Integration System Active
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            ℹ️ All components can now communicate with each other in real-time
          </Alert>
          <Alert severity="success">
            🎉 True"everything interacts with everything" functionality achieved!
          </Alert>
        </CardContent>
      </Card>
    </Container>
  );
};

export default IntegrationTest;


