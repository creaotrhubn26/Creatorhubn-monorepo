// @ts-nocheck
/**
 * RoleRoomMobileCrewView — compact crew list for mobile + iPad.
 *
 * Read-only surface for on-set use: who is on crew, grouped by department,
 * with quick contact actions (tap to call/email when available). Roster
 * editing remains on desktop.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

import { useProductionCrew } from '../../hooks/useProductionCrew';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

interface RoleRoomMobileCrewViewProps {
  projectId: string | null;
  mode: RoleRoomViewportMode;
}

function initialsOf(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const RoleRoomMobileCrewView: React.FC<RoleRoomMobileCrewViewProps> = ({
  projectId,
  mode,
}) => {
  const { items, loading, error } = useProductionCrew(projectId ?? undefined);
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((c: any) =>
          (c.name || '').toLowerCase().includes(query) ||
          (c.role || '').toLowerCase().includes(query) ||
          (c.department || '').toLowerCase().includes(query),
        )
      : items;
    const byDept = new Map<string, any[]>();
    for (const member of filtered) {
      const dept = (member as any).department || 'Uten avdeling';
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept)!.push(member);
    }
    return Array.from(byDept.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, search]);

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å se crew.
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" height={72} />
        <Skeleton variant="rounded" height={72} />
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const colsOnTablet = mode === 'tabletLandscape' ? 2 : 1;

  return (
    <Stack spacing={2}>
      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Søk i crew"
        size="small"
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {items.length === 0 ? (
        <Alert severity="info" variant="outlined">Ingen crew registrert ennå.</Alert>
      ) : null}

      {grouped.map(([dept, members]) => (
        <Box key={dept}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
            {dept} ({members.length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${colsOnTablet}, minmax(0, 1fr))`,
              gap: 1,
            }}
          >
            {members.map((member: any) => (
              <CrewRow key={member.id} member={member} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

interface CrewRowProps {
  member: any;
}

const CrewRow: React.FC<CrewRowProps> = ({ member }) => {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 'var(--rr-card-radius, 12px)',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ width: 40, height: 40, bgcolor: '#6366f1', fontSize: 14, fontWeight: 700 }}>
          {initialsOf(member.name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {member.name || 'Ukjent'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {member.role || 'Uten rolle'}
          </Typography>
        </Box>
        {member.phone ? (
          <IconButton
            component="a"
            href={`tel:${member.phone}`}
            aria-label={`Ring ${member.name}`}
            size="small"
            sx={{ width: 'var(--rr-touch-target-min, 44px)', height: 'var(--rr-touch-target-min, 44px)' }}
          >
            <PhoneIcon fontSize="small" />
          </IconButton>
        ) : null}
        {member.email ? (
          <IconButton
            component="a"
            href={`mailto:${member.email}`}
            aria-label={`E-post til ${member.name}`}
            size="small"
            sx={{ width: 'var(--rr-touch-target-min, 44px)', height: 'var(--rr-touch-target-min, 44px)' }}
          >
            <EmailIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Stack>
      {member.availability ? (
        <Chip
          size="small"
          label={`Tilgjengelig: ${member.availability}`}
          sx={{ mt: 0.75 }}
          variant="outlined"
        />
      ) : null}
    </Box>
  );
};

export default RoleRoomMobileCrewView;
