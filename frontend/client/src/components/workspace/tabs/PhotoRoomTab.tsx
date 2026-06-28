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
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import Movie from '@mui/icons-material/Movie';
import { WsCard, WsTag, WsModal } from '../ui';

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
  // Generativ AI (Nano Banana 2-redigering)
  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiJob, setAiJob] = useState<any | null>(null); // {status, beforeUrl, afterUrl}
  const [aiBusy, setAiBusy] = useState(false);
  const loadAiCfg = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`).then((r: any) => setAiCfg(r || null)).catch(() => {}); };
  // Kreditt-lommebok (selvbetjent)
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (packId: string) => {
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId } }); if (r?.url) window.location.href = r.url; }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke starte kjøp'); }
  };
  // Confirm-ved-retur fra Stripe (?ai_credits=ok&cs=<session>)
  useEffect(() => {
    if (!isReal) return;
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('ai_credits') === 'ok' && p.get('cs')) {
        apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } })
          .then(() => { loadCredits(); window.alert('Kreditter lagt til ✓'); }).catch(() => {})
          .finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); });
      }
    } catch { /* */ }
    loadCredits();
    // eslint-disable-next-line
  }, [projectId]);

  const load = () => {
    if (!isReal) { setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/photo-review`)
      .then((r: any) => { setData(r || null); if (!selId && r?.assets?.length) setSelId(r.assets[0].id); })
      .catch(() => {}).finally(() => setLoading(false));
    loadAiCfg();
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

  const setConsent = async (consented: boolean) => {
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/consent`, { method: 'PUT', body: { consented } }); loadAiCfg(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre samtykke'); }
  };
  const QUICK_PROMPTS = ['Fjern bakgrunnen, behold personen', 'Demp sterke reflekser i bakgrunnen', 'Fjern uønskede objekter i bakgrunnen', 'Gjør lyset varmere og mykere'];
  const openAi = () => { setAiPrompt(''); setAiJob(null); setBaPos(50); setSuggestions([]); setAiOpen(true); };
  const startEdit = async () => {
    if (!sel?.id || !aiPrompt.trim() || aiBusy) return;
    setAiBusy(true); setAiJob({ status: 'queued' });
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/image-edit`, { method: 'POST', body: { assetId: sel.id, prompt: aiPrompt.trim() } });
      if (!r?.jobId) throw new Error('Kunne ikke starte');
      // Poll til ferdig (maks ~60s).
      for (let i = 0; i < 30; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        setAiJob(s);
        if (s.status === 'completed' || s.status === 'failed') break;
      }
      loadAiCfg();
    } catch (e: any) { window.alert(e?.message || 'AI-redigering feilet'); setAiJob({ status: 'failed' }); }
    finally { setAiBusy(false); }
  };
  // AI-video (animer stillbilde → Seedance 2.0)
  const [animOpen, setAnimOpen] = useState(false);
  const [animPrompt, setAnimPrompt] = useState('');
  const [animDuration, setAnimDuration] = useState(5);
  const [animJob, setAnimJob] = useState<any | null>(null);
  const [animBusy, setAnimBusy] = useState(false);
  const openAnim = () => { setAnimPrompt(''); setAnimJob(null); setAnimDuration(5); setSuggestions([]); setAnimOpen(true); };
  const startAnimate = async () => {
    if (!sel?.id || !animPrompt.trim() || animBusy) return;
    setAnimBusy(true); setAnimJob({ status: 'queued' });
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/image-to-video`, { method: 'POST', body: { assetId: sel.id, prompt: animPrompt.trim(), duration: animDuration } });
      if (!r?.jobId) throw new Error('Kunne ikke starte');
      // Video tar minutter — poll tålmodig (~4 min), ellers fortsetter i bakgrunnen.
      for (let i = 0; i < 48; i++) {
        await new Promise((res) => setTimeout(res, 5000));
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        setAnimJob(s);
        if (s.status === 'completed' || s.status === 'failed') break;
      }
      loadAiCfg();
    } catch (e: any) { window.alert(e?.message || 'AI-video feilet'); setAnimJob({ status: 'failed' }); }
    finally { setAnimBusy(false); }
  };
  // «Foreslå» (Claude vision → kontekst-tilpassede prompts)
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggest = async (mode: 'motion' | 'edit') => {
    if (!sel?.id || suggesting) return;
    setSuggesting(true); setSuggestions([]);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/suggest`, { method: 'POST', body: { assetId: sel.id, mode } }); setSuggestions(Array.isArray(r?.suggestions) ? r.suggestions : []); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke foreslå'); }
    finally { setSuggesting(false); }
  };
  const aiAvailable = aiCfg?.enabled && aiCfg?.whitelisted;

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
                <Box sx={{ flex: 1 }} />
                {aiAvailable && <Button size="small" startIcon={<Movie sx={{ fontSize: 16 }} />} onClick={openAnim} sx={{ textTransform: 'none', fontWeight: 600, fontSize: 12, color: ws.accent, borderColor: ws.accentBorder }} variant="outlined">Animer</Button>}
                {aiAvailable && <Button size="small" startIcon={<AutoFixHigh sx={{ fontSize: 16 }} />} onClick={openAi} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, color: ws.accentContrast, bgcolor: ws.accent, '&:hover': { bgcolor: ws.accentHover } }}>AI-rediger</Button>}
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

      {/* AI-rediger (Nano Banana 2) */}
      <WsModal open={aiOpen} onClose={() => { if (!aiBusy) setAiOpen(false); }} title={`AI-rediger — ${sel?.filename || 'bilde'}`} maxWidth="sm">
        {!aiCfg?.consent?.consented ? (
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.amberSoft, border: `1px solid ${ws.amber}55` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: ws.amber, mb: 0.5 }}>⚠️ Samtykke kreves</Typography>
              <Typography sx={{ fontSize: 12.5, color: ws.text }}>AI-redigering sender kundens bilde til en tredjeparts AI-modell (Google Nano Banana 2) som kan behandle data utenfor EØS. Bekreft at du har grunnlag for dette per prosjekt før du fortsetter.</Typography>
            </Box>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setAiOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={() => setConsent(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Samtykk og fortsett</Button>
            </Stack>
          </Stack>
        ) : aiJob && (aiJob.status === 'completed' || aiJob.afterUrl) ? (
          <Stack spacing={2}>
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', bgcolor: '#000' }}>
              <Box component="img" src={aiJob.afterUrl} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              {aiJob.beforeUrl && <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - baPos}% 0 0)` }}><Box component="img" src={aiJob.beforeUrl} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /></Box>}
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${baPos}%`, width: '2px', bgcolor: ws.accent }} />
              <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>FØR</Box>
              <Box sx={{ position: 'absolute', top: 8, right: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,140,0,0.85)', fontSize: 10.5, fontWeight: 700, color: ws.accentContrast }}>ETTER (AI)</Box>
            </Box>
            <input type="range" min={0} max={100} value={baPos} onChange={(e) => setBaPos(Number(e.target.value))} style={{ width: '100%', accentColor: ws.accent }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>«{aiJob.prompt}»</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => { setAiJob(null); }} sx={{ color: ws.textDim, textTransform: 'none' }}>Ny redigering</Button>
                <Button size="small" variant="contained" onClick={() => window.open(aiJob.afterUrl, '_blank')} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne / last ned</Button>
              </Stack>
            </Stack>
          </Stack>
        ) : aiBusy || (aiJob && aiJob.status !== 'failed') ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress sx={{ color: ws.accent }} />
            <Typography sx={{ fontSize: 13, color: ws.textDim }}>AI redigerer bildet… ({aiJob?.status === 'running' ? 'kjører' : 'i kø'})</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {aiJob?.status === 'failed' && <Typography sx={{ fontSize: 12.5, color: ws.red }}>Redigeringen feilet. Prøv en annen instruksjon.</Typography>}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Beskriv hva AI-en skal gjøre med bildet (Nano Banana 2):</Typography>
              <Button size="small" startIcon={<AutoFixHigh sx={{ fontSize: 14 }} />} onClick={() => suggest('edit')} disabled={suggesting} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11 }}>{suggesting ? 'Ser på bildet…' : 'Foreslå'}</Button>
            </Stack>
            <TextField value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder="f.eks. Fjern søppelbøtta i bakgrunnen" />
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {(suggestions.length ? suggestions : QUICK_PROMPTS).map((q) => <Box key={q} onClick={() => setAiPrompt(q)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{q}</Box>)}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              {credits?.billingMode === 'credits'
                ? <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>Saldo: <b style={{ color: ws.green }}>${(credits?.balanceUsd ?? 0).toFixed(2)}</b> · <Box component="span" onClick={() => setBuyOpen(true)} sx={{ color: ws.accent, cursor: 'pointer', fontWeight: 700 }}>Kjøp kreditter</Box></Typography>
                : <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>
                    {(() => {
                      const u = aiCfg?.myUsage; const gens = u?.generationsThisMonth ?? 0;
                      if (aiCfg?.billingMode === 'metered') { const rem = u?.includedRemaining; return `Du: ${gens} redigeringer denne mnd${rem != null ? ` · ${rem} inkludert igjen` : ''} · ~$${(u?.unitPriceUsd ?? 0).toFixed(2)}/bilde`; }
                      return `Du: ${gens} redigeringer denne mnd · gratis i pilot`;
                    })()}
                  </Typography>}
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setAiOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
                <Button variant="contained" disabled={!aiPrompt.trim() || aiBusy} onClick={startEdit} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Rediger med AI</Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </WsModal>

      {/* Kjøp AI-kreditter */}
      <WsModal open={buyOpen} onClose={() => setBuyOpen(false)} title="Kjøp AI-kreditter" maxWidth="sm">
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Forhåndsbetalt saldo for AI-redigering, -video og -restyle. Nåværende saldo: <b style={{ color: ws.green }}>${(credits?.balanceUsd ?? 0).toFixed(2)}</b></Typography>
          <Stack spacing={1}>
            {(credits?.packs || []).map((p: any) => (
              <Stack key={p.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 800 }}>${p.creditUsd} kreditt</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{Math.round(p.creditUsd / 0.18)}+ AI-redigeringer · {Math.round(p.creditUsd / 0.5)}+ korte videoer</Typography>
                </Box>
                <Button variant="contained" onClick={() => buyPack(p.id)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{p.priceNok} kr</Button>
              </Stack>
            ))}
          </Stack>
          <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>Sikker betaling via Stripe. Kreditter trekkes per generering.</Typography>
        </Stack>
      </WsModal>

      {/* Animer (AI-video, Seedance 2.0) */}
      <WsModal open={animOpen} onClose={() => { if (!animBusy) setAnimOpen(false); }} title={`Animer — ${sel?.filename || 'bilde'}`} maxWidth="sm">
        {!aiCfg?.consent?.consented ? (
          <Stack spacing={2}>
            <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.amberSoft, border: `1px solid ${ws.amber}55` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: ws.amber, mb: 0.5 }}>⚠️ Samtykke kreves</Typography>
              <Typography sx={{ fontSize: 12.5, color: ws.text }}>AI-video sender bildet til en tredjeparts AI-modell (Seedance 2.0 / ByteDance) som kan behandle data utenfor EØS.</Typography>
            </Box>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setAnimOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={() => setConsent(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Samtykk og fortsett</Button>
            </Stack>
          </Stack>
        ) : animJob && animJob.status === 'completed' && animJob.afterUrl ? (
          <Stack spacing={2}>
            <Box component="video" src={animJob.afterUrl} controls autoPlay loop sx={{ width: '100%', borderRadius: `${ws.radiusSm}px`, bgcolor: '#000', aspectRatio: '16 / 9' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>«{animJob.prompt}»</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => setAnimJob(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>Ny</Button>
                <Button size="small" variant="contained" onClick={() => window.open(animJob.afterUrl, '_blank')} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Last ned</Button>
              </Stack>
            </Stack>
          </Stack>
        ) : animBusy || (animJob && animJob.status !== 'failed') ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress sx={{ color: ws.accent }} />
            <Typography sx={{ fontSize: 13, color: ws.textDim, textAlign: 'center' }}>AI lager video… dette tar gjerne 1–3 minutter.<br /><Typography component="span" sx={{ fontSize: 11.5, color: ws.textFaint }}>Du kan lukke — jobben fortsetter i bakgrunnen.</Typography></Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {animJob?.status === 'failed' && <Typography sx={{ fontSize: 12.5, color: ws.red }}>Video-genereringen feilet. Prøv en annen beskrivelse.</Typography>}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Beskriv bevegelsen AI-en skal lage fra stillbildet (Seedance 2.0):</Typography>
              <Button size="small" startIcon={<AutoFixHigh sx={{ fontSize: 14 }} />} onClick={() => suggest('motion')} disabled={suggesting} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11 }}>{suggesting ? 'Ser på bildet…' : 'Foreslå'}</Button>
            </Stack>
            <TextField value={animPrompt} onChange={(e) => setAnimPrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder="f.eks. rolig kamera-innzoom, mykt vindpust i håret" />
            {suggestions.length > 0 && <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {suggestions.map((q) => <Box key={q} onClick={() => setAnimPrompt(q)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{q}</Box>)}
            </Stack>}
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>Lengde:</Typography>
              {[4, 5, 8, 10].map((d) => <Box key={d} onClick={() => setAnimDuration(d)} sx={{ px: 1.25, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: animDuration === d ? 700 : 500, color: animDuration === d ? ws.accentContrast : ws.textDim, bgcolor: animDuration === d ? ws.accent : 'rgba(255,255,255,0.05)' }}>{d}s</Box>)}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>~${(animDuration * 0.1).toFixed(2)} ({animDuration}s)</Typography>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setAnimOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
                <Button variant="contained" disabled={!animPrompt.trim() || animBusy} onClick={startAnimate} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Lag video</Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </WsModal>
    </Box>
  );
};

export default PhotoRoomTab;
