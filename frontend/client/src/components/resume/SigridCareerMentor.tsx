/**
 * SigridCareerMentor — chat-grensesnitt med "Sigrid", NextRole sin
 * karrierementer.
 *
 * Sigrid er en AI-mentor som bygger på Claude. Vi viser dette
 * transparent (under-tittel + info-tooltip), men gir AI-en personlighet
 * og kontinuitet ved å gi den et navn.
 *
 * Brukerflyt:
 *   1. Første gang: onboarding-screen som spør om tone
 *      (brutal / balansert / støttende)
 *   2. Chat-vindu der bruker kan stille spørsmål, Sigrid svarer med
 *      konkrete anbefalinger basert på CV + norsk arbeidsmarked-data
 *   3. Tone-chip i bunnen — alltid synlig, kan endres når som helst
 *   4. Per-svar overstyring: "Vis brutal versjon" / "Vis støttende versjon"
 *   5. Anbefalte stillinger vises som klikkbare kort med direkte
 *      handlings-knapper (lag CV, søk, tren intervju)
 */

import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Stack, Paper, Chip,
  CircularProgress, Alert, IconButton, Avatar, Tooltip,
  ToggleButtonGroup, ToggleButton, Menu, MenuItem, Divider,
  Checkbox, FormControlLabel, Link as MuiLink,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  InfoOutlined as InfoIcon,
  AutoAwesome as AIIcon,
  Person as PersonIcon,
  Bolt as BoltIcon,
  Balance as BalanceIcon,
  WbSunny as SunIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  ShieldOutlined as ShieldIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

type Tone = 'brutal' | 'balanced' | 'supportive';

const TONE_META: Record<Tone, { label: string; sub: string; icon: React.ReactElement; color: string }> = {
  brutal: {
    label: 'Brutalt ærlig',
    sub: 'Fakta og tall, også når det er ubehagelig',
    icon: <BoltIcon />,
    color: '#DC2626',
  },
  balanced: {
    label: 'Balansert',
    sub: 'Ærlighet med kontekst — muligheter og hindre',
    icon: <BalanceIcon />,
    color: '#F5B82E',
  },
  supportive: {
    label: 'Støttende',
    sub: 'Fokus på styrker og hva som er mulig',
    icon: <SunIcon />,
    color: '#10B981',
  },
};

interface RecommendedJob {
  styrkCode?: string;
  label: string;
  matchScore?: number;
  medianNok?: number | null;
  openPositions?: number | null;
  why?: string;
  realisticTimeToReach?: string;
}

interface MentorMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toneUsed?: string | null;
  jobsInMessage?: RecommendedJob[] | null;
  createdAt?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  resumeId?: string | null;
}

function formatNok(amount: number): string {
  return amount.toLocaleString('no-NO', { maximumFractionDigits: 0 });
}

interface PiiDisclosure {
  version: string;
  sent: string[];
  notSent: string[];
  aiProviders: { name: string; purpose: string; retention: string }[];
  yourRights: string[];
}

// ── PII-disclosure-PANEL — alltid synlig (ikke kollapset) ─────────
// Viser fullt hvilke data som sendes/ikke sendes + AI-leverandører
// + brukerens rettigheter. Brukerens samtykke-checkbox er ved siden av.

const PiiDisclosurePanel: React.FC<{
  showRights?: boolean;
}> = ({ showRights = false }) => {
  const { data } = useQuery<PiiDisclosure>({
    queryKey: ['pii-disclosure'],
    queryFn: async () =>
      (await apiRequest('/api/nextrole/career-mentor/pii-disclosure')) as PiiDisclosure,
  });

  if (!data) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        bgcolor: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.10)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldIcon sx={{ fontSize: 18, color: '#1F2937' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Slik behandler vi data om deg
        </Typography>
        <Chip
          label={`v${data.version}`}
          size="small"
          sx={{ height: 18, fontSize: 10, ml: 'auto' }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: '#10B981' }}>
            SENDES TIL AI
          </Typography>
          <Stack spacing={0.3}>
            {data.sent.map((s, i) => (
              <Stack key={i} direction="row" spacing={0.5} alignItems="flex-start">
                <CheckCircleIcon sx={{ fontSize: 14, color: '#10B981', mt: 0.2 }} />
                <Typography variant="caption" sx={{ lineHeight: 1.5 }}>{s}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: '#DC2626' }}>
            SENDES ALDRI
          </Typography>
          <Stack spacing={0.3}>
            {data.notSent.map((s, i) => (
              <Stack key={i} direction="row" spacing={0.5} alignItems="flex-start">
                <CancelIcon sx={{ fontSize: 14, color: '#DC2626', mt: 0.2 }} />
                <Typography variant="caption" sx={{ lineHeight: 1.5 }}>{s}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        AI-LEVERANDØRER
      </Typography>
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        {data.aiProviders.map((p, i) => (
          <Box key={i}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {p.name} — {p.purpose}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
              {p.retention}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, fontStyle: 'italic', color: 'text.secondary' }}>
        Fri-tekst (rolle-beskrivelser, achievements, summary) blir automatisk scrubbet
        for fødselsnumre, telefon, e-post, kontonumre og gateadresser før det sendes.
      </Typography>

      {showRights && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            DINE RETTIGHETER
          </Typography>
          <Stack spacing={0.3}>
            {data.yourRights.map((r, i) => (
              <Typography key={i} variant="caption" sx={{ display: 'block' }}>
                • {r}
              </Typography>
            ))}
          </Stack>
        </>
      )}

      <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
        Detaljer:{' '}
        <MuiLink href="/privacy-policy#nextrole" target="_blank" rel="noopener" sx={{ fontWeight: 600 }}>
          Personvernerklæringen (§8 NextRole)
        </MuiLink>
      </Typography>
    </Paper>
  );
};

export const SigridCareerMentor: React.FC<Props> = ({ open, onClose, resumeId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<'pii-ack' | 'tone' | 'chat'>('pii-ack');
  const [tone, setTone] = useState<Tone>('balanced');
  const [piiAcknowledged, setPiiAcknowledged] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toneMenuAnchor, setToneMenuAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hent preferences ved åpning
  const { data: prefs } = useQuery<{
    feedbackTone: Tone;
    toneChangedAt: string | null;
    piiAcknowledgedAt: string | null;
    piiAcknowledgedVersion: string | null;
    piiAcknowledgedCurrent: boolean;
  }>({
    queryKey: ['career-mentor-prefs', user?.id],
    queryFn: async () =>
      (await apiRequest('/api/nextrole/career-mentor/preferences', {
        headers: { 'x-user-id': user?.id || '' },
      })) as {
        feedbackTone: Tone;
        toneChangedAt: string | null;
        piiAcknowledgedAt: string | null;
        piiAcknowledgedVersion: string | null;
        piiAcknowledgedCurrent: boolean;
      },
    enabled: open && !!user?.id,
  });

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setSessionId(null);
    setError(null);
    setPiiAcknowledged(false);

    // 1. Hvis bruker IKKE har anerkjent gjeldende PII-versjon → må starte med pii-ack
    if (!prefs?.piiAcknowledgedCurrent) {
      setPhase('pii-ack');
    } else if (prefs?.toneChangedAt) {
      // 2. PII OK + har valgt tone → hopp rett til chat
      setTone(prefs.feedbackTone);
      setPhase('chat');
      void startSession(prefs.feedbackTone);
    } else {
      // 3. PII OK men ikke valgt tone → tone-velger
      setPhase('tone');
    }
    trackGA4('nextrole_sigrid_opened', {
      resume_id: resumeId ?? null,
      pii_already_acked: prefs?.piiAcknowledgedCurrent ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefs?.toneChangedAt, prefs?.piiAcknowledgedCurrent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Logg PII-anerkjennelse, gå deretter til tone-velger
  const handleAcknowledgePii = async () => {
    if (!piiAcknowledged) return;
    try {
      await apiRequest('/api/nextrole/career-mentor/acknowledge-pii', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      queryClient.invalidateQueries({ queryKey: ['career-mentor-prefs'] });
      trackGA4('nextrole_pii_acknowledged');
    } catch (err) {
      console.error('PII-anerkjennelse feilet', err);
    }
    setPhase('tone');
  };

  // Lagre tone-preferanse og start sesjon
  const handleSelectTone = async (selected: Tone) => {
    setTone(selected);
    try {
      await apiRequest('/api/nextrole/career-mentor/preferences', {
        method: 'PATCH',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackTone: selected }),
      });
      queryClient.invalidateQueries({ queryKey: ['career-mentor-prefs'] });
      trackGA4('nextrole_sigrid_tone_selected', { tone: selected, source: 'onboarding' });
    } catch (err) {
      console.warn('Kunne ikke lagre tone', err);
    }
    setPhase('chat');
    await startSession(selected);
  };

  const startSession = async (selectedTone?: Tone) => {
    setSending(true);
    setError(null);
    try {
      const res = await apiRequest('/api/nextrole/career-mentor/sessions', {
        method: 'POST',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resumeId || undefined,
          kind: resumeId ? 'match' : 'discovery',
        }),
      });
      setSessionId(res.sessionId);
      setMessages([
        {
          role: 'assistant',
          content: res.message.content,
          jobsInMessage: res.message.jobsInMessage,
          toneUsed: selectedTone ?? tone,
        },
      ]);
      trackGA4('nextrole_sigrid_session_started', {
        session_id: res.sessionId,
        tone: selectedTone ?? tone,
      });
    } catch (err) {
      console.error('Kunne ikke starte Sigrid-sesjon', err);
      setError('Sigrid er ikke tilgjengelig akkurat nå. Prøv om litt.');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!sessionId || !input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);
    setError(null);
    try {
      const res = await apiRequest(
        `/api/nextrole/career-mentor/sessions/${sessionId}/message`,
        {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage }),
        },
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.message.content,
          jobsInMessage: res.message.jobsInMessage,
          toneUsed: res.message.toneUsed,
        },
      ]);
    } catch (err) {
      console.error('Sigrid feilet', err);
      setError('Kunne ikke sende. Prøv på nytt.');
    } finally {
      setSending(false);
    }
  };

  const handleRetone = async (newTone: Tone) => {
    if (!sessionId) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiRequest(
        `/api/nextrole/career-mentor/sessions/${sessionId}/retone`,
        {
          method: 'POST',
          headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
          body: JSON.stringify({ tone: newTone }),
        },
      );
      // Erstatt siste assistant-melding med ny
      setMessages((prev) => {
        const last = prev.findLastIndex((m) => m.role === 'assistant');
        if (last < 0) return prev;
        const next = [...prev];
        next[last] = {
          role: 'assistant',
          content: res.message.content,
          jobsInMessage: res.message.jobsInMessage,
          toneUsed: newTone,
        };
        return next;
      });
      trackGA4('nextrole_sigrid_retoned', { new_tone: newTone });
    } catch (err) {
      console.error('Retone feilet', err);
    } finally {
      setSending(false);
    }
  };

  const handleChangeTone = async (newTone: Tone) => {
    setToneMenuAnchor(null);
    if (newTone === tone) return;
    setTone(newTone);
    try {
      await apiRequest('/api/nextrole/career-mentor/preferences', {
        method: 'PATCH',
        headers: { 'x-user-id': user?.id || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbackTone: newTone }),
      });
      trackGA4('nextrole_sigrid_tone_changed', { from: tone, to: newTone });
    } catch (err) {
      console.warn('Tone-update feilet', err);
    }
  };

  const renderJobCard = (job: RecommendedJob, idx: number) => {
    const scoreColor =
      (job.matchScore ?? 0) >= 80 ? '#10B981' :
      (job.matchScore ?? 0) >= 60 ? '#F5B82E' : '#6B7280';
    return (
      <Paper
        key={idx}
        variant="outlined"
        sx={{ p: 1.5, my: 0.7, bgcolor: 'rgba(255,255,255,0.04)' }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {job.label}
            </Typography>
            {job.why && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                {job.why}
              </Typography>
            )}
          </Box>
          {typeof job.matchScore === 'number' && (
            <Chip
              label={`${job.matchScore}% match`}
              size="small"
              sx={{
                height: 22, fontSize: 11, fontWeight: 700,
                bgcolor: scoreColor + '22',
                color: scoreColor,
              }}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
          {typeof job.medianNok === 'number' && (
            <Chip
              label={`Median ${formatNok(job.medianNok)} kr/mnd`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          )}
          {typeof job.openPositions === 'number' && (
            <Chip
              label={`${job.openPositions} ledige`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          )}
          {job.realisticTimeToReach && (
            <Chip
              label={job.realisticTimeToReach}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          )}
        </Stack>
      </Paper>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '85vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{
            bgcolor: '#F5B82E',
            color: '#1F2937',
            width: 36, height: 36,
            fontWeight: 800, fontSize: 16,
          }}>
            S
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Sigrid
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                AI-mentor for karriere
              </Typography>
              <Tooltip
                title="Sigrid bygger på Claude (Anthropic). All veiledning er AI-generert basert på din profil og norsk arbeidsmarked-data."
                arrow
                placement="bottom"
              >
                <InfoIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              </Tooltip>
            </Stack>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', p: 0 }}>
        {/* ── FASE 1: PII-ANERKJENNELSE (alltid synlig) ── */}
        {phase === 'pii-ack' && (
          <Box sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Hei. Før vi starter — viktig om dataene dine
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sigrid bruker AI for å gi karriereråd basert på profilen din.
                Slik håndterer vi dataene dine:
              </Typography>
            </Box>

            <PiiDisclosurePanel showRights />

            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'rgba(245,184,46,0.12)', borderColor: '#F5B82E' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={piiAcknowledged}
                    onChange={(e) => setPiiAcknowledged(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Jeg har lest og forstår hvilke data Sigrid (og NextRole sine andre AI-funksjoner) bruker.
                  </Typography>
                }
              />
            </Paper>
          </Box>
        )}

        {/* ── FASE 2: TONE-VALG ── */}
        {phase === 'tone' && (
          <Box sx={{ p: 4, flex: 1, overflowY: 'auto' }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Hvilken type tilbakemelding vil du ha?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Du kan endre dette når som helst underveis.
              </Typography>
            </Box>
            <Stack spacing={2}>
              {(Object.keys(TONE_META) as Tone[]).map((t) => {
                const meta = TONE_META[t];
                return (
                  <Paper
                    key={t}
                    variant="outlined"
                    onClick={() => handleSelectTone(t)}
                    sx={{
                      p: 2.5,
                      cursor: 'pointer',
                      borderLeft: `4px solid ${meta.color}`,
                      '&:hover': {
                        bgcolor: meta.color + '0a',
                        borderColor: meta.color,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ color: meta.color }}>{meta.icon}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {meta.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meta.sub}
                        </Typography>
                      </Box>
                      <ArrowIcon sx={{ color: 'text.disabled' }} />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* ── CHAT ── */}
        {phase === 'chat' && (
          <>
            {/* Tone-chip i toppen */}
            <Box sx={{
              px: 2, py: 1,
              borderBottom: '1px solid', borderColor: 'divider',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              bgcolor: 'rgba(255,255,255,0.04)',
            }}>
              <Typography variant="caption" color="text.secondary">
                Sigrid svarer i {TONE_META[tone].label.toLowerCase()}-modus
              </Typography>
              <Button
                size="small"
                startIcon={TONE_META[tone].icon}
                onClick={(e) => setToneMenuAnchor(e.currentTarget)}
                sx={{
                  color: TONE_META[tone].color,
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {TONE_META[tone].label}
              </Button>
              <Menu
                anchorEl={toneMenuAnchor}
                open={!!toneMenuAnchor}
                onClose={() => setToneMenuAnchor(null)}
              >
                {(Object.keys(TONE_META) as Tone[]).map((t) => (
                  <MenuItem
                    key={t}
                    selected={t === tone}
                    onClick={() => handleChangeTone(t)}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ color: TONE_META[t].color, display: 'flex' }}>
                        {TONE_META[t].icon}
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {TONE_META[t].label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {TONE_META[t].sub}
                        </Typography>
                      </Box>
                    </Stack>
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Chat-vindu */}
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'rgba(255,255,255,0.04)' }}>
              <Stack spacing={2}>
                {messages.map((m, i) => {
                  const isUser = m.role === 'user';
                  const isLastAssistant =
                    !isUser && i === messages.findLastIndex((x) => x.role === 'assistant');
                  return (
                    <Stack
                      key={i}
                      direction={isUser ? 'row-reverse' : 'row'}
                      spacing={1.5}
                      alignItems="flex-start"
                    >
                      <Avatar sx={{
                        bgcolor: isUser ? '#1F2937' : '#F5B82E',
                        color: isUser ? '#fff' : '#1F2937',
                        width: 30, height: 30,
                        fontWeight: 800, fontSize: 14,
                      }}>
                        {isUser ? <PersonIcon sx={{ fontSize: 16 }} /> : 'S'}
                      </Avatar>
                      <Box sx={{ maxWidth: '78%' }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            bgcolor: isUser ? 'rgba(255,255,255,0.04)' : 'rgba(245,184,46,0.12)',
                            borderColor: isUser ? 'divider' : '#F5B82E40',
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {m.content}
                          </Typography>
                          {m.jobsInMessage && m.jobsInMessage.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: '#7A5A0B' }}>
                                FORESLÅTTE YRKER
                              </Typography>
                              {m.jobsInMessage.map((j, ji) => renderJobCard(j, ji))}
                            </Box>
                          )}
                        </Paper>
                        {/* Per-svar retone-knapper, kun på siste assistant-melding */}
                        {isLastAssistant && !sending && (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                            {(Object.keys(TONE_META) as Tone[])
                              .filter((t) => t !== (m.toneUsed as Tone))
                              .map((t) => (
                                <Tooltip key={t} title={`Vis ${TONE_META[t].label.toLowerCase()} versjon`}>
                                  <Button
                                    size="small"
                                    onClick={() => handleRetone(t)}
                                    startIcon={TONE_META[t].icon}
                                    sx={{
                                      fontSize: 10,
                                      textTransform: 'none',
                                      color: TONE_META[t].color,
                                      minWidth: 0, py: 0.2,
                                    }}
                                  >
                                    {TONE_META[t].label}
                                  </Button>
                                </Tooltip>
                              ))}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  );
                })}
                {sending && (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pl: 5 }}>
                    <CircularProgress size={14} sx={{ color: '#F5B82E' }} />
                    <Typography variant="caption" color="text.secondary">
                      Sigrid tenker …
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            {/* Input-felt */}
            <Box sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}>
              {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
              <Stack direction="row" spacing={1}>
                <TextField
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  fullWidth
                  multiline
                  maxRows={4}
                  size="small"
                  placeholder="Skriv til Sigrid …"
                  disabled={sending || !sessionId}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={sending || !input.trim() || !sessionId}
                  startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                  sx={{
                    bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' },
                    color: '#1F2937', fontWeight: 700,
                  }}
                >
                  Send
                </Button>
              </Stack>

              {/* Permanent PII-fotnote — alltid synlig under input */}
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{ mt: 1.2, color: 'text.disabled' }}
              >
                <ShieldIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontSize: 11 }}>
                  Sigrid ser kun: tittel, by, erfaring, utdanning, ferdigheter — aldri navn, e-post eller telefon.
                </Typography>
                <Tooltip title="Se full disclosure">
                  <Button
                    size="small"
                    onClick={() => {
                      setPhase('pii-ack');
                      setPiiAcknowledged(false);
                    }}
                    sx={{
                      fontSize: 10,
                      textTransform: 'none',
                      minWidth: 0,
                      p: 0,
                      ml: 0.5,
                      color: '#3B82F6',
                    }}
                  >
                    Detaljer
                  </Button>
                </Tooltip>
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>
      {phase === 'pii-ack' && (
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={onClose}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleAcknowledgePii}
            disabled={!piiAcknowledged}
            sx={{
              bgcolor: '#F5B82E', '&:hover': { bgcolor: '#D49B1A' },
              color: '#1F2937', fontWeight: 700,
            }}
          >
            Fortsett til tone-valg
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default SigridCareerMentor;
