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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import {
  WORKSPACE_TASK_PRIORITY_LABELS,
  WORKSPACE_TASK_STATUS_LABELS,
  workspaceTasksApi,
  type WorkspaceTask,
  type WorkspaceTaskInput,
  type WorkspaceTaskOptions,
  type WorkspaceTaskPriority,
  type WorkspaceTaskStatus,
} from '../../services/adminRoomApi';

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

const STATUS_COLORS: Record<WorkspaceTaskStatus, string> = {
  inbox: '#94a3b8',
  todo: '#38bdf8',
  in_progress: '#a78bfa',
  waiting: '#f59e0b',
  done: '#22c55e',
  cancelled: '#64748b',
};

const PRIORITY_COLORS: Record<WorkspaceTaskPriority, string> = {
  low: '#94a3b8',
  normal: '#38bdf8',
  high: '#f59e0b',
  urgent: '#ef4444',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: BRAND.text },
  '& .MuiInputLabel-root': { color: BRAND.textDim },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.borderHover },
  '& .MuiSvgIcon-root': { color: BRAND.textDim },
};

type ProductValue = 'role_room' | 'leadgrid' | 'internal';
type StatusFilter = 'open' | 'all' | WorkspaceTaskStatus;

interface TasksTabProps {
  parentProduct: 'roleroom' | 'leadgrid';
}

interface TaskDraft {
  title: string;
  description: string;
  status: WorkspaceTaskStatus;
  priority: WorkspaceTaskPriority;
  dueDate: string;
  assignee: string;
  productKey: ProductValue;
  projectId: string;
  caseId: string;
  tags: string;
}

function contextProduct(parentProduct: TasksTabProps['parentProduct']): 'role_room' | 'leadgrid' {
  return parentProduct === 'roleroom' ? 'role_room' : 'leadgrid';
}

function productLabel(value: WorkspaceTask['product_key']): string {
  if (value === 'role_room') return 'The Role Room';
  if (value === 'leadgrid') return 'Leadgrid';
  return 'Creatorhub / internt';
}

function toDraft(task: WorkspaceTask): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date?.slice(0, 10) ?? '',
    assignee: task.assignee ?? '',
    productKey: task.product_key ?? 'internal',
    projectId: task.project_id ?? '',
    caseId: task.case_id ?? '',
    tags: task.tags.join(', '),
  };
}

function emptyDraft(parentProduct: TasksTabProps['parentProduct']): TaskDraft {
  return {
    title: '',
    description: '',
    status: 'todo',
    priority: 'normal',
    dueDate: '',
    assignee: '',
    productKey: contextProduct(parentProduct),
    projectId: '',
    caseId: '',
    tags: '',
  };
}

function toInput(draft: TaskDraft): WorkspaceTaskInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate || null,
    assignee: draft.assignee.trim() || null,
    productKey: draft.productKey === 'internal' ? null : draft.productKey,
    projectId: draft.projectId || null,
    caseId: draft.caseId || null,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Ingen frist';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
}

function localDateKey(offsetDays = 0): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dueMeta(task: WorkspaceTask): { label: string; color: string } {
  if (!task.due_date) return { label: 'Ingen frist', color: BRAND.textDim };
  const key = task.due_date.slice(0, 10);
  if (task.status !== 'done' && task.status !== 'cancelled' && key < localDateKey()) {
    return { label: `Forfalt · ${formatDate(task.due_date)}`, color: '#f87171' };
  }
  if (key === localDateKey()) return { label: 'I dag', color: '#fbbf24' };
  if (key === localDateKey(1)) return { label: 'I morgen', color: BRAND.accent };
  return { label: formatDate(task.due_date), color: BRAND.textMuted };
}

const CONTEXT_COPY = {
  roleroom: {
    heading: 'Oppgaver — The Role Room',
    description: 'Din operative arbeidskø for markedskontakt, castingbyråer, partnerskap, støttearbeid og interne leveranser. Produksjonsoppgaver forblir i Role Room.',
    empty: 'Opprett for eksempel «Ring castingbyrået», «Ferdigstill Innovasjon Norge-utkastet» eller «Avklar pilotpartner».',
  },
  leadgrid: {
    heading: 'Oppgaver — Leadgrid',
    description: 'Din operative arbeidskø for leads, pilotkunder, partnerløp, støttearbeid og interne leveranser. Kundeaktiviteter i CRM forblir i Leadgrid.',
    empty: 'Opprett for eksempel «Følg opp pilotbyrå», «Send partnerforslag» eller «Avklar støtteordning».',
  },
} as const;

export function TasksTab({ parentProduct }: TasksTabProps) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [options, setOptions] = useState<WorkspaceTaskOptions>({ projects: [], cases: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [productFilter, setProductFilter] = useState<'context' | 'all' | 'internal'>('context');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [priorityFilter, setPriorityFilter] = useState<'all' | WorkspaceTaskPriority>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<TaskDraft>(() => emptyDraft(parentProduct));

  const copy = CONTEXT_COPY[parentProduct];
  const product = contextProduct(parentProduct);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await workspaceTasksApi.list({
        ...(productFilter === 'context'
          ? { product }
          : productFilter === 'internal' ? { product: 'internal' as const } : {}),
        ...(statusFilter === 'open'
          ? { openOnly: true }
          : statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(priorityFilter !== 'all' ? { priority: priorityFilter } : {}),
      });
      setTasks(items);
      const requestedId = new URLSearchParams(window.location.search).get('taskId');
      setSelectedId((current) => {
        if (requestedId && items.some((item) => item.id === requestedId)) return requestedId;
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id ?? null;
      });
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente oppgaver');
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, product, productFilter, statusFilter]);

  const refreshOptions = useCallback(async () => {
    try {
      setOptions(await workspaceTasksApi.options());
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente prosjekt- og saksvalg');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshOptions();
  }, [refreshOptions]);

  useEffect(() => {
    const task = tasks.find((item) => item.id === selectedId) ?? null;
    setDraft(task ? toDraft(task) : null);
  }, [selectedId, tasks]);

  useEffect(() => {
    setCreateDraft(emptyDraft(parentProduct));
  }, [parentProduct]);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('nb-NO');
    if (!needle) return tasks;
    return tasks.filter((task) =>
      `${task.title} ${task.description ?? ''} ${task.assignee ?? ''} ${task.project_title ?? ''} ${task.case_title ?? ''}`
        .toLocaleLowerCase('nb-NO')
        .includes(needle),
    );
  }, [query, tasks]);

  const stats = useMemo(() => {
    const today = localDateKey();
    return {
      open: tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length,
      today: tasks.filter((task) => task.due_date?.slice(0, 10) === today && task.status !== 'done' && task.status !== 'cancelled').length,
      overdue: tasks.filter((task) => Boolean(task.due_date && task.due_date.slice(0, 10) < today && task.status !== 'done' && task.status !== 'cancelled')).length,
      done: tasks.filter((task) => task.status === 'done').length,
    };
  }, [tasks]);

  const compatibleProjects = useCallback((productKey: ProductValue) => (
    options.projects.filter((item) =>
      productKey === 'internal'
        ? item.product_key === null
        : item.product_key === null || item.product_key === productKey,
    )
  ), [options.projects]);

  const compatibleCases = useCallback((productKey: ProductValue) => (
    options.cases.filter((item) =>
      productKey === 'internal'
        ? item.product_key === null
        : item.product_key === null || item.product_key === productKey,
    )
  ), [options.cases]);

  const createTask = async () => {
    if (!createDraft.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await workspaceTasksApi.create(toInput(createDraft));
      setCreateOpen(false);
      setCreateDraft(emptyDraft(parentProduct));
      await refresh();
      setSelectedId(created.id);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke opprette oppgaven');
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async () => {
    if (!selectedId || !draft?.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await workspaceTasksApi.update(selectedId, toInput(draft));
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
      setDraft(toDraft(updated));
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke lagre oppgaven');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (task: WorkspaceTask) => {
    setError(null);
    try {
      await workspaceTasksApi.update(task.id, {
        status: task.status === 'done' ? 'todo' : 'done',
      });
      await refresh();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke oppdatere oppgaven');
    }
  };

  const removeTask = async () => {
    if (!selectedId || !draft) return;
    if (!window.confirm(`Slette oppgaven «${draft.title}»?`)) return;
    setSaving(true);
    setError(null);
    try {
      await workspaceTasksApi.delete(selectedId);
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke slette oppgaven');
    } finally {
      setSaving(false);
    }
  };

  const renderProductFields = (
    value: TaskDraft,
    onChange: (next: TaskDraft) => void,
  ) => (
    <>
      <TextField
        select
        label="Arbeidsområde"
        value={value.productKey}
        onChange={(event) => onChange({
          ...value,
          productKey: event.target.value as ProductValue,
          projectId: '',
          caseId: '',
        })}
        fullWidth
        sx={fieldSx}
      >
        <MenuItem value="role_room">The Role Room</MenuItem>
        <MenuItem value="leadgrid">Leadgrid</MenuItem>
        <MenuItem value="internal">Creatorhub / internt</MenuItem>
      </TextField>
      <TextField
        select
        label="Adminprosjekt"
        value={value.projectId}
        onChange={(event) => onChange({ ...value, projectId: event.target.value })}
        fullWidth
        sx={fieldSx}
      >
        <MenuItem value="">Ingen prosjektkobling</MenuItem>
        {compatibleProjects(value.productKey).map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.title} · {productLabel(item.product_key)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Sak"
        value={value.caseId}
        onChange={(event) => onChange({ ...value, caseId: event.target.value })}
        fullWidth
        sx={fieldSx}
      >
        <MenuItem value="">Ingen sakskobling</MenuItem>
        {compatibleCases(value.productKey).map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.title} · {productLabel(item.product_key)}
          </MenuItem>
        ))}
      </TextField>
    </>
  );

  return (
    <Box data-testid="workspace-tasks" sx={{ color: BRAND.text }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{copy.heading}</Typography>
          <Typography sx={{ color: BRAND.textMuted, maxWidth: 840, mt: 0.6 }}>
            {copy.description}
          </Typography>
        </Box>
        <Button
          data-testid="workspace-task-create"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setCreateDraft(emptyDraft(parentProduct));
            setCreateOpen(true);
          }}
          sx={{ bgcolor: BRAND.accentStrong, alignSelf: { xs: 'stretch', md: 'flex-start' } }}
        >
          Ny oppgave
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
        {[
          { label: 'Åpne', value: stats.open, icon: <TaskAltOutlinedIcon />, color: BRAND.accent },
          { label: 'I dag', value: stats.today, icon: <TodayOutlinedIcon />, color: '#fbbf24' },
          { label: 'Forfalt', value: stats.overdue, icon: <WarningAmberOutlinedIcon />, color: '#f87171' },
          { label: 'Fullført i visningen', value: stats.done, icon: <AssignmentTurnedInOutlinedIcon />, color: '#22c55e' },
        ].map((stat) => (
          <Box key={stat.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography sx={{ color: BRAND.textDim, fontSize: 12 }}>{stat.label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: stat.color }}>{stat.value}</Typography>
              </Box>
              <Box sx={{ color: stat.color }}>{stat.icon}</Box>
            </Stack>
          </Box>
        ))}
      </Box>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        flexWrap={{ lg: 'wrap' }}
        gap={1.2}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søk i oppgaver, ansvarlig eller koblinger"
          InputProps={{ startAdornment: <SearchOutlinedIcon sx={{ mr: 1, color: BRAND.textDim }} /> }}
          sx={{ ...fieldSx, minWidth: { lg: 260 }, flex: '2 1 280px' }}
        />
        <TextField select size="small" label="Område" value={productFilter} onChange={(event) => setProductFilter(event.target.value as typeof productFilter)} sx={{ ...fieldSx, minWidth: 170, flex: '1 1 170px' }}>
          <MenuItem value="context">{productLabel(product)}</MenuItem>
          <MenuItem value="internal">Creatorhub / internt</MenuItem>
          <MenuItem value="all">Alle områder</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} sx={{ ...fieldSx, minWidth: 150, flex: '1 1 150px' }}>
          <MenuItem value="open">Alle åpne</MenuItem>
          <MenuItem value="all">Alle</MenuItem>
          {Object.entries(WORKSPACE_TASK_STATUS_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Prioritet" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)} sx={{ ...fieldSx, minWidth: 145, flex: '1 1 145px' }}>
          <MenuItem value="all">Alle</MenuItem>
          {Object.entries(WORKSPACE_TASK_PRIORITY_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'minmax(0, 1.18fr) minmax(360px, 0.82fr)' }, gap: 2 }}>
        <Box data-testid="workspace-task-list" sx={{ borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}`, overflow: 'hidden' }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={28} /></Stack>
          ) : visibleTasks.length === 0 ? (
            <Stack alignItems="center" textAlign="center" sx={{ py: 8, px: 3 }}>
              <TaskAltOutlinedIcon sx={{ fontSize: 44, color: BRAND.textDim, mb: 1 }} />
              <Typography sx={{ fontWeight: 700 }}>Ingen oppgaver i denne visningen</Typography>
              <Typography sx={{ color: BRAND.textMuted, maxWidth: 520, mt: 0.5 }}>{copy.empty}</Typography>
            </Stack>
          ) : (
            visibleTasks.map((task, index) => {
              const due = dueMeta(task);
              const closed = task.status === 'done' || task.status === 'cancelled';
              return (
                <Box
                  key={task.id}
                  data-testid={`workspace-task-row-${task.id}`}
                  onClick={() => setSelectedId(task.id)}
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    cursor: 'pointer',
                    bgcolor: selectedId === task.id ? BRAND.selectedBg : 'transparent',
                    borderTop: index ? `1px solid ${BRAND.border}` : 'none',
                    '&:hover': { bgcolor: selectedId === task.id ? BRAND.selectedBg : BRAND.hoverBg },
                  }}
                >
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <Tooltip title={task.status === 'done' ? 'Gjenåpne oppgaven' : 'Marker som fullført'}>
                      <Checkbox
                        size="small"
                        checked={task.status === 'done'}
                        disabled={task.status === 'cancelled'}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => void toggleDone(task)}
                        sx={{ color: BRAND.textDim, '&.Mui-checked': { color: '#22c55e' }, p: 0.4 }}
                      />
                    </Tooltip>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, textDecoration: closed ? 'line-through' : 'none', color: closed ? BRAND.textDim : BRAND.text }}>
                        {task.title}
                      </Typography>
                      {task.description && (
                        <Typography noWrap sx={{ color: BRAND.textMuted, fontSize: 13, mt: 0.25 }}>
                          {task.description}
                        </Typography>
                      )}
                      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.8 }}>
                        <Chip size="small" label={WORKSPACE_TASK_STATUS_LABELS[task.status]} sx={{ color: STATUS_COLORS[task.status], bgcolor: `${STATUS_COLORS[task.status]}18` }} />
                        <Chip size="small" label={WORKSPACE_TASK_PRIORITY_LABELS[task.priority]} sx={{ color: PRIORITY_COLORS[task.priority], bgcolor: `${PRIORITY_COLORS[task.priority]}18` }} />
                        <Chip size="small" icon={<CalendarMonthOutlinedIcon />} label={due.label} sx={{ color: due.color, bgcolor: 'rgba(255,255,255,0.04)', '& .MuiChip-icon': { color: due.color } }} />
                        {task.project_title && <Chip size="small" icon={<FolderOpenOutlinedIcon />} label={task.project_title} sx={{ color: BRAND.textMuted }} />}
                        {task.case_title && <Chip size="small" icon={<LinkOutlinedIcon />} label={task.case_title} sx={{ color: BRAND.textMuted }} />}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>

        <Box data-testid="workspace-task-detail" sx={{ borderRadius: 2, bgcolor: BRAND.panelBg, border: `1px solid ${BRAND.border}`, p: 2, alignSelf: 'start' }}>
          {!draft ? (
            <Stack alignItems="center" textAlign="center" sx={{ py: 6 }}>
              <TaskAltOutlinedIcon sx={{ fontSize: 40, color: BRAND.textDim }} />
              <Typography sx={{ color: BRAND.textMuted, mt: 1 }}>Velg en oppgave for å se og redigere detaljene.</Typography>
            </Stack>
          ) : (
            <Stack gap={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight: 800 }}>Oppgavedetaljer</Typography>
                <Tooltip title="Slett oppgaven">
                  <IconButton onClick={() => void removeTask()} disabled={saving} sx={{ color: '#f87171' }}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
              <TextField label="Tittel" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} fullWidth required sx={fieldSx} />
              <TextField label="Beskrivelse / neste handling" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} multiline minRows={4} fullWidth sx={fieldSx} />
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
                <TextField select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as WorkspaceTaskStatus })} sx={fieldSx}>
                  {Object.entries(WORKSPACE_TASK_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select label="Prioritet" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as WorkspaceTaskPriority })} sx={fieldSx}>
                  {Object.entries(WORKSPACE_TASK_PRIORITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField label="Frist" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                <TextField label="Ansvarlig" value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} InputProps={{ startAdornment: <PersonOutlineOutlinedIcon sx={{ mr: 0.8, color: BRAND.textDim }} /> }} sx={fieldSx} />
              </Box>
              <Divider sx={{ borderColor: BRAND.border }} />
              {renderProductFields(draft, setDraft)}
              <TextField label="Etiketter" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} helperText="Skill etiketter med komma" fullWidth sx={fieldSx} />
              <Button variant="contained" onClick={() => void saveTask()} disabled={saving || !draft.title.trim()} sx={{ bgcolor: BRAND.accentStrong }}>
                {saving ? 'Lagrer…' : 'Lagre oppgave'}
              </Button>
            </Stack>
          )}
        </Box>
      </Box>

      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: BRAND.panelSolid, color: BRAND.text } }}>
        <DialogTitle>Ny oppgave</DialogTitle>
        <DialogContent>
          <Stack gap={1.5} sx={{ mt: 1 }}>
            <TextField autoFocus label="Hva skal gjøres?" value={createDraft.title} onChange={(event) => setCreateDraft({ ...createDraft, title: event.target.value })} required fullWidth sx={fieldSx} />
            <TextField label="Beskrivelse / neste handling" value={createDraft.description} onChange={(event) => setCreateDraft({ ...createDraft, description: event.target.value })} multiline minRows={3} fullWidth sx={fieldSx} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2 }}>
              <TextField select label="Prioritet" value={createDraft.priority} onChange={(event) => setCreateDraft({ ...createDraft, priority: event.target.value as WorkspaceTaskPriority })} sx={fieldSx}>
                {Object.entries(WORKSPACE_TASK_PRIORITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
              <TextField label="Frist" type="date" value={createDraft.dueDate} onChange={(event) => setCreateDraft({ ...createDraft, dueDate: event.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Box>
            <TextField label="Ansvarlig" value={createDraft.assignee} onChange={(event) => setCreateDraft({ ...createDraft, assignee: event.target.value })} fullWidth sx={fieldSx} />
            {renderProductFields(createDraft, setCreateDraft)}
            <TextField label="Etiketter" value={createDraft.tags} onChange={(event) => setCreateDraft({ ...createDraft, tags: event.target.value })} helperText="Skill etiketter med komma" fullWidth sx={fieldSx} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={saving} sx={{ color: BRAND.textMuted }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void createTask()} disabled={saving || !createDraft.title.trim()} startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />} sx={{ bgcolor: BRAND.accentStrong }}>
            Opprett oppgave
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
