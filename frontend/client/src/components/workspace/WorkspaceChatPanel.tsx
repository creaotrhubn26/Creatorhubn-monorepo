// @ts-nocheck
/**
 * WorkspaceChatPanel — Team Chat (høyre panel), dark CreatorHub.
 *
 * GJENBRUKER den eksisterende kanal-chatten i communication-routes.ts:
 *   - kanal-id = `project-<projectId>` (communication_channels.id tar vilkårlig streng)
 *   - GET  /api/communication/messages/project-<id>
 *   - POST /api/chat/messages { conversationId, content, senderId }
 * Ingen ny meldings-tabell. Lett poll (15s, pauset når fanen er skjult).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, Avatar, IconButton, TextField, CircularProgress, Button, Chip } from '@mui/material';
import Search from '@mui/icons-material/Search';
import PeopleAlt from '@mui/icons-material/PeopleAlt';
import MoreVert from '@mui/icons-material/MoreVert';
import PushPin from '@mui/icons-material/PushPin';
import Send from '@mui/icons-material/Send';
import AttachFile from '@mui/icons-material/AttachFile';
import AlternateEmail from '@mui/icons-material/AlternateEmail';
import EmojiEmotions from '@mui/icons-material/EmojiEmotions';
import TipsAndUpdates from '@mui/icons-material/TipsAndUpdates';
import HelpOutline from '@mui/icons-material/HelpOutline';
import PriorityHigh from '@mui/icons-material/PriorityHigh';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ws } from './workspaceTheme';

const initials = (s) => String(s || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

const WorkspaceChatPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { user } = useAuth();
  const channelId = `project-${projectId}`;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const myId = user?.email || user?.id || 'me';

  const scrollDown = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));

  const load = async (initial = false) => {
    try {
      const r = await apiRequest(`/api/communication/messages/${encodeURIComponent(channelId)}?limit=100`);
      const next = Array.isArray(r?.messages) ? r.messages : [];
      setMessages((prev) => { if (initial || next.length !== prev.length) scrollDown(); return next; });
    } catch { /* sekundær */ } finally { if (initial) setLoading(false); }
  };

  useEffect(() => {
    load(true);
    const t = setInterval(() => { if (!document.hidden) load(false); }, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await apiRequest('/api/chat/messages', {
        method: 'POST',
        body: { conversationId: channelId, content, senderId: myId, senderName: user?.firstName || user?.name || myId },
      });
      setText('');
      await load(false);
      scrollDown();
    } catch (e) { window.alert(e?.message || 'Kunne ikke sende'); } finally { setSending(false); }
  };

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, overflow: 'hidden',
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${ws.border}` }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ws.green }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Team Chat</Typography>
        </Stack>
        <Stack direction="row" spacing={0.25}>
          <IconButton size="small" sx={{ color: ws.textDim }}><Search fontSize="small" /></IconButton>
          <IconButton size="small" sx={{ color: ws.textDim }}><PeopleAlt fontSize="small" /></IconButton>
          <IconButton size="small" sx={{ color: ws.textDim }}><MoreVert fontSize="small" /></IconButton>
        </Stack>
      </Stack>

      {/* Kanal-velger */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1 }}>
        <Chip size="small" label="# Produksjon" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: ws.text, fontWeight: 600 }} />
        <IconButton size="small" sx={{ color: ws.textDim }}><PushPin sx={{ fontSize: 16 }} /></IconButton>
      </Stack>

      {/* Meldinger */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} /></Box>
        ) : messages.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: ws.textDim, textAlign: 'center', py: 4 }}>
            Ingen meldinger ennå. Skriv den første for å samkjøre teamet 👋
          </Typography>
        ) : messages.map((m) => {
          const mine = String(m.senderId || '') === String(myId);
          return (
            <Stack key={m.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Avatar sx={{ width: 30, height: 30, fontSize: 12, bgcolor: mine ? ws.accent : 'rgba(255,255,255,0.12)', color: mine ? ws.accentContrast : ws.text }}>
                {initials(m.senderName || m.senderId)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{m.senderName || m.senderId}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                </Stack>
                <Box sx={{ mt: 0.25, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', display: 'inline-block' }}>
                  <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</Typography>
                </Box>
              </Box>
            </Stack>
          );
        })}
        <div ref={endRef} />
      </Box>

      {/* Komponist */}
      <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${ws.border}` }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth size="small" multiline maxRows={4} placeholder="Skriv melding til teamet…"
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }}
          />
          <IconButton onClick={send} disabled={sending || !text.trim()}
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
            {sending ? <CircularProgress size={18} /> : <Send fontSize="small" />}
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} justifyContent="space-between">
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" sx={{ color: ws.textDim }}><AttachFile sx={{ fontSize: 17 }} /></IconButton>
            <IconButton size="small" sx={{ color: ws.textDim }}><AlternateEmail sx={{ fontSize: 17 }} /></IconButton>
            <IconButton size="small" sx={{ color: ws.textDim }}><EmojiEmotions sx={{ fontSize: 17 }} /></IconButton>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Chip size="small" icon={<TipsAndUpdates sx={{ fontSize: 14 }} />} label="Oppdatering" variant="outlined" sx={{ color: ws.textDim, borderColor: ws.border }} />
            <Chip size="small" icon={<HelpOutline sx={{ fontSize: 14 }} />} label="Spørsmål" variant="outlined" sx={{ color: ws.textDim, borderColor: ws.border }} />
            <Chip size="small" icon={<PriorityHigh sx={{ fontSize: 14 }} />} label="Viktig" variant="outlined" sx={{ color: ws.red, borderColor: ws.redSoft }} />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default WorkspaceChatPanel;
