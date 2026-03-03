import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
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
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Analytics,
  ContentCopy,
  Delete,
  Launch,
  Link,
  MusicNote,
  PhotoLibrary,
  Public,
  QrCode,
  Share,
  Speed,
  ThumbUp,
  TrendingUp,
  VideoLibrary,
  Visibility,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ViralMetrics {
  views: number;
  shares: number;
  likes: number;
  comments: number;
  reach: number;
  engagementRate: number;
}

interface ViralBoosts {
  seoOptimized: boolean;
  socialOptimized: boolean;
  mobileOptimized: boolean;
  speedOptimized: boolean;
}

interface ShareChannels {
  direct: number;
  social: number;
  email: number;
  search: number;
}

interface ViralPortfolioItem {
  id: string;
  title: string;
  description: string;
  mediaUrls: string[];
  thumbnail: string;
  profession: string;
  tags: string[];
  shareableUrl: string;
  qrCode: string;
  createdAt: string;
  isPublic: boolean;
  isFeatured: boolean;
  viralMetrics: ViralMetrics;
  shareChannels: ShareChannels;
  viralBoosts: ViralBoosts;
}

interface ShareableTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  profession: string;
  viralScore: number;
  usage: number;
}

type RawWithData<T> = {
  data?: T;
};

const LOCAL_ITEMS_KEY = 'viral_portfolio_items';

const CHANNEL_OPTIONS = [
  { id: 'direct', label: 'Direct' },
  { id: 'social', label: 'Social' },
  { id: 'email', label: 'Email' },
  { id: 'search', label: 'Search' },
] as const;

const DEFAULT_TEMPLATES: ShareableTemplate[] = [
  {
    id: 'cinematic-launch',
    name: 'Cinematic Launch',
    description: 'Teaser for premium visual storytelling work.',
    template: 'Watch this cinematic story and share your favorite scene.',
    profession: 'videographer',
    viralScore: 84,
    usage: 124,
  },
  {
    id: 'before-after-photo',
    name: 'Before/After Reveal',
    description: 'Photo transformation + short CTA.',
    template: 'Swipe for the transformation and tell us your favorite frame.',
    profession: 'photographer',
    viralScore: 78,
    usage: 92,
  },
  {
    id: 'music-drop',
    name: 'Music Drop',
    description: 'Clip + hook + platform CTA for audio snippets.',
    template: 'Headphones on. New drop just landed. Link in bio.',
    profession: 'music_producer',
    viralScore: 81,
    usage: 67,
  },
];

function parseArrayFromApi<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as RawWithData<unknown>).data)
  ) {
    return (payload as RawWithData<T[]>).data ?? [];
  }

  return [];
}

function loadLocalItems(): ViralPortfolioItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_ITEMS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ViralPortfolioItem[]) : [];
  } catch {
    return [];
  }
}

function saveLocalItems(items: ViralPortfolioItem[]): void {
  try {
    localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures in private mode.
  }
}

function totalViralScore(item: ViralPortfolioItem): number {
  const scoreFromMetrics =
    item.viralMetrics.views / 140 +
    item.viralMetrics.shares * 2.5 +
    item.viralMetrics.likes * 1.1 +
    item.viralMetrics.engagementRate * 8;

  const scoreFromBoosts =
    (item.viralBoosts.seoOptimized ? 8 : 0) +
    (item.viralBoosts.socialOptimized ? 8 : 0) +
    (item.viralBoosts.mobileOptimized ? 5 : 0) +
    (item.viralBoosts.speedOptimized ? 5 : 0);

  return Math.max(0, Math.min(100, Math.round(scoreFromMetrics + scoreFromBoosts)));
}

function scoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) {
    return 'success';
  }
  if (score >= 60) {
    return 'warning';
  }
  return 'error';
}

function professionIcon(profession: string): React.ReactNode {
  if (profession === 'videographer') {
    return <VideoLibrary fontSize="small" />;
  }
  if (profession === 'music_producer') {
    return <MusicNote fontSize="small" />;
  }
  return <PhotoLibrary fontSize="small" />;
}

function tabPanelProps(index: number) {
  return {
    id: `viral-tab-${index}`,
    'aria-controls': `viral-tabpanel-${index}`,
  };
}

export default function ViralPortfolioEngine() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [optimizeDialogOpen, setOptimizeDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATES[0]?.id ?? '');
  const [customMessage, setCustomMessage] = useState('');
  const [channels, setChannels] = useState<string[]>(['social']);
  const [selectedItem, setSelectedItem] = useState<ViralPortfolioItem | null>(null);
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['/api/viral-portfolio/items'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/viral-portfolio/items');
        const parsed = parseArrayFromApi<ViralPortfolioItem>(response);
        if (parsed.length > 0) {
          saveLocalItems(parsed);
          return parsed;
        }
      } catch {
        // Fallback below.
      }

      return loadLocalItems();
    },
  });

  const itemsToRender = useMemo(
    () => (showOnlyPublic ? items.filter((item) => item.isPublic) : items),
    [items, showOnlyPublic],
  );

  const summary = useMemo(() => {
    if (items.length === 0) {
      return { views: 0, shares: 0, likes: 0, averageScore: 0 };
    }

    const views = items.reduce((sum, item) => sum + item.viralMetrics.views, 0);
    const shares = items.reduce((sum, item) => sum + item.viralMetrics.shares, 0);
    const likes = items.reduce((sum, item) => sum + item.viralMetrics.likes, 0);
    const averageScore =
      Math.round(items.reduce((sum, item) => sum + totalViralScore(item), 0) / items.length) || 0;

    return { views, shares, likes, averageScore };
  }, [items]);

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      try {
        await apiRequest(`/api/viral-portfolio/items/${itemId}`, { method: 'DELETE' });
      } catch {
        // Keep local path operational even if API endpoint is unavailable.
      }

      const nextItems = items.filter((item) => item.id !== itemId);
      saveLocalItems(nextItems);
      return nextItems;
    },
    onSuccess: (nextItems) => {
      queryClient.setQueryData(['/api/viral-portfolio/items'], nextItems);
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async (payload: { itemId: string; boosts: ViralBoosts }) => {
      try {
        await apiRequest(`/api/viral-portfolio/optimize/${payload.itemId}`, {
          method: 'PATCH',
          body: payload.boosts,
        });
      } catch {
        // Continue with local update.
      }

      const nextItems = items.map((item) =>
        item.id === payload.itemId
          ? {
              ...item,
              viralBoosts: payload.boosts,
            }
          : item,
      );

      saveLocalItems(nextItems);
      return nextItems;
    },
    onSuccess: (nextItems) => {
      queryClient.setQueryData(['/api/viral-portfolio/items'], nextItems);
      setOptimizeDialogOpen(false);
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (payload: {
      itemId: string;
      channels: string[];
      message: string;
      templateId: string;
    }) => {
      const item = items.find((candidate) => candidate.id === payload.itemId);
      if (!item) {
        return;
      }

      try {
        await apiRequest('/api/viral-portfolio/share', {
          method: 'POST',
          body: payload,
        });
      } catch {
        // Continue with local metrics update.
      }

      const nextItems = items.map((candidate) => {
        if (candidate.id !== payload.itemId) {
          return candidate;
        }

        const updatedChannelMetrics: ShareChannels = {
          ...candidate.shareChannels,
          direct: candidate.shareChannels.direct + (payload.channels.includes('direct') ? 1 : 0),
          social: candidate.shareChannels.social + (payload.channels.includes('social') ? 1 : 0),
          email: candidate.shareChannels.email + (payload.channels.includes('email') ? 1 : 0),
          search: candidate.shareChannels.search + (payload.channels.includes('search') ? 1 : 0),
        };

        return {
          ...candidate,
          shareChannels: updatedChannelMetrics,
          viralMetrics: {
            ...candidate.viralMetrics,
            shares: candidate.viralMetrics.shares + payload.channels.length,
          },
        };
      });

      saveLocalItems(nextItems);
      return nextItems;
    },
    onSuccess: (nextItems) => {
      if (nextItems) {
        queryClient.setQueryData(['/api/viral-portfolio/items'], nextItems);
      }
      setShareDialogOpen(false);
    },
  });

  const handleOpenShare = (item: ViralPortfolioItem) => {
    setSelectedItem(item);
    setSelectedTemplateId(DEFAULT_TEMPLATES[0]?.id ?? '');
    setCustomMessage(`Check out this project: ${item.title}`);
    setChannels(['social']);
    setShareDialogOpen(true);
  };

  const handleOpenOptimize = (item: ViralPortfolioItem) => {
    setSelectedItem(item);
    setOptimizeDialogOpen(true);
  };

  const handleToggleChannel = (channelId: string) => {
    setChannels((previous) =>
      previous.includes(channelId)
        ? previous.filter((channel) => channel !== channelId)
        : [...previous, channelId],
    );
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard permissions can fail in some browser contexts.
    }
  };

  const selectedTemplate =
    DEFAULT_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? DEFAULT_TEMPLATES[0];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Viral Portfolio Engine</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyPublic}
              onChange={(event) => setShowOnlyPublic(event.target.checked)}
            />
          }
          label="Kun offentlige"
        />
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline">Total views</Typography>
              <Typography variant="h6">{summary.views.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline">Total shares</Typography>
              <Typography variant="h6">{summary.shares.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline">Total likes</Typography>
              <Typography variant="h6">{summary.likes.toLocaleString()}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="overline">Avg. viral score</Typography>
              <Typography variant="h6">{summary.averageScore}/100</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab label="Portfolio" {...tabPanelProps(0)} />
          <Tab label="Analytics" {...tabPanelProps(1)} />
          <Tab label="Templates" {...tabPanelProps(2)} />
        </Tabs>

        <Box role="tabpanel" hidden={tab !== 0} id="viral-tabpanel-0" aria-labelledby="viral-tab-0" sx={{ p: 2 }}>
          {isError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Kunne ikke hente fra API, bruker lokal porteføljedata.
            </Alert>
          )}

          {isLoading ? (
            <LinearProgress />
          ) : itemsToRender.length === 0 ? (
            <Alert severity="info">Ingen portfolio-elementer enda.</Alert>
          ) : (
            <List>
              {itemsToRender.map((item) => {
                const score = totalViralScore(item);

                return (
                  <ListItem key={item.id} divider alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar>{professionIcon(item.profession)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {item.title}
                          </Typography>
                          <Chip size="small" color={scoreColor(score)} label={`Score ${score}`} />
                          {item.isFeatured && <Chip size="small" color="secondary" label="Featured" />}
                          {item.isPublic ? (
                            <Chip size="small" icon={<Public fontSize="small" />} label="Public" />
                          ) : (
                            <Chip size="small" variant="outlined" label="Private" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                            {item.description}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            <Chip size="small" icon={<Visibility fontSize="small" />} label={item.viralMetrics.views} />
                            <Chip size="small" icon={<Share fontSize="small" />} label={item.viralMetrics.shares} />
                            <Chip size="small" icon={<ThumbUp fontSize="small" />} label={item.viralMetrics.likes} />
                            <Chip size="small" icon={<TrendingUp fontSize="small" />} label={`${item.viralMetrics.engagementRate.toFixed(1)}%`} />
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Open link">
                        <IconButton onClick={() => window.open(item.shareableUrl, '_blank', 'noopener,noreferrer')}>
                          <Launch fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy link">
                        <IconButton onClick={() => handleCopyLink(item.shareableUrl)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Share campaign">
                        <IconButton onClick={() => handleOpenShare(item)}>
                          <Share fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Optimize">
                        <IconButton onClick={() => handleOpenOptimize(item)}>
                          <Speed fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          color="error"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          disabled={deleteItemMutation.isPending}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        <Box role="tabpanel" hidden={tab !== 1} id="viral-tabpanel-1" aria-labelledby="viral-tab-1" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Reach composition
                  </Typography>
                  <List dense disablePadding>
                    <ListItem>
                      <ListItemText primary="Direct" />
                      <Badge color="primary" badgeContent={items.reduce((sum, item) => sum + item.shareChannels.direct, 0)} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Social" />
                      <Badge color="primary" badgeContent={items.reduce((sum, item) => sum + item.shareChannels.social, 0)} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Email" />
                      <Badge color="primary" badgeContent={items.reduce((sum, item) => sum + item.shareChannels.email, 0)} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Search" />
                      <Badge color="primary" badgeContent={items.reduce((sum, item) => sum + item.shareChannels.search, 0)} />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Top item
                  </Typography>
                  {items.length === 0 ? (
                    <Typography color="text.secondary">Ingen data enda.</Typography>
                  ) : (
                    <>
                      {(() => {
                        const topItem = [...items].sort((left, right) => totalViralScore(right) - totalViralScore(left))[0];
                        return (
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {topItem.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                              {topItem.description}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={totalViralScore(topItem)}
                              sx={{ height: 10, borderRadius: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              Score {totalViralScore(topItem)}
                            </Typography>
                          </Box>
                        );
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <Box role="tabpanel" hidden={tab !== 2} id="viral-tabpanel-2" aria-labelledby="viral-tab-2" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {DEFAULT_TEMPLATES.map((template) => (
              <Grid item xs={12} md={4} key={template.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
                      {template.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <Chip icon={<Analytics fontSize="small" />} size="small" label={`Score ${template.viralScore}`} />
                      <Chip icon={<Visibility fontSize="small" />} size="small" label={`Used ${template.usage}`} />
                    </Box>
                    <Divider sx={{ my: 1.25 }} />
                    <Typography variant="body2">{template.template}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Campaign</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, mt: 0.5 }}>
            <Select
              value={selectedTemplateId}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value);
                const next = DEFAULT_TEMPLATES.find((template) => template.id === event.target.value);
                if (next) {
                  setCustomMessage(next.template);
                }
              }}
              fullWidth
            >
              {DEFAULT_TEMPLATES.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </Select>

            <TextField
              multiline
              minRows={3}
              value={customMessage}
              onChange={(event) => setCustomMessage(event.target.value)}
              label="Message"
            />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {CHANNEL_OPTIONS.map((channel) => {
                const selected = channels.includes(channel.id);
                return (
                  <Chip
                    key={channel.id}
                    label={channel.label}
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    onClick={() => handleToggleChannel(channel.id)}
                    clickable
                  />
                );
              })}
            </Box>

            <Alert severity="info" icon={<Link fontSize="small" />}>
              {selectedItem?.shareableUrl || 'No share link available'}
            </Alert>
            <Alert severity="info" icon={<QrCode fontSize="small" />}>
              {selectedItem?.qrCode || 'QR code generated on publish'}
            </Alert>
            <Alert severity="info" icon={<Analytics fontSize="small" />}>
              Template score: {selectedTemplate?.viralScore ?? 0}
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedItem) {
                return;
              }
              shareMutation.mutate({
                itemId: selectedItem.id,
                channels,
                message: customMessage,
                templateId: selectedTemplateId,
              });
            }}
            disabled={!selectedItem || channels.length === 0 || shareMutation.isPending}
          >
            Share
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={optimizeDialogOpen} onClose={() => setOptimizeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Optimize for Viral Reach</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ display: 'grid', gap: 1.25, mt: 0.5 }}>
              {(
                [
                  ['seoOptimized', 'SEO optimization'],
                  ['socialOptimized', 'Social optimization'],
                  ['mobileOptimized', 'Mobile optimization'],
                  ['speedOptimized', 'Speed optimization'],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={selectedItem.viralBoosts[key]}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedItem((previous) => {
                          if (!previous) {
                            return previous;
                          }

                          return {
                            ...previous,
                            viralBoosts: {
                              ...previous.viralBoosts,
                              [key]: checked,
                            },
                          };
                        });
                      }}
                    />
                  }
                  label={label}
                />
              ))}
              <LinearProgress
                variant="determinate"
                value={totalViralScore(selectedItem)}
                sx={{ height: 10, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Projected score: {totalViralScore(selectedItem)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptimizeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedItem) {
                return;
              }

              optimizeMutation.mutate({
                itemId: selectedItem.id,
                boosts: selectedItem.viralBoosts,
              });
            }}
            disabled={!selectedItem || optimizeMutation.isPending}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
