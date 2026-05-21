/**
 * FirstTimeTour — lettvekts overlay-tour som vises ÉN GANG ved første
 * besøk i en workspace. Erstatter ikke ProfessionOnboardingDialog —
 * komplementerer den.
 *
 * Hvorfor: ProfessionOnboardingDialog er 1300+ LOC og dekker
 * profil-utfylling. Den fanger ikke "her er hvor du finner ting"-
 * problemet som Irlin opplevde.
 *
 * Slik fungerer den:
 *   • 3-4 kort vises i karusell med pil-pek på UI-elementer
 *   • Hvert kort: ikon + tittel + 1-2 setninger + neste-knapp
 *   • Bruker kan hoppe over når som helst (lagres som "vist")
 *   • localStorage-key: `role-room-tour-{tourId}-completed`
 *   • Lukkes automatisk hvis user klikker utenfor eller trykker Esc
 *
 * Brukseksempel i DanceWorkspace:
 *   <FirstTimeTour
 *     tourId="dance-workspace-v1"
 *     steps={[
 *       { title: 'Velkommen', body: '...', icon: ... },
 *       { title: 'Cmd+K søk', body: 'Trykk Cmd+K...', ... },
 *     ]}
 *   />
 */

import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stack, IconButton,
  LinearProgress, Fade,
} from '@mui/material';
import { Close as CloseIcon, ArrowForward as NextIcon } from '@mui/icons-material';

export interface TourStep {
  title: string;
  body: string;
  icon?: React.ReactNode;
  /** Valgfri CTA på siste steg (f.eks. "Lag din første klasse") */
  finalCta?: { label: string; onClick: () => void };
}

interface FirstTimeTourProps {
  /** Unik ID for denne touren. Husker via localStorage at bruker har sett den. */
  tourId: string;
  steps: TourStep[];
  /** Tving visning (bypass localStorage-sjekk) — bruk via "Vis tour på nytt"-knapp */
  forceShow?: boolean;
  /** Callback når bruker fullfører eller hopper over */
  onComplete?: () => void;
}

export const FirstTimeTour: React.FC<FirstTimeTourProps> = ({
  tourId,
  steps,
  forceShow = false,
  onComplete,
}) => {
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const storageKey = `role-room-tour-${tourId}-completed`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (forceShow) {
      setOpen(true);
      return;
    }
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) {
        // Liten delay så side-rendring fullfører først
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* noop */
    }
    return undefined;
  }, [storageKey, forceShow]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  if (!open || steps.length === 0) return null;

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const progressPct = ((stepIdx + 1) / steps.length) * 100;

  const markComplete = () => {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      /* noop */
    }
    setOpen(false);
    onComplete?.();
    // GA4
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'first_time_tour_completed', { tour_id: tourId, steps_shown: stepIdx + 1 });
    }
  };

  const handleNext = () => {
    if (isLast) {
      if (step.finalCta) {
        step.finalCta.onClick();
      }
      markComplete();
    } else {
      setStepIdx((i) => i + 1);
    }
  };

  const handleSkip = () => {
    markComplete();
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(0,0,0,0.6)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <Fade in={open} timeout={300}>
        <Card
          sx={{
            maxWidth: 440,
            width: '90vw',
            bgcolor: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(245, 184, 46, 0.3)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            borderRadius: 3,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              height: 3,
              borderRadius: '12px 12px 0 0',
              '& .MuiLinearProgress-bar': { bgcolor: '#F5B82E' },
              bgcolor: 'rgba(255,255,255,0.05)',
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={handleSkip}
              size="small"
              sx={{ position: 'absolute', top: 8, right: 8, color: 'text.disabled' }}
              aria-label="Lukk tour"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <CardContent sx={{ p: 3, pt: 4 }}>
            <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
              {step.icon && (
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'rgba(245, 184, 46, 0.15)',
                    color: '#F5B82E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& > svg': { fontSize: 32 },
                  }}
                >
                  {step.icon}
                </Box>
              )}
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {step.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {step.body}
              </Typography>
            </Stack>
          </CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ px: 3, pb: 2.5, pt: 1 }}
          >
            <Stack direction="row" spacing={0.5}>
              {steps.map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: i === stepIdx ? '#F5B82E' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button onClick={handleSkip} size="small" sx={{ color: 'text.secondary' }}>
                Hopp over
              </Button>
              <Button
                variant="contained"
                size="small"
                endIcon={isLast ? null : <NextIcon />}
                onClick={handleNext}
                sx={{
                  bgcolor: '#F5B82E',
                  color: '#1F2937',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#D49B1A' },
                }}
              >
                {isLast ? (step.finalCta?.label ?? 'Sett i gang') : 'Neste'}
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Fade>
    </Box>
  );
};

export default FirstTimeTour;
