// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Brush,
  CloudUpload,
  Download,
  LibraryMusic,
  PhotoCamera,
  PlayArrow,
  Share,
  Star,
  VideoLibrary,
  Visibility,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

type ShowcaseType = 'photo' | 'video' | 'audio' | 'design';
type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor';

interface ShowcaseItem {
  id: string;
  title: string;
  type: ShowcaseType;
  category: string;
  description: string;
  file: string;
  thumbnail?: string;
  views: number;
  likes: number;
  profession: Profession;
  createdAt: string;
}

interface ShowcaseStats {
  totalItems: number;
  totalViews: number;
  totalLikes: number;
}

interface UploadResult {
  url?: string;
  thumbnail?: string;
  type?: string;
  name?: string;
  title?: string;
  profession?: string;
}

const professionMeta: Record<Profession, { label: string; color: string }> = {
  photographer: { label: 'Photographer', color: '#ff6b35' },
  videographer: { label: 'Videographer', color: '#1976d2' },
  music_producer: { label: 'Music Producer', color: '#8e24aa' },
  vendor: { label: 'Vendor', color: '#2e7d32' },
};

const typeTabs: Array<{ label: string; value: ShowcaseType | 'all'; icon: React.ReactNode }> = [
  { label: 'All', value: 'all', icon: <Brush /> },
  { label: 'Photos', value: 'photo', icon: <PhotoCamera /> },
  { label: 'Videos', value: 'video', icon: <VideoLibrary /> },
  { label: 'Audio', value: 'audio', icon: <LibraryMusic /> },
  { label: 'Design', value: 'design', icon: <Brush /> },
];

const fallbackItems: ShowcaseItem[] = [
  {
    id: 'showcase-default-1',
    title: 'Opening Frame',
    type: 'photo',
    category: 'Highlights',
    description: 'Cinematic opening still for campaign reel.',
    file: '/assets/NORWEDFILM_VIGNETT_DEMO2.mov',
    views: 214,
    likes: 38,
    profession: 'photographer',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'showcase-default-2',
    title: 'Audio Signature',
    type: 'audio',
    category: 'Sound Design',
    description: 'Branded signature layer for intro sequence.',
    file: '/assets/audio-signature.wav',
    views: 132,
    likes: 21,
    profession: 'music_producer',
    createdAt: new Date().toISOString(),
  },
];

const detectTypeFromResult = (item: UploadResult): ShowcaseType => {
  const source = `${item.type ?? ''} ${item.url ?? ''}`.toLowerCase();
  if (source.includes('video')) return 'video';
  if (source.includes('audio')) return 'audio';
  if (source.includes('design') || source.includes('psd') || source.includes('fig')) return 'design';
  return 'photo';
};

const getTypeIcon = (type: ShowcaseType): React.ReactElement => {
  switch (type) {
    case 'photo':
      return <PhotoCamera fontSize="small" />;
    case 'video':
      return <VideoLibrary fontSize="small" />;
    case 'audio':
      return <LibraryMusic fontSize="small" />;
    case 'design':
    default:
      return <Brush fontSize="small" />;
  }
};

export default function CreativeShowcaseSystem(): React.ReactElement {
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState<Profession>('photographer');

  const { data: showcaseItems = [] } = useQuery<ShowcaseItem[]>({
    queryKey: ['/api/showcase/items', selectedProfession],
    queryFn: async () => {
      const response = await apiRequest(`/api/showcase/items/${selectedProfession}`);
      const payload = response as { items?: ShowcaseItem[] } | ShowcaseItem[];
      if (Array.isArray(payload)) {
        return payload;
      }
      return payload.items ?? fallbackItems.filter((item) => item.profession === selectedProfession);
    },
  });

  const { data: showcaseStats } = useQuery<ShowcaseStats>({
    queryKey: ['/api/showcase/stats', selectedProfession],
    queryFn: async () => {
      const response = await apiRequest(`/api/showcase/stats/${selectedProfession}`);
      const payload = response as Partial<ShowcaseStats> | undefined;
      return {
        totalItems: payload?.totalItems ?? showcaseItems.length,
        totalViews:
          payload?.totalViews ?? showcaseItems.reduce((sum, item) => sum + (item.views ?? 0), 0),
        totalLikes:
          payload?.totalLikes ?? showcaseItems.reduce((sum, item) => sum + (item.likes ?? 0), 0),
      };
    },
  });

  const createShowcaseItem = useMutation({
    mutationFn: async (itemData: Omit<ShowcaseItem, 'id' | 'createdAt'>) => {
      return apiRequest('/api/showcase/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/showcase/items', selectedProfession] });
      void queryClient.invalidateQueries({ queryKey: ['/api/showcase/stats', selectedProfession] });
    },
  });

  const filteredItems = useMemo(() => {
    const tab = typeTabs[currentTab]?.value ?? 'all';
    const source = showcaseItems.length > 0 ? showcaseItems : fallbackItems;
    return source.filter(
      (item) => item.profession === selectedProfession && (tab === 'all' || item.type === tab),
    );
  }, [currentTab, showcaseItems, selectedProfession]);

  const handleUploadComplete = (results?: unknown[]): void => {
    const normalized = Array.isArray(results) ? (results as UploadResult[]) : [];
    normalized.forEach((result) => {
      const type = detectTypeFromResult(result);
      const title = result.title ?? result.name ?? `New ${type}`;
      const file = result.url ?? '';
      if (!file) {
        return;
      }

      createShowcaseItem.mutate({
        title,
        type,
        category: 'Uploads',
        description: 'Uploaded through Creative Showcase upload flow.',
        file,
        thumbnail: result.thumbnail,
        views: 0,
        likes: 0,
        profession: selectedProfession,
      });
    });
    setUploadDialogOpen(false);
  };

  const stats = showcaseStats ?? {
    totalItems: filteredItems.length,
    totalViews: filteredItems.reduce((sum, item) => sum + item.views, 0),
    totalLikes: filteredItems.reduce((sum, item) => sum + item.likes, 0),
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Creative Showcase
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Present and manage creative outputs across media formats.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {(Object.keys(professionMeta) as Profession[]).map((professionKey) => (
          <Chip
            key={professionKey}
            label={professionMeta[professionKey].label}
            onClick={() => setSelectedProfession(professionKey)}
            variant={selectedProfession === professionKey ? 'filled' : 'outlined'}
            sx={{
              bgcolor:
                selectedProfession === professionKey
                  ? professionMeta[professionKey].color
                  : 'transparent',
              color:
                selectedProfession === professionKey ? 'white' : professionMeta[professionKey].color,
              borderColor: professionMeta[professionKey].color,
            }}
          />
        ))}
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack alignItems="center" spacing={1}>
                <Avatar sx={{ bgcolor: '#0ea5e9' }}>
                  <PhotoCamera />
                </Avatar>
                <Typography variant="h6">{stats.totalItems}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Items
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack alignItems="center" spacing={1}>
                <Avatar sx={{ bgcolor: '#16a34a' }}>
                  <Visibility />
                </Avatar>
                <Typography variant="h6">{stats.totalViews}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Views
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack alignItems="center" spacing={1}>
                <Avatar sx={{ bgcolor: '#f59e0b' }}>
                  <Star />
                </Avatar>
                <Typography variant="h6">{stats.totalLikes}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Likes
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%' }}>
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                fullWidth
                sx={{ height: '100%' }}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload New
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Tabs value={currentTab} onChange={(_event, value: number) => setCurrentTab(value)} sx={{ mb: 2 }}>
        {typeTabs.map((tab) => (
          <Tab key={tab.value} label={tab.label} icon={tab.icon} iconPosition="start" />
        ))}
      </Tabs>

      <Grid container spacing={2}>
        {filteredItems.map((item) => (
          <Grid item xs={12} md={6} lg={4} key={item.id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  height: 180,
                  bgcolor: 'grey.100',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {getTypeIcon(item.type)}
                {item.type === 'video' ? (
                  <IconButton
                    sx={{
                      position: 'absolute',
                      bgcolor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                    }}
                  >
                    <PlayArrow />
                  </IconButton>
                ) : null}
              </Box>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getTypeIcon(item.type)}
                    <Chip label={item.category} size="small" />
                  </Stack>
                  <Typography variant="h6">{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {item.views} views • {item.likes} likes
                    </Typography>
                    <Box>
                      <Tooltip title="Share">
                        <IconButton size="small">
                          <Share fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton size="small">
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Creative Content</DialogTitle>
        <DialogContent>
          <UniversalFileUpload
            onFilesSelected={() => undefined}
            onUploadComplete={handleUploadComplete}
            onUploadError={() => undefined}
            allowedTypes="all"
            maxFiles={20}
            maxFileSizeMB={500}
            showFormatInfo
            uploadEndpoint="/api/showcase/upload"
            profession={selectedProfession}
            enableBackgroundUpload
            maxRetries={3}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
