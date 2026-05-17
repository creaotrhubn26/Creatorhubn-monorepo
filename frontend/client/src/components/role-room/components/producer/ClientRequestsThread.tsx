/**
 * ClientRequestsThread — viser status og samtaler for klient-forespørsler.
 *
 * Brukes både:
 *  - Som inline-seksjon i DataSourcesPanel (kun `contextArea="data_sources"`)
 *  - Som standalone panel i CSW (uten `contextArea`-filter → alle requests)
 *
 * Hver request rendres som et "venter på klient"-kort med:
 *  - Status-chip (Venter / Innholdsprodusenten har lest / Klient har svart)
 *  - Når sendt / sist oppdatert
 *  - Ekspandert tråd med meldinger
 *  - Reply-input når status = answered (markedsføreren kan følge opp)
 *  - "Lukk forespørsel"-knapp når den er besvart og handling er gjort
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  SupportAgent as MarketerIcon,
} from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';

interface ClientRequestSummary {
  id: string;
  kind: string;
  title: string;
  contextArea: string;
  contextKey: string | null;
  status: 'pending' | 'in_progress' | 'answered' | 'closed';
  clientEmail: string;
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
  answeredAt: string | null;
}

interface ThreadMessage {
  id: string;
  sender: 'marketer' | 'client' | 'system';
  senderLabel: string | null;
  bodyMarkdown: string;
  createdAt: string;
}

export interface ClientRequestsThreadProps {
  projectId: string;
  /** Filtrer på panel-område (data_sources, brand, kpi_baseline, etc.). */
  contextArea?: string;
  /** Skjul tomme-state hvis det er null (panelet vil rendre noe annet). */
  emptyMode?: 'hide' | 'inline';
  /** Hvor mange requests som vises før "vis alle" — default 5. */
  initialLimit?: number;
}

const STATUS_META: Record<ClientRequestSummary['status'], { label: string; color: string; bg: string }> = {
  pending:     { label: 'Sendt — venter på klient',         color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  in_progress: { label: 'Du purret — venter fortsatt',      color: '#a5b4fc', bg: 'rgba(167,139,250,0.12)' },
  answered:    { label: 'Klient har svart',                 color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  closed:      { label: 'Lukket',                           color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

const ClientRequestsThread: React.FC<ClientRequestsThreadProps> = ({
  projectId,
  contextArea,
  emptyMode = 'inline',
  initialLimit = 5,
}) => {
  const [requests, setRequests] = useState<ClientRequestSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await roleRoomAgentService.listClientRequests(projectId, { contextArea });
      if (!result) {
        setError('Kunne ikke laste klient-forespørsler.');
        return;
      }
      setRequests(result.requests);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, contextArea]);

  useEffect(() => { void load(); }, [load]);

  const handleExpand = useCallback(async (id: string): Promise<void> => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!threadCache[id]) {
      const result = await roleRoomAgentService.fetchClientRequestThread(id);
      if (result) {
        setThreadCache((prev) => ({ ...prev, [id]: result.messages }));
      }
    }
  }, [expanded, threadCache]);

  const handleReply = useCallback(async (id: string): Promise<void> => {
    const draft = (replyDraft[id] || '').trim();
    if (!draft) return;
    setReplying(id);
    try {
      const ok = await roleRoomAgentService.postClientRequestReply(id, draft);
      if (ok) {
        setReplyDraft((prev) => ({ ...prev, [id]: '' }));
        const refreshed = await roleRoomAgentService.fetchClientRequestThread(id);
        if (refreshed) {
          setThreadCache((prev) => ({ ...prev, [id]: refreshed.messages }));
        }
        await load();
      } else {
        setError('Svar kunne ikke sendes.');
      }
    } finally {
      setReplying(null);
    }
  }, [replyDraft, load]);

  const handleClose = useCallback(async (id: string): Promise<void> => {
    const ok = await roleRoomAgentService.closeClientRequest(id);
    if (ok) await load();
  }, [load]);

  const visible = useMemo(() => (
    showAll ? requests : requests.slice(0, initialLimit)
  ), [requests, showAll, initialLimit]);

  if (loading && requests.length === 0) {
    return (
      <Stack alignItems="center" sx={{ py: 2 }}>
        <CircularProgress size={20} sx={{ color: '#22d3ee' }} />
      </Stack>
    );
  }

  if (requests.length === 0) {
    if (emptyMode === 'hide') return null;
    return (
      <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem', py: 1 }}>
        Ingen klient-forespørsler ennå{contextArea ? ` for ${contextArea}` : ''}.
      </Typography>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
            Klient-korrespondanse
          </Typography>
          {pendingCount > 0 ? (
            <Chip
              size="small"
              label={`${pendingCount} venter`}
              sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, height: 22 }}
            />
          ) : null}
        </Stack>
        <IconButton size="small" onClick={() => void load()} sx={{ color: '#94a3b8' }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 1, bgcolor: 'rgba(251,191,36,0.1)' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Stack spacing={0.8}>
        {visible.map((req) => {
          const meta = STATUS_META[req.status];
          const isOpen = expanded === req.id;
          const messages = threadCache[req.id] ?? [];
          return (
            <Box
              key={req.id}
              sx={{
                border: '1px solid rgba(148,163,184,0.18)',
                borderLeft: `3px solid ${meta.color}`,
                borderRadius: 1,
                bgcolor: 'rgba(15,23,42,0.4)',
                p: 1.2,
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
                    <Chip
                      size="small"
                      label={meta.label}
                      sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, height: 20, fontSize: '0.7rem' }}
                    />
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(226,232,240,0.5)' }}>
                      {req.clientName ?? req.clientEmail} · sendt {formatRelative(req.createdAt)}
                    </Typography>
                  </Stack>
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.86rem', fontWeight: 600 }}>
                    {req.title}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => void handleExpand(req.id)} sx={{ color: '#cbd5e1' }}>
                  {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Stack>

              <Collapse in={isOpen} timeout="auto">
                <Box sx={{ mt: 1.2 }}>
                  {messages.length === 0 ? (
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.5)' }}>
                      Ingen meldinger ennå.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {messages.map((m) => {
                        const isClient = m.sender === 'client';
                        return (
                          <Stack
                            key={m.id}
                            direction="row"
                            spacing={1}
                            sx={{
                              p: 1,
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
                                {m.senderLabel ?? (isClient ? 'Klient' : 'Markedsfører')} · {formatRelative(m.createdAt)}
                              </Typography>
                              <Typography
                                component="pre"
                                sx={{
                                  fontSize: '0.82rem',
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
                  )}

                  {req.status !== 'closed' ? (
                    <Stack spacing={0.8} sx={{ mt: 1.4 }}>
                      <TextField
                        value={replyDraft[req.id] ?? ''}
                        onChange={(e) => setReplyDraft((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder={req.status === 'answered'
                          ? 'Følg opp svaret — eller takk klienten…'
                          : 'Send en purring eller utdypning…'}
                        multiline
                        minRows={2}
                        fullWidth
                        size="small"
                        sx={{
                          '& .MuiInputBase-input': { color: '#f8fafc', fontSize: '0.84rem' },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.25)' },
                        }}
                      />
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {req.status === 'answered' ? (
                          <Button
                            size="small"
                            startIcon={<CheckIcon />}
                            onClick={() => void handleClose(req.id)}
                            sx={{ textTransform: 'none', color: '#94a3b8' }}
                          >
                            Marker som ferdig
                          </Button>
                        ) : null}
                        <Button
                          size="small"
                          variant="contained"
                          disabled={replying === req.id || !(replyDraft[req.id] ?? '').trim()}
                          onClick={() => void handleReply(req.id)}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#22d3ee',
                            color: '#0b1226',
                            fontWeight: 700,
                            '&:hover': { bgcolor: '#06b6d4' },
                          }}
                        >
                          {replying === req.id ? 'Sender…' : 'Send melding'}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : null}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>

      {requests.length > initialLimit && !showAll ? (
        <Button
          size="small"
          onClick={() => setShowAll(true)}
          sx={{ mt: 0.8, textTransform: 'none', color: '#94a3b8' }}
        >
          Vis alle ({requests.length})
        </Button>
      ) : null}
    </Box>
  );
};

function formatRelative(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return isoDate;
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'nå';
  if (min < 60) return `${min} min siden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d siden`;
  return new Date(isoDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default ClientRequestsThread;
