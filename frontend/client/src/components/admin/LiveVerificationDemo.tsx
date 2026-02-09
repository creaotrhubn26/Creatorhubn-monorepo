import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  Chip,
  Paper,
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
  Switch,
  FormControlLabel,
  Rating,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Refresh,
  BugReport,
  Send,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Person,
  Email,
  PriorityHigh,
  Category,
  Visibility
} from '@mui/icons-material';
import { mockBackendService } from '../../services/MockBackendService';
import UniversalChatWidget from '../chat/UniversalChatWidget';

interface LiveDemoState {
  isRunning: boolean;
  currentStep: string;
  progress: number;
  feedbackItems: any[];
  selectedFeedback: any | null;
  showChatWidget: boolean;
  showCreateDialog: boolean;
  showValidationDialog: boolean;
  validationData: any;
  notifications: any[];
}

export default function LiveVerificationDemo() {
  // Theming system
  const theming = useTheming('prototype_tester');

  const [demoState, setDemoState] = useState<LiveDemoState>({
    isRunning: false,
    currentStep: 'idle',
    progress:  0,
    feedbackItems:  [],
    selectedFeedback: null,
    showChatWidget: false,
    showCreateDialog: false,
    showValidationDialog: false,
    validationData: {
      title: '',
      description: ', ',
      feedbackType: 'bug',
      priority: 'medium',
      userEmail: 'demo@example.com',
      profession: 'photographer'
},
    notifications: []
});

  // Load initial feedback data
  useEffect(() => {
    loadFeedbackData();
}, []);

  const loadFeedbackData = async () => {
    try {
      const response = await mockBackendService.getFeedbackList();
      setDemoState(prev => ({ ...prev, feedbackItems: response.feedback }));
  } catch (error) {
      console.error('Failed to load feedback data: ', error);
  }
};

  const startLiveDemo = () => {
    setDemoState(prev => ({ 
      ...prev, 
      isRunning: true, 
      currentStep: 'initializing',
      showChatWidget: true,
      notifications: []
}));
    
    // Simulate the complete workflow
    simulateVerificationWorkflow();
};

  const simulateVerificationWorkflow = async () => {
    try {
      // Step 1: Create a new feedback item (simulate user reporting via chat)
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'Creating feedback from chat report...',
        progress: 10 }));
      
      const newFeedback = await mockBackendService.createFeedback({
        title: 'Live Demo: Photo Upload Issue, ',
        description: 'This is a live demonstration of the verification system. The photo upload feature is not working properly.',
        feedbackType: 'bug',
        priority: 'high',
        userEmail: 'demo@example.com',
        profession: 'photographer',
        component: 'PhotoUpload',
        tags: ['upload','demo','verification']
      });

      addNotification('success','✅ New feedback created from chat widget report');
      await loadFeedbackData();
      
      // Step 2: AI Analysis
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'AI analyzing the problem...',
        progress: 25 }));
      
      const aiAnalysis = await mockBackendService.getAIAnalysis(newFeedback.feedback.id);
      addNotification('info','🤖 AI analysis completed - fix suggestions generated');
      
      // Step 3: Pre-deployment health check
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'Checking system health before deployment...',
        progress: 40 }));
      
      const preHealth = await mockBackendService.getSystemHealth();
      addNotification('info','🏥 Pre-deployment health check completed');

      // Step 4: Deploy fix
      setDemoState(prev => ({
        ...prev,
        currentStep: 'Deploying fix...',
        progress: 55 }));

      const deployment = await mockBackendService.deployFeedbackFix(
        newFeedback.feedback.id,
        aiAnalysis.suggestedFixes[0].id
      );
      addNotification('success','🚀 Fix deployed successfully');
      
      // Step 5: Automated testing
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'Running automated tests...',
        progress: 70 }));
      
      const testResults = await mockBackendService.runAutomatedTests(
        newFeedback.feedback.id, 
        aiAnalysis.suggestedFixes[0].id
      );
      addNotification('success', `🧪 Automated tests completed - ${testResults.summary.passed}/${testResults.summary.total} passed`);
      
      // Step 6: Regression testing
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'Running regression tests...',
        progress: 85 }));
      
      const regressionResults = await mockBackendService.runRegressionTests(
        newFeedback.feedback.id, 
        aiAnalysis.suggestedFixes[0].id, 
        deployment.affectedComponents
      );
      addNotification('success', `🔄 Regression tests completed - ${regressionResults.summary.passed}/${regressionResults.summary.total} passed`);
      
      // Step 7: Request user validation
      setDemoState(prev => ({ 
        ...prev, 
        currentStep: 'Requesting user validation...',
        progress: 95 }));
      
      await mockBackendService.requestUserValidation(
        newFeedback.feedback.id, 
        aiAnalysis.suggestedFixes[0].id, 
        `${window.location.origin}/validate-fix/${newFeedback.feedback.id}/${aiAnalysis.suggestedFixes[0].id}`
      );
      
      addNotification('info','📧 User validation request sent');

      // Step 8: Update verification data
      const verificationData = {
        automatedTests: {
          status: 'passed',
          testResults: testResults.tests,
          coverage: testResults.coverage
        },
        regressionTests: {
          status: 'passed',
          affectedComponents: deployment.affectedComponents,
          testResults: regressionResults.tests
        },
        userValidation: {
          status: 'sent',
          validationRequest: {
            sentAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            validationUrl: `${window.location.origin}/validate-fix/${newFeedback.feedback.id}/${aiAnalysis.suggestedFixes[0].id}`
          }
        },
        systemHealth: {
          preDeployment: preHealth,
          postDeployment: preHealth, // Same for demo
          healthCheckResults: []
        }
      };

      await mockBackendService.updateVerificationData(
        newFeedback.feedback.id,
        aiAnalysis.suggestedFixes[0].id,
        verificationData
      );

      // Step 9: Complete
      setDemoState(prev => ({
        ...prev,
        currentStep: 'Verification workflow completed!',
        progress: 100,
        selectedFeedback: newFeedback.feedback
      }));

      addNotification('success','🎉 Complete verification workflow executed successfully!');
      await loadFeedbackData();
      
      // Auto-show user validation dialog after 2 seconds
      setTimeout(() => {
        setDemoState(prev => ({ 
          ...prev, 
          showValidationDialog: true,
          validationData: {
            feedbackId: newFeedback.feedback.d,
            fixId: aiAnalysis.suggestedFixes[0].d,
            userConfirmed: false,
            userRating:  0,
            userComments: ', '
      }
      }));
    }, 2000);
      
  } catch (error) {
      console.error('Demo workflow failed:', error);
      addNotification('error', `❌ Demo failed: ${error.message}`);
      setDemoState(prev => ({ ...prev, isRunning: false, currentStep: 'Demo failed',}));
  }
};

  const addNotification = (type: 'success' | 'info' | 'warning' | 'error', message: string) => {
    setDemoState(prev => ({
      ...prev,
      notifications: [
        ...prev.notifications,
        {
          id: Date.now(),
          type,
          message,
          timestamp: new Date()
    }
      ].slice(-10) // Keep only last 10 notifications
  }));
};

  const handleUserValidation = async () => {
    try {
      await mockBackendService.submitUserValidation(
        demoState.validationData.feedbackId,
        demoState.validationData.fixId,
        {
          userConfirmed: demoState.validationData.userConfirmed,
          userComments: demoState.validationData.userComments,
          userRating: demoState.validationData.userRating
        }
      );

      addNotification('success','✅ User validation submitted successfully!');
      setDemoState(prev => ({ ...prev, showValidationDialog: false }));
      await loadFeedbackData();

    } catch (error) {
      addNotification('error', `❌ Validation failed: ${error.message}`);
    }
  };

  const resetDemo = () => {
    setDemoState({
      isRunning: false,
      currentStep: 'idle',
      progress:  0,
      feedbackItems:  [],
      selectedFeedback: null,
      showChatWidget: false,
      showCreateDialog: false,
      showValidationDialog: false,
      validationData: {
        title:', ',
        description: ', ',
        feedbackType: 'bug',
        priority: 'medium',
        userEmail: 'demo@example.com',
        profession: 'photographer'
  },
      notifications: []
});
    loadFeedbackData();
};

  return (
    <Box sx={{ p: 3, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
        🔴 LIVE Verification System Demo
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This is a LIVE demonstration of the complete verification system.
        Watch as we simulate a real problem report through the chat widget
        and see the entire "Fixing Things" workflow in action!
      </Typography>

      {/* Demo Controls */}
      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Demo Controls
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: <Chip 
                  label={demoState.currentStep} 
                  size="small" 
                  color={demoState.isRunning ? 'warning' : 'default'} 
                />
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={theming.getThemedIcon('play')}
                onClick={startLiveDemo}
                disabled={demoState.isRunning}
                sx={{ ...theming.getThemedButtonSx(), bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
              >
                Start Live Demo
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('refresh')}
                onClick={resetDemo}
                disabled={demoState.isRunning}
              >
                Reset
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('visibility')}
                onClick={() => setDemoState(prev => ({ ...prev, showChatWidget: !prev.showChatWidget }))}
              >
                {demoState.showChatWidget ? 'Hide' : 'Show'} Chat Widget
              </Button>
            </Box>
          </Box>

          {demoState.isRunning && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={demoState.progress}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Progress: {demoState.progress}%
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      {demoState.notifications.length > 0 && (
        <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Live Updates
            </Typography>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {demoState.notifications.map((notification) => (
                <Alert 
                  key={notification.id}
                  severity={notification.type}
                  sx={{ mb:  1 }}
                >
                  <Typography variant="body2">
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {notification.timestamp.toLocaleTimeString()}
                  </Typography>
                </Alert>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Feedback List */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Live Feedback Data
              </Typography>
              {demoState.feedbackItems.map((feedback) => (
                <Paper
                  key={feedback.id}
                  sx={{ ...theming.getThemedCardSx(), p: 2, mb: 2, cursor: 'pointer' }}
                  onClick={() => setDemoState(prev => ({ ...prev, selectedFeedback: feedback }))}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                        {feedback.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feedback.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={feedback.status} size="small" color="primary" />
                        <Chip label={feedback.priority} size="small" color="warning" />
                        {feedback.verification && (
                          <Chip
                            label={feedback.verification.userValidation?.status || 'pending'}
                            size="small"
                            color={feedback.verification.userValidation?.status === 'validated' ? 'success' : 'default'}
                          />
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">
                        {feedback.userEmail}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block'}}>
                        {new Date(feedback.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Demo Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                1. Click "Start Live Demo" to begin
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                2. Watch the chat widget for the problem report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                3. Follow the verification workflow steps
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                4. Complete the user validation when prompted
              </Typography>
              <Typography variant="body2" color="text.secondary">
                5. See the final verification status
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chat Widget */}
      {demoState.showChatWidget && (
        <UniversalChatWidget
          profession="photographer"
          userEmail="demo@example.com"
          userId="demo-user"
          isOpen={true}
        />
      )}

      {/* User Validation Dialog */}
      <Dialog open={demoState.showValidationDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ff8c00', color: 'white'}}>
          🔍 User Validation Required
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          <Alert severity="info" sx={{ mb:  3 }}>
            <Typography variant="body2">
              A fix has been deployed for the reported issue. Please test it and let us know if it works!
            </Typography>
          </Alert>
          
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Did this fix resolve your original problem?
            </Typography>
            <Switch
              checked={demoState.validationData.userConfirmed}
              onChange={(e) => setDemoState(prev => ({
                ...prev,
                validationData: { ...prev.validationData, userConfirmed: e.target.checked }
            }))}
              color={demoState.validationData.userConfirmed ? "success" : "error"}
            />
            <Typography variant="body1" sx={{ display:'inline', ml:  1 }}>
              {demoState.validationData.userConfirmed ? "Yes, it's fixed! ✅" : "No, still broken ❌"}
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional comments"
            placeholder="Describe what you tested and any improvements you noticed..."
            value={demoState.validationData.userComments}
            onChange={(e) => setDemoState(prev => ({
              ...prev,
              validationData: { ...prev.validationData, userComments: e.target.value }
          }))}
            sx={{ mb:  3 }}
          />

          <Box sx={{ mb:  2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Rate the fix quality: </Typography>
            <Rating
              value={demoState.validationData.userRating}
              onChange={(_, value) => setDemoState(prev => ({
                ...prev,
                validationData: { ...prev.validationData, userRating: value || 0 }
            }))}
              size="large"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p:  3 }}>
          <Button onClick={handleUserValidation} variant="contained" disabled={demoState.validationData.userRating === 0} sx={theming.getThemedButtonSx()}>
            Submit Validation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


