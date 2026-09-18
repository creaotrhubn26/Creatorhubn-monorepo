/**
 * Story Graph Fase 8b — «Importer manus»: Word/PDF/Markdown → scener og replikker.
 *
 * Alltid dry-run først: dokumentet analyseres på serveren, diffen vises (ny / endret /
 * uendret / mangler i dokumentet) og brukeren godkjenner før noe skrives. Det som
 * mangler i dokumentet blir åpne spørsmål — aldri sletting.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { narrativeColors } from '../narrativeTheme';
import {
  NarrativeApiError, applyDocumentImport, importDocumentDryRun,
  type ImportDiff, type ImportDocumentApplyResult, type ImportDocumentDryRun,
} from '../narrativeService';
import { sceneFieldSx } from './sceneUi';

export interface ImportDocumentDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onApplied: (result: ImportDocumentApplyResult) => void;
}

const FIELD_LABEL: Record<string, string> = {
  title: 'Tittel', subtitle: 'Undertittel', era: 'Epoke', beforeState: 'Før', action: 'Handling', control: 'Kontroll', afterState: 'Etter/utløser', audio: 'Lyd',
  speakerLabel: 'Taler', textEn: 'Engelsk tekst', sourceType: 'Type',
};
const ACCEPT = '.docx,.pdf,.md,.markdown,.txt';
const SOURCE_TAGS = ['W', 'K', 'U', 'A', 'E', 'T'];

type Phase = { kind: 'idle' } | { kind: 'analyzing' } | { kind: 'ready'; dry: ImportDocumentDryRun } | { kind: 'applying'; dry: ImportDocumentDryRun } | { kind: 'done'; result: ImportDocumentApplyResult };

function sourceKindOf(kind: ImportDocumentDryRun['kind']): 'docx' | 'pdf' | 'md' | 'txt' { return kind; }

function DiffText({ change }: { change: { from: string; to: string } }) {
  return (
    <Box sx={{ fontSize: 12, lineHeight: 1.5 }}>
      {change.from ? <Box component="span" sx={{ color: narrativeColors.textDim, textDecoration: 'line-through', mr: 1 }}>{change.from}</Box> : null}
      <Box component="span" sx={{ color: narrativeColors.accent }}>{change.to}</Box>
    </Box>
  );
}

export function ImportDocumentDialog({ open, projectId, onClose, onApplied }: ImportDocumentDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceCode, setSourceCode] = useState('W');
  const [sourceLabel, setSourceLabel] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [questionsOn, setQuestionsOn] = useState<Record<string, boolean>>({});

  const reset = useCallback(() => {
    setFile(null); setPhase({ kind: 'idle' }); setError(null); setExpanded({}); setQuestionsOn({});
  }, []);
  const close = useCallback(() => { if (phase.kind === 'analyzing' || phase.kind === 'applying') return; reset(); onClose(); }, [phase.kind, reset, onClose]);

  const analyze = useCallback(async () => {
    if (!file) return;
    setError(null); setPhase({ kind: 'analyzing' });
    try {
      const dry = await importDocumentDryRun(projectId, file);
      if (!sourceLabel.trim()) setSourceLabel(dry.title ?? file.name);
      const on: Record<string, boolean> = {};
      for (const s of dry.diff.missingInDoc.scenes) on[`scene:${s.sceneId}`] = true;
      for (const l of dry.diff.missingInDoc.lines) on[`line:${l.lineId}`] = true;
      setQuestionsOn(on);
      setPhase({ kind: 'ready', dry });
    } catch (err) {
      setPhase({ kind: 'idle' });
      if (err instanceof NarrativeApiError && err.status === 415) setError('Filtypen støttes ikke. Bruk .docx, .pdf, .md eller .txt.');
      else if (err instanceof NarrativeApiError && err.code === 'nothing_recognized') setError('Fant verken scener (### P01 — …) eller replikker (W01.01 …) i dokumentet. Se formatkravene.');
      else if (err instanceof NarrativeApiError && err.status === 413) setError('Dokumentet er for stort (maks 15 MB).');
      else setError(err instanceof Error ? err.message : 'Kunne ikke analysere dokumentet.');
    }
  }, [file, projectId, sourceLabel]);

  const openQuestions = useMemo(() => {
    if (phase.kind !== 'ready' && phase.kind !== 'applying') return [];
    const { diff } = phase.dry;
    const label = sourceLabel.trim() || phase.dry.fileName;
    const out: Array<{ question: string; context?: string; sceneCode?: string }> = [];
    for (const s of diff.missingInDoc.scenes) if (questionsOn[`scene:${s.sceneId}`]) out.push({ question: `Scene ${s.code} finnes ikke i «${label}» — utgår den, eller mangler den i manuset?`, sceneCode: s.code, context: 'Foreslått av manusimporten. Ingenting er slettet.' });
    for (const l of diff.missingInDoc.lines) if (questionsOn[`line:${l.lineId}`]) out.push({ question: `Replikk ${l.cueId} (scene ${l.code}) finnes ikke i «${label}» — stryke, eller mangler den i manuset?`, sceneCode: l.code, context: 'Foreslått av manusimporten. Replikken er beholdt.' });
    return out;
  }, [phase, questionsOn, sourceLabel]);

  const apply = useCallback(async () => {
    if (phase.kind !== 'ready') return;
    const { dry } = phase;
    setError(null); setPhase({ kind: 'applying', dry });
    try {
      const result = await applyDocumentImport(projectId, {
        sourceSha256: dry.sourceSha256, sourceCode: sourceCode.trim().toUpperCase() || 'W', sourceLabel: sourceLabel.trim() || dry.fileName,
        sourceKind: sourceKindOf(dry.kind), fileName: dry.fileName,
        create: dry.diff.create, update: dry.diff.update, openQuestions,
      });
      setPhase({ kind: 'done', result });
      onApplied(result);
    } catch (err) {
      setPhase({ kind: 'ready', dry });
      if (err instanceof NarrativeApiError && err.code === 'duplicate_code') setError('En scenekode ble tatt i bruk av noen andre mens du så på diffen — analyser på nytt.');
      else if (err instanceof NarrativeApiError && err.code === 'duplicate_cue') setError('En replikk-ID ble lagt til av noen andre mens du så på diffen — analyser på nytt.');
      else setError(err instanceof Error ? err.message : 'Kunne ikke bruke endringene.');
    }
  }, [phase, projectId, sourceCode, sourceLabel, openQuestions, onApplied]);

  const busy = phase.kind === 'analyzing' || phase.kind === 'applying';
  const dry = phase.kind === 'ready' || phase.kind === 'applying' ? phase.dry : null;
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderDiff = (diff: ImportDiff) => (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap data-testid="narrative-import-summary">
        <Chip size="small" label={`${diff.stats.create} nye scener`} sx={{ bgcolor: 'rgba(34,197,94,0.15)', color: narrativeColors.accent }} />
        <Chip size="small" label={`${diff.stats.update} endrede`} sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: narrativeColors.warning }} />
        <Chip size="small" label={`${diff.stats.unchanged} uendret`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.textDim }} />
        <Chip size="small" label={`+${diff.stats.linesCreate} / ~${diff.stats.linesUpdate} replikker`} sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.text }} />
        {diff.stats.missingScenes + diff.stats.missingLines > 0 ? <Chip size="small" label={`${diff.stats.missingScenes + diff.stats.missingLines} mangler i dokumentet`} sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#f87171' }} /> : null}
      </Stack>
      {diff.warnings.length > 0 ? (
        <Alert severity="warning" sx={{ fontSize: 12 }} data-testid="narrative-import-warnings">
          <Box component="ul" sx={{ m: 0, pl: 2 }}>{diff.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}</Box>
        </Alert>
      ) : null}

      {diff.create.map((c) => {
        const key = `c:${c.code}`;
        return (
          <Box key={key} sx={{ border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, p: 1 }} data-testid={`narrative-import-row-${c.code}`}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label="NY" sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: narrativeColors.accent, fontWeight: 800, height: 20 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{c.code} — {c.scene.title || 'Uten tittel'}</Typography>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{c.scene.lines.length} replikker · epoke {c.scene.era}</Typography>
              <IconButton size="small" onClick={() => toggle(key)} aria-label="Vis detaljer" sx={{ color: narrativeColors.textDim, transform: expanded[key] ? 'rotate(180deg)' : 'none' }}><ExpandMoreIcon fontSize="small" /></IconButton>
            </Stack>
            <Collapse in={!!expanded[key]}>
              <Stack spacing={0.5} sx={{ mt: 1, pl: 1 }}>
                {(Object.keys(c.scene.fields) as Array<keyof typeof c.scene.fields>).filter((k) => c.scene.fields[k]).map((k) => (
                  <Typography key={k} sx={{ fontSize: 12 }}><Box component="span" sx={{ color: narrativeColors.textDim }}>{FIELD_LABEL[k]}: </Box>{c.scene.fields[k]}</Typography>
                ))}
                {c.scene.lines.map((l) => <Typography key={l.cueId} sx={{ fontSize: 12 }}><Box component="span" sx={{ color: narrativeColors.textDim }}>{l.cueId} {l.speakerLabel}: </Box>{l.textEn}</Typography>)}
              </Stack>
            </Collapse>
          </Box>
        );
      })}

      {diff.update.map((u) => {
        const key = `u:${u.sceneId}`;
        const fieldKeys = Object.keys(u.changes) as Array<keyof typeof u.changes>;
        return (
          <Box key={key} sx={{ border: `1px solid ${narrativeColors.borderSoft}`, borderRadius: 1.5, p: 1 }} data-testid={`narrative-import-row-${u.code}`}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Chip size="small" label="ENDRET" sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: narrativeColors.warning, fontWeight: 800, height: 20 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{u.code}</Typography>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
                {fieldKeys.length ? `${fieldKeys.map((k) => FIELD_LABEL[k]).join(', ')}` : 'ingen feltendringer'}
                {u.lines.create.length ? ` · +${u.lines.create.length} replikker` : ''}{u.lines.update.length ? ` · ~${u.lines.update.length} replikker` : ''}
              </Typography>
              <IconButton size="small" onClick={() => toggle(key)} aria-label="Vis detaljer" sx={{ color: narrativeColors.textDim, transform: expanded[key] ? 'rotate(180deg)' : 'none' }}><ExpandMoreIcon fontSize="small" /></IconButton>
            </Stack>
            <Collapse in={!!expanded[key]}>
              <Stack spacing={0.75} sx={{ mt: 1, pl: 1 }}>
                {fieldKeys.map((k) => (
                  <Box key={k}><Typography sx={{ fontSize: 11, color: narrativeColors.textDim, fontWeight: 700 }}>{FIELD_LABEL[k]}</Typography><DiffText change={u.changes[k]!} /></Box>
                ))}
                {u.lines.create.map((l) => <Typography key={l.cueId} sx={{ fontSize: 12 }}><Chip size="small" label="+" sx={{ height: 18, mr: 0.5, bgcolor: 'rgba(34,197,94,0.2)', color: narrativeColors.accent }} /><Box component="span" sx={{ color: narrativeColors.textDim }}>{l.cueId} {l.speakerLabel}: </Box>{l.textEn}</Typography>)}
                {u.lines.update.map((l) => (
                  <Box key={l.lineId}>
                    <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, fontWeight: 700 }}>{l.cueId} · {Object.keys(l.changes).map((k) => FIELD_LABEL[k]).join(', ')}</Typography>
                    {(Object.keys(l.changes) as Array<keyof typeof l.changes>).map((k) => <DiffText key={k} change={l.changes[k]!} />)}
                  </Box>
                ))}
              </Stack>
            </Collapse>
          </Box>
        );
      })}

      {diff.missingInDoc.scenes.length + diff.missingInDoc.lines.length > 0 ? (
        <Box sx={{ border: `1px solid rgba(239,68,68,0.35)`, borderRadius: 1.5, p: 1 }} data-testid="narrative-import-missing">
          <Typography sx={{ fontSize: 12, fontWeight: 800, mb: 0.5 }}>I prosjektet, men ikke i dokumentet</Typography>
          <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 0.5 }}>Ingenting slettes. Avkrysset = det opprettes et åpent spørsmål til neste manusgjennomgang.</Typography>
          {diff.missingInDoc.scenes.map((s) => (
            <FormControlLabel key={s.sceneId} sx={{ display: 'flex', m: 0 }} control={<Checkbox size="small" checked={!!questionsOn[`scene:${s.sceneId}`]} onChange={(e) => setQuestionsOn((p) => ({ ...p, [`scene:${s.sceneId}`]: e.target.checked }))} inputProps={{ 'data-testid': `narrative-import-missing-scene-${s.code}` } as never} />} label={<Typography sx={{ fontSize: 12 }}>Scene {s.code}</Typography>} />
          ))}
          {diff.missingInDoc.lines.map((l) => (
            <FormControlLabel key={l.lineId} sx={{ display: 'flex', m: 0 }} control={<Checkbox size="small" checked={!!questionsOn[`line:${l.lineId}`]} onChange={(e) => setQuestionsOn((p) => ({ ...p, [`line:${l.lineId}`]: e.target.checked }))} inputProps={{ 'data-testid': `narrative-import-missing-${l.cueId}` } as never} />} label={<Typography sx={{ fontSize: 12 }}>Replikk {l.cueId} (scene {l.code})</Typography>} />
          ))}
        </Box>
      ) : null}
    </Stack>
  );

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-import-dialog' } as never}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Importer manus</DialogTitle>
      <DialogContent>
        {phase.kind === 'done' ? (
          <Alert severity="success" data-testid="narrative-import-result" sx={{ mt: 1 }}>
            Importert fra «{phase.result.source.label}»: {phase.result.createdSceneIds.length} nye scener, {phase.result.updatedSceneIds.length} oppdatert,
            {' '}{phase.result.linesCreated} nye og {phase.result.linesUpdated} endrede replikker{phase.result.openQuestionsCreated ? `, ${phase.result.openQuestionsCreated} åpne spørsmål` : ''}.
            Kilderegisteret har SHA-256 for dokumentet.
          </Alert>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>
              Word (.docx), PDF, Markdown eller tekst med scener som «### P01 — Tittel · W01 · 1797», feltene Før/Handling/Kontroll/Etter/Lyd
              og replikk-tabeller «| W01.01 | NORA | E | tekst |». Alt vises som en diff før noe skrives.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent, whiteSpace: 'nowrap' }}>
                {file ? 'Bytt fil' : 'Velg fil'}
                <input type="file" hidden accept={ACCEPT} data-testid="narrative-import-file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPhase({ kind: 'idle' }); setError(null); }} />
              </Button>
              <Typography sx={{ fontSize: 12, color: file ? narrativeColors.text : narrativeColors.textDim, flex: 1 }} data-testid="narrative-import-filename">{file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} kB` : 'Ingen fil valgt'}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Kildekode i kilderegisteret. W/K/U/A/E/T brukes også som kildemerke på feltene.">
                <TextField size="small" label="Kildekode" value={sourceCode} onChange={(e) => setSourceCode(e.target.value.toUpperCase())} inputProps={{ 'data-testid': 'narrative-import-source-code', maxLength: 40, list: 'narrative-import-source-tags' }} sx={{ ...sceneFieldSx, width: 140 }} disabled={busy} />
              </Tooltip>
              <datalist id="narrative-import-source-tags">{SOURCE_TAGS.map((t) => <option key={t} value={t} />)}</datalist>
              <TextField size="small" label="Etikett" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="F.eks. Spillmanus v3" inputProps={{ 'data-testid': 'narrative-import-source-label', maxLength: 300 }} sx={{ ...sceneFieldSx, flex: 1 }} disabled={busy} />
              <Button variant="contained" onClick={() => void analyze()} disabled={!file || busy} data-testid="narrative-import-analyze" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { bgcolor: narrativeColors.accentDark } }}>
                {phase.kind === 'analyzing' ? <CircularProgress size={16} sx={{ color: '#04140a' }} /> : 'Analyser'}
              </Button>
            </Stack>
            {error ? <Alert severity="error" data-testid="narrative-import-error">{error}</Alert> : null}
            {dry ? (
              <Box>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{dry.fileName} · {dry.kind.toUpperCase()} · SHA-256 {dry.sourceSha256.slice(0, 12)}… · {dry.stats.scenes} scener og {dry.stats.lines} replikker gjenkjent</Typography>
                {renderDiff(dry.diff)}
              </Box>
            ) : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={busy} sx={{ color: narrativeColors.textDim }}>{phase.kind === 'done' ? 'Lukk' : 'Avbryt'}</Button>
        {phase.kind !== 'done' ? (
          <Button variant="contained" onClick={() => void apply()} disabled={!dry || busy || (dry.diff.create.length + dry.diff.update.length + openQuestions.length === 0)} data-testid="narrative-import-apply" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>
            {phase.kind === 'applying' ? <CircularProgress size={16} sx={{ color: '#04140a' }} /> : 'Bruk endringer'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
