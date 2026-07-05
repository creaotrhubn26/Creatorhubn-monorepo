/**
 * WarmupDialog — produsenten setter sammen en «Oppvarming & fokus»-rutine fra
 * EaseVerse-innholdet (vokal/kropp/pust/mindfulness), tilordner band/vokalist,
 * og ser hvem som er klar. Innholdet hentes fra EaseVerse via collab-API.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, Chip, CircularProgress, Divider, IconButton,
} from '@mui/material';
import { SelfImprovement, CheckCircle, DeleteOutline, GraphicEq, Air, FitnessCenter, CloudUpload, MusicNote, RecordVoiceOver, PlayArrow, Stop, Add, BookmarkBorder, HelpOutline } from '@mui/icons-material';
import { apiRequest, getAuthHeader, buildApiUrl } from '@/lib/queryClient';

// FAINT løftet fra 0.38 → 0.6 alpha for WCAG AA (≥4.5:1) på liten tekst mot PANEL.
const PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.6)', ACCENT = '#FF6B35', GREEN = '#5fb88a';
const fieldSx = { '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } };
const TARGETS: [string, string][] = [['all', 'Alle'], ['vocalist', 'Vokalist'], ['instrument', 'Instrument']];

const WarmupDialog: React.FC<{ open: boolean; projectId: string; onClose: () => void }> = ({ open, projectId, onClose }) => {
  const [lib, setLib] = React.useState<any>(null);
  const [routines, setRoutines] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [target, setTarget] = React.useState('all');
  const [note, setNote] = React.useState('');
  const [picked, setPicked] = React.useState<Record<string, any>>({});
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);
  const voiceInputRef = React.useRef<HTMLInputElement>(null);
  const [sounds, setSounds] = React.useState<any[]>([]);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [savingTpl, setSavingTpl] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const flash = (kind: 'error' | 'ok', text: string) => setMsg({ kind, text });

  // Forhåndslytting: ett delt <audio>-element for opplastede filer og «Mine lyder».
  const previewRef = React.useRef<HTMLAudioElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const stopPreview = React.useCallback(() => { const a = previewRef.current; if (a && !a.paused) a.pause(); setPreviewUrl(null); }, []);
  const togglePreview = (url: string) => {
    const a = previewRef.current; if (!a || !url) return;
    if (previewUrl === url && !a.paused) { a.pause(); setPreviewUrl(null); return; }
    a.src = url; a.currentTime = 0; void a.play().catch(() => { /* */ }); setPreviewUrl(url);
  };
  React.useEffect(() => { if (!open) stopPreview(); }, [open, stopPreview]);

  // Produsenten laster opp egne lydfiler (gjenbruker /api/upload/audio):
  //  - 'music' → mindfulness-musikk/-sang (type custom_mindful_music)
  //  - 'voice' → guidet voice-over (type custom_mindful_voice)
  // Typene inneholder 'mindful' slik at WarmupPlayers rolige pusteanimasjon
  // (/breath|mindful/i på step.type) trigges under avspilling.
  const CUSTOM_KINDS: Record<string, { type: string; fallbackTitle: string; instruction: string }> = {
    music: { type: 'custom_mindful_music', fallbackTitle: 'Mindfulness-musikk', instruction: 'Mindfulness-musikk fra produsenten — lukk øynene og pust rolig mens du lytter.' },
    voice: { type: 'custom_mindful_voice', fallbackTitle: 'Guidet voice-over', instruction: 'Guidet voice-over fra produsenten — følg instruksjonene i lyden.' },
  };
  const uploadAudio = async (kind: 'music' | 'voice', file?: File | null) => {
    if (!file) return; setUploading(kind); setMsg(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const headers = await getAuthHeader(); delete (headers as any)['Content-Type'];
      const res = await fetch(buildApiUrl('/api/upload/audio'), { method: 'POST', headers, body: fd });
      if (!res.ok) { flash('error', res.status === 413 ? 'Lydfila er for stor.' : 'Opplastingen mislyktes. Prøv igjen.'); return; }
      const { url } = await res.json();
      if (!url) { flash('error', 'Opplastingen mislyktes. Prøv igjen.'); return; }
      const durationSec = await new Promise<number>((resolve) => { const a = new Audio(); a.onloadedmetadata = () => resolve(Math.round(a.duration) || 60); a.onerror = () => resolve(60); a.src = url; });
      const spec = CUSTOM_KINDS[kind];
      const key = `custom:${Date.now()}`;
      const soundTitle = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || spec.fallbackTitle;
      setPicked((p) => ({ ...p, [key]: { sourceId: key, title: soundTitle, type: spec.type, durationSec, audioUrl: url, instruction: spec.instruction } }));
      // Registrer i «Mine lyder» så fila kan gjenbrukes i andre prosjekter.
      try {
        await apiRequest('/api/audio-showcase/my-sounds', { method: 'POST', body: { title: soundTitle, url, kind, durationSec } });
        await loadSounds();
      } catch { /* biblioteket er valgfritt — steget er allerede lagt til */ }
    } catch { flash('error', 'Opplastingen mislyktes. Sjekk nettet og prøv igjen.'); } finally { setUploading(null); }
  };

  // «Mine lyder» + rutine-maler (på tvers av prosjekter).
  const loadSounds = React.useCallback(() => apiRequest('/api/audio-showcase/my-sounds').then((d: any) => setSounds(d.sounds || [])).catch(() => setSounds([])), []);
  const loadTemplates = React.useCallback(() => apiRequest('/api/audio-showcase/warmup-templates').then((d: any) => setTemplates(d.templates || [])).catch(() => setTemplates([])), []);
  const addSoundAsStep = (snd: any) => {
    const spec = CUSTOM_KINDS[snd.kind === 'voice' ? 'voice' : 'music'];
    const key = `custom:lib:${snd.id}`;
    setPicked((p) => (p[key] ? p : { ...p, [key]: { sourceId: key, title: snd.title, type: spec.type, durationSec: Number(snd.duration_sec) || 60, audioUrl: snd.url, instruction: spec.instruction } }));
  };
  const delSound = async (id: string) => { try { await apiRequest(`/api/audio-showcase/my-sounds/${id}`, { method: 'DELETE' }); } catch { flash('error', 'Kunne ikke slette lyden.'); } await loadSounds(); };
  const saveTemplate = async () => {
    const t = title.trim();
    if (!t || steps.length === 0) return;
    // Unngå at gjentatte klikk hoper opp identiske maler (GET er begrenset til 50).
    if (templates.some((x) => String(x.title).trim().toLowerCase() === t.toLowerCase())) { flash('error', 'Du har allerede en mal med dette navnet.'); return; }
    setSavingTpl(true); setMsg(null);
    try { await apiRequest('/api/audio-showcase/warmup-templates', { method: 'POST', body: { title: t, target, note: note.trim() || undefined, steps } }); await loadTemplates(); flash('ok', 'Lagret som mal.'); }
    catch { flash('error', 'Kunne ikke lagre malen. Prøv igjen.'); } finally { setSavingTpl(false); }
  };
  const delTemplate = async (id: string) => { try { await apiRequest(`/api/audio-showcase/warmup-templates/${id}`, { method: 'DELETE' }); } catch { flash('error', 'Kunne ikke slette malen.'); } await loadTemplates(); };
  // Gjenskap picked-nøklene fra steg-typene så bibliotek-avkrysningene stemmer.
  const keyForStep = (s: any): string => {
    const ty = String(s?.type || '');
    if (ty.startsWith('custom')) return String(s.sourceId);
    if (ty === 'breath') return `b:${s.sourceId}`;
    if (ty === 'mindfulness') return `t:${s.sourceId}`;
    if (ty === 'visualization') return `v:${s.sourceId}`;
    if (ty === 'affirmation') return 'aff';
    return `w:${s.sourceId}`;
  };
  const applyTemplate = (t: any) => {
    const p: Record<string, any> = {};
    for (const s of (Array.isArray(t.steps) ? t.steps : [])) p[keyForStep(s)] = s;
    setPicked(p); setTitle(t.title || ''); setTarget(t.target || 'all'); setNote(t.note || '');
  };

  const loadRoutines = React.useCallback(() => apiRequest(`/api/audio-showcases/${projectId}/warmups`).then((d: any) => setRoutines(d.routines || [])).catch(() => setRoutines([])), [projectId]);
  React.useEffect(() => {
    if (!open) return; setLoading(true);
    Promise.all([
      apiRequest('/api/audio-showcase/warmup-library').then(setLib).catch(() => setLib(null)),
      loadRoutines(),
      loadSounds(),
      loadTemplates(),
    ]).finally(() => setLoading(false));
  }, [open, loadRoutines, loadSounds, loadTemplates]);

  const toggle = (key: string, step: any) => setPicked((p) => { const n = { ...p }; if (n[key]) delete n[key]; else n[key] = step; return n; });
  const steps = Object.values(picked);
  const save = async () => {
    if (!title.trim() || steps.length === 0) return; setBusy(true); setMsg(null);
    try {
      await apiRequest(`/api/audio-showcases/${projectId}/warmups`, { method: 'POST', body: { title: title.trim(), target, note: note.trim() || undefined, steps } });
      setTitle(''); setNote(''); setPicked({}); await loadRoutines(); flash('ok', 'Rutinen er tilordnet bandet.');
    } catch { flash('error', 'Kunne ikke tilordne rutinen. Prøv igjen.'); } finally { setBusy(false); }
  };
  const del = async (id: string) => { try { await apiRequest(`/api/warmups/${id}`, { method: 'DELETE' }); } catch { flash('error', 'Kunne ikke slette rutinen.'); } await loadRoutines(); };

  const catIcon = (c: string) => /breath|pust/i.test(c) ? <Air sx={{ fontSize: 16 }} /> : /body|kropp/i.test(c) ? <FitnessCenter sx={{ fontSize: 16 }} /> : <GraphicEq sx={{ fontSize: 16 }} />;
  const Item = ({ k, step, sub }: { k: string; step: any; sub?: string }) => (
    <Stack direction="row" alignItems="center" spacing={1} onClick={() => toggle(k, step)} sx={{ py: 0.5, px: 1, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
      <Checkbox checked={!!picked[k]} size="small" inputProps={{ 'aria-label': step.title }} sx={{ p: 0.25, color: MUTED, '&.Mui-checked': { color: ACCENT } }} />
      <Box sx={{ color: FAINT, display: 'flex' }}>{catIcon(step.type)}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{step.title}</Typography>
        {sub && <Typography sx={{ fontSize: '0.66rem', color: MUTED }} noWrap>{sub}</Typography>}
      </Box>
      <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>{Math.round((step.durationSec || 0) / 60) || 1} min</Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><SelfImprovement sx={{ color: ACCENT }} /> Oppvarming & fokus
        <Chip label="fra EaseVerse" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.08)', color: MUTED }} />
        <IconButton component="a" href="/guide/oppvarming" target="_blank" rel="noopener" aria-label="Åpne guiden for Oppvarming og fokus" size="small" sx={{ ml: 'auto', color: MUTED, '&:hover': { color: ACCENT } }}><HelpOutline fontSize="small" /></IconButton></DialogTitle>
      <DialogContent>
        {loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box> : (
          <Stack direction="row" spacing={2}>
            {/* Bygg rutine */}
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
              <TextField label="Rutinenavn (f.eks. «Vokal før refreng»)" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={fieldSx} />
              <Stack direction="row" spacing={0.5}>{TARGETS.map(([v, l]) => <Chip key={v} label={l} onClick={() => setTarget(v)} size="small" sx={{ bgcolor: target === v ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.06)', color: target === v ? ACCENT : MUTED, fontWeight: target === v ? 700 : 400 }} />)}</Stack>
              {!lib ? <Typography sx={{ fontSize: '0.74rem', color: '#e0a955' }}>Får ikke kontakt med EaseVerse-innholdet akkurat nå.</Typography> : (
                <Box sx={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 0.5 }}>
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Vokal & kropp</Typography>
                  {(lib.warmups || []).map((w: any) => <Item key={w.id} k={`w:${w.id}`} step={{ sourceId: w.id, title: w.title, type: w.category, durationSec: w.durationSeconds, instruction: w.instruction }} sub={w.subtitle} />)}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Pust</Typography>
                  {(lib.breathing || []).map((b: any) => { const inh = Number(b.inhale) || 0, hld = Number(b.hold) || 0, exh = Number(b.exhale) || 0, hldA = Number(b.holdAfter) || 0; return <Item key={b.id} k={`b:${b.id}`} step={{ sourceId: b.id, title: b.title, type: 'breath', durationSec: (inh + hld + exh + hldA) * (b.cycles || 4), instruction: b.description, breathing: { inhale: inh, hold: hld, exhale: exh, holdAfter: hldA, cycles: b.cycles } }} sub={`${inh}-${hld}-${exh}${hldA ? '-' + hldA : ''}`} />; })}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Mindfulness / fokus</Typography>
                  {(lib.techniques || []).map((t: any) => <Item key={t.id} k={`t:${t.id}`} step={{ sourceId: t.id, title: t.title, type: 'mindfulness', durationSec: t.durationSeconds, instruction: (t.steps || []).join(' · ') }} sub={t.description} />)}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Visualisering</Typography>
                  {(lib.visualizations || []).map((v: any) => <Item key={v.id} k={`v:${v.id}`} step={{ sourceId: v.id, title: v.title, type: 'visualization', durationSec: v.durationSeconds, instruction: (v.narration || []).join(' · ') }} sub={v.bestFor} />)}
                  {(lib.affirmations || []).length > 0 && <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Affirmasjoner</Typography>}
                  {(lib.affirmations || []).length > 0 && <Item k="aff" step={{ sourceId: 'affirmations', title: 'Affirmasjoner', type: 'affirmation', durationSec: 45, instruction: (lib.affirmations || []).slice(0, 6).map((a: any) => a.text).join('  ·  ') }} sub="Gjenta rolig før opptak" />}
                </Box>
              )}
              {/* Egen lyd: mindfulness-musikk + guidet voice-over (flere filer OK) */}
              <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                  <Button onClick={() => audioInputRef.current?.click()} disabled={!!uploading} startIcon={uploading === 'music' ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <MusicNote sx={{ fontSize: '16px !important' }} />} size="small" sx={{ color: ACCENT, textTransform: 'none', fontSize: '0.72rem' }}>{uploading === 'music' ? 'Laster opp…' : 'Last opp mindfulness-musikk'}</Button>
                  <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(e) => { void uploadAudio('music', e.target.files?.[0]); e.target.value = ''; }} />
                  <Button onClick={() => voiceInputRef.current?.click()} disabled={!!uploading} startIcon={uploading === 'voice' ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <RecordVoiceOver sx={{ fontSize: '16px !important' }} />} size="small" sx={{ color: ACCENT, textTransform: 'none', fontSize: '0.72rem' }}>{uploading === 'voice' ? 'Laster opp…' : 'Last opp voice-over (guidet)'}</Button>
                  <input ref={voiceInputRef} type="file" accept="audio/*" hidden onChange={(e) => { void uploadAudio('voice', e.target.files?.[0]); e.target.value = ''; }} />
                </Stack>
                {steps.filter((s: any) => String(s.type || '').startsWith('custom')).map((s: any) => (
                  <Stack key={s.sourceId} direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1, py: 0.5 }}>
                    {s.type === 'custom_mindful_voice' ? <RecordVoiceOver sx={{ fontSize: 15, color: ACCENT }} /> : <MusicNote sx={{ fontSize: 15, color: ACCENT }} />}
                    <Typography sx={{ fontSize: '0.76rem', flex: 1 }} noWrap>{s.title}</Typography>
                    <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>{Math.round(s.durationSec / 60) || 1} min</Typography>
                    {s.audioUrl && <IconButton size="small" onClick={() => togglePreview(s.audioUrl)} aria-label={previewUrl === s.audioUrl ? `Stopp ${s.title}` : `Forhåndslytt ${s.title}`} sx={{ color: previewUrl === s.audioUrl ? ACCENT : FAINT, p: 0.25 }}>{previewUrl === s.audioUrl ? <Stop sx={{ fontSize: 15 }} /> : <PlayArrow sx={{ fontSize: 15 }} />}</IconButton>}
                    <IconButton size="small" onClick={() => toggle(s.sourceId, s)} aria-label={`Fjern ${s.title} fra rutinen`} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                  </Stack>
                ))}
              </Stack>
              {/* «Mine lyder» — gjenbruk tidligere opplastinger på tvers av prosjekter */}
              {sounds.length > 0 && (
                <Stack spacing={0.5}>
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase' }}>Mine lyder</Typography>
                  <Box sx={{ maxHeight: 132, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 0.5 }}>
                    {sounds.map((snd) => {
                      // Også nyopplastede steg (annen nøkkel) teller — hindrer dobbel lyd.
                      const inRoutine = !!picked[`custom:lib:${snd.id}`] || steps.some((s: any) => s.audioUrl && s.audioUrl === snd.url);
                      return (
                        <Stack key={snd.id} direction="row" alignItems="center" spacing={1} sx={{ px: 0.75, py: 0.4, borderRadius: '8px', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                          {snd.kind === 'voice' ? <RecordVoiceOver sx={{ fontSize: 15, color: FAINT }} /> : <MusicNote sx={{ fontSize: 15, color: FAINT }} />}
                          <Typography sx={{ fontSize: '0.76rem', flex: 1, minWidth: 0 }} noWrap>{snd.title}</Typography>
                          <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>{Math.round((Number(snd.duration_sec) || 60) / 60) || 1} min</Typography>
                          <IconButton size="small" onClick={() => togglePreview(snd.url)} aria-label={previewUrl === snd.url ? `Stopp ${snd.title}` : `Forhåndslytt ${snd.title}`} sx={{ color: previewUrl === snd.url ? ACCENT : FAINT, p: 0.25 }}>{previewUrl === snd.url ? <Stop sx={{ fontSize: 15 }} /> : <PlayArrow sx={{ fontSize: 15 }} />}</IconButton>
                          <IconButton size="small" onClick={() => addSoundAsStep(snd)} disabled={inRoutine} aria-label={inRoutine ? `${snd.title} er lagt til` : `Legg ${snd.title} til i rutinen`} sx={{ color: inRoutine ? GREEN : ACCENT, p: 0.25 }}>{inRoutine ? <CheckCircle sx={{ fontSize: 15 }} /> : <Add sx={{ fontSize: 15 }} />}</IconButton>
                          <IconButton size="small" onClick={() => delSound(snd.id)} aria-label={`Slett ${snd.title} fra biblioteket`} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                        </Stack>
                      );
                    })}
                  </Box>
                </Stack>
              )}
              <TextField label="Beskjed til medlemmet (valgfri)" value={note} onChange={(e) => setNote(e.target.value)} size="small" multiline minRows={2} sx={fieldSx} />
              <Stack direction="row" spacing={1}>
                <Button onClick={save} disabled={busy || !title.trim() || steps.length === 0} variant="contained" sx={{ flex: 1, bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Lagrer…' : `Tilordne rutine (${steps.length} steg)`}</Button>
                <Button onClick={saveTemplate} disabled={savingTpl || !title.trim() || steps.length === 0} startIcon={<BookmarkBorder sx={{ fontSize: '15px !important' }} />} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '999px', whiteSpace: 'nowrap', fontSize: '0.74rem' }}>{savingTpl ? 'Lagrer…' : 'Lagre som mal'}</Button>
              </Stack>
              {msg && <Typography role={msg.kind === 'error' ? 'alert' : 'status'} sx={{ fontSize: '0.76rem', color: msg.kind === 'error' ? '#ff8a6b' : GREEN }}>{msg.text}</Typography>}
            </Stack>
            <Divider orientation="vertical" flexItem sx={{ borderColor: BORDER }} />
            {/* Maler + tilordnede rutiner + hvem er klar */}
            <Stack spacing={1} sx={{ width: 260 }}>
              {templates.length > 0 && (
                <>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED }}>Mine maler</Typography>
                  {templates.map((t) => (
                    <Stack key={t.id} direction="row" alignItems="center" spacing={0.5} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', px: 1.25, py: 0.75 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }} noWrap>{t.title}</Typography>
                        <Typography sx={{ fontSize: '0.64rem', color: MUTED }}>{(t.steps || []).length} steg · {TARGETS.find((x) => x[0] === t.target)?.[1] || t.target}</Typography>
                      </Box>
                      <Button size="small" onClick={() => applyTemplate(t)} aria-label={`Bruk malen ${t.title}`} sx={{ color: ACCENT, textTransform: 'none', fontSize: '0.68rem', minWidth: 0, px: 0.75 }}>Bruk</Button>
                      <IconButton size="small" onClick={() => delTemplate(t.id)} aria-label={`Slett malen ${t.title}`} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                    </Stack>
                  ))}
                  <Divider sx={{ borderColor: BORDER }} />
                </>
              )}
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED }}>Tilordnet</Typography>
              {routines.length === 0 && <Typography sx={{ fontSize: '0.74rem', color: FAINT }}>Ingen rutiner ennå.</Typography>}
              {routines.map((r) => (
                <Box key={r.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1 }} noWrap>{r.title}</Typography>
                    <Chip label={TARGETS.find((t) => t[0] === r.target)?.[1] || r.target} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,107,53,0.14)', color: ACCENT }} />
                    <IconButton size="small" onClick={() => del(r.id)} aria-label={`Slett rutinen ${r.title}`} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                  </Stack>
                  <Typography sx={{ fontSize: '0.66rem', color: MUTED }}>{(r.steps || []).length} steg</Typography>
                  {(r.completions || []).length > 0
                    ? <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>{r.completions.map((c: any) => <Chip key={c.name} icon={<CheckCircle sx={{ fontSize: '12px !important' }} />} label={c.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(95,184,138,0.16)', color: GREEN, '& .MuiChip-icon': { color: GREEN } }} />)}</Stack>
                    : <Typography sx={{ fontSize: '0.62rem', color: FAINT, mt: 0.5 }}>Ingen har fullført ennå</Typography>}
                </Box>
              ))}
            </Stack>
          </Stack>
        )}
        {/* Delt forhåndslyttings-element (styres av togglePreview) */}
        <Box component="audio" ref={previewRef} onEnded={() => setPreviewUrl(null)} sx={{ display: 'none' }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button></DialogActions>
    </Dialog>
  );
};

export default WarmupDialog;
