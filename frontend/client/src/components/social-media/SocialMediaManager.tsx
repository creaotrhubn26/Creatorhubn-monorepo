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
  List,
  ListItem,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Facebook as FacebookIcon,
  VideoLibrary as TikTokIcon,
  OpenInNew as OpenInNewIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import SOMESettings from './SOMESettings';

type SocialPlatform = 'instagram' | 'linkedin' | 'facebook' | 'tiktok';

type PostStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

interface SocialMediaAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  followers: number;
  isConnected: boolean;
  autoPost: boolean;
  lastSync?: string;
}

interface SocialMediaPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  status: PostStatus;
  scheduledTime?: string;
  postedAt?: string;
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
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

function platformIcon(platform: SocialPlatform): React.ReactNode {
  if (platform === 'instagram') return <InstagramIcon />;
  if (platform === 'linkedin') return <LinkedInIcon />;
  if (platform === 'facebook') return <FacebookIcon />;
  return <TikTokIcon />;
}

function normalizeAccounts(payload: unknown): SocialMediaAccount[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const raw = entry as Partial<SocialMediaAccount>;
      const platform: SocialPlatform =
        raw.platform === 'instagram' || raw.platform === 'linkedin' || raw.platform === 'facebook' || raw.platform === 'tiktok'
          ? raw.platform
          : 'instagram';

      return {
        id: typeof raw.id === 'string' ? raw.id : `account-${index}`,
        platform,
        username: typeof raw.username === 'string' ? raw.username : `@${platform}`,
        followers: typeof raw.followers === 'number' ? raw.followers : 0,
        isConnected: raw.isConnected === true,
        autoPost: raw.autoPost === true,
        lastSync: raw.lastSync,
      };
    })
    .filter((entry): entry is SocialMediaAccount => entry !== null);
}

function normalizePosts(payload: unknown): SocialMediaPost[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }

      const raw = entry as Partial<SocialMediaPost>;
      const platform: SocialPlatform =
        raw.platform === 'instagram' || raw.platform === 'linkedin' || raw.platform === 'facebook' || raw.platform === 'tiktok'
          ? raw.platform
          : 'instagram';
      const status: PostStatus =
        raw.status === 'draft' || raw.status === 'scheduled' || raw.status === 'posted' || raw.status === 'failed'
          ? raw.status
          : 'draft';

      return {
        id: typeof raw.id === 'string' ? raw.id : `post-${index}`,
        platform,
        content: typeof raw.content === 'string' ? raw.content : '',
        status,
        scheduledTime: raw.scheduledTime,
        postedAt: raw.postedAt,
        engagement: {
          likes: raw.engagement?.likes ?? 0,
          comments: raw.engagement?.comments ?? 0,
          shares: raw.engagement?.shares ?? 0,
          views: raw.engagement?.views ?? 0,
        },
      };
    })
    .filter((entry): entry is SocialMediaPost => entry !== null);
}

function normalizePortfolio(payload: unknown): PortfolioItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const raw = entry as Partial<PortfolioItem>;
      return {
        id: typeof raw.id === 'string' ? raw.id : `portfolio-${index}`,
        title: typeof raw.title === 'string' ? raw.title : `Portfolio ${index + 1}`,
        description: raw.description,
      };
    })
    .filter((entry): entry is PortfolioItem => entry !== null);
}

export default function SocialMediaManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [tabIndex, setTabIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const [postContent, setPostContent] = useState('');
  const [postNow, setPostNow] = useState(true);
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioItem | null>(null);

  const accountQuery = useQuery({
    queryKey: ['/api/social-media/accounts', user?.id ?? 'anonymous'],
    queryFn: async () => {
      try {
        const result = await apiRequest(`/api/social-media/accounts/${encodeURIComponent(user?.id ?? 'guest')}`);
        return normalizeAccounts(result);
      } catch {
        return [];
      }
    },
  });

  const postQuery = useQuery({
    queryKey: ['/api/social-media/posts', user?.id ?? 'anonymous'],
    queryFn: async () => {
      try {
        const result = await apiRequest(`/api/social-media/posts/${encodeURIComponent(user?.id ?? 'guest')}`);
        return normalizePosts(result);
      } catch {
        return [];
      }
    },
  });

  const portfolioQuery = useQuery({
    queryKey: ['/api/portfolio', user?.id ?? 'anonymous'],
    queryFn: async () => {
      try {
        const result = await apiRequest(`/api/portfolio/${encodeURIComponent(user?.id ?? 'guest')}`);
        return normalizePortfolio(result);
      } catch {
        return [];
      }
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: SocialPlatform) => {
      window.open(
        `/api/social-media/connect/${platform}?userId=${encodeURIComponent(user?.id ?? 'guest')}`,
        '_blank',
        'noopener,noreferrer',
      );
      return platform;
    },
    onSuccess: (platform) => {
      setSnackbar({ open: true, message: `${PLATFORM_LABELS[platform]} OAuth startet.`, severity: 'info' });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (selectedPlatforms.length === 0) {
        throw new Error('Velg minst en plattform.');
      }

      const payload = {
        userId: user?.id,
        content: postContent,
        platforms: selectedPlatforms,
        scheduledTime: postNow ? undefined : scheduledTime,
        postNow,
      };

      return apiRequest('/api/social-media/posts', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id ?? 'anonymous'] });
      setCreateDialogOpen(false);
      setPostContent('');
      setSelectedPlatforms([]);
      setScheduledTime('');
      setPostNow(true);
      setSnackbar({ open: true, message: 'Post lagret og sendt til publiseringsflyt.', severity: 'success' });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke opprette post.',
        severity: 'error',
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPortfolio) {
        throw new Error('Velg et portfolio-objekt.');
      }
      if (selectedPlatforms.length === 0) {
        throw new Error('Velg minst en plattform for deling.');
      }

      return apiRequest('/api/social-media/share', {
        method: 'POST',
        body: {
          userId: user?.id,
          portfolioId: selectedPortfolio.id,
          content: postContent,
          platforms: selectedPlatforms,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id ?? 'anonymous'] });
      setShareDialogOpen(false);
      setSelectedPortfolio(null);
      setPostContent('');
      setSelectedPlatforms([]);
      setSnackbar({ open: true, message: 'Portfolio innhold delt.', severity: 'success' });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Deling feilet.',
        severity: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiRequest(`/api/social-media/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });
      return postId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', user?.id ?? 'anonymous'] });
      setSnackbar({ open: true, message: 'Post slettet.', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Kunne ikke slette post.', severity: 'error' });
    },
  });

  const toggleAutoPostMutation = useMutation({
    mutationFn: async ({ accountId, autoPost }: { accountId: string; autoPost: boolean }) => {
      await apiRequest(`/api/social-media/accounts/${encodeURIComponent(accountId)}/settings`, {
        method: 'PATCH',
        body: { autoPost },
      });
      return { accountId, autoPost };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/accounts', user?.id ?? 'anonymous'] });
    },
  });

  const accounts = accountQuery.data ?? [];
  const posts = postQuery.data ?? [];
  const portfolioItems = portfolioQuery.data ?? [];

  const connectedAccounts = useMemo(() => accounts.filter((account) => account.isConnected), [accounts]);

  const totalEngagement = useMemo(
    () =>
      posts.reduce(
        (sum, post) => sum + post.engagement.likes + post.engagement.comments + post.engagement.shares,
        0,
      ),
    [posts],
  );

  const togglePlatform = (platform: SocialPlatform, enabled: boolean) => {
    setSelectedPlatforms((previous) => {
      if (enabled) {
        return previous.includes(platform) ? previous : [...previous, platform];
      }
      return previous.filter((entry) => entry !== platform);
    });
  };

  const loading = accountQuery.isLoading || postQuery.isLoading || portfolioQuery.isLoading;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Social Media Manager</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ShareIcon />} onClick={() => setShareDialogOpen(true)}>
            Del portfolio
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Ny post
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tabIndex} onChange={(_, value: number) => setTabIndex(value)} sx={{ mb: 2 }}>
        <Tab label="Kontoer" />
        <Tab label="Poster" />
        <Tab label="Analytics" />
        <Tab label="Innstillinger" />
      </Tabs>

      {loading && <Alert severity="info">Laster social data...</Alert>}

      {tabIndex === 0 && (
        <Grid container spacing={2}>
          {(['instagram', 'linkedin', 'facebook', 'tiktok'] as SocialPlatform[]).map((platform) => {
            const account = accounts.find((entry) => entry.platform === platform);
            const connected = account?.isConnected === true;

            return (
              <Grid item xs={12} md={6} key={platform}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {platformIcon(platform)}
                        <Typography fontWeight={700}>{PLATFORM_LABELS[platform]}</Typography>
                      </Stack>
                      {connected ? <Chip label="Koblet" color="success" /> : <Chip label="Ikke koblet" />}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {connected ? account?.username : 'Konto ikke autentisert.'}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={account?.autoPost === true}
                            disabled={!connected}
                            onChange={(event) => {
                              if (!account) {
                                return;
                              }
                              toggleAutoPostMutation.mutate({ accountId: account.id, autoPost: event.target.checked });
                            }}
                          />
                        }
                        label="Auto-post"
                      />

                      <Button
                        size="small"
                        variant={connected ? 'outlined' : 'contained'}
                        startIcon={<OpenInNewIcon />}
                        onClick={() => connectMutation.mutate(platform)}
                      >
                        {connected ? 'Koble pa nytt' : 'Koble til'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {tabIndex === 1 && (
        <List>
          {posts.map((post) => (
            <ListItem
              key={post.id}
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={post.status} color={post.status === 'posted' ? 'success' : 'default'} />
                  <IconButton color="error" onClick={() => deleteMutation.mutate(post.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemText
                primary={`${PLATFORM_LABELS[post.platform]} · ${post.content.slice(0, 80)}`}
                secondary={`Likes ${post.engagement.likes} · Comments ${post.engagement.comments} · Shares ${post.engagement.shares}`}
              />
            </ListItem>
          ))}

          {posts.length === 0 && <Alert severity="info">Ingen poster registrert ennå.</Alert>}
        </List>
      )}

      {tabIndex === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Koblede kontoer
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {connectedAccounts.length}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Publiserte poster
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {posts.filter((post) => post.status === 'posted').length}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total engagement
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {totalEngagement}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tabIndex === 3 && <SOMESettings />}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett post</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Innhold"
              multiline
              minRows={4}
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
            />

            <Typography variant="subtitle2">Plattformer</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {connectedAccounts.map((account) => (
                <FormControlLabel
                  key={account.id}
                  control={
                    <Switch
                      checked={selectedPlatforms.includes(account.platform)}
                      onChange={(event) => togglePlatform(account.platform, event.target.checked)}
                    />
                  }
                  label={PLATFORM_LABELS[account.platform]}
                />
              ))}
            </Stack>

            <FormControlLabel
              control={<Switch checked={postNow} onChange={(event) => setPostNow(event.target.checked)} />}
              label="Publiser nå"
            />

            {!postNow && (
              <TextField
                type="datetime-local"
                label="Planlagt tidspunkt"
                InputLabelProps={{ shrink: true }}
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => createPostMutation.mutate()}
            disabled={postContent.trim().length === 0 || selectedPlatforms.length === 0}
          >
            Lagre post
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del portfolio element</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="subtitle2">Velg element</Typography>
            <List dense>
              {portfolioItems.map((item) => (
                <ListItem
                  key={item.id}
                  button
                  selected={selectedPortfolio?.id === item.id}
                  onClick={() => setSelectedPortfolio(item)}
                >
                  <ListItemText primary={item.title} secondary={item.description} />
                </ListItem>
              ))}
            </List>

            <TextField
              label="Posttekst"
              multiline
              minRows={3}
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
            />

            <Typography variant="subtitle2">Plattformer</Typography>
            <Stack direction="row" spacing={1}>
              {connectedAccounts.map((account) => (
                <FormControlLabel
                  key={`share-${account.id}`}
                  control={
                    <Switch
                      checked={selectedPlatforms.includes(account.platform)}
                      onChange={(event) => togglePlatform(account.platform, event.target.checked)}
                    />
                  }
                  label={PLATFORM_LABELS[account.platform]}
                />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => shareMutation.mutate()}
            disabled={!selectedPortfolio || selectedPlatforms.length === 0}
          >
            Del
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
