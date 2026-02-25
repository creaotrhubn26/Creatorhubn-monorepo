/**
 * ScenePoolPanel.tsx
 *
 * Visualises the unscheduled scene pool.
 *
 * • Displays every ScenePoolItem as a colour-coded "strip card".
 * • Provides filter controls (INT/EXT, time-of-day, location, cast, search).
 * • Shows aggregate stats (total pages, total time, breakdown by INT/EXT).
 * • Each card is draggable so the parent (StripboardPanel) can drop it onto
 *   a ShootDay bucket.
 * • "Assign" button on each card calls props.onAssignRequest so the parent
 *   can open the assign dialog.
 *
 * Props follow the same "responsive + isMobile" pattern used across the
 * rest of the stripboard module.
 */

import { type FC, type DragEvent, useCallback, useState } from 'react';
import { ContextualNudgeBanner } from '../ContextualNudgeBanner';
import {
  Box, Paper, Typography, Chip, IconButton, Tooltip,
  Divider, Collapse, LinearProgress, Stack, Badge,
  TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
  alpha, useTheme,
} from '@mui/material';
import {
  WbSunny as DayIcon,
  NightsStay as NightIcon,
  WbTwilight as DawnIcon,
  Bedtime as DuskIcon,
  Home as IntIcon,
  Landscape as ExtIcon,
  Merge as IntExtIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Place as PlaceIcon,
  Schedule as ScheduleIcon,
  Description as PagesIcon,
  Warning as WarnIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Add as AssignIcon,
  CalendarMonth as CalendarIcon,
  SortByAlpha as SortIcon,
  Star as StarIcon,
} from '@mui/icons-material';

import type { ScenePoolItem, IntExtType, TimeOfDay, ScenePoolStats, ShootDay } from './stripboard.types';
import type { ScenePoolFilters, PoolSortKey, ScenePoolHandle } from './useScenePool';
import type { ResponsiveValues } from './stripboard.types';

// ─── Sub-types ────────────────────────────────────────────────────────────────

interface ScenePoolPanelProps {
  pool: ScenePoolHandle;
  shootDays?: ShootDay[];      // available days to assign to
  isMobile: boolean;
  responsive: ResponsiveValues;
  onAssignRequest?: (item: ScenePoolItem) => void;
  onSceneSelect?: (sceneId: string) => void;
  /** Called when drag starts – parent can react to highlight drop zones. */
  onDragStartScene?: (item: ScenePoolItem) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INT_EXT_OPTIONS: { value: IntExtType | 'all'; label: string; icon: typeof IntIcon }[] = [
  { value: 'all',      label: 'Alle',    icon: FilterIcon   },
  { value: 'INT',      label: 'INT',     icon: IntIcon      },
  { value: 'EXT',      label: 'EXT',     icon: ExtIcon      },
  { value: 'INT/EXT',  label: 'INT/EXT', icon: IntExtIcon   },
];

const TIME_OPTIONS: { value: TimeOfDay | 'all'; label: string; Icon: FC<{ fontSize?: 'small' }> }[] = [
  { value: 'all',   label: 'Alle',      Icon: DayIcon  },
  { value: 'DAY',   label: 'DAG',       Icon: DayIcon  },
  { value: 'NIGHT', label: 'NATT',      Icon: NightIcon },
  { value: 'DAWN',  label: 'SOLOPPGANG', Icon: DawnIcon },
  { value: 'DUSK',  label: 'SOLNEDGANG', Icon: DuskIcon },
];

const SORT_OPTIONS: { value: PoolSortKey; label: string }[] = [
  { value: 'sceneNumber',      label: 'Scene #'  },
  { value: 'pageCount',        label: 'Sider'    },
  { value: 'location',         label: 'Lokasjon' },
  { value: 'castSize',         label: 'Cast'     },
  { value: 'estimatedMinutes', label: 'Tid'      },
];

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}t ${rem}min` : `${h}t`;
}

// ─── Scene card ───────────────────────────────────────────────────────────────

interface SceneCardProps {
  item: ScenePoolItem;
  isMobile: boolean;
  responsive: ResponsiveValues;
  onAssignRequest?: (item: ScenePoolItem) => void;
  onSceneSelect?: (id: string) => void;
  onDragStart: (e: DragEvent<HTMLElement>, item: ScenePoolItem) => void;
}

const SceneCard: FC<SceneCardProps> = ({
  item, isMobile, responsive, onAssignRequest, onSceneSelect, onDragStart,
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Does the background colour need dark text?
  const needsDarkText = ['#fff', '#ffe', '#fff9', '#e3f', '#e8f', '#fbe', '#ede', '#ffe0', '#fce4', '#fff3'].some(
    prefix => item.color.toLowerCase().startsWith(prefix),
  );
  const textColor = needsDarkText || !isDark ? 'rgba(0,0,0,0.87)' : '#fff';

  // On mobile, collapse less-critical info to keep the card compact
  const showSynopsis       = !isMobile && !!item.title;
  const showFullCastList   = !isMobile;
  const showSpecialReqs    = !isMobile || item.specialRequirements.length > 0;

  return (
    <Paper
      draggable
      onDragStart={e => onDragStart(e, item)}
      elevation={1}
      sx={{
        mb: 1,
        overflow: 'hidden',
        borderRadius: 2,
        border: `2px solid ${alpha(item.color, 0.6)}`,
        cursor: 'grab',
        transition: 'all 0.15s ease',
        '&:hover': { elevation: 3, transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${alpha(item.color, 0.3)}` },
        '&:active': { cursor: 'grabbing' },
      }}
    >
      {/* Color band */}
      <Box sx={{ height: 5, bgcolor: item.color }} />

      <Box sx={{ p: { xs: 1, sm: 1.25 } }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
            <Chip
              label={item.sceneNumber}
              size="small"
              sx={{ bgcolor: item.color, color: textColor, fontWeight: 700, fontSize: '0.75rem', minWidth: 36, height: 22 }}
            />
            <Chip
              label={item.intExtType}
              size="small"
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
            <Chip
              label={item.timeOfDay}
              size="small"
              icon={
                item.timeOfDay === 'DAY'   ? <DayIcon  sx={{ fontSize: '0.75rem !important' }} /> :
                item.timeOfDay === 'NIGHT' ? <NightIcon sx={{ fontSize: '0.75rem !important' }} /> :
                item.timeOfDay === 'DAWN'  ? <DawnIcon  sx={{ fontSize: '0.75rem !important' }} /> :
                                             <DuskIcon  sx={{ fontSize: '0.75rem !important' }} />
              }
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
            {onSceneSelect && (
              <Tooltip title="Gå til scene i manus">
                <IconButton size="small" onClick={() => onSceneSelect(item.id)} sx={{ p: 0.375 }}>
                  <PagesIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
            {onAssignRequest && (
              <Tooltip title="Tildel til dag">
                <IconButton
                  size="small"
                  onClick={() => onAssignRequest(item)}
                  sx={{ p: 0.375, bgcolor: alpha('#7C3AED', 0.1), '&:hover': { bgcolor: alpha('#7C3AED', 0.2) } }}
                >
                  <AssignIcon sx={{ fontSize: 14, color: '#7C3AED' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Location */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <PlaceIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontSize: responsive.fontSize.caption, fontWeight: 600, lineHeight: 1.2 }}>
            {item.location}
          </Typography>
        </Box>

        {/* Title / synopsis */}
        {showSynopsis && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', mb: 0.5, lineHeight: 1.3 }}>
            {item.title}
          </Typography>
        )}

        {/* Stats row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <PagesIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{item.pageCount}s</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <ScheduleIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{formatMinutes(item.estimatedMinutes)}</Typography>
          </Box>
          {item.cast.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <PersonIcon sx={{ fontSize: 11, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                {showFullCastList
                  ? (item.cast.length > 2 ? `${item.cast.slice(0, 2).join(', ')} +${item.cast.length - 2}` : item.cast.join(', '))
                  : `${item.cast.length}`
                }
              </Typography>
            </Box>
          )}
        </Box>

        {/* Special requirements */}
        {showSpecialReqs && item.specialRequirements.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            <WarnIcon sx={{ fontSize: 12, color: 'warning.main', flexShrink: 0 }} />
            {item.specialRequirements.map(req => (
              <Chip key={req} label={req.replace(/_/g, ' ')} size="small"
                sx={{ height: 18, fontSize: '0.6rem', bgcolor: alpha('#F59E0B', 0.15), color: 'warning.dark' }} />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// ─── Stats bar ────────────────────────────────────────────────────────────────

const StatsBar: FC<{ stats: ScenePoolStats; isMobile: boolean }> = ({ stats, isMobile }) => (
  <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap', alignItems: 'center' }}>
    {[
      { value: stats.totalScenes, label: 'Scener', color: '#7C3AED' },
      { value: `${stats.totalPages.toFixed(1)}s`, label: 'Sider', color: '#3B82F6' },
      { value: formatMinutes(stats.totalMinutes), label: 'Total tid', color: '#10B981' },
      { value: stats.uniqueLocations, label: 'Lok.', color: '#F59E0B' },
      { value: stats.uniqueCastMembers, label: 'Cast', color: '#EF4444' },
    ].map(s => (
      <Box key={s.label} textAlign="center">
        <Typography variant="h6" fontWeight={700} color={s.color} sx={{ fontSize: '1rem', lineHeight: 1 }}>
          {s.value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {s.label}
        </Typography>
      </Box>
    ))}
    {!isMobile && (
      <>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        {Object.entries(stats.byIntExt).filter(([, n]) => n > 0).map(([k, n]) => (
          <Chip key={k} label={`${k}: ${n}`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
        ))}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        {Object.entries(stats.byTimeOfDay).filter(([, n]) => n > 0).map(([k, n]) => (
          <Chip key={k} label={`${k}: ${n}`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
        ))}
        {stats.hasSpecialRequirements > 0 && (
          <Chip icon={<WarnIcon sx={{ fontSize: 12 }} />} label={`${stats.hasSpecialRequirements} spesielle`}
            color="warning" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
        )}
      </>
    )}
  </Box>
);

// ─── Main panel ───────────────────────────────────────────────────────────────

export const ScenePoolPanel: FC<ScenePoolPanelProps> = ({
  pool, isMobile, responsive, onAssignRequest, onSceneSelect, onDragStartScene,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const filters: ScenePoolFilters = pool.filters;

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLElement>, item: ScenePoolItem) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/scene-pool-item', item.id);
      onDragStartScene?.(item);
    },
    [onDragStartScene],
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <ContextualNudgeBanner context="scene-pool" accentColor="#7C3AED" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <Box sx={{ p: { xs: 1.25, sm: 1.75 }, borderBottom: 1, borderColor: 'divider', bgcolor: alpha('#7C3AED', 0.04) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: responsive.fontSize.subtitle }}>
            <StarIcon sx={{ fontSize: 18, color: '#7C3AED' }} />
            Scene Pool
            <Badge badgeContent={pool.allItems.length} color="secondary" sx={{ ml: 0.5 }}>
              <Box />
            </Badge>
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={filtersOpen ? 'Skjul filtre' : 'Vis filtre'}>
              <IconButton size="small" onClick={() => setFiltersOpen(p => !p)}>
                {filtersOpen ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <StatsBar stats={pool.stats} isMobile={isMobile} />
      </Box>

      {/* ── Filter panel ───────────────────────────────────────────── */}
      <Collapse in={filtersOpen}>
        <Stack
          spacing={1}
          sx={{ p: { xs: 1, sm: 1.5 }, borderBottom: 1, borderColor: 'divider', bgcolor: alpha('#f5f5f5', 0.5) }}
        >

          {/* Search */}
          <TextField
            size="small"
            placeholder="Søk scene, lokasjon eller cast…"
            value={filters.searchQuery}
            onChange={e => pool.setFilter('searchQuery', e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
            sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.75 } }}
            fullWidth
          />

          {/* INT/EXT toggle */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 0.25, display: 'block' }}>INT / EXT</Typography>
            <ToggleButtonGroup
              size="small"
              value={filters.intExtType}
              exclusive
              onChange={(_, v) => { if (v !== null) pool.setFilter('intExtType', v); }}
              sx={{ '& .MuiToggleButton-root': { fontSize: '0.7rem', py: 0.375, px: 0.75 } }}
            >
              {INT_EXT_OPTIONS.map(o => (
                <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Time of day toggle */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 0.25, display: 'block' }}>Tidspunkt</Typography>
            <ToggleButtonGroup
              size="small"
              value={filters.timeOfDay}
              exclusive
              onChange={(_, v) => { if (v !== null) pool.setFilter('timeOfDay', v); }}
              sx={{ '& .MuiToggleButton-root': { fontSize: '0.7rem', py: 0.375, px: 0.75 } }}
            >
              {TIME_OPTIONS.map(o => (
                <ToggleButton key={o.value} value={o.value}>
                  <o.Icon fontSize="small" />
                  {!isMobile && <Box component="span" sx={{ ml: 0.5 }}>{o.label}</Box>}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Sort */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SortIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Sorter:</Typography>
            {SORT_OPTIONS.map(o => (
              <Chip key={o.value}
                label={o.label}
                size="small"
                variant={pool.sortKey === o.value ? 'filled' : 'outlined'}
                color={pool.sortKey === o.value ? 'primary' : 'default'}
                onClick={() => {
                  if (pool.sortKey === o.value) pool.setSortDir(pool.sortDir === 'asc' ? 'desc' : 'asc');
                  else pool.setSortKey(o.value);
                }}
                sx={{ height: 20, fontSize: '0.65rem', cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Stack>
      </Collapse>

      {/* ── Scene list ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 1.25 } }}>
        {pool.items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
            {pool.allItems.length === 0 ? (
              <>
                <CalendarIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Alle scener er planlagt!
                </Typography>
              </>
            ) : (
              <>
                <FilterIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Ingen scener matcher filteret.
                </Typography>
              </>
            )}
          </Box>
        ) : (
          pool.items.map(item => (
            <SceneCard
              key={item.id}
              item={item}
              isMobile={isMobile}
              responsive={responsive}
              onAssignRequest={onAssignRequest}
              onSceneSelect={onSceneSelect}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </Box>

      {/* ── Progress footer ────────────────────────────────────────── */}
      {pool.stats.totalScenes + (pool.allItems.length) > 0 && (
        <Box sx={{ p: { xs: 0.75, sm: 1 }, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {pool.allItems.length} uplanlagte scener
          </Typography>
          <LinearProgress
            variant="determinate"
            value={0}  // 0% when showing full pool; parent can pass a "scheduled %" prop
            sx={{ height: 4, borderRadius: 2, mt: 0.25, bgcolor: alpha('#7C3AED', 0.15),
                  '& .MuiLinearProgress-bar': { bgcolor: '#7C3AED' } }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ScenePoolPanel;
