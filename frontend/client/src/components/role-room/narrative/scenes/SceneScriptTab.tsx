/**
 * SceneScriptTab — «Manus»: Før / Handling / Kontroll / Etter-utløser / Lyd,
 * epoke, episode, arbeids-ID, kildemerker og (bak «Vis mer») endring/bro/
 * tidsnote + de seks kunnskapsfeltene. Autosave ved blur. Fase 7c.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Collapse, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon, ExpandMore as MoreIcon, ExpandLess as LessIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import {
  NARRATIVE_KNOWLEDGE_LABELS, NARRATIVE_SCENE_ERAS, NARRATIVE_SCENE_ERA_LABELS, NARRATIVE_SOURCE_TAGS, NARRATIVE_SOURCE_TAG_LABELS,
  type NarrativeEpisode, type NarrativeSceneDetail, type NarrativeSceneEra, type NarrativeSceneKnowledge, type NarrativeSource, type NarrativeSourceRef, type NarrativeSourceTag,
} from '../narrativeTypes';
import { listEpisodes, listSources } from '../narrativeService';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { AutosaveField, SectionTitle, sceneFieldSx } from './sceneUi';

const SCRIPT_FIELDS: Array<{ key: 'beforeState' | 'action' | 'control' | 'afterState' | 'audio'; label: string; placeholder: string }> = [
  { key: 'beforeState', label: 'Før', placeholder: 'Tilstanden når scenen starter: hvem er hvor, hva bærer de, hva vet de.' },
  { key: 'action', label: 'Handling', placeholder: 'Hva skjer — kildehendelsen, i rekkefølge.' },
  { key: 'control', label: 'Kontroll', placeholder: 'Hva spilleren kan gjøre, og hva som IKKE skal skje ved utforsking.' },
  { key: 'afterState', label: 'Etter / utløser', placeholder: 'Tilstanden som må være sann for at neste scene kan starte.' },
  { key: 'audio', label: 'Lyd', placeholder: 'Foley, tale, miljø — og hva som ikke skal legges på.' },
];
const MORE_FIELDS: Array<{ key: 'changeNote' | 'bridge' | 'timeNote'; label: string; placeholder: string }> = [
  { key: 'changeNote', label: 'Endring', placeholder: 'Hva publikum/spilleren forstår annerledes etter scenen.' },
  { key: 'bridge', label: 'Bro', placeholder: 'Overgangen til neste scene.' },
  { key: 'timeNote', label: 'Tidsnote', placeholder: 'F.eks. «nåtid 1817 / barndomsminne 1797».' },
];
const KNOWLEDGE_KEYS = Object.keys(NARRATIVE_KNOWLEDGE_LABELS) as Array<keyof NarrativeSceneKnowledge>;

export function SceneScriptTab({ projectId, detail, scenes, refreshKey = 0 }: { projectId: string; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult; refreshKey?: number }) {
  const { scene } = detail;
  const save = (patch: Parameters<UseNarrativeScenesResult['patchScene']>[1]) => scenes.patchScene(scene.id, patch);
  const [episodes, setEpisodes] = useState<NarrativeEpisode[]>([]);
  const [sources, setSources] = useState<NarrativeSource[]>([]);
  const [more, setMore] = useState(() => !!(scene.changeNote || scene.bridge || scene.timeNote || Object.values(scene.knowledge ?? {}).some(Boolean)));
  const [refTag, setRefTag] = useState<NarrativeSourceTag>('W');
  const [refCode, setRefCode] = useState('');
  const [refField, setRefField] = useState('');
  useEffect(() => {
    let cancelled = false;
    void Promise.all([listEpisodes(projectId), listSources(projectId)]).then(([e, s]) => { if (!cancelled) { setEpisodes(e); setSources(s); } }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId, refreshKey]);
  const sourceByCode = useMemo(() => new Map(sources.map((s) => [s.code.toUpperCase(), s])), [sources]);

  const addRef = async () => {
    if (!refCode.trim()) return;
    const next: NarrativeSourceRef[] = [...scene.sourceRefs, { tag: refTag, ref: refCode.trim().toUpperCase(), ...(refField ? { field: refField } : {}) }];
    await save({ sourceRefs: next });
    setRefField('');
  };
  const removeRef = async (i: number) => { await save({ sourceRefs: scene.sourceRefs.filter((_, idx) => idx !== i) }); };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 900 }} data-testid="narrative-scene-script">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        <FormControl size="small" sx={sceneFieldSx}>
          <InputLabel>Epoke</InputLabel>
          <Select label="Epoke" value={scene.era} onChange={(e) => void save({ era: e.target.value as NarrativeSceneEra })} inputProps={{ 'data-testid': 'narrative-scene-era', 'aria-label': 'Epoke' }} MenuProps={{ PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } }}>
            {NARRATIVE_SCENE_ERAS.map((era) => <MenuItem key={era} value={era}>{NARRATIVE_SCENE_ERA_LABELS[era]}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={sceneFieldSx}>
          <InputLabel>Episode</InputLabel>
          <Select label="Episode" value={scene.episodeId && episodes.some((ep) => ep.id === scene.episodeId) ? scene.episodeId : ''} onChange={(e) => void save({ episodeId: e.target.value ? String(e.target.value) : null })} inputProps={{ 'data-testid': 'narrative-scene-episode', 'aria-label': 'Episode' }} MenuProps={{ PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } }}>
            <MenuItem value="">Ingen</MenuItem>
            {episodes.map((ep) => <MenuItem key={ep.id} value={ep.id}>{ep.code} · {ep.title}</MenuItem>)}
          </Select>
        </FormControl>
        <AutosaveField label="Arbeids-ID (dokument)" value={scene.workingId ?? ''} onSave={(v) => save({ workingId: v.trim() || null })} placeholder="P01, G03A, H01" testId="narrative-scene-working-id" maxLength={40} />
      </Box>

      {SCRIPT_FIELDS.map((f) => (
        <AutosaveField key={f.key} label={f.label} multiline minRows={3} value={scene[f.key]} onSave={(v) => save({ [f.key]: v })} placeholder={f.placeholder} testId={`narrative-scene-field-${f.key}`} maxLength={20_000} />
      ))}

      <Box>
        <SectionTitle>Kildemerker</SectionTitle>
        <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 1 }}>Skill kildehendelse (W/K), brukertillegg (U), iscenesettelsesforslag (A), bevart engelsk (E) og ny oversettelse (T). Referansen peker på kilderegisteret under Historie.</Typography>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mb: 1 }} useFlexGap data-testid="narrative-scene-source-refs">
          {scene.sourceRefs.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen kildemerker ennå.</Typography> : null}
          {scene.sourceRefs.map((r, i) => (
            <Chip key={`${r.tag}-${r.ref}-${i}`} size="small" onDelete={() => void removeRef(i)} title={`${NARRATIVE_SOURCE_TAG_LABELS[r.tag]} · ${sourceByCode.get(r.ref.toUpperCase())?.label ?? r.ref}${r.note ? ` · ${r.note}` : ''}`}
              label={`${r.tag} · ${r.ref}${r.field ? ` (${r.field})` : ''}`} sx={{ bgcolor: r.tag === 'W' || r.tag === 'K' ? narrativeColors.accentSoft : 'rgba(255,255,255,0.06)', color: r.tag === 'W' || r.tag === 'K' ? narrativeColors.accent : narrativeColors.text }} data-testid={`narrative-scene-source-ref-${i}`} />
          ))}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap alignItems="center">
          <FormControl size="small" sx={{ ...sceneFieldSx, minWidth: 120 }}>
            <InputLabel>Merke</InputLabel>
            <Select label="Merke" value={refTag} onChange={(e) => setRefTag(e.target.value as NarrativeSourceTag)} inputProps={{ 'aria-label': 'Merke' }} MenuProps={{ PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } }}>
              {NARRATIVE_SOURCE_TAGS.map((t) => <MenuItem key={t} value={t}>{t} · {NARRATIVE_SOURCE_TAG_LABELS[t]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ ...sceneFieldSx, minWidth: 220 }}>
            <InputLabel>Kilde</InputLabel>
            <Select label="Kilde" value={refCode} onChange={(e) => setRefCode(String(e.target.value))} inputProps={{ 'data-testid': 'narrative-scene-source-ref-code', 'aria-label': 'Kilde' }} MenuProps={{ PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } }}>
              {sources.map((s) => <MenuItem key={s.id} value={s.code}>{s.code} · {s.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Felt (valgfritt)" value={refField} onChange={(e) => setRefField(e.target.value)} placeholder="action" sx={{ ...sceneFieldSx, width: 160 }} />
          <Button size="small" startIcon={<AddIcon />} disabled={!refCode} onClick={() => void addRef()} sx={{ color: narrativeColors.accent }} data-testid="narrative-scene-source-ref-add">Legg til</Button>
        </Stack>
      </Box>

      <Button size="small" startIcon={more ? <LessIcon /> : <MoreIcon />} onClick={() => setMore((m) => !m)} sx={{ alignSelf: 'flex-start', color: narrativeColors.textDim }} data-testid="narrative-scene-script-more">
        {more ? 'Vis mindre' : 'Vis mer: endring, bro, tidsnote og kunnskapsfelt'}
      </Button>
      <Collapse in={more}>
        <Stack spacing={2}>
          {MORE_FIELDS.map((f) => (
            <AutosaveField key={f.key} label={f.label} multiline={f.key !== 'timeNote'} minRows={2} value={scene[f.key]} onSave={(v) => save({ [f.key]: v })} placeholder={f.placeholder} testId={`narrative-scene-field-${f.key}`} maxLength={f.key === 'timeNote' ? 2000 : 20_000} />
          ))}
          <SectionTitle>Kunnskap (SCENE-PLAN §E)</SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
            {KNOWLEDGE_KEYS.map((k) => (
              <AutosaveField key={k} label={NARRATIVE_KNOWLEDGE_LABELS[k]} multiline minRows={2} value={scene.knowledge?.[k] ?? ''} onSave={(v) => save({ knowledge: { ...scene.knowledge, [k]: v } })} testId={`narrative-scene-knowledge-${k}`} maxLength={5000} />
            ))}
          </Box>
        </Stack>
      </Collapse>
    </Stack>
  );
}
