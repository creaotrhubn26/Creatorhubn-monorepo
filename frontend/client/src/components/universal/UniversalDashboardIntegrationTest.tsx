/**
 * UniversalDashboard Integration Test
 * Tests if all components in UniversalDashboard are properly wired to communicate with each other
 */

import React, { useEffect, useState } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  Button,
  Divider,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  WarningAmber as WarningAmberIcon,
  Cancel as CancelIcon,
  HelpOutline as HelpOutlineIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useUniversalDashboard } from './UniversalDashboardContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface ComponentTestResult {
  componentName: string;
  hasContextAccess: boolean;
  hasIntegrationAccess: boolean;
  canBroadcast: boolean;
  canListen: boolean;
  canSyncData: boolean;
  status: 'pass' | 'fail' | 'partial';
  issues: string[]
}

interface UniversalDashboardIntegrationTestProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId?: string;
  projectId?: string;
}

const UniversalDashboardIntegrationTest: React.FC<UniversalDashboardIntegrationTestProps> = ({ 
  profession = 'photographer',
  userId,
  projectId,
}) => {
  const { user } = useAuth();
  const { state, broadcastChange, requestData, syncWithComponent } = useUniversalDashboard();
  const { integration, communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [testResults, setTestResults] = useState<ComponentTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [smokeResults, setSmokeResults] = useState<Record<string, { status: 'pass' | 'fail' | 'pending'; message: string }>>({
    showcasePublisher: { status: 'pending', message: 'Not run yet' },
    worklog: { status: 'pending', message: 'Not run yet' },
    landingVideo: { status: 'pending', message: 'Not run yet' },
  });
  const [smokeRunning, setSmokeRunning] = useState<{ showcasePublisher: boolean; worklog: boolean; landingVideo: boolean }>({
    showcasePublisher: false,
    worklog: false,
    landingVideo: false,
  });

  // List of components that should be integrated
  const componentsToTest = [
    'StoryArcStudio',
    'CustomerInquiryCenter',
    'SmartWorkflowBuilder',
    'FotografOrchestrator',
    'VideografOrchestrator',
    'MusikkProdusentOrchestrator',
    'VendorOrchestrator',
    'ShowcaseAdmin',
    'PhotoEnhancementSuite',
    'AudioEnhancementSuite',
    'IntegratedEmailCenter',
    'UniversalDashboard',
  ];

  const runIntegrationTest = async () => {
    setIsRunning(true);
    const results: ComponentTestResult[] = [];

    for (const componentName of componentsToTest) {
      const result: ComponentTestResult = {
        componentName,
        hasContextAccess: false,
        hasIntegrationAccess: false,
        canBroadcast: false,
        canListen: false,
        canSyncData: false,
        status: 'fail',
        issues: []
  };

      try {
        // Test 1: Context Access
        if (state && typeof state === 'object') {
          result.hasContextAccess = true;
    } else {
          result.issues.push('Cannot access UniversalDashboard context state, ');
      }

        // Test 2: Integration Access
        if (integration && communication && dataFlow) {
          result.hasIntegrationAccess = true;
    } else {
          result.issues.push('Cannot access MasterIntegration system, ');
      }

        // Test 3: Broadcast Capability
        try {
          await new Promise((resolve) => {
            broadcastChange('test:broadcast,', { component: componentName, timestamp: Date.now(),});
            setTimeout(resolve, 100);
        });
          result.canBroadcast = true;
      } catch (error) {
          result.issues.push('Cannot broadcast messages, ');
      }

        // Test 4: Listen Capability
        try {
          const unsubscribe = communication.onMessage((message: any) => {
            if (message.type === 'test:broadcast' && message.data.component === componentName) {
              result.canListen = true;
        }
        });
          setTimeout(() => unsubscribe(), 200);
      } catch (error) {
          result.issues.push('Cannot listen to messages, ');
      }

        // Test 5: Data Sync Capability
        try {
          syncWithComponent(componentName, 'test:data', { test: true });
          result.canSyncData = true;
        } catch (error) {
          result.issues.push('Cannot sync data with other components');
        }

        // Determine overall status
        const passedTests = [
          result.hasContextAccess,
          result.hasIntegrationAccess,
          result.canBroadcast,
          result.canListen,
          result.canSyncData
        ].filter(Boolean).length;

        if (passedTests === 5) {
          result.status = 'pass';
      } else if (passedTests >= 3) {
          result.status = 'partial';
      } else {
          result.status = 'fail';
      }

    } catch (error) {
        result.issues.push(`Test error: ${error}`);
    }

      results.push(result);
  }

    setTestResults(results);
    setIsRunning(false);
};

  const testDataFlow = async () => {
    console.log('🔄 Testing Data Flow...');
    
    // Test project selection flow
    const testProject = {
      id: 'test-project-',
      title: 'Test Project',
      clientName: 'Test Client',
      status: 'active'
};

    // Broadcast project selection
    broadcastChange('project: selected', testProject);
    console.log('✅ Project selection broadcasted');

    // Test client selection flow
    const testClient = {
      id: 'test-client-',
      name: 'Test Client',
      email: 'test@example.com'
};

    broadcastChange('client: selected', testClient);
    console.log('✅ Client selection broadcasted');

    // Test notification flow
    broadcastChange('notification: added', {
      type: 'info',
      title: 'Integration Test',
      message: 'Testing component communication',
      read: false
    });
    console.log('✅ Notification broadcasted');

    // Test data sync
    syncWithComponent('test-component', 'test:data', {
      message: 'Data sync test',
      timestamp: Date.now()
    });
    console.log('✅ Data sync test completed');
  };

  const testComponentCommunication = async () => {
    console.log('🔗 Testing Component Communication...');

    // Test if components can request data from each other
    try {
      const data = await requestData('universal-dashboard', 'projects');
      console.log('✅ Data request successful: ', data);
    } catch (error) {
      console.log('❌ Data request failed:', error);
    }

    // Test if components can send messages to each other
    try {
      communication.sendMessage({
        from: 'test-component',
        to: 'universal-dashboard',
        type: 'test:message',
        data: { test: true },
        priority: 'medium'
      });
      console.log('✅ Message sending successful');
    } catch (error) {
      console.log('❌ Message sending failed:', error);
    }
  };

  const runShowcasePublisherSmoke = async () => {
    const testProfession = profession || 'videographer';
    setSmokeRunning((prev) => ({ ...prev, showcasePublisher: true }));
    setSmokeResults((prev) => ({
      ...prev,
      showcasePublisher: { status: 'pending', message: 'Running...' },
    }));

    try {
      await apiRequest(`/api/showcase/categories?profession=${encodeURIComponent(testProfession)}`);
      await apiRequest(`/api/showcase/profession/${encodeURIComponent(testProfession)}`);
      setSmokeResults((prev) => ({
        ...prev,
        showcasePublisher: { status: 'pass', message: 'Showcase endpoints responding' },
      }));
    } catch (error) {
      setSmokeResults((prev) => ({
        ...prev,
        showcasePublisher: {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Showcase smoke test failed',
        },
      }));
    } finally {
      setSmokeRunning((prev) => ({ ...prev, showcasePublisher: false }));
    }
  };

  const runWorklogSmoke = async () => {
    const resolvedProjectId = projectId || userId || user?.id;
    if (!resolvedProjectId) {
      setSmokeResults((prev) => ({
        ...prev,
        worklog: { status: 'fail', message: 'Missing projectId for worklog test' },
      }));
      return;
    }

    setSmokeRunning((prev) => ({ ...prev, worklog: true }));
    setSmokeResults((prev) => ({
      ...prev,
      worklog: { status: 'pending', message: 'Running...' },
    }));

    try {
      await apiRequest(`/api/projects/${encodeURIComponent(resolvedProjectId)}/worklog`);
      await apiRequest(`/api/projects/${encodeURIComponent(resolvedProjectId)}/worklog/stats`);
      setSmokeResults((prev) => ({
        ...prev,
        worklog: { status: 'pass', message: 'Worklog endpoints responding' },
      }));
    } catch (error) {
      setSmokeResults((prev) => ({
        ...prev,
        worklog: {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Worklog smoke test failed',
        },
      }));
    } finally {
      setSmokeRunning((prev) => ({ ...prev, worklog: false }));
    }
  };

  const runLandingVideoSmoke = async () => {
    setSmokeRunning((prev) => ({ ...prev, landingVideo: true }));
    setSmokeResults((prev) => ({
      ...prev,
      landingVideo: { status: 'pending', message: 'Running...' },
    }));

    const extractVideoUrl = (data: any) => data?.sections?.video?.videoUrl;

    try {
      const [desktop, mobile] = await Promise.all([
        apiRequest('/api/pages/landing-desktop/published'),
        apiRequest('/api/pages/landing-mobile/published'),
      ]);

      const desktopVideo = extractVideoUrl(desktop);
      const mobileVideo = extractVideoUrl(mobile);
      const hasVideo = Boolean(desktopVideo || mobileVideo);

      setSmokeResults((prev) => ({
        ...prev,
        landingVideo: {
          status: hasVideo ? 'pass' : 'fail',
          message: hasVideo
            ? `Published video found (${desktopVideo ? 'desktop' : ''}${desktopVideo && mobileVideo ? ', ' : ''}${mobileVideo ? 'mobile' : ''})`
            : 'No published video found on landing pages',
        },
      }));
    } catch (error) {
      setSmokeResults((prev) => ({
        ...prev,
        landingVideo: {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Landing page video smoke test failed',
        },
      }));
    } finally {
      setSmokeRunning((prev) => ({ ...prev, landingVideo: false }));
    }
  };

  useEffect(() => {
    // Set up message listener for testing
    const unsubscribe = communication.onMessage((message: any) => {
      console.log('📨 Message received:', message);
    });

    return unsubscribe;
}, [communication]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'success';
      case 'partial': return 'warning';
      case 'fail': return 'error';
      default: return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircleIcon fontSize="small" color="success" />;
      case 'partial': return <WarningAmberIcon fontSize="small" color="warning" />;
      case 'fail': return <CancelIcon fontSize="small" color="error" />;
      default: return <HelpOutlineIcon fontSize="small" color="disabled" />;
    }
  };

  const boolIcon = (ok: boolean) =>
    ok ? <CheckCircleIcon sx={{ fontSize: 14, verticalAlign: 'middle', color: 'success.main' }} />
       : <CancelIcon sx={{ fontSize: 14, verticalAlign: 'middle', color: 'error.main' }} />;

  return (
    <Box sx={{ p:  3 }}>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ color: theming.colors.primary, display: 'inline-flex', alignItems: 'center', gap: 1 }}
      >
        <LinkIcon />
        UniversalDashboard Integration Test
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
        Testing if all components in UniversalDashboard can communicate with each other through the data context.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="contained" 
          onClick={runIntegrationTest}
          disabled={isRunning}
         sx={theming.getThemedButtonSx()}>
          {isRunning ? 'Running Tests...' : 'Run Integration Test'}
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={testDataFlow}
        >
          Test Data Flow
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={testComponentCommunication}
        >
          Test Communication
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Admin Smoke Tests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quick checks for Showcase Publisher and Worklog endpoints.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Showcase Publisher
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Chip
                label={smokeResults.showcasePublisher.status.toUpperCase()}
                color={getStatusColor(smokeResults.showcasePublisher.status)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {smokeResults.showcasePublisher.message}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              onClick={runShowcasePublisherSmoke}
              disabled={smokeRunning.showcasePublisher}
              sx={theming.getThemedButtonSx()}
            >
              {smokeRunning.showcasePublisher ? 'Testing...' : 'Run Showcase Smoke Test'}
            </Button>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Worklog
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Chip
                label={smokeResults.worklog.status.toUpperCase()}
                color={getStatusColor(smokeResults.worklog.status)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {smokeResults.worklog.message}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              onClick={runWorklogSmoke}
              disabled={smokeRunning.worklog}
              sx={theming.getThemedButtonSx()}
            >
              {smokeRunning.worklog ? 'Testing...' : 'Run Worklog Smoke Test'}
            </Button>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Published Landing Video
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Chip
                label={smokeResults.landingVideo.status.toUpperCase()}
                color={getStatusColor(smokeResults.landingVideo.status)}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {smokeResults.landingVideo.message}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              onClick={runLandingVideoSmoke}
              disabled={smokeRunning.landingVideo}
              sx={theming.getThemedButtonSx()}
            >
              {smokeRunning.landingVideo ? 'Testing...' : 'Run Landing Video Test'}
            </Button>
          </CardContent>
        </Card>
      </Stack>

      {testResults.length > 0 && (
        <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Test Results
            </Typography>

            <List>
              {testResults.map((result) => (
                <ListItem key={result.componentName} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(result.status)}
                        <Typography variant="subtitle1">
                          {result.componentName}
                        </Typography>
                        <Chip 
                          label={result.status.toUpperCase()} 
                          color={getStatusColor(result.status) as any}
                          size="small"
                        />
                      </Box>
                  }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" component="div">
                          Context: {boolIcon(result.hasContextAccess)} |{' '}
                          Integration: {boolIcon(result.hasIntegrationAccess)} |{' '}
                          Broadcast: {boolIcon(result.canBroadcast)} |{' '}
                          Listen: {boolIcon(result.canListen)} |{' '}
                          Sync: {boolIcon(result.canSyncData)}
                        </Typography>
                        {result.issues.length > 0 && (
                          <Box sx={{ mt:  1 }}>
                            {result.issues.map((issue, index) => (
                              <Typography key={index} variant="caption" color="error" display="block">
                                • {issue}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Current Context State
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap:  2 }}>
            <Box>
              <Typography variant="subtitle2">Projects</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.projects.length} projects
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Clients</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.clients.length} clients
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Equipment</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.equipment.length} items
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Notifications</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.notifications.length} notifications
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Connected Components</Typography>
              <Typography variant="body2" color="text.secondary">
                {state.connectedComponents.length} components
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="subtitle2">Last Sync</Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date(state.lastSync).toLocaleTimeString()}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mt:  3 }}>
        <Typography variant="body2">
          <strong>Integration Status: </strong> {testResults.length > 0 ? 
            `${testResults.filter(r => r.status === 'pass').length}/${testResults.length} components fully integrated` : 
           'Run test to check integration status'
        }
        </Typography>
      </Alert>
    </Box>
  );
};

export default UniversalDashboardIntegrationTest;




