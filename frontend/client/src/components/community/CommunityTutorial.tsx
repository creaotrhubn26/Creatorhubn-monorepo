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
  Lock,
} from '@mui/icons-material';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useSnackbar } from 'notistack';

const TUTORIAL_ID = 'community-guide';
const COMMUNITY_GUIDE_BACKGROUND = `
  radial-gradient(circle at top right, rgba(255, 140, 0, 0.18), transparent 28%),
  radial-gradient(circle at bottom left, rgba(88, 122, 168, 0.16), transparent 30%),
  linear-gradient(180deg, #0a0f1a 0%, #091019 52%, #06080c 100%)
`;
const COMMUNITY_GUIDE_PANEL_ALT =
  'linear-gradient(180deg, rgba(18, 24, 34, 0.92), rgba(10, 14, 21, 0.96))';
const COMMUNITY_GUIDE_BORDER = '1px solid rgba(255,255,255,0.08)';
const COMMUNITY_GUIDE_TEXT = 'rgba(255, 255, 255, 0.94)';
const COMMUNITY_GUIDE_MUTED = 'rgba(255, 255, 255, 0.66)';
const COMMUNITY_GUIDE_ACCENT = '#ff8c00';
const COMMUNITY_GUIDE_ACCENT_BRIGHT = '#ffd27a';
const COMMUNITY_GUIDE_SUCCESS = '#78d6a3';
const COMMUNITY_GUIDE_WARNING = '#f4b35e';
const COMMUNITY_GUIDE_ERROR = '#ff8e83';
const COMMUNITY_GUIDE_BASE_PAPER_SX = {
  p: 2,
  borderRadius: 3,
  background: COMMUNITY_GUIDE_PANEL_ALT,
  border: COMMUNITY_GUIDE_BORDER,
  boxShadow: '0 18px 36px rgba(0, 0, 0, 0.24)',
} as const;
const COMMUNITY_GUIDE_STEP_CONTENT_SX = {
  py: 2.5,
  color: COMMUNITY_GUIDE_TEXT,
  '& .MuiTypography-root': {
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiTypography-body2, & .MuiTypography-caption, & .MuiTypography-colorTextSecondary': {
    color: COMMUNITY_GUIDE_MUTED,
  },
  '& .MuiAlert-root': {
    borderRadius: 3,
    border: COMMUNITY_GUIDE_BORDER,
    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.18)',
  },
  '& .MuiAlert-icon': {
    opacity: 1,
  },
  '& .MuiAlert-standardInfo': {
    bgcolor: 'rgba(88, 122, 168, 0.16)',
    borderColor: 'rgba(88, 122, 168, 0.28)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiAlert-standardInfo .MuiAlert-icon': {
    color: '#9dc6ff',
  },
  '& .MuiAlert-standardSuccess': {
    bgcolor: 'rgba(120, 214, 163, 0.12)',
    borderColor: 'rgba(120, 214, 163, 0.24)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiAlert-standardSuccess .MuiAlert-icon': {
    color: COMMUNITY_GUIDE_SUCCESS,
  },
  '& .MuiAlert-standardWarning': {
    bgcolor: 'rgba(244, 179, 94, 0.12)',
    borderColor: 'rgba(244, 179, 94, 0.24)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiAlert-standardWarning .MuiAlert-icon': {
    color: COMMUNITY_GUIDE_WARNING,
  },
  '& .MuiAlert-standardError': {
    bgcolor: 'rgba(255, 142, 131, 0.12)',
    borderColor: 'rgba(255, 142, 131, 0.24)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiAlert-standardError .MuiAlert-icon': {
    color: COMMUNITY_GUIDE_ERROR,
  },
  '& .MuiPaper-root:not(.MuiDialog-paper)': {
    background: `${COMMUNITY_GUIDE_PANEL_ALT} !important`,
    border: COMMUNITY_GUIDE_BORDER,
    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.24)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiAccordion-root': {
    background: 'rgba(255,255,255,0.03) !important',
    border: COMMUNITY_GUIDE_BORDER,
    borderRadius: '22px !important',
    overflow: 'hidden',
    boxShadow: '0 18px 36px rgba(0, 0, 0, 0.18)',
  },
  '& .MuiAccordion-root::before': {
    display: 'none',
  },
  '& .MuiAccordion-root + .MuiAccordion-root': {
    mt: 1.2,
  },
  '& .MuiAccordionSummary-root': {
    px: 2,
    minHeight: 58,
  },
  '& .MuiAccordionSummary-content': {
    my: 1.5,
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: COMMUNITY_GUIDE_MUTED,
  },
  '& .MuiAccordionDetails-root': {
    pt: 0,
    px: 2,
    pb: 2,
  },
  '& .MuiDivider-root': {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  '& .MuiListItem-root': {
    px: 0,
  },
  '& .MuiListItemText-primary': {
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiListItemText-secondary': {
    color: COMMUNITY_GUIDE_MUTED,
  },
  '& .MuiListItemIcon-root': {
    minWidth: 34,
    color: COMMUNITY_GUIDE_ACCENT,
  },
  '& .MuiTableCell-root': {
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: COMMUNITY_GUIDE_TEXT,
    py: 1.1,
  },
  '& .MuiTableRow-root:last-of-type .MuiTableCell-root': {
    borderBottom: 'none',
  },
  '& .MuiChip-root': {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05) !important',
    border: '1px solid rgba(255,255,255,0.1)',
    color: COMMUNITY_GUIDE_TEXT,
  },
  '& .MuiChip-colorPrimary': {
    backgroundColor: 'rgba(88, 122, 168, 0.18) !important',
    borderColor: 'rgba(88, 122, 168, 0.28)',
  },
  '& .MuiChip-colorSecondary': {
    backgroundColor: 'rgba(171, 137, 255, 0.18) !important',
    borderColor: 'rgba(171, 137, 255, 0.28)',
  },
  '& .MuiChip-colorSuccess': {
    backgroundColor: 'rgba(120, 214, 163, 0.16) !important',
    borderColor: 'rgba(120, 214, 163, 0.28)',
  },
  '& .MuiChip-colorWarning': {
    backgroundColor: 'rgba(255, 140, 0, 0.16) !important',
    borderColor: 'rgba(255, 140, 0, 0.28)',
    color: COMMUNITY_GUIDE_ACCENT_BRIGHT,
  },
  '& .MuiChip-colorError': {
    backgroundColor: 'rgba(255, 142, 131, 0.16) !important',
    borderColor: 'rgba(255, 142, 131, 0.28)',
  },
  '& strong': {
    color: '#ffffff',
  },
  '& code': {
    fontFamily: 'IBM Plex Mono, ui-monospace, SFMono-Regular, monospace',
    fontSize: '0.82rem',
    color: COMMUNITY_GUIDE_ACCENT_BRIGHT,
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '0.1rem 0.35rem',
  },
} as const;

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

function readLocalTutorialPreference(): Pick<TutorialPreference, 'dismissed' | 'completedSteps'> {
  try {
    const localDismissed = localStorage.getItem(`${TUTORIAL_ID}-tutorial-dismissed`);
    const localSteps = localStorage.getItem(`${TUTORIAL_ID}-completed-steps`);

    return {
      dismissed: localDismissed === 'true',
      completedSteps: localSteps ? JSON.parse(localSteps) : [],
    };
  } catch {
    return {
      dismissed: false,
      completedSteps: [],
    };
  }
}

function mergeTutorialPreference(
  remote?: Partial<TutorialPreference> | null,
): TutorialPreference {
  const local = readLocalTutorialPreference();
  const remoteSteps = Array.isArray(remote?.completedSteps) ? remote.completedSteps : [];

  return {
    tutorialId: typeof remote?.tutorialId === 'string' ? remote.tutorialId : TUTORIAL_ID,
    dismissed: Boolean(remote?.dismissed) || local.dismissed,
    dismissedAt: typeof remote?.dismissedAt === 'string' ? remote.dismissedAt : null,
    completedSteps: Array.from(new Set([...remoteSteps, ...local.completedSteps])),
    profession: typeof remote?.profession === 'string' ? remote.profession : null,
  };
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
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Fetch tutorial preferences from database
  const { data: tutorialPrefs } = useQuery<TutorialPreference>({
    queryKey: ['tutorialPreferences', TUTORIAL_ID],
    queryFn: async () => {
      try {
        const remotePrefs = await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}`);
        return mergeTutorialPreference(remotePrefs);
      } catch {
        return mergeTutorialPreference();
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
    onSuccess: (_result, variables) => {
      localStorage.setItem(`${TUTORIAL_ID}-tutorial-dismissed`, String(variables.dismissed));
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(variables.completedSteps));
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
    onSuccess: (_result, newCompletedSteps) => {
      localStorage.setItem(`${TUTORIAL_ID}-completed-steps`, JSON.stringify(newCompletedSteps));
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
            🎉 Velkommen til CreatorHub Fellesskap!
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Dette er din guide til å bli en aktiv del av Norges største kreative fellesskap.
              Bruk <strong>5-10 minutter</strong> på denne guiden for å komme raskt i gang.
            </Typography>
          </Alert>

          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            📚 Hva du vil lære:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Navigere i kanaler og grupper" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Sende meldinger med emoji og vedlegg" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Starte private samtaler" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Delta i avstemninger og polls" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Få hjelp fra mentorer" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Tjene merker og poeng" />
            </ListItem>
          </List>

          <Paper
            sx={{
              ...COMMUNITY_GUIDE_BASE_PAPER_SX,
              mt: 2,
              background:
                'linear-gradient(180deg, rgba(255, 140, 0, 0.14), rgba(255, 140, 0, 0.05))',
              border: '1px solid rgba(255, 140, 0, 0.22)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getProfessionIcon()}
              <Typography variant="subtitle2" fontWeight={600}>
                Tilpasset for deg som {getProfessionDisplayName()}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: COMMUNITY_GUIDE_MUTED }}>
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
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🗂️ Finn veien rundt
          </Typography>

          <Typography variant="body1" paragraph>
            Fellesskapet er organisert i <strong>grupper</strong> og <strong>kanaler</strong>.
            Tenk på det som et kontorbygg med ulike rom.
          </Typography>

          <Table size="small" sx={{ mb: 2 }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 120 }}>
                  <Chip icon={<Group />} label="Grupper" size="small" />
                </TableCell>
                <TableCell>
                  Samler folk med felles interesser. F.eks. "Fotografer Norge" eller "Bryllupsfoto"
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<Forum />} label="Kanaler" size="small" />
                </TableCell>
                <TableCell>
                  Spesifikke samtaler innen en gruppe. F.eks. "#tips-triks" eller "#jobbtilbud"
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<Lock />} label="Private" size="small" color="warning" />
                </TableCell>
                <TableCell>
                  Noen kanaler krever spesifikke rettigheter eller medlemskap
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Alert severity="success" icon={<TipsAndUpdates />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Tips:</strong> Bruk søkefeltet øverst (⌘+K) for å raskt finne 
              kanaler, meldinger eller brukere.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            👆 Prøv dette:
          </Typography>
          <Paper
            sx={{
              ...COMMUNITY_GUIDE_BASE_PAPER_SX,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255, 140, 0, 0.32)',
            }}
          >
            <Typography variant="body2">
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
          <Typography variant="h6" gutterBottom fontWeight={600}>
            💬 Kommuniser med fellesskapet
          </Typography>

          <Typography variant="body1" paragraph>
            Å sende meldinger er enkelt. Her er alt du trenger å vite:
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={600}>📝 Skrive en melding</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><Send fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Skriv i tekstfeltet nederst"
                    secondary="Trykk Enter for å sende, Shift+Enter for ny linje"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={600}>😊 Legge til emoji</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><EmojiEmotions fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Klikk på emoji-ikonet"
                    secondary="Eller skriv :emoji_navn: for hurtigtilgang"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={600}>📎 Dele filer</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><AttachFile fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Klikk på binders-ikonet"
                    secondary="Last opp fra enhet eller velg fra Google Drive"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={600}>↩️ Svare på meldinger</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemIcon><Reply fontSize="small" /></ListItemIcon>
                  <ListItemText 
                    primary="Hold over melding → Klikk svar-ikonet"
                    secondary="Starter en tråd under originalmeldingen"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
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
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🔒 Direkte meldinger (DM)
          </Typography>

          <Typography variant="body1" paragraph>
            Noen samtaler er best en-til-en. Slik starter du en privat samtale:
          </Typography>

          <Paper sx={{ ...COMMUNITY_GUIDE_BASE_PAPER_SX, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Metode 1: Via brukerprofil
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="1. Klikk på brukerens avatar eller navn" />
              </ListItem>
              <ListItem>
                <ListItemText primary="2. Klikk «Send melding» i profilen" />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Skriv din melding og send" />
              </ListItem>
            </List>
          </Paper>

          <Paper sx={{ ...COMMUNITY_GUIDE_BASE_PAPER_SX, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Metode 2: Via chat-ikon
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="1. Klikk chat-ikonet øverst i høyre hjørne" />
              </ListItem>
              <ListItem>
                <ListItemText primary="2. Søk etter brukeren" />
              </ListItem>
              <ListItem>
                <ListItemText primary="3. Start samtalen" />
              </ListItem>
            </List>
          </Paper>

          <Alert severity="warning" icon={<Warning />}>
            <Typography variant="body2">
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
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🗳️ Delta aktivt
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <HowToVote sx={{ mr: 1, verticalAlign: 'middle' }} />
            Avstemninger
          </Typography>
          
          <Typography variant="body2" paragraph>
            Stem på forslag, del dine meninger, og påvirk fellesskapets retning.
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Finn avstemninger"
                secondary="Klikk på 🗳️ ikonet i venstre sidefelt"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Avgi din stemme"
                secondary="Klikk tommel opp/ned på forslagene"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="success" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Opprett egen avstemning"
                secondary="Klikk «+ Ny avstemning» for å starte"
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            <School sx={{ mr: 1, verticalAlign: 'middle' }} />
            Mentorer
          </Typography>
          
          <Typography variant="body2" paragraph>
            Få hjelp fra erfarne {getProfessionDisplayName().toLowerCase()}-eksperter.
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon><Help color="primary" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Still spørsmål"
                secondary="Klikk på 🎓 Mentor-ikonet og skriv spørsmålet ditt"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><QuestionAnswer color="primary" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Se ubesvarte spørsmål"
                secondary="Hjelp andre ved å svare på åpne spørsmål"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Star color="warning" fontSize="small" /></ListItemIcon>
              <ListItemText 
                primary="Bli mentor"
                secondary="Søk om å bli mentor når du har nok erfaring"
              />
            </ListItem>
          </List>
        </Box>
      )
    },
    {
      label: 'Merker & engasjement',
      icon: <EmojiEvents />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🏆 Tjene anerkjennelse
          </Typography>

          <Typography variant="body1" paragraph>
            Jo mer du deltar, jo flere merker og poeng får du.
            Her er hvordan systemet fungerer:
          </Typography>

          <Table size="small" sx={{ mb: 2 }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<Favorite />} label="+1 poeng" size="small" color="error" />
                </TableCell>
                <TableCell>Gi en reaksjon på en melding</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<Send />} label="+2 poeng" size="small" color="primary" />
                </TableCell>
                <TableCell>Send en melding</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<Reply />} label="+3 poeng" size="small" color="secondary" />
                </TableCell>
                <TableCell>Svar i en tråd</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<HowToVote />} label="+5 poeng" size="small" color="success" />
                </TableCell>
                <TableCell>Delta i en avstemning</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Chip icon={<School />} label="+10 poeng" size="small" color="warning" />
                </TableCell>
                <TableCell>Svar på et mentor-spørsmål</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Alert severity="success" icon={<EmojiEvents />} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Merker:</strong> Du låser opp merker automatisk når du
              når visse milepæler. Se alle merkene dine i profilen din!
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📈 Dine første mål:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Send din første melding" secondary="Utstedes: Velkommen-merke" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Gi 10 reaksjoner" secondary="Utstedes: Supporter-merke" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Delta i 3 avstemninger" secondary="Utstedes: Demokrat-merke" />
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
          <Typography variant="h6" gutterBottom fontWeight={600}>
            ✅ Du er klar til å starte!
          </Typography>

          <Typography variant="body1" paragraph>
            Her er en oppsummering og noen siste tips:
          </Typography>

          <Paper
            sx={{
              ...COMMUNITY_GUIDE_BASE_PAPER_SX,
              mb: 2,
              background:
                'linear-gradient(180deg, rgba(120, 214, 163, 0.14), rgba(120, 214, 163, 0.05))',
              border: '1px solid rgba(120, 214, 163, 0.24)',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              📋 Kom-i-gang sjekkliste:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon><Checkbox size="small" /></ListItemIcon>
                <ListItemText primary="Bli med i en gruppe relatert til din profesjon" />
              </ListItem>
              <ListItem>
                <ListItemIcon><Checkbox size="small" /></ListItemIcon>
                <ListItemText primary="Send din første melding i #presentasjoner" />
              </ListItem>
              <ListItem>
                <ListItemIcon><Checkbox size="small" /></ListItemIcon>
                <ListItemText primary="Gi en reaksjon på en annens melding" />
              </ListItem>
              <ListItem>
                <ListItemIcon><Checkbox size="small" /></ListItemIcon>
                <ListItemText primary="Sjekk ut en aktiv avstemning" />
              </ListItem>
              <ListItem>
                <ListItemIcon><Checkbox size="small" /></ListItemIcon>
                <ListItemText primary="Still et spørsmål til en mentor (valgfritt)" />
              </ListItem>
            </List>
          </Paper>

          <Alert severity="error" icon={<Warning />} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              ⚠️ Vanlige feil å unngå:
            </Typography>
            <List dense sx={{ mb: 0, pb: 0 }}>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText 
                  primary="Ikke spam samme melding i flere kanaler" 
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText 
                  primary="Unngå selvpromotering uten å gi verdi først" 
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem sx={{ py: 0.5 }}>
                <ListItemText 
                  primary="Ikke del andres innhold uten tillatelse" 
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            </List>
          </Alert>

          <Paper
            sx={{
              ...COMMUNITY_GUIDE_BASE_PAPER_SX,
              background:
                'linear-gradient(180deg, rgba(88, 122, 168, 0.14), rgba(88, 122, 168, 0.05))',
              border: '1px solid rgba(88, 122, 168, 0.22)',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              🔑 Hurtigtaster:
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>⌘ + K</TableCell>
                  <TableCell>Åpne søk</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>⌘ + ?</TableCell>
                  <TableCell>Åpne denne guiden</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>Shift + Enter</TableCell>
                  <TableCell>Ny linje i melding</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontFamily: 'monospace' }}>Esc</TableCell>
                  <TableCell>Lukk dialog/modal</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom fontWeight={600}>
            📖 Komplett eksempel: "Slik blir du aktiv på 5 minutter"
          </Typography>

          <Paper
            sx={{
              ...COMMUNITY_GUIDE_BASE_PAPER_SX,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <Typography variant="body2" component="div">
              <strong>Steg 1:</strong> Klikk på gruppen "{getProfessionDisplayName()}-fellesskapet" i venstre meny.<br /><br />
              <strong>Steg 2:</strong> Velg kanalen "#presentasjoner".<br /><br />
              <strong>Steg 3:</strong> Skriv: "Hei alle! Jeg heter [navn] og jobber som {getProfessionDisplayName().toLowerCase()} i [by]. Gleder meg til å bli kjent med dere! 📸"<br /><br />
              <strong>Steg 4:</strong> Trykk Enter for å sende.<br /><br />
              <strong>Steg 5:</strong> Scroll opp og gi en 👍 på noen andres presentasjon.<br /><br />
              <strong>Gratulerer!</strong> Du har nå sendt din første melding og gitt din første reaksjon. Du er offisielt en del av fellesskapet! 🎉
            </Typography>
          </Paper>
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
      sx={{
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(4, 6, 10, 0.76)',
          backdropFilter: 'blur(12px)',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: { xs: 3, md: 4 },
          maxHeight: '90vh',
          background: COMMUNITY_GUIDE_BACKGROUND,
          border: COMMUNITY_GUIDE_BORDER,
          boxShadow: '0 36px 90px rgba(0, 0, 0, 0.56)',
          color: COMMUNITY_GUIDE_TEXT,
          overflow: 'hidden',
        }
      }}
    >
      <DialogTitle
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2.5, md: 3 },
          py: 2.5,
          background: 'linear-gradient(180deg, rgba(13, 18, 27, 0.96), rgba(9, 13, 20, 0.92))',
          borderBottom: COMMUNITY_GUIDE_BORDER,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -120,
            right: -60,
            width: 260,
            height: 260,
            background:
              'radial-gradient(circle, rgba(255, 140, 0, 0.24) 0%, rgba(255, 140, 0, 0) 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.2), rgba(255, 140, 0, 0.08))',
              border: '1px solid rgba(255, 140, 0, 0.28)',
              color: COMMUNITY_GUIDE_ACCENT_BRIGHT,
              boxShadow: '0 14px 30px rgba(0, 0, 0, 0.24)',
            }}
          >
            <Forum sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Chip
              label="Fellesskapsguide"
              size="small"
              sx={{
                mb: 1,
                bgcolor: 'rgba(255, 140, 0, 0.14)',
                color: COMMUNITY_GUIDE_ACCENT_BRIGHT,
                border: '1px solid rgba(255, 140, 0, 0.24)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: COMMUNITY_GUIDE_TEXT,
              }}
            >
              Velkommen til Fellesskapet
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.75,
                color: COMMUNITY_GUIDE_MUTED,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', color: COMMUNITY_GUIDE_ACCENT_BRIGHT }}>
                {getProfessionIcon()}
              </Box>
              Din komplette guide til CreatorHub Norge Community, tilpasset {getProfessionDisplayName().toLowerCase()}-flyten.
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            position: 'relative',
            zIndex: 1,
            color: COMMUNITY_GUIDE_TEXT,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.04)',
            '&:hover': {
              bgcolor: 'rgba(255, 140, 0, 0.1)',
              borderColor: 'rgba(255, 140, 0, 0.24)',
            },
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.28), rgba(5, 7, 11, 0.72))',
        }}
      >
        <Stepper
          activeStep={activeStep}
          orientation="vertical"
          sx={{
            p: { xs: 2.25, md: 3 },
            '& .MuiStepConnector-line': {
              borderColor: 'rgba(255,255,255,0.1)',
              borderLeftWidth: 2,
              minHeight: 24,
            },
            '& .MuiStepContent-root': {
              borderLeftColor: 'rgba(255,255,255,0.1)',
              ml: 1.1,
              pl: 3,
              py: 0.5,
            },
          }}
        >
          {tutorialSteps.map((step, index) => (
            <Step key={step.label} completed={completedSteps.includes(index)}>
              <StepLabel
                optional={
                  index === tutorialSteps.length - 1 ? (
                    <Typography variant="caption" sx={{ color: COMMUNITY_GUIDE_MUTED }}>
                      Siste steg
                    </Typography>
                  ) : null
                }
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: activeStep === index 
                        ? `linear-gradient(135deg, ${COMMUNITY_GUIDE_ACCENT} 0%, ${COMMUNITY_GUIDE_ACCENT_BRIGHT} 100%)`
                        : completedSteps.includes(index)
                          ? `linear-gradient(135deg, ${COMMUNITY_GUIDE_SUCCESS} 0%, #9af0c1 100%)`
                          : 'rgba(255,255,255,0.05)',
                      border: activeStep === index || completedSteps.includes(index)
                        ? 'none'
                        : '1px solid rgba(255,255,255,0.1)',
                      boxShadow:
                        activeStep === index || completedSteps.includes(index)
                          ? '0 16px 28px rgba(0, 0, 0, 0.24)'
                          : 'none',
                      color:
                        activeStep === index || completedSteps.includes(index)
                          ? '#0a0f1a'
                          : COMMUNITY_GUIDE_TEXT,
                    }}
                  >
                    {completedSteps.includes(index) ? (
                      <CheckCircle fontSize="small" />
                    ) : (
                      step.icon
                    )}
                  </Box>
                )}
              >
                <Typography
                  sx={{
                    fontWeight: activeStep === index ? 700 : 600,
                    color: activeStep === index ? COMMUNITY_GUIDE_TEXT : 'rgba(255, 255, 255, 0.82)',
                  }}
                >
                  {step.label}
                </Typography>
              </StepLabel>
              <StepContent>
                <Box sx={COMMUNITY_GUIDE_STEP_CONTENT_SX}>
                  {step.content}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    size="small"
                    sx={{
                      color: COMMUNITY_GUIDE_MUTED,
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.1)',
                      px: 1.8,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.16)',
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
                      borderRadius: 999,
                      px: 1.8,
                      background: `linear-gradient(135deg, ${COMMUNITY_GUIDE_ACCENT} 0%, ${COMMUNITY_GUIDE_ACCENT_BRIGHT} 100%)`,
                      color: '#0a0f1a',
                      fontWeight: 700,
                      boxShadow: '0 18px 30px rgba(0, 0, 0, 0.24)',
                      '&:hover': {
                        background: `linear-gradient(135deg, ${COMMUNITY_GUIDE_ACCENT_BRIGHT} 0%, #ffe1a7 100%)`,
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
          <Box
            sx={{
              ...COMMUNITY_GUIDE_STEP_CONTENT_SX,
              p: { xs: 2.5, md: 3 },
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                mx: 'auto',
                maxWidth: 560,
                borderRadius: 4,
                background: COMMUNITY_GUIDE_PANEL_ALT,
                border: COMMUNITY_GUIDE_BORDER,
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
                px: { xs: 2.5, md: 4 },
                py: { xs: 3, md: 4 },
              }}
            >
              <EmojiEvents sx={{ fontSize: 64, color: COMMUNITY_GUIDE_ACCENT_BRIGHT, mb: 2 }} />
              <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: COMMUNITY_GUIDE_TEXT }}>
                🎉 Gratulerer!
              </Typography>
              <Typography variant="body1" sx={{ color: COMMUNITY_GUIDE_MUTED }} paragraph>
                Du har fullført guiden og er klar til å bli en aktiv del av fellesskapet.
              </Typography>
              <Alert severity="info" sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
                <Typography variant="body2">
                  <strong>Åpne guiden igjen:</strong><br />
                  Klikk på <Help sx={{ fontSize: 14, verticalAlign: 'middle' }} /> Hjelp-ikonet
                  eller trykk <code>⌘+?</code>
                </Typography>
              </Alert>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2.5, md: 3 },
          py: 2.25,
          borderTop: COMMUNITY_GUIDE_BORDER,
          background: 'linear-gradient(180deg, rgba(8, 12, 18, 0.88), rgba(5, 7, 11, 0.96))',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
              sx={{
                color: COMMUNITY_GUIDE_MUTED,
                '&.Mui-checked': {
                  color: COMMUNITY_GUIDE_ACCENT,
                },
              }}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: COMMUNITY_GUIDE_MUTED }}>
              Ikke vis denne guiden automatisk igjen
            </Typography>
          }
        />
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            justifyContent: { xs: 'space-between', md: 'flex-end' },
            flexWrap: 'wrap',
          }}
        >
          {isSaving && <CircularProgress size={20} sx={{ color: COMMUNITY_GUIDE_ACCENT }} />}
          <Button
            onClick={handleClose}
            disabled={isSaving}
            sx={{
              color: COMMUNITY_GUIDE_MUTED,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.1)',
              px: 2,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.16)',
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
                borderRadius: 999,
                px: 2,
                color: COMMUNITY_GUIDE_ACCENT_BRIGHT,
                borderColor: 'rgba(255, 140, 0, 0.24)',
                backgroundColor: 'rgba(255, 140, 0, 0.08)',
                '&:hover': {
                  borderColor: 'rgba(255, 140, 0, 0.34)',
                  backgroundColor: 'rgba(255, 140, 0, 0.12)',
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
        const remotePrefs = await apiRequest(`/api/user/preferences/tutorial/${TUTORIAL_ID}`);
        return mergeTutorialPreference(remotePrefs);
      } catch {
        return mergeTutorialPreference();
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
