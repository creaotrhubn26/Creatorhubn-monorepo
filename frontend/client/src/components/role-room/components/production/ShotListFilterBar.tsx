/**
 * ShotListFilterBar.tsx — Module B
 * ─────────────────────────────────────────────────────────────────────────────
 * Filter Bar:
 *   [My Shot Lists]  [Unassigned]  [Status ▾]  [Scene ▾]  [Sort ▾]  [🔍]  [⊞|☰]
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  PersonOff as UnassignedIcon,
  Person as MineIcon,
} from '@mui/icons-material';

import type {
  ShotListFilters,
  ShotListSortField,
  StatusFilter,
  ViewMode,
  SceneOption,
} from './shotListFilters';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShotListFilterBarProps {
  filters: ShotListFilters;
  sceneOptions: SceneOption[];
  totalCount: number;
  filteredCount: number;
  onChange: (patch: Partial<ShotListFilters>) => void;
}

// ─── ShotListFilterBar ─────────────────────────────────────────────────────────

export function ShotListFilterBar({
  filters,
  sceneOptions,
  totalCount,
  filteredCount,
  onChange,
}: ShotListFilterBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl/Cmd+F focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectSx = {
    bgcolor: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.78rem',
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
    height: 34,
  };

  const menuItemSx = { fontSize: '0.78rem' };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 2, sm: 3 },
        py: 1.25,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
        minHeight: 52,
      }}
    >
      {/* ── Quick toggle chips ── */}
      <Tooltip title="Show only my shot lists">
        <Chip
          icon={<MineIcon sx={{ fontSize: 14 }} />}
          label="Mine"
          size="small"
          clickable
          variant={filters.onlyMine ? 'filled' : 'outlined'}
          onClick={() => onChange({ onlyMine: !filters.onlyMine })}
          sx={{
            height: 28,
            fontSize: '0.72rem',
            ...(filters.onlyMine
              ? { bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6344' }
              : { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }),
          }}
        />
      </Tooltip>

      <Tooltip title="Show only lists with unassigned shots">
        <Chip
          icon={<UnassignedIcon sx={{ fontSize: 14 }} />}
          label="Unassigned"
          size="small"
          clickable
          variant={filters.onlyUnassigned ? 'filled' : 'outlined'}
          onClick={() => onChange({ onlyUnassigned: !filters.onlyUnassigned })}
          sx={{
            height: 28,
            fontSize: '0.72rem',
            ...(filters.onlyUnassigned
              ? { bgcolor: '#f9731622', color: '#f97316', border: '1px solid #f9731644' }
              : { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }),
          }}
        />
      </Tooltip>

      {/* ── Status dropdown ── */}
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as StatusFilter })}
          displayEmpty
          sx={selectSx}
          MenuProps={{
            PaperProps: { sx: { bgcolor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' } },
          }}
        >
          <MenuItem value="all" sx={menuItemSx}>All status</MenuItem>
          <MenuItem value="not_started" sx={menuItemSx}>Not started</MenuItem>
          <MenuItem value="in_progress" sx={menuItemSx}>In progress</MenuItem>
          <MenuItem value="completed" sx={menuItemSx}>Completed</MenuItem>
        </Select>
      </FormControl>

      {/* ── Scene dropdown ── */}
      {sceneOptions.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 140, maxWidth: 200 }}>
          <Select
            value={filters.sceneId}
            onChange={(e) => onChange({ sceneId: e.target.value })}
            displayEmpty
            sx={selectSx}
            MenuProps={{
              PaperProps: { sx: { bgcolor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' } },
            }}
          >
            <MenuItem value="" sx={menuItemSx}>All scenes</MenuItem>
            {sceneOptions.map((opt) => (
              <MenuItem key={opt.sceneId} value={opt.sceneId} sx={{ ...menuItemSx, maxWidth: 220 }}>
                <Box component="span" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {opt.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* ── Sort dropdown ── */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <Select
          value={`${filters.sortField}:${filters.sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split(':');
            onChange({ sortField: field as ShotListSortField, sortDir: dir as 'asc' | 'desc' });
          }}
          sx={selectSx}
          MenuProps={{
            PaperProps: { sx: { bgcolor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' } },
          }}
        >
          <MenuItem value="updated:desc" sx={menuItemSx}>Latest first</MenuItem>
          <MenuItem value="updated:asc"  sx={menuItemSx}>Oldest first</MenuItem>
          <MenuItem value="scene:asc"    sx={menuItemSx}>Scene A→Z</MenuItem>
          <MenuItem value="shots:desc"   sx={menuItemSx}>Most shots</MenuItem>
          <MenuItem value="progress:asc" sx={menuItemSx}>Least done</MenuItem>
          <MenuItem value="duration:desc"sx={menuItemSx}>Longest first</MenuItem>
        </Select>
      </FormControl>

      {/* ── Spacer ── */}
      <Box sx={{ flex: 1 }} />

      {/* ── Result count  */}
      {filteredCount < totalCount && (
        <Box sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
          {filteredCount} / {totalCount}
        </Box>
      )}

      {/* ── Search ── */}
      <TextField
        inputRef={searchRef}
        size="small"
        placeholder={isMobile ? 'Search…' : 'Search scenes… (⌘F)'}
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }} />
            </InputAdornment>
          ),
          sx: {
            height: 34,
            fontSize: '0.78rem',
            bgcolor: 'rgba(255,255,255,0.05)',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#e91e63' },
          },
        }}
        sx={{ width: isMobile ? '100%' : 200 }}
      />

      {/* ── View toggle ── */}
      <ToggleButtonGroup
        value={filters.viewMode}
        exclusive
        onChange={(_, val) => val && onChange({ viewMode: val as ViewMode })}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.4)',
            height: 34,
            width: 34,
            p: 0,
            '&.Mui-selected': { bgcolor: 'rgba(233,30,99,0.15)', color: '#e91e63', borderColor: '#e91e6344' },
          },
        }}
      >
        <ToggleButton value="grid" aria-label="Grid view">
          <GridViewIcon sx={{ fontSize: 16 }} />
        </ToggleButton>
        <ToggleButton value="list" aria-label="List view">
          <ListViewIcon sx={{ fontSize: 16 }} />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
