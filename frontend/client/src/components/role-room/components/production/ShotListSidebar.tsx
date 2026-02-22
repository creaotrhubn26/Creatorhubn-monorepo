/**
 * ShotListSidebar.tsx — Module D
 * ─────────────────────────────────────────────────────────────────────────────
 * Right Sidebar: Cast & Crew
 *   • Searchable list of Person entries
 *   • "Roles with shots" grouping
 *   • Quick filter chips (Cast / Crew / dept)
 *   • Each person row is draggable (dnd-kit) — drop on any ShotListCard
 *     to assign that person to the shot list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Avatar,
  Chip,
  Stack,
  Divider,
  Tooltip,
  CircularProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useDraggable } from '@dnd-kit/core';
import type { Person, CrewRole } from '../../models/casting';
import type { TopAssignee } from '../../models/derivedState';

// ─── Draggable person row ─────────────────────────────────────────────────────

function DraggablePersonRow({ person, shotCount }: { person: Person; shotCount: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `person-${person.id}`,
    data: { type: 'person', personId: person.id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 1,
        cursor: isDragging ? 'grabbing' : 'default',
        bgcolor: isDragging ? 'rgba(233,30,99,0.12)' : 'transparent',
        opacity: isDragging ? 0.8 : 1,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        transition: 'background-color 0.1s',
      }}
    >
      {/* Drag handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          color: 'rgba(255,255,255,0.25)',
          cursor: 'grab',
          display: 'flex',
          '&:hover': { color: 'rgba(255,255,255,0.6)' },
          '&:active': { cursor: 'grabbing' },
          flexShrink: 0,
        }}
      >
        <DragIcon sx={{ fontSize: 14 }} />
      </Box>

      {/* Avatar */}
      <Avatar
        sx={{
          width: 28,
          height: 28,
          fontSize: '0.7rem',
          bgcolor: person.personType === 'cast' ? '#8b5cf6' : '#3b82f6',
          flexShrink: 0,
        }}
      >
        {person.name.charAt(0).toUpperCase()}
      </Avatar>

      {/* Name + role */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          noWrap
          sx={{ display: 'block', fontWeight: 600, fontSize: '0.75rem', color: 'rgba(255,255,255,0.87)' }}
        >
          {person.name}
        </Typography>
        {(person.crewRole || person.characterName) && (
          <Typography
            variant="caption"
            noWrap
            sx={{ display: 'block', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}
          >
            {person.crewRole ?? person.characterName}
          </Typography>
        )}
      </Box>

      {/* Shot count badge */}
      {shotCount > 0 && (
        <Tooltip title={`${shotCount} shots assigned`}>
          <Box
            sx={{
              minWidth: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: '#e91e6333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#e91e63', fontWeight: 700 }}>
              {shotCount}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShotListSidebarProps {
  crew: Person[];
  loading?: boolean;
  /** Aggregated top-assignees across all shot lists (for shot counts) */
  topAssignees?: TopAssignee[];
}

// ─── ShotListSidebar ──────────────────────────────────────────────────────────

export function ShotListSidebar({ crew, loading = false, topAssignees = [] }: ShotListSidebarProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cast' | 'crew'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [rolesExpanded, setRolesExpanded] = useState(true);

  // shotCount per person
  const shotCountMap = useMemo(
    () => new Map(topAssignees.map((a) => [a.personId, a.shotCount])),
    [topAssignees],
  );

  // distinct crew roles for filter chips
  const crewRoles = useMemo<CrewRole[]>(() => {
    const seen = new Set<CrewRole>();
    for (const p of crew) if (p.crewRole) seen.add(p.crewRole);
    return Array.from(seen).sort();
  }, [crew]);

  // filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return crew.filter((p) => {
      if (typeFilter === 'cast' && p.personType === 'crew') return false;
      if (typeFilter === 'crew' && p.personType === 'cast') return false;
      if (roleFilter && p.crewRole !== roleFilter) return false;
      if (q) {
        const name = p.name.toLowerCase();
        const role = (p.crewRole ?? p.characterName ?? '').toLowerCase();
        if (!name.includes(q) && !role.includes(q)) return false;
      }
      return true;
    });
  }, [crew, search, typeFilter, roleFilter]);

  // Group by type
  const castList  = useMemo(() => filtered.filter((p) => p.personType === 'cast' || p.personType === 'both'), [filtered]);
  const crewList  = useMemo(() => filtered.filter((p) => p.personType === 'crew' || p.personType === 'both'), [filtered]);
  // "roles with shots" — people who have at least one shot assigned
  const withShots = useMemo(() => filtered.filter((p) => (shotCountMap.get(p.id) ?? 0) > 0), [filtered, shotCountMap]);

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Cast & Crew
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
          Drag to assign
        </Typography>
      </Box>

      {/* ── Search ── */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
              </InputAdornment>
            ),
            sx: {
              height: 30,
              fontSize: '0.75rem',
              bgcolor: 'rgba(255,255,255,0.04)',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
            },
          }}
        />
      </Box>

      {/* ── Type filter chips ── */}
      <Stack direction="row" spacing={0.5} sx={{ px: 1.5, pb: 1 }}>
        {(['all', 'cast', 'crew'] as const).map((t) => (
          <Chip
            key={t}
            label={t.charAt(0).toUpperCase() + t.slice(1)}
            size="small"
            clickable
            onClick={() => setTypeFilter(t)}
            sx={{
              height: 22,
              fontSize: '0.65rem',
              ...(typeFilter === t
                ? { bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6344' }
                : { bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }),
            }}
          />
        ))}
      </Stack>

      {/* ── Role filter chips ── */}
      {crewRoles.length > 0 && (
        <Box sx={{ px: 1.5, pb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', maxHeight: 60, overflow: 'hidden' }}>
          {roleFilter && (
            <Chip
              label="✕ Clear"
              size="small"
              clickable
              onClick={() => setRoleFilter('')}
              sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(233,30,99,0.12)', color: '#e91e63' }}
            />
          )}
          {crewRoles.slice(0, 6).map((r) => (
            <Chip
              key={r}
              label={r.replace(/_/g, ' ')}
              size="small"
              clickable
              onClick={() => setRoleFilter(r === roleFilter ? '' : r)}
              sx={{
                height: 20,
                fontSize: '0.62rem',
                ...(roleFilter === r
                  ? { bgcolor: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644' }
                  : { bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }),
              }}
            />
          ))}
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── Person list ── */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={20} sx={{ color: 'rgba(255,255,255,0.3)' }} />
          </Box>
        )}

        {/* "Roles with shots" section */}
        {withShots.length > 0 && (
          <>
            <Box
              sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.75, cursor: 'pointer' }}
              onClick={() => setRolesExpanded((v) => !v)}
            >
              <Typography variant="caption" sx={{ flex: 1, fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                On Shot ({withShots.length})
              </Typography>
              <IconButton size="small" sx={{ p: 0 }}>
                {rolesExpanded ? <CollapseIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} /> : <ExpandIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />}
              </IconButton>
            </Box>
            <Collapse in={rolesExpanded}>
              {withShots.map((p) => (
                <DraggablePersonRow key={p.id} person={p} shotCount={shotCountMap.get(p.id) ?? 0} />
              ))}
            </Collapse>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 0.5 }} />
          </>
        )}

        {/* Cast section */}
        {castList.length > 0 && (typeFilter === 'all' || typeFilter === 'cast') && (
          <>
            <Typography variant="caption" sx={{ display: 'block', px: 1.5, pt: 0.75, pb: 0.25, fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              Cast
            </Typography>
            {castList.map((p) => (
              <DraggablePersonRow key={p.id} person={p} shotCount={shotCountMap.get(p.id) ?? 0} />
            ))}
          </>
        )}

        {/* Crew section */}
        {crewList.length > 0 && (typeFilter === 'all' || typeFilter === 'crew') && (
          <>
            <Typography variant="caption" sx={{ display: 'block', px: 1.5, pt: 0.75, pb: 0.25, fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              Crew
            </Typography>
            {crewList.map((p) => (
              <DraggablePersonRow key={p.id} person={p} shotCount={shotCountMap.get(p.id) ?? 0} />
            ))}
          </>
        )}

        {!loading && filtered.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.25)' }}>
              No people found
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
