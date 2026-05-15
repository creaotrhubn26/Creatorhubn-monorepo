/**
 * DanceAnalysisPanel — DanceAnnotate-/DanceFlow-paritet: aggregerte stats
 * på tvers av aktivt prosjekt.
 *
 * Viser:
 *   • Annotations per kategori (bar chart)
 *   • Formasjoner per type (formation-templates-bruken)
 *   • Rehearsal-progress (godkjent / repetere / pending)
 *   • Top-5 mest-annoterte dansere
 *
 * Data hentes fra eksisterende services. Klippene loopes med en cap
 * (10) for å unngå N+1-belastning ved store prosjekter.
 */

import React from 'react';
import { Box, Stack, Typography, Card, CardContent, Chip, CircularProgress, LinearProgress } from '@mui/material';
import {
  Insights as InsightsIcon,
  Tag as TagIcon,
  PeopleAlt as PeopleIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { listClips, listAnnotations } from './danceVideoService';
import { listFormations } from './danceFormationService';
import { listRehearsals } from './danceRehearsalService';
import { listDancerProfiles } from './dancerProfileService';
import { DANCE_MOVEMENT_CATEGORIES, categoryById } from './danceMovementCategories';

export interface DanceAnalysisPanelProps {
  projectId: string | null;
}

interface AnalysisData {
  annotationsByCategory: Map<string, number>;
  totalAnnotations: number;
  formationsCount: number;
  formationsByTag: Map<string, number>;
  rehearsalsCount: number;
  reviewOutcomes: { approved: number; needs_repeat: number; pending: number };
  topDancers: Array<{ id: string; name: string; count: number; color?: string }>;
}

export function DanceAnalysisPanel({ projectId }: DanceAnalysisPanelProps): React.ReactElement {
  const [data, setData] = React.useState<AnalysisData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [clips, formations, rehearsals, profiles] = await Promise.all([
          listClips({ projectId: projectId ?? undefined }),
          listFormations(projectId ?? undefined),
          listRehearsals({ projectId: projectId ?? undefined, limit: 200 }),
          listDancerProfiles(projectId ?? undefined),
        ]);

        // Annotations per kategori + per danser (loop opptil 20 klipp).
        const annotationsByCategory = new Map<string, number>();
        const annotationsByDancer = new Map<string, number>();
        const reviewCounts = { approved: 0, needs_repeat: 0, pending: 0 };
        let totalAnnotations = 0;

        const clipSubset = clips.slice(0, 20);
        await Promise.all(clipSubset.map(async (c) => {
          try {
            const anns = await listAnnotations(c.id);
            totalAnnotations += anns.length;
            for (const a of anns) {
              const catKey = a.category ?? '__uncat__';
              annotationsByCategory.set(catKey, (annotationsByCategory.get(catKey) ?? 0) + 1);
              for (const id of a.targetDancerIds) {
                annotationsByDancer.set(id, (annotationsByDancer.get(id) ?? 0) + 1);
              }
            }
          } catch { /* ignore per-clip */ }
        }));

        // Rehearsal-outcomes på tvers av alle prøver.
        for (const r of rehearsals) {
          for (const rv of r.segmentReviews ?? []) {
            if (rv.outcome === 'approved') reviewCounts.approved += 1;
            else if (rv.outcome === 'needs_repeat') reviewCounts.needs_repeat += 1;
            else reviewCounts.pending += 1;
          }
        }

        // Formasjoner-per-tag.
        const formationsByTag = new Map<string, number>();
        for (const f of formations) {
          for (const t of f.tags ?? []) {
            formationsByTag.set(t, (formationsByTag.get(t) ?? 0) + 1);
          }
        }

        // Top-5 dansere etter annotation-count.
        const profileByDancerId = new Map(profiles.map((p) => [p.dancerId, p]));
        const topDancers = Array.from(annotationsByDancer.entries())
          .map(([id, count]) => {
            const p = profileByDancerId.get(id);
            return {
              id,
              name: p?.displayName ?? id,
              count,
              color: undefined as string | undefined,
            };
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        if (!cancelled) {
          setData({
            annotationsByCategory,
            totalAnnotations,
            formationsCount: formations.length,
            formationsByTag,
            rehearsalsCount: rehearsals.length,
            reviewOutcomes: reviewCounts,
            topDancers,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke laste analyse');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading && !data) {
    return (
      <Box data-testid="dance-analysis-panel" sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} sx={{ color: '#8b5cf6' }} />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box data-testid="dance-analysis-panel" sx={{ p: 3 }}>
        <Typography sx={{ color: '#fca5a5' }}>{error ?? 'Ingen data'}</Typography>
      </Box>
    );
  }

  const maxCatCount = Math.max(1, ...Array.from(data.annotationsByCategory.values()));
  const totalOutcomes = data.reviewOutcomes.approved + data.reviewOutcomes.needs_repeat + data.reviewOutcomes.pending;

  return (
    <Box
      data-testid="dance-analysis-panel"
      sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0a0a0a', minHeight: '100%', color: '#e5e7eb' }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <InsightsIcon sx={{ color: '#a78bfa', fontSize: 22 }} />
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
          Analysis
        </Typography>
        <Chip
          size="small"
          label={`${data.totalAnnotations} annotasjoner · ${data.formationsCount} formasjoner · ${data.rehearsalsCount} prøver`}
          sx={{ ml: 1, height: 22, fontSize: 11, bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd' }}
        />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2,
        }}
      >
        {/* ─── Annotations per kategori ───────────────────────────── */}
        <Card data-testid="analysis-annotations-by-category" sx={{ bgcolor: '#0f1318', border: '1px solid rgba(139,92,246,0.18)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <TagIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: '#a78bfa', fontWeight: 700 }}>
                ANNOTATIONS PER KATEGORI
              </Typography>
            </Stack>
            <Stack spacing={0.75}>
              {DANCE_MOVEMENT_CATEGORIES.map((cat) => {
                const count = data.annotationsByCategory.get(cat.id) ?? 0;
                const pct = (count / maxCatCount) * 100;
                return (
                  <Box key={cat.id} data-testid={`analysis-cat-${cat.id}`}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
                      <Typography sx={{ fontSize: 11, color: cat.color, fontWeight: 700, letterSpacing: 0.5 }}>
                        {cat.label}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>
                        {count}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 6, borderRadius: 1,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        '& .MuiLinearProgress-bar': { bgcolor: cat.color },
                      }}
                    />
                  </Box>
                );
              })}
              {/* Ukategorisert (hvis noen) */}
              {(data.annotationsByCategory.get('__uncat__') ?? 0) > 0 ? (
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>Uten kategori</Typography>
                    <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>
                      {data.annotationsByCategory.get('__uncat__')}
                    </Typography>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        {/* ─── Rehearsal-outcomes ─────────────────────────────────── */}
        <Card data-testid="analysis-rehearsal-outcomes" sx={{ bgcolor: '#0f1318', border: '1px solid rgba(139,92,246,0.18)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <CheckIcon sx={{ fontSize: 16, color: '#34d399' }} />
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: '#a78bfa', fontWeight: 700 }}>
                REHEARSAL OUTCOMES
              </Typography>
            </Stack>
            {totalOutcomes === 0 ? (
              <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                Ingen segment-reviews ennå.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                <OutcomeBar label="Godkjent" color="#34d399" count={data.reviewOutcomes.approved} total={totalOutcomes} testId="approved" />
                <OutcomeBar label="Må repeteres" color="#fbbf24" count={data.reviewOutcomes.needs_repeat} total={totalOutcomes} testId="needs-repeat" />
                <OutcomeBar label="Avventer" color="#9ca3af" count={data.reviewOutcomes.pending} total={totalOutcomes} testId="pending" />
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ─── Top-5 dansere ──────────────────────────────────────── */}
        <Card data-testid="analysis-top-dancers" sx={{ bgcolor: '#0f1318', border: '1px solid rgba(139,92,246,0.18)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <PeopleIcon sx={{ fontSize: 16, color: '#60a5fa' }} />
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: '#a78bfa', fontWeight: 700 }}>
                MEST ANNOTERTE DANSERE
              </Typography>
            </Stack>
            {data.topDancers.length === 0 ? (
              <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                Ingen danser-annotasjoner ennå.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {data.topDancers.map((d, i) => (
                  <Stack
                    key={d.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    data-testid={`analysis-top-dancer-${d.id}`}
                  >
                    <Typography sx={{ fontSize: 11, color: '#6b7280', fontWeight: 700, width: 14 }}>
                      #{i + 1}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff', flex: 1 }} noWrap>
                      {d.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${d.count}`}
                      sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(96,165,250,0.18)', color: '#93c5fd' }}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ─── Formasjons-tagger ──────────────────────────────────── */}
        <Card data-testid="analysis-formation-tags" sx={{ bgcolor: '#0f1318', border: '1px solid rgba(139,92,246,0.18)' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: '#a78bfa', fontWeight: 700 }}>
                FORMASJONS-TAGGER ({data.formationsByTag.size})
              </Typography>
            </Stack>
            {data.formationsByTag.size === 0 ? (
              <Typography sx={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                Ingen formasjoner har tags ennå.
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {Array.from(data.formationsByTag.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([tag, count]) => (
                    <Chip
                      key={tag}
                      size="small"
                      label={`${tag} · ${count}`}
                      sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd' }}
                    />
                  ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

interface OutcomeBarProps {
  label: string;
  color: string;
  count: number;
  total: number;
  testId: string;
}

const OutcomeBar: React.FC<OutcomeBarProps> = ({ label, color, count, total, testId }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <Box data-testid={`analysis-outcome-${testId}`}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography sx={{ fontSize: 11, color, fontWeight: 700 }}>{label}</Typography>
        <Typography sx={{ fontSize: 11, color: '#e5e7eb', fontVariantNumeric: 'tabular-nums' }}>
          {count} · {pct.toFixed(0)}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6, borderRadius: 1,
          bgcolor: 'rgba(255,255,255,0.04)',
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
    </Box>
  );
};

export default DanceAnalysisPanel;
