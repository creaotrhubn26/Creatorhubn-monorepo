import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Divider,
  Drawer,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  CameraAlt as CameraAltIcon,
  Close as CloseIcon,
  Collections as CollectionsIcon,
  Download as DownloadIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  FilterList as FilterListIcon,
  Home as HomeIcon,
  Info as InfoIcon,
  LocationOn as LocationOnIcon,
  Menu as MenuIcon,
  Person as PersonIcon,
  PlayArrow as PlayArrowIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Share as ShareIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface ShowcasePortalProps {
  photographerId?: string;
  theme?: 'dark' | 'light';
}

interface ShowcaseItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl?: string;
  category: string;
  location?: string;
  date: string;
  likes: number;
  views: number;
  isLiked: boolean;
  tags: string[];
}

interface PhotographerProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  specialties: string[];
  location: string;
  experience: string;
  totalProjects: number;
  totalLikes: number;
}

const CATEGORIES = [
  { id: 'all', label: 'Alle kategorier', icon: <CollectionsIcon /> },
  { id: 'bryllup', label: 'Bryllup', icon: <CameraAltIcon /> },
  { id: 'portrett', label: 'Portrett', icon: <PersonIcon /> },
  { id: 'bedrift', label: 'Bedrift', icon: <HomeIcon /> },
  { id: 'event', label: 'Event', icon: <CalendarTodayIcon /> },
  { id: 'familie', label: 'Familie', icon: <InfoIcon /> },
];

const FALLBACK_PROFILE: PhotographerProfile = {
  id: 'current-photographer',
  name: 'Professional Photographer',
  avatar: '/api/placeholder/64/64',
  bio: 'Passionert fotograf med fokus på bryllup, portrett og kommersielle produksjoner.',
  specialties: ['Bryllup', 'Portrett', 'Bedrift', 'Event'],
  location: 'Oslo, Norge',
  experience: '8+ år erfaring',
  totalProjects: 120,
  totalLikes: 3250,
};

const FALLBACK_ITEMS: ShowcaseItem[] = [
  {
    id: 'showcase-1',
    title: 'Romantic Wedding in Lofoten',
    description: 'Kveldslys og naturlige øyeblikk fra en fjordseremoni.',
    imageUrl: '/api/placeholder/800/600',
    category: 'bryllup',
    location: 'Lofoten',
    date: '2025-08-10',
    likes: 147,
    views: 1240,
    isLiked: false,
    tags: ['bryllup', 'utendørs', 'naturlig'],
  },
  {
    id: 'showcase-2',
    title: 'Corporate Headshots',
    description: 'Konsekvent studio-look for hele ledergruppen.',
    imageUrl: '/api/placeholder/800/600',
    category: 'bedrift',
    location: 'Oslo',
    date: '2025-09-02',
    likes: 83,
    views: 922,
    isLiked: false,
    tags: ['bedrift', 'portrett'],
  },
  {
    id: 'showcase-3',
    title: 'Family Portrait Session',
    description: 'Uformelle familieportretter i gyllent kveldslys.',
    imageUrl: '/api/placeholder/800/600',
    category: 'familie',
    location: 'Bergen',
    date: '2025-09-18',
    likes: 96,
    views: 1044,
    isLiked: true,
    tags: ['familie', 'portrett'],
  },
];

const ShowcasePortal: React.FC<ShowcasePortalProps> = ({
  photographerId = 'current-photographer',
  theme = 'dark',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const theming = useTheming('photographer');

  const { data: profileRaw } = useQuery({
    queryKey: ['/api/photo-showcase/profile', photographerId],
    queryFn: () => apiRequest(`/api/photo-showcase/profile/${encodeURIComponent(photographerId)}`),
  });

  const { data: itemsRaw } = useQuery({
    queryKey: ['/api/photo-showcase/items', photographerId, selectedCategory],
    queryFn: () =>
      apiRequest(
        `/api/photo-showcase/items/${encodeURIComponent(photographerId)}?category=${encodeURIComponent(selectedCategory)}`,
      ),
  });

  const profile = normalizeProfile(profileRaw) ?? FALLBACK_PROFILE;
  const items = normalizeItems(itemsRaw);
  const allItems = items.length > 0 ? items : FALLBACK_ITEMS;

  const visibleItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return allItems;
    }
    return allItems.filter((item) => item.category === selectedCategory);
  }, [allItems, selectedCategory]);

  const isDark = theme === 'dark';
  const background = isDark ? '#0f141a' : '#f4f6f8';
  const surface = isDark ? '#151f2b' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const primaryText = isDark ? '#ffffff' : '#101418';
  const secondaryText = isDark ? '#9eb0c2' : '#586370';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: background, color: primaryText }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: isDark ? 'rgba(15, 20, 26, 0.95)' : 'rgba(255,255,255,0.95)',
          borderBottom: `1px solid ${border}`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar>
          <IconButton onClick={() => setSidebarOpen(true)} sx={{ color: primaryText }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {profile.name} • Portfolio
          </Typography>
          <Stack direction="row" spacing={1}>
            <IconButton sx={{ color: primaryText }}>
              <SearchIcon />
            </IconButton>
            <IconButton sx={{ color: primaryText }}>
              <FilterListIcon />
            </IconButton>
            <IconButton sx={{ color: primaryText }}>
              <ShareIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        PaperProps={{
          sx: {
            width: 320,
            bgcolor: surface,
            color: primaryText,
            borderRight: `1px solid ${border}`,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Navigasjon
            </Typography>
            <IconButton onClick={() => setSidebarOpen(false)} sx={{ color: primaryText }}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List>
            {[
              { icon: <HomeIcon />, label: 'Hjem' },
              { icon: <CollectionsIcon />, label: 'Portfolio' },
              { icon: <PersonIcon />, label: 'Om fotografen' },
              { icon: <SettingsIcon />, label: 'Innstillinger' },
            ].map((entry) => (
              <ListItem key={entry.label} disablePadding>
                <ListItemButton>
                  <ListItemIcon sx={{ color: primaryText }}>{entry.icon}</ListItemIcon>
                  <ListItemText primary={entry.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: secondaryText }}>
            Kategorier
          </Typography>
          <List>
            {CATEGORIES.map((category) => (
              <ListItem key={category.id} disablePadding>
                <ListItemButton
                  selected={selectedCategory === category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSidebarOpen(false);
                  }}
                >
                  <ListItemIcon sx={{ color: primaryText }}>{category.icon}</ListItemIcon>
                  <ListItemText primary={category.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: surface,
            border: `1px solid ${border}`,
            borderRadius: 2,
            ...theming.getThemedCardSx(),
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar src={profile.avatar} sx={{ width: 72, height: 72 }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {profile.name}
              </Typography>
              <Typography variant="body2" sx={{ color: secondaryText, mb: 1 }}>
                {profile.bio}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" icon={<LocationOnIcon />} label={profile.location} />
                <Chip size="small" icon={<CameraAltIcon />} label={profile.experience} />
                <Chip size="small" label={`${profile.totalProjects} prosjekter`} />
                <Chip size="small" label={`${profile.totalLikes} likes`} />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 1 }}>
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'contained' : 'outlined'}
              startIcon={category.icon}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </Button>
          ))}
        </Stack>

        <Grid container spacing={2}>
          {visibleItems.map((item) => {
            const liked = item.isLiked || likedItems.has(item.id);
            return (
              <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
                <Card sx={{ bgcolor: surface, border: `1px solid ${border}`, height: '100%' }}>
                  <Box sx={{ position: 'relative' }}>
                    <CardMedia
                      component="img"
                      image={item.imageUrl}
                      alt={item.title}
                      sx={{ height: 220, objectFit: 'cover' }}
                    />
                    {item.videoUrl && (
                      <IconButton
                        sx={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          bgcolor: 'rgba(0,0,0,0.45)',
                          color: '#fff',
                        }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    )}
                    <Badge
                      color="primary"
                      badgeContent={item.views}
                      sx={{ position: 'absolute', left: 12, top: 12 }}
                    >
                      <VisibilityIcon sx={{ color: '#fff' }} />
                    </Badge>
                  </Box>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: secondaryText, mb: 1 }} noWrap>
                      {item.description}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      {item.location && (
                        <Chip size="small" icon={<LocationOnIcon />} label={item.location} />
                      )}
                      <Chip size="small" icon={<CalendarTodayIcon />} label={item.date} />
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      {item.tags.slice(0, 3).map((tag) => (
                        <Chip key={`${item.id}-${tag}`} size="small" label={tag} />
                      ))}
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          onClick={() =>
                            setLikedItems((previous) => {
                              const next = new Set(previous);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            })
                          }
                        >
                          {liked ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon />}
                        </IconButton>
                        <IconButton>
                          <ShareIcon />
                        </IconButton>
                        <IconButton>
                          <DownloadIcon />
                        </IconButton>
                      </Stack>
                      <Typography variant="caption" sx={{ color: secondaryText, alignSelf: 'center' }}>
                        {item.likes + (likedItems.has(item.id) ? 1 : 0)} likes
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

function normalizeProfile(raw: unknown): PhotographerProfile | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    avatar: asString(record.avatar) || '/api/placeholder/64/64',
    bio: asString(record.bio),
    specialties: arrayOfStrings(record.specialties),
    location: asString(record.location),
    experience: asString(record.experience),
    totalProjects: asNumber(record.totalProjects),
    totalLikes: asNumber(record.totalLikes),
  };
}

function normalizeItems(raw: unknown): ShowcaseItem[] {
  const items = toArray(raw);
  return items
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const id = asString(record.id);
      const title = asString(record.title);
      if (!id || !title) {
        return null;
      }
      return {
        id,
        title,
        description: asString(record.description),
        imageUrl: asString(record.imageUrl) || '/api/placeholder/800/600',
        videoUrl: optionalString(record.videoUrl),
        category: asString(record.category) || 'all',
        location: optionalString(record.location),
        date: asString(record.date) || new Date().toISOString().slice(0, 10),
        likes: asNumber(record.likes),
        views: asNumber(record.views),
        isLiked: Boolean(record.isLiked),
        tags: arrayOfStrings(record.tags),
      } satisfies ShowcaseItem;
    })
    .filter((item): item is ShowcaseItem => item !== null);
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export default ShowcasePortal;
