// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import {
  Album,
  Collections,
  ContentCopy,
  Add as AddIcon,
  Edit,
  Folder,
  GridView,
  Launch,
  Link,
  Lock,
  MoreVert,
  PersonAdd,
  PhotoCamera,
  Public,
  Share,
  Sort,
  Upload,
  ViewList,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

interface GooglePhoto {
  id: string;
  filename: string;
  baseUrl: string;
  mimeType: string;
  creationTime?: string;
  width?: string;
  height?: string;
  productUrl: string;
}

interface GooglePhotosAlbum {
  id: string;
  title: string;
  mediaItemsCount: string;
  coverPhotoBaseUrl?: string;
  description?: string;
  profession?: string;
  projectId?: string;
  productUrl: string;
  isWriteable: boolean;
  createdAt?: string;
  updatedAt?: string;
  shareInfo?: {
    shareToken: string;
    shareableUrl: string;
    isOwned: boolean;
    isJoined: boolean;
  };
}

interface ProjectSummary {
  id: string;
  name: string;
}

interface ShowcasePortfolio {
  id: string;
  name: string;
}

interface GooglePhotosConnectionStatus {
  success: boolean;
  authenticated: boolean;
  message: string;
}

interface GooglePhotosIntegrationProps {
  profession: string;
  userId: string;
  projectId?: string;
}

interface AlbumFormData {
  title: string;
  description: string;
  projectId: string;
  isCollaborative: boolean;
  isCommentable: boolean;
  autoShare: boolean;
}

const defaultConnectionStatus: GooglePhotosConnectionStatus = {
  success: false,
  authenticated: false,
  message: 'Ikke tilkoblet',
};

const GooglePhotosIntegration: React.FC<GooglePhotosIntegrationProps> = ({ profession, userId, projectId }) => {
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState(0);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [shareAlbumOpen, setShareAlbumOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<GooglePhotosAlbum | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'shared' | 'writeable' | 'readonly'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'count'>('date');
  const [albumMenuAnchor, setAlbumMenuAnchor] = useState<HTMLElement | null>(null);
  const [albumMenuTarget, setAlbumMenuTarget] = useState<GooglePhotosAlbum | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shareOptions, setShareOptions] = useState({
    isCollaborative: true,
    isCommentable: true,
  });

  const [albumFormData, setAlbumFormData] = useState<AlbumFormData>({
    title: '',
    description: '',
    projectId: projectId ?? '',
    isCollaborative: false,
    isCommentable: true,
    autoShare: true,
  });

  const { data: albumsData, isLoading: albumsLoading } = useQuery<GooglePhotosAlbum[]>({
    queryKey: ['/api/google-photos/albums', userId],
    queryFn: async () => {
      const response = (await apiRequest('/api/google-photos/albums')) as {
        albums?: GooglePhotosAlbum[];
      };
      return Array.isArray(response.albums) ? response.albums : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const albums = albumsData ?? [];

  const { data: albumPhotosData, isLoading: photosLoading } = useQuery<GooglePhoto[]>({
    queryKey: ['/api/google-photos/album-photos', selectedAlbum?.id],
    queryFn: async () => {
      if (!selectedAlbum) {
        return [];
      }
      const response = (await apiRequest(`/api/google-photos/albums/${selectedAlbum.id}/photos`)) as {
        photos?: GooglePhoto[];
      };
      return Array.isArray(response.photos) ? response.photos : [];
    },
    enabled: Boolean(selectedAlbum),
    staleTime: 2 * 60 * 1000,
  });

  const albumPhotos = albumPhotosData ?? [];

  const { data: projectsData } = useQuery<ProjectSummary[]>({
    queryKey: ['/api/projects', profession],
    queryFn: async () => {
      const response = (await apiRequest(`/api/projects?profession=${encodeURIComponent(profession)}`)) as
        | {
        projects?: ProjectSummary[];
      }
        | ProjectSummary[];
      return Array.isArray(response)
        ? response
        : (Array.isArray(response.projects) ? response.projects : []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const projects = projectsData ?? [];

  const { data: showcasePortfoliosData } = useQuery<ShowcasePortfolio[]>({
    queryKey: ['/api/showcase/portfolios', profession, userId],
    queryFn: async () => {
      const response = (await apiRequest(`/api/showcase/portfolios?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(userId)}`)) as {
        portfolios?: ShowcasePortfolio[];
      };
      return Array.isArray(response.portfolios) ? response.portfolios : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const showcasePortfolios = showcasePortfoliosData ?? [];

  const { data: connectionStatus = defaultConnectionStatus } = useQuery<GooglePhotosConnectionStatus>({
    queryKey: ['/api/google-photos/test-connection', userId],
    queryFn: async () => {
      const response = (await apiRequest('/api/google-photos/test-connection')) as GooglePhotosConnectionStatus;
      return response;
    },
    staleTime: 30 * 1000,
  });

  const shareAlbumMutation = useMutation({
    mutationFn: async (payload: { albumId: string; options: { isCollaborative: boolean; isCommentable: boolean } }) => {
      return (await apiRequest(`/api/google-photos/albums/${payload.albumId}/share`, {
        method: 'POST',
        body: payload.options,
      })) as { album?: GooglePhotosAlbum };
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/google-photos/albums'] });
      if (response.album) {
        setSelectedAlbum(response.album);
      }
      setShareAlbumOpen(false);
      closeAlbumMenu();
    },
  });

  const createAlbumMutation = useMutation({
    mutationFn: async (payload: AlbumFormData & { profession: string }) => {
      return (await apiRequest('/api/google-photos/albums/create', {
        method: 'POST',
        body: payload,
      })) as { album?: GooglePhotosAlbum };
    },
    onSuccess: async (response, payload) => {
      if (response.album) {
        setSelectedAlbum(response.album);
        if (payload.autoShare) {
          await shareAlbumMutation.mutateAsync({
            albumId: response.album.id,
            options: {
              isCollaborative: payload.isCollaborative,
              isCommentable: payload.isCommentable,
            },
          });
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['/api/google-photos/albums'] });
      setCreateAlbumOpen(false);
      resetAlbumForm();
    },
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      return await apiRequest('/api/google-photos/upload', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/google-photos/album-photos'] });
    },
  });

  const resetAlbumForm = () => {
    setAlbumFormData({
      title: '',
      description: '',
      projectId: projectId ?? '',
      isCollaborative: false,
      isCommentable: true,
      autoShare: true,
    });
  };

  const handleCreateAlbum = () => {
    const selectedProject = projects.find((project) => project.id === albumFormData.projectId);
    const title =
      albumFormData.title || `${selectedProject?.name ?? 'Prosjekt'} - ${new Date().toLocaleDateString('nb-NO')}`;

    createAlbumMutation.mutate({
      ...albumFormData,
      profession,
      title,
    });
  };

  const handleShareAlbum = (album: GooglePhotosAlbum, options: { isCollaborative: boolean; isCommentable: boolean }) => {
    shareAlbumMutation.mutate({
      albumId: album.id,
      options,
    });
  };

  const handleUploadPhotos = (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('photos', file);
    });

    if (selectedAlbum) {
      formData.append('albumId', selectedAlbum.id);
    }

    uploadPhotosMutation.mutate(formData);
  };

  const copyShareLink = (shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl).catch((error: unknown) => {
      console.warn('Could not copy share link:', error);
    });
  };

  const openInGooglePhotos = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const closeAlbumMenu = () => {
    setAlbumMenuAnchor(null);
    setAlbumMenuTarget(null);
  };

  const openAlbumMenu = (event: React.MouseEvent<HTMLElement>, album: GooglePhotosAlbum) => {
    event.stopPropagation();
    setAlbumMenuAnchor(event.currentTarget);
    setAlbumMenuTarget(album);
  };

  const openAlbumViewer = (album: GooglePhotosAlbum) => {
    setSelectedAlbum(album);
    setSelectedTab(1);
    closeAlbumMenu();
  };

  const openShareDialog = (album: GooglePhotosAlbum) => {
    setSelectedAlbum(album);
    setShareOptions({
      isCollaborative: album.shareInfo?.isJoined ?? true,
      isCommentable: true,
    });
    setShareAlbumOpen(true);
    closeAlbumMenu();
  };

  const generateAlbumName = (selectedProjectId: string) => {
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (!selectedProject) {
      return '';
    }

    const date = new Date().toLocaleDateString('nb-NO');
    return `${selectedProject.name} - ${date}`;
  };

  const filteredAlbums = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const byFilter = albums.filter((album) => {
      switch (filterType) {
        case 'shared':
          return Boolean(album.shareInfo);
        case 'writeable':
          return album.isWriteable;
        case 'readonly':
          return !album.isWriteable;
        default:
          return true;
      }
    });

    const bySearch = byFilter.filter((album) => {
      if (query.length === 0) {
        return true;
      }
      return album.title.toLowerCase().includes(query);
    });

    return [...bySearch].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'count':
          return Number.parseInt(b.mediaItemsCount, 10) - Number.parseInt(a.mediaItemsCount, 10);
        case 'date':
        default:
          return new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      }
    });
  }, [albums, filterType, searchTerm, sortBy]);

  const selectedAlbumPhotos = selectedAlbum ? albumPhotos : [];
  const sharedAlbumsCount = filteredAlbums.filter((album) => Boolean(album.shareInfo)).length;
  const writeableAlbumsCount = filteredAlbums.filter((album) => album.isWriteable).length;

  return (
    <Box>
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhotoCamera /> Google Photos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Album, deling og mediebibliotek for prosjektarbeidsflyt.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {connectionStatus.message}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={connectionStatus.authenticated ? 'success' : 'warning'}
                icon={connectionStatus.authenticated ? <Public /> : <Lock />}
                label={connectionStatus.authenticated ? 'Tilkoblet' : 'Frakoblet'}
                size="small"
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateAlbumOpen(true)}
                sx={{ bgcolor: '#34A853', '&:hover': { bgcolor: '#2D8F47' } }}
              >
                Opprett album
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onChange={(_, value: number) => setSelectedTab(value)} sx={{ mb: 2 }}>
        <Tab label={`Album (${albums.length})`} icon={<Album />} iconPosition="start" />
        <Tab label={`Bilder (${selectedAlbumPhotos.length})`} icon={<Collections />} iconPosition="start" />
        <Tab label="Integrasjon" icon={<Folder />} iconPosition="start" />
      </Tabs>

      {selectedTab === 0 ? (
        <Stack spacing={2}>
          <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap">
                <Chip
                  icon={
                    <Badge badgeContent={filteredAlbums.length} color="primary">
                      <Album fontSize="small" />
                    </Badge>
                  }
                  label={`${filteredAlbums.length} album`}
                  variant="outlined"
                />
                <Chip
                  icon={
                    <Badge badgeContent={sharedAlbumsCount} color="primary">
                      <Link fontSize="small" />
                    </Badge>
                  }
                  label={`${sharedAlbumsCount} delte`}
                  variant="outlined"
                />
                <Chip
                  icon={
                    <Badge badgeContent={writeableAlbumsCount} color="secondary">
                      <PersonAdd fontSize="small" />
                    </Badge>
                  }
                  label={`${writeableAlbumsCount} redigerbare`}
                  variant="outlined"
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Sok album"
                  fullWidth
                  size="small"
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="filter-label">Filter</InputLabel>
                  <Select
                    labelId="filter-label"
                    value={filterType}
                    label="Filter"
                    onChange={(event) => setFilterType(event.target.value as typeof filterType)}
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="shared">Delte</MenuItem>
                    <MenuItem value="writeable">Redigerbare</MenuItem>
                    <MenuItem value="readonly">Read-only</MenuItem>
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Sort color="action" fontSize="small" />
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="sort-label">Sorter</InputLabel>
                    <Select
                      labelId="sort-label"
                      value={sortBy}
                      label="Sorter"
                      onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                    >
                      <MenuItem value="date">Dato</MenuItem>
                      <MenuItem value="name">Navn</MenuItem>
                      <MenuItem value="count">Antall</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Tooltip title="Visningsmodus">
                  <IconButton onClick={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}>
                    {viewMode === 'grid' ? <ViewList /> : <GridView />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>

          {albumsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {filteredAlbums.map((album) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={album.id}>
                  <Card
                    sx={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' }, ...theming.getThemedCardSx() }}
                    onClick={() => {
                      setSelectedAlbum(album);
                      setSelectedTab(1);
                    }}
                  >
                    <Box
                      sx={{
                        height: 180,
                        position: 'relative',
                        background: album.coverPhotoBaseUrl
                          ? `url(${album.coverPhotoBaseUrl}) center/cover`
                          : 'linear-gradient(45deg, #f0f0f0 30%, #e0e0e0 90%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!album.coverPhotoBaseUrl ? <Collections sx={{ fontSize: 48, color: 'text.disabled' }} /> : null}
                      <IconButton
                        size="small"
                        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)' }}
                        onClick={(event) => openAlbumMenu(event, album)}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Box>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                        {album.title}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Chip size="small" label={`${album.mediaItemsCount} bilder`} icon={<Collections />} />
                        {album.shareInfo ? <Chip size="small" label="Delt" icon={<Share />} color="primary" /> : null}
                        {album.isWriteable ? <Chip size="small" label="Redigerbar" icon={<Edit />} color="secondary" /> : null}
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          startIcon={<Launch />}
                          onClick={(event) => {
                            event.stopPropagation();
                            openInGooglePhotos(album.productUrl);
                          }}
                        >
                          Apne
                        </Button>
                        {album.shareInfo ? (
                          <Button
                            size="small"
                            startIcon={<ContentCopy />}
                            onClick={(event) => {
                              event.stopPropagation();
                              copyShareLink(album.shareInfo!.shareableUrl);
                            }}
                          >
                            Kopier lenke
                          </Button>
                        ) : null}
                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            openShareDialog(album);
                          }}
                        >
                          <Share />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card sx={theming.getThemedCardSx()}>
              <List>
                {filteredAlbums.map((album) => (
                  <ListItem
                    key={album.id}
                    secondaryAction={
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            openShareDialog(album);
                          }}
                        >
                          <Share />
                        </IconButton>
                        <IconButton size="small" onClick={() => openInGooglePhotos(album.productUrl)}>
                          <Launch />
                        </IconButton>
                        <IconButton size="small" onClick={(event) => openAlbumMenu(event, album)}>
                          <MoreVert />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={album.coverPhotoBaseUrl}>
                        <Collections />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={album.title} secondary={`${album.mediaItemsCount} bilder`} />
                  </ListItem>
                ))}
              </List>
            </Card>
          )}

          <Menu anchorEl={albumMenuAnchor} open={Boolean(albumMenuAnchor && albumMenuTarget)} onClose={closeAlbumMenu}>
            <MenuItem
              onClick={() => {
                if (albumMenuTarget) {
                  openAlbumViewer(albumMenuTarget);
                }
              }}
            >
              <ListItemIcon>
                <Collections fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Vis bilder" />
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (albumMenuTarget) {
                  openInGooglePhotos(albumMenuTarget.productUrl);
                  closeAlbumMenu();
                }
              }}
            >
              <ListItemIcon>
                <Launch fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Apne i Google Photos" />
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (albumMenuTarget?.shareInfo?.shareableUrl) {
                  copyShareLink(albumMenuTarget.shareInfo.shareableUrl);
                  closeAlbumMenu();
                } else if (albumMenuTarget) {
                  openShareDialog(albumMenuTarget);
                }
              }}
            >
              <ListItemIcon>
                <Link fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={albumMenuTarget?.shareInfo ? 'Kopier delingslenke' : 'Klargjor delingslenke'} />
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (albumMenuTarget) {
                  openShareDialog(albumMenuTarget);
                }
              }}
            >
              <ListItemIcon>
                <PersonAdd fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Del med team" />
            </MenuItem>
          </Menu>
        </Stack>
      ) : null}

      {selectedTab === 1 ? (
        <Stack spacing={2}>
          {!selectedAlbum ? (
            <Alert severity="info">Velg et album fra Album-fanen for a se bilder.</Alert>
          ) : (
            <>
              <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {selectedAlbum.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedAlbum.mediaItemsCount} bilder
                    </Typography>
                  </Box>
                  <Button component="label" variant="outlined" startIcon={<Upload />}>
                    Last opp bilder
                    <input
                      hidden
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(event) => {
                        if (event.target.files && event.target.files.length > 0) {
                          handleUploadPhotos(event.target.files);
                        }
                      }}
                    />
                  </Button>
                </Stack>
              </Paper>

              {photosLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <ImageList cols={4} gap={12}>
                  {selectedAlbumPhotos.map((photo) => (
                    <ImageListItem key={photo.id}>
                      <img src={`${photo.baseUrl}=w300-h300-c`} alt={photo.filename} loading="lazy" />
                      <ImageListItemBar
                        title={photo.filename}
                        subtitle={photo.creationTime ? new Date(photo.creationTime).toLocaleDateString('nb-NO') : ''}
                        actionIcon={
                          <IconButton color="inherit" onClick={() => openInGooglePhotos(photo.productUrl)}>
                            <Launch />
                          </IconButton>
                        }
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              )}
            </>
          )}
        </Stack>
      ) : null}

      {selectedTab === 2 ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Folder sx={{ fontSize: 16 }} /> Prosjektintegrasjon
                </Typography>
                <Stack spacing={1}>
                  {projects.slice(0, 5).map((project) => (
                    <Button
                      key={project.id}
                      size="small"
                      variant="text"
                      onClick={() => {
                        setAlbumFormData((prev) => ({ ...prev, projectId: project.id, title: generateAlbumName(project.id) }));
                        setCreateAlbumOpen(true);
                      }}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {project.name}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Collections sx={{ fontSize: 16 }} /> Portfolio integration
                </Typography>
                <Stack spacing={1}>
                  {showcasePortfolios.slice(0, 5).map((portfolio) => (
                    <Button
                      key={portfolio.id}
                      size="small"
                      variant="text"
                      onClick={() => window.open(`/showcase/${portfolio.id}`, '_blank', 'noopener,noreferrer')}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {portfolio.name}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      <Dialog open={createAlbumOpen} onClose={() => setCreateAlbumOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett album</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Albumnavn"
              value={albumFormData.title}
              onChange={(event) => setAlbumFormData((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={albumFormData.description}
              onChange={(event) => setAlbumFormData((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel id="project-select-label">Prosjekt</InputLabel>
              <Select
                labelId="project-select-label"
                label="Prosjekt"
                value={albumFormData.projectId}
                onChange={(event) => setAlbumFormData((prev) => ({ ...prev, projectId: event.target.value }))}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={albumFormData.isCollaborative}
                  onChange={(event) => setAlbumFormData((prev) => ({ ...prev, isCollaborative: event.target.checked }))}
                />
              }
              label="Samarbeidsalbum"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={albumFormData.isCommentable}
                  onChange={(event) => setAlbumFormData((prev) => ({ ...prev, isCommentable: event.target.checked }))}
                />
              }
              label="Tillat kommentarer"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={albumFormData.autoShare}
                  onChange={(event) => setAlbumFormData((prev) => ({ ...prev, autoShare: event.target.checked }))}
                />
              }
              label="Auto-del med team"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateAlbumOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateAlbum} disabled={createAlbumMutation.isPending}>
            {createAlbumMutation.isPending ? 'Oppretter...' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareAlbumOpen} onClose={() => setShareAlbumOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del album</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">{selectedAlbum?.title ?? 'Ingen album valgt'}</Typography>
            {selectedAlbum?.shareInfo?.shareableUrl ? (
              <TextField
                label="Delingslenke"
                value={selectedAlbum.shareInfo.shareableUrl}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={shareOptions.isCollaborative}
                  onChange={(event) => setShareOptions((prev) => ({ ...prev, isCollaborative: event.target.checked }))}
                />
              }
              label="Tillat samarbeidspartnere"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={shareOptions.isCommentable}
                  onChange={(event) => setShareOptions((prev) => ({ ...prev, isCommentable: event.target.checked }))}
                />
              }
              label="Tillat kommentarer"
            />
            <Button
              variant="outlined"
              startIcon={<Link />}
              onClick={() => {
                if (selectedAlbum?.shareInfo?.shareableUrl) {
                  copyShareLink(selectedAlbum.shareInfo.shareableUrl);
                }
              }}
              disabled={!selectedAlbum?.shareInfo?.shareableUrl}
            >
              Kopier delingslenke
            </Button>
            <Button
              variant="contained"
              startIcon={selectedAlbum?.shareInfo?.shareableUrl ? <Share /> : <PersonAdd />}
              onClick={() => {
                if (selectedAlbum) {
                  handleShareAlbum(selectedAlbum, shareOptions);
                }
              }}
              disabled={shareAlbumMutation.isPending || !selectedAlbum}
            >
              {shareAlbumMutation.isPending ? 'Deler...' : selectedAlbum?.shareInfo?.shareableUrl ? 'Oppdater deling' : 'Aktiver deling'}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareAlbumOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 30,
          bgcolor: '#34A850',
          '&:hover': { bgcolor: '#2D8A47' },
        }}
        onClick={() => setCreateAlbumOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default GooglePhotosIntegration;
