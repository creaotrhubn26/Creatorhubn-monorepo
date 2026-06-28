// @ts-nocheck
/**
 * PhotoRoomTab — produsent-side bilde-review-cockpit (Photo Review).
 *
 * Gjenbruker capture_assets (rating/flagged/rejected/exif fra iPad-culling) +
 * Før/Etter fra AI-forbedring (/enhance-status). Net-nytt: per-bilde review-
 * status (godkjent/trenger-redigering/avvist) + interne/klient foto-kommentarer.
 * Statkort, bildeviser m/ EXIF + Før/Etter, filmstrip m/ status, utvalgs-stadier,
 * kommentar-skinne (Alle/Interne/Klient), bunn-actions. Dark CreatorHub.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, Chip, TextField, CircularProgress, IconButton } from '@mui/material';
import Star from '@mui/icons-material/Star';
import StarBorder from '@mui/icons-material/StarBorder';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Brush from '@mui/icons-material/Brush';
import Block from '@mui/icons-material/Block';
import Send from '@mui/icons-material/Send';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const STATUS_META: any = {
  approved: { label: 'Godkjent', tone: 'green', dot: ws.green, icon: '✓' },
  needs_edit: { label: 'Trenger redigering', tone: 'amber', dot: ws.amber, icon: '✎' },
  rejected: { label: 'Avvist', tone: 'red', dot: ws.red, icon: '✕' },
  flagged: { label: 'Flagget', tone: 'accent', dot: ws.accent, icon: '★' },
};

const PhotoRoomTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [cFilter, setCFilter] = useState('all');
  const [cText, setCText] = useState('');
  const [cScope, setCScope] = useState('internal');
  const [enhanceMap, setEnhanceMap] = useState<Record<string, any>>({});
  const [baPos, setBaPos] = useState(50);

  const load = () => {
    if (!isReal) { setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review`)
      .then((r: any) => { setData(r || null); if (!selId && r?.assets?.length) setSelId(r.assets[0].id); })
      .catch(() => {}).finally(() => setLoading(false));
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments`).then((r: any) => setComments(r?.comments || [])).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/enhance-status`).then((r: any) => {
      const m: Record<string, any> = {};
      (r?.jobs || []).forEach((j: any) => { if (j.photoId) m[String(j.photoId).replace(/\.[^.]+$/, '')] = j; });
      setEnhanceMap(m);
    }).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const assets = data?.assets || [];
  const stats = data?.stats || {};
  const stages = data?.stages || [];
  const scopes = data?.commentScopes || {};
  const sel = assets.find((a: any) => a.id === selId) || assets[0] || null;
  const ba = sel ? enhanceMap[String(sel.filename || '').replace(/\.[^.]+$/, '')] : null;
  const hasBA = ba && ba.originalUrl && ba.enhancedUrl;

  const shownComments = comments.filter((c: any) => {
    if (cFilter === 'internal') return c.scope === 'internal';
    if (cFilter === 'client') return c.scope === 'client';
    return true;
  }).filter((c: any) => !c.parentId);

  const setStatus = async (assetId: string, status: string | null) => {
    if (!isReal) return;
    setData((d: any) => ({ ...d, assets: d.assets.map((a: any) => a.id === assetId ? { ...a, reviewStatus: status } : a) }));
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/${assetId}`, { method: 'PATCH', body: { reviewStatus: status } }).then(load).catch(load);
  };
  const addComment = async () => {
    if (!cText.trim() || !isReal) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments`, { method: 'POST', body: { comment: cText.trim(), scope: cScope, assetId: sel?.id, authorKind: 'creator' } }); setCText(''); apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-comments`).then((r: any) => setComments(r?.comments || [])); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke kommentere'); }
  };
  const approveSelection = async () => {
    if (!isReal) return;
    if (!window.confirm('Godkjenn alle flaggede bilder?')) return;
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review/approve`, { method: 'POST', body: {} }); window.alert(`${r?.approved || 0} bilder godkjent.`); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke godkjenne'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;
  if (isReal && !data?.hasSession) return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 1 }}>Photo Review</Typography>
      <WsCard sx={{ bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
        <Typography sx={{ fontSize: 13.5, color: ws.text }}>Ingen capture-session ennå. Når fotografen skyter på iPad-en (eller importerer kort), dukker bildene opp her for review — godkjenning, klient-kommentarer og Før/Etter.</Typography>
      </WsCard>
    </Box>
  );

  const STAT_CARDS = [
    { icon: '🖼️', label: 'Totalt bilder', value: stats.total || 0, sub: '100%' },
    { icon: '⏳', label: 'Til godkjenning', value: stats.pending || 0, sub: stats.total ? `${Math.round((stats.pending || 0) / stats.total * 100)}%` : '', tone: ws.amber },
    { icon: '✓', label: 'Godkjent', value: stats.approved || 0, sub: stats.total ? `${Math.round((stats.approved || 0) / stats.total * 100)}%` : '', tone: ws.green },
    { icon: '✎', label: 'Trenger redigering', value: stats.needsEdit || 0, sub: stats.total ? `${Math.round((stats.needsEdit || 0) / stats.total * 100)}%` : '', tone: ws.red },
    { icon: '💬', label: 'Kommentarer', value: stats.comments || 0, sub: 'Totalt', tone: ws.blue },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Photo Review</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Produsent-side bilde-review — godkjenning, Før/Etter, klient-kommentarer og utvalg. Samme rom klienten ser.</Typography>
        </Box>
        {sel?.id && <Button variant="contained" startIcon={<Send sx={{ fontSize: 17 }} />} onClick={approveSelection} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Godkjenn utvalg</Button>}
      </Stack>

      {/* Statkort */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        {STAT_CARDS.map((c) => (
          <WsCard key={c.label} sx={{ flex: 1, minWidth: 150 }} pad={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Typography sx={{ fontSize: 18 }}>{c.icon}</Typography>
              <Box>
                <Typography sx={{ fontSize: 11, color: ws.textDim }}>{c.label}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="baseline">
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.tone || ws.text }}>{c.value}</Typography>
                  {c.sub && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c.sub}</Typography>}
                </Stack>
              </Box>
            </Stack>
          </WsCard>
        ))}
      </Stack>

      <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
        {/* Venstre: viser + filmstrip + stadier */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Bildeviser */}
          {sel && (
            <WsCard sx={{ mb: 2 }} pad={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{(assets.indexOf(sel) + 1)} / {assets.length}</Typography>
                <Stack direction="row" spacing={0.25}>
                  {[1, 2, 3, 4, 5].map((n) => (n <= (sel.rating || 0) ? <Star key={n} sx={{ fontSize: 17, color: ws.amber }} /> : <StarBorder key={n} sx={{ fontSize: 17, color: ws.textFaint }} />))}
                </Stack>
              </Stack>
              {hasBA ? (
                <Box>
                  <Box sx={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', bgcolor: '#000' }}>
                    <Box component="img" src={ba.enhancedUrl} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                    <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - baPos}% 0 0)` }}><Box component="img" src={ba.originalUrl} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /></Box>
                    <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${baPos}%`, width: '2px', bgcolor: ws.accent }} />
                    <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>FØR</Box>
                    <Box sx={{ position: 'absolute', top: 8, right: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,140,0,0.85)', fontSize: 10.5, fontWeight: 700, color: ws.accentContrast }}>ETTER</Box>
                  </Box>
                  <input type="range" min={0} max={100} value={baPos} onChange={(e) => setBaPos(Number(e.target.value))} style={{ width: '100%', accentColor: ws.accent, marginTop: 8 }} />
                </Box>
              ) : (
                sel.thumbUrl
                  ? <Box sx={{ width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, background: `center/contain no-repeat #000 url(${sel.thumbUrl})` }} />
                  : <Box sx={{ width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.textFaint }}>Ingen forhåndsvisning</Box>
              )}
              {/* EXIF-strip */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {[sel.exif?.iso && `ISO ${sel.exif.iso}`, sel.exif?.focalLength && `${sel.exif.focalLength}`, sel.exif?.aperture && `f/${sel.exif.aperture}`, sel.exif?.shutter && `${sel.exif.shutter}`, sel.exif?.camera].filter(Boolean).map((x: any, i: number) => (
                  <Typography key={i} sx={{ fontSize: 11, color: ws.textDim }}>{x}</Typography>
                ))}
              </Stack>
              {/* Review-actions */}
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {[['approved', 'Godkjenn', CheckCircle, ws.green], ['needs_edit', 'Trenger redigering', Brush, ws.amber], ['rejected', 'Avvis', Block, ws.red]].map(([st, label, Icon, col]: any) => (
                  <Button key={st} size="small" startIcon={<Icon sx={{ fontSize: 16 }} />} onClick={() => setStatus(sel.id, sel.reviewStatus === st ? null : st)}
                    variant={sel.reviewStatus === st ? 'contained' : 'outlined'}
                    sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, color: sel.reviewStatus === st ? '#06281c' : col, borderColor: col, bgcolor: sel.reviewStatus === st ? col : 'transparent', '&:hover': { borderColor: col, bgcolor: sel.reviewStatus === st ? col : `${col}22` } }}>{label}</Button>
                ))}
              </Stack>
            </WsCard>
          )}

          {/* Filmstrip */}
          <WsCard sx={{ mb: 2 }} pad={1.25}>
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {assets.slice(0, 40).map((a: any) => {
                const sm = STATUS_META[a.reviewStatus] || null;
                return (
                  <Box key={a.id} onClick={() => { setSelId(a.id); setBaPos(50); }} sx={{ position: 'relative', width: 96, height: 72, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${a.id === sel?.id ? ws.accent : 'transparent'}`, background: a.thumbUrl ? `center/cover no-repeat url(${a.thumbUrl})` : ws.panelAlt }}>
                    {sm && <Box sx={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: '50%', bgcolor: sm.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{sm.icon}</Box>}
                    {a.rating > 0 && <Box sx={{ position: 'absolute', bottom: 2, left: 4, fontSize: 9, color: ws.amber, fontWeight: 700 }}>{'★'.repeat(a.rating)}</Box>}
                  </Box>
                );
              })}
            </Stack>
            {stats.pending > 0 && <Typography sx={{ fontSize: 11, color: ws.amber, mt: 0.75 }}>● {stats.pending} bilder til godkjenning</Typography>}
          </WsCard>

          {/* Utvalg & versjoner */}
          <WsCard pad={1.5}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 1 }}>UTVALG & VERSJONER</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {stages.map((s: any, i: number) => (
                <React.Fragment key={s.key}>
                  <Box sx={{ flex: 1, p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${i === stages.length - 1 ? ws.accentBorder : ws.borderSoft}` }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{s.count} filer</Typography>
                  </Box>
                  {i < stages.length - 1 && <Typography sx={{ color: ws.textFaint }}>→</Typography>}
                </React.Fragment>
              ))}
            </Stack>
          </WsCard>
        </Box>

        {/* Høyre: kommentarer + bildeinfo */}
        <Box sx={{ width: 340, flexShrink: 0 }}>
          <WsCard sx={{ mb: 2, p: 0, overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}` }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 1 }}>Kommentarer</Typography>
              <Stack direction="row" spacing={0.5}>
                {[['all', `Alle ${scopes.all || 0}`], ['internal', `Interne ${scopes.internal || 0}`], ['client', `Klient ${scopes.client || 0}`]].map(([k, label]: any) => (
                  <Box key={k} onClick={() => setCFilter(k)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11.5, fontWeight: cFilter === k ? 700 : 500, color: cFilter === k ? ws.accent : ws.textDim, bgcolor: cFilter === k ? ws.accentSoft : 'rgba(255,255,255,0.04)', border: `1px solid ${cFilter === k ? ws.accentBorder : 'transparent'}` }}>{label}</Box>
                ))}
              </Stack>
            </Box>
            <Stack sx={{ maxHeight: 360, overflowY: 'auto' }}>
              {shownComments.length === 0 && <Typography sx={{ fontSize: 12.5, color: ws.textDim, p: 2, textAlign: 'center' }}>Ingen kommentarer ennå.</Typography>}
              {shownComments.map((c: any) => (
                <Box key={c.id} sx={{ p: 1.5, borderBottom: `1px solid ${ws.borderSoft}`, bgcolor: c.pinned ? ws.accentSoft : 'transparent' }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{c.authorName}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>({c.scope === 'client' ? 'Klient' : 'Intern'})</Typography>
                    {c.pinned && <WsTag label="Festet" tone="accent" />}
                    {c.tag === 'needs_edit' && <WsTag label="Trenger redigering" tone="amber" />}
                  </Stack>
                  <Typography sx={{ fontSize: 12.5, color: ws.text }}>{c.comment}</Typography>
                </Box>
              ))}
            </Stack>
            <Box sx={{ p: 1.25, borderTop: `1px solid ${ws.borderSoft}` }}>
              <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
                {[['internal', 'Intern'], ['client', 'Til klient']].map(([k, label]: any) => (
                  <Box key={k} onClick={() => setCScope(k)} sx={{ px: 1, py: 0.3, borderRadius: 1.5, cursor: 'pointer', fontSize: 10.5, fontWeight: 700, color: cScope === k ? ws.accentContrast : ws.textDim, bgcolor: cScope === k ? ws.accent : 'rgba(255,255,255,0.05)' }}>{label}</Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={0.75}>
                <TextField value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} placeholder="Legg til kommentar…" size="small" fullWidth />
                <IconButton onClick={addComment} sx={{ bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover } }}><Send sx={{ fontSize: 18 }} /></IconButton>
              </Stack>
            </Box>
          </WsCard>

          {/* Bildeinformasjon (EXIF) */}
          {sel && (
            <WsCard pad={1.5}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 1 }}>BILDEINFORMASJON</Typography>
              <Stack spacing={0.5}>
                {[['Filnavn', sel.filename], ['Kamera', sel.exif?.camera], ['Objektiv', sel.exif?.lens], ['Lukker', sel.exif?.shutter], ['Blender', sel.exif?.aperture ? `f/${sel.exif.aperture}` : null], ['ISO', sel.exif?.iso], ['Oppløsning', sel.exif?.width && sel.exif?.height ? `${sel.exif.width} x ${sel.exif.height}` : null]].filter(([, v]) => v).map(([k, v]: any) => (
                  <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 600 }} noWrap>{v}</Typography></Stack>
                ))}
              </Stack>
            </WsCard>
          )}
        </Box>
      </Stack>

      {/* Bunn-actions */}
      {sel && (
        <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 2.5 }}>
          <Button variant="outlined" disabled sx={{ color: ws.textDim, borderColor: ws.border, textTransform: 'none', fontWeight: 600 }}>Be om endringer</Button>
          <Button variant="outlined" disabled sx={{ color: ws.text, borderColor: ws.border, textTransform: 'none', fontWeight: 600 }}>Send til kunde</Button>
          <Button variant="contained" startIcon={<CheckCircle />} onClick={approveSelection} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Godkjenn utvalg</Button>
        </Stack>
      )}
    </Box>
  );
};

export default PhotoRoomTab;
