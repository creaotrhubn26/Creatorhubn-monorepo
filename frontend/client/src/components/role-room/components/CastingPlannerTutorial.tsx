import { useState, useEffect, useCallback, useRef, createElement, type ComponentType, type FC, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Fade,
  LinearProgress,
  Chip,
  Avatar,
  useMediaQuery,
  useTheme,
  Slider,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Replay as ReplayIcon,
  School as TutorialIcon,
  Inventory2 as PropIcon,
  MovieCreation as ShotListIcon,
  InterpreterMode as AuditionIcon,
  CheckCircle as CompleteIcon,
  TouchApp as ActionIcon,
  Speed as SpeedIcon,
  AutoAwesome as AIIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material';
import {
  DashboardCustomIcon as DashboardIcon,
  RolesIcon,
  CandidatesIcon,
  TeamIcon,
  LocationsIcon as LocationIcon,
  CalendarCustomIcon as CalendarIcon,
  ShareCustomIcon as ShareIcon,
} from './icons/CastingIcons';
// Compatible icon type for both MUI SvgIcon and custom FC<IconProps> components
type IconComponentType = ComponentType<{ sx?: Record<string, unknown> }>;
import { tutorialService, Tutorial, TutorialStep } from '../services/tutorialService';

const defaultTutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Velkommen til Casting Planner!',
    description: 'Denne veiledningen tar deg gjennom alle funksjonene i Casting Planner. Du lærer hvordan du planlegger produksjoner, administrerer team, og organiserer opptak effektivt.',
    panel: -1,
    duration: 8000,
    tips: [
      'Du kan pause veiledningen når som helst',
      'Klikk på stegene i fremdriftslinjen for å hoppe til et spesifikt steg',
      'Trykk ESC for å lukke veiledningen',
    ],
  },
  {
    id: 'overview',
    title: '1. Oversikt - Ditt dashboard',
    description: 'Oversikten gir deg et fugleperspektiv av prosjektet ditt. Her ser du statistikk, fremdrift og viktige varsler.',
    panel: 0,
    targetSelector: '[role="tab"]:first-of-type',
    action: 'click',
    actionDescription: 'Klikk på "Oversikt"-fanen for å se dashboardet',
    tips: [
      'Dashboardet viser prosjektets totale fremdrift',
      'Du kan se antall roller, kandidater og planlagte opptak',
      'Kanban-visningen gir rask oversikt over oppgavestatus',
    ],
    duration: 10000,
  },
  {
    id: 'roles',
    title: '2. Roller - Definer karakterene',
    description: 'Her oppretter og administrerer du alle rollene i produksjonen din. Hver rolle kan ha detaljerte beskrivelser, krav og karaktertrekk.',
    panel: 1,
    targetSelector: '[role="tab"]:nth-of-type(2)',
    action: 'click',
    actionDescription: 'Klikk på "Roller"-fanen',
    tips: [
      'Klikk "Opprett rolle" for å legge til en ny rolle',
      'Du kan legge til aldersspenn, kjønn og spesielle ferdigheter',
      'Hver rolle kan knyttes til spesifikke scener',
      'Bruk prioritet for å markere hovedroller vs. biroller',
    ],
    duration: 12000,
  },
  {
    id: 'candidates',
    title: '3. Kandidater - Finn riktig person',
    description: 'Her administrerer du alle kandidater som har søkt eller blitt invitert til casting. Du kan se profiler, notater og castingstatus.',
    panel: 2,
    targetSelector: '[role="tab"]:nth-of-type(3)',
    action: 'click',
    actionDescription: 'Klikk på "Kandidater"-fanen',
    tips: [
      'Importer kandidater fra fil eller legg til manuelt',
      'Hver kandidat kan knyttes til én eller flere roller',
      'Bruk statusfilter for å se kun godkjente, avventende, eller avviste',
      'Last opp headshots og CV for hver kandidat',
    ],
    duration: 12000,
  },
  {
    id: 'team',
    title: '4. Team - Organiser crewet',
    description: 'Her administrerer du hele produksjonsteamet ditt. Legg til crew-medlemmer med roller, kontaktinfo og tilgjengelighet.',
    panel: 3,
    targetSelector: '[role="tab"]:nth-of-type(4)',
    action: 'click',
    actionDescription: 'Klikk på "Team"-fanen',
    tips: [
      'Legg til crew med navn, rolle og kontaktinfo',
      'Tildel ansvar for spesifikke oppgaver',
      'Se hvem som er tilgjengelig på hvilke dager',
      'Team-medlemmer kan tilordnes shots i Shot-list',
    ],
    duration: 10000,
  },
  {
    id: 'locations',
    title: '5. Steder - Finn locations',
    description: 'Her dokumenterer og organiserer du alle innspillingssteder. Legg til bilder, adresser, tillatelser og praktisk informasjon.',
    panel: 4,
    targetSelector: '[role="tab"]:nth-of-type(5)',
    action: 'click',
    actionDescription: 'Klikk på "Steder"-fanen',
    tips: [
      'Last opp bilder av hver location',
      'Legg til adresse og veibeskrivelse',
      'Dokumenter tillatelser og kontaktpersoner',
      'Merk hvilke scener som skal filmes hvor',
    ],
    duration: 10000,
  },
  {
    id: 'props',
    title: '6. Utstyr - Hold oversikt over rekvisitter',
    description: 'Administrer alle rekvisitter, kostymer og utstyr som trengs i produksjonen. Spor status og tilgjengelighet.',
    panel: 5,
    targetSelector: '[role="tab"]:nth-of-type(6)',
    action: 'click',
    actionDescription: 'Klikk på "Utstyr"-fanen',
    tips: [
      'Kategoriser utstyr (rekvisitter, kostymer, teknisk)',
      'Sett status: Tilgjengelig, Utlånt, Trenger innkjøp',
      'Knytt utstyr til spesifikke scener',
      'Legg til bilder for enkel identifisering',
    ],
    duration: 10000,
  },
  {
    id: 'calendar',
    title: '7. Kalender - Planlegg opptaksdager',
    description: 'Kalenderen gir deg full oversikt over hele produksjonsplanen. Se alle opptaksdager, møter og deadlines i én visning.',
    panel: 6,
    targetSelector: '[role="tab"]:nth-of-type(7)',
    action: 'click',
    actionDescription: 'Klikk på "Kalender"-fanen',
    tips: [
      'Dra for å opprette nye hendelser',
      'Klikk på en dag for å se alle aktiviteter',
      'Farger viser type aktivitet (opptak, møte, etc.)',
      'Hold oversikt over crew-tilgjengelighet',
    ],
    duration: 10000,
  },
  {
    id: 'shotlist',
    title: '8. Shot Lists - Planlegg hvert bilde',
    description: 'Shot-listen er hjertet av produksjonsplanleggingen. Her definerer du hvert enkelt shot med kameravinkel, bevegelse og beskrivelse.',
    panel: 7,
    targetSelector: '[role="tab"]:nth-of-type(8)',
    action: 'click',
    actionDescription: 'Klikk på "Shot Lists"-fanen',
    tips: [
      'Opprett shot lists for hver scene',
      'Angi kameravinkel, bevegelse og linse',
      'Legg til beskrivelse og referansebilder',
      'Estimer tid for hvert shot',
      'Generer AI-storyboard automatisk',
    ],
    duration: 12000,
  },
  {
    id: 'shotlist-ai',
    title: '8.1 AI Storyboard-generering',
    description: 'Bruk AI til å automatisk generere storyboard-bilder basert på shot-beskrivelsene dine. Velg visuell stil og klikk "Opprett storyboard".',
    panel: 7,
    action: 'click',
    actionDescription: 'Klikk på "Opprett storyboard"-knappen',
    tips: [
      'Velg blant 12 visuelle stiler (Cinematic, Documentary, etc.)',
      'AI genererer bilder basert på shot-beskrivelser',
      'Eksporter storyboard som PDF',
      'Regenerer enkeltbilder ved behov',
    ],
    duration: 10000,
  },
  {
    id: 'shotlist-team',
    title: '8.2 Team Dashboard',
    description: 'Åpne Team Dashboard for å se alle shots i Kanban-visning. Dra shots mellom kolonner, tilordne til teammedlemmer, og spor fremdrift.',
    panel: 7,
    action: 'click',
    actionDescription: 'Klikk på den rosa "Team"-knappen',
    tips: [
      'Kanban-visning: Dra shots mellom Venter, Pågår, Fullført',
      'Se arbeidsbelastning per teammedlem',
      'Filtrer på tilordnet person eller prioritet',
      'Aktivitetslogg viser alle endringer',
    ],
    duration: 10000,
  },
  {
    id: 'auditions',
    title: '9. Auditions - Planlegg castings',
    description: 'Her planlegger og administrerer du alle auditions og castings. Sett opp tider, inviter kandidater, og dokumenter resultater.',
    panel: 8,
    targetSelector: '[role="tab"]:nth-of-type(9)',
    action: 'click',
    actionDescription: 'Klikk på "Auditions"-fanen',
    tips: [
      'Opprett audition-økter med tid og sted',
      'Inviter kandidater til spesifikke tider',
      'Ta notater under auditionen',
      'Sammenlign kandidater side ved side',
    ],
    duration: 10000,
  },
  {
    id: 'sharing',
    title: '10. Deling - Samarbeid med andre',
    description: 'Del prosjektet med teammedlemmer eller klienter. Sett tilgangsnivåer og generer delbare lenker.',
    panel: 9,
    targetSelector: '[role="tab"]:nth-of-type(10)',
    action: 'click',
    actionDescription: 'Klikk på "Deling"-fanen',
    tips: [
      'Inviter teammedlemmer via e-post',
      'Velg tilgangsnivå: Kun visning, Rediger, Admin',
      'Generer offentlige lenker med begrenset tilgang',
      'Se hvem som har tilgang til prosjektet',
    ],
    duration: 10000,
  },
  {
    id: 'complete',
    title: 'Gratulerer! Du har fullført veiledningen',
    description: 'Du har nå lært alle hovedfunksjonene i Casting Planner. Klikk på "Nytt prosjekt"-knappen for å starte din første produksjon!',
    panel: -1,
    targetSelector: '[data-tutorial-target="create-project-button"]',
    action: 'click',
    actionDescription: 'Klikk på "Nytt prosjekt"-knappen for å opprette ditt første prosjekt',
    duration: 10000,
    tips: [
      'Klikk på den markerte knappen for å opprette et nytt prosjekt',
      'Velg prosjekttype og fyll ut detaljene',
      'Legg til roller og begynn å samle kandidater',
      'Team Dashboard holder alle synkronisert',
    ],
  },
];

const panelInfo = [
  { name: 'Oversikt', icon: DashboardIcon, color: '#8b5cf6' },
  { name: 'Roller', icon: RolesIcon, color: '#f48fb1' },
  { name: 'Kandidater', icon: CandidatesIcon, color: '#10b981' },
  { name: 'Team', icon: TeamIcon, color: '#00d4ff' },
  { name: 'Steder', icon: LocationIcon, color: '#4caf50' },
  { name: 'Utstyr', icon: PropIcon, color: '#ff9800' },
  { name: 'Kalender', icon: CalendarIcon, color: '#9c27b0' },
  { name: 'Shot Lists', icon: ShotListIcon, color: '#e91e63' },
  { name: 'Auditions', icon: AuditionIcon, color: '#ffb800' },
  { name: 'Deling', icon: ShareIcon, color: '#06b6d4' },
];

const stepIndicatorMeta: Record<string, { label: string; icon: IconComponentType; color?: string }> = {
  'welcome': { label: 'Start', icon: TutorialIcon, color: '#e91e63' },
  'overview': { label: 'Oversikt', icon: DashboardIcon, color: '#8b5cf6' },
  'roles': { label: 'Roller', icon: RolesIcon, color: '#f48fb1' },
  'candidates': { label: 'Kandidater', icon: CandidatesIcon, color: '#10b981' },
  'team': { label: 'Team', icon: TeamIcon, color: '#00d4ff' },
  'locations': { label: 'Steder', icon: LocationIcon, color: '#4caf50' },
  'props': { label: 'Utstyr', icon: PropIcon, color: '#ff9800' },
  'calendar': { label: 'Kalender', icon: CalendarIcon, color: '#9c27b0' },
  'shotlist': { label: 'Shot Lists', icon: ShotListIcon, color: '#e91e63' },
  'shotlist-ai': { label: 'AI', icon: AIIcon, color: '#00d4ff' },
  'shotlist-team': { label: 'Dashboard', icon: TeamIcon, color: '#ff4081' },
  'auditions': { label: 'Auditions', icon: AuditionIcon, color: '#ffb800' },
  'sharing': { label: 'Deling', icon: ShareIcon, color: '#06b6d4' },
  'complete': { label: 'Slutt', icon: CelebrationIcon, color: '#4caf50' },
};

interface CastingPlannerTutorialProps {
  open: boolean;
  onClose: () => void;
  onNavigateToTab?: (tabIndex: number) => void;
  customTutorial?: Tutorial;
  category?: Tutorial['category'];
}

export const CastingPlannerTutorial: FC<CastingPlannerTutorialProps> = ({
  open,
  onClose,
  onNavigateToTab,
  customTutorial,
  category = 'casting-planner',
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const isMobile = useMediaQuery('(max-width:599px)');
  const isTablet = useMediaQuery('(min-width:600px) and (max-width:959px)');
  const is720p = useMediaQuery('(min-width:960px) and (max-width:1279px)');
  const is1080p = useMediaQuery('(min-width:1280px) and (max-width:1919px)');
  const is2K = useMediaQuery('(min-width:1920px) and (max-width:2559px)');
  const is4K = useMediaQuery('(min-width:2560px)');

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getResponsiveValue = <T,>(mobile: T, tablet: T, hd720: T, hd1080: T, uhd2k: T, uhd4k: T): T => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    if (is720p) return hd720;
    if (is1080p) return hd1080;
    if (is2K) return uhd2k;
    if (is4K) return uhd4k;
    return uhd4k;
  };

  const TOUCH_TARGET_MIN = 44;

  const modalMaxWidth = getResponsiveValue<string | number>(
    '100%',
    '90%',
    650,
    750,
    900,
    1100
  );

  const modalPadding = getResponsiveValue(1.5, 2, 2.5, 3, 4, 5);
  const titleFontSize = getResponsiveValue('1rem', '1.125rem', '1.25rem', '1.375rem', '1.5rem', '1.75rem');
  const bodyFontSize = getResponsiveValue('0.813rem', '0.875rem', '0.938rem', '1rem', '1.125rem', '1.25rem');
  const captionFontSize = getResponsiveValue('0.688rem', '0.75rem', '0.813rem', '0.875rem', '0.938rem', '1rem');
  const smallTextSize = getResponsiveValue('0.625rem', '0.688rem', '0.75rem', '0.813rem', '0.875rem', '0.938rem');
  const avatarSize = getResponsiveValue(40, 44, 48, 52, 56, 64);
  const iconSize = getResponsiveValue(20, 22, 24, 26, 28, 32);
  const buttonMinHeight = getResponsiveValue(TOUCH_TARGET_MIN, TOUCH_TARGET_MIN, 48, 52, 56, 64);
  const buttonMinWidth = getResponsiveValue(100, 110, 120, 130, 140, 160);
  const stepBoxMinWidth = getResponsiveValue(52, 58, 64, 72, 80, 92);
  const stepBoxPadding = getResponsiveValue(0.75, 1, 1.25, 1.5, 1.75, 2);
  const stepIconSize = getResponsiveValue(18, 20, 22, 24, 28, 32);
  const stepTextSize = getResponsiveValue('0.6rem', '0.65rem', '0.7rem', '0.75rem', '0.813rem', '0.875rem');
  const gapSize = getResponsiveValue(1, 1.25, 1.5, 1.75, 2, 2.5);
  const borderRadius = getResponsiveValue(2, 2.5, 3, 3.5, 4, 5);

  useEffect(() => {
    if (customTutorial) {
      setActiveTutorial(customTutorial);
    } else {
      const tutorial = tutorialService.getActiveTutorialByCategory(category);
      setActiveTutorial(tutorial || { id: 'default', name: 'Default', description: '', category, steps: defaultTutorialSteps, isActive: true, createdAt: '', updatedAt: '' });
    }
  }, [customTutorial, category, open]);

  const steps = activeTutorial?.steps || defaultTutorialSteps;
  const step = steps[currentStep] || steps[0];
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setIsPlaying(false);
      setHighlightRect(null);
    }
  }, [open]);

  const findTargetElement = useCallback(() => {
    if (!step.targetSelector) {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(step.targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setHighlightRect(rect);
    } else {
      setHighlightRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    if (!open) return;
    
    const timeout = setTimeout(() => {
      findTargetElement();
    }, 300);

    return () => clearTimeout(timeout);
  }, [open, currentStep, findTargetElement]);

  const navigateToStep = useCallback((stepIndex: number) => {
    setCurrentStep(stepIndex);
    const targetStep = steps[stepIndex];
    if (targetStep.panel >= 0 && onNavigateToTab) {
      onNavigateToTab(targetStep.panel);
    }
  }, [onNavigateToTab, steps]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      navigateToStep(currentStep + 1);
    } else {
      onClose();
    }
  }, [currentStep, navigateToStep, onClose, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      navigateToStep(currentStep - 1);
    }
  }, [currentStep, navigateToStep]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextStep();
      if (e.key === 'ArrowLeft') prevStep();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, nextStep, prevStep]);

  useEffect(() => {
    if (!open || !isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const baseDuration = step.duration || 10000;
    const adjustedDuration = baseDuration / speedMultiplier;

    timerRef.current = setTimeout(() => {
      nextStep();
    }, adjustedDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, isPlaying, currentStep, step.duration, nextStep, speedMultiplier]);

  if (!open) return null;

  const highlightPadding = getResponsiveValue(6, 8, 10, 12, 14, 16);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      {highlightRect ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `
              linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.85) ${highlightRect.left - highlightPadding}px, transparent ${highlightRect.left - highlightPadding}px, transparent ${highlightRect.right + highlightPadding}px, rgba(0,0,0,0.85) ${highlightRect.right + highlightPadding}px),
              linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.85) ${highlightRect.top - highlightPadding}px, transparent ${highlightRect.top - highlightPadding}px, transparent ${highlightRect.bottom + highlightPadding}px, rgba(0,0,0,0.85) ${highlightRect.bottom + highlightPadding}px)
            `,
            backgroundBlendMode: 'darken',
          }}
          onClick={onClose}
        />
      ) : (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        />
      )}

      {highlightRect && (
        <>
          <Box
            sx={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: highlightRect.left - highlightPadding,
              height: '100vh',
              bgcolor: 'rgba(0,0,0,0.85)',
              pointerEvents: 'auto',
            }}
            onClick={onClose}
          />
          <Box
            sx={{
              position: 'fixed',
              left: highlightRect.right + highlightPadding,
              top: 0,
              right: 0,
              height: '100vh',
              bgcolor: 'rgba(0,0,0,0.85)',
              pointerEvents: 'auto',
            }}
            onClick={onClose}
          />
          <Box
            sx={{
              position: 'fixed',
              left: highlightRect.left - highlightPadding,
              top: 0,
              width: highlightRect.width + highlightPadding * 2,
              height: highlightRect.top - highlightPadding,
              bgcolor: 'rgba(0,0,0,0.85)',
              pointerEvents: 'auto',
            }}
            onClick={onClose}
          />
          <Box
            sx={{
              position: 'fixed',
              left: highlightRect.left - highlightPadding,
              top: highlightRect.bottom + highlightPadding,
              width: highlightRect.width + highlightPadding * 2,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.85)',
              pointerEvents: 'auto',
            }}
            onClick={onClose}
          />

          <Box
            sx={{
              position: 'fixed',
              left: highlightRect.left - highlightPadding,
              top: highlightRect.top - highlightPadding,
              width: highlightRect.width + highlightPadding * 2,
              height: highlightRect.height + highlightPadding * 2,
              border: '3px solid #e91e63',
              borderRadius: 2,
              boxShadow: '0 0 20px rgba(233,30,99,0.6), 0 0 40px rgba(233,30,99,0.4), inset 0 0 20px rgba(233,30,99,0.2)',
              pointerEvents: 'none',
              zIndex: 10002,
              animation: 'pulse-border 2s infinite ease-in-out',
              '@keyframes pulse-border': {
                '0%': { boxShadow: '0 0 20px rgba(233,30,99,0.6), 0 0 40px rgba(233,30,99,0.4)' },
                '50%': { boxShadow: '0 0 35px rgba(233,30,99,0.8), 0 0 70px rgba(233,30,99,0.6)' },
                '100%': { boxShadow: '0 0 20px rgba(233,30,99,0.6), 0 0 40px rgba(233,30,99,0.4)' },
              },
            }}
          />
        </>
      )}

      <Fade in={open}>
        <Paper
          elevation={24}
          sx={{
            width: isMobile ? '100%' : modalMaxWidth,
            maxWidth: modalMaxWidth,
            maxHeight: isMobile ? '75vh' : isTablet ? '80vh' : '85vh',
            overflow: 'auto',
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMobile ? 0 : borderRadius,
            position: 'relative',
            zIndex: 10001,
            m: isMobile ? 0 : gapSize,
            mt: isMobile ? 'auto' : gapSize,
            mb: isMobile ? 0 : gapSize,
          }}
        >
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: getResponsiveValue(4, 5, 5, 6, 7, 8),
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#e91e63',
                transition: 'transform 0.5s ease',
              },
            }}
          />

          <Box sx={{ p: modalPadding }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: getResponsiveValue(2, 2.5, 3, 3, 3.5, 4) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: getResponsiveValue(1.5, 1.5, 2, 2, 2.5, 3) }}>
                <Box
                  sx={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: 2,
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(233,30,99,0.3)',
                    border: '2px solid rgba(233,30,99,0.5)',
                  }}
                >
                  <img
                    src="/casting-planner-logo.png"
                    alt="Casting Planner"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: '#e91e63', fontSize: captionFontSize }}>
                    Steg {currentStep + 1} av {steps.length}
                  </Typography>
                  <Typography id="tutorial-title" variant="h5" sx={{ color: '#fff', fontWeight: 700, fontSize: titleFontSize, lineHeight: 1.3 }}>
                    {step.title}
                  </Typography>
                </Box>
              </Box>
              <IconButton 
                onClick={onClose} 
                sx={{ 
                  color: 'rgba(255,255,255,0.87)',
                  minWidth: buttonMinHeight,
                  minHeight: buttonMinHeight,
                }}
                aria-label="Lukk veiledning"
              >
                <CloseIcon sx={{ fontSize: getResponsiveValue(20, 22, 24, 26, 28, 30) }} />
              </IconButton>
            </Box>

            {step.panel >= 0 && (
              <Chip
                icon={createElement(panelInfo[step.panel]?.icon || DashboardIcon)}
                label={panelInfo[step.panel]?.name || 'Panel'}
                sx={{
                  mb: 2,
                  fontSize: captionFontSize,
                  height: getResponsiveValue(26, 28, 30, 32, 34, 36),
                  bgcolor: `${panelInfo[step.panel]?.color || '#e91e63'}22`,
                  color: panelInfo[step.panel]?.color || '#e91e63',
                  border: `1px solid ${panelInfo[step.panel]?.color || '#e91e63'}44`,
                  '& .MuiChip-icon': { color: panelInfo[step.panel]?.color || '#e91e63' },
                }}
              />
            )}

            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: bodyFontSize,
                lineHeight: 1.7,
                mb: getResponsiveValue(2, 2.5, 3, 3, 3.5, 4),
              }}
            >
              {step.description}
            </Typography>

            {step.actionDescription && (
              <Paper
                sx={{
                  p: getResponsiveValue(1.5, 1.75, 2, 2, 2.5, 3),
                  mb: getResponsiveValue(2, 2.5, 3, 3, 3.5, 4),
                  bgcolor: 'rgba(233,30,99,0.1)',
                  border: '1px solid rgba(233,30,99,0.3)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: getResponsiveValue(1.5, 1.5, 2, 2, 2.5, 3),
                }}
              >
                <ActionIcon sx={{ color: '#e91e63', fontSize: getResponsiveValue(22, 24, 26, 28, 30, 32) }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#e91e63', fontWeight: 600, fontSize: captionFontSize }}>
                    HANDLING
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff', fontSize: bodyFontSize }}>
                    {step.actionDescription}
                  </Typography>
                </Box>
              </Paper>
            )}

            {step.tips && step.tips.length > 0 && (
              <Box sx={{ mb: getResponsiveValue(2, 2.5, 3, 3, 3.5, 4) }}>
                <Typography variant="subtitle2" sx={{ color: '#4caf50', mb: 1, fontWeight: 600, fontSize: bodyFontSize }}>
                  Tips:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {step.tips.map((tip, index) => (
                    <Typography
                      key={index}
                      component="li"
                      variant="body2"
                      sx={{ color: 'rgba(255,255,255,0.87)', mb: 0.5, fontSize: captionFontSize }}
                    >
                      {tip}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: gapSize,
                mb: gapSize * 1.5,
                justifyContent: 'center',
                maxHeight: getResponsiveValue(140, 160, 180, 200, 240, 280),
                overflowY: 'auto',
                py: 1.5,
                px: 1,
              }}
              role="navigation"
              aria-label="Veiledningssteg"
            >
              {steps.map((s, index) => {
                const meta = stepIndicatorMeta[s.id];
                const panelIndex = s.panel >= 0 ? s.panel : -1;
                const panel = panelIndex >= 0 ? panelInfo[panelIndex] : null;
                const IconComponent = meta?.icon || panel?.icon || TutorialIcon;
                const stepLabel = meta?.label || panel?.name || (index === 0 ? 'Start' : index === steps.length - 1 ? 'Slutt' : `${index + 1}`);
                const stepColor = meta?.color || panel?.color || '#e91e63';
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                
                return (
                  <Box
                    key={s.id}
                    onClick={() => navigateToStep(index)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Gå til steg ${index + 1}: ${s.title}`}
                    aria-current={isActive ? 'step' : undefined}
                    onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigateToStep(index);
                      }
                    }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      p: stepBoxPadding,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      bgcolor: isActive
                        ? `${stepColor}33`
                        : isCompleted
                          ? 'rgba(76,175,80,0.15)'
                          : 'rgba(255,255,255,0.03)',
                      border: isActive
                        ? `2px solid ${stepColor}`
                        : isCompleted
                          ? '2px solid rgba(76,175,80,0.5)'
                          : '1px solid rgba(255,255,255,0.15)',
                      minWidth: stepBoxMinWidth,
                      minHeight: TOUCH_TARGET_MIN,
                      '&:hover, &:focus': {
                        bgcolor: isActive ? `${stepColor}44` : 'rgba(255,255,255,0.12)',
                        outline: 'none',
                        transform: 'scale(1.05)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      },
                      '&:focus-visible': {
                        boxShadow: `0 0 0 3px ${stepColor}`,
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                  >
                    <Avatar
                      sx={{
                        width: stepIconSize * 1.6,
                        height: stepIconSize * 1.6,
                        bgcolor: isActive
                          ? `${stepColor}33`
                          : isCompleted
                            ? 'rgba(76,175,80,0.15)'
                            : 'transparent',
                        border: `1px solid ${isActive ? stepColor : isCompleted ? '#4caf50' : borderColor}`,
                      }}
                    >
                      <IconComponent
                        sx={{
                          fontSize: stepIconSize,
                          color: isActive
                            ? stepColor
                            : isCompleted
                              ? '#4caf50'
                              : 'rgba(255,255,255,0.6)',
                        }}
                      />
                    </Avatar>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: stepTextSize,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive
                          ? stepColor
                          : isCompleted
                            ? '#4caf50'
                            : 'rgba(255,255,255,0.6)',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        maxWidth: stepBoxMinWidth - 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stepLabel}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: gapSize, 
              mb: gapSize, 
              px: 1,
              flexDirection: isMobile ? 'column' : 'row',
              bgcolor: 'rgba(255,255,255,0.03)',
              borderRadius: 2,
              py: 1.5,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SpeedIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: iconSize }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: smallTextSize, whiteSpace: 'nowrap', fontWeight: 500 }}>
                  Hastighet:
                </Typography>
              </Box>
              <Slider
                value={speedMultiplier}
                onChange={(_: Event, value: number | number[]) => setSpeedMultiplier(value as number)}
                min={0.5}
                max={2}
                step={0.25}
                marks={[
                  { value: 0.5, label: '0.5x' },
                  { value: 1, label: '1x' },
                  { value: 2, label: '2x' },
                ]}
                sx={{
                  flex: 1,
                  minWidth: isMobile ? '100%' : getResponsiveValue(120, 140, 160, 180, 200, 240),
                  color: '#e91e63',
                  height: getResponsiveValue(6, 7, 8, 9, 10, 12),
                  '& .MuiSlider-markLabel': {
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: smallTextSize,
                  },
                  '& .MuiSlider-thumb': {
                    width: getResponsiveValue(18, 20, 22, 24, 28, 32),
                    height: getResponsiveValue(18, 20, 22, 24, 28, 32),
                    '&:hover, &:focus': {
                      boxShadow: '0 0 0 8px rgba(233,30,99,0.2)',
                    },
                  },
                  '& .MuiSlider-rail': {
                    opacity: 0.3,
                  },
                }}
              />
            </Box>

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: gapSize,
            }}>
              <Button
                onClick={prevStep}
                disabled={currentStep === 0}
                startIcon={<PrevIcon sx={{ fontSize: iconSize }} />}
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  minHeight: buttonMinHeight,
                  minWidth: buttonMinWidth,
                  fontSize: captionFontSize,
                  fontWeight: 500,
                  order: isMobile ? 1 : 0,
                  flex: isMobile ? '1 1 45%' : 'none',
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.4)',
                  },
                  '&:disabled': { 
                    color: 'rgba(255,255,255,0.6)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Forrige
              </Button>

              <Box sx={{ 
                display: 'flex', 
                gap: gapSize,
                order: isMobile ? 3 : 1,
                flex: isMobile ? '1 1 100%' : 'none',
                justifyContent: 'center',
              }}>
                <IconButton
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause veiledning' : 'Fortsett veiledning'}
                  sx={{
                    color: isPlaying ? '#fff' : 'rgba(255,255,255,0.8)',
                    bgcolor: isPlaying ? '#e91e63' : 'rgba(255,255,255,0.08)',
                    minWidth: buttonMinHeight,
                    minHeight: buttonMinHeight,
                    borderRadius: 2,
                    border: isPlaying ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    '&:hover': {
                      bgcolor: isPlaying ? '#c2185b' : 'rgba(255,255,255,0.15)',
                    },
                  }}
                >
                  {isPlaying ? <PauseIcon sx={{ fontSize: iconSize }} /> : <PlayIcon sx={{ fontSize: iconSize }} />}
                </IconButton>
                <IconButton
                  onClick={() => navigateToStep(0)}
                  aria-label="Start veiledningen på nytt"
                  sx={{ 
                    color: 'rgba(255,255,255,0.8)', 
                    bgcolor: 'rgba(255,255,255,0.08)',
                    minWidth: buttonMinHeight,
                    minHeight: buttonMinHeight,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.2)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.15)',
                    },
                  }}
                >
                  <ReplayIcon sx={{ fontSize: iconSize }} />
                </IconButton>
              </Box>

              <Button
                onClick={nextStep}
                variant="contained"
                endIcon={currentStep === steps.length - 1 ? <CompleteIcon sx={{ fontSize: iconSize }} /> : <NextIcon sx={{ fontSize: iconSize }} />}
                sx={{
                  bgcolor: '#e91e63',
                  minHeight: buttonMinHeight,
                  minWidth: buttonMinWidth,
                  fontSize: captionFontSize,
                  fontWeight: 600,
                  order: isMobile ? 2 : 2,
                  flex: isMobile ? '1 1 45%' : 'none',
                  borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(233,30,99,0.4)',
                  '&:hover': { 
                    bgcolor: '#c2185b',
                    boxShadow: '0 6px 16px rgba(233,30,99,0.5)',
                  },
                  '&:active': {
                    transform: 'scale(0.98)',
                  },
                }}
              >
                {currentStep === steps.length - 1 ? 'Fullfør' : 'Neste'}
              </Button>
            </Box>

            <Typography
              variant="caption"
              sx={{
                display: isMobile ? 'none' : 'block',
                textAlign: 'center',
                mt: gapSize,
                color: 'rgba(255,255,255,0.7)',
                fontSize: smallTextSize,
              }}
            >
              Tastatursnarveier: ← Forrige | → Neste | Space Pause | Esc Lukk
            </Typography>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
};

export default CastingPlannerTutorial;
