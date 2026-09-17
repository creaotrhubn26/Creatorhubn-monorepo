/**
 * SceneCard — «S12 – Skogpassasjen»: header (tittel, status, lagret-indikator)
 * + faner Oversikt | Storyboard | Gameplay | Assets | Oppgaver | Review.
 *
 * Alle felt lagrer ved blur (AutosaveField) — ingen «Lagre»-knapp å glemme.
 * Fanevalg bevares i ?sceneTab= så en lenke til en review-runde lander riktig.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Chip, Divider, IconButton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, OpenInNew as OpenIcon, PhotoLibrary as AssetsIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import { htmlToText, type NarrativeGraph, type NarrativeSceneDetail, type NarrativeSceneLinkKind } from '../narrativeTypes';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { AutosaveField, EmptyHint, SaveIndicator, SceneStatusChip, SectionTitle, sceneFieldSx } from './sceneUi';
import { dateInputToIso, frameImageUrl, isOverdue, isoToDateInput, sceneLabel } from './sceneOps';
import { MemberPicker } from '../components/MemberPicker';
import { requestNarrativeTab } from '../../game/GameBillingPanels';
import { SceneStoryboardTab } from './SceneStoryboardTab';
import { SceneTasksTab } from './SceneTasksTab';
import { SceneReviewTab } from './SceneReviewTab';

export type SceneTabId = 'overview' | 'storyboard' | 'gameplay' | 'assets' | 'tasks' | 'review';
const SCENE_TABS: Array<{ id: SceneTabId; label: string }> = [
  { id: 'overview', label: 'Oversikt' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'assets', label: 'Assets' },
  { id: 'tasks', label: 'Oppgaver' },
  { id: 'review', label: 'Review' },
];

function readTab(): SceneTabId {
  try {
    const v = new URLSearchParams(window.location.search).get('sceneTab');
    return SCENE_TABS.some((t) => t.id === v) ? (v as SceneTabId) : 'overview';
  } catch { return 'overview'; }
}

export interface SceneCardProps {
  projectId: string;
  graph: NarrativeGraph;
  detail: NarrativeSceneDetail;
  scenes: UseNarrativeScenesResult;
  onJumpToElement: (elementId: string) => void;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}

interface LinkOption { key: string; ownerKind: NarrativeSceneLinkKind; ownerId: string; label: string; sub: string }

export function SceneCard({ projectId, graph, detail, scenes, onJumpToElement, onNotice }: SceneCardProps) {
  const { scene } = detail;
  const [tab, setTab] = useState<SceneTabId>(readTab);
  useEffect(() => {
    try { const url = new URL(window.location.href); url.searchParams.set('sceneTab', tab); window.history.replaceState({}, '', url.toString()); } catch { /* ignore */ }
  }, [tab]);
  const [editingTitle, setEditingTitle] = useState(false);

  const save = (patch: Parameters<UseNarrativeScenesResult['patchScene']>[1]) => scenes.patchScene(scene.id, patch);

  const boardName = useMemo(() => new Map(graph.boards.map((b) => [b.id, b.name])), [graph.boards]);
  const linkOptions = useMemo<LinkOption[]>(() => [
    ...graph.elements.filter((e) => e.kind === 'element' || e.kind === 'branch').map((e) => ({
      key: `element:${e.id}`, ownerKind: 'element' as const, ownerId: e.id,
      label: htmlToText(e.titleHtml) || (e.kind === 'branch' ? 'Forgrening' : 'Uten tittel'), sub: boardName.get(e.boardId) ?? '',
    })),
    ...graph.boards.map((b) => ({ key: `board:${b.id}`, ownerKind: 'board' as const, ownerId: b.id, label: b.name, sub: 'Brett' })),
  ], [graph.elements, graph.boards, boardName]);
  const linkedOptions = useMemo(() => detail.links
    .map((l) => linkOptions.find((o) => o.ownerKind === l.ownerKind && o.ownerId === l.ownerId) ?? { key: `${l.ownerKind}:${l.ownerId}`, ownerKind: l.ownerKind, ownerId: l.ownerId, label: '(slettet)', sub: '' })
  , [detail.links, linkOptions]);

  const [heroBroken, setHeroBroken] = useState<string | null>(null);
  const heroUrl = useMemo(() => {
    if (scene.heroAssetId) { const a = graph.assets.find((x) => x.id === scene.heroAssetId); if (a?.externalUrl) return a.externalUrl; }
    for (const f of detail.frames) { const u = frameImageUrl(f, graph.assets); if (u) return u; }
    return null;
  }, [scene.heroAssetId, detail.frames, graph.assets]);

  const openInGraph = (elementId: string) => { onJumpToElement(elementId); };

  const linkedBlock = (
    <Box>
      <SectionTitle action={<Button size="small" onClick={() => setTab('gameplay')} sx={{ color: narrativeColors.accent, fontSize: 11 }}>Rediger koblinger</Button>}>Story Graph</SectionTitle>
      {linkedOptions.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen elementer koblet ennå. Koble scenen til elementene den dekker under Gameplay.</Typography>
      ) : (
        <Stack spacing={0.5}>
          {linkedOptions.map((o) => (
            <Stack key={o.key} direction="row" spacing={1} alignItems="center" data-testid={`narrative-scene-linked-${o.ownerId}`}>
              <Chip size="small" label={o.ownerKind === 'board' ? 'Brett' : 'Element'} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.textDim }} />
              <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}{o.sub ? <Typography component="span" sx={{ fontSize: 11, color: narrativeColors.textDim }}> · {o.sub}</Typography> : null}</Typography>
              {o.ownerKind === 'element' ? (
                <Button size="small" endIcon={<OpenIcon sx={{ fontSize: 14 }} />} onClick={() => openInGraph(o.ownerId)} data-testid={`narrative-scene-open-element-${o.ownerId}`} sx={{ color: narrativeColors.accent, fontSize: 11, whiteSpace: 'nowrap' }}>Åpne i Story Graph</Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' }, gap: 3 }}>
            <Stack spacing={2.5}>
              {heroUrl && heroBroken !== heroUrl ? (
                <Box component="img" src={heroUrl} alt={sceneLabel(scene)} onError={() => setHeroBroken(heroUrl)} sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 2, border: `1px solid ${narrativeColors.borderStrong}`, display: 'block' }} data-testid="narrative-scene-hero" />
              ) : (
                <EmptyHint title="Ingen bilde ennå" body="Første storyboard-ramme brukes som scenebilde." testId="narrative-scene-hero-empty"
                  action={<Button size="small" variant="outlined" onClick={() => setTab('storyboard')} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent }}>Legg til ramme</Button>} />
              )}
              <AutosaveField label="Undertittel / logline" value={scene.subtitle} onSave={(v) => save({ subtitle: v })} placeholder="Én setning om hva scenen gjør for historien" testId="narrative-scene-field-subtitle" maxLength={300} />
              {linkedBlock}
            </Stack>
            <Stack spacing={1.5} sx={{ p: 2, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, alignSelf: 'start' }} data-testid="narrative-scene-sidebar">
              <AutosaveField label="Lokasjon" value={scene.location} onSave={(v) => save({ location: v })} testId="narrative-scene-field-location" maxLength={2000} />
              <Box>
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 0.5 }}>Status</Typography>
                <SceneStatusChip status={scene.status} onChange={(s) => void save({ status: s })} testId="narrative-scene-status" size="medium" />
              </Box>
              <MemberPicker projectId={projectId} value={scene.assigneeUserId} onChange={(id) => void save({ assigneeUserId: id })} testId="narrative-scene-field-assignee" />
              <AutosaveField label="Forventet ferdig" type="date" value={isoToDateInput(scene.dueAt)} onSave={(v) => save({ dueAt: dateInputToIso(v) })} testId="narrative-scene-field-due"
                helperText={isOverdue(scene.dueAt, scene.status) ? 'Fristen er passert.' : undefined} />
              <Divider sx={{ borderColor: narrativeColors.borderStrong }} />
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{detail.tasks.filter((t) => t.status === 'done').length}/{detail.tasks.length} oppgaver · {detail.frames.length} rammer · {detail.reviews.length} runder</Typography>
            </Stack>
          </Box>
        );
      case 'gameplay':
        return (
          <Stack spacing={2} sx={{ maxWidth: 820 }}>
            <AutosaveField label="Utfordring" multiline value={scene.challenge} onSave={(v) => save({ challenge: v })} placeholder="Hva må spilleren løse eller overvinne her?" testId="narrative-scene-field-challenge" maxLength={5000} />
            <AutosaveField label="Spillmekanikk" multiline value={scene.gameplayMechanic} onSave={(v) => save({ gameplayMechanic: v })} placeholder="Mekanikker i bruk: stealth, dialogvalg, puzzle …" testId="narrative-scene-field-mechanic" maxLength={5000} />
            <AutosaveField label="Miljø" multiline value={scene.environment} onSave={(v) => save({ environment: v })} placeholder="Tid på døgnet, vær, stemning, lyd" testId="narrative-scene-field-environment" maxLength={5000} />
            <Box>
              <SectionTitle>Koblede elementer og brett</SectionTitle>
              <Autocomplete
                multiple size="small" options={linkOptions} value={linkedOptions}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                getOptionLabel={(o) => o.label}
                groupBy={(o) => (o.ownerKind === 'board' ? 'Brett' : `Brett: ${o.sub || '–'}`)}
                onChange={(_e, next) => { void scenes.setLinks(next.map((o) => ({ ownerKind: o.ownerKind, ownerId: o.ownerId }))); }}
                renderOption={(props, o) => <Box component="li" {...props} key={o.key} data-testid={`narrative-scene-link-option-${o.ownerId}`} sx={{ fontSize: 13 }}>{o.label}</Box>}
                renderTags={(value, getTagProps) => value.map((o, i) => <Chip {...getTagProps({ index: i })} key={o.key} size="small" label={o.label} data-testid={`narrative-scene-link-chip-${o.ownerId}`} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />)}
                renderInput={(params) => <TextField {...params} label="Elementer / brett i Story Graph" placeholder="Søk etter element…" inputProps={{ ...params.inputProps, 'data-testid': 'narrative-scene-link-picker' }} sx={sceneFieldSx} />}
                noOptionsText="Ingen elementer — lag dem i Brett-fanen først."
              />
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 0.5 }}>Koblingen gjør at review-runden fryser elementtitlene, og at «Åpne i Story Graph» går rett til riktig node.</Typography>
            </Box>
            {linkedBlock}
          </Stack>
        );
      case 'storyboard':
        return <SceneStoryboardTab projectId={projectId} graph={graph} detail={detail} scenes={scenes} onNotice={onNotice} />;
      case 'assets': {
        const imageAssets = graph.assets.filter((a) => a.kind === 'image');
        const cards = [
          ...(scene.heroAssetId ? [{ key: 'hero', url: graph.assets.find((a) => a.id === scene.heroAssetId)?.externalUrl ?? null, label: 'Scenebilde' }] : []),
          ...detail.frames.map((f, i) => ({ key: f.id, url: frameImageUrl(f, graph.assets), label: f.caption || `Ramme ${i + 1}` })),
        ];
        return (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
              <Autocomplete
                size="small" options={imageAssets} getOptionLabel={(a) => a.name} sx={{ minWidth: 320 }}
                onChange={(_e, a) => { if (a) void scenes.addFrame({ assetId: a.id, caption: a.name }); }}
                value={null}
                renderInput={(params) => <TextField {...params} label="Legg til fra ressurser" placeholder="Velg et bilde…" inputProps={{ ...params.inputProps, 'data-testid': 'narrative-scene-asset-picker' }} sx={sceneFieldSx} />}
                noOptionsText="Ingen bilde-ressurser i prosjektet."
              />
              <Button size="small" startIcon={<AssetsIcon />} onClick={() => requestNarrativeTab('assets')} sx={{ color: narrativeColors.accent }} data-testid="narrative-scene-open-assets">Åpne Ressurser-fanen</Button>
            </Stack>
            {cards.length === 0 ? (
              <EmptyHint title="Ingen assets på scenen" body="Rammer fra storyboardet og scenebildet vises her. Ressurser administreres i Ressurser-fanen — én sannhetskilde." testId="narrative-scene-assets-empty" />
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }} data-testid="narrative-scene-assets-grid">
                {cards.map((c) => (
                  <Box key={c.key} sx={{ borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel }}>
                    {c.url ? <Box component="img" src={c.url} alt={c.label} loading="lazy" sx={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} /> : <Box sx={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: narrativeColors.textDim }}>Ingen forhåndsvisning</Box>}
                    <Typography sx={{ fontSize: 11, p: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Stack>
        );
      }
      case 'tasks':
        return <SceneTasksTab projectId={projectId} detail={detail} scenes={scenes} />;
      case 'review':
        return <SceneReviewTab projectId={projectId} detail={detail} scenes={scenes} onNotice={onNotice} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }} data-testid={`narrative-scene-card-${scene.id}`}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <Stack spacing={1} sx={{ maxWidth: 560 }}>
              <AutosaveField label="Tittel" value={scene.title} onSave={(v) => save({ title: v })} testId="narrative-scene-field-title" maxLength={300} />
              <AutosaveField label="Kode" value={scene.code} onSave={(v) => save({ code: v.trim().toUpperCase() })} testId="narrative-scene-field-code" helperText="1–3 bokstaver + 1–4 sifre. Må være unik i prosjektet." maxLength={7} />
              <Button size="small" onClick={() => setEditingTitle(false)} sx={{ alignSelf: 'flex-start', color: narrativeColors.textDim }}>Ferdig</Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="narrative-scene-title">
                <Typography component="span" sx={{ fontSize: 20, fontWeight: 800, color: narrativeColors.accent }}>{scene.code}</Typography> – {scene.title || 'Uten tittel'}
              </Typography>
              <Tooltip title="Rediger tittel og kode"><IconButton size="small" onClick={() => setEditingTitle(true)} sx={{ color: narrativeColors.textDim }} aria-label="Rediger" data-testid="narrative-scene-edit-title"><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </Stack>
          )}
          {scene.subtitle && !editingTitle ? <Typography sx={{ fontSize: 13, color: narrativeColors.textDim, mt: 0.25 }}>{scene.subtitle}</Typography> : null}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0, pt: 0.5 }}>
          <SaveIndicator state={scenes.saveState} />
          <SceneStatusChip status={scene.status} onChange={(s) => void save({ status: s })} testId="narrative-scene-header-status" />
          <Tooltip title="Slett scene">
            <IconButton size="small" onClick={() => { if (window.confirm(`Slette ${sceneLabel(scene)}? Rammer, oppgaver og runder slettes også.`)) void scenes.deleteScene(scene.id).then(() => onNotice('Scenen er slettet.', 'success')).catch((err: unknown) => onNotice(err instanceof Error ? err.message : 'Kunne ikke slette.', 'error')); }} sx={{ color: narrativeColors.textDim, '&:hover': { color: narrativeColors.error } }} aria-label="Slett scene" data-testid="narrative-scene-delete">
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Tabs
        value={tab} onChange={(_e, v) => setTab(v as SceneTabId)} variant="scrollable" scrollButtons="auto"
        sx={{ minHeight: 36, mb: 2, borderBottom: `1px solid ${narrativeColors.borderStrong}`, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 36, fontSize: 13, px: 1.5 }, '& .Mui-selected': { color: '#fff' }, '& .MuiTabs-indicator': { bgcolor: narrativeColors.accent } }}
      >
        {SCENE_TABS.map((t) => {
          const badge = t.id === 'tasks' && detail.tasks.length ? ` ${detail.tasks.filter((x) => x.status === 'done').length}/${detail.tasks.length}` : t.id === 'storyboard' && detail.frames.length ? ` ${detail.frames.length}` : t.id === 'review' && detail.reviews.some((r) => r.status === 'in_review') ? ' •' : '';
          return <Tab key={t.id} value={t.id} label={`${t.label}${badge}`} data-testid={`narrative-scene-tab-${t.id}`} />;
        })}
      </Tabs>
      {renderTab()}
    </Box>
  );
}
