import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  CalendarMonthOutlined as CalendarIcon,
  CheckCircleOutline as CompletedIcon,
  CommentOutlined as CommentIcon,
  DescriptionOutlined as ManuscriptIcon,
  FactCheckOutlined as VerifiedIcon,
  GroupsOutlined as CastIcon,
  MovieCreationOutlined as SceneIcon,
  Search as SearchIcon,
  ViewQuiltOutlined as StoryboardIcon,
  VideocamOutlined as ShotIcon,
} from '@mui/icons-material';
import type { CastingProject, Manuscript, Role, SceneBreakdown } from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { roleTokens } from '../../theme/roleTokens';
import authSessionService from '../../services/authSessionService';
import { manuscriptService } from '../../services/manuscriptService';
import { PostCommentLayer, type PostCommentAuth } from '../PostCommentLayer';
import { useScreenTier } from '../production/useScreenTier';
import {
  buildDirectorSceneContext,
  getDirectorSceneCommentManuscriptId,
  resolveDirectorSceneScriptExcerpt,
  sortDirectorScenes,
} from './directorSceneModel';

interface DirectorSceneWorkspaceProps {
  project: CastingProject;
  roles: Role[];
  selectedSceneId?: string | null;
  canComment?: boolean;
  onSceneChange: (sceneId: string) => void;
  onOpenManuscript: (sceneId: string) => void;
  onOpenStoryboard: (sceneId: string) => void;
  onOpenShotList: (sceneId: string) => void;
}

function formatProductionDate(value?: string): string {
  if (!value) return 'Dato ikke satt';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

function sceneSearchText(scene: SceneBreakdown): string {
  return [
    scene.sceneNumber,
    scene.heading,
    scene.sceneHeading,
    scene.sceneName,
    scene.locationName,
    ...(scene.characters ?? []),
  ].filter(Boolean).join(' ').toLocaleLowerCase('nb');
}

function DetailList({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <Box>
      <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.7rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.35, color: roleTokens.text, fontSize: '0.84rem', lineHeight: 1.55 }}>
        {values.join(' · ')}
      </Typography>
    </Box>
  );
}

export function DirectorSceneWorkspace({
  project,
  roles,
  selectedSceneId,
  canComment = false,
  onSceneChange,
  onOpenManuscript,
  onOpenStoryboard,
  onOpenShotList,
}: DirectorSceneWorkspaceProps) {
  const { isMobile } = useScreenTier();
  const [query, setQuery] = useState('');
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [manuscriptsLoading, setManuscriptsLoading] = useState(true);
  const [manuscriptsError, setManuscriptsError] = useState<string | null>(null);
  const scenes = useMemo(
    () => sortDirectorScenes(project.sceneBreakdowns ?? []),
    [project.sceneBreakdowns],
  );
  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0] ?? null,
    [scenes, selectedSceneId],
  );
  const filteredScenes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('nb');
    if (!normalizedQuery) return scenes;
    return scenes.filter((scene) => sceneSearchText(scene).includes(normalizedQuery));
  }, [query, scenes]);

  useEffect(() => {
    if (selectedScene && selectedScene.id !== selectedSceneId) {
      onSceneChange(selectedScene.id);
    }
  }, [onSceneChange, selectedScene, selectedSceneId]);

  useEffect(() => {
    let cancelled = false;
    setManuscripts([]);
    setManuscriptsError(null);
    setManuscriptsLoading(true);
    manuscriptService.getManuscripts(project.id)
      .then((items) => {
        if (!cancelled) setManuscripts(items);
      })
      .catch(() => {
        if (!cancelled) setManuscriptsError('Manuset kunne ikke lastes akkurat nå. Sceneinformasjonen under er fortsatt tilgjengelig.');
      })
      .finally(() => {
        if (!cancelled) setManuscriptsLoading(false);
      });
    return () => { cancelled = true; };
  }, [project.id]);

  const sceneIndex = selectedScene ? scenes.findIndex((scene) => scene.id === selectedScene.id) : -1;
  const context = useMemo(
    () => selectedScene
      ? buildDirectorSceneContext(selectedScene, project, roles, Math.max(0, sceneIndex))
      : null,
    [project, roles, sceneIndex, selectedScene],
  );
  const excerpt = useMemo(
    () => selectedScene ? resolveDirectorSceneScriptExcerpt(selectedScene, manuscripts) : null,
    [manuscripts, selectedScene],
  );
  const commentManuscriptId = useMemo(
    () => selectedScene
      ? getDirectorSceneCommentManuscriptId(selectedScene, manuscripts, excerpt)
      : null,
    [excerpt, manuscripts, selectedScene],
  );
  const token = authSessionService.getSessionTokenSync();
  const session = authSessionService.getSessionSync();
  const commentAuth = useMemo<PostCommentAuth | null>(
    () => token ? { kind: 'bearer', token } : null,
    [token],
  );
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;

  if (!selectedScene || !context) {
    return (
      <Card
        variant="outlined"
        data-testid="director-scenes-empty"
        sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}
      >
        <CardContent sx={{ py: 5, textAlign: 'center' }}>
          <SceneIcon sx={{ fontSize: 36, color: roleTokens.textMuted }} />
          <Typography component="h2" sx={{ mt: 1, fontWeight: 760 }}>Ingen registrerte scener</Typography>
          <Typography sx={{ mt: 0.5, color: roleTokens.textMuted }}>
            Opprett eller importer scener i manusflaten. Regissørrommet viser bare sceneinformasjon som finnes i prosjektet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const coverage = context.coverage;
  const sceneMeta = [selectedScene.intExt, selectedScene.timeOfDay, selectedScene.locationName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const propsNeeded = Array.isArray(selectedScene.propsNeeded) ? selectedScene.propsNeeded : [];
  const vehicles = Array.isArray(selectedScene.vehicles) ? selectedScene.vehicles : [];
  const technicalNotes = [
    typeof selectedScene.stuntsNotes === 'string' && selectedScene.stuntsNotes.trim()
      ? `Stunt: ${selectedScene.stuntsNotes.trim()}`
      : null,
    typeof selectedScene.specialEffects === 'string' && selectedScene.specialEffects.trim()
      ? `VFX/SFX: ${selectedScene.specialEffects.trim()}`
      : selectedScene.specialEffects === true
        ? 'VFX/SFX er markert på scenen'
        : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <Box
      data-testid="director-scene-workspace"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, 0.55fr) minmax(0, 1.45fr)' },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Card
        component="aside"
        variant="outlined"
        sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text, overflow: 'hidden' }}
      >
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${roleTokens.border}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography component="h2" sx={{ fontWeight: 760 }}>Scener</Typography>
            <Chip size="small" label={scenes.length} />
          </Stack>
          <TextField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            size="small"
            fullWidth
            placeholder="Søk scene, sted eller rolle"
            inputProps={{ 'aria-label': 'Søk i scener' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ maxHeight: { xs: 290, lg: 'calc(100vh - 320px)' }, overflowY: 'auto', p: 0.75 }}>
          {filteredScenes.length === 0 ? (
            <Typography sx={{ p: 2, color: roleTokens.textMuted, fontSize: '0.82rem' }}>Ingen scener matcher søket.</Typography>
          ) : filteredScenes.map((scene) => {
            const index = scenes.findIndex((candidate) => candidate.id === scene.id);
            const itemContext = buildDirectorSceneContext(scene, project, roles, index);
            const selected = scene.id === selectedScene.id;
            return (
              <Button
                key={scene.id}
                onClick={() => onSceneChange(scene.id)}
                aria-current={selected ? 'true' : undefined}
                data-testid={`director-scene-${scene.id}`}
                fullWidth
                sx={{
                  minHeight: targetSize,
                  display: 'block',
                  textAlign: 'left',
                  textTransform: 'none',
                  px: 1.25,
                  py: 1,
                  mb: 0.5,
                  color: roleTokens.text,
                  bgcolor: selected ? 'rgba(168,85,247,0.16)' : 'transparent',
                  border: selected ? '1px solid rgba(192,132,252,0.34)' : '1px solid transparent',
                  '&:hover': { bgcolor: selected ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.045)' },
                  ...focusVisibleStyles,
                }}
              >
                <Typography component="span" sx={{ display: 'block', color: selected ? '#d8b4fe' : roleTokens.textMuted, fontSize: '0.68rem', fontWeight: 780 }}>
                  {itemContext.label}
                </Typography>
                <Typography component="span" sx={{ display: 'block', mt: 0.15, fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.35 }}>
                  {itemContext.heading}
                </Typography>
                <Typography component="span" sx={{ display: 'block', mt: 0.35, color: roleTokens.textMuted, fontSize: '0.68rem' }}>
                  {itemContext.castNames.length} {itemContext.castNames.length === 1 ? 'rolle' : 'roller'} · {itemContext.coverage.shots.length} {itemContext.coverage.shots.length === 1 ? 'shot' : 'shots'}
                </Typography>
              </Button>
            );
          })}
        </Box>
      </Card>

      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2.25 }, '&:last-child': { pb: { xs: 1.5, md: 2.25 } } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.6, flexWrap: 'wrap' }}>
                  <Chip size="small" label={context.label.toUpperCase()} sx={{ color: '#d8b4fe', bgcolor: 'rgba(168,85,247,0.14)' }} />
                  {sceneMeta.map((value) => <Chip key={value} size="small" label={value} variant="outlined" />)}
                  <Chip
                    size="small"
                    icon={<VerifiedIcon sx={{ color: '#6ee7b7 !important' }} />}
                    label="Prosjektdata"
                    sx={{ color: '#a7f3d0', bgcolor: 'rgba(16,185,129,0.08)' }}
                  />
                </Stack>
                <Typography component="h2" sx={{ fontSize: { xs: '1.2rem', md: '1.55rem' }, fontWeight: 790 }}>
                  {context.heading}
                </Typography>
                {selectedScene.description ? (
                  <Typography sx={{ mt: 0.7, color: roleTokens.textMuted, lineHeight: 1.58 }}>
                    {selectedScene.description}
                  </Typography>
                ) : null}
              </Box>
              <Button
                variant="outlined"
                startIcon={<ManuscriptIcon />}
                onClick={() => onOpenManuscript(selectedScene.id)}
                sx={{ minHeight: targetSize, flexShrink: 0, color: roleTokens.text, borderColor: roleTokens.border, ...focusVisibleStyles }}
              >
                Åpne i manus
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              <DetailList label="Roller i scenen" values={context.castNames} />
              <DetailList label="Props" values={propsNeeded} />
              <DetailList label="Kjøretøy" values={vehicles} />
              <DetailList label="Produksjonsmerknader" values={technicalNotes} />
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(290px, 0.6fr)' }, gap: 2 }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 760 }}>Manus i scenen</Typography>
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.74rem' }}>
                      Utdrag vises bare når scenen kan kobles sikkert til en manusoverskrift.
                    </Typography>
                  </Box>
                  {excerpt ? <Chip size="small" label={excerpt.manuscriptTitle} variant="outlined" /> : null}
                </Stack>
                {manuscriptsLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 3, color: roleTokens.textMuted }}>
                    <CircularProgress size={17} />
                    <Typography sx={{ fontSize: '0.82rem' }}>Laster manus …</Typography>
                  </Stack>
                ) : excerpt ? (
                  <Box
                    component="pre"
                    data-testid="director-scene-script-excerpt"
                    sx={{
                      m: 0,
                      p: { xs: 1.25, md: 2 },
                      maxHeight: 430,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      color: 'rgba(255,255,255,0.88)',
                      bgcolor: '#070a10',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 1.5,
                      fontFamily: 'Courier Prime, Courier New, monospace',
                      fontSize: { xs: '0.78rem', md: '0.86rem' },
                      lineHeight: 1.65,
                    }}
                  >
                    {excerpt.content}
                  </Box>
                ) : (
                  <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.14)' }}>
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.82rem', lineHeight: 1.55 }}>
                      {manuscriptsError ?? (manuscripts.length === 0
                        ? 'Ingen manusversjon er knyttet til prosjektet ennå.'
                        : 'Fant ikke et eksakt treff mellom sceneoverskriften og manusinnholdet. Vi viser ikke et antatt utdrag.')}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1.25 }}>
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 760 }}>Visuell dekning</Typography>
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.74rem' }}>Registrerte storyboardrammer og shots for denne scenen.</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip icon={<StoryboardIcon />} size="small" label={`${coverage.storyboardFrameCount} ${coverage.storyboardFrameCount === 1 ? 'ramme' : 'rammer'}`} />
                    <Chip icon={<ShotIcon />} size="small" label={`${coverage.shots.length} ${coverage.shots.length === 1 ? 'shot' : 'shots'}`} />
                    <Chip icon={<CompletedIcon />} size="small" label={`${coverage.completedShotCount} ferdige`} />
                  </Stack>
                </Stack>
                {coverage.shots.length > 0 ? (
                  <Stack spacing={0.75}>
                    {coverage.shots.slice(0, 5).map((shot, index) => (
                      <Box key={shot.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.1, py: 0.85, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.035)' }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 650 }}>
                          {index + 1}. {shot.description?.trim() || shot.shotType}
                        </Typography>
                        <Chip size="small" label={shot.status === 'completed' ? 'Ferdig' : shot.status === 'in_progress' ? 'Pågår' : 'Planlagt'} />
                      </Box>
                    ))}
                    {coverage.shots.length > 5 ? (
                      <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.72rem' }}>+ {coverage.shots.length - 5} flere shots</Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.82rem' }}>Ingen shots er registrert på scenen.</Typography>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                  <Button endIcon={<ArrowForwardIcon />} onClick={() => onOpenStoryboard(selectedScene.id)} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>
                    Storyboard
                  </Button>
                  <Button endIcon={<ArrowForwardIcon />} onClick={() => onOpenShotList(selectedScene.id)} sx={{ minHeight: targetSize, ...focusVisibleStyles }}>
                    Shotlist
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Stack spacing={2}>
            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <CalendarIcon sx={{ color: '#7dd3fc' }} />
                  <Typography component="h3" sx={{ fontWeight: 760 }}>Opptaksplan</Typography>
                </Stack>
                {context.productionDays.length > 0 ? context.productionDays.map((day) => (
                  <Box key={day.id} sx={{ mb: 0.75, p: 1, borderRadius: 1, bgcolor: 'rgba(56,189,248,0.07)' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{formatProductionDate(day.date)}</Typography>
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.72rem' }}>
                      {day.callTime ? `Oppmøte ${day.callTime}` : 'Oppmøte ikke satt'} · {day.status ?? 'planlagt'}
                    </Typography>
                  </Box>
                )) : (
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.8rem' }}>Scenen er ikke knyttet til en produksjonsdag.</Typography>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CommentIcon sx={{ color: '#d8b4fe' }} />
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 760 }}>Blocking og regi</Typography>
                    <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.72rem' }}>Delte scenetråder. Kommentarer endrer aldri manuset.</Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 1.25 }} />
                {commentAuth && commentManuscriptId ? (
                  <PostCommentLayer
                    key={`${commentManuscriptId}:${selectedScene.id}`}
                    projectId={project.id}
                    anchorType="manuscript_scene"
                    anchorRef={`${commentManuscriptId}#scene:${selectedScene.id}`}
                    auth={commentAuth}
                    authorDisplayName={session.adminUser?.display_name || session.adminUser?.name}
                    readOnly={!canComment}
                    defaultVisibleCount={6}
                    pollingIntervalMs={10000}
                    composerPlaceholder="Skriv blocking, intensjon eller regi-note …"
                  />
                ) : (
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '0.8rem', lineHeight: 1.55 }}>
                    {!commentAuth
                      ? 'Logg inn på nytt for å lese og skrive scenekommentarer.'
                      : manuscriptsLoading
                        ? 'Klargjør scenekommentarer …'
                        : 'Scenen må være knyttet til et lagret manus før den kan få en delt kommentartråd.'}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {context.castNames.length > 0 ? (
              <Card variant="outlined" sx={{ bgcolor: roleTokens.surface, borderColor: roleTokens.border, color: roleTokens.text }}>
                <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <CastIcon sx={{ color: '#f9a8d4' }} />
                    <Typography component="h3" sx={{ fontWeight: 760 }}>Sceneensemble</Typography>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {context.castNames.map((name) => <Chip key={name} size="small" label={name} />)}
                  </Stack>
                </CardContent>
              </Card>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

export default DirectorSceneWorkspace;
