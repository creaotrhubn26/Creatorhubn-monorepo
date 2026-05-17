/**
 * WelcomeWizard — første-gangs onboarding-flyt for markedsfører.
 *
 * Vises som overlay første gang en bruker logger inn. Tar dem gjennom
 * de 7 viktigste stegene for å komme i gang: 2FA, prosjekt-opprettelse,
 * research, markedsplan, datakilder, klient-invitasjon.
 *
 * Hver step har:
 *  - Tittel + beskrivelse + ikon
 *  - "Gjør det nå"-CTA (åpner relevant rute eller modal)
 *  - "Marker som ferdig"-knapp (eller auto-detect via callback)
 *  - "Hopp over"-knapp
 *
 * Persistens via /api/onboarding/* så progresjon overlever
 * page-reloads og enheter.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Shield as ShieldIcon,
  RocketLaunch as RocketIcon,
  Search as ResearchIcon,
  Description as PlanIcon,
  Link as ConnectIcon,
  PersonAdd as InviteIcon,
  ArrowForward as NextIcon,
  CelebrationOutlined as CelebrationIcon,
} from '@mui/icons-material';
import authSessionService from '@/components/role-room/services/authSessionService';

type StepId =
  | 'welcome'
  | 'enable_2fa'
  | 'create_project'
  | 'run_research'
  | 'generate_marketing_plan'
  | 'connect_data_sources'
  | 'invite_client';

interface StepDef {
  id: StepId;
  title: string;
  shortLabel: string;
  description: string;
  Icon: React.ElementType;
  iconColor: string;
  cta: { label: string; href?: string; action?: () => void } | null;
  whyMatters: string;
}

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    title: 'Velkommen til The Role Room',
    shortLabel: 'Start',
    description:
      'The Role Room er bygget for digitale markedsførere som jobber med flere klienter samtidig. På 7 raske steg viser vi deg hvordan du kommer i gang — fra trygg passord-håndtering til invitering av din første klient. Trykk "Gå videre" for å starte.',
    Icon: RocketIcon,
    iconColor: '#22d3ee',
    cta: null, // auto-fullføres når bruker går videre
    whyMatters: 'En guidet start hjelper deg å oppdage alle verktøyene som er bygget for deg.',
  },
  {
    id: 'enable_2fa',
    title: 'Aktiver to-faktor-autentisering',
    shortLabel: '2FA',
    description:
      'Du kommer til å håndtere klienters passord og API-nøkler. 2FA stopper kontotyveri selv om noen får tak i passordet ditt. Tar 2 min å sette opp med Google Authenticator eller 1Password.',
    Icon: ShieldIcon,
    iconColor: '#a78bfa',
    cta: { label: 'Sett opp 2FA nå', href: '/innstillinger/sikkerhet' },
    whyMatters:
      'Uten 2FA: én lekket passord = full tilgang til alle klient-kontoer du administrerer. Med 2FA: angriperen må også ha telefonen din.',
  },
  {
    id: 'create_project',
    title: 'Opprett ditt første prosjekt',
    shortLabel: 'Prosjekt',
    description:
      'Et prosjekt representerer én klient. Alt — research, markedsplan, datakilder, secrets, klient-tilgang — organiseres per prosjekt. Start med navnet på en klient du allerede jobber med.',
    Icon: RocketIcon,
    iconColor: '#34d399',
    cta: { label: 'Gå til prosjekter', href: '/dashboard' },
    whyMatters: 'Hvert prosjekt er isolert — én klients data er aldri synlig for en annen klient.',
  },
  {
    id: 'run_research',
    title: 'Kjør research på klientens bedrift',
    shortLabel: 'Research',
    description:
      'Research-agenten henter offentlig informasjon om klienten: bransje, konkurrenter, sosiale profiler, Brreg-data, anmeldelser. Tar 30-60 sek og gir markedsplanen et solid faktagrunnlag.',
    Icon: ResearchIcon,
    iconColor: '#fbbf24',
    cta: null,
    whyMatters:
      'Markedsplaner basert på faktisk research presterer 3-5x bedre enn generiske maler — du slipper "synes alle bedrifter er like"-fellen.',
  },
  {
    id: 'generate_marketing_plan',
    title: 'Generer markedsplan',
    shortLabel: 'Plan',
    description:
      'Når research er ferdig genereres en 30-dagers markedsplan med pillars, tone-of-voice, KPI-mål og konkrete poster per kanal. Du kan tilpasse alt før du aksepterer.',
    Icon: PlanIcon,
    iconColor: '#60a5fa',
    cta: null,
    whyMatters:
      'Planen blir grunnlaget for hele Creative Sync Workspace — feed-planneren, KPI-tracking, godkjenningsflyt — alt bygger på pillarene.',
  },
  {
    id: 'connect_data_sources',
    title: 'Koble datakilder',
    shortLabel: 'Datakilder',
    description:
      'Koble GA4, Search Console, Meta Business Manager, LinkedIn, YouTube. KPI-tracker henter automatisk reach, engagement og conversion-data så du ikke trenger å lime CSV-er.',
    Icon: ConnectIcon,
    iconColor: '#a855f7',
    cta: null,
    whyMatters:
      'Manuell datainnsamling koster typisk 2-4 timer per måned per klient. Automatisk = du kan administrere 3x flere klienter.',
  },
  {
    id: 'invite_client',
    title: 'Inviter klienten til portalen',
    shortLabel: 'Inviter',
    description:
      'Klienten får en magic-link til en read-only portal hvor de ser markedsplan, fremdrift og forespørsler fra deg. De kan registrere bruker, aktivere 2FA, og svare på meldinger uten å logge inn et eget sted.',
    Icon: InviteIcon,
    iconColor: '#f87171',
    cta: null,
    whyMatters:
      'Klient med innsyn = klient som stoler på deg. Ingen flere "hva jobber dere med?"-e-poster — alt er synlig live.',
  },
];

const WelcomeWizard: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    const token = authSessionService.getSessionTokenSync();
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }, []);

  // Hent status ved mount — vis wizard kun hvis ikke dismissed/completed
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/onboarding/status', { headers: authHeaders() });
        if (cancelled) return;
        if (response.status === 401) {
          // Ikke logget inn — vis ikke wizarden
          setOpen(false);
          return;
        }
        if (!response.ok) {
          setOpen(false);
          return;
        }
        const payload = await response.json() as {
          completedSteps: StepId[];
          hidden: boolean;
        };
        setCompletedSteps(payload.completedSteps ?? []);
        if (!payload.hidden) {
          setOpen(true);
          // Hopp til første ufullførte steg
          const firstIncomplete = STEPS.findIndex((s) => !(payload.completedSteps ?? []).includes(s.id));
          setActiveStepIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
        }
      } catch {
        setOpen(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authHeaders]);

  const markStepComplete = useCallback(async (stepId: StepId): Promise<void> => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding/complete-step', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ stepId }),
      });
      if (response.ok) {
        const payload = await response.json() as { completedSteps: StepId[]; hidden: boolean };
        setCompletedSteps(payload.completedSteps);
        if (payload.hidden) {
          setOpen(false);
        } else {
          // Gå til neste ufullførte steg
          const next = STEPS.findIndex((s) => !payload.completedSteps.includes(s.id));
          if (next >= 0) setActiveStepIdx(next);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [authHeaders]);

  const handleDismiss = useCallback(async (): Promise<void> => {
    setSubmitting(true);
    try {
      await fetch('/api/onboarding/dismiss', {
        method: 'POST',
        headers: authHeaders(),
      });
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [authHeaders]);

  if (loading || !open) return null;

  const activeStep = STEPS[activeStepIdx];
  if (!activeStep) return null;
  const isCompleted = completedSteps.includes(activeStep.id);
  const allDone = completedSteps.length >= STEPS.length;
  const ActiveIcon = activeStep.Icon;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : handleDismiss}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0b1226',
          color: '#f8fafc',
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Topp-bar med progresjon + lukke */}
      <Box sx={{ p: 2.4, borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(34,211,238,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Velkomst-guide
            </Typography>
            <Chip
              label={`${completedSteps.length} / ${STEPS.length} fullført`}
              size="small"
              sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#22d3ee', fontWeight: 700, height: 22 }}
            />
          </Stack>
          <IconButton
            onClick={handleDismiss}
            disabled={submitting}
            size="small"
            sx={{ color: '#cbd5e1' }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={(completedSteps.length / STEPS.length) * 100}
          sx={{
            height: 4,
            borderRadius: 999,
            bgcolor: 'rgba(148,163,184,0.18)',
            '& .MuiLinearProgress-bar': { bgcolor: '#22d3ee' },
          }}
        />

        {/* Steg-pillene */}
        <Stack direction="row" spacing={0.6} sx={{ mt: 1.4, flexWrap: 'wrap', useFlexGap: true }} useFlexGap>
          {STEPS.map((step, idx) => {
            const stepDone = completedSteps.includes(step.id);
            const isActive = idx === activeStepIdx;
            return (
              <Button
                key={step.id}
                size="small"
                onClick={() => setActiveStepIdx(idx)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  px: 1.2,
                  py: 0.3,
                  minHeight: 24,
                  border: `1px solid ${isActive ? '#22d3ee' : stepDone ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.2)'}`,
                  bgcolor: isActive ? 'rgba(34,211,238,0.12)' : stepDone ? 'rgba(52,211,153,0.08)' : 'transparent',
                  color: isActive ? '#22d3ee' : stepDone ? '#34d399' : 'rgba(226,232,240,0.65)',
                  '&:hover': { bgcolor: isActive ? 'rgba(34,211,238,0.18)' : 'rgba(148,163,184,0.08)' },
                }}
                startIcon={stepDone ? <CheckIcon sx={{ fontSize: 12 }} /> : undefined}
              >
                {idx + 1}. {step.shortLabel}
              </Button>
            );
          })}
        </Stack>
      </Box>

      {/* Hovedinnhold */}
      <Box sx={{ p: 3 }}>
        {allDone ? (
          <Stack alignItems="center" spacing={2.4} sx={{ py: 4 }}>
            <CelebrationIcon sx={{ fontSize: 64, color: '#34d399' }} />
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', textAlign: 'center' }}>
              Du er klar til å levere
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', color: 'rgba(226,232,240,0.72)', textAlign: 'center', maxWidth: 520, lineHeight: 1.6 }}>
              Alle 7 stegene er fullført. Du har nå alt du trenger for å administrere prosjekter,
              klienter, og levere måle-baserte resultater. Lykke til!
            </Typography>
            <Button
              onClick={handleDismiss}
              variant="contained"
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#22d3ee', color: '#0b1226', px: 3, '&:hover': { bgcolor: '#06b6d4' } }}
            >
              Lukk
            </Button>
          </Stack>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing={1.6} sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: `${activeStep.iconColor}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ActiveIcon sx={{ color: activeStep.iconColor, fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.55)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Steg {activeStepIdx + 1} av {STEPS.length}
                </Typography>
                <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.15 }}>
                  {activeStep.title}
                </Typography>
              </Box>
              {isCompleted ? (
                <Chip
                  icon={<CheckIcon sx={{ color: '#34d399 !important' }} />}
                  label="Fullført"
                  sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#34d399', fontWeight: 700 }}
                />
              ) : null}
            </Stack>

            <Typography sx={{ fontSize: '0.94rem', color: 'rgba(226,232,240,0.82)', lineHeight: 1.6, mb: 2 }}>
              {activeStep.description}
            </Typography>

            <Alert
              severity="info"
              sx={{ mb: 2.4, bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', '& .MuiAlert-message': { color: 'rgba(226,232,240,0.85)' } }}
            >
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', mb: 0.3 }}>
                Hvorfor er dette viktig?
              </Typography>
              <Typography sx={{ fontSize: '0.82rem' }}>
                {activeStep.whyMatters}
              </Typography>
            </Alert>

            <Stack direction="row" spacing={1.2} justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={handleDismiss}
                  disabled={submitting}
                  sx={{ textTransform: 'none', color: '#94a3b8' }}
                >
                  Hopp over alt
                </Button>
                {!isCompleted ? (
                  <Button
                    onClick={() => void markStepComplete(activeStep.id)}
                    disabled={submitting}
                    sx={{ textTransform: 'none', color: '#94a3b8' }}
                  >
                    Hopp over dette steget
                  </Button>
                ) : null}
              </Stack>
              <Stack direction="row" spacing={1}>
                {activeStep.cta?.href ? (
                  <Button
                    href={activeStep.cta.href}
                    target="_self"
                    variant="outlined"
                    sx={{
                      textTransform: 'none',
                      color: activeStep.iconColor,
                      borderColor: `${activeStep.iconColor}55`,
                      '&:hover': { borderColor: activeStep.iconColor, bgcolor: `${activeStep.iconColor}10` },
                    }}
                  >
                    {activeStep.cta.label}
                  </Button>
                ) : null}
                <Button
                  onClick={() => void markStepComplete(activeStep.id)}
                  disabled={submitting}
                  variant="contained"
                  endIcon={<NextIcon />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#22d3ee',
                    color: '#0b1226',
                    '&:hover': { bgcolor: '#06b6d4' },
                  }}
                >
                  {submitting
                    ? <CircularProgress size={14} sx={{ color: '#0b1226' }} />
                    : isCompleted ? 'Neste steg' : 'Marker som ferdig'}
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </Box>
    </Dialog>
  );
};

export default WelcomeWizard;
