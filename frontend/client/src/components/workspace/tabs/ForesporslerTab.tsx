// @ts-nocheck
/**
 * ForesporslerTab («Forespørsler») — innboks for INNKOMMENDE henvendelser/leads.
 * SAMME kilde som UniversalDashboard sin CustomerInquiryCenter: `client_submissions`
 * (skjema-innsendinger fra potensielle kunder), scopet på vendor_email.
 *
 * Tre handlinger per henvendelse:
 *   • «Svar»          → e-post til kunden via /api/emails/send (som dashbordet).
 *   • «Opprett prosjekt» → ProjectCreationWithMemoryCards ferdig utfylt; markerer
 *                          henvendelsen booked og SÅR prosjektets workspace-chat
 *                          (project-<id>) med henvendelsen + svar-historikk, slik
 *                          at ingenting går tapt i overgangen lead → prosjekt.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Dialog, DialogContent, DialogActions, IconButton, TextField, Alert } from '@mui/material';
import MoveToInbox from '@mui/icons-material/MoveToInbox';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import ReplyOutlined from '@mui/icons-material/ReplyOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import ProjectCreationWithMemoryCards from '../../project/ProjectCreationWithMemoryCards';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

// Evendi event_type / project_type → veiviserens projectType (kjente verdier).
const KNOWN_TYPES = new Set(['wedding', 'portrait', 'commercial', 'corporate', 'event', 'engagement', 'newborn', 'family', 'album']);
const toProjectType = (t?: string) => {
  const v = String(t || '').toLowerCase().trim();
  return KNOWN_TYPES.has(v) ? v : undefined;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};
const fmtAmount = (n?: number) => (n && n > 0 ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '');

const ForesporslerTab: React.FC<{ projectId: string; profession?: string; userId?: string; userName?: string }> = ({ profession, userId, userName }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any | null>(null);   // «Opprett prosjekt»
  const [replyTo, setReplyTo] = useState<any | null>(null);  // «Svar»
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const [replies, setReplies] = useState<Record<string, string[]>>({}); // sendte svar pr. lead (→ chat-seed)
  const [toast, setToast] = useState('');

  const load = () => {
    setLoading(true);
    apiRequest('/api/foresporsler/inbound')
      .then((r: any) => setItems(Array.isArray(r?.items) ? r.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const sendReply = async () => {
    if (!replyTo || !replyText.trim()) return;
    setSending(true); setSendErr('');
    try {
      await apiRequest('/api/emails/send', { method: 'POST', body: { to: replyTo.clientEmail, subject: `Re: ${replyTo.title}`, message: replyText.trim() } });
      setReplies((prev) => ({ ...prev, [replyTo.id]: [...(prev[replyTo.id] || []), replyText.trim()] }));
      setToast(`Svar sendt til ${replyTo.clientName}`);
      setReplyTo(null); setReplyText('');
    } catch (e: any) {
      setSendErr(e?.message || e?.error || 'Kunne ikke sende e-post. Sjekk at Gmail er koblet til i Innstillinger.');
    } finally { setSending(false); }
  };

  const handleCreated = async (lead: any, project: any) => {
    const newId = project?.id || project?.projectId || '';
    // 1) marker henvendelsen booked (idempotent backstop)
    try { await apiRequest(`/api/foresporsler/inbound/${encodeURIComponent(lead.id)}/convert`, { method: 'POST', body: { projectId: newId } }); } catch { /* */ }
    // 2) sår prosjektets workspace-chat med henvendelsen + svar-historikk
    if (newId) {
      const sent = replies[lead.id] || [];
      const seed = [
        '📥 Forespørsel konvertert til prosjekt',
        `Fra: ${lead.clientName}${lead.clientEmail ? ` <${lead.clientEmail}>` : ''}`,
        lead.eventType ? `Type: ${lead.eventType}` : '',
        lead.eventDate ? `Ønsket dato: ${fmtDate(lead.eventDate)}` : '',
        lead.note ? `\nHenvendelse:\n«${lead.note}»` : '',
        sent.length ? `\nSvar sendt (${sent.length}):\n${sent.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      try { await apiRequest('/api/communication/messages', { method: 'POST', body: { conversationId: `project-${newId}`, content: seed, senderId: userId || 'system', senderName: userName || 'Forespørsler' } }); } catch { /* */ }
    }
    setItems((prev) => prev.filter((x) => x.id !== lead.id));
    setActive(null);
    setToast('Prosjekt opprettet — henvendelsen og dialogen er lagt i prosjekt-chatten');
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Forespørsler</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Innkommende henvendelser fra potensielle kunder. Svar på e-post, eller opprett prosjekt med ett klikk — veiviseren fylles ut automatisk.</Typography>
        </Box>
        {items.length > 0 && <WsTag label={`${items.length} nye`} tone="amber" />}
      </Stack>

      <WsCard>
        {items.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <MoveToInbox sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen nye henvendelser</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 440 }}>Når en potensiell kunde sender en forespørsel via kontaktskjemaet ditt, dukker den opp her klar til å bli et prosjekt — samme henvendelser som «Kundeforespørsler» på dashbordet.</Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {items.map((it: any) => (
              <Stack key={it.id} direction="row" alignItems="flex-start" spacing={1.5} sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.accentBorder}` }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
                  <MoveToInbox sx={{ color: ws.accent, fontSize: 19 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>{it.clientName || it.title}</Typography>
                    {it.eventType && <WsTag label={it.eventType} tone="blue" />}
                    {fmtAmount(it.amount) && <WsTag label={fmtAmount(it.amount)} tone="green" />}
                    {(replies[it.id]?.length > 0) && <WsTag label={`${replies[it.id].length} svar`} tone="green" />}
                  </Stack>
                  {it.note && <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 0.4 }}>«{it.note}»</Typography>}
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {it.eventDate && <Detail icon={EventOutlined} text={fmtDate(it.eventDate)} />}
                    {it.venueName && <Detail icon={PlaceOutlined} text={it.venueName} />}
                    {it.clientEmail && <Detail icon={EmailOutlined} text={it.clientEmail} />}
                    {it.clientPhone && <Detail icon={PhoneOutlined} text={it.clientPhone} />}
                  </Stack>
                </Box>
                <Stack spacing={0.75} sx={{ flexShrink: 0 }}>
                  <Button size="small" variant="contained" startIcon={<AddCircleOutline />} onClick={() => setActive(it)}
                    sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { bgcolor: ws.accentHover } }}>
                    Opprett prosjekt
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<ReplyOutlined />} disabled={!it.clientEmail} onClick={() => { setReplyTo(it); setReplyText(''); setSendErr(''); }}
                    sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Svar
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </WsCard>

      {/* «Svar» — e-post til kunden (samme leveranse som dashbordet) */}
      <Dialog open={!!replyTo} onClose={() => setReplyTo(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Svar på henvendelse</Typography>
            {replyTo && <Typography sx={{ fontSize: 12, color: ws.textDim }}>Til {replyTo.clientName} · {replyTo.clientEmail}</Typography>}
          </Box>
          <IconButton onClick={() => setReplyTo(null)} sx={{ color: ws.textDim }}><Close /></IconButton>
        </Stack>
        <DialogContent>
          {replyTo?.note && <Box sx={{ p: 1.25, mb: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>«{replyTo.note}»</Typography>
          </Box>}
          <TextField autoFocus fullWidth multiline minRows={5} placeholder="Skriv svaret ditt …" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          {sendErr && <Alert severity="error" sx={{ mt: 1.5 }}>{sendErr}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setReplyTo(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button onClick={sendReply} disabled={!replyText.trim() || sending} variant="contained"
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
            {sending ? 'Sender …' : 'Send e-post'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* «Opprett prosjekt» — veiviseren ferdig utfylt */}
      <Dialog open={!!active} onClose={() => setActive(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Nytt prosjekt fra henvendelse</Typography>
            {active && <Typography sx={{ fontSize: 12, color: ws.textDim }}>Forhåndsutfylt fra {active.clientName || 'kunden'}</Typography>}
          </Box>
          <IconButton onClick={() => setActive(null)} sx={{ color: ws.textDim }}><Close /></IconButton>
        </Stack>
        <DialogContent sx={{ pt: 1 }}>
          {active && (
            <ProjectCreationWithMemoryCards
              profession={profession || 'photographer'}
              userId={userId}
              initialData={{
                projectName: active.title && active.title !== active.clientName ? active.title : (active.clientName ? `${active.clientName}${active.eventType ? ' – ' + active.eventType : ''}` : ''),
                clientName: active.clientName || '',
                clientEmail: active.clientEmail || '',
                clientPhone: active.clientPhone || '',
                eventDate: active.eventDate ? String(active.eventDate).split('T')[0] : '',
                location: active.venueName || '',
                description: active.note || '',
                projectType: toProjectType(active.eventType),
              }}
              onProjectCreated={(project: any) => handleCreated(active, project)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Toast */}
      <Dialog open={!!toast} onClose={() => setToast('')} PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.accentBorder}`, borderRadius: `${ws.radius}px`, p: 0 } }}>
        <Box sx={{ px: 3, py: 2.5, maxWidth: 380 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: ws.text }}>{toast}</Typography>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button size="small" onClick={() => setToast('')} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>OK</Button>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

const Detail: React.FC<{ icon: any; text: string }> = ({ icon: Icon, text }) => (
  <Stack direction="row" spacing={0.5} alignItems="center">
    <Icon sx={{ fontSize: 14, color: ws.textFaint }} />
    <Typography sx={{ fontSize: 11.5, color: ws.textDim }} noWrap>{text}</Typography>
  </Stack>
);

export default ForesporslerTab;
