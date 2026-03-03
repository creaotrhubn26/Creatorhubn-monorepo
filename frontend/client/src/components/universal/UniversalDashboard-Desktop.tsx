import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarTodayIcon,
  Chat as ChatIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Event as EventIcon,
  FolderOpen as FolderOpenIcon,
  Group as GroupIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  PhotoCamera as PhotoCameraIcon,
  Settings as SettingsIcon,
  Videocam as VideocamIcon,
  Visibility as VisibilityIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, XAxis, YAxis, CartesianGrid, Bar } from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useDemoMode } from '../../contexts/DemoModeContext';
import { apiRequest } from '../../lib/queryClient';
import AdminIndicator from '../admin/AdminIndicator';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';

type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';
type ClientStatus = 'prospect' | 'active' | 'inactive';
type NotificationType = 'info' | 'warning' | 'success';

interface DashboardProject {
  id: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  progress: number;
  budgetNok: number;
  updatedAt: string;
  description?: string;
}

interface DashboardClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  projectCount: number;
  totalValueNok: number;
  lastContactAt: string;
}

interface DashboardMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  attendeeCount: number;
}

interface DashboardWorklog {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  createdAt: string;
}

interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
}

interface UniversalDashboardDesktopProps {
  profession?: Profession;
  onMeetingCreate?: (meeting: DashboardMeeting) => void;
  onProjectUpdate?: (project: DashboardProject) => void;
  onWorklogCreate?: (worklog: DashboardWorklog) => void;
  onClientSelect?: (client: DashboardClient) => void;
  onClientUpdate?: (client: DashboardClient) => void;
  onShowcaseCreate?: (showcase: { projectId: string; title: string }) => void;
  onFileUpload?: (file: { name: string; size: number; type: string }) => void;
  onFileDownload?: (file: { name: string; source: string }) => void;
  selectedProject?: DashboardProject | null;
  onProjectSelect?: (project: DashboardProject) => void;
  selectedClient?: DashboardClient | null;
  onSettingsUpdate?: (settings: { compactMode: boolean; autoSync: boolean; quickActions: boolean }) => void;
  onNotificationCreate?: (notification: DashboardNotification) => void;
}

interface DashboardData {
  projects: DashboardProject[];
  clients: DashboardClient[];
  meetings: DashboardMeeting[];
  notifications: DashboardNotification[];
}

const CHART_COLORS = ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6'];

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const normalizeProjectStatus = (value: unknown): ProjectStatus => {
  if (value === 'planning' || value === 'active' || value === 'completed' || value === 'archived') {
    return value;
  }
  return 'planning';
};

const normalizeClientStatus = (value: unknown): ClientStatus => {
  if (value === 'prospect' || value === 'active' || value === 'inactive') return value;
  return 'prospect';
};

const normalizeNotificationType = (value: unknown): NotificationType => {
  if (value === 'info' || value === 'warning' || value === 'success') return value;
  return 'info';
};

const normalizeProjects = (payload: unknown): DashboardProject[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      id: toStringValue(record.id, `project-${index}`),
      title: toStringValue(record.title, toStringValue(record.name, `Prosjekt ${index + 1}`)),
      clientName: toStringValue(record.clientName, 'Ukjent kunde'),
      status: normalizeProjectStatus(record.status),
      progress: Math.max(0, Math.min(100, toNumberValue(record.progress))),
      budgetNok: Math.max(0, toNumberValue(record.budgetNok, toNumberValue(record.totalValue))),
      updatedAt: toStringValue(record.updatedAt, toStringValue(record.lastModified, new Date().toISOString())),
      description: toStringValue(record.description),
    };
  });
};

const normalizeClients = (payload: unknown): DashboardClient[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      id: toStringValue(record.id, `client-${index}`),
      name: toStringValue(record.name, `Kunde ${index + 1}`),
      email: toStringValue(record.email, 'unknown@local.dev'),
      phone: toStringValue(record.phone),
      status: normalizeClientStatus(record.status),
      projectCount: Math.max(0, toNumberValue(record.projectCount, toNumberValue(record.projects))),
      totalValueNok: Math.max(0, toNumberValue(record.totalValueNok, toNumberValue(record.totalValue))),
      lastContactAt: toStringValue(record.lastContactAt, toStringValue(record.lastContact, new Date().toISOString())),
    };
  });
};

const normalizeMeetings = (payload: unknown): DashboardMeeting[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      id: toStringValue(record.id, `meeting-${index}`),
      title: toStringValue(record.title, `Møte ${index + 1}`),
      scheduledAt: toStringValue(record.scheduledAt, toStringValue(record.date, new Date().toISOString())),
      durationMinutes: Math.max(15, toNumberValue(record.durationMinutes, toNumberValue(record.duration, 60))),
      attendeeCount: Math.max(
        1,
        Array.isArray(record.attendees) ? record.attendees.length : toNumberValue(record.attendeeCount, 1),
      ),
    };
  });
};

const normalizeNotifications = (payload: unknown): DashboardNotification[] => {
  if (!Array.isArray(payload)) return [];

  return payload.map((item, index) => {
    const record = toRecord(item);
    return {
      id: toStringValue(record.id, `notification-${index}`),
      title: toStringValue(record.title, 'Varsel'),
      message: toStringValue(record.message, 'Ingen melding tilgjengelig'),
      type: normalizeNotificationType(record.type),
      createdAt: toStringValue(record.createdAt, new Date().toISOString()),
      read: Boolean(record.read ?? record.isRead),
    };
  });
};

const createFallbackData = (profession: Profession): DashboardData => {
  const now = new Date();
  const professionLabel = profession === 'photographer' ? 'Foto' : profession === 'videographer' ? 'Video' : 'Produksjon';

  return {
    projects: [
      {
        id: 'fallback-project-1',
        title: `${professionLabel} kampanje Q1`,
        clientName: 'Nordic Creative AS',
        status: 'active',
        progress: 63,
        budgetNok: 95000,
        updatedAt: now.toISOString(),
        description: 'Produksjon med flere leveransefaser og godkjenningsrunder.',
      },
      {
        id: 'fallback-project-2',
        title: 'Brand-film launch',
        clientName: 'Aurora Labs',
        status: 'planning',
        progress: 21,
        budgetNok: 132000,
        updatedAt: new Date(now.getTime() - 86400000).toISOString(),
        description: 'Forproduksjon og storyboard-gjennomgang.',
      },
      {
        id: 'fallback-project-3',
        title: 'Event highlight',
        clientName: 'Havn Konferanse',
        status: 'completed',
        progress: 100,
        budgetNok: 68000,
        updatedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      },
    ],
    clients: [
      {
        id: 'fallback-client-1',
        name: 'Nordic Creative AS',
        email: 'post@nordiccreative.no',
        phone: '+47 900 00 001',
        status: 'active',
        projectCount: 4,
        totalValueNok: 285000,
        lastContactAt: now.toISOString(),
      },
      {
        id: 'fallback-client-2',
        name: 'Aurora Labs',
        email: 'team@auroralabs.no',
        phone: '+47 900 00 002',
        status: 'prospect',
        projectCount: 1,
        totalValueNok: 132000,
        lastContactAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      },
    ],
    meetings: [
      {
        id: 'fallback-meeting-1',
        title: 'Kickoff med Nordic Creative',
        scheduledAt: new Date(now.getTime() + 2 * 3600000).toISOString(),
        durationMinutes: 60,
        attendeeCount: 4,
      },
      {
        id: 'fallback-meeting-2',
        title: 'Leveransegjennomgang',
        scheduledAt: new Date(now.getTime() + 24 * 3600000).toISOString(),
        durationMinutes: 45,
        attendeeCount: 3,
      },
    ],
    notifications: [
      {
        id: 'fallback-notification-1',
        title: 'Ny filversjon mottatt',
        message: 'Aurora Labs lastet opp ny storyboard-fil.',
        type: 'info',
        createdAt: now.toISOString(),
        read: false,
      },
      {
        id: 'fallback-notification-2',
        title: 'Godkjenning klar',
        message: 'Nordic Creative godkjente leveranse i prosjektet.',
        type: 'success',
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
        read: true,
      },
    ],
  };
};

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

const professionMeta: Record<Profession, { label: string; color: string; icon: React.ReactNode }> = {
  photographer: { label: 'Fotograf', color: '#f59e0b', icon: <PhotoCameraIcon fontSize="small" /> },
  videographer: { label: 'Videograf', color: '#ec4899', icon: <VideocamIcon fontSize="small" /> },
  music_producer: { label: 'Musikkprodusent', color: '#8b5cf6', icon: <WorkIcon fontSize="small" /> },
  vendor: { label: 'Leverandør', color: '#10b981', icon: <GroupIcon fontSize="small" /> },
  admin: { label: 'Admin', color: '#2563eb', icon: <SettingsIcon fontSize="small" /> },
  enterprise: { label: 'Enterprise', color: '#0ea5e9', icon: <FolderOpenIcon fontSize="small" /> },
};

const formatCurrency = (value: number): string =>
  value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  });

export default function UniversalDashboardDesktop({
  profession = 'photographer',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate,
}: UniversalDashboardDesktopProps) {
  const [tabValue, setTabValue] = useState(0);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [worklogDialogOpen, setWorklogDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<DashboardProject | null>(selectedProject ?? null);
  const [activeClient, setActiveClient] = useState<DashboardClient | null>(selectedClient ?? null);
  const [compactMode, setCompactMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [quickActions, setQuickActions] = useState(true);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newWorklogTitle, setNewWorklogTitle] = useState('');
  const [newWorklogNotes, setNewWorklogNotes] = useState('');

  const { user } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  const fallbackData = useMemo(() => createFallbackData(profession), [profession]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['universal-dashboard-desktop', profession, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return fallbackData;
      }

      const [projectsPayload, clientsPayload, meetingsPayload, notificationsPayload] = await Promise.all([
        apiRequest(`/api/projects?profession=${profession}`),
        apiRequest(`/api/clients?profession=${profession}`),
        apiRequest(`/api/meetings?profession=${profession}`),
        apiRequest(`/api/notifications?profession=${profession}`),
      ]);

      return {
        projects: normalizeProjects(projectsPayload),
        clients: normalizeClients(clientsPayload),
        meetings: normalizeMeetings(meetingsPayload),
        notifications: normalizeNotifications(notificationsPayload),
      };
    },
    retry: 1,
    staleTime: 20_000,
  });

  const dashboardData = data ?? fallbackData;

  const projectStatusData = useMemo(() => {
    const counts = dashboardData.projects.reduce(
      (acc, project) => {
        acc[project.status] += 1;
        return acc;
      },
      { planning: 0, active: 0, completed: 0, archived: 0 },
    );

    return [
      { name: 'Planning', value: counts.planning },
      { name: 'Active', value: counts.active },
      { name: 'Completed', value: counts.completed },
      { name: 'Archived', value: counts.archived },
    ];
  }, [dashboardData.projects]);

  const clientValueData = useMemo(
    () =>
      dashboardData.clients.map((client) => ({
        name: client.name.split(' ')[0],
        value: client.totalValueNok,
      })),
    [dashboardData.clients],
  );

  const unreadNotifications = useMemo(
    () => dashboardData.notifications.filter((notification) => !notification.read),
    [dashboardData.notifications],
  );

  const totals = useMemo(() => {
    const totalBudget = dashboardData.projects.reduce((sum, project) => sum + project.budgetNok, 0);
    const totalClientValue = dashboardData.clients.reduce((sum, client) => sum + client.totalValueNok, 0);
    const avgProgress =
      dashboardData.projects.length > 0
        ? Math.round(dashboardData.projects.reduce((sum, project) => sum + project.progress, 0) / dashboardData.projects.length)
        : 0;

    return {
      totalBudget,
      totalClientValue,
      avgProgress,
    };
  }, [dashboardData.clients, dashboardData.projects]);

  const handleProjectOpen = (project: DashboardProject) => {
    setActiveProject(project);
    setProjectDialogOpen(true);
    if (onProjectSelect) onProjectSelect(project);
  };

  const handleProjectSave = () => {
    if (!activeProject) return;
    if (onProjectUpdate) {
      onProjectUpdate(activeProject);
    }
    setProjectDialogOpen(false);
  };

  const handleProjectDelete = () => {
    if (!activeProject) return;
    const archivedProject: DashboardProject = {
      ...activeProject,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };
    setActiveProject(archivedProject);
    if (onProjectUpdate) onProjectUpdate(archivedProject);
    setProjectDialogOpen(false);
  };

  const handleClientSelect = (client: DashboardClient) => {
    setActiveClient(client);
    if (onClientSelect) onClientSelect(client);
  };

  const handleClientSave = () => {
    if (!activeClient) return;
    if (onClientUpdate) onClientUpdate(activeClient);
  };

  const handleCreateMeeting = () => {
    const title = newMeetingTitle.trim();
    if (!title || !newMeetingDate) return;

    const meeting: DashboardMeeting = {
      id: `meeting-${Date.now()}`,
      title,
      scheduledAt: new Date(newMeetingDate).toISOString(),
      durationMinutes: 60,
      attendeeCount: activeClient ? 2 : 1,
    };

    if (onMeetingCreate) onMeetingCreate(meeting);
    setMeetingDialogOpen(false);
    setNewMeetingTitle('');
    setNewMeetingDate('');
  };

  const handleCreateWorklog = () => {
    if (!activeProject) return;

    const title = newWorklogTitle.trim();
    const notes = newWorklogNotes.trim();
    if (!title || !notes) return;

    const worklog: DashboardWorklog = {
      id: `worklog-${Date.now()}`,
      projectId: activeProject.id,
      title,
      notes,
      createdAt: new Date().toISOString(),
    };

    if (onWorklogCreate) onWorklogCreate(worklog);
    setWorklogDialogOpen(false);
    setNewWorklogTitle('');
    setNewWorklogNotes('');
  };

  const handleSettingsSave = () => {
    if (onSettingsUpdate) {
      onSettingsUpdate({ compactMode, autoSync, quickActions });
    }
    setSettingsDialogOpen(false);
  };

  const handleUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (onFileUpload) {
      onFileUpload({
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    event.target.value = '';
  };

  const handleDownloadProjectBrief = () => {
    if (!activeProject || !onFileDownload) return;
    onFileDownload({
      name: `${activeProject.title.replace(/\s+/g, '-')}-brief.pdf`,
      source: activeProject.id,
    });
  };

  const handleCreateShowcase = () => {
    if (!activeProject || !onShowcaseCreate) return;
    onShowcaseCreate({
      projectId: activeProject.id,
      title: `${activeProject.title} Showcase`,
    });
  };

  const handleMarkNotificationsRead = () => {
    if (!onNotificationCreate) return;
    unreadNotifications.forEach((notification) => {
      onNotificationCreate({
        ...notification,
        read: true,
      });
    });
  };

  const currentProfessionMeta = professionMeta[profession];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: `${currentProfessionMeta.color}22`, color: currentProfessionMeta.color }}>
            {currentProfessionMeta.icon}
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Universal Dashboard (Desktop)
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={currentProfessionMeta.label} size="small" sx={{ backgroundColor: `${currentProfessionMeta.color}22`, color: currentProfessionMeta.color }} />
              <Chip label={user?.email ?? 'Uten bruker'} size="small" variant="outlined" />
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={<Switch checked={isDemoMode} onChange={() => void toggleDemoMode()} />}
            label="Demo mode"
          />
          <Button variant="outlined" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Oppdaterer...' : 'Oppdater'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMeetingDialogOpen(true)}>
            Nytt møte
          </Button>
          <Button variant="outlined" startIcon={<SettingsIcon />} onClick={() => setSettingsDialogOpen(true)}>
            Innstillinger
          </Button>
          {profession === 'admin' ? <AdminIndicator adminModeEnabled /> : null}
        </Stack>
      </Stack>

      {isError ? <Alert severity="warning" sx={{ mb: 2 }}>{(error as Error).message}</Alert> : null}
      {isLoading && !data ? <Alert severity="info" sx={{ mb: 2 }}>Laster dashboard-data...</Alert> : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Prosjekter</Typography>
                  <FolderOpenIcon color="primary" />
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{dashboardData.projects.length}</Typography>
                <Typography variant="caption" color="text.secondary">Gj.snitt progress {totals.avgProgress}%</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Kunder</Typography>
                  <GroupIcon color="secondary" />
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{dashboardData.clients.length}</Typography>
                <Typography variant="caption" color="text.secondary">Verdi {formatCurrency(totals.totalClientValue)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Budsjett</Typography>
                  <WorkIcon color="warning" />
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatCurrency(totals.totalBudget)}</Typography>
                <Typography variant="caption" color="text.secondary">Aktive + planlagte prosjekter</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Uleste varsler</Typography>
                  <NotificationsIcon color="error" />
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{unreadNotifications.length}</Typography>
                <Button size="small" variant="text" onClick={handleMarkNotificationsRead}>Marker som lest</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Oversikt" icon={<FolderOpenIcon />} iconPosition="start" />
          <Tab label="Prosjekter" icon={<EventIcon />} iconPosition="start" />
          <Tab label="Kunder" icon={<PersonIcon />} iconPosition="start" />
          <Tab label="Kommunikasjon" icon={<ChatIcon />} iconPosition="start" />
          <Tab label="Filer" icon={<CloudUploadIcon />} iconPosition="start" />
        </Tabs>
        <Divider />

        <CardContent>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Prosjektstatus</Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={projectStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                        {projectStatusData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Kundeverdi</Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientValueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Stack spacing={1.5}>
              {dashboardData.projects.map((project) => (
                <Card key={project.id} variant="outlined">
                  <CardContent>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{project.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {project.clientName} · Oppdatert {new Date(project.updatedAt).toLocaleDateString('nb-NO')}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={project.status} size="small" />
                          <Chip label={`${project.progress}%`} size="small" variant="outlined" />
                          <Chip label={formatCurrency(project.budgetNok)} size="small" variant="outlined" />
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Vis detaljer">
                          <IconButton onClick={() => handleProjectOpen(project)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Åpne showcase">
                          <IconButton onClick={() => {
                            setActiveProject(project);
                            handleCreateShowcase();
                          }}>
                            <PhotoCameraIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <List dense>
                  {dashboardData.clients.map((client) => (
                    <ListItem key={client.id} disablePadding>
                      <ListItemButton selected={activeClient?.id === client.id} onClick={() => handleClientSelect(client)}>
                        <ListItemAvatar>
                          <Avatar>{client.name.charAt(0).toUpperCase()}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={client.name}
                          secondary={`${client.email} · ${client.projectCount} prosjekter`}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={7}>
                {activeClient ? (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography variant="h6">{activeClient.name}</Typography>
                        <TextField
                          label="E-post"
                          value={activeClient.email}
                          onChange={(event) => setActiveClient({ ...activeClient, email: event.target.value })}
                          fullWidth
                          size="small"
                        />
                        <TextField
                          label="Telefon"
                          value={activeClient.phone ?? ''}
                          onChange={(event) => setActiveClient({ ...activeClient, phone: event.target.value })}
                          fullWidth
                          size="small"
                        />
                        <Stack direction="row" spacing={1}>
                          <Chip label={activeClient.status} size="small" />
                          <Chip label={`${activeClient.projectCount} prosjekter`} size="small" variant="outlined" />
                          <Chip label={formatCurrency(activeClient.totalValueNok)} size="small" variant="outlined" />
                        </Stack>
                        <Button variant="contained" startIcon={<EditIcon />} onClick={handleClientSave}>
                          Lagre kundeoppdatering
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert severity="info">Velg en kunde for detaljer.</Alert>
                )}
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1">Planlagte møter</Typography>
                      <Button size="small" startIcon={<CalendarTodayIcon />} onClick={() => setMeetingDialogOpen(true)}>
                        Nytt møte
                      </Button>
                    </Stack>
                    <List dense>
                      {dashboardData.meetings.map((meeting) => (
                        <ListItem key={meeting.id}>
                          <ListItemText
                            primary={meeting.title}
                            secondary={`${new Date(meeting.scheduledAt).toLocaleString('nb-NO')} · ${meeting.durationMinutes} min · ${meeting.attendeeCount} deltakere`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1">Varsler</Typography>
                      <BadgeAlertCount count={unreadNotifications.length} />
                    </Stack>
                    <List dense>
                      {dashboardData.notifications.map((notification) => (
                        <ListItem key={notification.id}>
                          <ListItemText
                            primary={notification.title}
                            secondary={`${notification.message} · ${new Date(notification.createdAt).toLocaleString('nb-NO')}`}
                          />
                          <Chip
                            label={notification.read ? 'Lest' : 'Ulest'}
                            size="small"
                            color={notification.read ? 'default' : 'primary'}
                            variant={notification.read ? 'outlined' : 'filled'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
                Last opp fil
                <input hidden type="file" onChange={handleUploadFile} />
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadProjectBrief}
                disabled={!activeProject}
              >
                Last ned prosjekt-brief
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setWorklogDialogOpen(true)}
                disabled={!activeProject}
              >
                Loggfør arbeid
              </Button>
            </Stack>
            {!activeProject ? <Alert severity="info" sx={{ mt: 2 }}>Velg et prosjekt i fanen Prosjekter for filoperasjoner.</Alert> : null}
          </TabPanel>
        </CardContent>
      </Card>

      <Dialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Prosjektdetaljer</DialogTitle>
        <DialogContent dividers>
          {activeProject ? (
            <Stack spacing={1.5}>
              <TextField
                label="Tittel"
                value={activeProject.title}
                onChange={(event) => setActiveProject({ ...activeProject, title: event.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Kunde"
                value={activeProject.clientName}
                onChange={(event) => setActiveProject({ ...activeProject, clientName: event.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Beskrivelse"
                value={activeProject.description ?? ''}
                onChange={(event) => setActiveProject({ ...activeProject, description: event.target.value })}
                fullWidth
                multiline
                minRows={3}
                size="small"
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Lukk</Button>
          <Button color="error" startIcon={<DeleteIcon />} onClick={handleProjectDelete}>Arkiver</Button>
          <Button variant="contained" startIcon={<EditIcon />} onClick={handleProjectSave}>Lagre</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={meetingDialogOpen} onClose={() => setMeetingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett møte</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <TextField
              label="Møtetittel"
              value={newMeetingTitle}
              onChange={(event) => setNewMeetingTitle(event.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Dato og tid"
              type="datetime-local"
              value={newMeetingDate}
              onChange={(event) => setNewMeetingDate(event.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeetingDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateMeeting}>Opprett</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={worklogDialogOpen} onClose={() => setWorklogDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt worklog-innslag</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <TextField
              label="Tittel"
              value={newWorklogTitle}
              onChange={(event) => setNewWorklogTitle(event.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Notater"
              value={newWorklogNotes}
              onChange={(event) => setNewWorklogNotes(event.target.value)}
              fullWidth
              multiline
              minRows={4}
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorklogDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateWorklog}>Lagre</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dashboard-innstillinger</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} />}
              label="Compact mode"
            />
            <FormControlLabel
              control={<Switch checked={autoSync} onChange={(event) => setAutoSync(event.target.checked)} />}
              label="Auto sync"
            />
            <FormControlLabel
              control={<Switch checked={quickActions} onChange={(event) => setQuickActions(event.target.checked)} />}
              label="Quick actions"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleSettingsSave}>Lagre</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function BadgeAlertCount(props: { count: number }) {
  const { count } = props;
  return (
    <Chip
      size="small"
      label={count > 0 ? `${count} ulest` : 'Ingen uleste'}
      color={count > 0 ? 'primary' : 'default'}
      icon={<NotificationsIcon fontSize="small" />}
      variant={count > 0 ? 'filled' : 'outlined'}
    />
  );
}
