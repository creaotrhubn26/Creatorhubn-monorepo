import { useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CompareArrows as CompareIcon,
  FactCheck as CoverageIcon,
  Movie as MovieIcon,
  PlayArrow as PlayIcon,
  Send as SendIcon,
  Theaters as ScriptIcon,
  Visibility as VideoVillageIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import type { CastingShot, DialogueLine, SceneBreakdown } from '../../../models/casting';
import type { LiveSetStatus, Take } from '..';

export type TakeReviewFlag = 'performance' | 'framing' | 'continuity';

export interface TakeReviewDecision {
  performance?: boolean;
  framing?: boolean;
  continuity?: boolean;
  selected?: boolean;
  sentToPost?: boolean;
  directorNote?: string;
  editorNote?: string;
  updatedAt?: string;
}

export type ShotLineCoverageMap = Record<string, { startLine: number; endLine: number; dialogueIds: string[] }>;
export type CoverageReviewSyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'local_only' | 'error' | 'conflict';

interface CoverageReviewWorkspaceProps {
  selectedScene: SceneBreakdown | null;
  selectedShot: CastingShot | null;
  selectedSceneShots: CastingShot[];
  selectedSceneDialogue: DialogueLine[];
  liveSetStatus: LiveSetStatus | null;
  shotLineCoverage: ShotLineCoverageMap;
  takeReviewMap: Record<string, TakeReviewDecision>;
  onSelectShot: (shot: CastingShot) => void;
  onToggleLineCoverage: (shotId: string, dialogueId: string) => void;
  onToggleTakeReview: (takeId: string, flag: TakeReviewFlag) => void;
  onToggleTakeSelected: (takeId: string) => void;
  onUpdateTakeNote: (takeId: string, field: 'directorNote' | 'editorNote', value: string) => void;
  onSendTakeToPost: (takeId: string) => void;
  syncStatus?: CoverageReviewSyncStatus;
  syncError?: string | null;
  syncVersion?: number;
}

const COVERAGE_BUCKETS = [
  { key: 'wide', label: 'Wide', aliases: ['wide', 'establishing', 'master'] },
  { key: 'medium', label: 'Medium', aliases: ['medium', 'two shot'] },
  { key: 'close', label: 'Close-up', aliases: ['close', 'extreme close'] },
  { key: 'insert', label: 'Insert', aliases: ['insert', 'detail'] },
  { key: 'ots', label: 'OTS', aliases: ['over shoulder', 'ots'] },
  { key: 'cutaway', label: 'Cutaway', aliases: ['cutaway', 'reaction'] },
] as const;

const STATUS_META = {
  missing: { label: 'missing', color: '#f87171', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.35)' },
  planned: { label: 'planned', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.35)' },
  recorded: { label: 'recorded', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.35)' },
  reviewed: { label: 'reviewed', color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', border: 'rgba(167,139,250,0.35)' },
  selected: { label: 'selected', color: '#34d399', bg: 'rgba(52,211,153,0.14)', border: 'rgba(52,211,153,0.35)' },
} as const;

type CoverageStatus = keyof typeof STATUS_META;

const normalize = (value?: unknown): string => String(value ?? '').toLowerCase();

const shotMatchesBucket = (shot: CastingShot, aliases: readonly string[]): boolean => {
  const haystack = `${normalize(shot.shotType)} ${normalize(shot.description)} ${normalize(shot.notes)}`;
  return aliases.some((alias) => haystack.includes(alias));
};

const formatTakeLabel = (take: Take): string => `T${take.takeNumber || '?'}`;

const SYNC_STATUS_META: Record<CoverageReviewSyncStatus, { label: string; color: string; bg: string; border: string }> = {
  idle: { label: 'Ikke synket', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.24)' },
  loading: { label: 'Laster server', color: '#93c5fd', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.28)' },
  saving: { label: 'Lagrer', color: '#fde68a', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  synced: { label: 'Server synket', color: '#86efac', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
  local_only: { label: 'Lokal backup', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  error: { label: 'Sync-feil', color: '#fca5a5', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  conflict: { label: 'Konflikt løses', color: '#f0abfc', bg: 'rgba(217,70,239,0.12)', border: 'rgba(217,70,239,0.3)' },
};

export const CoverageReviewWorkspace = ({
  selectedScene,
  selectedShot,
  selectedSceneShots,
  selectedSceneDialogue,
  liveSetStatus,
  shotLineCoverage,
  takeReviewMap,
  onSelectShot,
  onToggleLineCoverage,
  onToggleTakeReview,
  onToggleTakeSelected,
  onUpdateTakeNote,
  onSendTakeToPost,
  syncStatus = 'idle',
  syncError = null,
  syncVersion,
}: CoverageReviewWorkspaceProps) => {
  const [compareTakeIds, setCompareTakeIds] = useState<Record<string, true>>({});
  const syncMeta = SYNC_STATUS_META[syncStatus];

  const sceneTakes = useMemo(() => {
    if (!selectedScene) return [];
    return (liveSetStatus?.todayTakes || []).filter((take) => take.sceneId === selectedScene.id);
  }, [liveSetStatus?.todayTakes, selectedScene]);

  const takesByShot = useMemo(() => {
    const grouped = new Map<string, Take[]>();
    for (const take of sceneTakes) {
      const current = grouped.get(take.shotId) || [];
      current.push(take);
      grouped.set(take.shotId, current);
    }
    return grouped;
  }, [sceneTakes]);

  const coverageBuckets = useMemo(() => COVERAGE_BUCKETS.map((bucket) => {
    const plannedShots = selectedSceneShots.filter((shot) => shotMatchesBucket(shot, bucket.aliases));
    const recordedTakes = plannedShots.flatMap((shot) => takesByShot.get(shot.id) || []);
    const reviewedTakes = recordedTakes.filter((take) => {
      const review = takeReviewMap[take.id];
      return Boolean(review?.performance || review?.framing || review?.continuity);
    });
    const selectedTakes = recordedTakes.filter((take) => takeReviewMap[take.id]?.selected);
    const status: CoverageStatus = selectedTakes.length
      ? 'selected'
      : reviewedTakes.length
        ? 'reviewed'
        : recordedTakes.length
          ? 'recorded'
          : plannedShots.length
            ? 'planned'
            : 'missing';
    return { ...bucket, plannedShots, recordedTakes, reviewedTakes, selectedTakes, status };
  }), [selectedSceneShots, takeReviewMap, takesByShot]);

  const selectedTakeCount = sceneTakes.filter((take) => takeReviewMap[take.id]?.selected).length;
  const sentToPostCount = sceneTakes.filter((take) => takeReviewMap[take.id]?.sentToPost).length;
  const missingBuckets = coverageBuckets.filter((bucket) => bucket.status === 'missing').length;
  const reviewedTakeCount = sceneTakes.filter((take) => {
    const review = takeReviewMap[take.id];
    return Boolean(review?.performance || review?.framing || review?.continuity);
  }).length;
  const sceneReadyForPost = sceneTakes.length > 0 && selectedTakeCount > 0 && missingBuckets === 0;

  const comparedTakes = sceneTakes.filter((take) => compareTakeIds[take.id]);

  if (!selectedScene) {
    return (
      <Box data-testid="pmv-coverage-review-workspace" sx={{ flex: 1, display: 'grid', placeItems: 'center', color: '#6b7280' }}>
        Velg en scene for å åpne Coverage Review.
      </Box>
    );
  }

  return (
    <Box
      data-testid="pmv-coverage-review-workspace"
      sx={{
        flex: 1,
        overflow: 'auto',
        bgcolor: '#0b1017',
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#374151', borderRadius: 4 },
      }}
    >
      <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #1e2536', background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(11,16,23,0.96))' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <VideoVillageIcon sx={{ fontSize: 18, color: '#60a5fa' }} />
              <Typography sx={{ color: '#fff', fontSize: 17, fontWeight: 800 }}>
                Scene-centric review workspace
              </Typography>
              {liveSetStatus?.currentScene === selectedScene.id && (
                <Chip size="small" label="LiveSet koblet" sx={{ bgcolor: 'rgba(239,68,68,0.14)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.32)' }} />
              )}
              <Chip
                size="small"
                data-testid="pmv-coverage-sync-status"
                label={`${syncMeta.label}${typeof syncVersion === 'number' && syncVersion > 0 ? ` v${syncVersion}` : ''}`}
                sx={{ bgcolor: syncMeta.bg, color: syncMeta.color, border: `1px solid ${syncMeta.border}` }}
              />
            </Stack>
            <Typography sx={{ color: '#9ca3af', fontSize: 12.5 }}>
              Ikke bare vis manus. Vis om manuset faktisk er dekket av brukbare takes.
            </Typography>
            {syncError && (
              <Typography data-testid="pmv-coverage-sync-error" sx={{ mt: 0.75, color: '#fca5a5', fontSize: 12 }}>
                {syncError}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={`${sceneTakes.length} takes`} sx={{ bgcolor: 'rgba(96,165,250,0.12)', color: '#93c5fd' }} />
            <Chip label={`${reviewedTakeCount} reviewed`} sx={{ bgcolor: 'rgba(167,139,250,0.12)', color: '#c4b5fd' }} />
            <Chip label={`${selectedTakeCount} selected`} sx={{ bgcolor: 'rgba(52,211,153,0.12)', color: '#86efac' }} />
            <Chip
              label={sceneReadyForPost ? 'Post-ready' : 'Mangler coverage'}
              sx={{
                bgcolor: sceneReadyForPost ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
                color: sceneReadyForPost ? '#86efac' : '#fde68a',
              }}
            />
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.08fr 1fr 0.78fr' },
          minHeight: 0,
        }}
      >
        <Box sx={{ borderRight: { xl: '1px solid #1e2536' }, minWidth: 0 }}>
          <SectionHeader icon={<ScriptIcon sx={{ fontSize: 16 }} />} label="Lined Script" value={`${selectedSceneDialogue.length} linjer`} />
          <Stack spacing={1.25} sx={{ p: 2 }}>
            {selectedSceneDialogue.length ? selectedSceneDialogue.map((line, index) => {
              const coveringShots = selectedSceneShots.filter((shot) => shotLineCoverage[shot.id]?.dialogueIds.includes(line.id));
              return (
                <Box
                  key={line.id}
                  data-testid="pmv-lined-script-line"
                  data-line-id={line.id}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: coveringShots.length ? 'rgba(16,185,129,0.08)' : 'rgba(248,113,113,0.08)',
                    border: coveringShots.length ? '1px solid rgba(16,185,129,0.24)' : '1px solid rgba(248,113,113,0.24)',
                  }}
                >
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: 0.8 }}>
                        LINE {index + 1} · {line.characterName}
                      </Typography>
                      <Typography sx={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.55, fontFamily: 'Courier New, monospace', mt: 0.75 }}>
                        "{line.dialogueText}"
                      </Typography>
                    </Box>
                    {selectedShot && (
                      <Button
                        size="small"
                        data-testid="pmv-lined-script-toggle-coverage"
                        onClick={() => onToggleLineCoverage(selectedShot.id, line.id)}
                        sx={{
                          minWidth: 92,
                          height: 26,
                          fontSize: 10,
                          color: shotLineCoverage[selectedShot.id]?.dialogueIds.includes(line.id) ? '#86efac' : '#bfdbfe',
                          border: '1px solid rgba(96,165,250,0.22)',
                          bgcolor: 'rgba(59,130,246,0.06)',
                        }}
                      >
                        {shotLineCoverage[selectedShot.id]?.dialogueIds.includes(line.id) ? 'Fjern line' : 'Cover'}
                      </Button>
                    )}
                  </Stack>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
                    {coveringShots.length ? coveringShots.map((shot) => (
                      <Chip
                        key={shot.id}
                        size="small"
                        label={`${shot.shotType || 'Shot'} · ${(takesByShot.get(shot.id) || []).map(formatTakeLabel).join(', ') || 'planned'}`}
                        sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#86efac' }}
                      />
                    )) : (
                      <Chip size="small" icon={<WarningIcon />} label="ikke dekket av shot" sx={{ bgcolor: 'rgba(248,113,113,0.12)', color: '#fca5a5' }} />
                    )}
                  </Stack>
                </Box>
              );
            }) : (
              <EmptyState label="Ingen dialoglinjer i denne scenen." />
            )}
          </Stack>
        </Box>

        <Box sx={{ borderRight: { xl: '1px solid #1e2536' }, minWidth: 0 }}>
          <SectionHeader icon={<VideoVillageIcon sx={{ fontSize: 16 }} />} label="Video Village / Takes" value={selectedShot?.shotType || 'Velg shot'} />
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {selectedSceneShots.map((shot, index) => {
                const takeCount = (takesByShot.get(shot.id) || []).length;
                const active = selectedShot?.id === shot.id;
                return (
                  <Button
                    key={shot.id}
                    size="small"
                    data-testid="pmv-review-shot-select"
                    data-shot-id={shot.id}
                    onClick={() => onSelectShot(shot)}
                    sx={{
                      color: active ? '#fff' : '#cbd5e1',
                      bgcolor: active ? 'rgba(59,130,246,0.24)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(96,165,250,0.65)' : '1px solid #252d3d',
                      fontSize: 10,
                    }}
                  >
                    Shot {index + 1} · {takeCount} takes
                  </Button>
                );
              })}
            </Stack>

            <Stack spacing={1.5}>
              {sceneTakes.length ? sceneTakes.map((take) => {
                const review = takeReviewMap[take.id] || {};
                const shot = selectedSceneShots.find((entry) => entry.id === take.shotId);
                const compared = Boolean(compareTakeIds[take.id]);
                return (
                  <Box
                    key={take.id}
                    data-testid="pmv-take-review-card"
                    data-take-id={take.id}
                    sx={{
                      p: 1.5,
                      borderRadius: '14px',
                      bgcolor: selectedShot?.id === take.shotId ? 'rgba(59,130,246,0.08)' : 'rgba(15,23,42,0.72)',
                      border: selectedShot?.id === take.shotId ? '1px solid rgba(96,165,250,0.35)' : '1px solid #1e2536',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: 'rgba(59,130,246,0.16)', display: 'grid', placeItems: 'center' }}>
                            <PlayIcon sx={{ color: '#93c5fd', fontSize: 17 }} />
                          </Box>
                          <Box>
                            <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
                              {formatTakeLabel(take)} · {shot?.shotType || take.shotId}
                            </Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 10 }}>
                              {take.camera || 'A-cam'} {take.lens ? `· ${take.lens}` : ''} · {take.duration}s · {take.status}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                      <Button
                        size="small"
                        data-testid="pmv-take-compare-toggle"
                        onClick={() => setCompareTakeIds((current) => {
                          const next = { ...current };
                          if (next[take.id]) delete next[take.id];
                          else next[take.id] = true;
                          return next;
                        })}
                        startIcon={<CompareIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          height: 28,
                          fontSize: 10,
                          color: compared ? '#fff' : '#9ca3af',
                          bgcolor: compared ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(139,92,246,0.24)',
                        }}
                      >
                        Compare
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                      <DecisionButton label="Performance" active={Boolean(review.performance)} onClick={() => onToggleTakeReview(take.id, 'performance')} testId="pmv-take-good-performance" />
                      <DecisionButton label="Framing" active={Boolean(review.framing)} onClick={() => onToggleTakeReview(take.id, 'framing')} testId="pmv-take-good-framing" />
                      <DecisionButton label="Continuity" active={Boolean(review.continuity)} onClick={() => onToggleTakeReview(take.id, 'continuity')} testId="pmv-take-good-continuity" />
                      <DecisionButton label="Editor favorite" active={Boolean(review.selected)} onClick={() => onToggleTakeSelected(take.id)} testId="pmv-take-editor-favorite" selectedColor="#34d399" />
                    </Stack>

                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                      <TextField
                        size="small"
                        data-testid="pmv-take-director-note"
                        placeholder="Reginotat: performance, framing, timing..."
                        value={review.directorNote || ''}
                        onChange={(event) => onUpdateTakeNote(take.id, 'directorNote', event.target.value)}
                        sx={textFieldSx}
                      />
                      <TextField
                        size="small"
                        data-testid="pmv-take-editor-note"
                        placeholder="Editor note: brukbar intro, match cut, continuity..."
                        value={review.editorNote || ''}
                        onChange={(event) => onUpdateTakeNote(take.id, 'editorNote', event.target.value)}
                        sx={textFieldSx}
                      />
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.25 }}>
                      <Typography sx={{ color: '#64748b', fontSize: 10 }}>
                        {review.sentToPost ? 'Sendt videre til post' : 'Ikke sendt til editor ennå'}
                      </Typography>
                      <Button
                        size="small"
                        data-testid="pmv-send-take-to-post"
                        onClick={() => onSendTakeToPost(take.id)}
                        startIcon={<SendIcon sx={{ fontSize: 13 }} />}
                        sx={{
                          height: 28,
                          fontSize: 10,
                          color: review.sentToPost ? '#86efac' : '#bfdbfe',
                          bgcolor: review.sentToPost ? 'rgba(52,211,153,0.12)' : 'rgba(59,130,246,0.08)',
                          border: review.sentToPost ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(59,130,246,0.24)',
                        }}
                      >
                        Send til editor
                      </Button>
                    </Stack>
                  </Box>
                );
              }) : (
                <EmptyState label="Ingen takes fra LiveSet på denne scenen ennå." />
              )}
            </Stack>

            {comparedTakes.length > 0 && (
              <Box data-testid="pmv-take-compare-panel" sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.24)' }}>
                <Typography sx={{ color: '#c4b5fd', fontSize: 11, fontWeight: 800, mb: 1 }}>
                  TAKE COMPARE
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {comparedTakes.map((take) => (
                    <Chip key={take.id} size="small" label={`${formatTakeLabel(take)} · ${take.status} · ${take.duration}s`} sx={{ bgcolor: 'rgba(139,92,246,0.14)', color: '#ddd6fe' }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <SectionHeader icon={<CoverageIcon sx={{ fontSize: 16 }} />} label="Coverage Map" value={sceneReadyForPost ? 'ready' : `${missingBuckets} gaps`} />
          <Stack spacing={1.2} sx={{ p: 2 }}>
            {coverageBuckets.map((bucket) => {
              const meta = STATUS_META[bucket.status];
              return (
                <Box
                  key={bucket.key}
                  data-testid="pmv-coverage-bucket"
                  data-status={bucket.status}
                  sx={{
                    p: 1.35,
                    borderRadius: '13px',
                    bgcolor: meta.bg,
                    border: `1px solid ${meta.border}`,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
                      {bucket.label}
                    </Typography>
                    <Chip size="small" label={meta.label} sx={{ bgcolor: 'rgba(0,0,0,0.24)', color: meta.color, fontWeight: 700 }} />
                  </Stack>
                  <Typography sx={{ color: '#94a3b8', fontSize: 10.5, mt: 0.75 }}>
                    {bucket.plannedShots.length} planned · {bucket.recordedTakes.length} recorded · {bucket.selectedTakes.length} selected
                  </Typography>
                </Box>
              );
            })}
          </Stack>

          <Divider sx={{ borderColor: '#1e2536' }} />
          <Box data-testid="pmv-post-handoff-panel" sx={{ p: 2 }}>
            <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 800, mb: 1 }}>
              Post Handoff
            </Typography>
            <Stack spacing={1}>
              <HandoffRow label="Favorites" value={selectedTakeCount} ok={selectedTakeCount > 0} />
              <HandoffRow label="Coverage gaps" value={missingBuckets} ok={missingBuckets === 0} />
              <HandoffRow label="Sent to editor" value={sentToPostCount} ok={sentToPostCount > 0} />
            </Stack>
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: '12px', bgcolor: sceneReadyForPost ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', border: sceneReadyForPost ? '1px solid rgba(52,211,153,0.24)' : '1px solid rgba(251,191,36,0.24)' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {sceneReadyForPost ? <CheckCircleIcon sx={{ color: '#86efac', fontSize: 17 }} /> : <WarningIcon sx={{ color: '#fde68a', fontSize: 17 }} />}
                <Typography sx={{ color: sceneReadyForPost ? '#86efac' : '#fde68a', fontSize: 11.5, fontWeight: 700 }}>
                  {sceneReadyForPost ? 'Scene kan sendes trygt til edit.' : 'Scene trenger mer coverage eller valgte takes.'}
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const SectionHeader = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.35, borderBottom: '1px solid #1e2536', bgcolor: 'rgba(15,23,42,0.62)' }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#93c5fd' }}>
      {icon}
      <Typography sx={{ color: '#e5e7eb', fontSize: 11, fontWeight: 800, letterSpacing: 0.8 }}>
        {label.toUpperCase()}
      </Typography>
    </Stack>
    <Typography sx={{ color: '#64748b', fontSize: 10, fontWeight: 700 }}>
      {value}
    </Typography>
  </Stack>
);

const DecisionButton = ({
  label,
  active,
  onClick,
  testId,
  selectedColor = '#60a5fa',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
  selectedColor?: string;
}) => (
  <Button
    size="small"
    data-testid={testId}
    onClick={onClick}
    sx={{
      height: 26,
      px: 1,
      fontSize: 10,
      color: active ? selectedColor : '#9ca3af',
      bgcolor: active ? 'rgba(96,165,250,0.13)' : 'rgba(255,255,255,0.035)',
      border: active ? `1px solid ${selectedColor}66` : '1px solid #252d3d',
      '&:hover': { bgcolor: 'rgba(96,165,250,0.16)' },
    }}
  >
    {label}
  </Button>
);

const HandoffRow = ({ label, value, ok }: { label: string; value: number; ok: boolean }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ color: '#9ca3af', fontSize: 11 }}>
    <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>{label}</Typography>
    <Chip
      size="small"
      label={value}
      sx={{
        width: 38,
        bgcolor: ok ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
        color: ok ? '#86efac' : '#fca5a5',
      }}
    />
  </Stack>
);

const EmptyState = ({ label }: { label: string }) => (
  <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.035)', border: '1px dashed #334155' }}>
    <Typography sx={{ color: '#64748b', fontSize: 12 }}>{label}</Typography>
  </Box>
);

const textFieldSx = {
  '& .MuiInputBase-root': {
    bgcolor: 'rgba(2,6,23,0.72)',
    color: '#e5e7eb',
    fontSize: 12,
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#253044' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
  '& .MuiInputBase-input::placeholder': { color: '#64748b', opacity: 1 },
};
