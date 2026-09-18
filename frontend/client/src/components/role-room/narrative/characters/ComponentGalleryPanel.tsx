/**
 * ComponentGalleryPanel — «Karakterer» / «Lokasjoner» (Fase 7c): kortgalleri
 * over komponentarkivet filtrert på kind, med detalj (typet profil), koblede
 * scener (reverse-oppslag) og replikker der karakteren er taler.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Box, Button, Chip, Collapse, Divider, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ExpandLess as LessIcon, ExpandMore as MoreIcon, LockOutlined as LockIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeComponent, NarrativeComponentKind, NarrativeComponentProfile, NarrativeGraph, NarrativeScene, NarrativeSceneLine } from '../narrativeTypes';
import { NARRATIVE_SCENE_ERA_LABELS, type NarrativeSceneEra } from '../narrativeTypes';
import type { UseNarrativeGraphResult } from '../state/useNarrativeGraph';
import { listLinesBySpeaker, listScenesForComponent } from '../narrativeService';
import { AutosaveField, EmptyHint, SectionTitle, sceneFieldSx } from '../scenes/sceneUi';
import { SCENE_STATUS_COLORS, SCENE_STATUS_LABELS } from '../scenes/sceneOps';

type ProfileField = { key: string; label: string; multiline?: boolean; internal?: boolean; help?: string };
const CHARACTER_FIELDS: ProfileField[] = [
  { key: 'drive', label: 'Drivkraft', multiline: true },
  { key: 'changeAction', label: 'Handling som viser endring', multiline: true },
  { key: 'observable', label: 'Hva spillerne kan observere', multiline: true },
  { key: 'establishNow', label: 'Etableres nå', multiline: true },
  { key: 'firstPersonalScene', label: 'Første personlige scene' },
  { key: 'revealLater', label: 'Avsløres senere', multiline: true },
  { key: 'sourceStatus', label: 'Kildestatus' },
  { key: 'authorTruth', label: 'Forfatterfasit', multiline: true, internal: true, help: 'Intern — vises aldri i spillerflater.' },
  { key: 'notes', label: 'Notater', multiline: true },
];
const LOCATION_FIELDS: ProfileField[] = [
  { key: 'continuity', label: 'Kontinuitetskrav', multiline: true },
  { key: 'geometryStatus', label: 'Geometri-status' },
  { key: 'notes', label: 'Notater', multiline: true },
];
const GENERIC_FIELDS: ProfileField[] = [{ key: 'summary', label: 'Sammendrag', multiline: true }, { key: 'notes', label: 'Notater', multiline: true }];
const KIND_LABEL: Record<NarrativeComponentKind, string> = { character: 'Karakter', location: 'Lokasjon', item: 'Gjenstand', faction: 'Fraksjon', other: 'Annet' };
const KIND_PLURAL: Record<NarrativeComponentKind, string> = { character: 'karakterer', location: 'lokasjoner', item: 'gjenstander', faction: 'fraksjoner', other: 'komponenter' };

function initials(name: string): string { return name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase(); }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function list(v: unknown): string[] { return Array.isArray(v) ? v.map((x) => String(x)) : []; }

export interface ComponentGalleryPanelProps {
  projectId: string;
  kind: NarrativeComponentKind;
  graph: NarrativeGraph;
  store: UseNarrativeGraphResult;
  refreshKey?: number;
  onOpenScene: (sceneId: string) => void;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}

export function ComponentGalleryPanel({ projectId, kind, graph, store, refreshKey = 0, onOpenScene, onNotice }: ComponentGalleryPanelProps): React.ReactElement {
  const items = useMemo(() => graph.components.filter((c) => c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [graph.components, kind]);
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return new URLSearchParams(window.location.search).get(kind === 'character' ? 'character' : 'component'); } catch { return null; } });
  useEffect(() => { if (selectedId && !items.some((c) => c.id === selectedId)) setSelectedId(null); }, [items, selectedId]);
  // Forhåndsvelg første kort så fanen ikke åpner tomt («Velg en karakter»). URL-valget vinner når det finnes.
  useEffect(() => { if (!selectedId && items.length > 0) setSelectedId(items[0].id); }, [items, selectedId]);
  const selected = items.find((c) => c.id === selectedId) ?? null;
  const [newName, setNewName] = useState('');
  const [scenesFor, setScenesFor] = useState<Array<Pick<NarrativeScene, 'id' | 'code' | 'title' | 'status'>>>([]);
  const [lines, setLines] = useState<Array<NarrativeSceneLine & { sceneCode: string; sceneTitle: string }>>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showInternal, setShowInternal] = useState(false);
  const loadDetail = useCallback(async () => {
    if (!selected) return;
    try {
      const [s, l] = await Promise.all([listScenesForComponent(projectId, selected.id), kind === 'character' ? listLinesBySpeaker(projectId, selected.id) : Promise.resolve([])]);
      setScenesFor(s); setLines(l); setDetailError(null);
    } catch (err) { setDetailError(err instanceof Error ? err.message : 'Kunne ikke hente koblinger.'); }
  }, [projectId, selected, kind]);
  useEffect(() => { void loadDetail(); }, [loadDetail, refreshKey]);

  const profile: NarrativeComponentProfile = selected?.profile ?? {};
  const saveProfile = async (patch: Record<string, unknown>) => {
    if (!selected) return;
    await store.patchComponent(selected.id, { profile: { ...profile, ...patch } });
  };
  const fields = kind === 'character' ? CHARACTER_FIELDS : kind === 'location' ? LOCATION_FIELDS : GENERIC_FIELDS;
  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try { await store.createComponent({ name, kind, folderPath: KIND_PLURAL[kind][0].toUpperCase() + KIND_PLURAL[kind].slice(1) }); setNewName(''); onNotice(`${KIND_LABEL[kind]} «${name}» opprettet.`, 'success'); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke opprette.', 'error'); }
  };
  const cover = (c: NarrativeComponent) => { const a = c.coverAssetId ? graph.assets.find((x) => x.id === c.coverAssetId) : null; return a?.externalUrl ?? null; };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }} data-testid={`narrative-gallery-${kind}`}>
      <Box sx={{ width: 300, flex: '0 0 300px', borderRight: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
          <Stack direction="row" spacing={1}>
            <TextField size="small" fullWidth label={`Ny ${KIND_LABEL[kind].toLowerCase()}`} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} sx={sceneFieldSx} inputProps={{ 'data-testid': `narrative-gallery-new-${kind}` }} />
            <Button size="small" startIcon={<AddIcon />} disabled={!newName.trim()} onClick={() => void create()} sx={{ color: narrativeColors.accent, whiteSpace: 'nowrap' }} data-testid={`narrative-gallery-create-${kind}`}>Opprett</Button>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {items.length === 0 ? <EmptyHint title={`Ingen ${KIND_PLURAL[kind]} ennå`} body={kind === 'character' ? 'Opprett karakterene fra manuset så replikker og scener kan kobles til dem.' : 'Opprett stedene scenene foregår på, med epoke og kontinuitetskrav.'} testId={`narrative-gallery-empty-${kind}`} /> : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {items.map((c) => (
              <Box key={c.id} onClick={() => { setSelectedId(c.id); try { const url = new URL(window.location.href); url.searchParams.set(kind === 'character' ? 'character' : 'component', c.id); window.history.replaceState({}, '', url.toString()); } catch { /* ignore */ } }} data-testid={`narrative-gallery-card-${c.customId ?? c.id}`}
                sx={{ cursor: 'pointer', borderRadius: 2, p: 1, textAlign: 'center', border: `1px solid ${c.id === selectedId ? narrativeColors.accent : narrativeColors.borderStrong}`, bgcolor: c.id === selectedId ? narrativeColors.accentSoft : 'rgba(255,255,255,0.02)', '&:hover': { borderColor: narrativeColors.borderSoft } }}>
                <Avatar src={cover(c) ?? undefined} variant="rounded" sx={{ width: 56, height: 56, mx: 'auto', mb: 0.75, bgcolor: '#1f2937', color: narrativeColors.accent, fontWeight: 800, fontSize: 18 }}>{initials(c.name)}</Avatar>
                <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{c.name}</Typography>
                {kind === 'character' && str(profile && (c.profile as NarrativeComponentProfile).voiceCast?.child) ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>{(c.profile as NarrativeComponentProfile).voiceCast?.child}</Typography> : null}
                {kind === 'location' && list((c.profile as NarrativeComponentProfile).eras).length ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>{list((c.profile as NarrativeComponentProfile).eras).join(' · ')}</Typography> : null}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
        {!selected ? (
          <EmptyHint title={`Velg en ${KIND_LABEL[kind].toLowerCase()}`} body={kind === 'character' ? 'Drivkraft, forfatterfasit vs. det spillerne ser, stemmecast, minnespor, krefter, scener og replikker.' : 'Epoker, kontinuitet, geometri-status, rekvisitter og scenene stedet brukes i.'} testId={`narrative-gallery-none-${kind}`} />
        ) : (
          <Stack spacing={2.5} sx={{ maxWidth: 960 }} data-testid={`narrative-gallery-detail-${selected.customId ?? selected.id}`}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={cover(selected) ?? undefined} variant="rounded" sx={{ width: 72, height: 72, bgcolor: '#1f2937', color: narrativeColors.accent, fontWeight: 800, fontSize: 22 }}>{initials(selected.name)}</Avatar>
              <Box sx={{ flex: 1 }}>
                <AutosaveField label="Navn" value={selected.name} onSave={(v) => store.patchComponent(selected.id, { name: v.trim() || selected.name })} testId="narrative-gallery-name" maxLength={200} />
                <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mt: 0.5 }}>{KIND_LABEL[kind]}{selected.customId ? ` · ${selected.customId}` : ''}{selected.folderPath ? ` · ${selected.folderPath}` : ''}</Typography>
              </Box>
              <Tooltip title="Slett komponent (scene-koblinger fjernes)"><IconButton size="small" onClick={() => { if (window.confirm(`Slette ${selected.name}?`)) { void store.deleteComponent(selected.id); setSelectedId(null); } }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </Stack>
            {detailError ? <Alert severity="warning">{detailError}</Alert> : null}

            {kind === 'character' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <AutosaveField label="Stemme (barn)" value={str(profile.voiceCast?.child)} onSave={(v) => saveProfile({ voiceCast: { ...(profile.voiceCast ?? {}), child: v } })} testId="narrative-gallery-voice-child" maxLength={200} />
                <AutosaveField label="Stemme (voksen)" value={str(profile.voiceCast?.adult)} onSave={(v) => saveProfile({ voiceCast: { ...(profile.voiceCast ?? {}), adult: v } })} maxLength={200} />
                {(['1797', '1802', '1817'] as const).map((era) => (
                  <AutosaveField key={era} label={`Alder ${era}`} value={str(profile.ages?.[era])} onSave={(v) => saveProfile({ ages: { ...(profile.ages ?? {}), [era]: v } })} maxLength={80} />
                ))}
              </Box>
            ) : null}
            {kind === 'location' ? (
              <Box>
                <SectionTitle>Epoker</SectionTitle>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {(['pre', '1797', '1802', '1817'] as NarrativeSceneEra[]).map((era) => { const on = list(profile.eras).includes(era); return <Chip key={era} size="small" label={NARRATIVE_SCENE_ERA_LABELS[era]} onClick={() => void saveProfile({ eras: on ? list(profile.eras).filter((e) => e !== era) : [...list(profile.eras), era] })} sx={{ bgcolor: on ? narrativeColors.accentSoft : 'rgba(255,255,255,0.06)', color: on ? narrativeColors.accent : narrativeColors.textDim, fontWeight: 700 }} data-testid={`narrative-location-era-${era}`} data-on={on} />; })}
                </Stack>
                <Box sx={{ mt: 1.5 }}>
                  <AutosaveField label="Rekvisitter (én per linje)" multiline minRows={2} value={list(profile.props).join('\n')} onSave={(v) => saveProfile({ props: v.split('\n').map((x) => x.trim()).filter(Boolean) })} maxLength={5000} />
                </Box>
              </Box>
            ) : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
              {fields.filter((f) => !f.internal).map((f) => (
                <AutosaveField key={f.key} label={f.label} multiline={f.multiline} minRows={2} value={str(profile[f.key])} onSave={(v) => saveProfile({ [f.key]: v })} testId={`narrative-gallery-field-${f.key}`} maxLength={20_000} />
              ))}
            </Box>
            {fields.some((f) => f.internal) ? (
              <Box>
                <Button size="small" startIcon={showInternal ? <LessIcon /> : <LockIcon />} onClick={() => setShowInternal((v) => !v)} sx={{ color: narrativeColors.warning }} data-testid="narrative-gallery-internal-toggle">{showInternal ? 'Skjul forfatterfasit' : 'Vis forfatterfasit (intern)'}</Button>
                <Collapse in={showInternal}>
                  <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, border: `1px dashed ${narrativeColors.warning}66`, bgcolor: 'rgba(245,158,11,0.05)' }}>
                    <Typography sx={{ fontSize: 11, color: narrativeColors.warning, mb: 1 }}>Intern — vises aldri i spillerflater. Skill fasit fra det spillerne kan observere.</Typography>
                    {fields.filter((f) => f.internal).map((f) => <AutosaveField key={f.key} label={f.label} multiline minRows={3} value={str(profile[f.key])} onSave={(v) => saveProfile({ [f.key]: v })} testId={`narrative-gallery-field-${f.key}`} maxLength={20_000} />)}
                  </Box>
                </Collapse>
              </Box>
            ) : null}

            {kind === 'character' && (profile.memoryTrack?.length || profile.powers) ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {profile.memoryTrack?.length ? (
                  <Box data-testid="narrative-gallery-memory-track">
                    <SectionTitle>Minnespor</SectionTitle>
                    <Stack spacing={0.75}>
                      {profile.memoryTrack.map((m) => (
                        <Box key={m.code} sx={{ p: 1, borderRadius: 1.5, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700 }}><span style={{ color: narrativeColors.accent, fontFamily: 'monospace' }}>{m.code}</span> · {m.title}{m.knownAfter ? <Typography component="span" sx={{ fontSize: 10, color: narrativeColors.textDim }}> · kjent etter {m.knownAfter}</Typography> : null}</Typography>
                          {m.image ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{m.image}</Typography> : null}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {profile.powers ? (
                  <Box data-testid="narrative-gallery-powers">
                    <SectionTitle>Kraftprogresjon</SectionTitle>
                    {profile.powers.active ? <Chip size="small" label={`${profile.powers.active.name} · trinn ${profile.powers.active.tier}`} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent, fontWeight: 700, mb: 1 }} /> : null}
                    <Stack spacing={0.5}>{(profile.powers.mental ?? []).map((p, i) => <Typography key={i} sx={{ fontSize: 11, color: narrativeColors.textDim }}>{p}</Typography>)}</Stack>
                  </Box>
                ) : null}
              </Box>
            ) : null}

            <Divider sx={{ borderColor: narrativeColors.borderStrong }} />
            <Box data-testid="narrative-gallery-scenes">
              <SectionTitle>Scener ({scenesFor.length})</SectionTitle>
              {scenesFor.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ikke koblet til noen scene ennå. Koble i scenens Gameplay-fane.</Typography> : (
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {scenesFor.map((s) => <Chip key={s.id} size="small" label={`${s.code} · ${s.title}`} onClick={() => onOpenScene(s.id)} title={SCENE_STATUS_LABELS[s.status]} sx={{ bgcolor: `${SCENE_STATUS_COLORS[s.status]}1f`, color: narrativeColors.text }} data-testid={`narrative-gallery-scene-${s.code}`} />)}
                </Stack>
              )}
            </Box>
            {kind === 'character' ? (
              <Box data-testid="narrative-gallery-lines">
                <SectionTitle>Replikker ({lines.length})</SectionTitle>
                {lines.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen replikker med denne karakteren som taler.</Typography> : (
                  <Stack spacing={0.5}>
                    {lines.map((l) => (
                      <Stack key={l.id} direction="row" spacing={1} alignItems="baseline" sx={{ cursor: 'pointer' }} onClick={() => onOpenScene(l.sceneId)} data-testid={`narrative-gallery-line-${l.cueId}`}>
                        <Typography sx={{ fontSize: 11, fontFamily: 'monospace', color: narrativeColors.accent, fontWeight: 800, minWidth: 64 }}>{l.cueId}</Typography>
                        <Typography sx={{ fontSize: 12, flex: 1 }}>{l.textEn}</Typography>
                        <Chip size="small" label={l.sourceType} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.textDim }} />
                        <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, whiteSpace: 'nowrap' }}>{l.sceneCode}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            ) : null}
            <Box sx={{ mt: 1 }}>
              <Button size="small" startIcon={<MoreIcon />} onClick={() => onNotice('Attributter redigeres i Komponenter-fanen (samme komponent).', 'success')} sx={{ color: narrativeColors.textDim, fontSize: 11 }}>Attributter</Button>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default ComponentGalleryPanel;
