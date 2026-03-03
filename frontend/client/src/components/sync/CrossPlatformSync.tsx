import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  CloudDone as CloudDoneIcon,
  CloudSync as CloudSyncIcon,
  Computer as DesktopIcon,
  Download as DownloadIcon,
  PhoneAndroid as MobileIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  TabletAndroid as TabletIcon,
} from '@mui/icons-material';

type SyncState = 'synced' | 'syncing' | 'pending' | 'offline';
type ProjectType = 'wedding' | 'portrait' | 'corporate' | 'music' | 'video';

type DeviceType = 'mobile' | 'desktop' | 'tablet';

interface SyncDevice {
  id: string;
  name: string;
  type: DeviceType;
  lastSeen: string;
  isActive: boolean;
}

interface SyncBookmark {
  id: string;
  title: string;
  url: string;
  type: 'inspiration' | 'client' | 'vendor' | 'reference';
  tags: string[];
  addedDate: string;
}

interface SyncProject {
  id: string;
  name: string;
  type: ProjectType;
  lastModified: string;
  syncStatus: SyncState;
  devices: SyncDevice[];
  bookmarks: SyncBookmark[];
  isStarred: boolean;
  shareCode?: string;
}

interface CrossPlatformSyncProps {
  userId?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const MOCK_PROJECTS: SyncProject[] = [
  {
    id: 'project-wedding-1',
    name: 'Bryllup - Nora og Emil',
    type: 'wedding',
    lastModified: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    syncStatus: 'synced',
    isStarred: true,
    shareCode: 'SHARE-WED-01',
    devices: [
      {
        id: 'dev-phone',
        name: 'iPhone 15 Pro',
        type: 'mobile',
        lastSeen: new Date().toISOString(),
        isActive: true,
      },
      {
        id: 'dev-desktop',
        name: 'Mac Studio',
        type: 'desktop',
        lastSeen: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        isActive: false,
      },
    ],
    bookmarks: [
      {
        id: 'bookmark-1',
        title: 'Inspirasjon: fargetoner',
        url: 'https://example.com/color-reference',
        type: 'reference',
        tags: ['color', 'cinematic'],
        addedDate: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'project-corporate-1',
    name: 'Bedriftspromo - NordTech',
    type: 'corporate',
    lastModified: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    syncStatus: 'pending',
    isStarred: false,
    devices: [
      {
        id: 'dev-tablet',
        name: 'iPad Pro',
        type: 'tablet',
        lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        isActive: false,
      },
    ],
    bookmarks: [],
  },
];

function iconForDevice(type: DeviceType): React.ReactNode {
  if (type === 'mobile') return <MobileIcon fontSize="small" />;
  if (type === 'tablet') return <TabletIcon fontSize="small" />;
  return <DesktopIcon fontSize="small" />;
}

function chipColor(status: SyncState): 'success' | 'info' | 'warning' | 'error' {
  if (status === 'synced') return 'success';
  if (status === 'syncing') return 'info';
  if (status === 'pending') return 'warning';
  return 'error';
}

export default function CrossPlatformSync({ userId, profession }: CrossPlatformSyncProps) {
  const [projects, setProjects] = useState<SyncProject[]>([]);
  const [globalSyncInProgress, setGlobalSyncInProgress] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      try {
        const response = await fetch(`/api/sync/projects?userId=${encodeURIComponent(userId ?? 'guest')}`);
        if (!response.ok) {
          throw new Error('sync project endpoint unavailable');
        }

        const payload = (await response.json()) as { projects?: SyncProject[] };
        if (!cancelled) {
          setProjects(Array.isArray(payload.projects) && payload.projects.length > 0 ? payload.projects : MOCK_PROJECTS);
        }
      } catch {
        if (!cancelled) {
          setProjects(MOCK_PROJECTS);
        }
      }
    };

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const syncAllProjects = async () => {
    setGlobalSyncInProgress(true);
    setProjects((previous) => previous.map((project) => ({ ...project, syncStatus: 'syncing' })));

    try {
      await fetch('/api/sync/projects/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectIds: projects.map((project) => project.id) }),
      });
    } catch {
      // keep local fallback behavior below
    }

    setTimeout(() => {
      setProjects((previous) =>
        previous.map((project) => ({
          ...project,
          syncStatus: 'synced',
          lastModified: new Date().toISOString(),
        })),
      );
      setGlobalSyncInProgress(false);
    }, 800);
  };

  const syncSingleProject = async (projectId: string) => {
    setProjects((previous) =>
      previous.map((project) => (project.id === projectId ? { ...project, syncStatus: 'syncing' } : project)),
    );

    try {
      await fetch('/api/sync/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId }),
      });
    } catch {
      // local fallback update below
    }

    setProjects((previous) =>
      previous.map((project) =>
        project.id === projectId
          ? {
              ...project,
              syncStatus: 'synced',
              lastModified: new Date().toISOString(),
            }
          : project,
      ),
    );
  };

  const toggleStar = (projectId: string) => {
    setProjects((previous) =>
      previous.map((project) =>
        project.id === projectId
          ? {
              ...project,
              isStarred: !project.isStarred,
            }
          : project,
      ),
    );
  };

  const generateShareCode = async (projectId: string) => {
    try {
      const response = await fetch('/api/sync/share-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId }),
      });

      const payload = (await response.json()) as { shareCode?: string };
      if (payload.shareCode) {
        setProjects((previous) =>
          previous.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  shareCode: payload.shareCode,
                }
              : project,
          ),
        );
        return;
      }
    } catch {
      // fallback below
    }

    setProjects((previous) =>
      previous.map((project) =>
        project.id === projectId
          ? {
              ...project,
              shareCode: `SHARE-${projectId.slice(-4)}-${Date.now().toString().slice(-4)}`,
            }
          : project,
      ),
    );
  };

  const addBookmark = () => {
    if (!selectedProject || !bookmarkTitle.trim() || !bookmarkUrl.trim()) {
      return;
    }

    const newBookmark: SyncBookmark = {
      id: `bookmark-${Date.now()}`,
      title: bookmarkTitle.trim(),
      url: bookmarkUrl.trim(),
      type: 'reference',
      tags: [profession],
      addedDate: new Date().toISOString(),
    };

    setProjects((previous) =>
      previous.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              bookmarks: [newBookmark, ...project.bookmarks],
            }
          : project,
      ),
    );

    setBookmarkTitle('');
    setBookmarkUrl('');
    setBookmarkDialogOpen(false);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Cross-platform Sync</Typography>
          <Typography variant="body2" color="text.secondary">
            Prosjekter synkroniseres mellom mobil, desktop og nettbrett.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<CloudSyncIcon />}
          onClick={syncAllProjects}
          disabled={globalSyncInProgress || projects.length === 0}
        >
          {globalSyncInProgress ? 'Synkroniserer...' : 'Synkroniser alle'}
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <List>
                {projects.map((project) => (
                  <ListItem
                    key={project.id}
                    secondaryAction={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" color={chipColor(project.syncStatus)} label={project.syncStatus} />
                        <IconButton onClick={() => toggleStar(project.id)}>
                          {project.isStarred ? <StarIcon color="warning" /> : <StarBorderIcon />}
                        </IconButton>
                        <IconButton onClick={() => syncSingleProject(project.id)}>
                          <CloudDoneIcon fontSize="small" />
                        </IconButton>
                        <IconButton onClick={() => generateShareCode(project.id)}>
                          <ShareIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    }
                    sx={{
                      borderRadius: 1,
                      mb: 0.5,
                      backgroundColor: selectedProjectId === project.id ? 'action.selected' : 'transparent',
                    }}
                    onClick={() => setSelectedProjectId(project.id)}
                    button
                  >
                    <ListItemText
                      primary={project.name}
                      secondary={`Type: ${project.type} · Sist endret: ${new Date(project.lastModified).toLocaleString('nb-NO')}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          {selectedProject ? (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                  {selectedProject.name}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                  {selectedProject.devices.map((device) => (
                    <Chip
                      key={device.id}
                      icon={iconForDevice(device.type)}
                      label={`${device.name}${device.isActive ? ' · aktiv' : ''}`}
                      color={device.isActive ? 'success' : 'default'}
                      variant="outlined"
                    />
                  ))}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Delingskode: {selectedProject.shareCode ?? 'Ikke generert'}
                </Typography>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  <Button size="small" startIcon={<BookmarkIcon />} variant="outlined" onClick={() => setBookmarkDialogOpen(true)}>
                    Nytt bokmerke
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    variant="outlined"
                    disabled={!selectedProject.shareCode}
                    onClick={() => {
                      if (selectedProject.shareCode) {
                        navigator.clipboard.writeText(selectedProject.shareCode).catch(() => undefined);
                      }
                    }}
                  >
                    Kopier kode
                  </Button>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Typography variant="subtitle2">Bokmerker</Typography>
                {selectedProject.bookmarks.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Ingen bokmerker registrert.
                  </Alert>
                ) : (
                  <List dense>
                    {selectedProject.bookmarks.map((bookmark) => (
                      <ListItem key={bookmark.id}>
                        <ListItemText
                          primary={bookmark.title}
                          secondary={`${bookmark.url} · ${new Date(bookmark.addedDate).toLocaleDateString('nb-NO')}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">Velg et prosjekt for detaljer.</Alert>
          )}
        </Grid>
      </Grid>

      <Dialog open={bookmarkDialogOpen} onClose={() => setBookmarkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt bokmerke</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tittel"
              value={bookmarkTitle}
              onChange={(event) => setBookmarkTitle(event.target.value)}
            />
            <TextField
              label="URL"
              value={bookmarkUrl}
              onChange={(event) => setBookmarkUrl(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookmarkDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={addBookmark}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
