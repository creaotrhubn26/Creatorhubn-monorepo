/**
 * TeamchatTab — «Teamchat»-flaten i AdminWorkspace.
 *
 * Var en EmptyState + en `disabled` composer, fordi det bare fantes
 * chat PER PROSJEKT (/api/role-room/projects/:projectId/messages).
 * Migrasjon 0350 innførte workspace-brede kanaler og meldinger, og
 * admin-workspace-collab-routes.ts eksponerer dem — så composeren er
 * ekte nå.
 *
 * Samme komponent brukes både som hovedflate og som den smale
 * høyre-kolonnen (`compact`), slik at det ikke finnes to
 * chat-implementasjoner som kan drive fra hverandre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import AddIcon from '@mui/icons-material/Add';
import TagIcon from '@mui/icons-material/Tag';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';

import {
  workspaceCollabApi,
  type WorkspaceChannel,
  type WorkspaceMessage,
} from '../../services/adminRoomApi';
import { BRAND } from './brand';
import { PanelError, PanelLoading } from './panelKit';

const POLL_MS = 20_000;

interface TeamchatTabProps {
  /** Smal variant for høyre kolonne — kanal-listen blir en enkel velger. */
  compact?: boolean;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Intl.DateTimeFormat('sv-SE').format(new Date());
  const day = new Intl.DateTimeFormat('sv-SE').format(d);
  return day === today
    ? new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' }).format(d)
    : new Intl.DateTimeFormat('nb-NO', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
}

export function TeamchatTab({ compact = false }: TeamchatTabProps) {
  const [channels, setChannels] = useState<WorkspaceChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Kanaler. Backend oppretter «Generelt» ved første kall, så listen er
  // aldri tom — du møter aldri en chat uten et sted å skrive.
  const loadChannels = useCallback(async () => {
    try {
      const items = await workspaceCollabApi.channels();
      setChannels(items);
      setActiveChannelId((current) => current ?? items[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste kanaler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const loadMessages = useCallback(async (channelId: string, showSpinner: boolean) => {
    if (showSpinner) setMessagesLoading(true);
    try {
      const items = await workspaceCollabApi.messages(channelId);
      setMessages(items);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke laste meldinger');
    } finally {
      if (showSpinner) setMessagesLoading(false);
    }
  }, []);

  // Poll så en åpen fane holder seg fersk uten manuell refresh.
  useEffect(() => {
    if (!activeChannelId) return;
    let cancelled = false;
    void loadMessages(activeChannelId, true);
    const timer = setInterval(() => {
      if (!cancelled) void loadMessages(activeChannelId, false);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !activeChannelId || sending) return;
    setSending(true);
    try {
      const created = await workspaceCollabApi.sendMessage(activeChannelId, body);
      setMessages((prev) => [...prev, created]);
      setDraft('');
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke sende meldingen');
    } finally {
      setSending(false);
    }
  }, [draft, activeChannelId, sending]);

  const handleDelete = useCallback(async (id: string) => {
    const previous = messages;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await workspaceCollabApi.deleteMessage(id);
    } catch (err) {
      setMessages(previous);
      setError((err as Error).message || 'Kunne ikke slette meldingen');
    }
  }, [messages]);

  const handleCreateChannel = useCallback(async () => {
    const name = newChannelName.trim();
    if (!name) return;
    try {
      const created = await workspaceCollabApi.createChannel({ name });
      setChannels((prev) => [...prev, created]);
      setActiveChannelId(created.id);
      setCreateOpen(false);
      setNewChannelName('');
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke opprette kanalen');
    }
  }, [newChannelName]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? null,
    [channels, activeChannelId],
  );

  if (loading) return <PanelLoading />;

  const composer = (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-end"
      sx={{
        px: compact ? 1.5 : 0,
        py: compact ? 1.25 : 0,
        pt: compact ? 1.25 : 1.5,
        borderTop: compact ? `1px solid ${BRAND.border}` : 'none',
        bgcolor: compact ? 'rgba(11,5,24,0.5)' : 'transparent',
      }}
    >
      <InputBase
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter sender, Shift+Enter gir ny linje.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        placeholder={activeChannel ? `Skriv i ${activeChannel.name}…` : 'Skriv en melding…'}
        multiline
        maxRows={5}
        disabled={!activeChannelId || sending}
        inputProps={{ 'aria-label': 'Skriv en melding' }}
        sx={{
          flex: 1,
          color: BRAND.text,
          fontSize: '0.86rem',
          bgcolor: 'rgba(167, 139, 250, 0.06)',
          border: `1px solid ${BRAND.border}`,
          borderRadius: 1.5,
          px: 1.25,
          py: 0.75,
          '& textarea::placeholder': { color: BRAND.textDim, opacity: 1 },
        }}
      />
      <IconButton
        size="small"
        onClick={() => void handleSend()}
        disabled={!draft.trim() || !activeChannelId || sending}
        aria-label="Send melding"
        sx={{ color: BRAND.accent }}
      >
        {sending ? <CircularProgress size={16} sx={{ color: BRAND.accent }} /> : <SendOutlinedIcon fontSize="small" />}
      </IconButton>
    </Stack>
  );

  const messageList = (
    <Stack spacing={1.25} sx={{ flex: 1, overflowY: 'auto', px: compact ? 1.5 : 0, py: 1 }}>
      {messagesLoading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={20} sx={{ color: BRAND.accent }} />
        </Stack>
      ) : messages.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: compact ? 4 : 8, textAlign: 'center', px: 2 }}>
          <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 32, color: BRAND.accent, opacity: 0.5 }} />
          <Typography sx={{ color: BRAND.textMuted, fontSize: '0.82rem' }}>
            Ingen meldinger i {activeChannel?.name ?? 'kanalen'} ennå. Skriv den første.
          </Typography>
        </Stack>
      ) : (
        messages.map((m) => (
          <Stack
            key={m.id}
            spacing={0.25}
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: BRAND.panelBg,
              border: `1px solid ${BRAND.border}`,
              '&:hover .msg-actions': { opacity: 1 },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ color: BRAND.accent, fontWeight: 700, fontSize: '0.76rem' }}>
                {m.authorName ?? 'Ukjent'}
              </Typography>
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.7rem' }}>
                {formatMessageTime(m.createdAt)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              {m.isMine ? (
                <Box className="msg-actions" sx={{ opacity: 0, transition: 'opacity 120ms' }}>
                  <Tooltip title="Slett melding">
                    <IconButton
                      size="small"
                      onClick={() => void handleDelete(m.id)}
                      aria-label="Slett melding"
                      sx={{ color: BRAND.textDim, p: 0.25 }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ) : null}
            </Stack>
            <Typography
              sx={{
                color: BRAND.text,
                fontSize: '0.86rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.body}
            </Typography>
          </Stack>
        ))
      )}
      <div ref={bottomRef} />
    </Stack>
  );

  // ── Kompakt (høyre kolonne) ──
  if (compact) {
    return (
      <Stack sx={{ height: '100%', minHeight: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.border}`, overflowX: 'auto' }}
        >
          {channels.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              size="small"
              onClick={() => setActiveChannelId(c.id)}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                cursor: 'pointer',
                bgcolor: c.id === activeChannelId ? BRAND.selectedBg : 'transparent',
                color: c.id === activeChannelId ? BRAND.text : BRAND.textDim,
                border: `1px solid ${c.id === activeChannelId ? BRAND.borderHover : BRAND.border}`,
              }}
            />
          ))}
        </Stack>
        {error ? (
          <Box sx={{ px: 1.5, pt: 1 }}>
            <PanelError message={error} onClose={() => setError(null)} />
          </Box>
        ) : null}
        {messageList}
        {composer}
      </Stack>
    );
  }

  // ── Full flate ──
  return (
    <Stack direction="row" spacing={2} sx={{ height: 'calc(100vh - 200px)', minHeight: 420 }}>
      {/* Kanaler */}
      <Stack
        spacing={0.5}
        sx={{
          width: 220,
          flexShrink: 0,
          p: 1,
          borderRadius: 2,
          bgcolor: BRAND.panelBg,
          border: `1px solid ${BRAND.border}`,
          overflowY: 'auto',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, py: 0.5 }}>
          <Typography
            sx={{
              color: BRAND.textDim,
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Kanaler
          </Typography>
          <Tooltip title="Ny kanal">
            <IconButton size="small" onClick={() => setCreateOpen(true)} sx={{ color: BRAND.accent, p: 0.25 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        {channels.map((c) => (
          <Stack
            key={c.id}
            direction="row"
            alignItems="center"
            spacing={0.75}
            onClick={() => setActiveChannelId(c.id)}
            sx={{
              px: 1,
              py: 0.75,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: c.id === activeChannelId ? BRAND.selectedBg : 'transparent',
              color: c.id === activeChannelId ? BRAND.text : BRAND.textMuted,
              '&:hover': { bgcolor: c.id === activeChannelId ? BRAND.selectedBg : BRAND.hoverBg },
            }}
          >
            <TagIcon sx={{ fontSize: 15, color: BRAND.textDim }} />
            <Typography
              sx={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.84rem',
                fontWeight: c.id === activeChannelId ? 700 : 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {c.name}
            </Typography>
            {c.messageCount > 0 ? (
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.7rem' }}>{c.messageCount}</Typography>
            ) : null}
          </Stack>
        ))}
      </Stack>

      {/* Meldinger */}
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        {activeChannel ? (
          <Stack sx={{ pb: 1, borderBottom: `1px solid ${BRAND.border}` }}>
            <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem' }}>
              #{activeChannel.name}
            </Typography>
            {activeChannel.description ? (
              <Typography sx={{ color: BRAND.textDim, fontSize: '0.78rem' }}>
                {activeChannel.description}
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        {error ? (
          <Box sx={{ pt: 1 }}>
            <PanelError message={error} onClose={() => setError(null)} />
          </Box>
        ) : null}

        {messageList}
        {composer}
      </Stack>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { bgcolor: '#150a29', backgroundImage: 'none' } } }}
      >
        <DialogTitle sx={{ color: BRAND.text }}>Ny kanal</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Navn"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreateChannel();
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: BRAND.textMuted }}>
            Avbryt
          </Button>
          <Button
            onClick={() => void handleCreateChannel()}
            disabled={!newChannelName.trim()}
            variant="contained"
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default TeamchatTab;
