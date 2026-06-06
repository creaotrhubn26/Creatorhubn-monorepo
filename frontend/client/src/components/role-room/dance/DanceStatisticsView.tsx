/**
 * DanceStatisticsView — analyse-flate over prosjektets annotations.
 *
 * Tre breakdowns:
 *   1. Counts per kategori (m/ farge-bar)
 *   2. Counts per dancer (m/ progress-bar)
 *   3. Top labels (mest brukte 10 — frequency-sortert)
 *
 * + Sammendrags-kort øverst: total annotations / clips / annotert tid /
 * gjennomsnittlig varighet.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { Refresh as RefreshIcon } from '@mui/icons-material';

import { useDanceAnnotationsAggregate } from './useDanceAnnotationsAggregate';
import { useDanceAnnotationCatalog } from './useDanceAnnotationCatalog';
import { formatTimecode } from './timecode';
import { danceFlowColors } from './danceFlowTheme';

export interface DanceStatisticsViewProps {
  projectId: string | null;
  dancerOptions: Array<{ id: string; label: string }>;
}

interface SummaryCard {
  label: string;
  value: string;
  hint?: string;
}

export default function DanceStatisticsView({
  projectId,
  dancerOptions,
}: DanceStatisticsViewProps): React.ReactElement {
  const aggregate = useDanceAnnotationsAggregate({ projectId });
  const catalog = useDanceAnnotationCatalog({ projectId });

  const stats = React.useMemo(() => {
    const totalCount = aggregate.annotations.length;
    let totalDuration = 0;
    const byCategory = new Map<string, { count: number; duration: number }>();
    const byDancer = new Map<string, { count: number; duration: number }>();
    const byLabel = new Map<string, number>();
    const usedClips = new Set<string>();

    for (const a of aggregate.annotations) {
      usedClips.add(a.clipId);
      const dur = a.endSec != null ? a.endSec - a.timestampSec : 0;
      totalDuration += dur;

      const catKey = a.category ?? '__uncat__';
      const catEntry = byCategory.get(catKey) ?? { count: 0, duration: 0 };
      byCategory.set(catKey, { count: catEntry.count + 1, duration: catEntry.duration + dur });

      if (a.targetDancerIds.length === 0) {
        const e = byDancer.get('__unset__') ?? { count: 0, duration: 0 };
        byDancer.set('__unset__', { count: e.count + 1, duration: e.duration + dur });
      } else {
        for (const did of a.targetDancerIds) {
          const e = byDancer.get(did) ?? { count: 0, duration: 0 };
          byDancer.set(did, { count: e.count + 1, duration: e.duration + dur });
        }
      }

      const label = a.body.trim();
      if (label) {
        byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
      }
    }

    const topLabels = Array.from(byLabel.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalCount,
      totalDuration,
      avgDuration: totalCount > 0 ? totalDuration / totalCount : 0,
      annotatedClips: usedClips.size,
      totalClips: aggregate.clips.length,
      byCategory,
      byDancer,
      topLabels,
    };
  }, [aggregate.annotations, aggregate.clips]);

  const summaryCards: SummaryCard[] = [
    { label: 'Total annotations', value: String(stats.totalCount) },
    {
      label: 'Annotert tid',
      value: stats.totalDuration > 0 ? formatTimecode(stats.totalDuration) : '—',
    },
    {
      label: 'Gjennomsnittlig varighet',
      value: stats.totalCount > 0 ? `${stats.avgDuration.toFixed(1)}s` : '—',
    },
    {
      label: 'Clips annotert',
      value: stats.totalClips > 0 ? `${stats.annotatedClips} / ${stats.totalClips}` : '0',
      hint: stats.totalClips > 0
        ? `${Math.round((stats.annotatedClips / stats.totalClips) * 100)}%`
        : undefined,
    },
  ];

  const dancerLabel = (id: string): string => {
    if (id === '__unset__') return 'Uten dancer';
    return dancerOptions.find((d) => d.id === id)?.label ?? id;
  };

  // Maks-verdier for normaliserte progress-bars
  const maxCatCount = Math.max(1, ...Array.from(stats.byCategory.values()).map((v) => v.count));
  const maxDancerCount = Math.max(1, ...Array.from(stats.byDancer.values()).map((v) => v.count));
  const maxLabelCount = Math.max(1, ...stats.topLabels.map((p) => p[1]));

  return (
    <Box
      data-testid="dance-statistics-view"
      sx={{
        p: 2, height: '100%', minHeight: '100vh',
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textPrimary,
      }}
    >
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Typography sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
          Statistics
        </Typography>
        <IconButton
          size="small"
          onClick={() => { void aggregate.refresh(); }}
          disabled={aggregate.loading}
          data-testid="dance-statistics-refresh"
          sx={{ color: danceFlowColors.textMuted }}
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {aggregate.loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} sx={{ color: danceFlowColors.lavender }} />
        </Stack>
      ) : aggregate.error ? (
        <Box
          sx={{
            p: 2, borderRadius: 1,
            bgcolor: 'rgba(248,113,113,0.08)',
            border: `1px solid rgba(248,113,113,0.2)`,
            color: danceFlowColors.errorPrimary,
            fontSize: 12,
          }}
        >
          {aggregate.error}
        </Box>
      ) : aggregate.annotations.length === 0 ? (
        <Box
          data-testid="dance-statistics-empty"
          sx={{
            p: 6, textAlign: 'center',
            border: `1px dashed ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography sx={{ fontSize: 14, color: danceFlowColors.textSecondary, mb: 1 }}>
            Ingen annotations ennå
          </Typography>
          <Typography sx={{ fontSize: 12, color: danceFlowColors.textMuted }}>
            Legg til annotations i Annotate-flaten for å se statistikk.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {/* Sammendrags-kort */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}>
            {summaryCards.map((c) => (
              <Box
                key={c.label}
                data-testid={`dance-statistics-summary-${c.label.replace(/\s+/g, '-').toLowerCase()}`}
                sx={{
                  p: 2,
                  bgcolor: danceFlowColors.bgPanel,
                  border: `1px solid ${danceFlowColors.borderStrong}`,
                  borderRadius: 1,
                }}
              >
                <Typography sx={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: danceFlowColors.textMuted, mb: 0.5,
                }}>
                  {c.label}
                </Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{
                    fontSize: 22, fontWeight: 700,
                    color: danceFlowColors.lavender,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {c.value}
                  </Typography>
                  {c.hint ? (
                    <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled }}>
                      {c.hint}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Box>

          {/* Per kategori + Per dancer side-by-side */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 1.5,
          }}>
            {/* Kategorier */}
            <Box sx={{
              p: 2,
              bgcolor: danceFlowColors.bgPanel,
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
            }}>
              <Typography sx={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: danceFlowColors.textMuted, mb: 1.5,
              }}>
                Per kategori
              </Typography>
              <Stack spacing={1}>
                {catalog.categories.map((cat) => {
                  const data = stats.byCategory.get(cat.id) ?? { count: 0, duration: 0 };
                  const pct = (data.count / maxCatCount) * 100;
                  return (
                    <Box key={cat.id} data-testid={`dance-statistics-cat-${cat.id}`}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                        <Box sx={{
                          width: 10, height: 10, borderRadius: '50%',
                          bgcolor: cat.color, flexShrink: 0,
                        }} />
                        <Typography sx={{ flex: 1, fontSize: 12, color: danceFlowColors.textSecondary }}>
                          {cat.name}
                        </Typography>
                        <Typography sx={{
                          fontSize: 11, color: danceFlowColors.textMuted,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {data.duration > 0 ? formatTimecode(data.duration) : ''}
                        </Typography>
                        <Typography sx={{
                          fontSize: 12, fontWeight: 700, color: danceFlowColors.textPrimary,
                          minWidth: 24, textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {data.count}
                        </Typography>
                      </Stack>
                      <Box sx={{
                        height: 4, borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                      }}>
                        <Box sx={{
                          width: `${pct}%`, height: '100%',
                          bgcolor: cat.color,
                          transition: 'width 240ms',
                        }} />
                      </Box>
                    </Box>
                  );
                })}
                {stats.byCategory.has('__uncat__') ? (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                      <Box sx={{
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: danceFlowColors.textDisabled,
                      }} />
                      <Typography sx={{ flex: 1, fontSize: 12, color: danceFlowColors.textDisabled }}>
                        Uten kategori
                      </Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: danceFlowColors.textMuted }}>
                        {stats.byCategory.get('__uncat__')!.count}
                      </Typography>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>

            {/* Dancers */}
            <Box sx={{
              p: 2,
              bgcolor: danceFlowColors.bgPanel,
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
            }}>
              <Typography sx={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: danceFlowColors.textMuted, mb: 1.5,
              }}>
                Per dancer
              </Typography>
              <Stack spacing={1}>
                {Array.from(stats.byDancer.entries())
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([id, data]) => {
                    const pct = (data.count / maxDancerCount) * 100;
                    const isUnset = id === '__unset__';
                    return (
                      <Box key={id} data-testid={`dance-statistics-dancer-${id}`}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                          <Typography sx={{
                            flex: 1, fontSize: 12,
                            color: isUnset ? danceFlowColors.textDisabled : danceFlowColors.textSecondary,
                          }}>
                            {dancerLabel(id)}
                          </Typography>
                          <Typography sx={{
                            fontSize: 11, color: danceFlowColors.textMuted,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {data.duration > 0 ? formatTimecode(data.duration) : ''}
                          </Typography>
                          <Typography sx={{
                            fontSize: 12, fontWeight: 700, color: danceFlowColors.textPrimary,
                            minWidth: 24, textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {data.count}
                          </Typography>
                        </Stack>
                        <Box sx={{
                          height: 4, borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          overflow: 'hidden',
                        }}>
                          <Box sx={{
                            width: `${pct}%`, height: '100%',
                            bgcolor: isUnset ? danceFlowColors.textDisabled : danceFlowColors.lavender,
                            transition: 'width 240ms',
                          }} />
                        </Box>
                      </Box>
                    );
                  })}
              </Stack>
            </Box>
          </Box>

          {/* Top labels */}
          <Box sx={{
            p: 2,
            bgcolor: danceFlowColors.bgPanel,
            border: `1px solid ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
          }}>
            <Typography sx={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: danceFlowColors.textMuted, mb: 1.5,
            }}>
              Topp 10 labels
            </Typography>
            {stats.topLabels.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: danceFlowColors.textDisabled }}>
                Ingen labels brukt ennå.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {stats.topLabels.map(([label, count]) => {
                  const pct = (count / maxLabelCount) * 100;
                  return (
                    <Box key={label} data-testid={`dance-statistics-label-${label.replace(/\s+/g, '-').toLowerCase()}`}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                        <Typography sx={{ flex: 1, fontSize: 12, color: danceFlowColors.textSecondary, fontWeight: 600 }}>
                          {label}
                        </Typography>
                        <Typography sx={{
                          fontSize: 12, fontWeight: 700, color: danceFlowColors.lavender,
                          minWidth: 24, textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {count}
                        </Typography>
                      </Stack>
                      <Box sx={{
                        height: 3, borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                      }}>
                        <Box sx={{
                          width: `${pct}%`, height: '100%',
                          bgcolor: danceFlowColors.lavender,
                          transition: 'width 240ms',
                        }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
