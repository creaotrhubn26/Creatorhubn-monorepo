import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  PersonAdd,
  Email,
  Security,
  CheckCircle,
  Group,
  BusinessCenter,
  Description,
  Schedule,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';";
import { useDemoMode } from '../../contexts/DemoModeContext';

interface ExternalCollaboratorOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  profession?: string;
  userEmail?: string; 
}

export default function ExternalCollaboratorOnboarding({
  open,
  onClose,
  onComplete,
  profession = 'admin',
  userEmail,
}: ExternalCollaboratorOnboardingProps) {
  const { isDemoMode } = useDemoMode();
  const [activeStep, setActiveStep] = useState(0);

  // Enhanced Master Integration
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer, ');

  // Component registration and lifecycle management
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'external-collaborator-onboarding,',
      type: 'onboarding-component',
      version: '1.0.0',
      capabilities: {
        data: ['onboarding:manage','permissions: set','roles: assign', ],
        events: ['onboarding:started','onboarding: completed','step: changed', ],
        actions: ['onboarding:create','permissions: configure','access: grant', ],
        ui: ['onboarding:stepper','form: multi-step','permissions: selector', ],
        system: ['onboarding:workflow','access: management','collaboration: setup']
    ,},
      dependencies: ['@mui/material','react'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime:  0,
        memoryUsage: 0
    }
  });

    // Track component initialization
    analytics.trackEvent('external_collaborator_onboarding_mounted, ', {
      profession,
      userEmail,
      isDemoMode,
      timestamp: Date.now()
  ,});

    return () => {
      lifecycle.unregisterComponent('external-collaborator-onboarding');
      analytics.trackEvent('external_collaborator_onboarding_unmounted', {
        profession,
        userEmail,
        isDemoMode,
        timestamp: Date.now()
    ,});
  };
}, [lifecycle, analytics, profession, userEmail]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    permissions: [] as string[],
    projectAccess: [] as string[],
    communicationPreferences: {
      email: true,
      chat: true,
      notifications: true,
  },
    securityLevel: 'standard',
    notes: '',
});
  const [loading, setLoading] = useState(false);

  const steps = [
    'Basic Information','Role & Permissions','Project Access','Security Settings','Review & Complete',
  ];

  const handleNext = () => {
    const endTiming = performance.startTiming('onboarding_step_next');
    
    analytics.trackEvent('onboarding_step_next', {
      fromStep: activeStep,
      toStep: activeStep +, 1,
      profession,
      isDemoMode,
      timestamp: Date.now()
  ,});
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    endTiming();
};

  const handleBack = () => {
    const endTiming = performance.startTiming('onboarding_step_back');
    
    analytics.trackEvent('onboarding_step_back', {
      fromStep: activeStep,
      toStep: activeStep -, 1,
      profession,
      isDemoMode,
      timestamp: Date.now()
  ,});
    
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    endTiming();
};

  const handleComplete = async () => {
    setLoading(true);
    const endTiming = performance.startTiming('onboarding_complete');
    
    try {
      analytics.trackEvent('onboarding_complete_started', {
        formData,
        profession,
        isDemoMode,
        timestamp: Date.now()
    ,});
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      analytics.trackEvent('onboarding_complete_success', {
        formData,
        profession,
        isDemoMode,
        timestamp: Date.now()
    ,});
      
      debugging.logIntegration('info', 'External collaborator onboarding completed', {
        formData,
        profession
    });
      
      console.log('External collaborator onboarding completed: ', formData);
      onComplete();
  } catch (error) {
      analytics.trackEvent('onboarding_complete_error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profession,
        isDemoMode,
        timestamp: Date.now()
    ,});
      
      debugging.logIntegration('error', 'Error completing onboarding', { error });
      console.error('Error completing onboarding:', error);
  } finally {
      setLoading(false);
      endTiming();
  }
};

  const handlePermissionChange = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
  }));
};

  const handleProjectAccessChange = (project: string) => {
    setFormData(prev => ({
      ...prev,
      projectAccess: prev.projectAccess.includes(project)
        ? prev.projectAccess.filter(p => p !== project)
        : [...prev.projectAccess, project]
  }));
};

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              <PersonAdd sx={{ mr: 1, verticalAlign: 'middle'}} />
              Basic Information
            </Typography>
            <TextField
              fullWidth
              label="Full Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mb:  2 }}
            />
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              sx={{ mb:  2 }}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                label="Role"
              >
                <MenuItem value="photographer">Photographer</MenuItem>
                <MenuItem value="videographer">Videographer</MenuItem>
                <MenuItem value="music_producer">Music Producer</MenuItem>
                <MenuItem value="vendor">Vendor</MenuItem>
                <MenuItem value="client">Client</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 1: return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              <Security sx={{ mr: 1, verticalAlign: 'middle'}} />
              Role & Permissions
            </Typography>
            <List>
              {[
                'View Projects','Edit Projects','Upload Files','Download Files','Create Tasks','Assign Tasks', 'View Reports', 'Manage Users', 'System Settings',
              ].map((permission) => (
                <ListItem key={permission}>
                  <ListItemIcon>
                    <Checkbox
                      checked={formData.permissions.includes(permission)}
                      onChange={() => handlePermissionChange(permission)}
                    />
                  </ListItemIcon>
                  <ListItemText primary={permission} />
                </ListItem>
              ))}
            </List>
          </Box>
        );

      case 2: return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              <Group sx={{ mr: 1, verticalAlign: 'middle'}} />
              Project Access
            </Typography>
            <List>
              {[
                'Wedding Photography - Sarah & John', 'Corporate Video - Tech Startup', 'Music Production - Album Recording', 'Event Planning - Summer Festival', 'Product Photography - E-commerce',
              ].map((project) => (
                <ListItem key={project}>
                  <ListItemIcon>
                    <Checkbox
                      checked={formData.projectAccess.includes(project)}
                      onChange={() => handleProjectAccessChange(project)}
                    />
                  </ListItemIcon>
                  <ListItemText primary={project} />
                </ListItem>
              ))}
            </List>
          </Box>
        );

      case 3: return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              <Security sx={{ mr: 1, verticalAlign: 'middle'}} />
              Security Settings
            </Typography>
            <FormControl fullWidth sx={{ mb:  2 }}>
              <InputLabel>Security Level</InputLabel>
              <Select
                value={formData.securityLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, securityLevel: e.target.value }))}
                label="Security Level"
              >
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="enhanced">Enhanced</MenuItem>
                <MenuItem value="maximum">Maximum</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="subtitle2" gutterBottom>
              Communication Preferences
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.communicationPreferences.email}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    communicationPreferences: {
                      ...prev.communicationPreferences,
                      email: e.target.checked
                  }
                }))}
                />
            }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.communicationPreferences.chat}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    communicationPreferences: {
                      ...prev.communicationPreferences,
                      chat: e.target.checked
                  }
                }))}
                />
            }
              label="Chat Access"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.communicationPreferences.notifications}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    communicationPreferences: {
                      ...prev.communicationPreferences,
                      notifications: e.target.checked
                  }
                }))}
                />
            }
              label="Push Notifications"
            />
            
            <TextField
              fullWidth
              label="Additional Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              sx={{ mt:  2 }}
            />
          </Box>
        );

      case 4: return (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              <CheckCircle sx={{ mr: 1, verticalAlign: 'middle'}} />
              Review & Complete
            </Typography>
            
            <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle1" gutterBottom>
                  <PersonAdd sx={{ mr: 1, verticalAlign: 'middle'}} />
                  Basic Information
                </Typography>
                <Typography><strong>Name: </strong> {formData.name}</Typography>
                <Typography><strong>Email: </strong> {formData.email}</Typography>
                <Typography><strong>Role: </strong> {formData.role}</Typography>
              </CardContent>
            </Card>

            <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle1" gutterBottom>
                  <Security sx={{ mr: 1, verticalAlign: 'middle'}} />
                  Permissions
                </Typography>
                {formData.permissions.map((permission) => (
                  <Typography key={permission} variant="body2">
                    • {permission}
                  </Typography>
                ))}
              </CardContent>
            </Card>

            <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle1" gutterBottom>
                  <Group sx={{ mr: 1, verticalAlign: 'middle'}} />
                  Project Access
                </Typography>
                {formData.projectAccess.map((project) => (
                  <Typography key={project} variant="body2">
                    • {project}
                  </Typography>
                ))}
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ mt:  2 }}>
              An invitation email will be sent to {formData.email} with access credentials and setup instructions.
            </Alert>
          </Box>
        );

      default: return null;
  }
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <PersonAdd sx={{ mr:  1 }} />
          External Collaborator Onboarding
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb:  3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        <Divider sx={{ mb:  2 }} />
        
        {renderStepContent(activeStep)}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button onClick={handleComplete}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('checkCircle')}
          >
            {loading ? 'Completing...' : 'Complete Onboarding'}
          </Button>
        ) : (
          <Button onClick={handleNext} variant="contained" sx={theming.getThemedButtonSx()}>
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}