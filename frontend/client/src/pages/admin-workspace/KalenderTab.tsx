/**
 * KalenderTab — «Kalender»-flaten i AdminWorkspace.
 *
 * Var en EmptyState med TODO-en «aggregér role_room_meetings +
 * funding_apps.deadline + …» — altså nøyaktig det aggregator-endepunktene
 * allerede gjør. Denne flaten er derfor bygget på eksisterende backend:
 *
 *   GET /api/admin-room/workspace/today-agenda?product=
 *   GET /api/admin-room/workspace/upcoming-deadlines?days=&product=
 *
 * Visning: dagens møter øverst, deretter en tidslinje gruppert per dag
 * over et valgbart vindu (7/14/30/90 dager). Alt som har `link_path` inn
 * i workspacet navigerer internt via `onNavigate` — ingen full sidelast.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import {
  DEADLINE_SOURCE_LABEL,
  type DeadlineItem,
  type WorkspaceProductScope,
} from '../../services/adminRoomApi';
import { queryError, useTodayAgenda, useUpcomingDeadlines } from './useWorkspaceData';
import { BRAND } from './brand';
import { parseWorkspaceLink, type WorkspaceLinkTarget } from './workspaceItems';

const WINDOW_OPTIONS = [7, 14, 30, 90] as const;
type WindowDays = (typeof WINDOW_OPTIONS)[number];

interface KalenderTabProps {
  /** Aktivt produkt fra topp-toggelen. Sendes videre til aggregatoren. */
  product: WorkspaceProductScope;
  /** Intern navigasjon for link_path som peker inn i workspacet. */
  onNavigate: (target: WorkspaceLinkTarget) => void;
}

const SOURCE_ICON = {
  funding_app: <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />,
  case: <GavelOutlinedIcon sx={{ fontSize: 16 }} />,
  meeting: <VideocamOutlinedIcon sx={{ fontSize: 16 }} />,
} as const;

const SOURCE_COLOR = {
  funding_app: '#fbbf24',
  case: BRAND.accent,
  meeting: '#22d3ee',
} as const;

function dayKey(iso: string): string {
  // due_date er enten 'YYYY-MM-DD' eller full ISO-datetime.
  return iso.slice(0, 10);
}

function formatDayHeading(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;

  const today = new Date();
  const todayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(today);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const tomorrowKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(tomorrow);

  const label = new Intl.DateTimeFormat('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (key === todayKey) return `I dag — ${label}`;
  if (key === tomorrowKey) return `I morgen — ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(iso: string): string | null {
  if (iso.length <= 10) return null; // ren dato, ingen klokkeslett
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Oslo',
  }).format(d);
}

export function KalenderTab({ product, onNavigate }: KalenderTabProps) {
  const [windowDays, setWindowDays] = useState<WindowDays>(14);

  // Begge disse deles med høyre kolonne via React Query-nøklene, så
  // samme vindu gir ett kall — ikke ett per komponent som før.
  const agendaQuery = useTodayAgenda(product);
  const deadlinesQuery = useUpcomingDeadlines(windowDays, product);

  const agenda = agendaQuery.data ?? [];
  const deadlines = deadlinesQuery.data?.items ?? [];
  const loading = agendaQuery.isPending || deadlinesQuery.isPending;
  const error =
    queryError(agendaQuery.error, 'Kunne ikke laste dagens agenda') ??
    queryError(deadlinesQuery.error, 'Kunne ikke laste kalenderen');

  const grouped = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const item of deadlines) {
      const key = dayKey(item.due_date);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [deadlines]);

  const handleOpen = useCallback(
    (item: DeadlineItem) => {
      const target = parseWorkspaceLink(item.link_path);
      if (target) {
        onNavigate(target);
        return;
      }
      // Eksterne stier (utenfor workspacet) — vanlig navigasjon.
      if (item.link_path && typeof window !== 'undefined') {
        window.location.assign(item.link_path);
      }
    },
    [onNavigate],
  );

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress sx={{ color: BRAND.accent }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert
          severity="error"
          sx={{
            bgcolor: 'rgba(220, 38, 38, 0.16)',
            color: '#fecaca',
            border: '1px solid rgba(220, 38, 38, 0.4)',
          }}
        >
          {error}
        </Alert>
      ) : null}

      {/* Dagens møter */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <ScheduleOutlinedIcon sx={{ color: BRAND.accent, fontSize: 20 }} />
          <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem' }}>
            Dagens møter
          </Typography>
          {agenda.length > 0 ? (
            <Chip
              label={agenda.length}
              size="small"
              sx={{ height: 18, fontSize: '0.68rem', bgcolor: BRAND.accentStrong, color: '#fff' }}
            />
          ) : null}
        </Stack>

        {agenda.length === 0 ? (
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.84rem' }}>
            {product === 'leadgrid'
              ? 'Møter hører til Role Room-prosjekter — ingen på Leadgrid-fanen.'
              : 'Ingen møter i dag.'}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {agenda.map((m) => {
              const time = formatTime(m.starts_at);
              return (
                <Stack
                  key={m.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: BRAND.panelBg,
                    border: `1px solid ${BRAND.border}`,
                  }}
                >
                  <Typography
                    sx={{
                      color: BRAND.accent,
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      minWidth: 48,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {time ?? '—'}
                  </Typography>
                  <Typography sx={{ color: BRAND.text, fontSize: '0.88rem', flex: 1, minWidth: 0 }}>
                    {m.title}
                  </Typography>
                  {m.meet_link ? (
                    <Chip
                      icon={<VideocamOutlinedIcon sx={{ fontSize: 14 }} />}
                      label="Bli med"
                      size="small"
                      component="a"
                      href={m.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        bgcolor: 'rgba(34, 211, 238, 0.16)',
                        color: '#67e8f9',
                      }}
                    />
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Tidslinje */}
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <EventOutlinedIcon sx={{ color: BRAND.accent, fontSize: 20 }} />
            <Typography sx={{ color: BRAND.text, fontWeight: 700, fontSize: '0.96rem' }}>
              Frister og møter framover
            </Typography>
          </Stack>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={windowDays}
            onChange={(_, v) => {
              if (v) setWindowDays(v as WindowDays);
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: BRAND.textMuted,
                borderColor: BRAND.border,
                fontSize: '0.72rem',
                py: 0.25,
                px: 1,
                '&.Mui-selected': {
                  bgcolor: BRAND.selectedBg,
                  color: BRAND.text,
                },
              },
            }}
          >
            {WINDOW_OPTIONS.map((d) => (
              <ToggleButton key={d} value={d}>
                {d}d
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {grouped.length === 0 ? (
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.84rem' }}>
            Ingen frister eller møter de neste {windowDays} dagene.
          </Typography>
        ) : (
          <Stack spacing={2.5}>
            {grouped.map(([key, items]) => (
              <Box key={key}>
                <Typography
                  sx={{
                    color: BRAND.textMuted,
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    mb: 1,
                  }}
                >
                  {formatDayHeading(key)}
                </Typography>
                <Stack spacing={0.75}>
                  {items.map((item) => {
                    const clickable = Boolean(item.link_path);
                    const time = formatTime(item.due_date);
                    return (
                      <Stack
                        key={item.id}
                        // Klikkbare rader må være ekte knapper, ellers er
                        // de usynlige for tastatur og skjermleser.
                        component={clickable ? 'button' : 'div'}
                        type={clickable ? 'button' : undefined}
                        direction="row"
                        alignItems="center"
                        spacing={1.25}
                        onClick={clickable ? () => handleOpen(item) : undefined}
                        sx={{
                          width: '100%',
                          font: 'inherit',
                          textAlign: 'left',
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: BRAND.panelBg,
                          border: `1px solid ${BRAND.border}`,
                          borderLeft: `3px solid ${SOURCE_COLOR[item.source]}`,
                          cursor: clickable ? 'pointer' : 'default',
                          '&:hover': clickable ? { borderColor: BRAND.borderHover } : undefined,
                          '&:focus-visible': {
                            outline: `2px solid ${BRAND.accent}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Box sx={{ color: SOURCE_COLOR[item.source], display: 'flex' }}>
                          {SOURCE_ICON[item.source]}
                        </Box>
                        <Typography
                          sx={{
                            color: BRAND.text,
                            fontSize: '0.86rem',
                            flex: 1,
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.title}
                        </Typography>
                        {time ? (
                          <Typography
                            sx={{
                              color: BRAND.textDim,
                              fontSize: '0.74rem',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {time}
                          </Typography>
                        ) : null}
                        <Chip
                          label={DEADLINE_SOURCE_LABEL[item.source]}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.64rem',
                            bgcolor: `${SOURCE_COLOR[item.source]}22`,
                            color: SOURCE_COLOR[item.source],
                          }}
                        />
                        {clickable ? (
                          <ChevronRightIcon sx={{ color: BRAND.textDim, fontSize: 16 }} />
                        ) : null}
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

export default KalenderTab;
