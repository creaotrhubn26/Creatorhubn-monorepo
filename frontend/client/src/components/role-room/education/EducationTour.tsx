/**
 * EducationTour.tsx — persona-bevisst onboarding-tur for utdannings-workspacet.
 *
 * Lag 1 i opplæringsmodellen: det ALLER første en faglærer ser når de logger
 * inn. Fire kontekstuelle steg (kull → produksjon → oppgave → vurdering) som
 * bytter fanen bak dialogen så brukeren ser den EKTE flaten touren beskriver.
 *
 * Selvstendig (ingen backend, ingen AI-recommendation-motor) — isolert til
 * education-modus, som resten av workspacet. Vises én gang per nettleser via
 * localStorage; «Rundtur»-knappen i headeren kan starte den på nytt (force).
 */

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, Box, Typography, Button, Stack, Step, Stepper,
  StepLabel, MobileStepper,
} from '@mui/material';
import {
  School as SchoolIcon,
  Groups as CohortIcon,
  MovieCreation as ProductionIcon,
  Assignment as AssignmentIcon,
  Grading as AssessmentIcon,
  KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

const ACCENT = '#8B5CF6';
const SEEN_KEY = 'role_room_education_tour_seen_v1';

/** Har faglæreren allerede sett touren i denne nettleseren? */
export function hasSeenEducationTour(): boolean {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markEducationTourSeen(): void {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, '1');
  } catch {
    /* privat-modus / no-op */
  }
}

/** Fane-id-er touren peker på (må matche EducationWorkspace sine EducationTabId). */
type TourTabId = 'overview' | 'cohorts' | 'productions' | 'assignments' | 'assessment';

interface TourStep {
  tab: TourTabId;
  icon: ReactNode;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    tab: 'overview',
    icon: <SchoolIcon />,
    title: 'Velkommen til utdannings-workspacet',
    body: 'Her styrer du undervisningen: kull og studenter, ekte studentproduksjoner, oppgaver med læringsmål og vurdering — alt i én flate. Denne rundturen tar under ett minutt.',
  },
  {
    tab: 'cohorts',
    icon: <CohortIcon />,
    title: '1. Opprett et kull',
    body: 'Start i «Kull & studenter». Lag et kull (f.eks. «Film 1. år 2026») og legg inn studentene. Kullet er gruppen du knytter produksjoner, oppgaver og vurdering til.',
  },
  {
    tab: 'productions',
    icon: <ProductionIcon />,
    title: '2. Start en studentproduksjon',
    body: 'Hver studentproduksjon er et fullt Role Room-prosjekt — story-arc, roller, call-sheet og leveranser. Studentene lærer bransjeverktøyet ved å bruke det på ekte, ikke en forenklet skoleversjon.',
  },
  {
    tab: 'assignments',
    icon: <AssignmentIcon />,
    title: '3. Lag en oppgave med læringsmål',
    body: 'I «Oppgaver» gir du en brief med læringsmål og frist, knyttet til kullet. Studentene løser den inne i produksjonen sin — undervisning og produksjonsverktøy henger sammen.',
  },
  {
    tab: 'assessment',
    icon: <AssessmentIcon />,
    title: '4. Vurder leveransene',
    body: 'Når studentene leverer, gir du karakter og tilbakemelding i «Vurdering» — samme gjennomarbeidede review-flyt som proffene bruker. Da er sirkelen fra brief til ferdig produksjon lukket.',
  },
];

interface EducationTourProps {
  open: boolean;
  onClose: () => void;
  /** Bytter aktiv fane i workspacet så brukeren ser flaten steget beskriver. */
  onNavigate: (tab: TourTabId) => void;
}

export function EducationTour({ open, onClose, onNavigate }: EducationTourProps) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // Reset til første steg hver gang touren åpnes.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Bytt fanen bak dialogen i takt med steget.
  useEffect(() => {
    if (open) onNavigate(STEPS[index].tab);
  }, [open, index, onNavigate]);

  const finish = () => {
    markEducationTourSeen();
    onClose();
  };

  const next = () => {
    if (isLast) finish();
    else setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <Dialog
      open={open}
      onClose={finish}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#141018',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 3,
          color: '#fff',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stepper activeStep={index} alternativeLabel sx={{
          mb: 3,
          display: { xs: 'none', sm: 'flex' },
          '& .MuiStepLabel-label': { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
          '& .MuiStepLabel-label.Mui-active': { color: '#fff' },
          '& .MuiStepLabel-label.Mui-completed': { color: '#e9d5ff' },
          '& .MuiStepIcon-root': { color: 'rgba(255,255,255,0.15)' },
          '& .MuiStepIcon-root.Mui-active': { color: ACCENT },
          '& .MuiStepIcon-root.Mui-completed': { color: ACCENT },
        }}>
          {STEPS.map((s, i) => (
            <Step key={i}><StepLabel>{s.title.replace(/^\d+\.\s*/, '')}</StepLabel></Step>
          ))}
        </Stepper>

        <Box sx={{ textAlign: 'center', px: { sm: 2 } }}>
          <Box sx={{
            width: 64, height: 64, mx: 'auto', mb: 2, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'rgba(139,92,246,0.16)', color: ACCENT, '& svg': { fontSize: 34 },
          }}>
            {step.icon}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{step.title}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 14.5, maxWidth: 440, mx: 'auto', minHeight: 84 }}>
            {step.body}
          </Typography>
        </Box>

        <MobileStepper
          variant="dots"
          steps={STEPS.length}
          position="static"
          activeStep={index}
          sx={{
            bgcolor: 'transparent', mt: 2,
            '& .MuiMobileStepper-dot': { bgcolor: 'rgba(255,255,255,0.2)' },
            '& .MuiMobileStepper-dotActive': { bgcolor: ACCENT },
          }}
          nextButton={
            <Button size="small" onClick={next} sx={{ color: ACCENT, fontWeight: 700 }}>
              {isLast ? 'Kom i gang' : 'Neste'}
              {!isLast && <KeyboardArrowRight />}
            </Button>
          }
          backButton={
            <Button size="small" onClick={back} disabled={index === 0} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <KeyboardArrowLeft />
              Tilbake
            </Button>
          }
        />

        <Stack direction="row" justifyContent="center" sx={{ mt: 0.5 }}>
          {!isLast && (
            <Button size="small" onClick={finish} sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'none' }}>
              Hopp over rundturen
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default EducationTour;
