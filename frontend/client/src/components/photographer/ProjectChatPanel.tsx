// Slice 9X.18 — chat-panel med Gmail under. Stine sender melding via
// bobler-UI, backend sender Gmail med riktig threading-headers slik at
// klientens svar går i samme tråd (i klientens innboks). Pollet hver 15s
// for innkommende svar (etter Gmail-poller er bygget) eller manuelt
// refresh.

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Paper, Stack, Typography, TextField, IconButton, Chip, Avatar,
  Drawer, Divider, Alert, CircularProgress, Button, Tooltip,
} from '@mui/material';
import {
  Send, Close, Chat as ChatIcon, Email, Refresh,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  id: string;
  type: string;
  direction: 'inbound' | 'outbound' | 'internal';
  content: string;
  fromEmail: string | null;
  toEmail: string | null;
  messageId: string | null;
  threadId: string | null;
  status: string;
  createdAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('nb-NO', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

interface ProjectChatPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  clientName: string | null;
  clientEmail: string | null;
}

export function ProjectChatPanel({ open, onClose, projectId, clientName, clientEmail }: ProjectChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<{ messages: ChatMessage[] }>({
    queryKey: [`/api/photographer/projects/${projectId}/messages`],
    queryFn: () => apiRequest(`/api/photographer/projects/${projectId}/messages`),
    enabled: !!projectId && open,
    refetchInterval: open ? 30000 : false,
  });

  const refresh = useMutation<
    { status: string; newRepliesCount: number; message?: string },
    Error,
    void
  >({
    mutationFn: () => apiRequest(`/api/photographer/projects/${projectId}/messages/refresh`, {
      method: 'POST',
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}/messages`] });
      if (result.status === 'no_scope' || result.status === 'no_credentials') {
        setSendError(result.message ?? 'Google Workspace ikke koblet med gmail.readonly-tilgang.');
      } else if (result.status === 'failed') {
        setSendError(result.message ?? 'Refresh feilet — prøv igjen.');
      } else if (result.newRepliesCount === 0) {
        setSendError(null);
      } else {
        setSendError(null);
      }
    },
  });

  const send = useMutation<
    { emailSent: boolean; emailError: string | null },
    Error,
    string
  >({
    mutationFn: (content) => apiRequest(`/api/photographer/projects/${projectId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      headers: { 'Content-Type': 'application/json' },
    }),
    onSuccess: (result) => {
      setDraft('');
      setSendError(null);
      qc.invalidateQueries({ queryKey: [`/api/photographer/projects/${projectId}/messages`] });
      if (!result.emailSent) {
        setSendError(`Meldingen er lagret, men epost ble ikke sendt: ${result.emailError ?? 'ukjent'}`);
      }
    },
    onError: (err: any) => {
      let msg = String(err?.message || 'Ukjent feil');
      try { const p = JSON.parse(msg); msg = p.message || p.error || msg; } catch { /* */ }
      setSendError(msg);
    },
  });

  const messages = data?.messages ?? [];

  // Scroll to bottom på ny melding
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    send.mutate(text);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <ChatIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Chat med {clientName ?? 'klient'}
          </Typography>
          {clientEmail && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Email sx={{ fontSize: 12 }} /> Sendes som Gmail til {clientEmail}
            </Typography>
          )}
        </Box>
        <Tooltip title="Sjekk Gmail for nye svar">
          <span>
            <IconButton
              size="small"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              {refresh.isPending
                ? <CircularProgress size={16} />
                : <Refresh fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Stack>

      {!clientEmail && (
        <Alert severity="warning" sx={{ m: 2 }}>
          Klienten må ha epost-adresse for at chat skal kunne sende. Legg til på CRM-siden.
        </Alert>
      )}

      {refresh.isSuccess && refresh.data && refresh.data.newRepliesCount > 0 && (
        <Alert severity="success" sx={{ mx: 2, mt: 2 }} onClose={() => refresh.reset()}>
          {refresh.data.newRepliesCount} nytt svar fra klient hentet inn.
        </Alert>
      )}

      {/* Messages */}
      <Box sx={{
        flexGrow: 1, overflowY: 'auto', p: 2,
        display: 'flex', flexDirection: 'column', gap: 1.5,
        bgcolor: 'background.default',
      }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {!isLoading && messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <ChatIcon sx={{ fontSize: 48, color: 'action.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Ingen meldinger ennå. Start samtalen under.
            </Typography>
          </Box>
        )}
        {messages.map((m) => {
          const isOutbound = m.direction === 'outbound';
          return (
            <Stack
              key={m.id}
              direction={isOutbound ? 'row-reverse' : 'row'}
              spacing={1}
              alignItems="flex-end"
              sx={{ maxWidth: '100%' }}
            >
              <Avatar sx={{
                width: 28, height: 28, fontSize: 12,
                bgcolor: isOutbound ? 'primary.main' : 'grey.400',
              }}>
                {isOutbound ? 'S' : (clientName?.[0]?.toUpperCase() ?? 'K')}
              </Avatar>
              <Box sx={{ maxWidth: '75%' }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: isOutbound ? 'primary.main' : 'background.paper',
                    color: isOutbound ? 'primary.contrastText' : 'text.primary',
                    borderRadius: isOutbound ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    border: isOutbound ? 'none' : 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {m.content}
                  </Typography>
                </Paper>
                <Stack direction="row" spacing={0.5} sx={{
                  mt: 0.5,
                  justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(m.createdAt)}
                  </Typography>
                  {m.type === 'email' && (
                    <Chip size="small" label="epost" variant="outlined"
                      sx={{ height: 16, fontSize: 10 }} icon={<Email sx={{ fontSize: 10 }} />} />
                  )}
                  {isOutbound && m.status === 'sent' && (
                    <Typography variant="caption" color="text.secondary">·</Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Divider />
      <Box sx={{ p: 2 }}>
        {sendError && (
          <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setSendError(null)}>
            {sendError}
          </Alert>
        )}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder={clientEmail
              ? `Send melding til ${clientName ?? 'klient'} — sendes som epost`
              : 'Klient mangler epost'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!clientEmail || send.isPending}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!draft.trim() || !clientEmail || send.isPending}
            sx={{ p: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabled', color: 'action.disabled' } }}
          >
            {send.isPending ? <CircularProgress size={20} color="inherit" /> : <Send fontSize="small" />}
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Enter for å sende · Shift+Enter for linjeskift
        </Typography>
      </Box>
    </Drawer>
  );
}
