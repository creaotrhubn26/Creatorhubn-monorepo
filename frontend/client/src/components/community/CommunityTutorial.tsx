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
              <ListItemText primary="Tjene badges og poeng" />
            </ListItem>
          </List>

          <Paper sx={{ p: 2, bgcolor: theming.colors.primary + '10', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {getProfessionIcon()}
              <Typography variant="subtitle2" fontWeight={600}>
                Tilpasset for deg som {getProfessionDisplayName()}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
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
          <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px dashed', borderColor: 'grey.300' }}>
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

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
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

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
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
      label: 'Badges & Engasjement',
      icon: <EmojiEvents />,
      content: (
        <Box>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            🏆 Tjene anerkjennelse
          </Typography>

          <Typography variant="body1" paragraph>
            Jo mer du deltar, jo flere badges og poeng får du. 
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
              <strong>Badges:</strong> Du låser opp badges automatisk når du 
              når visse milepæler. Se alle dine badges i profilen din!
            </Typography>
          </Alert>

          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📈 Dine første mål:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Send din første melding" secondary="Utstedes: Velkommen-badge" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Gi 10 reaksjoner" secondary="Utstedes: Supporter-badge" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircle color="disabled" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Delta i 3 avstemninger" secondary="Utstedes: Demokrat-badge" />
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

          <Paper sx={{ p: 2, mb: 2, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
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

          <Paper sx={{ p: 2, bgcolor: theming.colors.primary + '10' }}>
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

          <Paper sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.300' }}>
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
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        bgcolor: theming.colors.primary + '10',
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Forum sx={{ color: theming.colors.primary, fontSize: 32 }} />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Velkommen til Fellesskapet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Din komplette guide til CreatorHub Norge Community
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Stepper activeStep={activeStep} orientation="vertical" sx={{ p: 3 }}>
          {tutorialSteps.map((step, index) => (
            <Step key={step.label} completed={completedSteps.includes(index)}>
              <StepLabel
                optional={
                  index === tutorialSteps.length - 1 ? (
                    <Typography variant="caption">Siste steg</Typography>
                  ) : null
                }
                StepIconComponent={() => (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: activeStep === index 
                        ? theming.colors.primary 
                        : completedSteps.includes(index)
                          ? 'success.main'
                          : 'grey.300',
                      color: 'white',
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
                <Typography fontWeight={activeStep === index ? 600 : 400}>
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
                  >
                    Tilbake
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    size="small"
                    sx={{
                      bgcolor: theming.colors.primary,
                      '&:hover': { bgcolor: theming.colors.primary }
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
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <EmojiEvents sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              🎉 Gratulerer!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
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
        )}
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        py: 2, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        justifyContent: 'space-between' 
      }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Ikke vis denne guiden automatisk igjen
            </Typography>
          }
        />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {isSaving && <CircularProgress size={20} />}
          <Button onClick={handleClose} disabled={isSaving}>
            {activeStep === tutorialSteps.length ? 'Lukk' : 'Hopp over'}
          </Button>
          {activeStep < tutorialSteps.length && (
            <Button
              variant="outlined"
              onClick={() => setActiveStep(tutorialSteps.length)}
              size="small"
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
