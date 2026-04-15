// @ts-nocheck
import React, { useMemo, useState } from 'react';
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
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Snackbar,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  Campaign as CampaignIcon,
  CheckCircle as CheckCircleIcon,
  Comment as CommentIcon,
  Create as CreateIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Error as ErrorIcon,
  Facebook as FacebookIcon,
  Image as ImageIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

type Platform = 'instagram' | 'linkedin' | 'facebook' | 'tiktok';
type PostStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

interface SocialMediaAccount {
  platform: Platform;
  isConnected: boolean;
  username?: string;
  lastSyncAt?: string;
}

interface SocialMediaPost {
  id: string;
  content: string;
  platform: Platform;
  status: PostStatus;
  postedAt?: string;
  scheduledTime?: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
}

interface CreatePostPayload {
  content: string;
  platforms: Platform[];
  scheduledTime?: string;
  postNow: boolean;
}

interface CreatePostForm {
  content: string;
  platforms: Platform[];
  scheduledTime: string;
  postNow: boolean;
}

const initialCreatePostForm: CreatePostForm = {
  content: '',
  platforms: [],
  scheduledTime: '',
  postNow: true,
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function platformName(platform: Platform): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'linkedin':
      return 'LinkedIn';
    case 'facebook':
      return 'Facebook';
    case 'tiktok':
      return 'TikTok';
    default:
      return platform;
  }
}

function postStatusChip(status: PostStatus): { label: string; color: ChipProps['color']; icon: React.ReactNode } {
  switch (status) {
    case 'posted':
      return { label: 'Publisert', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
    case 'scheduled':
      return { label: 'Planlagt', color: 'info', icon: <ScheduleIcon fontSize="small" /> };
    case 'failed':
      return { label: 'Feilet', color: 'error', icon: <ErrorIcon fontSize="small" /> };
    case 'draft':
    default:
      return { label: 'Utkast', color: 'default', icon: <EditIcon fontSize="small" /> };
  }
}

function platformIcon(platform: Platform): React.ReactNode {
  switch (platform) {
    case 'instagram':
      return <InstagramIcon sx={{ color: '#E4405F' }} />;
    case 'linkedin':
      return <LinkedInIcon sx={{ color: '#0077B5' }} />;
    case 'facebook':
      return <FacebookIcon sx={{ color: '#1877F2' }} />;
    case 'tiktok':
      return <CampaignIcon sx={{ color: '#111111' }} />;
    default:
      return <ShareIcon />;
  }
}

export default function SocialMediaManager(): JSX.Element {
  const theming = useTheming('photographer');
  const { user } = useAuth();
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  const [shareText, setShareText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [createPostForm, setCreatePostForm] = useState<CreatePostForm>(initialCreatePostForm);
  const [status, setStatus] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const accountsQuery = useQuery({
    queryKey: ['/api/social-media/accounts', user?.id],
    queryFn: async (): Promise<SocialMediaAccount[]> => {
      const data = await apiRequest(`/api/social-media/accounts/${user?.id}`);
      return safeArray<SocialMediaAccount>(data);
    },
    enabled: Boolean(user?.id),
  });

  const postsQuery = useQuery({
    queryKey: ['/api/social-media/posts', user?.id],
    queryFn: async (): Promise<SocialMediaPost[]> => {
      const data = await apiRequest(`/api/social-media/posts/${user?.id}`);
      return safeArray<SocialMediaPost>(data);
    },
    enabled: Boolean(user?.id),
  });

  const portfolioQuery = useQuery({
    queryKey: ['/api/portfolio/items', user?.id],
    queryFn: async (): Promise<PortfolioItem[]> => {
      const data = await apiRequest(`/api/portfolio/items/${user?.id}`);
      return safeArray<PortfolioItem>(data);
    },
    enabled: Boolean(user?.id),
  });

  const connectAccount = useMutation({
    mutationFn: async (platform: Platform): Promise<void> => {
      await apiRequest(`/api/social-media/accounts/${platform}/connect`, {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/social-media/accounts', user?.id] });
      setStatus({ open: true, message: 'Konto tilkoblet', severity: 'success' });
    },
  });

  const createPost = useMutation({
    mutationFn: async (payload: CreatePostPayload): Promise<void> => {
      await apiRequest('/api/social-media/posts', {
        method: 'POST',
        body: JSON.stringify({ ...payload, userId: user?.id }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id] });
      setCreateDialogOpen(false);
      setCreatePostForm(initialCreatePostForm);
      setStatus({ open: true, message: 'Post opprettet', severity: 'success' });
    },
    onError: () => {
      setStatus({ open: true, message: 'Kunne ikke opprette post', severity: 'error' });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string): Promise<void> => {
      await apiRequest(`/api/social-media/posts/${postId}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id] });
      setStatus({ open: true, message: 'Post slettet', severity: 'success' });
    },
  });

  const sharePortfolio = useMutation({
    mutationFn: async (payload: { itemId: string; platforms: Platform[]; content: string; scheduledTime?: string }): Promise<void> => {
      await apiRequest('/api/social-media/share-portfolio', {
        method: 'POST',
        body: JSON.stringify({ ...payload, userId: user?.id }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id] });
      setShareDialogOpen(false);
      setSelectedPlatforms([]);
      setShareText('');
      setScheduleDate('');
      setScheduleTime('');
      setStatus({ open: true, message: 'Portfolio delt', severity: 'success' });
    },
  });

  const accounts = accountsQuery.data ?? [];
  const posts = postsQuery.data ?? [];
  const portfolioItems = portfolioQuery.data ?? [];

  const loading =
    accountsQuery.isLoading ||
    postsQuery.isLoading ||
    portfolioQuery.isLoading ||
    createPost.isPending ||
    sharePortfolio.isPending;

  const connectedPlatforms = useMemo(
    () => accounts.filter((account) => account.isConnected).map((account) => account.platform),
    [accounts],
  );

  const totalLikes = useMemo(
    () => posts.reduce((sum, post) => sum + safeNumber(post.engagement.likes), 0),
    [posts],
  );
  const totalComments = useMemo(
    () => posts.reduce((sum, post) => sum + safeNumber(post.engagement.comments), 0),
    [posts],
  );
  const totalViews = useMemo(
    () => posts.reduce((sum, post) => sum + safeNumber(post.engagement.views), 0),
    [posts],
  );

  const handleToggleCreatePlatform = (platform: Platform, checked: boolean): void => {
    setCreatePostForm((prev) => {
      const next = new Set(prev.platforms);
      if (checked) {
        next.add(platform);
      } else {
        next.delete(platform);
      }
      return { ...prev, platforms: Array.from(next) };
    });
  };

  const handleCreatePost = (): void => {
    if (!createPostForm.content.trim() || createPostForm.platforms.length === 0) {
      setStatus({ open: true, message: 'Legg til tekst og velg plattform', severity: 'error' });
      return;
    }

    createPost.mutate({
      content: createPostForm.content,
      platforms: createPostForm.platforms,
      postNow: createPostForm.postNow,
      scheduledTime: createPostForm.postNow ? undefined : createPostForm.scheduledTime || undefined,
    });
  };

  const handleOpenShareDialog = (item: PortfolioItem): void => {
    setSelectedPortfolioItem(item);
    setShareText(`Nytt prosjekt: ${item.title}`);
    setSelectedPlatforms(connectedPlatforms);
    setShareDialogOpen(true);
  };

  const handleSharePortfolio = (): void => {
    if (!selectedPortfolioItem || selectedPlatforms.length === 0 || !shareText.trim()) {
      setStatus({ open: true, message: 'Velg plattform og skriv innhold', severity: 'error' });
      return;
    }

    const scheduledTime = scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : undefined;

    sharePortfolio.mutate({
      itemId: selectedPortfolioItem.id,
      platforms: selectedPlatforms,
      content: shareText,
      scheduledTime,
    });
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Sosiale Medier
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Del arbeidene dine enklere som {getProfessionDisplayName(getCurrentUserProfession()).toLowerCase()} med en samlet publiseringsflyt.
        </Typography>
      </Alert>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <Tab icon={<SettingsIcon />} label="Kontoer" />
        <Tab icon={<CreateIcon />} label="Opprett post" />
        <Tab icon={<ImageIcon />} label="Del portfolio" />
        <Tab icon={<CampaignIcon />} label="Innlegg" />
        <Tab icon={<ShareIcon />} label="Analyse" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={2}>
          {(['instagram', 'linkedin', 'facebook', 'tiktok'] as const).map((platform) => {
            const account = accounts.find((entry) => entry.platform === platform);
            const connected = Boolean(account?.isConnected);

            return (
              <Grid item xs={12} md={6} key={platform}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" alignItems="center" gap={1}>
                        {platformIcon(platform)}
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {platformName(platform)}
                        </Typography>
                      </Box>
                      <Chip label={connected ? 'Tilkoblet' : 'Ikke tilkoblet'} color={connected ? 'success' : 'default'} size="small" />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {account?.username ? `Bruker: @${account.username}` : 'Ingen konto koblet til ennå'}
                    </Typography>

                    <Box mt={2}>
                      <Button
                        variant={connected ? 'outlined' : 'contained'}
                        onClick={() => connectAccount.mutate(platform)}
                        disabled={connectAccount.isPending}
                      >
                        {connected ? 'Oppdater tilkobling' : 'Koble til'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {tab === 1 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Opprett post
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                Ny post
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Bruk dialogen for å publisere umiddelbart eller planlagt tid.
            </Typography>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Grid container spacing={2}>
          {portfolioItems.map((item) => (
            <Grid item xs={12} md={6} lg={4} key={item.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {item.description ?? 'Ingen beskrivelse'}
                  </Typography>
                  <Button startIcon={<ShareIcon />} variant="contained" onClick={() => handleOpenShareDialog(item)}>
                    Del
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 3 && (
        <List>
          {posts.map((post) => {
            const statusChip = postStatusChip(post.status);

            return (
              <Card key={post.id} sx={{ mb: 1, ...theming.getThemedCardSx() }}>
                <CardContent>
                  <ListItem disableGutters>
                    <ListItemIcon>{platformIcon(post.platform)}</ListItemIcon>
                    <ListItemText
                      primary={post.content.length > 120 ? `${post.content.slice(0, 120)}...` : post.content}
                      secondary={
                        <Box>
                          <Chip size="small" color={statusChip.color} label={statusChip.label} icon={statusChip.icon} sx={{ mr: 1 }} />
                          <Typography variant="caption" color="text.secondary">
                            {post.postedAt
                              ? `Publisert ${new Date(post.postedAt).toLocaleString('no-NO')}`
                              : post.scheduledTime
                                ? `Planlagt ${new Date(post.scheduledTime).toLocaleString('no-NO')}`
                                : 'Utkast'}
                          </Typography>
                          <Box display="flex" gap={2} mt={1}>
                            <Box display="flex" alignItems="center" gap={0.5}><ThumbUpIcon fontSize="small" /><Typography variant="caption">{post.engagement.likes}</Typography></Box>
                            <Box display="flex" alignItems="center" gap={0.5}><CommentIcon fontSize="small" /><Typography variant="caption">{post.engagement.comments}</Typography></Box>
                            <Box display="flex" alignItems="center" gap={0.5}><VisibilityIcon fontSize="small" /><Typography variant="caption">{post.engagement.views}</Typography></Box>
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Slett post">
                        <IconButton edge="end" color="error" onClick={() => deletePost.mutate(post.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </CardContent>
              </Card>
            );
          })}
        </List>
      )}

      {tab === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{totalLikes.toLocaleString('no-NO')}</Typography>
                <Typography variant="caption">Totale likes</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{totalComments.toLocaleString('no-NO')}</Typography>
                <Typography variant="caption">Totale kommentarer</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{totalViews.toLocaleString('no-NO')}</Typography>
                <Typography variant="caption">Totale visninger</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Ny post</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            margin="normal"
            label="Innhold"
            value={createPostForm.content}
            onChange={(event) => setCreatePostForm((prev) => ({ ...prev, content: event.target.value }))}
          />

          <Typography variant="subtitle2" sx={{ mt: 1 }}>Plattformer</Typography>
          <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
            {(['instagram', 'linkedin', 'facebook', 'tiktok'] as const).map((platform) => {
              const available = connectedPlatforms.includes(platform);
              const selected = createPostForm.platforms.includes(platform);
              return (
                <FormControlLabel
                  key={platform}
                  control={
                    <Switch
                      checked={selected}
                      onChange={(event) => handleToggleCreatePlatform(platform, event.target.checked)}
                      disabled={!available}
                    />
                  }
                  label={`${platformName(platform)}${available ? '' : ' (ikke tilkoblet)'}`}
                />
              );
            })}
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={createPostForm.postNow}
                onChange={(event) => setCreatePostForm((prev) => ({ ...prev, postNow: event.target.checked }))}
              />
            }
            label="Publiser nå"
          />

          {!createPostForm.postNow && (
            <TextField
              fullWidth
              margin="normal"
              type="datetime-local"
              label="Planlagt tid"
              InputLabelProps={{ shrink: true }}
              value={createPostForm.scheduledTime}
              onChange={(event) =>
                setCreatePostForm((prev) => ({ ...prev, scheduledTime: event.target.value }))
              }
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={createPostForm.postNow ? <SendIcon /> : <ScheduleIcon />}
            onClick={handleCreatePost}
            disabled={createPost.isPending}
          >
            {createPostForm.postNow ? 'Publiser' : 'Planlegg'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Del portfolio</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {selectedPortfolioItem?.title ?? 'Portfolio'}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            margin="normal"
            label="Delingstekst"
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
          />

          <Typography variant="subtitle2">Velg plattform</Typography>
          <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
            {connectedPlatforms.map((platform) => {
              const selected = selectedPlatforms.includes(platform);
              return (
                <Button
                  key={platform}
                  variant={selected ? 'contained' : 'outlined'}
                  startIcon={platformIcon(platform)}
                  onClick={() =>
                    setSelectedPlatforms((prev) =>
                      prev.includes(platform)
                        ? prev.filter((value) => value !== platform)
                        : [...prev, platform],
                    )
                  }
                >
                  {platformName(platform)}
                </Button>
              );
            })}
          </Box>

          <Box display="flex" gap={2} mt={2}>
            <TextField
              type="date"
              label="Dato"
              InputLabelProps={{ shrink: true }}
              value={scheduleDate}
              onChange={(event) => setScheduleDate(event.target.value)}
            />
            <TextField
              type="time"
              label="Tid"
              InputLabelProps={{ shrink: true }}
              value={scheduleTime}
              onChange={(event) => setScheduleTime(event.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleSharePortfolio} disabled={sharePortfolio.isPending}>
            Del
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={status.open}
        autoHideDuration={4000}
        onClose={() => setStatus((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={status.severity}
          onClose={() => setStatus((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {status.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
