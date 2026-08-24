/**
 * ClientSharedChat — kundens flate for «Delt»-rommet i Team Chat.
 *
 * Flytende chat-boble nede til høyre i klient-galleriet. Leser/skriver via
 * de token-autentiserte endepunktene GET/POST
 * /api/client/gallery/:accessToken/chat — backend serverer KUN meldinger
 * med visibility='shared', så interne team-meldinger kan aldri nå hit.
 * Poll: 20 s åpen / 60 s lukket (for uleste-badge, localStorage per token).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, IconButton, TextField, Badge, CircularProgress, Paper } from '@mui/material';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import Close from '@mui/icons-material/Close';
import Send from '@mui/icons-material/Send';

type Msg = { id: string; senderName: string; fromClient: boolean; content: string; timestamp: string };

const ClientSharedChat: React.FC<{
  accessToken: string;
  clientName?: string | null;
  primaryColor?: string;
  passwordHeaders?: Record<string, string>;
}> = ({ accessToken, clientName, primaryColor = '#ff8c00', passwordHeaders }) => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [unread, setUnread] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const lastSeenKey = `client-chat-seen-${accessToken}`;

  const load = async () => {
    try {
      const r = await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/chat`, {
        headers: { ...(passwordHeaders || {}) },
      });
      if (!r.ok) return;
      const d = await r.json();
      const next: Msg[] = Array.isArray(d?.messages) ? d.messages : [];
      setMsgs(next);
      const lastSeen = (() => { try { return new Date(localStorage.getItem(lastSeenKey) || 0).getTime(); } catch { return 0; } })();
      const fresh = next.filter((m) => !m.fromClient && new Date(m.timestamp).getTime() > lastSeen).length;
      if (openRef.current) {
        markSeen(next);
        setUnread(0);
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'auto' }));
      } else {
        setUnread(fresh);
      }
    } catch { /* stille */ }
  };
  const markSeen = (list: Msg[]) => {
    try { const last = list.length ? list[list.length - 1].timestamp : null; if (last) localStorage.setItem(lastSeenKey, String(last)); } catch { /* */ }
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => { if (!document.hidden) load(); }, open ? 20000 : 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, open]);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/client/gallery/${encodeURIComponent(accessToken)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(passwordHeaders || {}) },
        body: JSON.stringify({ message, clientName: clientName || undefined }),
      });
      if (!r.ok) { setErr('Kunne ikke sende — prøv igjen.'); return; }
      setText('');
      await load();
    } catch { setErr('Kunne ikke sende — prøv igjen.'); } finally { setBusy(false); }
  };

  return (
    <>
      {open && (
        <Paper elevation={8} sx={{
          position: 'fixed', bottom: 88, right: 20, zIndex: 1300,
          width: { xs: 'calc(100vw - 32px)', sm: 330 }, height: 420,
          display: 'flex', flexDirection: 'column', borderRadius: 3,
          bgcolor: '#101828', color: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Meldinger fra teamet</Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}><Close sx={{ fontSize: 17 }} /></IconButton>
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {msgs === null ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={18} /></Box>
            ) : msgs.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 4 }}>
                Ingen meldinger ennå. Skriv til teamet under 👋
              </Typography>
            ) : msgs.map((m) => (
              <Box key={m.id} sx={{ alignSelf: m.fromClient ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', mb: 0.25, textAlign: m.fromClient ? 'right' : 'left' }}>
                  {m.fromClient ? 'Deg' : m.senderName} · {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : ''}
                </Typography>
                <Box sx={{
                  px: 1.25, py: 0.75, borderRadius: 2, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  bgcolor: m.fromClient ? primaryColor : 'rgba(255,255,255,0.07)',
                  color: m.fromClient ? '#fff' : 'rgba(255,255,255,0.92)',
                }}>{m.content}</Box>
              </Box>
            ))}
            <div ref={endRef} />
          </Box>
          <Box sx={{ px: 1.25, py: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {err && <Typography sx={{ fontSize: 11, color: '#f87171', mb: 0.5 }}>{err}</Typography>}
            <Stack direction="row" spacing={0.75} alignItems="flex-end">
              <TextField
                fullWidth size="small" multiline maxRows={3} placeholder="Skriv en melding …"
                value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13 } }}
              />
              <IconButton onClick={send} disabled={busy || !text.trim()} sx={{ bgcolor: primaryColor, color: '#fff', '&:hover': { bgcolor: primaryColor }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                {busy ? <CircularProgress size={16} /> : <Send sx={{ fontSize: 17 }} />}
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      )}
      <IconButton
        aria-label="Meldinger fra teamet"
        onClick={() => { setOpen((v) => { const nv = !v; if (nv && msgs) { markSeen(msgs); setUnread(0); } return nv; }); }}
        sx={{
          position: 'fixed', bottom: 24, right: 20, zIndex: 1300, width: 52, height: 52,
          bgcolor: primaryColor, color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: primaryColor, filter: 'brightness(1.08)' },
        }}
      >
        <Badge badgeContent={unread} color="error" overlap="circular">
          {open ? <Close /> : <ChatBubbleOutline />}
        </Badge>
      </IconButton>
    </>
  );
};

export default ClientSharedChat;
