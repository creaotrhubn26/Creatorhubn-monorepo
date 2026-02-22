/**
 * Tutorial Modal for Universal Worklog & Quick Worklog Access
 * Guides users through worklog features with profession-specific examples
 * Database-persistent with localStorage fallback
 * 
 * Features covered:
 * - Time tracking and productivity logging
 * - Mood and reflection entries
 * - Category management per profession
 * - Google Keep synchronization
 * - Keyboard shortcuts for quick access
 * - Collaboration features
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
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Warning,
  School,
  Notes,
  AccessTime,
  Mood,
  Category,
  TipsAndUpdates,
  Keyboard,
  SyncAlt,
  Group,
  PhotoCamera,
  Videocam,
  MusicNote,
  Store,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

const TUTORIAL_ID = 'worklog-guide';

interface TutorialPreference {
  tutorialId: string;
  dismissed: boolean;
  dismissedAt: string | null;
  completedSteps: number[];
  profession: string | null;
}

interface WorklogTutorialProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'vendor' | string;
  professionName?: string;
  onDismiss?: () => void;
}

export const WorklogTutorial: React.FC<WorklogTutorialProps> = ({
  open,
  onClose,
  profession,
  professionName,
  onDismiss
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);
  const theming = useTheming();
  const queryClient = useQueryClient();

  // Fetch tutorial preferences from database
  const { data: tutorialPrefs } = useQuery<TutorialPreference>({
    queryKey: ['tutorialPreferences', TUTORIAL_ID],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}`);
      } catch {
        // Fallback to localStorage if API fails
        const localDismissed = localStorage.getItem(`${TUTORIAL_ID}-tutorial-dismissed`);
        const localSteps = localStorage.getItem(`${TUTORIAL_ID}-completed-steps`);
        return {
          tutorialId: TUTORIAL_ID,
          dismissed: localDismissed === 'true',
          dismissedAt: null,
          completedSteps: localSteps ? JSON.parse(localSteps) : [],
          profession: null
        };
      }
    },
    enabled: open,
    staleTime: 5 * 60 * 1000
  });

  // Initialize completed steps from database
  React.useEffect(() => {
    if (tutorialPrefs?.completedSteps) {
      setCompletedSteps(tutorialPrefs.completedSteps);
      // Resume from last completed step
      if (tutorialPrefs.completedSteps.length > 0) {
        const lastStep = Math.max(...tutorialPrefs.completedSteps);
        setActiveStep(Math.min(lastStep + 1, 5)); // Don't exceed total steps
      }
    }
  }, [tutorialPrefs]);

  // Get profession display name
  const getProfessionDisplayName = () => {
    if (professionName) return professionName;
    const names: Record<string, string> = {
      photographer: 'Fotograf',
      videographer: 'Videograf',
      musicproducer: 'Musikkprodusent',
      music_producer: 'Musikkprodusent',
      vendor: 'Leverandør'
    };
    return names[profession] || 'Kreativ profesjonell';
  };

  // Get profession icon
  const getProfessionIcon = () => {
    switch (profession) {
      case 'photographer': return <PhotoCamera />;
      case 'videographer': return <Videocam />;
      case 'musicproducer':
      case 'music_producer': return <MusicNote />;
      case 'vendor': return <Store />;
      default: return <Notes />;
    }
  };

  // Mutation to save step progress
  const saveProgressMutation = useMutation({
    mutationFn: async (steps: number[]) => {
      return await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ completedSteps: steps })
      });
    },
    onSuccess: (_, steps) => {
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(steps));
      queryClient.setQueryData(['tutorialPreferences', TUTORIAL_ID], (old: TutorialPreference | undefined) => ({
        ...old,
        completedSteps: steps
      }));
    },
    onError: (_, steps) => {
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(steps));
    }
  });

  // Mutation to save tutorial dismissal to database
  const dismissTutorialMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/user/preferences/tutorial-dismissal', {
        method: 'POST',
        body: JSON.stringify({
          tutorialId: TUTORIAL_ID,
          dismissed: true,
          profession,
          completedSteps
        })
      });
    },
    onSuccess: () => {
      localStorage.setItem(`${TUTORIAL_ID}-tutorial-dismissed`, 'true');
      queryClient.invalidateQueries({ queryKey: ['tutorialPreferences', TUTORIAL_ID] });
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
      if (onDismiss) onDismiss();
    },
    onError: () => {
      localStorage.setItem(`${TUTORIAL_ID}-tutorial-dismissed`, 'true');
    }
  });

  // Mutation to reset tutorial
  const resetTutorialMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      localStorage.removeItem(`${TUTORIAL_ID}-tutorial-dismissed`);
      localStorage.removeItem(`${TUTORIAL_ID}-completed-steps`);
      setCompletedSteps([]);
      setActiveStep(0);
      queryClient.invalidateQueries({ queryKey: ['tutorialPreferences', TUTORIAL_ID] });
    }
  });

  const handleNext = () => {
    const newStep = activeStep + 1;
    setActiveStep(newStep);
    
    // Save progress to database
    if (!completedSteps.includes(activeStep)) {
      const newCompletedSteps = [...completedSteps, activeStep];
      setCompletedSteps(newCompletedSteps);
      saveProgressMutation.mutate(newCompletedSteps);
    }
  };
  
  const handleBack = () => setActiveStep((prev) => prev - 1);
  
  const handleReset = () => {
    resetTutorialMutation.mutate();
  };

  const handleClose = async () => {
    if (dontShowAgain) {
      setIsSaving(true);
      try {
        await dismissTutorialMutation.mutateAsync();
      } finally {
        setIsSaving(false);
      }
    }
    onClose();
  };

  // Step-by-step tutorial content
  const steps = [
    {
      label: 'Create Your First Entry',
      icon: <Notes />,
      content: 'Start by clicking the "Nytt Logg-innslag" button to create a new worklog entry.',
      example: 'Click the orange "+ Nytt Logg-innslag" button in the top right corner.',
      tip: 'Use the "Daglig Refleksjon" button to get creative prompts for your entry.'
    },
    {
      label: 'Track Your Time',
      icon: <AccessTime />,
      content: 'Log how much time you spent on each task. This builds your productivity insights.',
      example: 'Enter "120" minutes for a 2-hour photo editing session.',
      tip: 'Accurate time tracking helps you quote projects and understand your true costs.'
    },
    {
      label: 'Choose Categories',
      icon: <Category />,
      content: 'Select a category that matches your work. Categories are tailored to your profession.',
      example: profession === 'photographer' 
        ? 'Choose "Fotografering" for shooting days or "Redigering" for editing work.'
        : profession === 'videographer'
        ? 'Choose "Filming" for shoot days or "Fargekorrigering" for color grading.'
        : profession === 'musicproducer'
        ? 'Choose "Innspilling" for recording sessions or "Miksing" for mixing work.'
        : 'Choose "Salg" for client interactions or "Markedsføring" for promotion.',
      tip: 'Categories help you analyze where you spend most of your time.'
    },
    {
      label: 'Track Your Mood',
      icon: <Mood />,
      content: 'Log how you felt during the work. This reveals patterns in your productivity.',
      example: 'Select "Produktiv ⚡" when you crushed it, or "Kreativ 🎨" for inspired days.',
      tip: 'Mood tracking shows you which conditions lead to your best work.'
    },
    {
      label: 'Use Keyboard Shortcuts',
      icon: <Keyboard />,
      content: 'Work faster with keyboard shortcuts for quick access to worklog features.',
      example: 'Press Ctrl+Shift+W (Windows) or Cmd+Shift+W (Mac) to open quick note.',
      tip: 'Press Ctrl+Shift+N to open the full worklog from anywhere in the app.'
    },
    {
      label: 'Sync with Google Keep',
      icon: <SyncAlt />,
      content: 'Your entries sync automatically to Google Keep for mobile access.',
      example: 'Click "Google Keep" button to view sync status and manage connection.',
      tip: 'Access your worklog notes on your phone during client meetings.'
    }
  ];

  // Profession-specific learning points
  const professionExamples: Record<string, string[]> = {
    photographer: [
      'Track time spent on shoots, editing, and client meetings',
      'Log mood during creative sessions to find your peak hours',
      'Review categories to balance shooting vs. business tasks',
      'Use reflection prompts to document lighting setups and techniques'
    ],
    videographer: [
      'Track filming, editing, and color grading time separately',
      'Log mood to identify when you do your best creative work',
      'Review categories to balance production vs. post-production',
      'Document equipment used and lessons learned per project'
    ],
    musicproducer: [
      'Track recording, mixing, and mastering sessions',
      'Log mood during creative sessions to find inspiration patterns',
      'Review categories to balance creative vs. technical work',
      'Document plugin settings and production techniques'
    ],
    vendor: [
      'Track sales calls, deliveries, and inventory management',
      'Log mood to identify your best customer interaction times',
      'Review categories to balance sales vs. operations',
      'Document successful sales approaches and customer feedback'
    ]
  };

  // Common mistakes to avoid
  const commonMistakes = [
    {
      mistake: 'Forgetting to log time',
      solution: 'Set a daily reminder or use Ctrl+Shift+W for quick 30-second entries.'
    },
    {
      mistake: 'Skipping the mood field',
      solution: 'Mood data reveals productivity patterns. Take 2 seconds to select one.'
    },
    {
      mistake: 'Vague descriptions',
      solution: 'Write specific titles like "Bryllup Redigering - Hansen" not just "Redigering".'
    },
    {
      mistake: 'Not using "Neste steg"',
      solution: 'Fill in next steps to create a ready-made to-do list for tomorrow.'
    }
  ];

  // Quick start checklist
  const checklist = [
    'Create your first worklog entry',
    'Set a category that matches your profession',
    'Log time spent (even if estimated)',
    'Try the daily reflection prompt',
    'Use Ctrl+Shift+W for a quick note',
    'Connect Google Keep for mobile access'
  ];

  // Keyboard shortcuts reference
  const keyboardShortcuts = [
    { action: 'Quick note', windows: 'Ctrl+Shift+W', mac: '⌘+Shift+W' },
    { action: 'Open full worklog', windows: 'Ctrl+Shift+N', mac: '⌘+Shift+N' },
    { action: 'Toggle compact view', windows: 'Ctrl+K', mac: '⌘+K' },
    { action: 'Save note', windows: 'Ctrl+Enter', mac: '⌘+Enter' },
    { action: 'Close dialog', windows: 'Escape', mac: 'Escape' }
  ];

  const examples = professionExamples[profession] || professionExamples.photographer;

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
              Master Your Worklog
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              {getProfessionIcon()}
              Guiden for {getProfessionDisplayName()}er
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
            border: `1px solid ${theming.colors.primary}30`
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
        <Alert severity="info" icon={<School />} sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Perfect for: {getProfessionDisplayName()}er og kreative profesjonelle
          </Typography>
          <Typography variant="body2">
            This worklog adapts to your profession with custom categories, tailored prompts, 
            and integrations with your existing tools (Google Keep, profession-specific features).
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
                  <Typography 
                    variant="caption" 
                    sx={{ fontWeight: 600, color: theming.colors.primary, mb: 0.5, display: 'block' }}
                  >
                    EXAMPLE
                  </Typography>
                  <Typography variant="body2">{step.example}</Typography>
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
                  <Button disabled={index === 0} onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {/* Completed state with checklist, mistakes, and full guide */}
        {activeStep === steps.length && (
          <Box sx={{ mt: 3 }}>
            {/* Keyboard Shortcuts Reference */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                mb: 3,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${theming.colors.primary}10 0%, ${theming.colors.secondary}10 100%)`
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Keyboard color="primary" />
                Keyboard Shortcuts
              </Typography>
              <Table size="small">
                <TableBody>
                  {keyboardShortcuts.map((shortcut) => (
                    <TableRow key={shortcut.action}>
                      <TableCell sx={{ fontWeight: 600, border: 'none', py: 1 }}>
                        {shortcut.action}
                      </TableCell>
                      <TableCell sx={{ border: 'none', py: 1 }}>
                        <Chip label={shortcut.windows} size="small" variant="outlined" sx={{ mr: 1 }} />
                        <Chip label={shortcut.mac} size="small" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>

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
                    <ListItemText primary={item} primaryTypographyProps={{ variant: 'body2' }} />
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

            {/* Complete Sample How-To Guide */}
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
                Complete "How-To" Guide: Daily Worklog Routine
              </Typography>

              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                Scenario: Build a Consistent Logging Habit
              </Typography>

              <Box sx={{ pl: 2, borderLeft: `3px solid ${theming.colors.primary}`, mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Goal:</strong> Track your work daily to gain insights and improve productivity
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 1: Morning Setup (1 minute)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Open your worklog (Ctrl+Shift+N)<br />
                  • Review yesterday's "Neste steg" section<br />
                  • Note your mood before starting work
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 2: Quick Notes During Work (30 seconds each)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Use Ctrl+Shift+W for instant notes<br />
                  • Log client calls, ideas, and breakthroughs<br />
                  • Don't overthink—quick notes are better than nothing
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 3: End-of-Day Reflection (3 minutes)
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                  • Click "Daglig Refleksjon" for a prompt<br />
                  • Fill in time spent accurately<br />
                  • Write 2-3 next steps for tomorrow
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 4: Weekly Review (10 minutes)
                </Typography>
                <Typography variant="body2" sx={{ pl: 2 }}>
                  • Check your mood patterns<br />
                  • Review time by category<br />
                  • Identify your most productive days
                </Typography>
              </Box>

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Expected Result:</strong> After 2 weeks, you'll have clear data on how you spend your time 
                  and which conditions lead to your best work!
                </Typography>
              </Alert>
            </Paper>

            <Button 
              onClick={handleReset} 
              sx={{ mt: 2 }} 
              variant="outlined"
              disabled={resetTutorialMutation.isPending}
            >
              {resetTutorialMutation.isPending ? 'Tilbakestiller...' : 'Start Over'}
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
          label={<Typography variant="body2">Don't show this tutorial again</Typography>}
        />

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button onClick={handleClose} variant="outlined" disabled={isSaving}>
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
            {isSaving ? 'Saving...' : 'Start Logging'}
          </Button>
        </Box>

        {/* Progress indicator */}
        {completedSteps.length > 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            <Typography variant="caption">
              📊 Progress saved: {completedSteps.length}/6 steps completed
              {saveProgressMutation.isPending && ' (saving...)'}
            </Typography>
          </Alert>
        )}

        <Typography variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', mt: 1 }}>
          Access this guide anytime from the Worklog → Help icon (?) or Settings → Tutorials
        </Typography>
      </DialogActions>
    </Dialog>
  );
};
