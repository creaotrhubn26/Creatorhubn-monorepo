import React, { useMemo, useRef, useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
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
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday as CalendarTodayIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Home as HomeIcon,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Upload as UploadIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { useDemoMode } from '@/contexts/DemoModeContext';

export type MobileProfession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';

export interface MobileProject {
  id: string;
  name: string;
  clientName: string;
  status: 'planning' | 'active' | 'review' | 'completed';
  progress: number;
  updatedAt: string;
}

export interface MobileMeeting {
  id: string;
  title: string;
  dateTime: string;
  projectId?: string;
}

export interface MobileWorklog {
  id: string;
  projectId: string;
  task: string;
  minutes: number;
  createdAt: string;
}

export interface MobileClient {
  id: string;
  name: string;
  email?: string;
}

export interface MobileShowcase {
  id: string;
  title: string;
  projectId?: string;
  createdAt: string;
}

interface UniversalDashboardMobileProps {
  profession?: MobileProfession;
  onMeetingCreate?: (meeting: MobileMeeting) => void;
  onProjectUpdate?: (project: MobileProject) => void;
  onWorklogCreate?: (worklog: MobileWorklog) => void;
  onClientSelect?: (client: MobileClient) => void;
  onClientUpdate?: (client: MobileClient) => void;
  onShowcaseCreate?: (showcase: MobileShowcase) => void;
  onFileUpload?: (file: File) => void;
  onFileDownload?: (fileName: string) => void;
  selectedProject?: MobileProject | null;
  onProjectSelect?: (project: MobileProject) => void;
  selectedClient?: MobileClient | null;
  onSettingsUpdate?: (settings: { compactMode: boolean; snapToGrid: boolean }) => void;
  onNotificationCreate?: (notification: { id: string; title: string; message: string; createdAt: string }) => void;
}

function professionLabel(profession: MobileProfession): string {
  switch (profession) {
    case 'photographer':
      return 'Fotograf';
    case 'videographer':
      return 'Videograf';
    case 'music_producer':
      return 'Musikkprodusent';
    case 'vendor':
      return 'Leverandor';
    case 'admin':
      return 'Admin';
    case 'enterprise':
      return 'Enterprise';
    default:
      return profession;
  }
}

function normalizeProjects(raw: unknown[]): MobileProject[] {
  return raw
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const id = typeof candidate.id === 'string' ? candidate.id : `project-${index}`;
      const name =
        typeof candidate.name === 'string'
          ? candidate.name
          : typeof candidate.title === 'string'
            ? candidate.title
            : `Prosjekt ${index + 1}`;
      const clientName = typeof candidate.clientName === 'string' ? candidate.clientName : 'Ikke satt';
      const progress = typeof candidate.progress === 'number' ? Math.max(0, Math.min(100, candidate.progress)) : 0;
      const statusValue = typeof candidate.status === 'string' ? candidate.status : 'planning';
      const status: MobileProject['status'] =
        statusValue === 'active' || statusValue === 'review' || statusValue === 'completed' ? statusValue : 'planning';
      const updatedAt =
        typeof candidate.lastModified === 'string'
          ? candidate.lastModified
          : typeof candidate.updatedAt === 'string'
            ? candidate.updatedAt
            : new Date().toISOString();

      return {
        id,
        name,
        clientName,
        status,
        progress,
        updatedAt,
      };
    })
    .filter((item): item is MobileProject => item !== null);
}

export default function UniversalDashboardMobile({
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
}: UniversalDashboardMobileProps) {
  const { isDemoMode, getDemoData } = useDemoMode();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const demoProjects = useMemo(() => normalizeProjects(getDemoData<Record<string, unknown>>('projects')), [getDemoData]);
  const demoClients = useMemo(() => getDemoData<MobileClient>('clients'), [getDemoData]);

  const [activeTab, setActiveTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [localProjects, setLocalProjects] = useState<MobileProject[]>(demoProjects);
  const [localSelectedProjectId, setLocalSelectedProjectId] = useState<string | null>(selectedProject?.id ?? null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [compactMode, setCompactMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const activeProject = useMemo(() => {
    if (selectedProject) {
      return selectedProject;
    }

    return localProjects.find((project) => project.id === localSelectedProjectId) ?? null;
  }, [localProjects, localSelectedProjectId, selectedProject]);

  const unreadNotifications = useMemo(() => {
    const notifications = getDemoData<Record<string, unknown>>('notifications');
    return notifications.filter((notification) => notification.isRead === false).length;
  }, [getDemoData]);

  const createNotification = (title: string, message: string) => {
    const notification = {
      id: `notification-${Date.now()}`,
      title,
      message,
      createdAt: new Date().toISOString(),
    };

    onNotificationCreate?.(notification);
  };

  const selectProject = (project: MobileProject) => {
    setLocalSelectedProjectId(project.id);
    onProjectSelect?.(project);

    const linkedClient = demoClients.find((client) => client.name === project.clientName) ?? null;
    if (linkedClient) {
      onClientSelect?.(linkedClient);
    }
  };

  const createProject = () => {
    const trimmedName = newProjectName.trim();
    const trimmedClient = newProjectClient.trim();

    if (!trimmedName || !trimmedClient) {
      return;
    }

    const project: MobileProject = {
      id: `project-${Date.now()}`,
      name: trimmedName,
      clientName: trimmedClient,
      status: 'planning',
      progress: 0,
      updatedAt: new Date().toISOString(),
    };

    setLocalProjects((previous) => [project, ...previous]);
    setLocalSelectedProjectId(project.id);
    setProjectDialogOpen(false);
    setNewProjectName('');
    setNewProjectClient('');

    onProjectUpdate?.(project);
    onProjectSelect?.(project);
    onShowcaseCreate?.({
      id: `showcase-${project.id}`,
      title: `${project.name} Highlight`,
      projectId: project.id,
      createdAt: new Date().toISOString(),
    });

    createNotification('Prosjekt opprettet', `${project.name} er lagt til i dashboardet.`);
  };

  const deleteActiveProject = () => {
    if (!activeProject) {
      return;
    }

    setLocalProjects((previous) => previous.filter((project) => project.id !== activeProject.id));
    setLocalSelectedProjectId(null);
    createNotification('Prosjekt slettet', `${activeProject.name} ble fjernet.`);
  };

  const createMeetingForActiveProject = () => {
    if (!activeProject) {
      return;
    }

    const meeting: MobileMeeting = {
      id: `meeting-${Date.now()}`,
      title: `Gjennomgang: ${activeProject.name}`,
      dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      projectId: activeProject.id,
    };

    onMeetingCreate?.(meeting);

    onWorklogCreate?.({
      id: `worklog-${Date.now()}`,
      projectId: activeProject.id,
      task: 'Planlagt mobilt statusmote',
      minutes: 30,
      createdAt: new Date().toISOString(),
    });

    createNotification('Mote opprettet', `Mote for ${activeProject.name} er planlagt.`);
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    onFileUpload?.(file);
    createNotification('Fil lastet opp', `${file.name} er sendt til prosjektet.`);
    event.target.value = '';
  };

  const downloadProjectSnapshot = () => {
    if (!activeProject) {
      return;
    }

    const fileName = `${activeProject.name.replace(/\s+/g, '-').toLowerCase()}-snapshot.json`;
    const blob = new Blob([JSON.stringify(activeProject, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);

    onFileDownload?.(fileName);
    createNotification('Prosjekt eksportert', `${fileName} ble lastet ned.`);
  };

  const updateSettings = (nextCompactMode: boolean, nextSnapToGrid: boolean) => {
    setCompactMode(nextCompactMode);
    setSnapToGrid(nextSnapToGrid);
    onSettingsUpdate?.({ compactMode: nextCompactMode, snapToGrid: nextSnapToGrid });
  };

  const assignClientToProject = () => {
    if (!activeProject || !selectedClient) {
      return;
    }

    const updatedProject: MobileProject = {
      ...activeProject,
      clientName: selectedClient.name,
      updatedAt: new Date().toISOString(),
    };

    setLocalProjects((previous) =>
      previous.map((project) => (project.id === updatedProject.id ? updatedProject : project)),
    );

    onProjectUpdate?.(updatedProject);
    onClientUpdate?.(selectedClient);
    createNotification('Klient koblet', `${selectedClient.name} er knyttet til ${updatedProject.name}.`);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0b1220' }}>
      <AppBar position="static" sx={{ backgroundColor: '#111827' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Universal Mobile Dashboard
            </Typography>
            <Typography variant="caption" color="rgba(255,255,255,0.8)">
              {professionLabel(profession)} {isDemoMode ? '· Demo' : '· Live'}
            </Typography>
          </Box>

          <Badge color="error" badgeContent={unreadNotifications}>
            <NotificationsIcon />
          </Badge>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {activeTab === 0 && (
          <Stack spacing={1.5}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Aktive prosjekter
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                      {localProjects.filter((project) => project.status !== 'completed').length}
                    </Typography>
                  </Box>
                  <Chip label={professionLabel(profession)} color="primary" />
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => setProjectDialogOpen(true)}>
                Nytt prosjekt
              </Button>
              <Button fullWidth variant="outlined" startIcon={<CalendarTodayIcon />} onClick={createMeetingForActiveProject}>
                Mote
              </Button>
            </Stack>

            {activeProject ? (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {activeProject.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Klient: {activeProject.clientName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {activeProject.status} · {activeProject.progress}%
                  </Typography>

                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={onUploadClick}>
                      Upload
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadProjectSnapshot}>
                      Export
                    </Button>
                    <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={deleteActiveProject}>
                      Slett
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Velg et prosjekt for handlinger som upload, export og moteplanlegging.
                </Typography>
              </Paper>
            )}
          </Stack>
        )}

        {activeTab === 1 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Prosjekter
              </Typography>
              <List dense>
                {localProjects.map((project) => (
                  <ListItemButton key={project.id} selected={project.id === activeProject?.id} onClick={() => selectProject(project)}>
                    <ListItemText
                      primary={project.name}
                      secondary={`Klient: ${project.clientName} · ${project.status} · ${project.progress}%`}
                    />
                  </ListItemButton>
                ))}
              </List>

              <Divider sx={{ my: 1 }} />

              <Typography variant="caption" color="text.secondary">
                Trykk et prosjekt for a aktivere klientbinding, moteoppretting og filhandlinger.
              </Typography>
            </CardContent>
          </Card>
        )}

        {activeTab === 2 && (
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">Timeline status</Typography>
                <TimelineIcon color="primary" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Insert/overwrite, auto-bind og captions styres fra Story Arc Studio. Dette panelet viser mobil snarvei til
                tidslinjearbeid.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Button size="small" variant="contained" startIcon={<WorkIcon />} onClick={createMeetingForActiveProject}>
                  Sync mote
                </Button>
                <Button size="small" variant="outlined" onClick={assignClientToProject} disabled={!selectedClient || !activeProject}>
                  Koble klient
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {activeTab === 3 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Innstillinger
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Button
                  variant={compactMode ? 'contained' : 'outlined'}
                  onClick={() => updateSettings(!compactMode, snapToGrid)}
                >
                  Compact {compactMode ? 'Pa' : 'Av'}
                </Button>
                <Button
                  variant={snapToGrid ? 'contained' : 'outlined'}
                  onClick={() => updateSettings(compactMode, !snapToGrid)}
                >
                  Snap {snapToGrid ? 'Pa' : 'Av'}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Endringer pushes direkte til `onSettingsUpdate` for parent-layout og timeline.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      <Paper elevation={6} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <BottomNavigation value={activeTab} onChange={(_, value: number) => setActiveTab(value)}>
          <BottomNavigationAction label="Hjem" icon={<HomeIcon />} />
          <BottomNavigationAction label="Prosjekter" icon={<WorkIcon />} />
          <BottomNavigationAction label="Timeline" icon={<TimelineIcon />} />
          <BottomNavigationAction label="Innstillinger" icon={<SettingsIcon />} />
        </BottomNavigation>
      </Paper>

      <Drawer anchor="left" open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ width: 260, p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Avatar>{professionLabel(profession).charAt(0)}</Avatar>
            <Box>
              <Typography variant="subtitle2">{professionLabel(profession)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Mobil arbeidsflate
              </Typography>
            </Box>
          </Stack>

          <List>
            <ListItemButton onClick={() => setProjectDialogOpen(true)}>
              <ListItemText primary="Nytt prosjekt" />
            </ListItemButton>
            <ListItemButton onClick={onUploadClick}>
              <ListItemText primary="Last opp fil" />
            </ListItemButton>
            <ListItemButton onClick={downloadProjectSnapshot}>
              <ListItemText primary="Eksporter aktivt prosjekt" />
            </ListItemButton>
            <ListItemButton onClick={() => setActiveTab(2)}>
              <ListItemText primary="Gå til timeline" />
            </ListItemButton>
          </List>

          <Divider sx={{ my: 1 }} />

          <Tooltip title="Anerkjenner chat-workflow i full dashboard">
            <Button fullWidth startIcon={<ChatIcon />} variant="outlined" onClick={() => setMenuOpen(false)}>
              Chat workspace
            </Button>
          </Tooltip>
        </Box>
      </Drawer>

      <Dialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt prosjekt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Prosjektnavn"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
            />
            <TextField
              label="Klient"
              value={newProjectClient}
              onChange={(event) => setNewProjectClient(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Avbryt</Button>
          <Button onClick={createProject} variant="contained" disabled={newProjectName.trim().length === 0 || newProjectClient.trim().length === 0}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onFileSelected}
        aria-label="Upload project file"
      />
    </Box>
  );
}
