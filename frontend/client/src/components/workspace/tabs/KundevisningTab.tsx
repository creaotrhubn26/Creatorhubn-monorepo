// @ts-nocheck
/**
 * KundevisningTab — KUNDEPORTAL «Kundevisning», dark CreatorHub.
 *
 * Produsentens vindu inn til SHOWCASEN klienten ser — ingen nytt system.
 * Gjenbruker prosjektets klient-galleri (photographer_client_galleries via
 * GET /api/projects/:id/galleries) og åpner det klienten faktisk ser
 * (/client/gallery/<token>). Dette er målet for «Client view»-knappene ellers.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import Collections from '@mui/icons-material/Collections';
import ContentCopy from '@mui/icons-material/ContentCopy';
import OpenInNew from '@mui/icons-material/OpenInNew';
import AccessTime from '@mui/icons-material/AccessTime';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsTag, WsImg } from '../ui';

const SAMPLE = [
  { id: 'd1', title: 'Sara & Amir — Galleri', clientName: 'Sara & Amir', status: 'active', sharePath: '/client/gallery/demo' },
];

const KundevisningTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [galleries, setGalleries] = useState<any[]>([]);
  const [timelineToken, setTimelineToken] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any | null>(null);
  const loadReviews = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/client-reviews`).then((r: any) => setReviews(r || null)).catch(() => {}); };

  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/galleries`)
      .then((r: any) => setGalleries(Array.isArray(r?.galleries) ? r.galleries : []))
      .catch(() => {});
    // Wedding timeline-kundevisning (run-of-day klienten ser/justerer).
    apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}`)
      .then((r: any) => { const t = r?.clientAccessToken; if (t) setTimelineToken(t); })
      .catch(() => {});
    loadReviews();
  }, [projectId, isReal]);

  const respondToReview = async (commentId: string) => {
    const response = window.prompt('Svar til klienten:'); if (!response) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/client-reviews/${commentId}/respond`, { method: 'POST', body: { response: response.trim() } }); loadReviews(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke svare'); }
  };
  const reviewIcon = (type: string) => type === 'heart' || type === 'love' || type === 'favorite' ? '❤️' : type === 'change' || type === 'change-request' || type === 'revision' ? '✏️' : type === 'approval' || type === 'approve' ? '✅' : '💬';

  const timelinePath = (isReal && timelineToken) ? `/wedding/timeline/${timelineToken}` : (!isReal ? '/wedding/timeline/demo' : null);

  const list = isReal ? galleries : SAMPLE;

  const openClientView = (sharePath: string) => {
    if (!sharePath) return;
    window.open(`${window.location.origin}${sharePath}`, '_blank');
  };
  const copyLink = (sharePath: string) => {
    if (!sharePath) return;
    try { navigator.clipboard?.writeText(`${window.location.origin}${sharePath}`); } catch { /* ignore */ }
  };

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Kundevisning</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Slik ser klienten prosjektet — showcasen/klient-galleriet. Del lenken eller forhåndsvis selv.</Typography>
        </Box>
      </Stack>

      <WsCard sx={{ mb: 2, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Visibility sx={{ color: ws.accent }} />
          <Typography sx={{ fontSize: 13, color: ws.text }}>
            «Kundevisning» er den samme <b>showcasen</b> klienten får tilsendt — ikke en egen kopi. Alt du publiserer til galleriet vises her.
          </Typography>
        </Stack>
      </WsCard>

      {/* Klient-review — hjerter/kommentarer/endringer fra showcasen */}
      {(isReal ? reviews?.hasGallery : true) && (() => {
        const r = isReal ? reviews : { counts: { heart: 24, comment: 7, change: 2 }, selections: { selected: 38, submitted: 1 }, comments: [
          { id: 'c1', clientName: 'Sara', type: 'heart', comment: 'Elsker denne!', thumbUrl: null, at: new Date().toISOString(), photographerResponse: null },
          { id: 'c2', clientName: 'Amir', type: 'change', comment: 'Kan vi få denne litt lysere?', thumbUrl: null, at: new Date().toISOString(), photographerResponse: null },
        ] };
        const c = r?.counts || {}; const sel = r?.selections || {}; const comments = r?.comments || [];
        const totalC = Object.values(c).reduce((a: any, b: any) => a + (b || 0), 0);
        if (isReal && totalC === 0 && (sel.selected || 0) === 0) return null;
        return (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: 14 }}>💬</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Klient-tilbakemeldinger</Typography>
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={1}>
                {(c.heart || c.love || c.favorite) ? <Typography sx={{ fontSize: 12, color: ws.textDim }}>❤️ {(c.heart || 0) + (c.love || 0) + (c.favorite || 0)}</Typography> : null}
                {(c.comment) ? <Typography sx={{ fontSize: 12, color: ws.textDim }}>💬 {c.comment}</Typography> : null}
                {(c.change || c['change-request'] || c.revision) ? <Typography sx={{ fontSize: 12, color: ws.amber }}>✏️ {(c.change || 0) + (c['change-request'] || 0) + (c.revision || 0)}</Typography> : null}
                {(sel.selected) ? <Typography sx={{ fontSize: 12, color: ws.green }}>✓ {sel.selected} valgt{sel.submitted ? ' (innsendt)' : ''}</Typography> : null}
              </Stack>
            </Stack>
            <Stack spacing={1}>
              {comments.slice(0, 8).map((cm: any) => (
                <Stack key={cm.id} direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  {cm.thumbUrl
                    ? <Box sx={{ width: 38, height: 38, borderRadius: 1, background: `center/cover no-repeat url(${cm.thumbUrl})`, flexShrink: 0 }} />
                    : <Box sx={{ width: 38, height: 38, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{reviewIcon(cm.type)}</Box>}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{cm.clientName}</Typography>
                      <Typography sx={{ fontSize: 13 }}>{reviewIcon(cm.type)}</Typography>
                    </Stack>
                    {cm.comment && <Typography sx={{ fontSize: 12.5, color: ws.text, mt: 0.25 }}>«{cm.comment}»</Typography>}
                    {cm.photographerResponse
                      ? <Box sx={{ mt: 0.75, pl: 1, borderLeft: `2px solid ${ws.accentBorder}` }}><Typography sx={{ fontSize: 11.5, color: ws.textDim }}><b>Svar:</b> {cm.photographerResponse}</Typography></Box>
                      : isReal && <Button size="small" onClick={() => respondToReview(cm.id)} sx={{ mt: 0.5, color: ws.accent, textTransform: 'none', fontSize: 11.5, p: 0, minWidth: 0 }}>Svar</Button>}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </WsCard>
        );
      })()}

      {/* Wedding timeline — kundevisning (run-of-day) */}
      {timelinePath && (
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1.5}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccessTime sx={{ color: ws.accent }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Bryllups-tidslinje (kundevisning)</Typography>
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>Klienten ser og kan justere dagens program (first look, vielse, taler …) i sin egen visning.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<ContentCopy sx={{ fontSize: 15 }} />} onClick={() => { try { navigator.clipboard?.writeText(`${window.location.origin}${timelinePath}`); } catch { /* */ } }} sx={{ color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>Kopier lenke</Button>
              <Button size="small" variant="contained" startIcon={<OpenInNew sx={{ fontSize: 15 }} />} onClick={() => window.open(`${window.location.origin}${timelinePath}`, '_blank')}
                sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne tidslinje</Button>
            </Stack>
          </Stack>
        </WsCard>
      )}

      {list.length === 0 ? (
        <WsCard>
          <Stack alignItems="center" sx={{ py: 5, color: ws.textDim }}>
            <Collections sx={{ fontSize: 36, mb: 1.5 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: ws.text }}>Ingen kundevisning publisert ennå</Typography>
            <Typography sx={{ fontSize: 12.5, mt: 0.5, textAlign: 'center', maxWidth: 360 }}>
              Opprett et klient-galleri (showcase) for prosjektet — så blir det kundens visning her, og du kan dele lenken.
            </Typography>
          </Stack>
        </WsCard>
      ) : (
        <Stack spacing={1.5}>
          {list.map((g) => (
            <WsCard key={g.id}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1.5}>
                <WsImg sx={{ width: 96, height: 64, aspectRatio: 'auto' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{g.title}</Typography>
                    <WsTag label={g.status === 'completed' ? 'Levert' : 'Aktiv'} tone={g.status === 'completed' ? 'green' : 'blue'} />
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: ws.textDim }}>{g.clientName || g.clientEmail || ''}</Typography>
                  {g.sharePath && <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint, mt: 0.25 }}>{window.location.origin}{g.sharePath}</Typography>}
                </Box>
                {g.sharePath && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<ContentCopy sx={{ fontSize: 15 }} />} onClick={() => copyLink(g.sharePath)} sx={{ color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>Kopier lenke</Button>
                    <Button size="small" variant="contained" startIcon={<OpenInNew sx={{ fontSize: 15 }} />} onClick={() => openClientView(g.sharePath)}
                      sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne kundevisning</Button>
                  </Stack>
                )}
              </Stack>
            </WsCard>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default KundevisningTab;
