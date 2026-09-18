/**
 * SceneStoryboardTab — rammestripe for scenen: legg til fra prosjektets
 * bilde-ressurser eller via URL, bildetekst (autosave), opp/ned, slett, og
 * kommentartråd per ramme (editor-comments, anker narrative_scene_frame).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { ArrowBack as LeftIcon, ArrowForward as RightIcon, ChatBubbleOutline as CommentIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeGraph, NarrativeSceneDetail } from '../narrativeTypes';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { AutosaveField, EmptyHint, sceneFieldSx } from './sceneUi';
import { frameImageUrl } from './sceneOps';
import { buildScenePrompt } from './scenePrompt';
import { createAiReferenceFrame, generateStoryboardImage, getAssetDownloadUrl, listPlatformTargets, NarrativeApiError } from '../narrativeService';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import { PostCommentLayer } from '../../components/PostCommentLayer';
import { narrativeAuthHeaders } from '../narrativeAuthHeaders';
import { authSessionService } from '../../services/authSessionService';

export function bearerToken(): string {
  const h = narrativeAuthHeaders();
  return (h.Authorization ?? '').replace(/^Bearer\s+/i, '').trim();
}

/** Story Graph-farger for kommentartråder (Post Agent-lilla passer ikke i spillstudio). */
export const NARRATIVE_COMMENT_THEME = {
  accent: narrativeColors.accent, accentSoft: narrativeColors.accentSoft, accentText: '#86efac',
  surface: narrativeColors.bgPanel, border: narrativeColors.borderStrong, title: narrativeColors.text,
} as const;

export function selfDisplayName(): string {
  const s = authSessionService.getSessionSync();
  return s.adminUser?.name ?? s.adminUser?.display_name ?? s.adminUser?.email ?? 'Meg';
}

export function SceneStoryboardTab({ projectId, graph, detail, scenes, onNotice }: {
  projectId: string; graph: NarrativeGraph; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}) {
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [openComments, setOpenComments] = useState<string | null>(null);
  // Fase 8f: KI-referansebilde (ai_assist) + signerte URL-er for rammer lagret i objektlager (storage_key uten external_url).
  const gate = useGamePlanGate();
  const aiAllowed = gate.has('ai_assist');
  const [generating, setGenerating] = useState(false);
  const [aiUsage, setAiUsage] = useState<{ usedToday: number; dailyLimit: number } | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const storedAssetIds = useMemo(() => detail.frames
    .filter((f) => f.assetId && !f.externalUrl)
    .map((f) => graph.assets.find((a) => a.id === f.assetId))
    .filter((a): a is NonNullable<typeof a> => !!a && !a.externalUrl && !!a.storageKey)
    .map((a) => a.id), [detail.frames, graph.assets]);
  useEffect(() => {
    let cancelled = false;
    const missing = storedAssetIds.filter((id) => !signedUrls[id]);
    if (missing.length === 0) return undefined;
    void Promise.all(missing.map(async (id) => { try { const r = await getAssetDownloadUrl(projectId, id); return [id, r.url] as const; } catch { return [id, ''] as const; } }))
      .then((pairs) => { if (!cancelled) setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, u]) => u)) })); });
    return () => { cancelled = true; };
  }, [storedAssetIds, signedUrls, projectId]);
  const frameSrc = (f: { assetId: string | null; externalUrl: string | null }) => frameImageUrl(f, graph.assets) ?? (f.assetId ? signedUrls[f.assetId] ?? null : null);

  const generateReference = async () => {
    if (generating || !aiAllowed) return;
    setGenerating(true);
    try {
      const locationLink = detail.links.find((l) => l.ownerKind === 'component' && graph.components.find((c) => c.id === l.ownerId)?.kind === 'location');
      const location = locationLink ? graph.components.find((c) => c.id === locationLink.ownerId) ?? null : null;
      const targets = await listPlatformTargets(projectId).catch(() => []);
      const primary = targets.find((t) => t.isPrimary) ?? targets[0];
      const prompt = buildScenePrompt({
        scene: { code: detail.scene.code, title: detail.scene.title, era: detail.scene.era, beforeState: detail.scene.beforeState, action: detail.scene.action, environment: detail.scene.environment, location: detail.scene.location },
        location: location ? { name: location.name, profile: location.profile as { eras?: string[]; continuity?: string; props?: string[] } } : null,
        visualDirection: primary?.visualDirection ?? null,
      });
      const img = await generateStoryboardImage(projectId, prompt);
      const result = await createAiReferenceFrame(projectId, detail.scene.id, { imageBase64: img.imageBase64, caption: 'KI-referanse', prompt: img.prompt, model: img.model });
      setAiUsage({ usedToday: result.usedToday, dailyLimit: result.dailyLimit });
      await scenes.reloadDetail();
      onNotice(`Referansebilde lagt til (${result.usedToday}/${result.dailyLimit} i dag).`, 'success');
    } catch (err) {
      if (err instanceof NarrativeApiError && err.code === 'daily_limit') onNotice('Daglig tak for KI-referansebilder (10 per prosjekt) er nådd.', 'warning');
      else if (err instanceof NarrativeApiError && err.status === 402) onNotice('KI-referansebilder krever Pro/Studio (ai_assist).', 'warning');
      else onNotice(err instanceof Error ? err.message : 'Kunne ikke generere referansebilde.', 'error');
    } finally { setGenerating(false); }
  };
  const urlValid = /^https?:\/\/\S+$/i.test(url.trim());
  const imageAssets = graph.assets.filter((a) => a.kind === 'image');
  const token = bearerToken();

  const addFromUrl = async () => {
    if (!urlValid || adding) return;
    setAdding(true);
    try { await scenes.addFrame({ externalUrl: url.trim() }); setUrl(''); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke legge til rammen.', 'error'); }
    finally { setAdding(false); }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexWrap: 'wrap' }} useFlexGap>
        <Autocomplete
          size="small" options={imageAssets} getOptionLabel={(a) => a.name} sx={{ minWidth: 260 }} value={null}
          onChange={(_e, a) => { if (a) void scenes.addFrame({ assetId: a.id, caption: a.name }).catch((err: unknown) => onNotice(err instanceof Error ? err.message : 'Kunne ikke legge til rammen.', 'error')); }}
          renderInput={(params) => <TextField {...params} label="Fra ressurser" placeholder="Velg bilde…" inputProps={{ ...params.inputProps, 'data-testid': 'narrative-scene-frame-asset' }} sx={sceneFieldSx} />}
          noOptionsText="Ingen bilde-ressurser ennå."
        />
        <TextField
          size="small" label="…eller bilde-URL" value={url} onChange={(e) => setUrl(e.target.value)} error={!!url && !urlValid}
          helperText={url && !urlValid ? 'Må starte med http:// eller https://' : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addFromUrl(); } }}
          inputProps={{ 'data-testid': 'narrative-scene-frame-url' }} sx={{ ...sceneFieldSx, minWidth: 320, flex: 1 }}
        />
        <Button variant="contained" disabled={!urlValid || adding} onClick={() => void addFromUrl()} data-testid="narrative-scene-frame-add" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>
          {adding ? 'Legger til…' : 'Legg til ramme'}
        </Button>
        <Tooltip title={aiAllowed ? 'Konseptbilde fra scenekortet (Før/Handling/Miljø), lokasjonens profil og plattformens visuelle retning. Maks 10 per prosjekt per dag.' : 'KI-referansebilder krever Pro/Studio (ai_assist).'}>
          <span>
            <Button variant="outlined" startIcon={<AutoAwesomeIcon />} disabled={!aiAllowed || generating} onClick={() => void generateReference()} data-testid="narrative-scene-frame-generate" data-locked={aiAllowed ? undefined : 'plan'} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent }}>
              {generating ? 'Genererer…' : 'Generer referansebilde'}
            </Button>
          </span>
        </Tooltip>
        {aiUsage ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, alignSelf: 'center' }} data-testid="narrative-scene-frame-ai-usage">{aiUsage.usedToday}/{aiUsage.dailyLimit} i dag</Typography> : null}
      </Stack>

      {detail.frames.length === 0 ? (
        <EmptyHint title="Ingen rammer ennå" body="Rammer er stillbilder som viser scenens forløp — første ramme blir scenebildet i oversikten." testId="narrative-scene-frames-empty" />
      ) : (
        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }} data-testid="narrative-scene-frame-strip">
          {detail.frames.map((f, i) => {
            const src = frameSrc(f);
            const commentsOpen = openComments === f.id;
            return (
              <Box key={f.id} sx={{ width: commentsOpen ? 420 : 240, flexShrink: 0, borderRadius: 2, border: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, overflow: 'hidden', transition: 'width .15s' }} data-testid={`narrative-scene-frame-${i + 1}`}>
                <Box sx={{ position: 'relative' }}>
                  {src ? <Box component="img" src={src} alt={f.caption || `Ramme ${i + 1}`} loading="lazy" sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    : <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: narrativeColors.textDim }}>Ingen forhåndsvisning</Box>}
                  <Typography sx={{ position: 'absolute', top: 6, left: 6, fontSize: 10, fontWeight: 800, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.65)', color: '#fff' }}>{i + 1}</Typography>
                </Box>
                <Box sx={{ p: 1 }}>
                  <AutosaveField label="Bildetekst" value={f.caption} onSave={(v) => scenes.patchFrame(f.id, { caption: v })} testId={`narrative-scene-frame-caption-${i + 1}`} maxLength={1000} />
                  <Stack direction="row" spacing={0.25} alignItems="center" sx={{ mt: 0.5 }}>
                    <Tooltip title="Flytt til venstre"><span><IconButton size="small" disabled={i === 0} onClick={() => void scenes.moveFrame(f.id, -1)} sx={{ color: narrativeColors.textDim }} aria-label="Flytt venstre" data-testid={`narrative-scene-frame-left-${i + 1}`}><LeftIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Tooltip title="Flytt til høyre"><span><IconButton size="small" disabled={i === detail.frames.length - 1} onClick={() => void scenes.moveFrame(f.id, 1)} sx={{ color: narrativeColors.textDim }} aria-label="Flytt høyre" data-testid={`narrative-scene-frame-right-${i + 1}`}><RightIcon sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Kommentarer"><IconButton size="small" onClick={() => setOpenComments(commentsOpen ? null : f.id)} sx={{ color: commentsOpen ? narrativeColors.accent : narrativeColors.textDim }} aria-label="Kommentarer" data-testid={`narrative-scene-frame-comments-${i + 1}`}><CommentIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                    <Tooltip title="Slett ramme"><IconButton size="small" onClick={() => { if (window.confirm('Slette rammen?')) void scenes.deleteFrame(f.id); }} sx={{ color: narrativeColors.textDim, '&:hover': { color: narrativeColors.error } }} aria-label="Slett ramme" data-testid={`narrative-scene-frame-delete-${i + 1}`}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                  </Stack>
                  {commentsOpen && token ? (
                    <Box sx={{ mt: 1, borderTop: `1px solid ${narrativeColors.borderStrong}`, pt: 1 }} data-testid={`narrative-scene-frame-thread-${i + 1}`}>
                      <PostCommentLayer projectId={projectId} anchorType="narrative_scene_frame" anchorRef={f.id} auth={{ kind: 'bearer', token }} authorDisplayName={selfDisplayName()} composerPlaceholder="Kommenter rammen…" pollingIntervalMs={0} theme={NARRATIVE_COMMENT_THEME} />
                    </Box>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
