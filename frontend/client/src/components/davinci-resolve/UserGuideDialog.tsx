/**
 * UserGuideDialog - Interactive step-by-step guide for DaVinci Resolve Script Manager
 * Based on UX research for onboarding and user education
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  PlayArrow,
  Search,
  Settings,
  Timeline,
  Close,
  NavigateNext,
  NavigateBefore,
} from '@mui/icons-material';
import { DaVinciResolveFullLogo, DAVINCI_COLORS } from '../../assets/davinci-resolve-logo';

interface UserGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

const guideSteps = [
  {
    label: 'Welcome to DaVinci Resolve Script Manager',
    icon: <DaVinciResolveFullLogo size="medium" />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          This powerful tool automates your video production workflow with intelligent Python scripts designed specifically for DaVinci Resolve.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            What you can do:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircle fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Automate color grading with camera-specific powergrades" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircle fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Organize projects by category (Wedding, Film, YouTube, etc.)" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircle fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Execute scripts with custom parameters and presets" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircle fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Track execution history and monitor results" />
            </ListItem>
          </List>
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Step 1: Check System Requirements',
    icon: <Settings />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Before you begin, ensure your system meets these requirements:
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Required Software:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Python 3.8 or higher" 
                secondary="Used to execute automation scripts"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="DaVinci Resolve 18 or higher" 
                secondary="The video editing software"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="DaVinci Resolve Python API" 
                secondary="Enables script communication with Resolve"
              />
            </ListItem>
          </List>
        </Paper>
        <Alert severity="success">
          <Typography variant="body2">
            The system status indicators at the top of the page will show green checkmarks when everything is properly configured.
          </Typography>
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Step 2: Install Scripts',
    icon: <PlayArrow />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Navigate to the <strong>Setup</strong> tab to install the script automation suite.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Installation Steps:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="1. Click the Setup tab" 
                secondary="Located at the top of the page"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="2. Follow the installation wizard" 
                secondary="4 simple steps to complete setup"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="3. Verify installation" 
                secondary="Check that all scripts are properly installed"
              />
            </ListItem>
          </List>
        </Paper>
      </Box>
    ),
  },
  {
    label: 'Step 3: Browse and Filter Scripts',
    icon: <Search />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          The <strong>Browse</strong> tab provides powerful filtering to find the perfect script for your project.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Filtering Options:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Search by name or description"
                secondary="Type keywords to instantly filter scripts"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Filter by category"
                secondary="Wedding, Film, YouTube, Corporate, and more"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Filter by camera profile"
                secondary="Sony S-Log, Canon C-Log, RED, ARRI, and others"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Advanced filters"
                secondary="Production phase, culture, and custom tags"
              />
            </ListItem>
          </List>
        </Paper>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Pro Tip:</strong> Use multiple filters together to narrow down results. For example, filter by "Wedding" category + "Sony S-Log2" camera profile.
          </Typography>
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Step 4: Configure and Execute Scripts',
    icon: <PlayArrow />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Once you've found the right script, configure its parameters and execute it.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Execution Process:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="1. Click 'Execute' on any script card"
                secondary="Opens the parameter configuration dialog"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Choose a preset or customize parameters"
                secondary="Presets provide quick-start configurations"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Review your settings"
                secondary="Validation ensures all required fields are filled"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Click 'Execute Script', "
                secondary="The script runs in DaVinci Resolve"
              />
            </ListItem>
          </List>
        </Paper>
        <Alert severity="warning">
          <Typography variant="body2">
            <strong>Important:</strong> Make sure DaVinci Resolve is running before executing scripts.
          </Typography>
        </Alert>
      </Box>
    ),
  },
  {
    label: 'Step 5: Monitor Execution History',
    icon: <Timeline />,
    content: (
      <Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          The <strong>History</strong> tab tracks all your script executions for easy reference.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            What You Can See:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Execution timestamp"
                secondary="When each script was run"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Script name and parameters"
                secondary="Full details of what was executed"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Success/failure status"
                secondary="Color-coded indicators for quick scanning"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Error messages (if any)"
                secondary="Detailed information for troubleshooting"
              />
            </ListItem>
          </List>
        </Paper>
        <Alert severity="success">
          <Typography variant="body2">
            <strong>Success!</strong> You're now ready to automate your DaVinci Resolve workflow. Start by browsing scripts in your category of interest.
          </Typography>
        </Alert>
      </Box>
    ),
  },
];

export default function UserGuideDialog({ open, onClose }: UserGuideDialogProps) {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, guideSteps.length - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${DAVINCI_COLORS.primary} 0%, ${DAVINCI_COLORS.accent} 100%)`,
          color: 'white'}}
      >
        <Typography variant="h5" fontWeight={600}>
          Getting Started Guide
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.5 }}>
          Learn how to use the DaVinci Resolve Script Manager
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {guideSteps.map((step, index) => (
            <Step key={step.label} expanded={activeStep === index}>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                {step.content}
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    startIcon={<NavigateBefore />}
                  >
                    Back
                  </Button>
                  {activeStep === guideSteps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={onClose}
                      sx={{
                        bgcolor: DAVINCI_COLORS.primary,
                        '&:hover': { bgcolor: DAVINCI_COLORS.accent },
                      }}
                    >
                      Get Started
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<NavigateNext />}
                      sx={{
                        bgcolor: DAVINCI_COLORS.primary,
                        '&:hover': { bgcolor: DAVINCI_COLORS.accent },
                      }}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleReset} disabled={activeStep === 0}>
          Reset
        </Button>
        <Button onClick={onClose} startIcon={<Close />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
