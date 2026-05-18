// @ts-nocheck
/**
 * AssistantNeedsNudge — Slice 9X.52
 *
 * Proaktiv "kanskje du trenger en assistent"-nudge for bryllup som ser
 * krevende ut. Vises kun hvis:
 *   - 2+ trigger-signaler matcher (lang dag, mange events, flere lokasjoner)
 *   - INGEN assistent allerede invitert til dette bryllupet
 *   - Bryllupet er fortsatt ≥3 dager unna (mer enn det er for sent å booke)
 *   - Stine har ikke dismisset for dette bryllupet de siste 30 dager
 *
 * Tone: vennlig, anerkjennende. Aldri pushy. Egen "førstegangs"-variant
 * for fotografer som aldri har invitert noen før.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Stack,
  Typography,
  Chip,
  IconButton,
  Box,
} from '@mui/material';
import {
  Close as CloseIcon,
  PersonAdd as InviteIcon,
  WbSunny as DayIcon,
  Place as LocationIcon,
  EventNote as EventCountIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';

interface Props {
  weddingId: string;
}

interface TimelineEvent {
  id: string;
  scheduledTime: string | null;
  durationMinutes: number;
  locationId: string | null;
}

interface Signal {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: string;
}

const DISMISS_KEY = (weddingId: string) => `assistant-nudge-dismissed:${weddingId}`;
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const NUDGE_VARIANTS_FIRSTTIME = [
  'Hvis du aldri har invitert en assistent: prøv én gang. Du bestemmer rollen, lønna og hva hen leverer — og verktøyet håndterer kontrakt, brief og Drive-deling for deg.',
];

const NUDGE_VARIANTS_REGULAR = [
  'Du jobber hardt. Dette bryllupet ser tett ut — en assistent kunne frigjort deg fra reportasjen mens du tar portrettene.',
  'Lang dag dette. Du har klart slike alene før — men hvis det er noe, kan du invitere en assistent med ett klikk.',
  'Tett program her. En second shooter kunne tatt halvparten av reportasjen så du kan fokusere på de viktige øyeblikkene.',
];

const pickVariant = (firstTime: boolean): string => {
  const pool = firstTime ? NUDGE_VARIANTS_FIRSTTIME : NUDGE_VARIANTS_REGULAR;
  // Deterministisk per dag — slik at samme bryllup ikke skifter tekst hvis Stine re-loader.
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return pool[day % pool.length];
};

const isDismissed = (weddingId: string): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY(weddingId));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

const AssistantNeedsNudge: React.FC<Props> = ({ weddingId }) => {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [assistantsCount, setAssistantsCount] = useState<number | null>(null);
  const [lifetimeInvites, setLifetimeInvites] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed(weddingId));
  const [impressionFired, setImpressionFired] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiRequest(`/api/wedding/${weddingId}/timeline-events`).catch(() => null),
      apiRequest(`/api/wedding/${weddingId}/assistants`).catch(() => null),
      apiRequest('/api/photographer/assistants/history').catch(() => null),
    ]).then(([eventsRes, assistantsRes, historyRes]: any[]) => {
      if (!mounted) return;
      setEvents(Array.isArray(eventsRes?.events) ? eventsRes.events : []);
      setAssistantsCount(Array.isArray(assistantsRes?.assistants) ? assistantsRes.assistants.length : 0);
      setLifetimeInvites(Array.isArray(historyRes?.assistants) ? historyRes.assistants.length : 0);
    });
    return () => { mounted = false; };
  }, [weddingId]);

  const signals = useMemo<Signal[]>(() => {
    if (!events || events.length === 0) return [];
    const withTime = events.filter((e) => e.scheduledTime);
    if (withTime.length === 0) return [];

    const sorted = [...withTime].sort(
      (a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime(),
    );
    const first = new Date(sorted[0].scheduledTime!).getTime();
    const last = sorted[sorted.length - 1];
    const lastEnd = new Date(last.scheduledTime!).getTime() + (last.durationMinutes || 30) * 60_000;
    const spanHours = (lastEnd - first) / (60 * 60 * 1000);
    const locations = new Set(events.map((e) => e.locationId).filter(Boolean));

    const out: Signal[] = [];
    if (spanHours >= 10) {
      out.push({
        key: 'long_day',
        label: 'Lang dag',
        icon: <DayIcon fontSize="small" />,
        value: `${spanHours.toFixed(1)} timer fra første til siste event`,
      });
    }
    if (events.length >= 15) {
      out.push({
        key: 'many_events',
        label: 'Mange events',
        icon: <EventCountIcon fontSize="small" />,
        value: `${events.length} timeline-events`,
      });
    }
    if (locations.size >= 3) {
      out.push({
        key: 'multi_location',
        label: 'Flere lokasjoner',
        icon: <LocationIcon fontSize="small" />,
        value: `${locations.size} ulike steder`,
      });
    }
    return out;
  }, [events]);

  // Bryllupsdato-sjekk: ikke nudge hvis ≤3 dager unna (for sent å booke)
  const tooLateToInvite = useMemo(() => {
    if (!events || events.length === 0) return false;
    const withTime = events.filter((e) => e.scheduledTime);
    if (withTime.length === 0) return false;
    const first = new Date(withTime[0].scheduledTime!).getTime();
    const daysUntil = (first - Date.now()) / (24 * 60 * 60 * 1000);
    return daysUntil <= 3;
  }, [events]);

  const shouldShow =
    !dismissed &&
    assistantsCount === 0 &&
    signals.length >= 2 &&
    !tooLateToInvite &&
    events !== null && assistantsCount !== null && lifetimeInvites !== null;

  const firstTimeUser = lifetimeInvites === 0;
  const message = useMemo(() => pickVariant(firstTimeUser), [firstTimeUser]);

  useEffect(() => {
    if (shouldShow && !impressionFired) {
      trackEvent('assistant_nudge_shown', {
        wedding_id: weddingId,
        trigger_signals: signals.map((s) => s.key).join(','),
        signal_count: signals.length,
        first_time_user: firstTimeUser,
      });
      setImpressionFired(true);
    }
  }, [shouldShow, impressionFired, weddingId, signals, firstTimeUser]);

  if (!shouldShow) return null;

  const handleClick = () => {
    trackEvent('assistant_nudge_clicked', {
      wedding_id: weddingId,
      first_time_user: firstTimeUser,
    });
    // AssistantsPanel lytter på denne — åpner invite-dialogen
    window.dispatchEvent(new CustomEvent('open-assistant-invite', { detail: { weddingId } }));
    // Scroll-target er panelet selv
    const panel = document.querySelector('[data-assistants-panel]');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDismiss = () => {
    trackEvent('assistant_nudge_dismissed', {
      wedding_id: weddingId,
      first_time_user: firstTimeUser,
    });
    try { localStorage.setItem(DISMISS_KEY(weddingId), String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      icon={false}
      sx={{
        mb: 2,
        bgcolor: 'primary.50',
        borderLeft: 4,
        borderColor: 'primary.main',
        '& .MuiAlert-message': { width: '100%' },
      }}
      action={
        <IconButton size="small" onClick={handleDismiss} aria-label="Lukk forslag">
          <CloseIcon fontSize="small" />
        </IconButton>
      }
    >
      <AlertTitle sx={{ mb: 0.5 }}>
        {firstTimeUser ? 'Et stille tips' : 'Kanskje du kunne trengt en hånd?'}
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 1.5 }}>{message}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {signals.map((s) => (
          <Chip
            key={s.key}
            size="small"
            icon={s.icon as any}
            label={`${s.label}: ${s.value}`}
            variant="outlined"
            sx={{ bgcolor: 'background.paper' }}
          />
        ))}
      </Stack>
      <Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<InviteIcon />}
          onClick={handleClick}
        >
          {firstTimeUser ? 'Prøv å invitere en' : 'Inviter assistent'}
        </Button>
      </Box>
    </Alert>
  );
};

export default AssistantNeedsNudge;
