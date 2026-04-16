// @ts-nocheck
/**
 * RoleRoomMobileShootingDayView — on-set shooting day surface for
 * mobile + iPad. The hero use case for the production-team role:
 * a DP, 1st AD or script supervisor pulls up the phone/iPad to check
 * call time, wrap, current scenes, weather and call-sheet highlights.
 *
 * Covers backlog items (section 176-200 Live Set and general planner):
 *  - 076: card-based feed
 *  - 085: mobile-friendly timeline-cards (no horizontal timeline)
 *  - 092: deadlines as chips
 *  - 144-inspired short status words
 *
 * Writes are limited to status transitions. Rich editing happens on desktop.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  WbSunny as SunnyIcon,
  Cloud as CloudIcon,
  Grain as RainIcon,
  AcUnit as SnowIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';

import { useShootingDays } from '../../hooks/useShootingDays';
import IPadMasterDetailLayout from '../ipad/IPadMasterDetailLayout';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';
import type { ShootingDay } from '../../services/productionWorkflowService';

interface RoleRoomMobileShootingDayViewProps {
  projectId: string | null;
  mode: RoleRoomViewportMode;
}

const STATUS_LABEL: Record<ShootingDay['status'], string> = {
  'planned': 'Planlagt',
  'in-progress': 'Pågår',
  'wrapped': 'Ferdig',
  'postponed': 'Utsatt',
  'cancelled': 'Avlyst',
};

const STATUS_COLOR: Record<ShootingDay['status'], { color: string; bg: string }> = {
  'planned': { color: '#334155', bg: 'rgba(100,116,139,0.14)' },
  'in-progress': { color: '#6d28d9', bg: 'rgba(124,58,237,0.16)' },
  'wrapped': { color: '#047857', bg: 'rgba(16,185,129,0.16)' },
  'postponed': { color: '#b45309', bg: 'rgba(245,158,11,0.18)' },
  'cancelled': { color: '#b91c1c', bg: 'rgba(239,68,68,0.16)' },
};

const WEATHER_ICON: Record<string, React.ReactNode> = {
  sunny: <SunnyIcon fontSize="small" />,
  cloudy: <CloudIcon fontSize="small" />,
  rain: <RainIcon fontSize="small" />,
  snow: <SnowIcon fontSize="small" />,
  fog: <CloudIcon fontSize="small" />,
  wind: <CloudIcon fontSize="small" />,
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: '2-digit', month: 'short' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export const RoleRoomMobileShootingDayView: React.FC<RoleRoomMobileShootingDayViewProps> = ({
  projectId,
  mode,
}) => {
  const { items, loading, error, saveError, updateStatus } = useShootingDays(projectId ?? undefined);
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [items],
  );

  const today = useMemo(() => sorted.find((d) => isToday(d.date)) ?? null, [sorted]);
  const upcoming = useMemo(
    () => sorted.filter((d) => new Date(d.date).getTime() > Date.now() && !isToday(d.date)),
    [sorted],
  );
  const past = useMemo(
    () => sorted.filter((d) => new Date(d.date).getTime() < Date.now() && !isToday(d.date)),
    [sorted],
  );

  const openDay = useMemo(() => sorted.find((d) => d.id === openDayId) ?? null, [sorted, openDayId]);

  const handleStatus = async (day: ShootingDay, status: ShootingDay['status']) => {
    setPendingStatus(day.id);
    try {
      await updateStatus(day.id, status);
    } finally {
      setPendingStatus(null);
    }
  };

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å åpne skytedager.
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={80} />
        <Skeleton variant="rounded" height={80} />
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const isTabletMode = mode === 'tabletPortrait' || mode === 'tabletLandscape';

  const master = (
    <Stack spacing={3}>
      {today ? (
        <Section title="I dag">
          <ShootingDayCard
            day={today}
            emphasized
            selected={openDayId === today.id}
            onOpen={() => setOpenDayId(today.id)}
          />
        </Section>
      ) : null}

      {upcoming.length > 0 ? (
        <Section title="Kommende">
          <Stack spacing={1}>
            {upcoming.map((day) => (
              <ShootingDayCard
                key={day.id}
                day={day}
                selected={openDayId === day.id}
                onOpen={() => setOpenDayId(day.id)}
              />
            ))}
          </Stack>
        </Section>
      ) : null}

      {past.length > 0 ? (
        <Section title="Ferdige">
          <Stack spacing={1}>
            {past.slice(-5).reverse().map((day) => (
              <ShootingDayCard
                key={day.id}
                day={day}
                selected={openDayId === day.id}
                onOpen={() => setOpenDayId(day.id)}
              />
            ))}
          </Stack>
        </Section>
      ) : null}

      {items.length === 0 ? (
        <Alert severity="info" variant="outlined">
          Ingen skytedager planlagt for dette prosjektet ennå.
        </Alert>
      ) : null}
    </Stack>
  );

  const detail = openDay ? (
    <ShootingDayDetail
      day={openDay}
      onStatusChange={(status) => handleStatus(openDay, status)}
      pending={pendingStatus === openDay.id}
      saveError={saveError}
    />
  ) : null;

  if (isTabletMode) {
    return (
      <IPadMasterDetailLayout
        mode={mode}
        enabled
        hasSelection={openDayId !== null}
        onCloseDetail={() => setOpenDayId(null)}
        detailTitle={openDay ? `Dag ${openDay.dayNumber}` : undefined}
        master={master}
        detail={detail}
      />
    );
  }

  return (
    <>
      {master}
      {openDayId && openDay ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'background.paper',
            zIndex: 1300,
            overflowY: 'auto',
            pt: 'calc(var(--rr-safe-top, 0px) + 12px)',
            px: 2,
            pb: 'calc(var(--rr-safe-bottom, 0px) + 12px)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>
              Dag {openDay.dayNumber}
            </Typography>
            <Button onClick={() => setOpenDayId(null)}>Lukk</Button>
          </Stack>
          {detail}
        </Box>
      ) : null}
    </>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box>
    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

interface ShootingDayCardProps {
  day: ShootingDay;
  emphasized?: boolean;
  selected?: boolean;
  onOpen: () => void;
}

const ShootingDayCard: React.FC<ShootingDayCardProps> = ({ day, emphasized, selected, onOpen }) => {
  const statusStyle = STATUS_COLOR[day.status];
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      sx={{
        p: 1.5,
        borderRadius: 'var(--rr-card-radius, 12px)',
        border: '1px solid',
        borderColor: selected ? '#6366f1' : 'divider',
        bgcolor: emphasized ? 'rgba(99,102,241,0.06)' : 'background.paper',
        cursor: 'pointer',
        '&:focus-visible': {
          outline: '2px solid #6366f1',
          outlineOffset: 2,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Dag {day.dayNumber}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(day.date)}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={STATUS_LABEL[day.status]}
          sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 700 }}
        />
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        <Chip
          size="small"
          icon={<TimeIcon fontSize="small" />}
          label={`Kall ${day.callTime}${day.wrapTime ? ` → ${day.wrapTime}` : ''}`}
          variant="outlined"
        />
        {day.location ? (
          <Chip
            size="small"
            icon={<LocationIcon fontSize="small" />}
            label={day.location}
            variant="outlined"
          />
        ) : null}
        {day.weather ? (
          <Chip
            size="small"
            icon={WEATHER_ICON[day.weather.condition] ?? <SunnyIcon fontSize="small" />}
            label={`${day.weather.temperature}°`}
            variant="outlined"
          />
        ) : null}
        {day.scenes?.length ? (
          <Chip
            size="small"
            label={`${day.scenes.length} scener`}
            variant="outlined"
          />
        ) : null}
      </Stack>
    </Box>
  );
};

interface ShootingDayDetailProps {
  day: ShootingDay;
  onStatusChange: (status: ShootingDay['status']) => void;
  pending?: boolean;
  saveError?: string | null;
}

const ShootingDayDetail: React.FC<ShootingDayDetailProps> = ({
  day,
  onStatusChange,
  pending,
  saveError,
}) => {
  const crewEntries = Object.entries(day.crewCallTimes ?? {});
  const castEntries = Object.entries(day.castCallTimes ?? {});
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>
          Dag {day.dayNumber} — {formatDate(day.date)}
        </Typography>
        {day.location ? (
          <Typography variant="body2" color="text.secondary">
            {day.location}
            {day.locationAddress ? ` • ${day.locationAddress}` : ''}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip size="small" icon={<TimeIcon fontSize="small" />} label={`Kall ${day.callTime}`} />
        {day.wrapTime ? <Chip size="small" label={`Wrap ${day.wrapTime}`} /> : null}
        {day.weather ? (
          <Chip
            size="small"
            icon={WEATHER_ICON[day.weather.condition] ?? <SunnyIcon fontSize="small" />}
            label={`${day.weather.condition} • ${day.weather.temperature}°`}
          />
        ) : null}
      </Stack>

      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Status
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={day.status}
          onChange={(_, value) => value && onStatusChange(value as ShootingDay['status'])}
          fullWidth
          size="small"
          disabled={pending}
        >
          {(['planned', 'in-progress', 'wrapped'] as ShootingDay['status'][]).map((status) => (
            <ToggleButton
              key={status}
              value={status}
              sx={{
                minHeight: 'var(--rr-touch-target-min, 44px)',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {STATUS_LABEL[status]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {saveError ? <Alert severity="error" sx={{ mt: 1 }}>{saveError}</Alert> : null}
      </Box>

      {day.scenes?.length ? (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Scener ({day.scenes.length})
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {day.scenes.map((scene) => (
              <Chip key={scene} size="small" label={scene} variant="outlined" />
            ))}
          </Stack>
        </Box>
      ) : null}

      {crewEntries.length > 0 ? (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Crew call times
          </Typography>
          <Stack spacing={0.25}>
            {crewEntries.map(([role, time]) => (
              <Typography key={role} variant="body2">
                <strong>{role}</strong> — {String(time)}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {castEntries.length > 0 ? (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Cast call times
          </Typography>
          <Stack spacing={0.25}>
            {castEntries.map(([role, time]) => (
              <Typography key={role} variant="body2">
                <strong>{role}</strong> — {String(time)}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {day.notes ? (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Notater
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {day.notes}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
};

export default RoleRoomMobileShootingDayView;
