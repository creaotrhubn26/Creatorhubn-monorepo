import { useState, useEffect, useCallback, useRef, createElement, type ComponentType, type FC } from 'react';
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
  Celebration as CelebrationIcon,
  PermMedia as MediaIcon,
  AttachMoney as EconomyIcon,
  Timeline as TimelineWorkflowIcon,
  FactCheck as ReviewsIcon,
  ImportExport as ExportIcon,
} from '@mui/icons-material';
import {
  DashboardCustomIcon as DashboardIcon,
  RolesIcon,
  CandidatesIcon,
  TeamIcon,
  LocationsIcon as LocationIcon,
  CalendarCustomIcon as CalendarIcon,
} from './icons/CastingIcons';
// Compatible icon type for both MUI SvgIcon and custom FC<IconProps> components
type IconComponentType = ComponentType<{ sx?: Record<string, unknown> }>;
import {
  tutorialService,
  getDefaultCastingPlannerTutorialSteps,
  getDefaultContentProducerTutorialSteps,
  type Tutorial,
  type TutorialStep,
} from '../services/tutorialService';

const getDefaultTutorialStepsForCategory = (category: Tutorial['category']): TutorialStep[] => {
  if (category === 'content-producer') {
    return getDefaultContentProducerTutorialSteps();
  }
  return getDefaultCastingPlannerTutorialSteps();
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const panelInfo = [
  { name: 'Oversikt', icon: DashboardIcon, color: '#8b5cf6' },
  { name: 'Role Room Studio', icon: ShotListIcon, color: '#ec4899' },
  { name: 'Roller', icon: RolesIcon, color: '#f48fb1' },
  { name: 'Kandidater', icon: CandidatesIcon, color: '#10b981' },
  { name: 'Auditions', icon: AuditionIcon, color: '#ffb800' },
  { name: 'Utvelgelse', icon: CompleteIcon, color: '#14b8a6' },
  { name: 'Lokasjoner', icon: LocationIcon, color: '#4caf50' },
  { name: 'Produksjonsplan', icon: CalendarIcon, color: '#9c27b0' },
  { name: 'Team', icon: TeamIcon, color: '#00d4ff' },
  { name: 'Utstyr', icon: PropIcon, color: '#9333ea' },
  { name: 'Live Set', icon: ActionIcon, color: '#ef4444' },
  { name: 'Media', icon: MediaIcon, color: '#60a5fa' },
  { name: 'Økonomi', icon: EconomyIcon, color: '#34d399' },
  { name: 'Tidslinje', icon: TimelineWorkflowIcon, color: '#38bdf8' },
  { name: 'Klientsamarbeid', icon: ReviewsIcon, color: '#c084fc' },
  { name: 'Eksport', icon: ExportIcon, color: '#fbbf24' },
];

const stepIndicatorMeta: Record<string, { label: string; subtitle: string; icon: IconComponentType; color?: string }> = {
  'welcome': { label: 'Start', subtitle: 'Introduksjon', icon: TutorialIcon, color: '#e91e63' },
  'overview': { label: 'Oversikt', subtitle: 'Status', icon: DashboardIcon, color: '#8b5cf6' },
  'studio': { label: 'Role Room Studio', subtitle: 'Pre-produksjon', icon: ShotListIcon, color: '#ec4899' },
  'roles': { label: 'Roller', subtitle: 'Casting', icon: RolesIcon, color: '#f48fb1' },
  'candidates': { label: 'Kandidater', subtitle: 'Casting', icon: CandidatesIcon, color: '#10b981' },
  'auditions': { label: 'Auditions', subtitle: 'Casting', icon: AuditionIcon, color: '#ffb800' },
  'selection': { label: 'Utvelgelse', subtitle: 'Casting', icon: CompleteIcon, color: '#14b8a6' },
  'locations': { label: 'Lokasjoner', subtitle: 'Produksjonsplan', icon: LocationIcon, color: '#4caf50' },
  'production-plan': { label: 'Kalender', subtitle: 'Produksjonsplan', icon: CalendarIcon, color: '#9c27b0' },
  'team': { label: 'Team', subtitle: 'Ressurser', icon: TeamIcon, color: '#00d4ff' },
  'equipment': { label: 'Utstyr', subtitle: 'Ressurser', icon: PropIcon, color: '#9333ea' },
  'live-set': { label: 'Live Set', subtitle: 'Produksjon', icon: ActionIcon, color: '#ef4444' },
  'complete': { label: 'Slutt', subtitle: 'Oppsummering', icon: CelebrationIcon, color: '#4caf50' },
  'producer-welcome': { label: 'Start', subtitle: 'Introduksjon', icon: TutorialIcon, color: '#22d3ee' },
  'producer-studio': { label: 'Storyboard', subtitle: 'Kreativt arbeid', icon: ShotListIcon, color: '#ec4899' },
  'producer-contributors': { label: 'Statister/medvirkende', subtitle: 'Bidragsytere', icon: CandidatesIcon, color: '#10b981' },
  'producer-locations': { label: 'Lokasjoner', subtitle: 'Produksjon', icon: LocationIcon, color: '#4caf50' },
  'producer-equipment': { label: 'Utstyr/rekvisitter', subtitle: 'Produksjon', icon: PropIcon, color: '#9333ea' },
  'producer-media': { label: 'Media', subtitle: 'Leveranser', icon: MediaIcon, color: '#60a5fa' },
  'producer-timeline': { label: 'Tidslinje', subtitle: 'Produksjon', icon: TimelineWorkflowIcon, color: '#38bdf8' },
  'producer-reviews': { label: 'Klientsamarbeid', subtitle: 'Godkjenning', icon: ReviewsIcon, color: '#c084fc' },
  'producer-export': { label: 'Eksport', subtitle: 'Levering', icon: ExportIcon, color: '#fbbf24' },
  'producer-complete': { label: 'Slutt', subtitle: 'Oppsummering', icon: CelebrationIcon, color: '#4caf50' },
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
    'min(92vw, 760px)',
    980,
    1180,
    1380,
    1720
  );

  const modalPadding = getResponsiveValue(1.5, 2, 2.5, 3, 4, 5);
  const titleFontSize = getResponsiveValue('1rem', '1.125rem', '1.25rem', '1.375rem', '1.5rem', '1.75rem');
  const bodyFontSize = getResponsiveValue('0.813rem', '0.875rem', '0.938rem', '1rem', '1.125rem', '1.25rem');
  const captionFontSize = getResponsiveValue('0.688rem', '0.75rem', '0.813rem', '0.875rem', '0.938rem', '1rem');
  const smallTextSize = getResponsiveValue('0.625rem', '0.688rem', '0.75rem', '0.813rem', '0.875rem', '0.938rem');
  const avatarSize = getResponsiveValue(40, 44, 48, 52, 56, 64);
  const iconSize = getResponsiveValue(20, 22, 24, 26, 28, 32);
  const buttonMinHeight = getResponsiveValue(TOUCH_TARGET_MIN, TOUCH_TARGET_MIN, 48, 52, 56, 64);
  const stepIconSize = getResponsiveValue(18, 20, 22, 24, 28, 32);
  const stepTextSize = getResponsiveValue('0.6rem', '0.65rem', '0.7rem', '0.75rem', '0.813rem', '0.875rem');
  const gapSize = getResponsiveValue(1, 1.25, 1.5, 1.75, 2, 2.5);
  const borderRadius = getResponsiveValue(2, 2.5, 3, 3.5, 4, 5);

  useEffect(() => {
    if (customTutorial) {
      setActiveTutorial(customTutorial);
    } else {
      const tutorial = tutorialService.getActiveTutorialByCategory(category);
      setActiveTutorial(tutorial || {
        id: 'default',
        name: 'Default',
        description: '',
        category,
        steps: getDefaultTutorialStepsForCategory(category),
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });
    }
  }, [customTutorial, category, open]);

  const steps = activeTutorial?.steps || getDefaultTutorialStepsForCategory(category);
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
  const modeMeta = category === 'casting-planner'
    ? {
        label: 'Produksjonsteam-modus',
        description: 'Bygg produksjonen fra casting og crew til plan, ressurser og live set.',
        accent: '#e91e63',
        secondaryAccent: '#8b5cf6',
        railTitle: 'Fanene i produksjonsflyten',
        railDescription: 'Dette er arbeidsflatene som faktisk ligger i toppnavigasjonen for produksjonsteam.',
      }
    : category === 'content-producer'
      ? {
          label: 'Innholdsprodusent-modus',
          description: 'Driv frem storyboard, media, klientsamarbeid og leveranser i én flyt.',
          accent: '#22d3ee',
          secondaryAccent: '#f59e0b',
          railTitle: 'Fanene i innholdsprodusent-flyten',
          railDescription: 'Dette er arbeidsflatene som faktisk ligger i toppnavigasjonen for innholdsprodusent.',
        }
      : {
          label: 'The Role Room',
          description: 'Denne veiledningen er tilpasset den aktive arbeidsflaten du står i.',
          accent: '#e91e63',
          secondaryAccent: '#8b5cf6',
          railTitle: 'Fanene i arbeidsflaten',
          railDescription: 'Bruk disse for å hoppe direkte til riktig område i The Role Room.',
        };

  const accentColor = modeMeta.accent;
  const surfaceColor = 'rgba(10, 13, 28, 0.96)';
  const surfaceSecondaryColor = 'rgba(255,255,255,0.045)';
  const borderSoft = 'rgba(255,255,255,0.08)';
  const currentMeta = stepIndicatorMeta[step.id];
  const currentPanel = step.panel >= 0 ? panelInfo[step.panel] : null;
  const currentPanelColor = currentMeta?.color || currentPanel?.color || accentColor;
  const currentPanelLabel = currentMeta?.label || currentPanel?.name || 'Introduksjon';
  const progressLabel = `${currentStep + 1} / ${steps.length}`;
  const overviewColumns = isMobile || isTablet
    ? '1fr'
    : is2K
      ? 'minmax(0, 1.4fr) minmax(320px, 0.96fr)'
      : is4K
        ? 'minmax(0, 1.34fr) minmax(420px, 0.92fr)'
        : 'minmax(0, 1.45fr) minmax(320px, 0.95fr)';
  const stepRailColumns = isMobile
    ? 'repeat(2, minmax(0, 1fr))'
    : isTablet
      ? 'repeat(3, minmax(0, 1fr))'
      : '1fr';
  const contentSectionGap = getResponsiveValue(2, 2.5, 3, 3.5, 4, 4.5);
  const dialogViewportMargin = getResponsiveValue(0, 12, 20, 24, 32, 40);
  const logoLockupWidth = getResponsiveValue(144, 172, 208, 244, 288, 332);
  const logoLockupHeight = getResponsiveValue(68, 78, 88, 98, 112, 124);
  const shouldPrioritizeRail = isMobile || isTablet;

  return (
    <Box
      data-testid="role-room-tutorial-overlay"
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
              border: `3px solid ${accentColor}`,
              borderRadius: 2,
              boxShadow: `0 0 20px ${hexToRgba(accentColor, 0.6)}, 0 0 40px ${hexToRgba(accentColor, 0.4)}, inset 0 0 20px ${hexToRgba(accentColor, 0.2)}`,
              pointerEvents: 'none',
              zIndex: 10002,
              animation: 'pulse-border 2s infinite ease-in-out',
              '@keyframes pulse-border': {
                '0%': { boxShadow: `0 0 20px ${hexToRgba(accentColor, 0.6)}, 0 0 40px ${hexToRgba(accentColor, 0.4)}` },
                '50%': { boxShadow: `0 0 35px ${hexToRgba(accentColor, 0.8)}, 0 0 70px ${hexToRgba(accentColor, 0.6)}` },
                '100%': { boxShadow: `0 0 20px ${hexToRgba(accentColor, 0.6)}, 0 0 40px ${hexToRgba(accentColor, 0.4)}` },
              },
            }}
          />
        </>
      )}

      <Fade in={open}>
        <Paper
          data-testid="role-room-tutorial-dialog"
          elevation={24}
          sx={{
            width: isMobile ? '100%' : `min(calc(100vw - ${dialogViewportMargin * 2}px), ${typeof modalMaxWidth === 'number' ? `${modalMaxWidth}px` : modalMaxWidth})`,
            maxWidth: modalMaxWidth,
            maxHeight: isMobile ? '100dvh' : '88dvh',
            overflow: 'hidden',
            bgcolor: surfaceColor,
            backgroundImage: `
              radial-gradient(circle at top left, ${accentColor}22, transparent 26%),
              radial-gradient(circle at top right, ${modeMeta.secondaryAccent}22, transparent 22%),
              linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))
            `,
            border: `1px solid ${borderSoft}`,
            borderRadius: isMobile ? 0 : borderRadius,
            position: 'relative',
            zIndex: 10001,
            m: isMobile ? 0 : gapSize,
            mt: isMobile ? 'auto' : gapSize,
            mb: isMobile ? 0 : gapSize,
            boxShadow: '0 36px 120px rgba(0,0,0,0.52)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: getResponsiveValue(4, 5, 5, 6, 7, 8),
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                bgcolor: accentColor,
                transition: 'transform 0.5s ease',
              },
            }}
          />

          <Box
            sx={{
              p: modalPadding,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'contain',
              pb: `max(${modalPadding * 8}px, env(safe-area-inset-bottom))`,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: overviewColumns,
                gridTemplateAreas: shouldPrioritizeRail
                  ? `"rail" "main"`
                  : `"main rail"`,
                gap: contentSectionGap,
                alignItems: 'start',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: contentSectionGap, gridArea: 'main' }}>
                <Box
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: borderRadius,
                    border: `1px solid ${borderSoft}`,
                    background: `
                      radial-gradient(circle at top right, ${modeMeta.secondaryAccent}18, transparent 28%),
                      radial-gradient(circle at top left, ${accentColor}16, transparent 24%),
                      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))
                    `,
                    px: getResponsiveValue(2, 2.5, 3, 3.5, 4, 4.5),
                    py: getResponsiveValue(2, 2.5, 3, 3.25, 3.75, 4.25),
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 3),
                        minWidth: 0,
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'flex-start' : 'center',
                      }}
                    >
                      <Box
                        sx={{
                          width: logoLockupWidth,
                          minWidth: logoLockupWidth,
                          height: logoLockupHeight,
                          borderRadius: 0,
                          overflow: 'visible',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: 0,
                          py: 0,
                          background: 'transparent',
                          boxShadow: 'none',
                          border: 'none',
                        }}
                      >
                        <img
                          src="/role-room-assets/TheRoleRoom_Logo_Tagline.webp"
                          alt="The Role Room"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            objectPosition: 'center',
                            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.18))',
                          }}
                        />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="overline"
                          sx={{
                            color: accentColor,
                            fontSize: captionFontSize,
                            letterSpacing: '0.18em',
                            fontWeight: 700,
                          }}
                        >
                          Veiledning • Steg {currentStep + 1} av {steps.length}
                        </Typography>
                        <Typography
                          id="tutorial-title"
                          variant="h4"
                          sx={{
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: getResponsiveValue('1.5rem', '1.75rem', '2rem', '2.2rem', '2.45rem', '2.7rem'),
                            lineHeight: 1.08,
                            mt: 0.75,
                            maxWidth: isMobile ? '100%' : '16ch',
                          }}
                        >
                          {step.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: captionFontSize,
                            mt: 1.25,
                            maxWidth: '52ch',
                          }}
                        >
                          {modeMeta.description} Du kan pause, hoppe mellom steg og gå tilbake når som helst.
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={onClose}
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        minWidth: buttonMinHeight,
                        minHeight: buttonMinHeight,
                        border: `1px solid ${borderSoft}`,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        flexShrink: 0,
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                      aria-label="Lukk veiledning"
                    >
                      <CloseIcon sx={{ fontSize: getResponsiveValue(20, 22, 24, 26, 28, 30) }} />
                    </IconButton>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      mt: getResponsiveValue(2, 2.5, 2.75, 3, 3.25, 3.5),
                    }}
                  >
                    <Chip
                      label={modeMeta.label}
                      sx={{
                        height: getResponsiveValue(30, 32, 34, 36, 38, 40),
                        bgcolor: `${accentColor}18`,
                        color: '#fff',
                        border: `1px solid ${accentColor}3c`,
                        fontSize: captionFontSize,
                        fontWeight: 700,
                      }}
                    />
                    <Chip
                      label={`Fokus: ${currentPanelLabel}`}
                      icon={createElement(currentPanel?.icon || currentMeta?.icon || TutorialIcon)}
                      sx={{
                        height: getResponsiveValue(30, 32, 34, 36, 38, 40),
                        bgcolor: `${currentPanelColor}22`,
                        color: currentPanelColor,
                        border: `1px solid ${currentPanelColor}44`,
                        fontSize: captionFontSize,
                        '& .MuiChip-icon': { color: currentPanelColor },
                      }}
                    />
                    <Chip
                      label={`Fremdrift ${progressLabel}`}
                      sx={{
                        height: getResponsiveValue(30, 32, 34, 36, 38, 40),
                        bgcolor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.82)',
                        border: `1px solid ${borderSoft}`,
                        fontSize: captionFontSize,
                      }}
                    />
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(220px, 280px)',
                    gap: contentSectionGap,
                    alignItems: 'start',
                  }}
                >
                  <Box>
                    <Typography
                      variant="body1"
                      sx={{
                        color: 'rgba(255,255,255,0.92)',
                        fontSize: bodyFontSize,
                        lineHeight: 1.75,
                      }}
                    >
                      {step.description}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      borderTop: isMobile ? `1px solid ${borderSoft}` : 'none',
                      pl: isMobile ? 0 : 1,
                      pt: isMobile ? 2 : 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.56)',
                        fontSize: captionFontSize,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Nå fokuserer vi på
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        color: '#fff',
                        fontWeight: 700,
                        mt: 0.75,
                        fontSize: getResponsiveValue('1rem', '1.05rem', '1.12rem', '1.18rem', '1.25rem', '1.35rem'),
                      }}
                    >
                      {currentPanelLabel}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'rgba(255,255,255,0.65)',
                        mt: 1,
                        fontSize: captionFontSize,
                        lineHeight: 1.6,
                      }}
                    >
                      {modeMeta.label === 'Produksjonsteam-modus'
                        ? 'Denne løypen er laget for produksjonsteam. Bruk høyrelisten for å hoppe mellom casting, planlegging og live gjennomføring.'
                        : modeMeta.label === 'Innholdsprodusent-modus'
                          ? 'Denne løypen er laget for innholdsprodusenter. Bruk høyrelisten for å hoppe mellom kreativt arbeid og leveranse.'
                          : 'Bruk høyrelisten for å hoppe direkte til et annet område uten å miste fremdriften.'}
                    </Typography>
                  </Box>
                </Box>

                {step.actionDescription && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
                      gap: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 3),
                      alignItems: 'center',
                      p: getResponsiveValue(1.75, 2, 2.25, 2.5, 2.75, 3),
                      borderRadius: borderRadius,
                      bgcolor: `${accentColor}14`,
                      border: `1px solid ${accentColor}35`,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: getResponsiveValue(42, 46, 50, 54, 58, 62),
                        height: getResponsiveValue(42, 46, 50, 54, 58, 62),
                        bgcolor: `${accentColor}22`,
                        border: `1px solid ${accentColor}44`,
                      }}
                    >
                      <ActionIcon sx={{ color: accentColor, fontSize: getResponsiveValue(20, 22, 24, 26, 28, 30) }} />
                    </Avatar>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: accentColor,
                          fontWeight: 700,
                          fontSize: captionFontSize,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Neste handling
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#fff',
                          fontSize: bodyFontSize,
                          lineHeight: 1.6,
                          mt: 0.5,
                        }}
                      >
                        {step.actionDescription}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {step.tips && step.tips.length > 0 && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '160px 1fr',
                      gap: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 3),
                      alignItems: 'start',
                      borderTop: `1px solid ${borderSoft}`,
                      pt: getResponsiveValue(2, 2.25, 2.5, 2.75, 3, 3.25),
                    }}
                  >
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{
                          color: '#7ef0a7',
                          fontWeight: 700,
                          fontSize: getResponsiveValue('1rem', '1.05rem', '1.1rem', '1.15rem', '1.2rem', '1.3rem'),
                        }}
                      >
                        Tips
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255,255,255,0.56)',
                          fontSize: captionFontSize,
                          mt: 0.75,
                          lineHeight: 1.5,
                        }}
                      >
                        Små grep som gjør arbeidsflaten raskere å bruke i praksis.
                      </Typography>
                    </Box>
                    <Box
                      component="ul"
                      sx={{
                        m: 0,
                        p: 0,
                        listStyle: 'none',
                        display: 'grid',
                        gap: 1,
                      }}
                    >
                      {step.tips.map((tip, index) => (
                        <Box
                          key={index}
                          component="li"
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            gap: 1.25,
                            alignItems: 'start',
                            color: 'rgba(255,255,255,0.86)',
                            fontSize: captionFontSize,
                            lineHeight: 1.55,
                          }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: '#7ef0a7',
                              mt: '0.5em',
                              flexShrink: 0,
                            }}
                          />
                          <Typography component="span" sx={{ fontSize: captionFontSize, color: 'inherit' }}>
                            {tip}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                <Box
                  sx={{
                    borderTop: `1px solid ${borderSoft}`,
                    pt: getResponsiveValue(2, 2.25, 2.5, 2.75, 3, 3.25),
                    display: 'grid',
                    gap: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 3),
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'auto minmax(0, 1fr)',
                      gap: gapSize,
                      alignItems: 'center',
                      p: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 2.75),
                      borderRadius: borderRadius,
                      bgcolor: surfaceSecondaryColor,
                      border: `1px solid ${borderSoft}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SpeedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: iconSize }} />
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: smallTextSize,
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                        }}
                      >
                        Tempo i veiledningen
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
                        color: accentColor,
                        height: getResponsiveValue(6, 7, 8, 9, 10, 12),
                        '& .MuiSlider-markLabel': {
                          color: 'rgba(255,255,255,0.75)',
                          fontSize: smallTextSize,
                        },
                        '& .MuiSlider-thumb': {
                          width: getResponsiveValue(18, 20, 22, 24, 28, 32),
                          height: getResponsiveValue(18, 20, 22, 24, 28, 32),
                          boxShadow: `0 0 0 6px ${hexToRgba(accentColor, 0.12)}`,
                          '&:hover, &:focus': {
                            boxShadow: `0 0 0 10px ${hexToRgba(accentColor, 0.18)}`,
                          },
                        },
                        '& .MuiSlider-rail': {
                          opacity: 0.28,
                        },
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : 'minmax(0, 1fr) auto minmax(0, 1fr)',
                      gap: gapSize,
                      alignItems: 'center',
                    }}
                  >
                    <Button
                      data-testid="role-room-tutorial-prev"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      startIcon={<PrevIcon sx={{ fontSize: iconSize }} />}
                      sx={{
                        color: 'rgba(255,255,255,0.82)',
                        minHeight: buttonMinHeight,
                        width: '100%',
                        fontSize: captionFontSize,
                        fontWeight: 600,
                        borderRadius: getResponsiveValue(2.5, 3, 3.25, 3.5, 3.75, 4),
                        border: `1px solid ${borderSoft}`,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                          borderColor: 'rgba(255,255,255,0.18)',
                        },
                        '&:disabled': {
                          color: 'rgba(255,255,255,0.42)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        },
                      }}
                    >
                      Forrige
                    </Button>

                    <Box
                      sx={{
                        display: 'flex',
                        gap: gapSize,
                        justifyContent: 'center',
                        gridColumn: isMobile ? '1 / -1' : 'auto',
                        order: isMobile ? 3 : 2,
                      }}
                    >
                      <IconButton
                        data-testid="role-room-tutorial-play-toggle"
                        onClick={() => setIsPlaying(!isPlaying)}
                        aria-label={isPlaying ? 'Pause veiledning' : 'Fortsett veiledning'}
                        sx={{
                          color: isPlaying ? '#fff' : 'rgba(255,255,255,0.82)',
                          bgcolor: isPlaying ? accentColor : 'rgba(255,255,255,0.06)',
                          minWidth: buttonMinHeight,
                          minHeight: buttonMinHeight,
                          borderRadius: getResponsiveValue(2.5, 3, 3.25, 3.5, 3.75, 4),
                          border: isPlaying ? 'none' : `1px solid ${borderSoft}`,
                          boxShadow: isPlaying ? `0 14px 30px ${hexToRgba(accentColor, 0.35)}` : 'none',
                          '&:hover': {
                            bgcolor: isPlaying ? hexToRgba(accentColor, 0.9) : 'rgba(255,255,255,0.12)',
                          },
                        }}
                      >
                        {isPlaying ? <PauseIcon sx={{ fontSize: iconSize }} /> : <PlayIcon sx={{ fontSize: iconSize }} />}
                      </IconButton>
                      <IconButton
                        data-testid="role-room-tutorial-restart"
                        onClick={() => navigateToStep(0)}
                        aria-label="Start veiledningen på nytt"
                        sx={{
                          color: 'rgba(255,255,255,0.82)',
                          bgcolor: 'rgba(255,255,255,0.06)',
                          minWidth: buttonMinHeight,
                          minHeight: buttonMinHeight,
                          borderRadius: getResponsiveValue(2.5, 3, 3.25, 3.5, 3.75, 4),
                          border: `1px solid ${borderSoft}`,
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.12)',
                          },
                        }}
                      >
                        <ReplayIcon sx={{ fontSize: iconSize }} />
                      </IconButton>
                    </Box>

                    <Button
                      data-testid="role-room-tutorial-next"
                      onClick={nextStep}
                      variant="contained"
                      endIcon={currentStep === steps.length - 1 ? <CompleteIcon sx={{ fontSize: iconSize }} /> : <NextIcon sx={{ fontSize: iconSize }} />}
                      sx={{
                        bgcolor: accentColor,
                        minHeight: buttonMinHeight,
                        width: '100%',
                        fontSize: captionFontSize,
                        fontWeight: 700,
                        borderRadius: getResponsiveValue(2.5, 3, 3.25, 3.5, 3.75, 4),
                        boxShadow: `0 18px 36px ${hexToRgba(accentColor, 0.28)}`,
                        '&:hover': {
                          bgcolor: hexToRgba(accentColor, 0.92),
                          boxShadow: `0 22px 42px ${hexToRgba(accentColor, 0.34)}`,
                        },
                        '&:active': {
                          transform: 'scale(0.985)',
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
                      color: 'rgba(255,255,255,0.62)',
                      fontSize: smallTextSize,
                    }}
                  >
                    Tastatursnarveier: ← Forrige, → Neste, mellomrom for pause og Esc for å lukke.
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{ gridArea: 'rail' }}
              >
                <Box
                sx={{
                  display: 'grid',
                  gap: getResponsiveValue(1.25, 1.5, 1.75, 2, 2.25, 2.5),
                  border: `1px solid ${borderSoft}`,
                  borderRadius: borderRadius,
                  bgcolor: surfaceSecondaryColor,
                  p: getResponsiveValue(1.5, 1.75, 2, 2.25, 2.5, 2.75),
                  maxHeight: isMobile ? 'none' : '100%',
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      color: accentColor,
                      fontSize: captionFontSize,
                      letterSpacing: '0.16em',
                      fontWeight: 700,
                    }}
                  >
                    Navigasjon i appen
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: '#fff',
                      fontWeight: 700,
                      mt: 0.75,
                      fontSize: getResponsiveValue('1rem', '1.05rem', '1.12rem', '1.18rem', '1.24rem', '1.35rem'),
                    }}
                  >
                    {modeMeta.railTitle}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255,255,255,0.62)',
                      fontSize: captionFontSize,
                      lineHeight: 1.55,
                      mt: 0.85,
                    }}
                  >
                    {modeMeta.railDescription}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: stepRailColumns,
                    gap: getResponsiveValue(1, 1.1, 1.15, 1.2, 1.3, 1.4),
                    maxHeight: shouldPrioritizeRail ? 'none' : '56dvh',
                    overflowY: 'auto',
                    pr: shouldPrioritizeRail ? 0 : 0.5,
                    WebkitOverflowScrolling: 'touch',
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
                    const stepSubtitle = meta?.subtitle || `Steg ${index + 1}`;
                    const stepColor = meta?.color || panel?.color || accentColor;
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;

                    return (
                      <Box
                        key={s.id}
                        component="button"
                        type="button"
                        data-testid={`role-room-tutorial-step-${s.id}`}
                        onClick={() => navigateToStep(index)}
                        aria-label={`Gå til steg ${index + 1}: ${s.title}`}
                        aria-current={isActive ? 'step' : undefined}
                        sx={{
                          all: 'unset',
                          display: 'grid',
                          gridTemplateColumns: shouldPrioritizeRail ? 'auto minmax(0, 1fr)' : 'auto minmax(0, 1fr) auto',
                          gap: 1.25,
                          alignItems: 'center',
                          p: getResponsiveValue(1.1, 1.15, 1.2, 1.3, 1.4, 1.5),
                          borderRadius: getResponsiveValue(2, 2.25, 2.5, 2.75, 3, 3.25),
                          cursor: 'pointer',
                          background: isActive
                            ? `${stepColor}22`
                            : isCompleted
                              ? 'rgba(76,175,80,0.1)'
                              : 'rgba(255,255,255,0.02)',
                          border: isActive
                            ? `1px solid ${stepColor}66`
                            : isCompleted
                              ? '1px solid rgba(76,175,80,0.26)'
                              : `1px solid ${borderSoft}`,
                          transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease',
                          '&:hover, &:focus-visible': {
                            transform: 'translateY(-1px)',
                            background: isActive ? `${stepColor}28` : 'rgba(255,255,255,0.07)',
                            outline: 'none',
                          },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: getResponsiveValue(34, 36, 38, 40, 44, 48),
                            height: getResponsiveValue(34, 36, 38, 40, 44, 48),
                            bgcolor: isActive
                              ? `${stepColor}2a`
                              : isCompleted
                                ? 'rgba(76,175,80,0.14)'
                                : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isActive ? `${stepColor}55` : isCompleted ? 'rgba(76,175,80,0.3)' : borderSoft}`,
                          }}
                        >
                          <IconComponent
                            sx={{
                              fontSize: stepIconSize,
                              color: isActive ? stepColor : isCompleted ? '#7ef0a7' : 'rgba(255,255,255,0.6)',
                            }}
                          />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color: isActive ? '#fff' : 'rgba(255,255,255,0.86)',
                              fontWeight: isActive ? 700 : 600,
                              fontSize: shouldPrioritizeRail ? stepTextSize : captionFontSize,
                              lineHeight: 1.2,
                              whiteSpace: 'normal',
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: shouldPrioritizeRail ? 3 : 2,
                              overflow: 'hidden',
                            }}
                          >
                            {stepLabel}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isActive ? `${stepColor}` : 'rgba(255,255,255,0.5)',
                              fontSize: stepTextSize,
                              display: 'block',
                              mt: 0.35,
                            }}
                          >
                            {stepSubtitle}
                          </Typography>
                        </Box>
                        {!shouldPrioritizeRail && (
                          <Box
                            sx={{
                              minWidth: 28,
                              textAlign: 'right',
                              color: isActive ? stepColor : isCompleted ? '#7ef0a7' : 'rgba(255,255,255,0.32)',
                              fontSize: stepTextSize,
                              fontWeight: 700,
                            }}
                          >
                            {isCompleted ? '✓' : `${index + 1}`}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
};

export default CastingPlannerTutorial;
