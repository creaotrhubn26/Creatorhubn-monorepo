import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';

import {
  WORKSPACE_CALENDAR_EVENT_TYPE_LABELS,
  WORKSPACE_CALENDAR_SOURCE_LABELS,
  workspaceCalendarApi,
  type WorkspaceCalendarEventType,
  type WorkspaceCalendarInput,
  type WorkspaceCalendarItem,
  type WorkspaceCalendarOptions,
  type WorkspaceCalendarSource,
  type WorkspaceCalendarStatus,
} from '../../services/adminRoomApi';
import { FundingDeadlineRadar } from './FundingDeadlineRadar';

const BRAND = {
  panelBg: 'rgba(26, 10, 46, 0.72)',
  panelSolid: '#1a0a2e',
  surface: 'rgba(11, 5, 24, 0.5)',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
  border: 'rgba(167, 139, 250, 0.2)',
  borderHover: 'rgba(167, 139, 250, 0.42)',
  text: '#f1f5f9',
  textMuted: 'rgba(241, 245, 249, 0.76)',
  textDim: 'rgba(241, 245, 249, 0.52)',
  hoverBg: 'rgba(167, 139, 250, 0.08)',
  selectedBg: 'rgba(167, 139, 250, 0.15)',
};

const SOURCE_COLORS: Record<WorkspaceCalendarSource, string> = {
  calendar_event: '#a78bfa',
  task: '#22c55e',
  case: '#38bdf8',
  project: '#f59e0b',
  funding_app: '#fbbf24',
  funding_opportunity: '#f97316',
  industry_follow_up: '#e879f9',
  leadgrid_follow_up: '#22d3ee',
  partner_follow_up: '#fb7185',
  investor_follow_up: '#c084fc',
};

const ALL_SOURCES = Object.keys(WORKSPACE_CALENDAR_SOURCE_LABELS) as WorkspaceCalendarSource[];
const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

const fieldSx = {
  '& .MuiInputBase-root': { color: BRAND.text },
  '& .MuiInputLabel-root': { color: BRAND.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.borderHover },
  '& .MuiSvgIcon-root': { color: BRAND.textDim },
  '& .MuiFormHelperText-root': { color: BRAND.textDim },
};

type ProductValue = 'role_room' | 'leadgrid' | 'internal';

interface CalendarTabProps {
  parentProduct: 'roleroom' | 'leadgrid';
}

interface CalendarDraft {
  title: string;
  description: string;
  eventType: WorkspaceCalendarEventType;
  status: WorkspaceCalendarStatus;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  productKey: ProductValue;
  location: string;
  meetingUrl: string;
  assignee: string;
  projectId: string;
  caseId: string;
  tags: string;
}

function contextProduct(parentProduct: CalendarTabProps['parentProduct']): 'role_room' | 'leadgrid' {
  return parentProduct === 'roleroom' ? 'role_room' : 'leadgrid';
}

function productLabel(value: WorkspaceCalendarItem['product_key']): string {
  if (value === 'role_room') return 'The Role Room';
  if (value === 'leadgrid') return 'Leadgrid';
  return 'Creatorhub / internt';
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function itemStartDate(item: WorkspaceCalendarItem): Date {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(item.starts_at)) return parseDateKey(item.starts_at);
  return new Date(item.starts_at);
}

function itemEndDate(item: WorkspaceCalendarItem): Date {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(item.ends_at)) return parseDateKey(item.ends_at);
  return new Date(item.ends_at);
}

function itemDateKeys(item: WorkspaceCalendarItem): string[] {
  const start = itemStartDate(item);
  if (!Number.isFinite(start.getTime())) return [];
  start.setHours(12, 0, 0, 0);
  const endRaw = itemEndDate(item);
  const end = Number.isFinite(endRaw.getTime()) ? new Date(endRaw) : new Date(start);
  if (item.all_day && end.getTime() > start.getTime()) end.setMilliseconds(end.getMilliseconds() - 1);
  end.setHours(12, 0, 0, 0);
  if (end < start) end.setTime(start.getTime());

  const keys: string[] = [];
  const cursor = new Date(start);
  for (let index = 0; index < 371 && cursor <= end; index += 1) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(start.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatMonth(value: Date): string {
  const text = value.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDay(value: string): string {
  return parseDateKey(value).toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatEventTime(item: WorkspaceCalendarItem): string {
  if (item.all_day) return 'Hele dagen';
  const start = itemStartDate(item);
  const end = itemEndDate(item);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '';
  return `${start.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
}

function localTime(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function emptyDraft(
  parentProduct: CalendarTabProps['parentProduct'],
  selectedDate = dateKey(new Date()),
): CalendarDraft {
  return {
    title: '',
    description: '',
    eventType: 'meeting',
    status: 'confirmed',
    date: selectedDate,
    startTime: '10:00',
    endTime: '11:00',
    allDay: false,
    productKey: contextProduct(parentProduct),
    location: '',
    meetingUrl: '',
    assignee: '',
    projectId: '',
    caseId: '',
    tags: '',
  };
}

function draftFromItem(item: WorkspaceCalendarItem): CalendarDraft {
  const start = itemStartDate(item);
  const end = itemEndDate(item);
  return {
    title: item.title,
    description: item.description ?? '',
    eventType: item.event_type,
    status: item.status === 'tentative' || item.status === 'cancelled' ? item.status : 'confirmed',
    date: dateKey(start),
    startTime: localTime(start),
    endTime: localTime(end),
    allDay: item.all_day,
    productKey: item.product_key ?? 'internal',
    location: item.location ?? '',
    meetingUrl: item.meeting_url ?? '',
    assignee: item.assignee ?? '',
    projectId: item.project_id ?? '',
    caseId: item.case_id ?? '',
    tags: item.tags.join(', '),
  };
}

function inputFromDraft(draft: CalendarDraft): WorkspaceCalendarInput {
  const startsAt = new Date(`${draft.date}T${draft.allDay ? '00:00' : draft.startTime}`);
  const endsAt = draft.allDay
    ? new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate() + 1)
    : new Date(`${draft.date}T${draft.endTime}`);
  if (!draft.allDay && endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    eventType: draft.eventType,
    status: draft.status,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: draft.allDay,
    productKey: draft.productKey === 'internal' ? null : draft.productKey,
    location: draft.location.trim() || null,
    meetingUrl: draft.meetingUrl.trim() || null,
    assignee: draft.assignee.trim() || null,
    projectId: draft.projectId || null,
    caseId: draft.caseId || null,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

const CONTEXT_COPY = {
  roleroom: {
    heading: 'Kalender — The Role Room',
    description: 'Planlegg markedskontakt, møter, fokusarbeid og frister for The Role Room. Castingproduksjonenes kalender forblir i Role Room.',
  },
  leadgrid: {
    heading: 'Kalender — Leadgrid',
    description: 'Samlet arbeidskalender for pilotkunder, lead-oppfølging, partnerløp, adminoppgaver og interne frister rundt Leadgrid.',
  },
} as const;

export function CalendarTab({ parentProduct }: CalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [items, setItems] = useState<WorkspaceCalendarItem[]>([]);
  const [options, setOptions] = useState<WorkspaceCalendarOptions>({ projects: [], cases: [] });
  const [selectedItem, setSelectedItem] = useState<WorkspaceCalendarItem | null>(null);
  const [hiddenSources, setHiddenSources] = useState<Set<WorkspaceCalendarSource>>(() => new Set());
  const [productFilter, setProductFilter] = useState<'context' | 'all' | 'internal'>('context');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarDraft>(() => emptyDraft(parentProduct));

  const product = contextProduct(parentProduct);
  const copy = CONTEXT_COPY[parentProduct];
  const days = useMemo(() => monthGrid(currentMonth), [currentMonth]);
  const range = useMemo(() => ({
    from: dateKey(days[0]),
    to: dateKey(days[days.length - 1]),
  }), [days]);
  const enabledSources = useMemo(
    () => ALL_SOURCES.filter((source) => !hiddenSources.has(source)),
    [hiddenSources],
  );

  const refresh = useCallback(async () => {
    if (enabledSources.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await workspaceCalendarApi.list({
        ...range,
        product: productFilter === 'context' ? product : productFilter,
        sources: enabledSources.length === ALL_SOURCES.length ? undefined : enabledSources,
      });
      setItems(data.items);
      setSelectedItem((current) => (
        current ? data.items.find((item) => item.id === current.id) ?? null : null
      ));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente kalenderen');
    } finally {
      setLoading(false);
    }
  }, [enabledSources, product, productFilter, range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    workspaceCalendarApi.options()
      .then(setOptions)
      .catch((err) => setError((err as Error).message || 'Kunne ikke hente kalenderkoblinger'));
  }, []);

  useEffect(() => {
    setDraft(emptyDraft(parentProduct, selectedDate));
  }, [parentProduct, selectedDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, WorkspaceCalendarItem[]>();
    for (const item of items) {
      for (const key of itemDateKeys(item)) {
        const list = map.get(key) ?? [];
        list.push(item);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        return itemStartDate(a).getTime() - itemStartDate(b).getTime();
      });
    }
    return map;
  }, [items]);

  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const stats = useMemo(() => {
    const today = dateKey(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthItems = items.filter((item) => {
      const start = itemStartDate(item);
      return start.getMonth() === currentMonth.getMonth() && start.getFullYear() === currentMonth.getFullYear();
    });
    return {
      month: monthItems.length,
      today: (itemsByDate.get(today) ?? []).length,
      nextWeek: items.filter((item) => {
        const start = itemStartDate(item);
        return start >= new Date() && start <= weekEnd;
      }).length,
      followUps: monthItems.filter((item) => item.event_type === 'follow_up').length,
    };
  }, [currentMonth, items, itemsByDate]);

  const compatibleProjects = useMemo(() => options.projects.filter((item) => (
    draft.productKey === 'internal'
      ? item.product_key === null
      : item.product_key === null || item.product_key === draft.productKey
  )), [draft.productKey, options.projects]);
  const compatibleCases = useMemo(() => options.cases.filter((item) => (
    draft.productKey === 'internal'
      ? item.product_key === null
      : item.product_key === null || item.product_key === draft.productKey
  )), [draft.productKey, options.cases]);

  const openCreate = (day = selectedDate) => {
    setEditingId(null);
    setDraft(emptyDraft(parentProduct, day));
    setDialogOpen(true);
  };

  const openEdit = (item: WorkspaceCalendarItem) => {
    if (!item.editable) return;
    setEditingId(item.entity_id);
    setDraft(draftFromItem(item));
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = editingId
        ? await workspaceCalendarApi.update(editingId, inputFromDraft(draft))
        : await workspaceCalendarApi.create(inputFromDraft(draft));
      setDialogOpen(false);
      setSelectedDate(dateKey(itemStartDate(saved)));
      await refresh();
      setSelectedItem(saved);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre kalenderhendelsen');
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async () => {
    if (!selectedItem?.editable) return;
    if (!window.confirm(`Slette kalenderhendelsen «${selectedItem.title}»?`)) return;
    setSaving(true);
    setError(null);
    try {
      await workspaceCalendarApi.delete(selectedItem.entity_id);
      setSelectedItem(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke slette kalenderhendelsen');
    } finally {
      setSaving(false);
    }
  };

  const navigateMonth = (delta: number) => {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const goToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(dateKey(today));
  };

  const toggleSource = (source: WorkspaceCalendarSource) => {
    setHiddenSources((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const activateItem = (item: WorkspaceCalendarItem) => {
    setSelectedItem(item);
  };

  return (
    <Box data-testid="workspace-calendar" sx={{ color: BRAND.text, minWidth: 0 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{copy.heading}</Typography>
          <Typography sx={{ color: BRAND.textMuted, maxWidth: 860, mt: 0.6 }}>{copy.description}</Typography>
        </Box>
        <Button
          data-testid="workspace-calendar-create"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openCreate()}
          sx={{ bgcolor: BRAND.accentStrong, alignSelf: { xs: 'stretch', md: 'flex-start' } }}
        >
          Ny hendelse
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.2, mb: 2 }}>
        {[
          { label: 'Denne måneden', value: stats.month, icon: <CalendarMonthOutlinedIcon />, color: BRAND.accent },
          { label: 'I dag', value: stats.today, icon: <TodayOutlinedIcon />, color: '#38bdf8' },
          { label: 'Neste 7 dager', value: stats.nextWeek, icon: <EventAvailableOutlinedIcon />, color: '#22c55e' },
          { label: 'Oppfølginger', value: stats.followUps, icon: <PersonOutlineOutlinedIcon />, color: '#f59e0b' },
        ].map((stat) => (
          <Box key={stat.label} sx={{ p: 1.4, borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography sx={{ color: BRAND.textDim, fontSize: 12 }}>{stat.label}</Typography>
                <Typography variant="h5" sx={{ color: stat.color, fontWeight: 800 }}>{stat.value}</Typography>
              </Box>
              <Box sx={{ color: stat.color }}>{stat.icon}</Box>
            </Stack>
          </Box>
        ))}
      </Box>

      <FundingDeadlineRadar parentProduct={parentProduct} onChanged={() => void refresh()} />

      <Stack direction="row" flexWrap="wrap" gap={0.8} alignItems="center" sx={{ mb: 1.5 }}>
        <TextField
          select
          size="small"
          label="Arbeidsområde"
          value={productFilter}
          onChange={(event) => setProductFilter(event.target.value as typeof productFilter)}
          sx={{ ...fieldSx, minWidth: 190 }}
        >
          <MenuItem value="context">{productLabel(product)} + internt</MenuItem>
          <MenuItem value="internal">Kun Creatorhub / internt</MenuItem>
          <MenuItem value="all">Alle områder</MenuItem>
        </TextField>
        {ALL_SOURCES.map((source) => {
          const enabled = !hiddenSources.has(source);
          const color = SOURCE_COLORS[source];
          return (
            <Chip
              key={source}
              label={WORKSPACE_CALENDAR_SOURCE_LABELS[source]}
              onClick={() => toggleSource(source)}
              variant={enabled ? 'filled' : 'outlined'}
              sx={{
                color: enabled ? color : BRAND.textDim,
                bgcolor: enabled ? `${color}18` : 'transparent',
                borderColor: enabled ? `${color}66` : BRAND.border,
              }}
            />
          );
        })}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1.35fr) minmax(340px, 0.65fr)' }, gap: 2 }}>
        <Box sx={{ minWidth: 0, borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.2, borderBottom: `1px solid ${BRAND.border}` }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconButton onClick={() => navigateMonth(-1)} sx={{ color: BRAND.textMuted }} aria-label="Forrige måned"><ChevronLeftIcon /></IconButton>
              <Button onClick={goToday} size="small" sx={{ color: BRAND.textMuted }}>I dag</Button>
              <IconButton onClick={() => navigateMonth(1)} sx={{ color: BRAND.textMuted }} aria-label="Neste måned"><ChevronRightIcon /></IconButton>
            </Stack>
            <Typography sx={{ fontWeight: 800 }}>{formatMonth(currentMonth)}</Typography>
            {loading ? <CircularProgress size={18} /> : <Box sx={{ width: 18 }} />}
          </Stack>

          <Box sx={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Box data-testid="workspace-calendar-grid" sx={{ minWidth: 760 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: `1px solid ${BRAND.border}` }}>
                {WEEKDAYS.map((weekday) => (
                  <Typography key={weekday} sx={{ py: 0.8, textAlign: 'center', color: BRAND.textDim, fontSize: 12, fontWeight: 700 }}>
                    {weekday}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {days.map((day, index) => {
                  const key = dateKey(day);
                  const dayItems = itemsByDate.get(key) ?? [];
                  const current = day.getMonth() === currentMonth.getMonth();
                  const today = key === dateKey(new Date());
                  const selected = key === selectedDate;
                  return (
                    <Box
                      key={key}
                      data-testid={`workspace-calendar-day-${key}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDate(key)}
                      onDoubleClick={() => openCreate(key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedDate(key);
                        }
                      }}
                      sx={{
                        minHeight: 112,
                        p: 0.7,
                        borderRight: (index + 1) % 7 ? `1px solid ${BRAND.border}` : 'none',
                        borderBottom: index < 35 ? `1px solid ${BRAND.border}` : 'none',
                        bgcolor: selected ? BRAND.selectedBg : current ? 'transparent' : 'rgba(0,0,0,0.12)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: selected ? BRAND.selectedBg : BRAND.hoverBg },
                        '&:focus-visible': { outline: `2px solid ${BRAND.accent}`, outlineOffset: -2 },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.45 }}>
                        <Box sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: today ? BRAND.accentStrong : 'transparent',
                          color: today ? '#fff' : current ? BRAND.text : BRAND.textDim,
                          fontWeight: today ? 800 : 600,
                          fontSize: 12,
                        }}>
                          {day.getDate()}
                        </Box>
                      </Box>
                      <Stack gap={0.35}>
                        {dayItems.slice(0, 3).map((item) => (
                          <Tooltip key={item.id} title={`${formatEventTime(item)} · ${item.title}`}>
                            <Box
                              data-testid={`workspace-calendar-item-${item.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                activateItem(item);
                              }}
                              sx={{
                                px: 0.55,
                                py: 0.3,
                                borderRadius: 0.8,
                                bgcolor: `${SOURCE_COLORS[item.source]}20`,
                                borderLeft: `3px solid ${SOURCE_COLORS[item.source]}`,
                                color: BRAND.text,
                                fontSize: 10.5,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {!item.all_day ? `${formatEventTime(item).split('–')[0]} ` : ''}{item.title}
                            </Box>
                          </Tooltip>
                        ))}
                        {dayItems.length > 3 && (
                          <Typography sx={{ color: BRAND.textDim, fontSize: 10, pl: 0.6 }}>
                            +{dayItems.length - 3} til
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>

        <Stack gap={2} sx={{ minWidth: 0 }}>
          <Box data-testid="workspace-calendar-agenda" sx={{ borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1.2, borderBottom: `1px solid ${BRAND.border}` }}>
              <Box>
                <Typography sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{formatDay(selectedDate)}</Typography>
                <Typography sx={{ color: BRAND.textDim, fontSize: 12 }}>{selectedItems.length} hendelser</Typography>
              </Box>
              <IconButton onClick={() => openCreate(selectedDate)} sx={{ color: BRAND.accent }} aria-label="Ny hendelse på valgt dato"><AddIcon /></IconButton>
            </Stack>
            {selectedItems.length === 0 ? (
              <Stack alignItems="center" textAlign="center" sx={{ py: 4, px: 2 }}>
                <ScheduleOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 34 }} />
                <Typography sx={{ color: BRAND.textMuted, mt: 1 }}>Ingen hendelser denne dagen.</Typography>
                <Button size="small" onClick={() => openCreate(selectedDate)} sx={{ color: BRAND.accent, mt: 0.5 }}>Planlegg noe</Button>
              </Stack>
            ) : selectedItems.map((item, index) => (
              <Box
                key={item.id}
                onClick={() => activateItem(item)}
                sx={{
                  px: 1.5,
                  py: 1.15,
                  cursor: 'pointer',
                  bgcolor: selectedItem?.id === item.id ? BRAND.selectedBg : 'transparent',
                  borderTop: index ? `1px solid ${BRAND.border}` : 'none',
                  '&:hover': { bgcolor: BRAND.hoverBg },
                }}
              >
                <Stack direction="row" gap={1}>
                  <Box sx={{ width: 4, borderRadius: 2, bgcolor: SOURCE_COLORS[item.source], flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                    <Typography sx={{ color: BRAND.textMuted, fontSize: 12 }}>{formatEventTime(item)}</Typography>
                    <Typography sx={{ color: SOURCE_COLORS[item.source], fontSize: 11, mt: 0.35 }}>
                      {WORKSPACE_CALENDAR_SOURCE_LABELS[item.source]}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>

          {selectedItem && (
            <Box data-testid="workspace-calendar-detail" sx={{ borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}`, p: 1.6 }}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{selectedItem.title}</Typography>
                  <Typography sx={{ color: SOURCE_COLORS[selectedItem.source], fontSize: 12 }}>
                    {WORKSPACE_CALENDAR_SOURCE_LABELS[selectedItem.source]} · {productLabel(selectedItem.product_key)}
                  </Typography>
                </Box>
                {selectedItem.editable && (
                  <Stack direction="row">
                    <Tooltip title="Rediger hendelsen"><IconButton onClick={() => openEdit(selectedItem)} sx={{ color: BRAND.accent }}><EditOutlinedIcon /></IconButton></Tooltip>
                    <Tooltip title="Slett hendelsen"><IconButton onClick={() => void removeEvent()} disabled={saving} sx={{ color: '#f87171' }}><DeleteOutlineIcon /></IconButton></Tooltip>
                  </Stack>
                )}
              </Stack>
              <Divider sx={{ borderColor: BRAND.border, my: 1.2 }} />
              <Stack gap={0.75}>
                <Stack direction="row" gap={0.8} alignItems="center"><ScheduleOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 18 }} /><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>{formatDay(dateKey(itemStartDate(selectedItem)))} · {formatEventTime(selectedItem)}</Typography></Stack>
                {selectedItem.location && <Stack direction="row" gap={0.8} alignItems="center"><LocationOnOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 18 }} /><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>{selectedItem.location}</Typography></Stack>}
                {selectedItem.assignee && <Stack direction="row" gap={0.8} alignItems="center"><PersonOutlineOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 18 }} /><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>{selectedItem.assignee}</Typography></Stack>}
                {selectedItem.project_title && <Stack direction="row" gap={0.8} alignItems="center"><FolderOpenOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 18 }} /><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>{selectedItem.project_title}</Typography></Stack>}
                {selectedItem.case_title && <Stack direction="row" gap={0.8} alignItems="center"><LinkOutlinedIcon sx={{ color: BRAND.textDim, fontSize: 18 }} /><Typography sx={{ color: BRAND.textMuted, fontSize: 13 }}>{selectedItem.case_title}</Typography></Stack>}
              </Stack>
              {selectedItem.description && <Typography sx={{ color: BRAND.textMuted, fontSize: 13, whiteSpace: 'pre-wrap', mt: 1.2 }}>{selectedItem.description}</Typography>}
              <Stack direction="row" gap={0.8} flexWrap="wrap" sx={{ mt: 1.2 }}>
                {selectedItem.tags.map((tag) => <Chip key={tag} size="small" label={tag} sx={{ color: BRAND.textMuted }} />)}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.4 }}>
                {selectedItem.link_path && <Button variant="outlined" startIcon={<LaunchOutlinedIcon />} onClick={() => window.location.assign(selectedItem.link_path!)} sx={{ color: BRAND.accent, borderColor: BRAND.border }}>Åpne kilden</Button>}
                {selectedItem.external_url && <Button component="a" href={selectedItem.external_url} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<LaunchOutlinedIcon />} sx={{ color: '#f97316', borderColor: BRAND.border }}>Offisiell kilde</Button>}
                {selectedItem.meeting_url && <Button component="a" href={selectedItem.meeting_url} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<LaunchOutlinedIcon />} sx={{ color: '#38bdf8', borderColor: BRAND.border }}>Åpne møte</Button>}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: BRAND.panelSolid, color: BRAND.text } }}>
        <DialogTitle>{editingId ? 'Rediger hendelse' : 'Ny kalenderhendelse'}</DialogTitle>
        <DialogContent>
          <Stack gap={1.4} sx={{ mt: 1 }}>
            <TextField autoFocus label="Tittel" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required fullWidth sx={fieldSx} />
            <TextField label="Beskrivelse" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} multiline minRows={3} fullWidth sx={fieldSx} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
              <TextField select label="Type" value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value as WorkspaceCalendarEventType })} sx={fieldSx}>
                {Object.entries(WORKSPACE_CALENDAR_EVENT_TYPE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
              <TextField select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkspaceCalendarStatus })} sx={fieldSx}>
                <MenuItem value="confirmed">Bekreftet</MenuItem>
                <MenuItem value="tentative">Foreløpig</MenuItem>
                <MenuItem value="cancelled">Avlyst</MenuItem>
              </TextField>
              <TextField label="Dato" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} InputLabelProps={{ shrink: true }} required sx={fieldSx} />
              <FormControlLabel
                control={<Checkbox checked={draft.allDay} onChange={(event) => setDraft({ ...draft, allDay: event.target.checked })} sx={{ color: BRAND.textDim, '&.Mui-checked': { color: BRAND.accent } }} />}
                label="Hele dagen"
                sx={{ color: BRAND.textMuted }}
              />
              {!draft.allDay && <>
                <TextField label="Starttid" type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                <TextField label="Sluttid" type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />
              </>}
            </Box>
            <Divider sx={{ borderColor: BRAND.border }} />
            <TextField
              select
              label="Arbeidsområde"
              value={draft.productKey}
              onChange={(event) => setDraft({ ...draft, productKey: event.target.value as ProductValue, projectId: '', caseId: '' })}
              fullWidth
              sx={fieldSx}
            >
              <MenuItem value="role_room">The Role Room</MenuItem>
              <MenuItem value="leadgrid">Leadgrid</MenuItem>
              <MenuItem value="internal">Creatorhub / internt</MenuItem>
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
              <TextField select label="Adminprosjekt" value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })} sx={fieldSx}>
                <MenuItem value="">Ingen prosjektkobling</MenuItem>
                {compatibleProjects.map((item) => <MenuItem key={item.id} value={item.id}>{item.title} · {productLabel(item.product_key)}</MenuItem>)}
              </TextField>
              <TextField select label="Sak" value={draft.caseId} onChange={(event) => setDraft({ ...draft, caseId: event.target.value })} sx={fieldSx}>
                <MenuItem value="">Ingen sakskobling</MenuItem>
                {compatibleCases.map((item) => <MenuItem key={item.id} value={item.id}>{item.title} · {productLabel(item.product_key)}</MenuItem>)}
              </TextField>
              <TextField label="Sted" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} sx={fieldSx} />
              <TextField label="Ansvarlig" value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} sx={fieldSx} />
            </Box>
            <TextField label="Møtelenke" value={draft.meetingUrl} onChange={(event) => setDraft({ ...draft, meetingUrl: event.target.value })} placeholder="https://meet.google.com/…" fullWidth sx={fieldSx} />
            <TextField label="Etiketter" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} helperText="Skill etiketter med komma" fullWidth sx={fieldSx} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ color: BRAND.textMuted }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void saveEvent()} disabled={saving || !draft.title.trim() || !draft.date} startIcon={saving ? <CircularProgress size={16} /> : <CalendarMonthOutlinedIcon />} sx={{ bgcolor: BRAND.accentStrong }}>
            {editingId ? 'Lagre hendelse' : 'Opprett hendelse'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
