// @ts-nocheck
/**
 * WorkspaceChatPanel — Team Chat (høyre panel), dark CreatorHub.
 *
 * GJENBRUKER den eksisterende kanal-chatten i communication-routes.ts:
 *   - kanal-id = `project-<projectId>` (communication_channels.id tar vilkårlig streng)
 *   - GET  /api/communication/messages/project-<id>  → { messages: [{ id, senderId, senderName, content, timestamp, attachments, tag }] }
 *   - POST /api/chat/messages { conversationId, content, senderId, senderName, metadata:{senderName,tag}, attachments }
 * senderName + tag lagres i metadata (kolonnen har ikke egne felter) og eksponeres av GET.
 * Vedlegg lastes opp via /api/upload/image (same-origin B2). Lett poll (15s, pauset når skjult).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography, Avatar, IconButton, TextField, CircularProgress, Chip, Popover, Menu, MenuItem, Tooltip, InputAdornment } from '@mui/material';
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
import Close from '@mui/icons-material/Close';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Refresh from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { apiRequest, getAuthHeader, buildApiUrl } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ws } from './workspaceTheme';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from './wsLocale';

// Lokal no/en-ordbok for panelet (samme mønster som OppdragTab).
const T: WsDict = {
  channelProduction: { no: '# Produksjon', en: '# Production' },
  emptyChat: { no: 'Ingen meldinger ennå. Skriv den første for å samkjøre teamet 👋', en: 'No messages yet. Write the first one to get the team in sync 👋' },
  sendFailed: { no: 'Kunne ikke sende meldingen. Prøv igjen.', en: 'Could not send the message. Try again.' },
  uploadFailed: { no: 'Kunne ikke laste opp vedlegget.', en: 'Could not upload the attachment.' },
  composerPlaceholder: { no: 'Skriv melding til teamet…', en: 'Write a message to the team…' },
  chipUpdate: { no: 'Oppdatering', en: 'Update' },
  chipQuestion: { no: 'Spørsmål', en: 'Question' },
  chipImportant: { no: 'Viktig', en: 'Important' },
  search: { no: 'Søk i meldinger', en: 'Search messages' },
  searchPlaceholder: { no: 'Søk…', en: 'Search…' },
  noMatches: { no: 'Ingen meldinger matcher søket.', en: 'No messages match your search.' },
  members: { no: 'Deltakere', en: 'Participants' },
  emoji: { no: 'Sett inn emoji', en: 'Insert emoji' },
  mention: { no: 'Nevn noen', en: 'Mention someone' },
  attach: { no: 'Legg ved bilde', en: 'Attach image' },
  moreActions: { no: 'Flere valg', en: 'More options' },
  jumpToLatest: { no: 'Hopp til nyeste', en: 'Jump to latest' },
  refresh: { no: 'Oppdater', en: 'Refresh' },
  guide: { no: 'Hjelp / guide', en: 'Help / guide' },
  pinFilterOn: { no: 'Vis kun viktige', en: 'Show important only' },
  pinFilterOff: { no: 'Vis alle meldinger', en: 'Show all messages' },
  send: { no: 'Send melding', en: 'Send message' },
  removeAttachment: { no: 'Fjern vedlegg', en: 'Remove attachment' },
  clearTag: { no: 'Fjern merkelapp', en: 'Clear tag' },
  clearSearch: { no: 'Tøm søket', en: 'Clear search' },
  you: { no: 'Deg', en: 'You' },
  title: { no: 'Team Chat', en: 'Team Chat' },
  attachmentFallback: { no: 'vedlegg', en: 'attachment' },
  emojiPrefix: { no: 'Emoji', en: 'Emoji' },
  messagesRegion: { no: 'Meldinger', en: 'Messages' },
};

// Trygg å rendre som <img>/<a href>? Tillat kun same-origin relativ sti (våre
// opplastinger → /api/showcase-media/…) og inline data:image (ingen nettverk/
// skript). Blokker eksterne http(s) (sporing), javascript:/vbscript: (XSS) og
// data:text/html. Alt annet vises som ren tekst.
const isSafeMediaUrl = (u) => {
  if (typeof u !== 'string' || !u) return false;
  if (/^\s*(javascript|vbscript):/i.test(u)) return false;
  if (/^data:image\//i.test(u)) return true;
  if (/^\s*data:/i.test(u)) return false;
  return /^\/[^/]/.test(u) && !/[\s<>"'\\]/.test(u);
};
// Maskér e-post i visningsnavn-fallback (viser ikke kollegers adresse i klartekst).
const maskId = (s) => { const v = String(s || ''); const at = v.indexOf('@'); return at > 0 ? `${v.slice(0, at)}` : v; };

const EMOJIS = ['👍', '🙌', '🎧', '🎤', '🔥', '✅', '❤️', '😄', '🎸', '🥁', '🎹', '🎶', '👏', '🙏', '💡', '⏱️', '📌', '⚡'];

const initials = (s) => String(s || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

const TAG_META = {
  update: { icon: <TipsAndUpdates sx={{ fontSize: 14 }} />, dictKey: 'chipUpdate', color: ws.accent, soft: ws.accentSoft, border: ws.accentBorder },
  question: { icon: <HelpOutline sx={{ fontSize: 14 }} />, dictKey: 'chipQuestion', color: ws.green, soft: ws.greenSoft, border: 'rgba(52,211,153,0.42)' },
  important: { icon: <PriorityHigh sx={{ fontSize: 14 }} />, dictKey: 'chipImportant', color: ws.red, soft: ws.redSoft, border: 'rgba(248,113,113,0.42)' },
};

const WorkspaceChatPanel: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { user } = useAuth();
  // Utenlandske partner-vendors får engelsk UI — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const channelId = `project-${projectId}`;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const myId = user?.email || user?.id || 'me';
  const myName = user?.firstName || user?.name || myId;

  // Interaktiv tilstand for de utbygde knappene.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [tag, setTag] = useState(null); // merkelapp for neste melding
  const [pending, setPending] = useState([]); // vedlegg som venter på å sendes
  const [uploading, setUploading] = useState(false);
  const [membersAnchor, setMembersAnchor] = useState(null);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [mentionMode, setMentionMode] = useState(false); // members-popover brukes til @mention

  const scrollDown = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }));
  // Er brukeren allerede nederst? Da (og bare da) auto-scroller vi ved nye
  // meldinger — ellers stjeler pollet leseposisjonen når man leser historikk.
  const atBottom = () => { const el = listRef.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  const load = async (initial = false) => {
    try {
      const r = await apiRequest(`/api/communication/messages/${encodeURIComponent(channelId)}?limit=100`);
      const next = Array.isArray(r?.messages) ? r.messages : [];
      const wasAtBottom = atBottom();
      const lastId = next.length ? next[next.length - 1].id : null;
      setMessages((prev) => {
        const prevLast = prev.length ? prev[prev.length - 1].id : null;
        // Ny melding = siste id endret seg (robust selv når kanalen står på taket).
        if (initial || (lastId !== prevLast && wasAtBottom)) scrollDown();
        return next;
      });
    } catch { /* sekundær */ } finally { if (initial) setLoading(false); }
  };

  useEffect(() => {
    load(true);
    const iv = setInterval(() => { if (!document.hidden) load(false); }, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Deltakere utledes fra avsenderne i kanalen (ingen egen tabell nødvendig).
  const participants = useMemo(() => {
    const seen = new Map();
    for (const m of messages) {
      const id = String(m.senderId || '');
      if (!id || seen.has(id)) continue;
      seen.set(id, { id, name: m.senderName || maskId(id), mine: id === String(myId) });
    }
    if (!seen.has(String(myId))) seen.set(String(myId), { id: String(myId), name: myName, mine: true });
    return [...seen.values()];
  }, [messages, myId, myName]);

  // Synlige meldinger etter søk + viktig-filter.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (pinnedOnly && m.tag !== 'important') return false;
      if (q) {
        const hay = `${m.content || ''} ${m.senderName || m.senderId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages, query, pinnedOnly]);

  const insertAtCursor = (snippet) => {
    const el = inputRef.current;
    setText((prev) => {
      if (!el || el.selectionStart == null) return prev + snippet;
      const s = el.selectionStart, e = el.selectionEnd;
      const nextVal = prev.slice(0, s) + snippet + prev.slice(e);
      requestAnimationFrame(() => { try { el.focus(); const pos = s + snippet.length; el.setSelectionRange(pos, pos); } catch { /* */ } });
      return nextVal;
    });
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const headers = await getAuthHeader(); delete headers['Content-Type'];
      const res = await fetch(buildApiUrl('/api/upload/image'), { method: 'POST', headers, body: fd });
      if (!res.ok) { setErr(t('uploadFailed')); return; }
      const { url } = await res.json();
      if (!url) { setErr(t('uploadFailed')); return; }
      setPending((p) => [...p, { filename: file.name.slice(0, 120) || 'bilde', downloadUrl: url, mimeType: file.type || 'image/*', fileSize: file.size || 1 }]);
    } catch { setErr(t('uploadFailed')); } finally { setUploading(false); }
  };

  const send = async () => {
    const content = text.trim();
    // Ikke send mens en opplasting pågår — ellers ryker vedlegget (pending er
    // fortsatt tomt, og bildet havner på neste melding).
    if ((!content && pending.length === 0) || sending || uploading) return;
    setSending(true); setErr('');
    try {
      await apiRequest('/api/chat/messages', {
        method: 'POST',
        body: {
          conversationId: channelId, content, senderId: myId, senderName: myName,
          metadata: { senderName: myName, ...(tag ? { tag } : {}) },
          ...(pending.length ? { attachments: pending } : {}),
        },
      });
      setText(''); setTag(null); setPending([]);
      await load(false); scrollDown();
    } catch (e) { setErr(e?.message || t('sendFailed')); } finally { setSending(false); }
  };

  const tagBtn = (key) => {
    const meta = TAG_META[key]; const active = tag === key;
    return (
      <Chip key={key} size="small" icon={meta.icon} label={t(meta.dictKey)} onClick={() => setTag(active ? null : key)}
        variant={active ? 'filled' : 'outlined'} aria-pressed={active}
        sx={{ cursor: 'pointer', color: active ? meta.color : ws.textDim, bgcolor: active ? meta.soft : 'transparent', borderColor: active ? meta.border : ws.border, '& .MuiChip-icon': { color: active ? meta.color : ws.textDim } }} />
    );
  };

  const renderAttachments = (atts) => (atts || []).filter((a) => a?.downloadUrl).map((a, i) => {
    const name = a.filename || t('attachmentFallback');
    // Kun same-origin opplastinger rendres som bilde/lenke — eksterne og
    // farlige URL-er (javascript:/data:/tracking-piksler) vises som ren tekst.
    const safe = isSafeMediaUrl(a.downloadUrl);
    const isImg = /^image\//.test(a.mimeType || '') || /\.(png|jpe?g|gif|webp|avif)$/i.test(a.filename || '');
    if (!safe) {
      return <Typography key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 12, color: ws.textDim }}><AttachFile sx={{ fontSize: 14 }} /> {name}</Typography>;
    }
    return isImg ? (
      <Box key={i} component="a" href={a.downloadUrl} target="_blank" rel="noopener" sx={{ display: 'block', mt: 0.5 }}>
        <Box component="img" src={a.downloadUrl} alt={name} loading="lazy" sx={{ maxWidth: 220, maxHeight: 180, borderRadius: 1.5, border: `1px solid ${ws.border}` }} />
      </Box>
    ) : (
      <Box key={i} component="a" href={a.downloadUrl} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 12, color: ws.accent }}>
        <AttachFile sx={{ fontSize: 14 }} /> {name}
      </Box>
    );
  });

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, overflow: 'hidden',
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${ws.border}` }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ws.green }} />
          <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>{t('title')}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={t('search')}><IconButton size="small" aria-label={t('search')} aria-pressed={searchOpen} onClick={() => { setSearchOpen((v) => { if (v) setQuery(''); return !v; }); }} sx={{ color: searchOpen ? ws.accent : ws.textDim }}><Search fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('members')}><IconButton size="small" aria-label={t('members')} onClick={(e) => { setMentionMode(false); setMembersAnchor(e.currentTarget); }} sx={{ color: ws.textDim }}><PeopleAlt fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('moreActions')}><IconButton size="small" aria-label={t('moreActions')} onClick={(e) => setMoreAnchor(e.currentTarget)} sx={{ color: ws.textDim }}><MoreVert fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>

      {/* Søkefelt (utfellbart) */}
      {searchOpen && (
        <Box sx={{ px: 1.75, pt: 1 }}>
          <TextField autoFocus fullWidth size="small" placeholder={t('searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)}
            inputProps={{ 'aria-label': t('search') }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: ws.textFaint }} /></InputAdornment>,
              endAdornment: query ? <InputAdornment position="end"><IconButton size="small" aria-label={t('clearSearch')} onClick={() => setQuery('')} sx={{ color: ws.textDim }}><Close sx={{ fontSize: 15 }} /></IconButton></InputAdornment> : null }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
        </Box>
      )}

      {/* Kanal-velger */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1 }}>
        <Chip size="small" label={t('channelProduction')} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: ws.text, fontWeight: 600 }} />
        <Tooltip title={pinnedOnly ? t('pinFilterOff') : t('pinFilterOn')}>
          <IconButton size="small" aria-label={pinnedOnly ? t('pinFilterOff') : t('pinFilterOn')} aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)} sx={{ color: pinnedOnly ? ws.red : ws.textDim }}><PushPin sx={{ fontSize: 16 }} /></IconButton>
        </Tooltip>
      </Stack>

      {/* Meldinger — role=log + aria-live så skjermlesere fanger innkommende */}
      <Box ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-label={t('messagesRegion')} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} /></Box>
        ) : visible.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: ws.textDim, textAlign: 'center', py: 4 }}>
            {(query || pinnedOnly) ? t('noMatches') : t('emptyChat')}
          </Typography>
        ) : visible.map((m) => {
          const mine = String(m.senderId || '') === String(myId);
          const tagMeta = m.tag && TAG_META[m.tag];
          return (
            <Stack key={m.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexDirection: mine ? 'row-reverse' : 'row' }}>
              <Avatar sx={{ width: 30, height: 30, fontSize: 12, bgcolor: mine ? ws.accent : 'rgba(255,255,255,0.12)', color: mine ? ws.accentContrast : ws.text }}>
                {initials(m.senderName || maskId(m.senderId))}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{mine ? t('you') : (m.senderName || maskId(m.senderId))}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString(wsDateLocale(locale), { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                </Stack>
                {tagMeta && (
                  <Chip size="small" icon={tagMeta.icon} label={t(tagMeta.dictKey)} sx={{ mt: 0.4, height: 18, fontSize: 10, color: tagMeta.color, bgcolor: tagMeta.soft, '& .MuiChip-icon': { color: tagMeta.color } }} />
                )}
                {m.content && (
                  <Box sx={{ mt: 0.25, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: mine ? ws.accentSoft : 'rgba(255,255,255,0.05)', border: mine ? `1px solid ${ws.accentBorder}` : 'none', display: 'inline-block', maxWidth: '100%' }}>
                    <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</Typography>
                  </Box>
                )}
                {renderAttachments(m.attachments)}
              </Box>
            </Stack>
          );
        })}
        <div ref={endRef} />
      </Box>

      {/* Komponist */}
      <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${ws.border}` }}>
        {err && <Typography role="alert" sx={{ fontSize: 12, color: ws.red, mb: 0.75 }}>{err}</Typography>}
        {/* Ventende vedlegg */}
        {pending.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {pending.map((a, i) => (
              <Box key={i} sx={{ position: 'relative' }}>
                <Box component="img" src={a.downloadUrl} alt={a.filename} sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${ws.border}` }} />
                <IconButton size="small" aria-label={t('removeAttachment')} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  sx={{ position: 'absolute', top: -8, right: -8, bgcolor: ws.panelSolid, color: ws.text, p: 0.25, '&:hover': { bgcolor: ws.panelAlt } }}><Close sx={{ fontSize: 14 }} /></IconButton>
              </Box>
            ))}
          </Stack>
        )}
        {/* Valgt merkelapp for neste melding */}
        {tag && TAG_META[tag] && (
          <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
            <Chip size="small" icon={TAG_META[tag].icon} label={t(TAG_META[tag].dictKey)} onDelete={() => setTag(null)} deleteIcon={<Close sx={{ fontSize: 14 }} />}
              sx={{ color: TAG_META[tag].color, bgcolor: TAG_META[tag].soft, '& .MuiChip-icon': { color: TAG_META[tag].color }, '& .MuiChip-deleteIcon': { color: TAG_META[tag].color } }} />
          </Stack>
        )}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            inputRef={inputRef}
            fullWidth size="small" multiline maxRows={4} placeholder={t('composerPlaceholder')}
            value={text} onChange={(e) => setText(e.target.value)}
            inputProps={{ 'aria-label': t('composerPlaceholder') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) { e.preventDefault(); send(); } }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }}
          />
          <IconButton onClick={send} disabled={sending || uploading || (!text.trim() && pending.length === 0)} aria-label={t('send')}
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
            {sending ? <CircularProgress size={18} /> : <Send fontSize="small" />}
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} justifyContent="space-between">
          <Stack direction="row" spacing={0.5}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
            <Tooltip title={t('attach')}><span><IconButton size="small" aria-label={t('attach')} disabled={uploading} onClick={() => fileRef.current?.click()} sx={{ color: ws.textDim }}>{uploading ? <CircularProgress size={16} /> : <AttachFile sx={{ fontSize: 17 }} />}</IconButton></span></Tooltip>
            <Tooltip title={t('mention')}><IconButton size="small" aria-label={t('mention')} onClick={(e) => { setMentionMode(true); setMembersAnchor(e.currentTarget); }} sx={{ color: ws.textDim }}><AlternateEmail sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            <Tooltip title={t('emoji')}><IconButton size="small" aria-label={t('emoji')} onClick={(e) => setEmojiAnchor(e.currentTarget)} sx={{ color: ws.textDim }}><EmojiEmotions sx={{ fontSize: 17 }} /></IconButton></Tooltip>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            {['update', 'question', 'important'].map(tagBtn)}
          </Stack>
        </Stack>
      </Box>

      {/* Deltakere / mention-plukker */}
      <Popover open={!!membersAnchor} anchorEl={membersAnchor} onClose={() => setMembersAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, minWidth: 200 } }}>
        <Typography sx={{ px: 1.5, pt: 1, pb: 0.5, fontSize: 11, color: ws.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('members')} · {participants.length}</Typography>
        <Box role="menu" aria-label={t('members')}>
        {participants.map((p) => (
          <MenuItem key={p.id} role="menuitem" onClick={() => { if (mentionMode) insertAtCursor(`@${p.name} `); setMembersAnchor(null); }} sx={{ gap: 1, fontSize: 13 }}>
            <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: p.mine ? ws.accent : 'rgba(255,255,255,0.12)', color: p.mine ? ws.accentContrast : ws.text }}>{initials(p.name)}</Avatar>
            {p.name}{p.mine ? ` (${t('you')})` : ''}
          </MenuItem>
        ))}
        </Box>
      </Popover>

      {/* Emoji-plukker */}
      <Popover open={!!emojiAnchor} anchorEl={emojiAnchor} onClose={() => setEmojiAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{ sx: { bgcolor: ws.panelSolid, border: `1px solid ${ws.border}`, p: 1 } }}>
        <Box role="group" aria-label={t('emoji')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.25, maxWidth: 220 }}>
          {EMOJIS.map((e) => (
            <IconButton key={e} size="small" aria-label={`${t('emojiPrefix')} ${e}`} onClick={() => { insertAtCursor(e); setEmojiAnchor(null); }} sx={{ fontSize: 18 }}>{e}</IconButton>
          ))}
        </Box>
      </Popover>

      {/* «Flere valg»-meny */}
      <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)} PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <MenuItem onClick={() => { setMoreAnchor(null); scrollDown(); }} sx={{ gap: 1, fontSize: 13 }}><KeyboardArrowDown sx={{ fontSize: 18 }} /> {t('jumpToLatest')}</MenuItem>
        <MenuItem onClick={() => { setMoreAnchor(null); load(false); }} sx={{ gap: 1, fontSize: 13 }}><Refresh sx={{ fontSize: 18 }} /> {t('refresh')}</MenuItem>
        <MenuItem component="a" href="/guide/chat" target="_blank" rel="noopener" onClick={() => setMoreAnchor(null)} sx={{ gap: 1, fontSize: 13 }}><HelpOutlineIcon sx={{ fontSize: 18 }} /> {t('guide')}</MenuItem>
      </Menu>
    </Box>
  );
};

export default WorkspaceChatPanel;
