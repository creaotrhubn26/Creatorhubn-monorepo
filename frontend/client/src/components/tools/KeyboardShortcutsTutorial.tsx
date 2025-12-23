/**
 * Tutorial Modal for Keyboard Shortcuts Tool
 * Guides users through features with profession-specific examples
 * Database-persistent with localStorage fallback
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Checkbox,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Paper,
  Divider,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Warning,
  School,
  Keyboard,
  Search,
  Star,
  Computer,
  FilterList,
  ContentCopy,
  TipsAndUpdates
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface KeyboardShortcutsTutorialProps {
  open: boolean;
  onClose: () => void;
  profession: string;
  professionName?: string;
  onDismiss?: () => void;
}

export const KeyboardShortcutsTutorial: React.FC<KeyboardShortcutsTutorialProps> = ({
  open,
  onClose,
  profession,
  professionName = 'Creative Professional',
  onDismiss
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const theming = useTheming();
  const queryClient = useQueryClient();

  // Mutation to save tutorial dismissal to database
  const dismissTutorialMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/preferences/tutorial-dismissal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          tutorialId: 'keyboard-shortcuts',
          dismissed: true,
          dismissedAt: new Date().toISOString(),
          profession: profession
        })
      });
      if (!response.ok) throw new Error('Failed to dismiss tutorial');
      return response.json();
    },
    onSuccess: () => {
      // Update localStorage as backup
      localStorage.setItem('keyboard-shortcuts-tutorial-dismissed', 'true');
      
      // Invalidate user preferences cache
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
      
      // Call parent's onDismiss callback
      if (onDismiss) {
        onDismiss();
      }
    },
    onError: (error) => {
      console.error('Failed to save tutorial dismissal:', error);
      // Still save to localStorage as fallback
      localStorage.setItem('keyboard-shortcuts-tutorial-dismissed', 'true');
    }
  });

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleClose = async () => {
    if (dontShowAgain) {
      setIsSaving(true);
      try {
        await dismissTutorialMutation.mutateAsync();
      } catch (error) {
        console.error('Error dismissing tutorial:', error);
      } finally {
        setIsSaving(false);
      }
    }
    onClose();
  };

  const steps = [
    {
      label: 'Choose Your Platform',
      icon: <Computer />,
      content: 'Select Windows or Mac to see shortcuts for your operating system.',
      example: 'Click the Windows or Mac button at the top to switch platforms.',
      tip: 'Your selection is saved automatically for next time.'
    },
    {
      label: 'Select Your Software',
      icon: <Keyboard />,
      content: 'Pick the creative software you use daily.',
      example: 'Click on Adobe Lightroom, Premiere Pro, or any other tool card.',
      tip: 'See shortcuts for multiple apps by clicking different cards.'
    },
    {
      label: 'Search Shortcuts',
      icon: <Search />,
      content: 'Find specific shortcuts quickly using the search bar.',
      example: 'Type "export" to find all export-related shortcuts.',
      tip: 'Search works across actions, descriptions, and categories.'
    },
    {
      label: 'Filter by Category',
      icon: <FilterList />,
      content: 'Browse shortcuts by category to learn workflows.',
      example: 'Select "Editing" to see all editing shortcuts together.',
      tip: 'Categories help you learn tools step-by-step.'
    },
    {
      label: 'Save Your Favorites',
      icon: <Star />,
      content: 'Mark shortcuts you use most as favorites for quick access.',
      example: 'Click the star icon next to any shortcut.',
      tip: 'Access all favorites through the "Favorites" filter.'
    },
    {
      label: 'Copy Shortcuts',
      icon: <ContentCopy />,
      content: 'Copy shortcuts to share with your team or save for reference.',
      example: 'Click "Copy" next to any shortcut to copy it.',
      tip: 'You\'ll see a confirmation when the shortcut is copied.'
    }
  ];

  const professionExamples: Record<string, string[]> = {
    photographer: [
      'Quickly rate photos with number keys (1-5 stars)',
      'Jump between Library and Develop modules',
      'Copy settings from one photo to apply to others'
    ],
    videographer: [
      'Edit faster with timeline shortcuts',
      'Switch between editing and color grading',
      'Master multi-track audio mixing shortcuts'
    ],
    musician: [
      'Record takes efficiently with transport controls',
      'Mix faster with automation shortcuts',
      'Navigate between tracks and mixer views'
    ],
    default: [
      'Work faster with keyboard shortcuts',
      'Switch between tools without clicking',
      'Streamline your creative workflow'
    ]
  };

  const commonMistakes = [
    {
      mistake: 'Not switching platform',
      solution: 'Always set your platform (Windows/Mac) first for accurate shortcuts.'
    },
    {
      mistake: 'Forgetting shortcuts exist',
      solution: 'Keep this tool open in a second monitor or bookmark it for quick access.'
    },
    {
      mistake: 'Not using categories',
      solution: 'Filter by category to learn related shortcuts together—it\'s faster!'
    },
    {
      mistake: 'Ignoring new features',
      solution: 'Look for the "NEW" badge to discover the latest AI-powered shortcuts.'
    }
  ];

  const checklist = [
    'Set your platform (Windows or Mac)',
    'Select your main creative software',
    'Try searching for a common action',
    'Mark 3-5 shortcuts you use daily as favorites',
    'Explore one new category you haven\'t used before',
    'Copy a shortcut to test the feature'
  ];

  const examples = professionExamples[profession] || professionExamples.default;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          ...theming.getThemedCardSx()
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`,
          color: 'white',
          pb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <School sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Master Keyboard Shortcuts
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Your {professionName} Quick Start Guide
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {/* What You'll Learn */}
        <Paper
          elevation={0}
          sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theming.colors.primary}15 0%, ${theming.colors.secondary}15 100%)`,
          borderRadius: 2,
          border: `1px solid ${theming.colors.primary}30`,
          bgcolor: 'background.paper'
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TipsAndUpdates color="primary" />
            What You'll Learn
          </Typography>
          <List dense>
            {examples.map((example, index) => (
              <ListItem key={index} sx={{ pl: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={example}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Who This Guide Is For */}
        <Alert
          severity="info"
          icon={<School />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Perfect for: {professionName}s
          </Typography>
          <Typography variant="body2">
            Whether you're new to shortcuts or want to level up your workflow, this tool adapts to your needs.
          </Typography>
        </Alert>

        {/* Step-by-Step Instructions */}
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Step-by-Step Guide
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                    background: activeStep >= index 
                      ? `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`
                      : '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    border: activeStep >= index ? 'none' : `2px solid ${theming.colors.primary}30`,
                    color: activeStep >= index ? 'white' : 'text.primary'
                    }}
                  >
                    {step.icon}
                  </Box>
                )}
              >
                <Typography sx={{ fontWeight: 600 }}>{step.label}</Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {step.content}
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'background.default',
                    borderLeft: `3px solid ${theming.colors.primary}`,
                    borderRadius: 1
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, color: theming.colors.primary, mb: 0.5, display: 'block' }}>
                    EXAMPLE
                  </Typography>
                  <Typography variant="body2">
                    {step.example}
                  </Typography>
                </Paper>
                <Alert severity="success" icon={<TipsAndUpdates />} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Pro Tip:</strong> {step.tip}
                  </Typography>
                </Alert>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={index === steps.length - 1}
                  >
                    {index === steps.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {activeStep === steps.length && (
          <Box sx={{ mt: 3 }}>
            {/* Quick Start Checklist */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                background: `linear-gradient(135deg, #4caf5015 0%, #4caf5005 100%)`
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="success" />
                Your Quick Start Checklist
              </Typography>
              <List>
                {checklist.map((item, index) => (
                  <ListItem key={index} sx={{ pl: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Checkbox size="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            {/* Common Mistakes */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                background: `linear-gradient(135deg, #ff980015 0%, #ff980005 100%)`
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning color="warning" />
                Common Mistakes to Avoid
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {commonMistakes.map((item, index) => (
                  <Box key={index}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main', mb: 0.5 }}>
                      ✗ {item.mistake}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'success.main', pl: 2 }}>
                      ✓ {item.solution}
                    </Typography>
                    {index < commonMistakes.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* Complete Sample Guide */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theming.colors.primary}10 0%, ${theming.colors.secondary}10 100%)`,
                border: `1px solid ${theming.colors.primary}30`
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Complete "How-To" Guide
              </Typography>
              
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                Scenario: Speed Up Your Photo Editing
              </Typography>
              
              <Box sx={{ pl: 2, borderLeft: `3px solid ${theming.colors.primary}`, mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Goal:</strong> Cut your editing time in half by mastering essential shortcuts
                </Typography>
                
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 1: Set Up Your Workspace
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Open Keyboard Shortcuts Tool<br />
                  • Select your platform (Windows/Mac)<br />
                  • Click your editing software card
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 2: Learn Core Shortcuts
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Filter by "Import/Export" category<br />
                  • Star the import and export shortcuts<br />
                  • Practice each one 3-5 times
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 3: Master Editing Flow
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Switch to "Editing" category<br />
                  • Star exposure, contrast, and crop shortcuts<br />
                  • Use copy/paste settings for batch editing
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 4: Optimize Navigation
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Browse "Navigation" category<br />
                  • Learn next/previous photo shortcuts<br />
                  • Master zoom shortcuts for checking details
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 5: Build Muscle Memory
                </Typography>
                <Typography variant="body2" sx={{ pl: 2 }}>
                  • Review favorites daily for one week<br />
                  • Time yourself editing a set of 10 photos<br />
                  • Track improvement each day
                </Typography>
              </Box>

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Expected Result:</strong> After one week, you'll complete common editing tasks 40-60% faster!
                </Typography>
              </Alert>
            </Paper>

            <Button
              onClick={() => setActiveStep(0)}
              sx={{ mt: 2 }}
              variant="outlined"
            >
              Start Over
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">
              Don't show this tutorial again
            </Typography>
          }
        />
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
            disabled={isSaving}
          >
            Close Tutorial
          </Button>
          <Button
            onClick={handleClose}
            variant="contained"
            disabled={isSaving}
            sx={{
              background: `linear-gradient(135deg, ${theming.colors.primary} 0%, ${theming.colors.secondary} 100%)`
            }}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSaving ? 'Saving...' : 'Start Using Shortcuts'}
          </Button>
        </Box>

        <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', mt: 1 }}>
          You can always access this tutorial from the help icon (?) at the top right of the tool
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

