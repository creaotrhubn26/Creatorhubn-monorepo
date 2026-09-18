/**
 * StoryPanel — «Historie» (Fase 7c): episoder med scener under («hva
 * spillerne lærer», kilde/tilpasning), tidslinje med låste beslutninger,
 * åpne spørsmål/sjekklister og kilderegister med SHA-256.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, CheckCircleOutline as DoneIcon, ContentCopy as CopyIcon, Delete as DeleteIcon, Refresh as RefreshIcon, VerifiedOutlined as VerifiedIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import {
  NARRATIVE_SCENE_ERA_LABELS, type NarrativeEpisode, type NarrativeOpenQuestion, type NarrativeQuestionKind, type NarrativeSceneSummary, type NarrativeSource, type NarrativeSourceKind,
} from '../narrativeTypes';
import { createEpisode, createOpenQuestion, createSource, deleteEpisode, deleteOpenQuestion, deleteSource, listEpisodes, listOpenQuestions, listScenes, listSources, patchEpisode, patchOpenQuestion, patchSource, NarrativeApiError } from '../narrativeService';
import { AutosaveField, EmptyHint, SectionTitle, sceneFieldSx } from '../scenes/sceneUi';
import { SCENE_STATUS_COLORS, SCENE_STATUS_LABELS } from '../scenes/sceneOps';
import { groupScenesByEpisode, nextEpisodeCode, nextQuestionCode, timelineRows } from './storyOps';

type StorySection = 'episodes' | 'timeline' | 'questions' | 'sources';
const SECTIONS: Array<{ id: StorySection; label: string }> = [{ id: 'episodes', label: 'Episoder' }, { id: 'timeline', label: 'Tidslinje' }, { id: 'questions', label: 'Åpne spørsmål' }, { id: 'sources', label: 'Kilder' }];
const menuProps = { PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } };
const QUESTION_STATUS_COLOR = { open: narrativeColors.warning, done: narrativeColors.accent, dropped: narrativeColors.textDim } as const;

export interface StoryPanelProps {
  projectId: string;
  refreshKey?: number;
  onOpenScene: (sceneId: string) => void;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}

export function StoryPanel({ projectId, refreshKey = 0, onOpenScene, onNotice }: StoryPanelProps): React.ReactElement {
  const [section, setSection] = useState<StorySection>(() => { try { const v = new URLSearchParams(window.location.search).get('story'); return SECTIONS.some((s) => s.id === v) ? (v as StorySection) : 'episodes'; } catch { return 'episodes'; } });
  useEffect(() => { try { const url = new URL(window.location.href); url.searchParams.set('story', section); window.history.replaceState({}, '', url.toString()); } catch { /* ignore */ } }, [section]);
  const [episodes, setEpisodes] = useState<NarrativeEpisode[]>([]);
  const [scenes, setScenes] = useState<NarrativeSceneSummary[]>([]);
  const [questions, setQuestions] = useState<NarrativeOpenQuestion[]>([]);
  const [sources, setSources] = useState<NarrativeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s, q, src] = await Promise.all([listEpisodes(projectId), listScenes(projectId), listOpenQuestions(projectId), listSources(projectId)]);
      setEpisodes(e); setScenes(s.scenes); setQuestions(q); setSources(src); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente historien.'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await load(); if (ok) onNotice(ok, 'success'); }
    catch (err) { onNotice(err instanceof NarrativeApiError && err.code === 'duplicate_code' ? 'Koden er allerede i bruk.' : err instanceof Error ? err.message : 'Kunne ikke lagre.', 'error'); }
  };

  const groups = useMemo(() => groupScenesByEpisode(episodes, scenes), [episodes, scenes]);
  const timeline = useMemo(() => timelineRows(scenes, questions), [scenes, questions]);

  // Dialoger
  const [newEpisode, setNewEpisode] = useState<{ code: string; title: string } | null>(null);
  const [newQuestion, setNewQuestion] = useState<{ code: string; kind: NarrativeQuestionKind; question: string } | null>(null);
  const [decide, setDecide] = useState<{ q: NarrativeOpenQuestion; decision: string } | null>(null);
  const [newSource, setNewSource] = useState<{ code: string; label: string; kind: NarrativeSourceKind; sha256: string } | null>(null);
  const [questionFilter, setQuestionFilter] = useState<'open' | 'all'>('open');

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); onNotice('Kopiert!', 'success'); } catch { onNotice('Kunne ikke kopiere.', 'warning'); } };

  if (loading && episodes.length === 0 && scenes.length === 0) {
    return <Box sx={{ p: 3 }} data-testid="narrative-story-loading"><Skeleton variant="text" width={240} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /><Skeleton variant="rounded" height={160} sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.06)' }} /></Box>;
  }
  if (error && episodes.length === 0) {
    return <Box sx={{ p: 3 }} data-testid="narrative-story-error"><Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200 }} data-testid="narrative-story">
      <Tabs value={section} onChange={(_e, v) => setSection(v as StorySection)} sx={{ minHeight: 36, mb: 2, borderBottom: `1px solid ${narrativeColors.borderStrong}`, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 36, fontSize: 13 }, '& .Mui-selected': { color: '#fff' }, '& .MuiTabs-indicator': { bgcolor: narrativeColors.accent } }}>
        {SECTIONS.map((s) => <Tab key={s.id} value={s.id} label={s.id === 'questions' ? `${s.label} ${questions.filter((q) => q.status === 'open').length}` : s.label} data-testid={`narrative-story-tab-${s.id}`} />)}
      </Tabs>

      {section === 'episodes' ? (
        <Stack spacing={2} data-testid="narrative-story-episodes">
          <Stack direction="row" alignItems="center">
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }}>Episoder er historiens beats (E01–E12). Hver scene kan høre til én episode; «hva spillerne lærer» er testen på om episoden gjør jobben sin.</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setNewEpisode({ code: nextEpisodeCode(episodes), title: '' })} sx={{ color: narrativeColors.accent }} data-testid="narrative-story-new-episode">Ny episode</Button>
          </Stack>
          {episodes.length === 0 ? <EmptyHint title="Ingen episoder ennå" body="Legg inn E01 og fordel scenene, så viser Hjem fremdrift per episode." testId="narrative-story-episodes-empty" /> : null}
          {groups.map((g) => (
            <Box key={g.episode?.id ?? 'loose'} sx={{ p: 2, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={g.episode ? `narrative-episode-${g.episode.code}` : 'narrative-episode-loose'}>
              {g.episode ? (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={g.episode.code} sx={{ fontWeight: 800, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />
                    <Box sx={{ flex: 1 }}><AutosaveField label="Tittel" value={g.episode.title} onSave={(v) => patchEpisode(projectId, g.episode!.id, { title: v }).then(load)} testId={`narrative-episode-title-${g.episode.code}`} maxLength={300} /></Box>
                    <Select size="small" value={g.episode.status} onChange={(e) => void run(() => patchEpisode(projectId, g.episode!.id, { status: e.target.value as NarrativeEpisode['status'] }))} sx={{ ...sceneFieldSx, width: 120, '& .MuiSelect-select': { py: 0.75, fontSize: 12 } }} MenuProps={menuProps}><MenuItem value="draft">Utkast</MenuItem><MenuItem value="locked">Låst</MenuItem></Select>
                    <Tooltip title="Slett episode (scenene beholdes)"><IconButton size="small" onClick={() => { if (window.confirm(`Slette ${g.episode!.code}?`)) void run(() => deleteEpisode(projectId, g.episode!.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
                    <AutosaveField label="Sammendrag" multiline minRows={2} value={g.episode.summary} onSave={(v) => patchEpisode(projectId, g.episode!.id, { summary: v }).then(load)} maxLength={20_000} />
                    <AutosaveField label="Hva spillerne lærer" multiline minRows={2} value={g.episode.playersLearn} onSave={(v) => patchEpisode(projectId, g.episode!.id, { playersLearn: v }).then(load)} testId={`narrative-episode-learn-${g.episode.code}`} maxLength={20_000} />
                    <AutosaveField label="Kilde / tilpasning" multiline minRows={2} value={g.episode.sourceNote} onSave={(v) => patchEpisode(projectId, g.episode!.id, { sourceNote: v }).then(load)} maxLength={5000} />
                  </Box>
                </Stack>
              ) : <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Scener uten episode</Typography>}
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 1.5 }} useFlexGap>
                {g.scenes.length === 0 ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>Ingen scener i episoden ennå — sett episode i scenens Manus-fane.</Typography> : null}
                {g.scenes.map((s) => (
                  <Chip key={s.id} size="small" label={`${s.code} · ${s.title}`} onClick={() => onOpenScene(s.id)} sx={{ bgcolor: `${SCENE_STATUS_COLORS[s.status]}1f`, color: narrativeColors.text, '& .MuiChip-label': { fontSize: 11 } }} title={SCENE_STATUS_LABELS[s.status]} data-testid={`narrative-episode-scene-${s.code}`} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : null}

      {section === 'timeline' ? (
        <Stack spacing={1.5} data-testid="narrative-story-timeline">
          <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Epoker med antall scener og låste beslutninger (avgjorte spørsmål). Nye beslutninger legges inn som spørsmål og avgjøres.</Typography>
          {timeline.length === 0 ? <EmptyHint title="Ingen epoker ennå" body="Sett epoke på scenene i Manus-fanen." /> : null}
          {timeline.map((row) => (
            <Box key={row.era} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '200px 1fr' }, gap: 1.5, p: 2, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={`narrative-timeline-${row.era}`}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: narrativeColors.accent }}>{NARRATIVE_SCENE_ERA_LABELS[row.era]}</Typography>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{row.scenes} scener</Typography>
              </Box>
              <Stack spacing={0.5}>
                {row.decisions.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen låste beslutninger knyttet til epoken.</Typography> : row.decisions.map((d) => (
                  <Stack key={d.id} direction="row" spacing={1} alignItems="baseline"><DoneIcon sx={{ fontSize: 14, color: narrativeColors.accent, mt: 0.3 }} /><Typography sx={{ fontSize: 12 }}><b>{d.question}</b> — {d.decision}</Typography></Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : null}

      {section === 'questions' ? (
        <Stack spacing={1.5} data-testid="narrative-story-questions">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }}>Spørsmål for neste manusgjennomgang og sjekklister (reelle kontroller, ikke «dokumentet finnes»).</Typography>
            <Select size="small" value={questionFilter} onChange={(e) => setQuestionFilter(e.target.value as 'open' | 'all')} sx={{ ...sceneFieldSx, width: 130, '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }} MenuProps={menuProps}><MenuItem value="open">Bare åpne</MenuItem><MenuItem value="all">Alle</MenuItem></Select>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setNewQuestion({ code: nextQuestionCode(questions, 'question'), kind: 'question', question: '' })} sx={{ color: narrativeColors.accent }} data-testid="narrative-story-new-question">Nytt spørsmål</Button>
          </Stack>
          {questions.filter((q) => questionFilter === 'all' || q.status === 'open').length === 0 ? <EmptyHint title="Ingen åpne spørsmål" body="Alt er avgjort — eller ingenting er registrert ennå." testId="narrative-story-questions-empty" /> : null}
          {questions.filter((q) => questionFilter === 'all' || q.status === 'open').map((q) => (
            <Stack key={q.id} direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={`narrative-question-${q.code}`} data-status={q.status}>
              <Chip size="small" label={q.code} sx={{ fontFamily: 'monospace', fontWeight: 800, bgcolor: q.kind === 'check' ? 'rgba(147, 164, 220,0.15)' : narrativeColors.accentSoft, color: q.kind === 'check' ? '#93a4dc' : narrativeColors.accent }} title={q.kind === 'check' ? 'Sjekkpunkt' : 'Spørsmål'} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, textDecoration: q.status === 'dropped' ? 'line-through' : 'none' }}>{q.question}</Typography>
                {q.context ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{q.context}</Typography> : null}
                {q.decision ? <Typography sx={{ fontSize: 12, color: narrativeColors.accent, mt: 0.5 }}>Avgjort: {q.decision}</Typography> : null}
              </Box>
              <Chip size="small" label={q.status === 'open' ? 'Åpen' : q.status === 'done' ? 'Avgjort' : 'Droppet'} sx={{ bgcolor: `${QUESTION_STATUS_COLOR[q.status]}22`, color: QUESTION_STATUS_COLOR[q.status], fontWeight: 700 }} />
              {q.status === 'open' ? <Button size="small" onClick={() => setDecide({ q, decision: '' })} sx={{ color: narrativeColors.accent, fontSize: 11, whiteSpace: 'nowrap' }} data-testid={`narrative-question-decide-${q.code}`}>{q.kind === 'check' ? 'Kontrollert' : 'Avgjør'}</Button> : null}
              {q.status === 'open' ? <Button size="small" onClick={() => void run(() => patchOpenQuestion(projectId, q.id, { status: 'dropped' }))} sx={{ color: narrativeColors.textDim, fontSize: 11 }}>Dropp</Button> : null}
              <Tooltip title="Slett"><IconButton size="small" onClick={() => { if (window.confirm(`Slette ${q.code}?`)) void run(() => deleteOpenQuestion(projectId, q.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            </Stack>
          ))}
        </Stack>
      ) : null}

      {section === 'sources' ? (
        <Stack spacing={1.5} data-testid="narrative-story-sources">
          <Stack direction="row" alignItems="center">
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }}>Kilderegister: hvert dokument scener refererer til, med SHA-256 så en hurtigbufret kopi aldri forveksles med originalen.</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setNewSource({ code: '', label: '', kind: 'md', sha256: '' })} sx={{ color: narrativeColors.accent }} data-testid="narrative-story-new-source">Ny kilde</Button>
          </Stack>
          {sources.length === 0 ? <EmptyHint title="Ingen kilder registrert" body="Legg inn manuset (W) og andre dokumenter med kontrollsum." /> : null}
          {sources.map((src) => (
            <Stack key={src.id} direction="row" spacing={1} alignItems="center" sx={{ p: 1.25, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={`narrative-source-${src.code}`}>
              <Chip size="small" label={src.code} sx={{ fontFamily: 'monospace', fontWeight: 800, bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{src.label} <Typography component="span" sx={{ fontSize: 11, color: narrativeColors.textDim }}>· {src.kind}{src.pathHint ? ` · ${src.pathHint}` : ''}</Typography></Typography>
                {src.sha256 ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: narrativeColors.textDim, overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid={`narrative-source-sha-${src.code}`}>{src.sha256}</Typography>
                    <IconButton size="small" onClick={() => void copy(src.sha256!)} sx={{ color: narrativeColors.textDim }} aria-label="Kopier sjekksum"><CopyIcon sx={{ fontSize: 13 }} /></IconButton>
                  </Stack>
                ) : <Typography sx={{ fontSize: 11, color: narrativeColors.warning }}>Ingen sjekksum</Typography>}
                {src.notes ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{src.notes}</Typography> : null}
              </Box>
              {src.verifiedAt ? <Chip size="small" icon={<VerifiedIcon sx={{ fontSize: 14 }} />} label={`Verifisert ${new Date(src.verifiedAt).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })}`} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} data-testid={`narrative-source-verified-${src.code}`} /> : (
                <Button size="small" onClick={() => void run(() => patchSource(projectId, src.id, { verified: true }), 'Kilden er markert verifisert.')} sx={{ color: narrativeColors.accent, fontSize: 11 }} data-testid={`narrative-source-verify-${src.code}`}>Marker verifisert</Button>
              )}
              <Tooltip title="Slett"><IconButton size="small" onClick={() => { if (window.confirm(`Slette kilden ${src.code}?`)) void run(() => deleteSource(projectId, src.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
            </Stack>
          ))}
        </Stack>
      ) : null}

      {/* Dialoger */}
      <Dialog open={!!newEpisode} onClose={() => setNewEpisode(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 360 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Ny episode</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Kode" value={newEpisode?.code ?? ''} onChange={(e) => setNewEpisode((v) => v && { ...v, code: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-episode-new-code' }} />
          <TextField size="small" label="Tittel" autoFocus value={newEpisode?.title ?? ''} onChange={(e) => setNewEpisode((v) => v && { ...v, title: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-episode-new-title' }} onKeyDown={(e) => { if (e.key === 'Enter' && newEpisode?.code) { void run(() => createEpisode(projectId, newEpisode), 'Episode opprettet.'); setNewEpisode(null); } }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewEpisode(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!newEpisode?.code.trim()} onClick={() => { if (newEpisode) { void run(() => createEpisode(projectId, newEpisode), 'Episode opprettet.'); setNewEpisode(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-episode-create">Opprett</Button></DialogActions>
      </Dialog>
      <Dialog open={!!newQuestion} onClose={() => setNewQuestion(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 420 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Nytt spørsmål / sjekkpunkt</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1}>
            <Select size="small" value={newQuestion?.kind ?? 'question'} onChange={(e) => setNewQuestion((v) => v && { ...v, kind: e.target.value as NarrativeQuestionKind, code: nextQuestionCode(questions, e.target.value as NarrativeQuestionKind) })} sx={{ ...sceneFieldSx, width: 150 }} MenuProps={menuProps}><MenuItem value="question">Spørsmål</MenuItem><MenuItem value="check">Sjekkpunkt</MenuItem></Select>
            <TextField size="small" label="Kode" value={newQuestion?.code ?? ''} onChange={(e) => setNewQuestion((v) => v && { ...v, code: e.target.value })} sx={sceneFieldSx} />
          </Stack>
          <TextField size="small" label="Spørsmål" autoFocus multiline minRows={2} value={newQuestion?.question ?? ''} onChange={(e) => setNewQuestion((v) => v && { ...v, question: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-question-new-text' }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewQuestion(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!newQuestion?.question.trim() || !newQuestion?.code.trim()} onClick={() => { if (newQuestion) { void run(() => createOpenQuestion(projectId, newQuestion), 'Lagt til.'); setNewQuestion(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-question-create">Legg til</Button></DialogActions>
      </Dialog>
      <Dialog open={!!decide} onClose={() => setDecide(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 420 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>{decide?.q.kind === 'check' ? 'Hva ble kontrollert?' : 'Beslutning'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, mb: 1.5 }}>{decide?.q.question}</Typography>
          <TextField size="small" fullWidth autoFocus multiline minRows={2} label={decide?.q.kind === 'check' ? 'Bevis / resultat' : 'Beslutning'} value={decide?.decision ?? ''} onChange={(e) => setDecide((v) => v && { ...v, decision: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-question-decision' }} />
        </DialogContent>
        <DialogActions><Button onClick={() => setDecide(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!decide?.decision.trim()} onClick={() => { if (decide) { void run(() => patchOpenQuestion(projectId, decide.q.id, { status: 'done', decision: decide.decision }), `${decide.q.code} avgjort.`); setDecide(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-question-decide-save">Lagre</Button></DialogActions>
      </Dialog>
      <Dialog open={!!newSource} onClose={() => setNewSource(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 460 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Ny kilde</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Kode" value={newSource?.code ?? ''} onChange={(e) => setNewSource((v) => v && { ...v, code: e.target.value })} placeholder="W, K, SCENE-PLAN-v3" sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-source-new-code' }} />
            <Select size="small" value={newSource?.kind ?? 'md'} onChange={(e) => setNewSource((v) => v && { ...v, kind: e.target.value as NarrativeSourceKind })} sx={{ ...sceneFieldSx, width: 110 }} MenuProps={menuProps}>{(['docx', 'pdf', 'md', 'txt', 'other'] as NarrativeSourceKind[]).map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}</Select>
          </Stack>
          <TextField size="small" label="Navn" value={newSource?.label ?? ''} onChange={(e) => setNewSource((v) => v && { ...v, label: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-source-new-label' }} />
          <TextField size="small" label="SHA-256 (valgfri)" value={newSource?.sha256 ?? ''} onChange={(e) => setNewSource((v) => v && { ...v, sha256: e.target.value.trim().toLowerCase() })} error={!!newSource?.sha256 && !/^[0-9a-f]{64}$/.test(newSource.sha256)} helperText="64 hex-tegn" sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-source-new-sha' }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewSource(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!newSource?.code.trim() || !newSource?.label.trim() || (!!newSource?.sha256 && !/^[0-9a-f]{64}$/.test(newSource.sha256))} onClick={() => { if (newSource) { void run(() => createSource(projectId, { code: newSource.code, label: newSource.label, kind: newSource.kind, sha256: newSource.sha256 || null }), 'Kilde lagt til.'); setNewSource(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-source-create">Legg til</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default StoryPanel;
