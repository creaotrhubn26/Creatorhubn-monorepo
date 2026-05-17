/**
 * Forespørsler-seksjon i klient-portalen.
 *
 * Henter alle requests som markedsføreren har sendt til klient-e-posten
 * scoped av session-tokenet. Klienten ser tråd + kan svare direkte —
 * svaret går tilbake til markedsføreren i CSW innen sekunder.
 *
 * Deep-link via ?request=<id> i URL: hvis present scroller vi til
 * og åpner den spesifikke forespørselen automatisk (slik at klienten
 * som klikker på lenken i e-posten lander rett på riktig samtale).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  SupportAgent as MarketerIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface ClientRequestSummary {
  id: string;
  kind: string;
  title: string;
  bodyMarkdown: string;
  contextArea: string;
  contextKey: string | null;
  status: 'pending' | 'in_progress' | 'answered' | 'closed';
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
  bookingUrl: string | null;
}

interface ThreadMessage {
  id: string;
  sender: 'marketer' | 'client' | 'system';
  senderLabel: string | null;
  bodyMarkdown: string;
  createdAt: string;
}

const STATUS_LABEL: Record<ClientRequestSummary['status'], { label: string; color: string; bg: string }> = {
  pending:     { label: 'Venter på deg',          color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  in_progress: { label: 'Purret — venter på deg', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  answered:    { label: 'Du har svart',           color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  closed:      { label: 'Lukket',                 color: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
};

export interface ClientPortalRequestsSectionProps {
  token: string;
  /** Når satt, fokuser denne request-en ved load (typisk fra URL ?request=<id>). */
  highlightRequestId?: string | null;
}

const ClientPortalRequestsSection: React.FC<ClientPortalRequestsSectionProps> = ({
  token, highlightRequestId,
}) => {
  const [requests, setRequests] = useState<ClientRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const hasAutoExpanded = useRef(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/client/portal/requests?token=${encodeURIComponent(token)}`);
      if (!response.ok) {
        setError('Kunne ikke laste forespørslene.');
        return;
      }
      const payload = await response.json() as { status: string; requests: ClientRequestSummary[] };
      setRequests(payload.requests ?? []);
      setError(null);
    } catch {
      setError('Nettverksfeil — sjekk tilkoblingen.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const fetchThread = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(
        `/api/client/portal/requests/${encodeURIComponent(id)}/messages?token=${encodeURIComponent(token)}`,
      );
      if (!response.ok) return;
      const payload = await response.json() as { messages: ThreadMessage[] };
      setThreadCache((prev) => ({ ...prev, [id]: payload.messages ?? [] }));
    } catch {
      // swallow — error vises via main `error`-state
    }
  }, [token]);

  const handleExpand = useCallback(async (id: string): Promise<void> => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!threadCache[id]) {
      await fetchThread(id);
    }
  }, [expanded, threadCache, fetchThread]);

  // Auto-expand + scroll når deep-link ?request=<id> matcher en request i lista
  useEffect(() => {
    if (hasAutoExpanded.current) return;
    if (!highlightRequestId || requests.length === 0) return;
    if (!requests.some((r) => r.id === highlightRequestId)) return;
    hasAutoExpanded.current = true;
    setExpanded(highlightRequestId);
    void fetchThread(highlightRequestId);
    // Scroll etter at DOM har rendret expanded state
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }, [highlightRequestId, requests, fetchThread]);

  const handleReply = useCallback(async (id: string): Promise<void> => {
    const draft = (replyDraft[id] || '').trim();
    if (!draft) return;
    setSubmitting(id);
    try {
      const response = await fetch(
        `/api/client/portal/requests/${encodeURIComponent(id)}/reply?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bodyMarkdown: draft }),
        },
      );
      if (!response.ok) {
        setError('Svaret kunne ikke sendes. Prøv igjen.');
        return;
      }
      setReplyDraft((prev) => ({ ...prev, [id]: '' }));
      await Promise.all([fetchThread(id), load()]);
    } finally {
      setSubmitting(null);
    }
  }, [replyDraft, token, fetchThread, load]);

  const pendingCount = useMemo(() => (
    requests.filter((r) => r.status === 'pending' || r.status === 'in_progress').length
  ), [requests]);

  if (loading && requests.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={28} sx={{ color: '#22d3ee' }} />
      </Box>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 2.4,
        borderRadius: 2.5,
        bgcolor: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(148,163,184,0.18)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.8 }}>
        <Stack spacing={0.3}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>
            Forespørsler fra produsenten din
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.84rem' }}>
            {pendingCount > 0
              ? `Det er ${pendingCount} forespørsel${pendingCount === 1 ? '' : 'er'} som venter på deg.`
              : 'Alle forespørsler er besvart. Takk!'}
          </Typography>
        </Stack>
        {pendingCount > 0 ? (
          <Chip
            label={`${pendingCount} venter`}
            sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 800 }}
          />
        ) : null}
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 1.4, bgcolor: 'rgba(251,191,36,0.1)' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={1.2}>
        {requests.map((req) => {
          const meta = STATUS_LABEL[req.status];
          const isOpen = expanded === req.id;
          const isHighlight = highlightRequestId === req.id;
          const messages = threadCache[req.id] ?? [];
          return (
            <Box
              key={req.id}
              ref={isHighlight ? highlightRef : undefined}
              sx={{
                p: 1.6,
                borderRadius: 1.5,
                bgcolor: isHighlight ? 'rgba(34,211,238,0.06)' : 'rgba(15,23,42,0.45)',
                border: `1px solid ${isHighlight ? '#22d3ee55' : 'rgba(148,163,184,0.2)'}`,
                borderLeft: `4px solid ${meta.color}`,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.4 }}>
                    <Chip
                      size="small"
                      label={meta.label}
                      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, height: 22 }}
                    />
                    <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.74rem' }}>
                      Sendt {formatDate(req.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.96rem', fontWeight: 700 }}>
                    {req.title}
                  </Typography>
                </Box>
                <IconButton onClick={() => void handleExpand(req.id)} sx={{ color: '#cbd5e1' }}>
                  {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>

              <Collapse in={isOpen} timeout="auto">
                <Box sx={{ mt: 1.6 }}>
                  {/* Hoved-spørsmål (markdown body) */}
                  <Box
                    sx={{
                      p: 1.6,
                      borderRadius: 1,
                      bgcolor: 'rgba(96,165,250,0.06)',
                      border: '1px solid rgba(96,165,250,0.15)',
                      mb: 1.2,
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                      <MarketerIcon fontSize="small" sx={{ color: '#60a5fa' }} />
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa' }}>
                        Markedsføreren skriver:
                      </Typography>
                    </Stack>
                    <Typography
                      component="pre"
                      sx={{
                        m: 0,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        fontSize: '0.88rem',
                        color: '#e2e8f0',
                        lineHeight: 1.6,
                      }}
                    >
                      {req.bodyMarkdown}
                    </Typography>
                  </Box>

                  {/* Tidligere meldinger i tråden (utenom initial-meldingen som er vist over) */}
                  {messages.length > 1 ? (
                    <Stack spacing={1} sx={{ mb: 1.4 }}>
                      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />
                      <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.55)' }}>
                        Tidligere meldinger i samtalen:
                      </Typography>
                      {messages.slice(1).map((m) => {
                        const isClient = m.sender === 'client';
                        return (
                          <Stack
                            key={m.id}
                            direction="row"
                            spacing={1}
                            sx={{
                              p: 1.2,
                              borderRadius: 1,
                              bgcolor: isClient ? 'rgba(52,211,153,0.06)' : 'rgba(96,165,250,0.06)',
                            }}
                          >
                            <Box sx={{ pt: 0.2 }}>
                              {isClient
                                ? <PersonIcon fontSize="small" sx={{ color: '#34d399' }} />
                                : <MarketerIcon fontSize="small" sx={{ color: '#60a5fa' }} />
                              }
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.55)' }}>
                                {isClient ? 'Du' : 'Markedsføreren'} · {formatDate(m.createdAt)}
                              </Typography>
                              <Typography
                                component="pre"
                                sx={{
                                  fontSize: '0.86rem',
                                  color: '#f1f5f9',
                                  whiteSpace: 'pre-wrap',
                                  m: 0,
                                  fontFamily: 'inherit',
                                }}
                              >
                                {m.bodyMarkdown}
                              </Typography>
                            </Box>
                          </Stack>
                        );
                      })}
                    </Stack>
                  ) : null}

                  {/* Reply-input — kun hvis ikke lukket */}
                  {req.status !== 'closed' ? (
                    <Stack spacing={1}>
                      <TextField
                        value={replyDraft[req.id] ?? ''}
                        onChange={(e) => setReplyDraft((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder={req.status === 'answered'
                          ? 'Følg opp svaret ditt her…'
                          : 'Skriv svaret ditt her — kan være kort eller utfyllende.'}
                        multiline
                        minRows={3}
                        fullWidth
                        sx={{
                          '& .MuiInputBase-input': { color: '#f8fafc' },
                          '& .MuiInputBase-multiline': { color: '#f8fafc' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                        }}
                      />
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                        {req.bookingUrl ? (
                          <Button
                            size="small"
                            startIcon={<CalendarIcon fontSize="small" />}
                            href={req.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textTransform: 'none', color: '#a78bfa' }}
                          >
                            Heller booke et møte?
                          </Button>
                        ) : <Box />}
                        <Button
                          variant="contained"
                          onClick={() => void handleReply(req.id)}
                          disabled={submitting === req.id || !(replyDraft[req.id] ?? '').trim()}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            bgcolor: '#22d3ee',
                            color: '#0b1226',
                            '&:hover': { bgcolor: '#06b6d4' },
                          }}
                        >
                          {submitting === req.id ? 'Sender…' : 'Send svar'}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography sx={{ fontSize: '0.84rem', color: 'rgba(226,232,240,0.55)' }}>
                      Denne forespørselen er lukket. Hvis du har spørsmål, ta kontakt med markedsføreren direkte.
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default ClientPortalRequestsSection;
