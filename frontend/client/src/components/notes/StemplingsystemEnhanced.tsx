import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Autocomplete,
} from '@mui/material';
import { PlayArrow, Stop, Add, Delete, CloudUpload, Assessment } from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

// ============================================================================
// TYPES
// ============================================================================

type Activity = 'work' | 'meeting' | 'billable' | 'non_billable';

interface TimeEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakHours: string | number;
  activity: Activity;
  title: string;
  notes?: string;
  clientId?: string;
  projectId?: string;
  projectName?: string;
  place?: string;
  isBillable: boolean;
  hourlyRate: string | number;
  calculatedHours: string | number;
  calculatedAmount: string | number;
  isInvoiced: boolean;
  invoiceId?: string;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  startedAt: string;
  startedAtDate: string;
  startedAtTime: string;
  activity: Activity;
  title: string;
  clientId?: string;
  projectId?: string;
  place?: string;
}

interface MonthStats {
  month: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  totalEarnings: number;
  workHours: number;
  meetingHours: number;
  days: number;
  totalEntries: number;
}

interface Client {
  id: string;
  name: string;
  hourlyRate?: number;
}

interface ProjectItem {
  id: string;
  name: string;
  clientName?: string;
}

interface TravelLog {
  id: string;
  date: string;
  distanceKm: number;
  purpose?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

async function apiJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTimeStr(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function monthKey(dateISO: string) {
  const d = new Date(dateISO +  'T00:00:00,');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
}

function weekdayName(dateISO: string) {
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString('nb-NO', { weekday: 'short' });
}

function nok(n: number) {
  try {
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(n || 0);
  } catch {
    return `${(n || 0).toFixed(2)} kr`;
  }
}

async function fetchDefaultHourlyRate(): Promise<number | null> {
  try {
    const data = await apiJson('/api/pricing/structure');
    const first = Array.isArray(data) ? data[0] : Array.isArray(data?.structures) ? data.structures[0] : null;
    const rate = first?.rates?.hourlyRate;
    return typeof rate === 'number' ? rate : rate ? Number(rate) : null;
  } catch {
    return null;
  }
}

function activityLabel(a: Activity): string {
  switch (a) {
    case 'work':
      return 'Arbeid';
    case 'meeting':
      return 'Møte';
    case 'billable':
      return 'Fakturerbar';
    case 'non_billable':
      return 'Ikke-fakturerbar';
    default:
      return a;
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]> {
  return apiJson(`/api/time-tracking/entries?startDate=${startDate}&endDate=${endDate}`);
}

async function fetchActiveSession(): Promise<ActiveSession | null> {
  return apiJson('/api/time-tracking/active-session');
}

async function createTimeEntry(entry: Partial<TimeEntry>): Promise<TimeEntry> {
  return apiJson('/api/time-tracking/entries', {
    method: 'POST',
    headers: { 'Content-Type' : 'application/json' },
    body: JSON.stringify(entry),
  });
}

async function deleteTimeEntry(id: string): Promise<void> {
  await apiJson(`/api/time-tracking/entries/${id}`, { method: 'DELETE' });
}

async function clockIn(data: {
  activity: Activity;
  title: string;
  clientId?: string;
  projectId?: string;
  place?: string;
}): Promise<ActiveSession> {
  return apiJson('/api/time-tracking/clock-in', {
    method: 'POST',
    headers: { 'Content-Type' : 'application/json' },
    body: JSON.stringify(data),
  });
}

async function clockOut(data: {
  notes?: string;
  breakHours: number;
  hourlyRate: number;
}): Promise<TimeEntry> {
  return apiJson('/api/time-tracking/clock-out', {
    method: 'POST',
    headers: { 'Content-Type' : 'application/json' },
    body: JSON.stringify(data),
  });
}

async function fetchStats(month: string): Promise<MonthStats> {
  return apiJson(`/api/time-tracking/stats?month=${month}`);
}

async function createArchive(month: string): Promise<any> {
  return apiJson('/api/time-tracking/archive/create', {
    method: 'POST',
    headers: { 'Content-Type' : 'application/json' },
    body: JSON.stringify({ month }),
  });
}

async function fetchUninvoicedEntries(): Promise<any> {
  return apiJson('/api/time-tracking/fiken/uninvoiced');
}

async function createFikenInvoice(data: {
  timeEntryIds: string[];
  travelLogIds?: string[];
  clientId?: string;
  dueDate?: string;
  invoiceText?: string;
}): Promise<any> {
  return apiJson('/api/time-tracking/fiken/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type' : 'application/json' },
    body: JSON.stringify(data),
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function StemplingsystemEnhanced() {
  const queryClient = useQueryClient();
  const { communication } = useEnhancedMasterIntegration();
  const [month, setMonth] = useState<string>(() => monthKey(todayStr()));

  // Form state
  const [activity, setActivity] = useState<Activity>('work');
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<string>(todayStr());
  const [start, setStart] = useState<string>(nowTimeStr());
  const [end, setEnd] = useState<string>(nowTimeStr());
  const [breakHours, setBreakHours] = useState<number>(0);
  const [isBillable, setIsBillable] = useState(true);
  const [hourlyRate, setHourlyRate] = useState<number>(0);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  // Load hourly rate server-first, fallback to local
  useEffect(() => {
    (async () => {
      try {
        const kv = await apiJson('/api/user/kv/hourlyRate');
        const v = kv && typeof kv === 'object' && 'value' in kv ? kv.value : kv;
        if (typeof v === 'number') {
          setHourlyRate(v);
          return;
        }
      } catch {}
      try {
        const saved = localStorage.getItem('hourlyRate');
        if (saved) setHourlyRate(parseFloat(saved) || 0);
      } catch {}
    })();
  }, []);

  // Archive dialog
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Fiken invoice dialog
  const [fikenDialogOpen, setFikenDialogOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [selectedTravelLogs, setSelectedTravelLogs] = useState<string[]>([]);

  // Persist hourly rate (server-first, local mirror)
  useEffect(() => {
    (async () => {
      try {
        await apiJson('/api/user/kv', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({ key: 'hourlyRate', value: hourlyRate }),
        });
      } catch {}
      try { localStorage.setItem('hourlyRate', String(hourlyRate)); } catch {}
    })();
  }, [hourlyRate]);

  // Calculate date range for month
  const dateRange = useMemo(() => {
    const year = parseInt(month.substring(0, 4));
    const monthNum = parseInt(month.substring(4, 6));
    const lastDay = new Date(year, monthNum, 0).getDate();
    return {
      startDate: `${year}-${pad(monthNum)}-01`,
      endDate: `${year}-${pad(monthNum)}-${pad(lastDay)}`,
    };
  }, [month]);

// Queries
  const {
    data: entries = [],
    isLoading: entriesLoading,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ['timeEntries', dateRange.startDate, dateRange.endDate],
    queryFn: () => fetchTimeEntries(dateRange.startDate, dateRange.endDate),
  });

  const {
    data: activeSession,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['activeSession'],
    queryFn: fetchActiveSession,
  });

  const { data: stats } = useQuery({
    queryKey: ['timeStats', month],
    queryFn: () => fetchStats(month),
  });

  const { data: uninvoiced } = useQuery({
    queryKey: ['uninvoicedEntries'],
    queryFn: fetchUninvoicedEntries,
    enabled: fikenDialogOpen,
  });

  // CRM: customers and projects for selection
  const { data: customersResp } = useQuery({
    queryKey: ['customersDetailed'],
    queryFn: () => apiJson('/api/admin/customers-detailed'),
  });
  const customers: Client[] = (customersResp?.customers || []).map((c: any) => ({ id: c.id, name: c.name }));

  const { data: projectsResp } = useQuery({
    queryKey: ['projectsDetailed'],
    queryFn: () => apiJson('/api/admin/projects-detailed'),
  });
  const projects: ProjectItem[] = (projectsResp?.projects || []).map((p: any) => ({ id: p.id, name: p.name, clientName: p.clientName }));

  // Fiken kjørebok travel logs for the selected month
  async function fetchTravelLogs(monthKeyStr: string): Promise<TravelLog[]> {
    return apiJson(`/api/time-tracking/fiken/travel-logs?month=${monthKeyStr}`);
  }
  const { data: travelLogs = [] } = useQuery({
    queryKey: ['fikenTravelLogs', month, fikenDialogOpen],
    queryFn: () => fetchTravelLogs(month),
    enabled: fikenDialogOpen,
  });

  // Mutations
const createMutation = useMutation({
    mutationFn: createTimeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeStats'] });
      setTitle('');
      setProjectName('');
      setSelectedProject(null);
      setPlace('');
      setNotes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimeEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeStats'] });
    },
  });

const clockInMutation = useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSession'] });
      setTitle('');
      setProjectName('');
      setPlace(', ');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSession'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeStats'] });
      setNotes(', ');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: createArchive,
    onSuccess: () => {
      setArchiveDialogOpen(false);
      alert('Arkiv opprettet i Google Drive!');
    },
  });

  const fikenInvoiceMutation = useMutation({
    mutationFn: createFikenInvoice,
    onSuccess: () => {
      setFikenDialogOpen(false);
      setSelectedEntries([]);
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['uninvoicedEntries'] });
      alert('Faktura opprettet i Fiken!');
    },
  });

  // Handlers
function handleAddEntry() {
    if (!date || !start || !end || !title.trim()) {
      alert('Fyll inn Dato, Inn, Ut og Tittel.');
      return;
    }

    createMutation.mutate({
      date,
      startTime: start,
      endTime: end,
      breakHours,
      activity,
      title: title.trim(),
      notes: notes.trim() || undefined,
      clientId: selectedClient?.id,
      projectId: selectedProject?.id,
      projectName: projectName.trim() || selectedProject?.name || undefined,
      place: place.trim() || undefined,
      isBillable,
      hourlyRate,
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Slette denne raden?')) return;
    deleteMutation.mutate(id);
  }

function handleClockIn() {
    if (!title.trim()) {
      alert('Skriv en tittel før du stempler inn.');
      return;
    }

    clockInMutation.mutate({
      activity,
      title: title.trim(),
      clientId: selectedClient?.id,
      projectId: selectedProject?.id,
      place: place.trim() || undefined,
    });
  }

  function handleClockOut() {
    clockOutMutation.mutate({
      notes: notes.trim() || undefined,
      breakHours,
      hourlyRate,
    });
  }

  function handleCreateArchive() {
    archiveMutation.mutate(month);
  }

  function handleCreateFikenInvoice() {
    if (selectedEntries.length === 0) {
      alert('Velg minst én tidsoppføring.');
      return;
    }

    fikenInvoiceMutation.mutate({
      timeEntryIds: selectedEntries,
      travelLogIds: selectedTravelLogs,
      invoiceText: 'Timefaktura',
    });
  }

  // Calculate billable entries
  const billableEntries = useMemo(
    () => entries.filter((e) => e.isBillable && !e.isInvoiced),
    [entries],
  );

return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #0f172a, #020617)',
        color: '#f1f5f9',
        p: 4}}
    >
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
            Smart Stempling
          </Typography>
          <Typography variant="body1" sx={{ color: '#94a3b8' }}>
            Backend-drevet • Fiken-integrert • Google Drive arkivering
          </Typography>
        </Box>

        {/* Controls */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Clock In/Out */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Stempling
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Aktivitet</InputLabel>
                  <Select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                    <MenuItem value="work">Arbeid</MenuItem>
                    <MenuItem value="meeting">Møte</MenuItem>
                    <MenuItem value="billable">Fakturerbar</MenuItem>
                    <MenuItem value="non_billable">Ikke-fakturerbar</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Tittel / Møte"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  sx={{ mb: 2 }}
                />

                <Autocomplete
                  options={customers}
                  getOptionLabel={(o) => o.name}
                  value={selectedClient}
                  onChange={async (_e, v) => {
                    setSelectedClient(v);
                    if (v) {
                      communication.sendBroadcast('client:selected', { clientId: v.id, clientName: v.name });
                      const rate = await fetchDefaultHourlyRate();
                      if (rate && rate > 0) setHourlyRate(rate);
                    }
                  }}
                  renderInput={(params) => <TextField {...params} label="Kunde" sx={{ mb: 2 }} />}
                />

                <Autocomplete
                  options={projects}
                  getOptionLabel={(o) => o.name}
                  value={selectedProject}
                  onChange={(_e, v) => {
                    setSelectedProject(v);
                    setProjectName(v?.name || '');
                    if (v) {
                      communication.sendBroadcast('project:selected', { projectId: v.id, projectName: v.name, clientName: v.clientName });
                    }
                  }}
                  renderInput={(params) => <TextField {...params} label="Prosjekt" sx={{ mb: 2 }} />}
                />

                <TextField
                  fullWidth
                  label="Sted / Modus"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  sx={{ mb: 2 }}
                />

                {activeSession ? (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Startet {activeSession.startedAtDate} kl. {activeSession.startedAtTime}
                      <br />
                      {activityLabel(activeSession.activity)} • {activeSession.title}
                    </Alert>

                    <TextField
                      fullWidth
                      label="Notater (valgfritt)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      sx={{ mb: 2 }}
                    />

                    <TextField
                      fullWidth
                      type="number"
                      label="Pause (timer)"
                      value={breakHours}
                      onChange={(e) => setBreakHours(parseFloat(e.target.value) || 0)}
                      inputProps={{ step: 0.25 }}
                      sx={{ mb: 2 }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      color="error"
                      startIcon={<Stop />}
                      onClick={handleClockOut}
                      disabled={clockOutMutation.isPending}
                    >
                      Stemple UT
                    </Button>
                  </>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={handleClockIn}
                    disabled={clockInMutation.isPending}
                  >
                    Stemple INN
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Manual Entry */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Legg til manuelt
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Dato"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Aktivitet</InputLabel>
                      <Select value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                        <MenuItem value="work">Arbeid</MenuItem>
                        <MenuItem value="meeting">Møte</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="time"
                      label="Inn"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="time"
                      label="Ut"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Pause (timer)"
                      value={breakHours}
                      onChange={(e) => setBreakHours(parseFloat(e.target.value) || 0)}
                      inputProps={{ step: 0.25 }}
                    />
                  </Grid>
<Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Tittel"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={customers}
                      getOptionLabel={(o) => o.name}
                      value={selectedClient}
                      onChange={async (_e, v) => {
                        setSelectedClient(v);
                        if (v) {
                          communication.sendBroadcast('client:selected', { clientId: v.id, clientName: v.name });
                          const rate = await fetchDefaultHourlyRate();
                          if (rate && rate > 0) setHourlyRate(rate);
                        }
                      }}
                      renderInput={(params) => <TextField {...params} label="Kunde" />}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={projects}
                      getOptionLabel={(o) => o.name}
                      value={selectedProject}
                      onChange={(_e, v) => {
                        setSelectedProject(v);
                        setProjectName(v?.name || ', ');
                        if (v) {
                          communication.sendBroadcast('project:selected', { projectId: v.id, projectName: v.name, clientName: v.clientName });
                        }
                      }}
                      renderInput={(params) => <TextField {...params} label="Prosjekt" />}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isBillable}
                          onChange={(e) => setIsBillable(e.target.checked)}
                        />
                      }
                      label="Fakturerbar"
                    />
                  </Grid>
                </Grid>

                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddEntry}
                  disabled={createMutation.isPending}
                  sx={{ mt: 2 }}
                >
                  Legg til
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Stats */}
          <Grid item xs={12} md={4}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Månedsstatistikk
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Måned</InputLabel>
                  <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                    {/* Generate months dynamically */}
                    {Array.from({ length: 12 }, (_, i) => {
                      const d = new Date();
                      d.setMonth(d.getMonth() - i);
                      const key = monthKey(todayStr(d));
                      return (
                        <MenuItem key={key} value={key}>
                          {d.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long' })}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  type="number"
                  label="Timesats (kr/t)"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                  inputProps={{ step: 50 }}
                  sx={{ mb: 2 }}
                />

                {stats && (
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Totalt (man-fre)
                        </Typography>
                        <Typography variant="h6">{stats.totalHours.toFixed(2)}t</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Fakturerbar
                        </Typography>
                        <Typography variant="h6">{stats.billableHours.toFixed(2)}t</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Estimert lønn
                        </Typography>
                        <Typography variant="h6">{nok(stats.totalEarnings)}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                )}

                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={() => setArchiveDialogOpen(true)}
                  >
                    Arkiver
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Assessment />}
                    onClick={() => setFikenDialogOpen(true)}
                  >
                    Fiken
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Time Entries Table */}
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Logg for {month}</Typography>
              <Chip
                label={`${entries.length} oppføringer • ${billableEntries.length} ufakturert`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {entriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : entries.length === 0 ? (
              <Typography sx={{ textAlign: 'center', color: '#94a3b8', py: 4 }}>
                Ingen oppføringer denne måneden ennå.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Dato</TableCell>
                      <TableCell>Ukedag</TableCell>
                      <TableCell>Inn</TableCell>
                      <TableCell>Ut</TableCell>
                      <TableCell>Pause</TableCell>
                      <TableCell>Timer</TableCell>
                      <TableCell>Aktivitet</TableCell>
                      <TableCell>Tittel</TableCell>
                      <TableCell>Fakturerbar</TableCell>
                      <TableCell>Beløp</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Slett</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{weekdayName(entry.date)}</TableCell>
                        <TableCell>{entry.startTime}</TableCell>
                        <TableCell>{entry.endTime}</TableCell>
                        <TableCell>{entry.breakHours}</TableCell>
                        <TableCell>{Number(entry.calculatedHours || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip label={activityLabel(entry.activity)} size="small" />
                        </TableCell>
                        <TableCell>{entry.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={entry.isBillable ? 'Ja' : 'Nei'}
                            size="small"
                            color={entry.isBillable ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{nok(Number(entry.calculatedAmount || 0))}</TableCell>
                        <TableCell>
                          {entry.isInvoiced ? (
                            <Chip label="Fakturert" size="small" color="info" />
                          ) : (
                            <Chip label="Ufakturert" size="small" color="warning" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Delete fontSize="small" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Archive Dialog */}
        <Dialog open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)}>
          <DialogTitle>Opprett månedsarkiv</DialogTitle>
          <DialogContent>
            <Typography>
              Dette vil opprette et CSV- og JSON-arkiv i Google Drive for måned {month}.
            </Typography>
            {stats && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  • {stats.totalEntries} oppføringer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • {stats.totalHours.toFixed(2)} timer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • {nok(stats.totalEarnings)} totalt
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setArchiveDialogOpen(false)}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={handleCreateArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Oppretter...' : 'Opprett arkiv'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Fiken Invoice Dialog */}
        <Dialog
          open={fikenDialogOpen}
          onClose={() => setFikenDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Opprett Fiken-faktura</DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              Velg tidsoppføringer som skal faktureres:
            </Typography>

            {uninvoiced && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {uninvoiced.total} ufakturerte oppføringer • {uninvoiced.totalHours.toFixed(2)} timer • {nok(uninvoiced.totalAmount)}
                </Typography>

                <Box sx={{ maxHeight: 240, overflowY: 'auto', mb: 2 }}>
                  {uninvoiced.entries?.map((entry: TimeEntry) => (
                    <Box
                      key={entry.id}
                      sx={{
                        p: 2,
                        mb: 1,
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 1,
                        cursor: 'pointer',
                        bgcolor: selectedEntries.includes(entry.id)
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'transparent'}}
                      onClick={() => {
                        setSelectedEntries((prev) =>
                          prev.includes(entry.id)
                            ? prev.filter((id) => id !== entry.id)
                            : [...prev, entry.id],
                        );
                      }}
                    >
                      <Typography variant="body2">
                        {entry.date} • {entry.title} • {Number(entry.calculatedHours || 0).toFixed(2)}t • {nok(Number(entry.calculatedAmount || 0))}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Fiken kjørebok travel logs */}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Kjørebok (Fiken)</Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {travelLogs?.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Ingen kjørebok-oppføringer funnet for valgt måned.</Typography>
                  ) : (
                    travelLogs.map((log) => (
                      <Box
                        key={log.id}
                        sx={{
                          p: 2,
                          mb: 1,
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 1,
                          cursor: 'pointer',
                          bgcolor: selectedTravelLogs.includes(log.id)
                            ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}}
                        onClick={() => {
                          setSelectedTravelLogs((prev) =>
                            prev.includes(log.id)
                              ? prev.filter((id) => id !== log.id)
                              : [...prev, log.id]
                          );
                        }}
                      >
                        <Typography variant="body2">
                          {log.date} • {log.distanceKm.toFixed(1)} km{log.purpose ? ` • ${log.purpose}` : ''}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFikenDialogOpen(false)}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={handleCreateFikenInvoice}
              disabled={fikenInvoiceMutation.isPending || selectedEntries.length === 0}
            >
              {fikenInvoiceMutation.isPending
                ?'Oppretter...'
                : `Opprett faktura (${selectedEntries.length})`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}






