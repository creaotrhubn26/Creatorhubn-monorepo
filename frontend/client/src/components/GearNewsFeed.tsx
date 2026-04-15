// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheming } from '../utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  LibraryMusic as MusicIcon,
  OpenInNew as ExternalIcon,
  PhotoCamera as CameraIcon,
  Schedule as ClockIcon,
  Search as SearchIcon,
  TrendingUp as TrendingIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishDate: string;
  source: string;
  category: string;
  brand?: string;
  imageUrl?: string;
  isNorwegian: boolean;
}

interface GearNewsFeedProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  maxItems?: number;
  showSearch?: boolean;
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index} id={`news-tabpanel-${index}`} aria-labelledby={`news-tab-${index}`}>
      {value === index ? <Box sx={{ p: 2 }}>{children}</Box> : null}
    </div>
  );
};

const getProfessionConfig = (profession: GearNewsFeedProps['profession']) => {
  switch (profession) {
    case 'photographer':
      return {
        title: 'Fotoutstyr Nyheter',
        icon: CameraIcon,
        color: '#f59e0b',
      };
    case 'videographer':
      return {
        title: 'Videoutstyr Nyheter',
        icon: VideocamIcon,
        color: '#dc2626',
      };
    case 'music_producer':
      return {
        title: 'Studioutstyr Nyheter',
        icon: MusicIcon,
        color: '#7c3aed',
      };
    case 'vendor':
      return {
        title: 'Leverandor Nyheter',
        icon: BusinessIcon,
        color: '#2563eb',
      };
    default:
      return {
        title: 'Utstyr Nyheter',
        icon: TrendingIcon,
        color: '#6b7280',
      };
  }
};

export default function GearNewsFeed({ profession = 'photographer', maxItems = 20, showSearch = true }: GearNewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const theming = useTheming(profession);

  const { data: newsData, isLoading, error } = useQuery<{ success: boolean; data: NewsItem[] }>({
    queryKey: ['/api/gear-news', profession],
    queryFn: async () => {
      const response = await fetch(`/api/gear-news?profession=${profession}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch gear news (${response.status})`);
      }
      return (await response.json()) as { success: boolean; data: NewsItem[] };
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });

  const newsItems = useMemo<NewsItem[]>(() => {
    if (!newsData?.success) {
      return [];
    }
    return Array.isArray(newsData.data) ? newsData.data : [];
  }, [newsData]);

  const filteredNews = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return newsItems
      .filter((item) => {
        const matchesSearch =
          normalizedQuery.length === 0 ||
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.summary.toLowerCase().includes(normalizedQuery) ||
          (item.brand?.toLowerCase().includes(normalizedQuery) ?? false);

        const matchesTab = tabValue === 0 || (tabValue === 1 ? item.isNorwegian : !item.isNorwegian);
        return matchesSearch && matchesTab;
      })
      .slice(0, maxItems);
  }, [maxItems, newsItems, searchQuery, tabValue]);

  const config = getProfessionConfig(profession);
  const ProfessionIcon = config.icon;

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Card sx={theming.getThemedCardSx()}>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Laster nyheter...
                </Typography>
              </Box>
            }
          />
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Henter siste nytt innen {config.title.toLowerCase()}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Kunne ikke laste nyheter. Prov igjen senere.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: '50%',
            bgcolor: `${config.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ProfessionIcon sx={{ color: config.color, fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            {config.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredNews.length} artikler tilgjengelig
          </Typography>
        </Box>
      </Box>

      {showSearch ? (
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                placeholder="Sok i nyheter..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Tabs value={tabValue} onChange={(_, value: number) => setTabValue(value)} variant="scrollable" scrollButtons="auto">
                <Tab label="Alle" />
                <Tab label="Norske" />
                <Tab label="Internasjonale" />
              </Tabs>
            </Grid>
          </Grid>
        </Box>
      ) : null}

      <TabPanel value={tabValue} index={tabValue}>
        <Grid container spacing={3}>
          {filteredNews.map((item) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', ...theming.getThemedCardSx() }}>
                <CardHeader
                  title={
                    <Typography
                      variant="h6"
                      sx={{
                        fontSize: '1rem',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {item.title}
                    </Typography>
                  }
                  subheader={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Chip label={item.source} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                      {item.isNorwegian ? <Chip label="NO" size="small" sx={{ fontSize: '0.75rem' }} /> : null}
                    </Box>
                  }
                  sx={theming.getThemedCardSx()}
                />
                <CardContent sx={{ flexGrow: 1, ...theming.getThemedCardSx() }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mb: 2,
                    }}
                  >
                    {item.summary}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ClockIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.publishDate).toLocaleDateString('nb-NO')}
                    </Typography>
                  </Box>
                  <Button variant="outlined" size="small" href={item.url} target="_blank" rel="noopener noreferrer" endIcon={<ExternalIcon />}>
                    Les mer
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {filteredNews.length === 0 && !isLoading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
            Ingen nyheter funnet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prov a justere soket eller kom tilbake senere.
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
