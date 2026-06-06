/**
 * NextRoleOnboardingTour — 4-stegs guidet tour for nye brukere.
 *
 * Vises automatisk første gang en innlogget bruker er i ResumeBuilder
 * (etter trial er aktivert). Highlighter de viktigste handlingene som
 * driver "aktivering" — den første verdiopplevelsen.
 *
 * Bruker eksisterende MUI <Popover> + en transparent overlay som
 * fokuserer på det aktive målet. Brukerens "ferdig"-flagg lagres i
 * localStorage så turen ikke vises igjen.
 *
 * Mål-elementer identifiseres via `data-onboarding-target`-attributter
 * som ResumeBuilder må sette på de fire knappene:
 *
 *   "import-cv"       → "Importer CV"-kortet på CV-listen
 *   "ai-analyze"      → "AI-analyse"-knappen i editor-action-bar
 *   "template-picker" → "Bytt mal"-knappen
 *   "export"          → "Eksporter"-knappen
 *
 * Tour-en finner elementene ved render, beregner posisjon, viser
 * popover. Hvis et mål mangler hopper vi videre til neste steg.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Button, IconButton, Stack, Paper, Backdrop,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

const COMPLETED_KEY = 'nextrole:onboarding-completed-v1';

interface Step {
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    target: 'import-cv',
    title: 'Start med å importere CV-en din',
    description:
      'Har du allerede en CV i PDF eller DOCX? Last den opp her — Claude leser hele dokumentet og strukturerer det inn i NextRole på under 30 sekunder.',
    position: 'bottom',
  },
  {
    target: 'ai-analyze',
    title: 'Sjekk ATS-scoren mot stillingen',
    description:
      'Lim inn jobbeskrivelsen — du får en numerisk score, manglende nøkkelord og konkrete forbedringer. Sikt på 80+.',
    position: 'left',
  },
  {
    target: 'template-picker',
    title: 'Velg den rette malen',
    description:
      'Bytt mellom 15 profesjonelle maler med live preview. Alle er ATS-optimalisert. Velg en som matcher din bransje.',
    position: 'left',
  },
  {
    target: 'export',
    title: 'Last ned eller del CV-en',
    description:
      'PDF, DOCX, eller offentlig delelink. Klikket på "Del offentlig" oppretter en nextrole.no/cv-lenke du kan sende til rekrutterer.',
    position: 'left',
  },
];

function isCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(COMPLETED_KEY) === 'true';
}

interface BoundingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(name: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`[data-onboarding-target="${name}"]`) as HTMLElement | null;
}

interface Props {
  /** Hvis true, ignorer "completed"-flagget og vis tour. For dev/preview. */
  forceShow?: boolean;
  /** Callback når tour avsluttes (fullført eller skipped). */
  onComplete?: () => void;
}

export const NextRoleOnboardingTour: React.FC<Props> = ({
  forceShow = false,
  onComplete,
}) => {
  const [active, setActive] = useState<boolean>(() => forceShow || !isCompleted());
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<BoundingRect | null>(null);

  const close = useCallback((completed: boolean) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMPLETED_KEY, 'true');
    }
    setActive(false);
    onComplete?.();
    if (completed && typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'nextrole_onboarding_completed', {});
    }
  }, [onComplete]);

  // Rebeskjeftig position når step endrer seg
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    let attempts = 0;
    const findAndPosition = () => {
      const el = findTarget(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top + window.scrollY,
          left: r.left + window.scrollX,
          width: r.width,
          height: r.height,
        });
        // Scroll inn i visning
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempts < 8) {
        attempts += 1;
        setTimeout(findAndPosition, 300);
      } else {
        // Skip dette steget hvis vi ikke finner målet etter 2,4s
        if (stepIdx < STEPS.length - 1) {
          setStepIdx((i) => i + 1);
        } else {
          close(true);
        }
      }
    };
    findAndPosition();
    const onResize = () => findAndPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [active, stepIdx, close]);

  if (!active || !rect) return null;
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  // Beregn popover-posisjon
  const popoverPadding = 16;
  const popoverWidth = 340;
  const popoverHeight = 200;
  let popoverTop = rect.top + rect.height + popoverPadding;
  let popoverLeft = rect.left;
  if (step.position === 'left') {
    popoverTop = rect.top;
    popoverLeft = rect.left - popoverWidth - popoverPadding;
    if (popoverLeft < 16) popoverLeft = rect.left + rect.width + popoverPadding;
  }
  if (step.position === 'right') {
    popoverTop = rect.top;
    popoverLeft = rect.left + rect.width + popoverPadding;
  }
  if (step.position === 'top') {
    popoverTop = rect.top - popoverHeight - popoverPadding;
    popoverLeft = rect.left;
  }
  // Hold popover innenfor viewport
  if (typeof window !== 'undefined') {
    popoverTop = Math.max(16, Math.min(popoverTop, window.scrollY + window.innerHeight - popoverHeight - 16));
    popoverLeft = Math.max(16, Math.min(popoverLeft, window.innerWidth - popoverWidth - 16));
  }

  return (
    <>
      {/* Backdrop — mørkner alt rundt målet */}
      <Backdrop
        open
        sx={{
          zIndex: 8000,
          bgcolor: 'rgba(15, 23, 42, 0.65)',
        }}
        onClick={() => close(false)}
      />
      {/* Spotlight rundt målet */}
      <Box
        sx={{
          position: 'absolute',
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          borderRadius: 2,
          boxShadow: '0 0 0 4px #F5B82E, 0 0 0 9999px rgba(15, 23, 42, 0.65)',
          pointerEvents: 'none',
          zIndex: 8001,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'spotlightPulse 2s ease-in-out infinite',
          '@keyframes spotlightPulse': {
            '0%, 100%': { boxShadow: '0 0 0 4px #F5B82E, 0 0 0 9999px rgba(15, 23, 42, 0.65)' },
            '50%': { boxShadow: '0 0 0 6px #F5B82E, 0 0 0 9999px rgba(15, 23, 42, 0.7)' },
          },
        }}
      />
      {/* Popover */}
      <Paper
        elevation={12}
        sx={{
          position: 'absolute',
          top: popoverTop,
          left: popoverLeft,
          width: popoverWidth,
          zIndex: 8002,
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '2px solid #F5B82E',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#F5B82E', letterSpacing: 1.5 }}>
            {stepIdx + 1} AV {STEPS.length}
          </Typography>
          <IconButton size="small" onClick={() => close(false)} sx={{ ml: 1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: '#1F2937' }}>
          {step.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
          {step.description}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Box>
            {stepIdx > 0 && (
              <Button
                size="small"
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              >
                Tilbake
              </Button>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={() => close(false)}>
              Hopp over
            </Button>
            {isLast ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={() => close(true)}
                sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
              >
                Ferdig
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setStepIdx((i) => i + 1)}
                sx={{ bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' }, color: '#1F2937', fontWeight: 700 }}
              >
                Neste
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </>
  );
};

export default NextRoleOnboardingTour;
