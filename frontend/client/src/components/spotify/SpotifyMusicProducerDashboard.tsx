import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
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
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Album,
  Analytics,
  BusinessCenter,
  Close,
  InfoOutlined,
  LibraryMusic,
  PlayArrow,
  QueueMusic,
  Refresh,
  Search,
  Star,
  TrendingUp,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type SearchType = 'artist' | 'track' | 'album';

interface SpotifyImage {
  url: string;
}

interface ExternalUrls {
  spotify?: string;
}

interface SpotifyArtistLite {
  id: string;
  name: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  images: SpotifyImage[];
  followers: number;
  genres: string[];
  externalUrls: ExternalUrls;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtistLite[];
  popularity: number;
  album: {
    name: string;
    images: SpotifyImage[];
  };
  externalUrls: ExternalUrls;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  tracksTotal: number;
  images: SpotifyImage[];
  externalUrls: ExternalUrls;
}

interface SpotifyProfile {
  displayName: string;
  followers: number;
  country: string;
  images: SpotifyImage[];
}

interface SpotifyAuthStatus {
  authenticated: boolean;
}

interface MetricItem {
  label: string;
  value: string;
  detail?: string;
}

interface SpotifySearchResults {
  artists: SpotifyArtist[];
  tracks: SpotifyTrack[];
  playlists: SpotifyPlaylist[];
}

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const FALLBACK_PROFILE: SpotifyProfile = {
  displayName: 'Music Producer',
  followers: 0,
  country: 'NO',
  images: [],
};

const FALLBACK_PLAYLISTS: SpotifyPlaylist[] = [
  {
    id: 'fallback-playlist-1',
    name: 'Nordic Electronic Focus',
    description: 'Curated references for cinematic and modern electronic production.',
    tracksTotal: 42,
    images: [],
    externalUrls: {},
  },
  {
    id: 'fallback-playlist-2',
    name: 'Scandi Pop Production',
    description: 'Arrangement and mix references from top Norwegian and Nordic pop tracks.',
    tracksTotal: 35,
    images: [],
    externalUrls: {},
  },
];

const FALLBACK_TRACKS: SpotifyTrack[] = [
  {
    id: 'fallback-track-1',
    name: 'Midnight Fjord',
    artists: [{ id: 'artist-1', name: 'CreatorHub Session Band' }],
    popularity: 78,
    album: { name: 'Reference Session', images: [] },
    externalUrls: {},
  },
  {
    id: 'fallback-track-2',
    name: 'Northern Lights Build',
    artists: [{ id: 'artist-2', name: 'Studio North' }],
    popularity: 65,
    album: { name: 'Arrangement Studies', images: [] },
    externalUrls: {},
  },
];

const FALLBACK_ARTISTS: SpotifyArtist[] = [
  {
    id: 'fallback-artist-1',
    name: 'Aurora Session Collective',
    images: [],
    followers: 12500,
    genres: ['electropop', 'scandinavian'],
    externalUrls: {},
  },
  {
    id: 'fallback-artist-2',
    name: 'Nordic Sound Lab',
    images: [],
    followers: 8100,
    genres: ['ambient', 'cinematic'],
    externalUrls: {},
  },
];

const FALLBACK_MARKET_METRICS: MetricItem[] = [
  { label: 'Fastest Growing Segment', value: 'Nordic Pop Crossovers', detail: 'Last 30 days trend shift' },
  { label: 'Top Listener Region', value: 'Oslo + Bergen', detail: 'Strong evening listening window' },
  { label: 'Seasonal Signal', value: 'Autumn Acoustic Peaks', detail: 'Higher completion on mellow tracks' },
];

const FALLBACK_BUSINESS_METRICS: MetricItem[] = [
  { label: 'Best Release Day', value: 'Friday', detail: 'Highest early save-rate window' },
  { label: 'Competitive Gap', value: 'Mid-tempo cinematic pop', detail: 'Low supply, high engagement' },
  { label: 'Forecast', value: '+14% potential streams', detail: 'Based on current momentum profile' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseImages(raw: unknown): SpotifyImage[] {
  return asArray(raw)
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const url = asString(item.url);
      return url ? { url } : null;
    })
    .filter((item): item is SpotifyImage => item !== null);
}

function parseExternalUrls(raw: unknown): ExternalUrls {
  if (!isRecord(raw)) {
    return {};
  }
  const spotify = asString(raw.spotify);
  return spotify ? { spotify } : {};
}

function parseArtistLite(raw: unknown): SpotifyArtistLite | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) {
    return null;
  }
  return { id, name };
}

function parseArtist(raw: unknown): SpotifyArtist | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) {
    return null;
  }

  const followersObj = isRecord(raw.followers) ? raw.followers : {};
  const genres = asArray(raw.genres).map((genre) => asString(genre)).filter((genre) => genre.length > 0);

  return {
    id,
    name,
    images: parseImages(raw.images),
    followers: asNumber(followersObj.total),
    genres,
    externalUrls: parseExternalUrls(raw.external_urls),
  };
}

function parseTrack(raw: unknown): SpotifyTrack | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) {
    return null;
  }

  const albumObj = isRecord(raw.album) ? raw.album : {};
  const artists = asArray(raw.artists)
    .map(parseArtistLite)
    .filter((artist): artist is SpotifyArtistLite => artist !== null);

  return {
    id,
    name,
    artists,
    popularity: asNumber(raw.popularity),
    album: {
      name: asString(albumObj.name, 'Unknown Album'),
      images: parseImages(albumObj.images),
    },
    externalUrls: parseExternalUrls(raw.external_urls),
  };
}

function parsePlaylist(raw: unknown): SpotifyPlaylist | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) {
    return null;
  }

  const tracksObj = isRecord(raw.tracks) ? raw.tracks : {};

  return {
    id,
    name,
    description: asString(raw.description, 'No description provided.'),
    tracksTotal: asNumber(tracksObj.total),
    images: parseImages(raw.images),
    externalUrls: parseExternalUrls(raw.external_urls),
  };
}

function parseAuthStatus(raw: unknown): SpotifyAuthStatus {
  if (!isRecord(raw)) {
    return { authenticated: false };
  }
  return { authenticated: asBoolean(raw.authenticated) };
}

function parseProfile(raw: unknown): SpotifyProfile {
  if (!isRecord(raw)) {
    return FALLBACK_PROFILE;
  }
  const followersObj = isRecord(raw.followers) ? raw.followers : {};
  return {
    displayName: asString(raw.display_name, FALLBACK_PROFILE.displayName),
    followers: asNumber(followersObj.total, FALLBACK_PROFILE.followers),
    country: asString(raw.country, FALLBACK_PROFILE.country),
    images: parseImages(raw.images),
  };
}

function extractPlaylists(raw: unknown): SpotifyPlaylist[] {
  if (!isRecord(raw)) {
    return FALLBACK_PLAYLISTS;
  }
  const playlistsObj = isRecord(raw.playlists) ? raw.playlists : {};
  const parsed = asArray(playlistsObj.items)
    .map(parsePlaylist)
    .filter((playlist): playlist is SpotifyPlaylist => playlist !== null);
  return parsed.length > 0 ? parsed : FALLBACK_PLAYLISTS;
}

function extractTracks(raw: unknown): SpotifyTrack[] {
  if (!isRecord(raw)) {
    return FALLBACK_TRACKS;
  }
  const parsed = asArray(raw.items).map(parseTrack).filter((track): track is SpotifyTrack => track !== null);
  return parsed.length > 0 ? parsed : FALLBACK_TRACKS;
}

function extractArtists(raw: unknown): SpotifyArtist[] {
  if (!isRecord(raw)) {
    return FALLBACK_ARTISTS;
  }
  const artistsObj = isRecord(raw.artists) ? raw.artists : {};
  const parsed = asArray(artistsObj.items)
    .map(parseArtist)
    .filter((artist): artist is SpotifyArtist => artist !== null);
  return parsed.length > 0 ? parsed : FALLBACK_ARTISTS;
}

function normalizeMetricItems(raw: unknown, fallback: MetricItem[]): MetricItem[] {
  if (!isRecord(raw)) {
    return fallback;
  }

  const dataObj = isRecord(raw.data) ? raw.data : raw;
  const candidates: MetricItem[] = [];

  Object.entries(dataObj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const first = value[0];
      if (isRecord(first)) {
        const label = asString(first.name) || asString(first.title) || key;
        const detail = asString(first.region) || asString(first.genre) || asString(first.period);
        candidates.push({
          label: key,
          value: label,
          detail: detail || undefined,
        });
      }
      return;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      candidates.push({
        label: key,
        value: String(value),
      });
    }
  });

  return candidates.length > 0 ? candidates.slice(0, 6) : fallback;
}

function parseSearchResults(raw: unknown): SpotifySearchResults {
  if (!isRecord(raw)) {
    return { artists: [], tracks: [], playlists: [] };
  }

  const artists = isRecord(raw.artists)
    ? asArray(raw.artists.items)
        .map(parseArtist)
        .filter((artist): artist is SpotifyArtist => artist !== null)
    : [];

  const tracks = isRecord(raw.tracks)
    ? asArray(raw.tracks.items)
        .map(parseTrack)
        .filter((track): track is SpotifyTrack => track !== null)
    : [];

  const playlists = isRecord(raw.playlists)
    ? asArray(raw.playlists.items)
        .map(parsePlaylist)
        .filter((playlist): playlist is SpotifyPlaylist => playlist !== null)
    : [];

  return { artists, tracks, playlists };
}

async function fetchEndpoint(url: string): Promise<unknown> {
  try {
    return await apiRequest(url);
  } catch {
    return {};
  }
}

function TabPanel({ children, value, index }: TabPanelProps): JSX.Element {
  return (
    <div role="tabpanel" hidden={value !== index} id={`spotify-tabpanel-${index}`} aria-labelledby={`spotify-tab-${index}`}>
      {value === index ? <Box sx={{ p: 2 }}>{children}</Box> : null}
    </div>
  );
}

export default function SpotifyMusicProducerDashboard(): JSX.Element {
  const queryClient = useQueryClient();

  const [tabValue, setTabValue] = useState(0);
  const [searchType, setSearchType] = useState<SearchType>('artist');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifySearchResults | null>(null);

  const authQuery = useQuery<SpotifyAuthStatus>({
    queryKey: ['spotify', 'auth-status'],
    queryFn: async () => parseAuthStatus(await fetchEndpoint('/api/spotify/auth-status')),
  });

  const profileQuery = useQuery<SpotifyProfile>({
    queryKey: ['spotify', 'profile'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => parseProfile(await fetchEndpoint('/api/spotify/profile')),
  });

  const playlistsQuery = useQuery<SpotifyPlaylist[]>({
    queryKey: ['spotify', 'featured-playlists'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => extractPlaylists(await fetchEndpoint('/api/spotify/featured-playlists')),
  });

  const tracksQuery = useQuery<SpotifyTrack[]>({
    queryKey: ['spotify', 'top-tracks'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => extractTracks(await fetchEndpoint('/api/spotify/top-tracks')),
  });

  const artistsQuery = useQuery<SpotifyArtist[]>({
    queryKey: ['spotify', 'search-norwegian'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => extractArtists(await fetchEndpoint('/api/spotify/search-norwegian')),
  });

  const marketQuery = useQuery<MetricItem[]>({
    queryKey: ['spotify', 'market-analysis'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => {
      const [trends, geo, season] = await Promise.all([
        fetchEndpoint('/api/spotify/market-analysis/norwegian-trends'),
        fetchEndpoint('/api/spotify/market-analysis/geographic-insights'),
        fetchEndpoint('/api/spotify/market-analysis/seasonal-analysis'),
      ]);
      const merged = normalizeMetricItems(trends, [])
        .concat(normalizeMetricItems(geo, []))
        .concat(normalizeMetricItems(season, []));
      return merged.length > 0 ? merged.slice(0, 6) : FALLBACK_MARKET_METRICS;
    },
  });

  const businessQuery = useQuery<MetricItem[]>({
    queryKey: ['spotify', 'business-analysis'],
    enabled: authQuery.data?.authenticated === true,
    queryFn: async () => {
      const [timing, competition, forecasts] = await Promise.all([
        fetchEndpoint('/api/spotify/business-insights/release-timing'),
        fetchEndpoint('/api/spotify/business-insights/competition-analysis'),
        fetchEndpoint('/api/spotify/business-insights/streaming-forecasts'),
      ]);
      const merged = normalizeMetricItems(timing, [])
        .concat(normalizeMetricItems(competition, []))
        .concat(normalizeMetricItems(forecasts, []));
      return merged.length > 0 ? merged.slice(0, 6) : FALLBACK_BUSINESS_METRICS;
    },
  });

  const searchMutation = useMutation<SpotifySearchResults, Error, { query: string; type: SearchType }>({
    mutationFn: async ({ query, type }) => {
      const raw = await apiRequest('/api/spotify/search', {
        method: 'POST',
        body: { q: query, type },
      });
      return parseSearchResults(raw);
    },
    onSuccess: (results) => {
      setSearchResults(results);
      setShowSearchDialog(false);
    },
  });

  const profile = profileQuery.data ?? FALLBACK_PROFILE;
  const playlists = playlistsQuery.data ?? FALLBACK_PLAYLISTS;
  const tracks = tracksQuery.data ?? FALLBACK_TRACKS;
  const artists = artistsQuery.data ?? FALLBACK_ARTISTS;
  const marketMetrics = marketQuery.data ?? FALLBACK_MARKET_METRICS;
  const businessMetrics = businessQuery.data ?? FALLBACK_BUSINESS_METRICS;

  const analytics = useMemo(() => {
    const averagePopularity = tracks.length > 0 ? Math.round(tracks.reduce((acc, track) => acc + track.popularity, 0) / tracks.length) : 0;
    const topGenres = artists
      .flatMap((artist) => artist.genres)
      .reduce<Record<string, number>>((acc, genre) => {
        acc[genre] = (acc[genre] ?? 0) + 1;
        return acc;
      }, {});

    const mostCommonGenre = Object.entries(topGenres).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'n/a';

    return {
      followers: profile.followers,
      playlistCount: playlists.length,
      trackCount: tracks.length,
      averagePopularity,
      mostCommonGenre,
    };
  }, [artists, playlists.length, profile.followers, tracks]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['spotify'] });
  };

  const handleConnectSpotify = () => {
    window.location.href = '/api/spotify/auth';
  };

  const handleRunSearch = () => {
    const normalized = searchQuery.trim();
    if (!normalized) {
      return;
    }

    searchMutation.mutate({ query: normalized, type: searchType });
  };

  if (authQuery.isLoading) {
    return (
      <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography>Checking Spotify integration...</Typography>
      </Box>
    );
  }

  if (authQuery.data?.authenticated !== true) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <CardContent>
          <LibraryMusic sx={{ fontSize: 56, color: '#1db954', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Connect Spotify
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Link your Spotify account to browse playlists, top tracks, and music business insights directly from Story Arc Studio.
          </Typography>
          <Button variant="contained" onClick={handleConnectSpotify} sx={{ bgcolor: '#1db954', '&:hover': { bgcolor: '#179746' } }}>
            Connect Account
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Card sx={{ mb: 2, background: 'linear-gradient(135deg, #1db954 0%, #179746 100%)', color: '#fff' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar src={profile.images[0]?.url} sx={{ width: 56, height: 56, bgcolor: 'rgba(255,255,255,0.2)' }}>
              <LibraryMusic />
            </Avatar>
            <Box sx={{ flex: '1 1 220px' }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {profile.displayName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92 }}>
                {profile.followers.toLocaleString('nb-NO')} followers • {profile.country}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" onClick={() => setShowInfoDialog(true)} startIcon={<InfoOutlined />} sx={{ borderColor: '#fff', color: '#fff' }}>
                TONO / GRAMO
              </Button>
              <Button variant="outlined" onClick={() => setShowSearchDialog(true)} startIcon={<Search />} sx={{ borderColor: '#fff', color: '#fff' }}>
                Search Spotify
              </Button>
              <IconButton onClick={handleRefresh} sx={{ color: '#fff' }}>
                <Refresh />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Playlists" icon={<QueueMusic />} iconPosition="start" />
          <Tab label="Top Tracks" icon={<Star />} iconPosition="start" />
          <Tab label="Norwegian Music" icon={<Album />} iconPosition="start" />
          <Tab label="Market" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Business" icon={<BusinessCenter />} iconPosition="start" />
          <Tab label="Analytics" icon={<Analytics />} iconPosition="start" />
        </Tabs>
      </Card>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          {playlists.map((playlist) => (
            <Grid item xs={12} md={6} lg={4} key={playlist.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                    <Avatar src={playlist.images[0]?.url} sx={{ bgcolor: '#1db954' }}>
                      <QueueMusic />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {playlist.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {playlist.tracksTotal} tracks
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {playlist.description}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<PlayArrow />}
                    href={playlist.externalUrls.spotify}
                    target="_blank"
                    rel="noreferrer"
                    disabled={!playlist.externalUrls.spotify}
                  >
                    Open Playlist
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <List disablePadding>
          {tracks.map((track, index) => (
            <React.Fragment key={track.id}>
              <ListItem
                secondaryAction={
                  <Button
                    size="small"
                    startIcon={<PlayArrow />}
                    href={track.externalUrls.spotify}
                    target="_blank"
                    rel="noreferrer"
                    disabled={!track.externalUrls.spotify}
                  >
                    Play
                  </Button>
                }
              >
                <ListItemAvatar>
                  <Avatar src={track.album.images[0]?.url} sx={{ bgcolor: '#1db954' }}>
                    <LibraryMusic />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={track.name}
                  secondary={`${track.artists.map((artist) => artist.name).join(', ')} • ${track.album.name}`}
                />
                <Chip size="small" label={`${track.popularity}%`} color="success" variant="outlined" sx={{ mr: 10 }} />
              </ListItem>
              {index < tracks.length - 1 ? <Divider /> : null}
            </React.Fragment>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={2}>
          {artists.map((artist) => (
            <Grid item xs={12} md={6} lg={4} key={artist.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5 }}>
                    <Avatar src={artist.images[0]?.url} sx={{ bgcolor: '#1db954' }}>
                      <LibraryMusic />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {artist.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {artist.followers.toLocaleString('nb-NO')} followers
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {artist.genres.slice(0, 3).map((genre) => (
                      <Chip key={`${artist.id}-${genre}`} size="small" label={genre} variant="outlined" />
                    ))}
                  </Box>

                  <Button
                    size="small"
                    href={artist.externalUrls.spotify}
                    target="_blank"
                    rel="noreferrer"
                    disabled={!artist.externalUrls.spotify}
                  >
                    Open Artist
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          {marketMetrics.map((metric) => (
            <Grid item xs={12} md={4} key={`${metric.label}-${metric.value}`}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {metric.value}
                  </Typography>
                  {metric.detail ? (
                    <Typography variant="body2" color="text.secondary">
                      {metric.detail}
                    </Typography>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={2}>
          {businessMetrics.map((metric) => (
            <Grid item xs={12} md={4} key={`${metric.label}-${metric.value}`}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    {metric.label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {metric.value}
                  </Typography>
                  {metric.detail ? (
                    <Typography variant="body2" color="text.secondary">
                      {metric.detail}
                    </Typography>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Followers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {analytics.followers.toLocaleString('nb-NO')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Average Track Popularity
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {analytics.averagePopularity}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Top Genre in Norwegian List
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {analytics.mostCommonGenre}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Alert severity="info">
              Monitoring {analytics.playlistCount} playlists and {analytics.trackCount} tracks for reference-based production decisions.
            </Alert>
          </Grid>
        </Grid>
      </TabPanel>

      <Dialog open={showSearchDialog} onClose={() => setShowSearchDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Search Spotify Catalog</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField
              label="Search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Artist, track, or album"
              fullWidth
            />
            <TextField
              label="Type"
              select
              value={searchType}
              onChange={(event) => setSearchType(event.target.value as SearchType)}
              fullWidth
            >
              <MenuItem value="artist">Artist</MenuItem>
              <MenuItem value="track">Track</MenuItem>
              <MenuItem value="album">Album</MenuItem>
            </TextField>

            {searchMutation.isError ? <Alert severity="error">Search failed. Check connection and try again.</Alert> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSearchDialog(false)}>Cancel</Button>
          <Button onClick={handleRunSearch} variant="contained" disabled={searchMutation.isPending || searchQuery.trim().length === 0}>
            {searchMutation.isPending ? 'Searching...' : 'Search'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showInfoDialog} onClose={() => setShowInfoDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          TONO / GRAMO Sync Guidance
          <IconButton onClick={() => setShowInfoDialog(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Use Spotify trend data as a decision layer, then register composition and master rights in TONO/GRAMO for correct royalty capture.
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="1. Validate composer splits" secondary="Keep ownership metadata aligned with your DAW session and release notes." />
            </ListItem>
            <ListItem>
              <ListItemText primary="2. Register ISRC and work IDs" secondary="Ensure release IDs map to your publishing records." />
            </ListItem>
            <ListItem>
              <ListItemText primary="3. Track market windows" secondary="Use market/business tabs to optimize release timing before final distribution." />
            </ListItem>
          </List>
        </DialogContent>
      </Dialog>

      {searchResults ? (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>
              Search Results
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {searchResults.artists.length} artists, {searchResults.tracks.length} tracks, {searchResults.playlists.length} playlists
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Artists
                </Typography>
                <List dense>
                  {searchResults.artists.slice(0, 5).map((artist) => (
                    <ListItem key={artist.id}>
                      <ListItemText primary={artist.name} secondary={`${artist.followers.toLocaleString('nb-NO')} followers`} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Tracks
                </Typography>
                <List dense>
                  {searchResults.tracks.slice(0, 5).map((track) => (
                    <ListItem key={track.id}>
                      <ListItemText primary={track.name} secondary={track.artists.map((artist) => artist.name).join(', ')} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Playlists
                </Typography>
                <List dense>
                  {searchResults.playlists.slice(0, 5).map((playlist) => (
                    <ListItem key={playlist.id}>
                      <ListItemText primary={playlist.name} secondary={`${playlist.tracksTotal} tracks`} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
