/**
 * Community Tutorial - Interactive Onboarding Guide
 * 
 * Comprehensive guide for CreatorHub Norge Community features
 * Database-persistent with localStorage fallback
 * 
 * Features covered:
 * - Navigating channels and groups
 * - Sending messages and reactions
 * - Starting direct conversations
 * - Sharing files and media
 * - Participating in voting and polls
 * - Mentoring and getting help
 * - Earning badges and engagement
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Warning,
  Forum,
  TipsAndUpdates,
  Send,
  EmojiEmotions,
  AttachFile,
  HowToVote,
  School,
  EmojiEvents,
  Reply,
  PushPin,
  Search,
  Notifications,
  Chat,
  Group,
  Star,
  Favorite,
  PhotoCamera,
  Videocam,
  MusicNote,
  Store,
  Person,
  ExpandMore,
  QuestionAnswer,
  Help,
  Bookmark,
  Lock,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useSnackbar } from 'notistack';

// CreatorHub Logo Icon Component
const CreatorHubLogoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="tutorialLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    {/* Background circle */}
    <circle cx="20" cy="20" r="18" fill="url(#tutorialLogoGrad)" />
    {/* Creative Tools Icon */}
    <g transform="translate(8, 8)">
      {/* Central Pencil */}
      <path d="M12 4 L12 18 L10 20 L8 18 L8 16 L6 16 L6 6 L8 4 Z" fill="white" opacity="0.95"/>
      <polygon points="8,4 10,2 12,4" fill="rgba(255,255,255,0.7)"/>
      {/* Camera - top right */}
      <circle cx="18" cy="7" r="3" fill="white" opacity="0.9"/>
      <rect x="17" y="6" width="2" height="2" rx="0.3" fill="url(#tutorialLogoGrad)"/>
      <line x1="12" y1="8" x2="15" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Video - top left */}
      <polygon points="5,7 2,5 2,9" fill="white" opacity="0.9"/>
      <line x1="8" y1="8" x2="5" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Music - bottom right */}
      <circle cx="18" cy="17" r="2" fill="white" opacity="0.9"/>
      <rect x="18" y="14" width="1" height="3" fill="white" opacity="0.9"/>
      <line x1="12" y1="15" x2="16" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Palette - bottom left */}
      <circle cx="5" cy="17" r="3" fill="white" opacity="0.9"/>
      <circle cx="4" cy="16" r="0.8" fill="url(#tutorialLogoGrad)"/>
      <circle cx="6" cy="16" r="0.8" fill="#f59e0b"/>
      <circle cx="5" cy="18" r="0.8" fill="#ea580c"/>
      <line x1="8" y1="15" x2="8" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
    </g>
  </svg>
);

const TUTORIAL_ID = 'community-guide';

interface TutorialPreference {
  tutorialId: string;
  dismissed: boolean;
  dismissedAt: string | null;
  completedSteps: number[];
  profession: string | null;
}

interface CommunityTutorialProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'music_producer' | 'vendor' | string;
  professionName?: string;
  onDismiss?: () => void;
  onOpenFromMenu?: () => void;
}

export const CommunityTutorial: React.FC<CommunityTutorialProps> = ({
  open,
  onClose,
  profession,
  professionName,
  onDismiss,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);
  const [showChecklist, setShowChecklist] = React.useState(false);
  const theming = useTheming();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

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
      if (tutorialPrefs.completedSteps.length > 0) {
        const lastStep = Math.max(...tutorialPrefs.completedSteps);
        setActiveStep(Math.min(lastStep + 1, 6));
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
      vendor: 'Utstyrsleverandør',
    };
    return names[profession] || 'Kreativ profesjonell';
  };

  // Get profession icon
  const getProfessionIcon = () => {
    const icons: Record<string, React.ReactNode> = {
      photographer: <PhotoCamera />,
      videographer: <Videocam />,
      musicproducer: <MusicNote />,
      music_producer: <MusicNote />,
      vendor: <Store />,
    };
    return icons[profession] || <Person />;
  };

  // Save tutorial dismissal mutation (uses POST /api/user/preferences/tutorial-dismissal)
  const saveTutorialDismissalMutation = useMutation({
    mutationFn: async (data: { dismissed: boolean; completedSteps: number[]; profession?: string }) => {
      return await apiRequest('/api/user/preferences/tutorial-dismissal', {
        method: 'POST',
        body: JSON.stringify({
          tutorialId: TUTORIAL_ID,
          dismissed: data.dismissed,
          completedSteps: data.completedSteps,
          profession: data.profession || profession
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorialPreferences', TUTORIAL_ID] });
    },
    onError: () => {
      // Fallback to localStorage
      if (dontShowAgain) {
        localStorage.setItem(`${TUTORIAL_ID}-tutorial-dismissed`, 'true');
      }
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(completedSteps));
    }
  });

  // Update tutorial progress mutation (uses PATCH /api/user/preferences/tutorial/:id/progress)
  const updateProgressMutation = useMutation({
    mutationFn: async (newCompletedSteps: number[]) => {
      return await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({
          completedSteps: newCompletedSteps
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutorialPreferences', TUTORIAL_ID] });
    },
    onError: () => {
      // Fallback to localStorage
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(completedSteps));
    }
  });

  // Handle step completion
  const handleStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      const newCompleted = [...completedSteps, stepIndex];
      setCompletedSteps(newCompleted);
      // Use PATCH endpoint for progress updates
      updateProgressMutation.mutate(newCompleted);
    }
  };

  // Handle next step
  const handleNext = () => {
    handleStepComplete(activeStep);
    setActiveStep((prev) => prev + 1);
  };

  // Handle previous step
  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  // Handle close and dismiss
  const handleClose = async () => {
    if (dontShowAgain) {
      setIsSaving(true);
      try {
        // Use POST endpoint for dismissal
        await saveTutorialDismissalMutation.mutateAsync({
          dismissed: true,
          completedSteps,
          profession
        });
        enqueueSnackbar('Guiden er skjult. Du finner den igjen via Hjelp-menyen eller ⌘+?', { 
          variant: 'info',
          autoHideDuration: 5000 
        });
        onDismiss?.();
      } catch {
        // Fallback to localStorage
        localStorage.setItem(`${TUTORIAL_ID}-tutorial-dismissed`, 'true');
        localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(completedSteps));
      } finally {
        setIsSaving(false);
      }
    }
    onClose();
  };

  // ============================================================================
  // Tutorial Steps Content
  // ============================================================================

  const tutorialSteps = [
    {
      label: 'Velkommen til fellesskapet',
      icon: <Forum />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Velkommen til CreatorHub Fellesskap!
          </Typography>
          
          <Alert 
            severity="info" 
            sx={{ 
              mb: 2,
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#3b82f6',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              Dette er din guide til å bli en aktiv del av Norges største kreative fellesskap.
              Bruk <strong>5-10 minutter</strong> på denne guiden for å komme raskt i gang.
            </Typography>
          </Alert>

          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
            Hva du vil lære:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Navigere i kanaler og grupper" 
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Sende meldinger med emoji og vedlegg"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Starte private samtaler"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Delta i avstemninger og polls"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Få hjelp fra mentorer"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle sx={{ color: '#10b981', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
              <ListItemText 
                primary="Tjene badges og poeng"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
              />
            </ListItem>
          </List>

          <Paper sx={{ 
            p: { xs: 2, sm: 2.5, md: 3 }, 
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            mt: 2,
            backdropFilter: 'blur(10px)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }}>
                {getProfessionIcon()}
              </Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}>
                Tilpasset for deg som {getProfessionDisplayName()}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.9rem' } }}>
              Denne guiden er tilpasset din profesjon. Du vil se tips og kanaler som er 
              relevante for {getProfessionDisplayName().toLowerCase()}-miljøet.
            </Typography>
          </Paper>
        </Box>
      )
    },
    {
      label: 'Navigere i fellesskapet',
      icon: <Group />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
            Finn veien rundt
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
            Fellesskapet er organisert i <strong>grupper</strong> og <strong>kanaler</strong>.
            Tenk på det som et kontorbygg med ulike rom.
          </Typography>

          <Table size="small" sx={{ mb: 2, '& .MuiTableCell-root': { borderColor: 'rgba(245, 158, 11, 0.2)' } }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 120, color: '#fff' }}>
                  <Chip 
                    icon={<Group sx={{ color: '#f59e0b' }} />} 
                    label="Grupper" 
                    size="small"
                    sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Samler folk med felles interesser. F.eks. "Fotografer Norge" eller "Bryllupsfoto"
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#fff' }}>
                  <Chip 
                    icon={<Forum sx={{ color: '#f59e0b' }} />} 
                    label="Kanaler" 
                    size="small"
                    sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Spesifikke samtaler innen en gruppe. F.eks. "#tips-triks" eller "#jobbtilbud"
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#fff' }}>
                  <Chip 
                    icon={<Lock sx={{ color: '#f59e0b' }} />} 
                    label="Private" 
                    size="small"
                    sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                  />
                </TableCell>
                <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Noen kanaler krever spesifikke rettigheter eller medlemskap
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Alert 
            severity="success" 
            icon={<TipsAndUpdates sx={{ color: '#10b981' }} />} 
            sx={{ 
              mb: 2,
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#10b981',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              <strong>Tips:</strong> Bruk søkefeltet øverst (⌘+K) for å raskt finne 
              kanaler, meldinger eller brukere.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}>
            Prøv dette:
          </Typography>
          <Paper sx={{ 
            p: { xs: 2, sm: 2.5, md: 3 }, 
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              1. Klikk på en <strong>gruppe</strong> i venstre sidefelt<br />
              2. Velg en <strong>kanal</strong> for å se meldinger<br />
              3. Bruk <strong>søkefeltet</strong> for å finne "{getProfessionDisplayName().toLowerCase()}"
            </Typography>
          </Paper>
        </Box>
      )
    },
    {
      label: 'Sende meldinger',
      icon: <Send />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
            Kommuniser med fellesskapet
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
            Å sende meldinger er enkelt. Her er alt du trenger å vite:
          </Typography>

          <Accordion 
            defaultExpanded
            sx={{
              bgcolor: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              mb: 1,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  '& .MuiTypography-root': {
                    color: '#fff',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <Typography fontWeight={600}>Skrive en melding</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <List dense>
                <ListItem>
                  <ListItemIcon><Send sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
                  <ListItemText 
                    primary="Skriv i tekstfeltet nederst"
                    secondary="Trykk Enter for å sende, Shift+Enter for ny linje"
                    primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion
            sx={{
              bgcolor: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              mb: 1,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  '& .MuiTypography-root': {
                    color: '#fff',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <Typography fontWeight={600}>Legge til emoji</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <List dense>
                <ListItem>
                  <ListItemIcon><EmojiEmotions sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
                  <ListItemText 
                    primary="Klikk på emoji-ikonet"
                    secondary="Eller skriv :emoji_navn: for hurtigtilgang"
                    primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion
            sx={{
              bgcolor: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              mb: 1,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  '& .MuiTypography-root': {
                    color: '#fff',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <Typography fontWeight={600}>Dele filer</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <List dense>
                <ListItem>
                  <ListItemIcon><AttachFile sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
                  <ListItemText 
                    primary="Klikk på binders-ikonet"
                    secondary="Last opp fra enhet eller velg fra Google Drive"
                    primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion
            sx={{
              bgcolor: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: '12px',
              mb: 1,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMore sx={{ color: '#f59e0b' }} />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  '& .MuiTypography-root': {
                    color: '#fff',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <Typography fontWeight={600}>Svare på meldinger</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <List dense>
                <ListItem>
                  <ListItemIcon><Reply sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} /></ListItemIcon>
                  <ListItemText 
                    primary="Hold over melding → Klikk svar-ikonet"
                    secondary="Starter en tråd under originalmeldingen"
                    primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                    secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Alert 
            severity="info" 
            sx={{ 
              mt: 2,
              bgcolor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#3b82f6',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              <strong>@-nevning:</strong> Skriv @brukernavn for å varsle noen direkte.
              De får en notifikasjon umiddelbart.
            </Typography>
          </Alert>
        </Box>
      )
    },
    {
      label: 'Private samtaler',
      icon: <Chat />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
            Direkte meldinger (DM)
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
            Noen samtaler er best en-til-en. Slik starter du en privat samtale:
          </Typography>

          <Paper sx={{ 
            p: { xs: 2, sm: 2.5, md: 3 }, 
            mb: 2, 
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}>
              Metode 1: Via brukerprofil
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    1
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Klikk på brukerens avatar eller navn"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    2
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Klikk «Send melding» i profilen"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    3
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Skriv din melding og send"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
            </List>
          </Paper>

          <Paper sx={{ 
            p: { xs: 2, sm: 2.5, md: 3 }, 
            mb: 2, 
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' } }}>
              Metode 2: Via chat-ikon
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    1
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Klikk chat-ikonet øverst i høyre hjørne"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    2
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Søk etter brukeren"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Box
                    sx={{
                      width: { xs: 24, sm: 28, md: 32 },
                      height: { xs: 24, sm: 28, md: 32 },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: { xs: 12, sm: 14, md: 16 },
                      fontWeight: 700,
                    }}
                  >
                    3
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary="Start samtalen"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
            </List>
          </Paper>

          <Alert 
            severity="warning" 
            icon={<Warning sx={{ color: '#f59e0b' }} />}
            sx={{
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#f59e0b',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              <strong>Respekter andres tid:</strong> Private meldinger bør være 
              relevante og profesjonelle. Spam eller uønskede meldinger kan føre 
              til blokkering.
            </Typography>
          </Alert>
        </Box>
      )
    },
    {
      label: 'Avstemninger & Mentorer',
      icon: <HowToVote />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
            Delta aktivt
          </Typography>

          <Divider sx={{ my: 2, borderColor: 'rgba(245, 158, 11, 0.2)' }} />

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: { xs: 36, sm: 40, md: 44 },
                  height: { xs: 36, sm: 40, md: 44 },
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                }}
              >
                <HowToVote sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                Avstemninger
              </Typography>
            </Box>
            
            <Typography variant="body2" paragraph sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }, mb: 2 }}>
              Stem på forslag, del dine meninger, og påvirk fellesskapets retning.
            </Typography>

            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Finn avstemninger"
                  secondary="Klikk på avstemmingsikonet i venstre sidefelt"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Avgi din stemme"
                  secondary="Klikk tommel opp/ned på forslagene"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle sx={{ color: '#10b981', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Opprett egen avstemning"
                  secondary="Klikk «+ Ny avstemning» for å starte"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 3, borderColor: 'rgba(245, 158, 11, 0.2)' }} />

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: { xs: 36, sm: 40, md: 44 },
                  height: { xs: 36, sm: 40, md: 44 },
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <School sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                Mentorer
              </Typography>
            </Box>
            
            <Typography variant="body2" paragraph sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' }, mb: 2 }}>
              Få hjelp fra erfarne {getProfessionDisplayName().toLowerCase()}-eksperter.
            </Typography>

            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Help sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Still spørsmål"
                  secondary="Klikk på Mentor-ikonet og skriv spørsmålet ditt"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <QuestionAnswer sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Se ubesvarte spørsmål"
                  secondary="Hjelp andre ved å svare på åpne spørsmål"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Star sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 24 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Bli mentor"
                  secondary="Søk om å bli mentor når du har nok erfaring"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
                />
              </ListItem>
            </List>
          </Box>
        </Box>
      )
    },
    {
      label: 'Badges & Engasjement',
      icon: <EmojiEvents />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
            Tjene anerkjennelse
          </Typography>

          <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' }, mb: 3 }}>
            Jo mer du deltar, jo flere badges og poeng får du. 
            Her er hvordan systemet fungerer:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
            {/* +1 poeng */}
            <Paper
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 48, sm: 56, md: 64 },
                    height: { xs: 48, sm: 56, md: 64 },
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <Favorite sx={{ color: '#fff', fontSize: { xs: 24, sm: 28, md: 32 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#ef4444', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                      +1 poeng
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Gi en reaksjon på en melding
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* +2 poeng */}
            <Paper
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: 'rgba(59, 130, 246, 0.5)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 48, sm: 56, md: 64 },
                    height: { xs: 48, sm: 56, md: 64 },
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <Send sx={{ color: '#fff', fontSize: { xs: 24, sm: 28, md: 32 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#3b82f6', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                      +2 poeng
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Send en melding
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* +3 poeng */}
            <Paper
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: 'rgba(139, 92, 246, 0.5)',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 48, sm: 56, md: 64 },
                    height: { xs: 48, sm: 56, md: 64 },
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <Reply sx={{ color: '#fff', fontSize: { xs: 24, sm: 28, md: 32 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#8b5cf6', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                      +3 poeng
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Svar i en tråd
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* +5 poeng */}
            <Paper
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: 'rgba(16, 185, 129, 0.5)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 48, sm: 56, md: 64 },
                    height: { xs: 48, sm: 56, md: 64 },
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <HowToVote sx={{ color: '#fff', fontSize: { xs: 24, sm: 28, md: 32 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#10b981', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                      +5 poeng
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Delta i en avstemning
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* +10 poeng */}
            <Paper
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                  borderColor: 'rgba(245, 158, 11, 0.5)',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box
                  sx={{
                    width: { xs: 48, sm: 56, md: 64 },
                    height: { xs: 48, sm: 56, md: 64 },
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                    flexShrink: 0,
                  }}
                >
                  <School sx={{ color: '#fff', fontSize: { xs: 24, sm: 28, md: 32 } }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#f59e0b', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                      +10 poeng
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Svar på et mentor-spørsmål
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>

          <Alert 
            severity="success" 
            icon={<EmojiEvents sx={{ color: '#10b981' }} />} 
            sx={{ 
              mb: 2,
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#fff',
              '& .MuiAlert-icon': {
                color: '#10b981',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
              <strong>Badges:</strong> Du låser opp badges automatisk når du 
              når visse milepæler. Se alle dine badges i profilen din!
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' }, mt: 2 }}>
            Dine første mål:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </ListItemIcon>
              <ListItemText 
                primary="Send din første melding" 
                secondary="Utstedes: Velkommen-badge"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </ListItemIcon>
              <ListItemText 
                primary="Gi 10 reaksjoner" 
                secondary="Utstedes: Supporter-badge"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle sx={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </ListItemIcon>
              <ListItemText 
                primary="Delta i 3 avstemninger" 
                secondary="Utstedes: Demokrat-badge"
                primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                secondaryTypographyProps={{ sx: { color: 'rgba(255, 255, 255, 0.6)', fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } } }}
              />
            </ListItem>
          </List>
        </Box>
      )
    },
    {
      label: 'Sjekkliste & Tips',
      icon: <CheckCircle />,
      content: (
        <Box>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: { xs: 80, sm: 96, md: 112 },
                height: { xs: 80, sm: 96, md: 112 },
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
              }}
            >
              <CheckCircle sx={{ color: '#fff', fontSize: { xs: 40, sm: 48, md: 56 } }} />
            </Box>
            <Typography variant="h5" gutterBottom fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}>
              Du er klar til å starte!
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
              Her er en oppsummering og noen siste tips:
            </Typography>
          </Box>

          {/* Kom-i-gang sjekkliste */}
          <Paper sx={{ 
            p: { xs: 2.5, sm: 3, md: 3.5 }, 
            mb: 3, 
            background: 'rgba(16, 185, 129, 0.1)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: { xs: 40, sm: 44, md: 48 },
                  height: { xs: 40, sm: 44, md: 48 },
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                }}
              >
                <CheckCircle sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                Kom-i-gang sjekkliste:
              </Typography>
            </Box>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <Checkbox 
                    size="small" 
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#10b981',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Bli med i en gruppe relatert til din profesjon"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Checkbox 
                    size="small"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#10b981',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Send din første melding i #presentasjoner"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Checkbox 
                    size="small"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#10b981',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Gi en reaksjon på en annens melding"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Checkbox 
                    size="small"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#10b981',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Sjekk ut en aktiv avstemning"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Checkbox 
                    size="small"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#10b981',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText 
                  primary="Still et spørsmål til en mentor (valgfritt)"
                  primaryTypographyProps={{ sx: { color: '#fff', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } } }}
                />
              </ListItem>
            </List>
          </Paper>

          {/* Vanlige feil å unngå */}
          <Alert 
            severity="warning" 
            icon={<Warning sx={{ color: '#f59e0b' }} />} 
            sx={{ 
              mb: 3,
              bgcolor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fff',
              borderRadius: '12px',
              '& .MuiAlert-icon': {
                color: '#f59e0b',
              },
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' }, mb: 1 }}>
              Vanlige feil å unngå:
            </Typography>
            <List dense sx={{ mb: 0, pb: 0 }}>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon>
                  <Close sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Ikke spam samme melding i flere kanaler"
                  primaryTypographyProps={{ 
                    sx: { 
                      color: '#fff', 
                      fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } 
                    } 
                  }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon>
                  <Close sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Unngå selvpromotering uten å gi verdi først"
                  primaryTypographyProps={{ 
                    sx: { 
                      color: '#fff', 
                      fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } 
                    } 
                  }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemIcon>
                  <Close sx={{ color: '#f59e0b', fontSize: { xs: 18, sm: 20, md: 22 } }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Ikke del andres innhold uten tillatelse"
                  primaryTypographyProps={{ 
                    sx: { 
                      color: '#fff', 
                      fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } 
                    } 
                  }}
                />
              </ListItem>
            </List>
          </Alert>

          {/* Hurtigtaster */}
          <Paper sx={{ 
            p: { xs: 2.5, sm: 3, md: 3.5 }, 
            mb: 3,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: { xs: 40, sm: 44, md: 48 },
                  height: { xs: 40, sm: 44, md: 48 },
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Search sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' } }}>
                Hurtigtaster:
              </Typography>
            </Box>
            <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'rgba(245, 158, 11, 0.2)' } }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    ⌘ + K
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Åpne søk
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    ⌘ + ?
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Åpne denne guiden
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Shift + Enter
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Ny linje i melding
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Esc
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Lukk dialog/modal
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Divider sx={{ my: 3, borderColor: 'rgba(245, 158, 11, 0.2)' }} />

          {/* Komplett eksempel */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: { xs: 40, sm: 44, md: 48 },
                  height: { xs: 40, sm: 44, md: 48 },
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                <TipsAndUpdates sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
              </Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
                Komplett eksempel: "Slik blir du aktiv på 5 minutter"
              </Typography>
            </Box>

            <Paper sx={{ 
              p: { xs: 2.5, sm: 3, md: 3.5 }, 
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              backdropFilter: 'blur(10px)',
            }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: { xs: 14, sm: 16, md: 18 },
                    }}
                  >
                    1
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Klikk på gruppen <strong>"{getProfessionDisplayName()}-fellesskapet"</strong> i venstre meny.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: { xs: 14, sm: 16, md: 18 },
                    }}
                  >
                    2
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Velg kanalen <strong>"#presentasjoner"</strong>.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: { xs: 14, sm: 16, md: 18 },
                    }}
                  >
                    3
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Skriv: <strong>"Hei alle! Jeg heter [navn] og jobber som {getProfessionDisplayName().toLowerCase()} i [by]. Gleder meg til å bli kjent med dere!"</strong>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: { xs: 14, sm: 16, md: 18 },
                    }}
                  >
                    4
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Trykk <strong>Enter</strong> for å sende.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: { xs: 32, sm: 36, md: 40 },
                      height: { xs: 32, sm: 36, md: 40 },
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontWeight: 700,
                      color: '#fff',
                      fontSize: { xs: 14, sm: 16, md: 18 },
                    }}
                  >
                    5
                  </Box>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem' } }}>
                    Scroll opp og gi en reaksjon på noen andres presentasjon.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    mt: 1,
                    p: { xs: 2, sm: 2.5, md: 3 },
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)',
                    border: '2px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '12px',
                  }}
                >
                  <Typography variant="body1" fontWeight={700} sx={{ color: '#10b981', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
                    Gratulerer! Du har nå sendt din første melding og gitt din første reaksjon. Du er offisielt en del av fellesskapet!
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      )
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxHeight: '90vh',
          bgcolor: '#1a1a2e',
          backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
          color: '#fff',
          overflow: 'hidden',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
        p: { xs: 2, sm: 2.5, md: 3 },
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 64 },
              height: { xs: 48, sm: 56, md: 64 },
              borderRadius: '12px',
              background: 'rgba(26, 26, 46, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              p: 1,
            }}
          >
            <CreatorHubLogoIcon size={32} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' } }}>
              Velkommen til Fellesskapet
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' } }}>
              Din komplette guide til CreatorHub Norge Community
            </Typography>
          </Box>
        </Box>
        <IconButton 
          onClick={handleClose} 
          size="small"
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.1)',
            },
            '&:focus': {
              outline: '3px solid #f59e0b',
              outlineOffset: '2px',
            },
          }}
          aria-label="Lukk tutorial"
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ 
        p: { xs: 2, sm: 2.5, md: 3 }, 
        bgcolor: 'transparent', 
        color: '#fff',
        '& .MuiTypography-root': {
          color: '#fff',
        },
        '& .MuiTable-root': {
          '& .MuiTableCell-root': {
            color: '#fff',
            borderColor: 'rgba(245, 158, 11, 0.2)',
          },
        },
        '& .MuiAccordion-root': {
          bgcolor: 'rgba(26, 26, 46, 0.6)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          color: '#fff',
          '&:before': {
            display: 'none',
          },
          '& .MuiAccordionSummary-root': {
            color: '#fff',
            '& .MuiTypography-root': {
              color: '#fff',
            },
            '& .MuiIconButton-root': {
              color: '#f59e0b',
            },
          },
          '& .MuiAccordionDetails-root': {
            color: 'rgba(255, 255, 255, 0.8)',
          },
        },
      }}>
        <Stepper 
          activeStep={activeStep} 
          orientation="vertical" 
          sx={{ 
            '& .MuiStepLabel-root': {
              '& .MuiStepLabel-label': {
                color: '#fff',
                fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                fontWeight: activeStep === activeStep ? 600 : 400,
              },
            },
            '& .MuiStepConnector-root': {
              '& .MuiStepConnector-line': {
                borderColor: 'rgba(245, 158, 11, 0.2)',
              },
            },
            '& .MuiStepConnector-active .MuiStepConnector-line': {
              borderColor: '#f59e0b',
            },
            '& .MuiStepConnector-completed .MuiStepConnector-line': {
              borderColor: '#10b981',
            },
          }}
        >
          {tutorialSteps.map((step, index) => (
            <Step key={step.label} completed={completedSteps.includes(index)}>
              <StepLabel
                optional={
                  index === tutorialSteps.length - 1 ? (
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>Siste steg</Typography>
                  ) : null
                }
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: { xs: 36, sm: 40, md: 44 },
                      height: { xs: 36, sm: 40, md: 44 },
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: activeStep === index 
                        ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                        : completedSteps.includes(index)
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      boxShadow: activeStep === index 
                        ? '0 4px 12px rgba(245, 158, 11, 0.4)'
                        : completedSteps.includes(index)
                          ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                          : 'none',
                      border: activeStep === index 
                        ? '2px solid rgba(245, 158, 11, 0.5)'
                        : completedSteps.includes(index)
                          ? '2px solid rgba(16, 185, 129, 0.5)'
                          : '2px solid rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {completedSteps.includes(index) ? (
                      <CheckCircle sx={{ fontSize: { xs: 20, sm: 22, md: 24 } }} />
                    ) : (
                      <Box sx={{ fontSize: { xs: 18, sm: 20, md: 22 }, display: 'flex', alignItems: 'center' }}>
                        {step.icon}
                      </Box>
                    )}
                  </Box>
                )}
              >
                <Typography fontWeight={activeStep === index ? 700 : 500} sx={{ color: '#fff' }}>
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={{ py: 2 }}>
                  {step.content}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    size="small"
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                      '&:hover': {
                        borderColor: '#f59e0b',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                      },
                      '&:disabled': {
                        color: 'rgba(255, 255, 255, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      },
                      '&:focus': {
                        outline: '3px solid #f59e0b',
                        outlineOffset: '2px',
                      },
                    }}
                  >
                    Tilbake
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    size="small"
                    sx={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      minHeight: { xs: '44px', sm: '44px', md: '48px' },
                      fontSize: { xs: '14px', sm: '15px', md: '16px' },
                      padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px' },
                      borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                      '&:hover': {
                        background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                      },
                      '&:focus': {
                        outline: '3px solid #fff',
                        outlineOffset: '2px',
                      },
                    }}
                  >
                    {index === tutorialSteps.length - 1 ? 'Fullfør' : 'Neste'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {activeStep === tutorialSteps.length && (
          <Box sx={{ p: { xs: 2, sm: 2.5, md: 3 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: { xs: 80, sm: 96, md: 112 },
                height: { xs: 80, sm: 96, md: 112 },
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
              }}
            >
              <EmojiEvents sx={{ fontSize: { xs: 40, sm: 48, md: 56 }, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#fff', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}>
              Gratulerer!
            </Typography>
            <Typography variant="body1" paragraph sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.9rem', sm: '1rem', md: '1.125rem' } }}>
              Du har fullført guiden og er klar til å bli en aktiv del av fellesskapet.
            </Typography>
            <Alert 
              severity="info" 
              sx={{ 
                textAlign: 'left', 
                maxWidth: 400, 
                mx: 'auto',
                bgcolor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#fff',
                '& .MuiAlert-icon': {
                  color: '#3b82f6',
                },
              }}
            >
              <Typography variant="body2" sx={{ color: '#fff' }}>
                <strong>Åpne guiden igjen:</strong><br />
                Klikk på <Help sx={{ fontSize: 14, verticalAlign: 'middle', color: '#3b82f6' }} /> Hjelp-ikonet 
                eller trykk <code style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>⌘+?</code>
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: { xs: 2, sm: 2.5, md: 3 }, 
        py: { xs: 1.5, sm: 2, md: 2.5 }, 
        borderTop: '1px solid rgba(245, 158, 11, 0.2)', 
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
        justifyContent: 'space-between' 
      }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-checked': {
                  color: '#f59e0b',
                },
                '&:focus': {
                  outline: '3px solid #f59e0b',
                  outlineOffset: '2px',
                },
              }}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.9rem' } }}>
              Ikke vis denne guiden automatisk igjen
            </Typography>
          }
        />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isSaving && <CircularProgress size={20} sx={{ color: '#f59e0b' }} />}
          <Button 
            onClick={handleClose} 
            disabled={isSaving}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              minHeight: { xs: '44px', sm: '44px', md: '48px' },
              fontSize: { xs: '14px', sm: '15px', md: '16px' },
              padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px' },
              '&:hover': {
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
              },
              '&:disabled': {
                color: 'rgba(255, 255, 255, 0.3)',
              },
              '&:focus': {
                outline: '3px solid #f59e0b',
                outlineOffset: '2px',
              },
            }}
          >
            {activeStep === tutorialSteps.length ? 'Lukk' : 'Hopp over'}
          </Button>
          {activeStep < tutorialSteps.length && (
            <Button
              variant="outlined"
              onClick={() => setActiveStep(tutorialSteps.length)}
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                minHeight: { xs: '44px', sm: '44px', md: '48px' },
                fontSize: { xs: '14px', sm: '15px', md: '16px' },
                padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px' },
                '&:hover': {
                  borderColor: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b',
                },
                '&:focus': {
                  outline: '3px solid #f59e0b',
                  outlineOffset: '2px',
                },
              }}
            >
              Gå til slutt
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default CommunityTutorial;

// Hook to manage tutorial visibility
export function useCommunityTutorial(userId: string) {
  const [showTutorial, setShowTutorial] = React.useState(false);
  const [hasChecked, setHasChecked] = React.useState(false);

  // Check if tutorial should be shown
  const { data: tutorialPrefs, isLoading } = useQuery<TutorialPreference>({
    queryKey: ['tutorialPreferences', TUTORIAL_ID],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}`);
      } catch {
        const localDismissed = localStorage.getItem(`${TUTORIAL_ID}-tutorial-dismissed`);
        return {
          tutorialId: TUTORIAL_ID,
          dismissed: localDismissed === 'true',
          dismissedAt: null,
          completedSteps: [],
          profession: null
        };
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000
  });

  React.useEffect(() => {
    if (!isLoading && tutorialPrefs && !hasChecked) {
      setHasChecked(true);
      // Show tutorial if not dismissed
      if (!tutorialPrefs.dismissed) {
        setShowTutorial(true);
      }
    }
  }, [tutorialPrefs, isLoading, hasChecked]);

  const openTutorial = React.useCallback(() => {
    setShowTutorial(true);
  }, []);

  const closeTutorial = React.useCallback(() => {
    setShowTutorial(false);
  }, []);

  return {
    showTutorial,
    openTutorial,
    closeTutorial,
    isLoading,
    isDismissed: tutorialPrefs?.dismissed ?? false
  };
}
