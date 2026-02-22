import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Alert,
  Chip,
  LinearProgress,
  Paper,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  BugReport,
  AutoFixHigh,
  Science,
  Person,
  HealthAndSafety,
  Send,
  ThumbUp,
  ThumbDown,
} from '@mui/icons-material';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration: number;
  details?: any;
  icon: React.ReactNode;
}

interface VerificationDemo {
  id: string;
  title: string;
  description: string;
  userEmail: string;
  profession: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'analyzing' | 'deploying' | 'testing' | 'validating' | 'verified' | 'failed';
  steps: DemoStep[];
  aiAnalysis?: any;
  verification?: any;
  startTime?: Date;
  endTime?: Date;
}

export default function VerificationSystemDemo() {
  const [isRunning, setIsRunning] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [currentDemo, setCurrentDemo] = useState<VerificationDemo | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showUserValidation, setShowUserValidation] = useState(false);
  const [userValidationData, setUserValidationData] = useState({
    confirmed: false,
    rating:  0,
    comments: ''
});

  // Pre-defined demo scenarios
  const demoScenarios: VerificationDemo[] = [
    {
      id: 'demo-',
      title: 'Photo Upload Broken',
      description: 'Users cannot upload photos to their portfolio. The upload button shows loading but never completes.',
      userEmail: 'photographer@example.com',
      profession: 'photographer',
      priority: 'high',
      status: 'reported',
      steps: [
        {
          id: 'step-',
          title: 'Problem Reported',
          description: 'User reports photo upload issue through chat widget',
          status: 'pending',
          duration: 200,
          icon: <BugReport />
    },
        {
          id: 'step-',
          title: 'AI Analysis',
          description: 'AI analyzes the problem and generates fix suggestions',
          status: 'pending',
          duration: 500,
          icon: theming.getThemedIcon('')
      },
        {
          id: 'step-',
          title: 'Pre-deployment Health Check',
          description: 'System checks current health status before deployment',
          status: 'pending',
          duration: 300,
          icon: <HealthAndSafety />
    },
        {
          id: 'step-',
          title: 'Deploy Fix',
          description: 'Automated deployment of the generated fix',
          status: 'pending',
          duration: 400,
          icon: <Send />
    },
        {
          id: 'step-',
          title: 'Automated Testing',
          description: 'Run automated tests to verify the fix works',
          status: 'pending',
          duration: 600,
          icon: <Science />
    },
        {
          id: 'step-',
          title: 'Regression Testing',
          description: 'Ensure no new problems were introduced',
          status: 'pending',
          duration: 500,
          icon: theming.getThemedIcon('')
      },
        {
          id: 'step-',
          title: 'User Validation',
          description: 'Send validation request to original reporter',
          status: 'pending',
          duration: 0, // User action required
          icon: theming.getThemedIcon('check')
        },
        {
          id: 'step-4',
          title: 'Post-deployment Health Check',
          description: 'Verify system health after deployment',
          status: 'pending',
          duration: 200,
          icon: <HealthAndSafety />
    }
      ]
  },
    {
      id: 'demo-',
      title: 'Dashboard Loading Slow',
      description: 'The photographer dashboard takes 15+ seconds to load, making it unusable.',
      userEmail: 'videographer@example.com',
      profession: 'videographer',
      priority: 'critical',
      status: 'reported',
      steps: [
        {
          id: 'step-',
          title: 'Problem Reported',
          description: 'User reports slow dashboard loading',
          status: 'pending',
          duration: 200,
          icon: <BugReport />
    },
        {
          id: 'step-',
          title: 'AI Analysis',
          description: 'AI identifies performance bottleneck and suggests optimization',
          status: 'pending',
          duration: 400,
          icon: theming.getThemedIcon('')
      },
        {
          id: 'step-',
          title: 'Pre-deployment Health Check',
          description: 'Check current performance metrics',
          status: 'pending',
          duration: 200,
          icon: <HealthAndSafety />
    },
        {
          id: 'step-',
          title: 'Deploy Performance Fix',
          description: 'Deploy database query optimization',
          status: 'pending',
          duration: 300,
          icon: <Send />
    },
        {
          id: 'step-',
          title: 'Performance Testing',
          description: 'Run load tests to verify performance improvement',
          status: 'pending',
          duration: 800,
          icon: <Science />
    },
        {
          id: 'step-',
          title: 'Regression Testing',
          description: 'Ensure other features still work correctly',
          status: 'pending',
          duration: 400,
          icon: theming.getThemedIcon('')
      },
        {
          id: 'step-',
          title: 'User Validation',
          description: 'Ask user to test dashboard loading speed',
          status: 'pending',
          duration:  0,
          icon: theming.getThemedIcon(', ')
      },
        {
          id: 'step-',
          title: 'Post-deployment Health Check',
          description: 'Verify overall system performance',
          status: 'pending',
          duration: 200,
          icon: <HealthAndSafety />
    }
      ]
  }
  ];

  const startDemo = (scenario: VerificationDemo) => {
    setCurrentDemo({ ...scenario, startTime: new Date() });
    setActiveStep(0);
    setIsRunning(true);

    // Start the first step
    executeStep(0, scenario);
};

  const executeStep = (stepIndex: number, demo: VerificationDemo) => {
    if (stepIndex >= demo.steps.length) {
      // Demo completed
      setIsRunning(false);
      setCurrentDemo(prev => prev ? { ...prev, status: 'verified', endTime: new Date() } : null);
      return;
  }

    const step = demo.steps[stepIndex];
    
    // Update step status to running
    setCurrentDemo(prev => {
      if (!prev) return null;
      const updatedSteps = [...prev.steps];
      updatedSteps[stepIndex] = { ...step, status: 'running',};
      return { ...prev, steps: updatedSteps, status: 'analyzing',};
  });

    // Simulate step execution
    setTimeout(() => {
      // Mark step as completed
      setCurrentDemo(prev => {
        if (!prev) return null;
        const updatedSteps = [...prev.steps];
        updatedSteps[stepIndex] = { ...step, status: 'completed',};
        
        let newStatus = prev.status;
        if (stepIndex === 1) newStatus = 'analyzing';
        else if (stepIndex === 3) newStatus = 'deploying';
        else if (stepIndex >= 4 && stepIndex <= 6) newStatus = 'testing';
        else if (stepIndex === 6) {
          newStatus = 'validating';
          setShowUserValidation(true);
          return { ...prev, steps: updatedSteps, status: newStatus };
      }
        
        return { ...prev, steps: updatedSteps, status: newStatus };
    });

      setActiveStep(stepIndex + 1);
      
      // Continue to next step
      if (stepIndex < demo.steps.length - 1) {
        setTimeout(() => executeStep(stepIndex + 1, demo), 1000);
    }
  }, step.duration);
};

  const handleUserValidation = () => {
    if (!currentDemo) return;
    
    // Mark user validation as completed
    setCurrentDemo(prev => {
      if (!prev) return null;
      const updatedSteps = [...prev.steps];
      updatedSteps[6] = { ...updatedSteps[6], status: 'completed',};
      return { ...prev, steps: updatedSteps };
  });
    
    setShowUserValidation(false);
    
    // Continue with final step
    setTimeout(() => executeStep(7, currentDemo), 1000);
};

  const resetDemo = () => {
    setIsRunning(false);
    setCurrentDemo(null);
    setActiveStep(0);
    setShowUserValidation(false);
    setUserValidationData({ confirmed: false, rating: 0, comments: ', ',});
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
}
};

  const getStepIcon = (step: DemoStep) => {
    if (step.status === 'completed') return <CheckCircle color="success" />;
    if (step.status === 'running') return <LinearProgress />;
    if (step.status === 'failed') return <Error color="error" />;
    return step.icon;
};

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
        🔍 Verification System Demo
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Watch the complete "Fixing Things" verification workflow in action!
        This demo simulates a real problem report through the chat widget and shows
        how the system ensures fixes actually work.
      </Typography>

      {!currentDemo ? (
        // Demo Selection
        <Grid container spacing={3}>
          {demoScenarios.map((scenario) => (
            <Grid item xs={12} md={6} key={scenario.id}>
              <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BugReport color="primary" />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{scenario.title}</Typography>
                    <Chip 
                      label={scenario.priority} 
                      size="small" 
                      color={scenario.priority === 'critical' ? 'error' : 
                             scenario.priority === 'high' ? 'warning' : 'default'}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    {scenario.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Reported by: {scenario.userEmail} ({scenario.profession})
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={theming.getThemedIcon('play')}
                      onClick={() => startDemo(scenario)}
                      disabled={isRunning}
                      sx={{ ...theming.getThemedButtonSx(), bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
                    >
                      Start Demo
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box>
          {/* Demo Header */}
          <Paper sx={{ ...theming.getThemedCardSx(), p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{currentDemo.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: <Chip label={currentDemo.status} size="small" color={getStatusColor(currentDemo.status)} />
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('refresh')}
                  onClick={resetDemo}
                  disabled={isRunning}
                >
                  Reset
                </Button>
                <Button
                  variant="outlined"
                  startIcon={isRunning ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                  onClick={() => setIsRunning(!isRunning)}
                >
                  {isRunning ? 'Pause' : 'Resume'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Verification Steps */}
          <Stepper activeStep={activeStep} orientation="vertical">
            {currentDemo.steps.map((step, index) => (
              <Step key={step.id}>
                <StepLabel
                  StepIconComponent={() => getStepIcon(step)}
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: tep.status === 'running' ? 'bold' : 'normal'
                }
                }}
                >
                  {step.title}
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    {step.description}
                  </Typography>
                  
                  {step.status === 'running' && (
                    <Alert severity="info" sx={{ mb:  2 }}>
                      <Typography variant="body2">
                        ⏳ Executing step... (Estimated time: {step.duration / 100}s)
                      </Typography>
                    </Alert>
                  )}
                  
                  {step.status === 'completed' && (
                    <Alert severity="success" sx={{ mb:  2 }}>
                      <Typography variant="body2">
                        ✅ Step completed successfully!
                      </Typography>
                    </Alert>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {/* Current Status */}
          {currentDemo.status === 'verified' && (
            <Alert severity="success" sx={{ mt:  3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎉 Verification Complete!
              </Typography>
              <Typography variant="body2">
                The fix has been successfully deployed and verified. 
                All automated tests passed, regression tests confirmed no new issues, 
                and the original user confirmed the problem is resolved.
              </Typography>
              <Box sx={{ mt:  2 }}>
                <Typography variant="caption" color="text.secondary">
                  Total time: {currentDemo.endTime && currentDemo.startTime ? 
                    Math.round((currentDemo.endTime.getTime() - currentDemo.startTime.getTime()) / 1000) : 0}s
                </Typography>
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {/* User Validation Dialog */}
      <Dialog open={showUserValidation} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#ff8c00', color: 'white'}}>
          🔍 User Validation Required
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          <Alert severity="info" sx={{ mb:  3 }}>
            <Typography variant="body2">
              A fix has been deployed for your reported issue. Please test it and let us know if it works!
            </Typography>
          </Alert>
          
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Did this fix resolve your original problem?
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb:  2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userValidationData.confirmed}
                    onChange={(e) => setUserValidationData(prev => ({ ...prev, confirmed: e.target.checked }))}
                    color={userValidationData.confirmed ? "success" : "error"}
                  />
              }
                label={
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {userValidationData.confirmed ? "Yes, it's fixed! ✅" : "No, still broken ❌"}
                  </Typography>
              }
              />
            </Box>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional comments"
            placeholder="Describe what you tested and any improvements you noticed..."
            value={userValidationData.comments}
            onChange={(e) => setUserValidationData(prev => ({ ...prev, comments: e.target.value }))}
            sx={{ mb:  3 }}
          />

          <Box sx={{ mb:  2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Rate the fix quality: </Typography>
            <Rating
              value={userValidationData.rating}
              onChange={(_, value) => setUserValidationData(prev => ({ ...prev, rating: value || 0 }))}
              size="large"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p:  3 }}>
          <Button onClick={handleUserValidation} variant="contained" disabled={userValidationData.rating === 0} sx={theming.getThemedButtonSx()}>
            Submit Validation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


