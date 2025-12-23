/**
 * Tutorial Modal for CreatorHub Academy
 * Comprehensive guide for instructors and students
 * Database-persistent with localStorage fallback
 * 
 * Features covered:
 * - Course creation and management
 * - Module organization
 * - Video chapters and annotations
 * - Student enrollment and revenue
 * - Analytics and engagement
 * - Community publishing
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
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Warning,
  School,
  TipsAndUpdates,
  VideoLibrary,
  Assignment,
  Analytics,
  AttachMoney,
  Groups,
  PlayArrow,
  Edit,
  Publish,
  Schedule,
  AutoAwesome,
  PhotoCamera,
  Videocam,
  MusicNote,
  Store,
  Person
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

type UserRole = 'instructor' | 'student';

const TUTORIAL_ID = 'academy-guide';

interface TutorialPreference {
  tutorialId: string;
  dismissed: boolean;
  dismissedAt: string | null;
  completedSteps: number[];
  profession: string | null;
}

interface AcademyTutorialProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'music_producer' | 'vendor' | string;
  professionName?: string;
  defaultRole?: UserRole;
  onDismiss?: () => void;
}

export const AcademyTutorial: React.FC<AcademyTutorialProps> = ({
  open,
  onClose,
  profession,
  professionName,
  defaultRole = 'instructor',
  onDismiss
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [userRole, setUserRole] = React.useState<UserRole>(defaultRole);
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
      default: return <School />;
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
      // Update localStorage as backup
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(steps));
      // Update cache
      queryClient.setQueryData(['tutorialPreferences', TUTORIAL_ID], (old: TutorialPreference | undefined) => ({
        ...old,
        completedSteps: steps
      }));
    },
    onError: (_, steps) => {
      // Fallback to localStorage
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(steps));
    }
  });

  // Mutation to save tutorial dismissal
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

  // Mutation to reset tutorial (allow viewing again)
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

  // Instructor-focused steps
  const instructorSteps = [
    {
      label: 'Create Your First Course',
      icon: <VideoLibrary />,
      content: 'Start by clicking "Create Course" to build your educational content.',
      example: 'Click the "+ Create Course" button on the dashboard to open the Course Creator.',
      tip: 'Name your course clearly. "Wedding Photography Masterclass" is better than "My Course".'
    },
    {
      label: 'Organize with Modules',
      icon: <Assignment />,
      content: 'Break your course into modules. Each module groups related lessons together.',
      example: 'Create modules like "Equipment Basics", "Lighting Techniques", and "Post-Processing".',
      tip: 'Drag and drop modules to reorder them. Students learn better with logical progression.'
    },
    {
      label: 'Add Video Lessons',
      icon: <PlayArrow />,
      content: 'Upload videos and add chapters for easy navigation.',
      example: 'Upload a 20-minute tutorial and add chapters at key moments (2:00 - Intro, 5:30 - Setup).',
      tip: 'Use Auto-Detect to automatically find chapter points in your videos.'
    },
    {
      label: 'Enhance with AI Tools',
      icon: <AutoAwesome />,
      content: 'Add text overlays, CTAs, lower thirds, and use AI-powered features.',
      example: 'Add a "Download Resources" CTA at the end of each lesson.',
      tip: 'AI can auto-generate captions and suggest chapter points.'
    },
    {
      label: 'Set Pricing & Publish',
      icon: <Publish />,
      content: 'Choose free or paid access. Set your price and publish to the community.',
      example: 'Set a course price of 499 NOK or offer free preview lessons.',
      tip: 'Offer a free intro module to attract more students.'
    },
    {
      label: 'Track Revenue & Analytics',
      icon: <AttachMoney />,
      content: 'Monitor enrollments, revenue, and student engagement.',
      example: 'Check your Instructor Revenue Dashboard for earnings and payout requests.',
      tip: 'High completion rates indicate engaging content. Low rates mean lessons may be too long.'
    }
  ];

  // Student-focused steps
  const studentSteps = [
    {
      label: 'Browse Available Courses',
      icon: <School />,
      content: 'Explore courses by category, instructor, or profession.',
      example: 'Filter courses by "Photography" to find relevant content for your skill level.',
      tip: 'Check course ratings and reviews before enrolling.'
    },
    {
      label: 'Enroll in a Course',
      icon: <CheckCircle />,
      content: 'Click "Enroll" to join free courses or complete payment for paid ones.',
      example: 'Click "Enroll Now" and follow the payment flow for premium courses.',
      tip: 'Many courses offer free preview lessons—try before you buy.'
    },
    {
      label: 'Watch & Learn',
      icon: <PlayArrow />,
      content: 'Navigate lessons using the sidebar. Use chapters to jump to specific sections.',
      example: 'Click on "Module 2: Lighting" then select "Lesson 3: Natural Light".',
      tip: 'Bookmark important moments with the bookmark button for quick reference.'
    },
    {
      label: 'Track Your Progress',
      icon: <Schedule />,
      content: 'Your progress is saved automatically. Resume where you left off.',
      example: 'Check the progress bar to see how much of the course you\'ve completed.',
      tip: 'Complete all lessons to earn your course certificate.'
    },
    {
      label: 'Engage with Community',
      icon: <Analytics />,
      content: 'Ask questions, share your work, and connect with other students.',
      example: 'Post your assignment work in the course community for feedback.',
      tip: 'Instructors often respond to questions—don\'t be shy! Check your learning analytics too.'
    },
    {
      label: 'Download Resources',
      icon: <Groups />,
      content: 'Access downloadable resources, templates, and connect with the community.',
      example: 'Click the download icon next to resources like presets, LUTs, or PDFs.',
      tip: 'Resources are usually attached to specific lessons—check each one.'
    }
  ];

  const steps = userRole === 'instructor' ? instructorSteps : studentSteps;

  // Profession-specific learning points
  const instructorExamples: Record<string, string[]> = {
    photographer: [
      'Create courses on portrait lighting, wedding day workflow, or Lightroom editing',
      'Upload behind-the-scenes videos from actual shoots',
      'Share your presets and editing workflows as downloadable resources',
      'Build recurring revenue by offering monthly masterclass subscriptions'
    ],
    videographer: [
      'Teach color grading in DaVinci Resolve or Premiere Pro',
      'Create modules on camera movement, audio recording, and storytelling',
      'Share project files, LUTs, and sound effects as resources',
      'Offer advanced courses on specific genres (weddings, commercials, docs)'
    ],
    musicproducer: [
      'Teach mixing, mastering, and production techniques',
      'Share sample packs, presets, and project files',
      'Create genre-specific courses (Hip-Hop, EDM, Cinematic)',
      'Offer feedback sessions as premium add-ons'
    ],
    vendor: [
      'Educate customers on product usage and best practices',
      'Create onboarding courses for new equipment',
      'Offer certification programs for professional users',
      'Build community with user tips and success stories'
    ]
  };

  const studentExamples: Record<string, string[]> = {
    photographer: [
      'Learn new lighting techniques from experienced photographers',
      'Master editing workflows in Lightroom and Photoshop',
      'Get presets and actions to speed up your editing',
      'Connect with a community of fellow photographers'
    ],
    videographer: [
      'Learn professional color grading and editing techniques',
      'Master audio recording and sound design',
      'Get LUTs, transitions, and project templates',
      'Build skills for specific video genres'
    ],
    musicproducer: [
      'Learn mixing and mastering from industry professionals',
      'Get sample packs, presets, and project files',
      'Master your DAW with hands-on tutorials',
      'Connect with other producers for collaboration'
    ],
    vendor: [
      'Learn to use products you\'ve purchased effectively',
      'Get certified on professional equipment',
      'Access exclusive tips from manufacturers',
      'Connect with other users for support'
    ]
  };

  // Common mistakes
  const instructorMistakes = [
    {
      mistake: 'Creating too-long videos',
      solution: 'Keep lessons under 15 minutes. Split longer content into multiple lessons.'
    },
    {
      mistake: 'Skipping chapters and annotations',
      solution: 'Add chapters every 2-3 minutes. Students will thank you for easy navigation.'
    },
    {
      mistake: 'No preview content',
      solution: 'Offer at least one free lesson so students can try before buying.'
    },
    {
      mistake: 'Ignoring analytics',
      solution: 'Check where students drop off and improve those sections.'
    }
  ];

  const studentMistakes = [
    {
      mistake: 'Jumping around randomly',
      solution: 'Follow the course order. Modules build on previous knowledge.'
    },
    {
      mistake: 'Not downloading resources',
      solution: 'Check each lesson for downloadable files—they enhance learning.'
    },
    {
      mistake: 'Passive watching',
      solution: 'Practice alongside tutorials. Active learning beats passive watching.'
    },
    {
      mistake: 'Not asking questions',
      solution: 'Use the community features. Instructors and peers are here to help.'
    }
  ];

  const commonMistakes = userRole === 'instructor' ? instructorMistakes : studentMistakes;

  // Checklists
  const instructorChecklist = [
    'Create your first course with a clear title',
    'Add at least 3 modules with descriptive names',
    'Upload your first video lesson',
    'Add chapters to your video (manual or auto-detect)',
    'Set pricing (free or paid)',
    'Publish your course to the community'
  ];

  const studentChecklist = [
    'Browse courses in your profession',
    'Enroll in your first course',
    'Complete one full lesson',
    'Bookmark an important moment',
    'Download a course resource',
    'Post in the course community'
  ];

  const checklist = userRole === 'instructor' ? instructorChecklist : studentChecklist;

  // Keyboard shortcuts
  const keyboardShortcuts = [
    { action: 'Play/Pause video', shortcut: 'Space' },
    { action: 'Skip forward 10s', shortcut: '→' },
    { action: 'Skip back 10s', shortcut: '←' },
    { action: 'Toggle fullscreen', shortcut: 'F' },
    { action: 'Add bookmark', shortcut: 'B' },
    { action: 'Next lesson', shortcut: 'N' }
  ];

  const examples = userRole === 'instructor' 
    ? (instructorExamples[profession] || instructorExamples.photographer)
    : (studentExamples[profession] || studentExamples.photographer);

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
              Master CreatorHub Academy
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
        {/* Role Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ToggleButtonGroup
            value={userRole}
            exclusive
            onChange={(_, newRole) => {
              if (newRole) {
                setUserRole(newRole);
                setActiveStep(0);
              }
            }}
            sx={{
              bgcolor: 'background.paper',
              '& .Mui-selected': {
                bgcolor: `${theming.colors.primary}20 !important`,
                color: theming.colors.primary
              }
            }}
          >
            <ToggleButton value="instructor" sx={{ px: 3 }}>
              <Edit sx={{ mr: 1 }} /> I'm an Instructor
            </ToggleButton>
            <ToggleButton value="student" sx={{ px: 3 }}>
              <Person sx={{ mr: 1 }} /> I'm a Student
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

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
            What You'll Learn as {userRole === 'instructor' ? 'an Instructor' : 'a Student'}
          </Typography>
          <List dense>
            {examples.map((example, index) => (
              <ListItem key={index} sx={{ pl: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircle color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={example} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Who This Guide Is For */}
        <Alert severity="info" icon={<School />} sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Perfect for: {getProfessionDisplayName()}er {userRole === 'instructor' ? 'som vil lage kurs' : 'som vil lære'}
          </Typography>
          <Typography variant="body2">
            {userRole === 'instructor' 
              ? 'Share your expertise, build passive income, and grow your audience with professional courses.'
              : 'Learn from industry professionals, get resources, and level up your skills.'}
          </Typography>
        </Alert>

        {/* Step-by-Step Instructions */}
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Step-by-Step Guide for {userRole === 'instructor' ? 'Instructors' : 'Students'}
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
                <Typography variant="body2" sx={{ mb: 2 }}>{step.content}</Typography>
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

        {/* Completed state */}
        {activeStep === steps.length && (
          <Box sx={{ mt: 3 }}>
            {/* Keyboard Shortcuts */}
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
                <PlayArrow color="primary" />
                Video Player Shortcuts
              </Typography>
              <Table size="small">
                <TableBody>
                  {keyboardShortcuts.map((shortcut) => (
                    <TableRow key={shortcut.action}>
                      <TableCell sx={{ fontWeight: 600, border: 'none', py: 1 }}>
                        {shortcut.action}
                      </TableCell>
                      <TableCell sx={{ border: 'none', py: 1 }}>
                        <Chip label={shortcut.shortcut} size="small" variant="outlined" />
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

            {/* Complete How-To Guide */}
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
                Complete "How-To" Guide: {userRole === 'instructor' ? 'Launch Your First Course' : 'Complete Your First Course'}
              </Typography>

              {userRole === 'instructor' ? (
                <Box sx={{ pl: 2, borderLeft: `3px solid ${theming.colors.primary}`, mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Goal:</strong> Create and publish a professional course in one week
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Day 1-2: Planning
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Outline your course (5-10 modules)<br />
                    • Write lesson titles and descriptions<br />
                    • Gather resources (presets, templates, PDFs)
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Day 3-4: Recording
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Record screen or camera tutorials<br />
                    • Keep lessons under 15 minutes each<br />
                    • Aim for 3-5 lessons per module
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Day 5-6: Uploading & Editing
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Upload videos to Course Creator<br />
                    • Add chapters (use Auto-Detect for speed)<br />
                    • Add CTAs and lower thirds
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Day 7: Launch
                  </Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    • Set pricing and preview settings<br />
                    • Write a compelling course description<br />
                    • Publish to the community!
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ pl: 2, borderLeft: `3px solid ${theming.colors.primary}`, mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Goal:</strong> Complete a course and apply what you learned
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Step 1: Choose Wisely
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Browse courses in your profession<br />
                    • Read reviews and check ratings<br />
                    • Watch free preview lessons first
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Step 2: Learn Actively
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Follow along with tutorials<br />
                    • Practice techniques immediately<br />
                    • Bookmark key moments for reference
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Step 3: Engage & Apply
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, pl: 2 }}>
                    • Download all resources<br />
                    • Complete assignments if provided<br />
                    • Share your work in the community
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Step 4: Earn Your Certificate
                  </Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    • Complete all lessons in order<br />
                    • Pass any quizzes or assessments<br />
                    • Download your completion certificate!
                  </Typography>
                </Box>
              )}

              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Expected Result:</strong> {userRole === 'instructor' 
                    ? 'A published course ready to attract students and generate revenue!'
                    : 'New skills, resources, and a certificate to show your progress!'}
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
            {isSaving ? 'Saving...' : userRole === 'instructor' ? 'Start Creating' : 'Start Learning'}
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
          Access this guide anytime from the Academy Dashboard → Help icon (?) or Settings → Tutorials
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

export default AcademyTutorial;
