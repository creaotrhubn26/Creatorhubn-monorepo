import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Collapse,
  Link,
} from '@mui/material';
import {
  MusicNote,
  QueueMusic,
  LibraryMusic,
  PlaylistPlay,
  AccessTime,
  Person,
  ExpandMore,
  ExpandLess,
  Refresh,
  PlayArrow,
  Block,
  Favorite,
  Star,
} from '@mui/icons-material';
import { isEventFeatureEnabled, getEventCategory, EventType } from '@/lib/evendi-api';

interface Performance {
  id: string;
  couple_id: string;
  title: string;
  date: string;
  time?: string;
  duration?: string;
  musician_name?: string;
  performance_type?: string;
  notes?: string;
  completed: boolean;
}

interface Setlist {
  id: string;
  couple_id: string;
  title: string;
  songs?: string;
  genre?: string;
  duration?: string;
  mood?: string;
  notes?: string;
}

interface MusicPreferences {
  spotifyPlaylistUrl?: string;
  youtubePlaylistUrl?: string;
  entranceSong?: string;
  firstDanceSong?: string;
  lastSong?: string;
  doNotPlay?: string;
  additionalNotes?: string;
}

interface MusicResponse {
  performances: Performance[];
  setlists: Setlist[];
  preferences: MusicPreferences | null;
  coupleId: string;
  eventType: string;
  organizerName: string;
  totalPerformances: number;
  totalSetlists: number;
}

interface EvendiMusicProps {
  coupleId: string;
  organizerName?: string;
  eventType?: EventType | string;
}

const PERFORMANCE_ICONS: Record<string, React.ReactElement> = {
  band: <QueueMusic />,
  dj: <LibraryMusic />,
  solo: <Person />,
  duo: <MusicNote />,
  choir: <QueueMusic />,
  orchestra: <LibraryMusic />,
};

export default function EvendiMusic({ coupleId, organizerName, eventType }: EvendiMusicProps) {
  const { toast } = useToast();
  const [data, setData] = useState<MusicResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('preferences');

  useEffect(() => {
    if (coupleId) loadMusic();
  }, [coupleId]);

  async function loadMusic() {
    setLoading(true);
    try {
      const result: MusicResponse = await apiRequest(`/api/evendi/music/${coupleId}`);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load music:', err);
      if (err.message?.includes('403')) {
        toast({ title: 'Ingen tilgang', description: 'Tilgang til musikk er ikke aktivert for denne kontrakten', variant: 'warning' });
      } else {
        toast({ title: 'Feil', description: 'Kunne ikke hente musikkdata', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }

  const effectiveEventType = eventType || data?.eventType || 'wedding';
  const isB2C = getEventCategory(effectiveEventType as EventType) === 'personal';

  // Feature-gate: music is relevant for most event types with speeches/entertainment
  // No specific music feature flag in event-types.ts, so we show for all types with speeches
  if (effectiveEventType && !isEventFeatureEnabled(effectiveEventType as EventType, 'speeches')) {
    return null;
  }

  const musicLabel = effectiveEventType === 'wedding' ? 'Musikk & Underholdning' :
    effectiveEventType === 'corporate_party' || effectiveEventType === 'christmas_party' ? 'Underholdning' :
    'Musikk';

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MusicNote sx={{ color: '#9C27B0' }} />
            <Typography variant="h6">{musicLabel}</Typography>
            {(organizerName || data?.organizerName) && (
              <Chip
                size="small"
                label={organizerName || data?.organizerName}
                sx={{ ml: 1, bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9C27B0' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {data && (
              <>
                <Chip icon={<PlayArrow />} label={`${data.totalPerformances} opptredener`} size="small" variant="outlined" />
                <Chip icon={<QueueMusic />} label={`${data.totalSetlists} spillelister`} size="small" variant="outlined" />
              </>
            )}
            <Tooltip title="Oppdater">
              <IconButton size="small" onClick={loadMusic} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {/* Empty state */}
        {!loading && !data?.performances?.length && !data?.setlists?.length && !data?.preferences && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <MusicNote sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              Ingen musikkdata er lagt til ennå.
              Arrangøren kan legge til musikk i Evendi-appen.
            </Typography>
          </Box>
        )}

        {data && (
          <>
            {/* Preferences Section */}
            {data.preferences && (
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 1 }}
                  onClick={() => toggleSection('preferences')}
                >
                  <Favorite sx={{ fontSize: 20, mr: 1, color: '#E91E63' }} />
                  <Typography variant="subtitle1" fontWeight={600}>Musikkønsker</Typography>
                  {expandedSection === 'preferences' ? <ExpandLess sx={{ ml: 'auto' }} /> : <ExpandMore sx={{ ml: 'auto' }} />}
                </Box>
                <Collapse in={expandedSection === 'preferences'}>
                  <Box sx={{ pl: 3.5, pb: 2 }}>
                    <Grid container spacing={2}>
                      {isB2C && data.preferences.entranceSong && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">Inngangssang</Typography>
                          <Typography variant="body2" fontWeight={500}>{data.preferences.entranceSong}</Typography>
                        </Grid>
                      )}
                      {isB2C && data.preferences.firstDanceSong && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">Første dans</Typography>
                          <Typography variant="body2" fontWeight={500}>{data.preferences.firstDanceSong}</Typography>
                        </Grid>
                      )}
                      {isB2C && data.preferences.lastSong && (
                        <Grid item xs={12} sm={6}>
                          <Typography variant="caption" color="text.secondary">Siste sang</Typography>
                          <Typography variant="body2" fontWeight={500}>{data.preferences.lastSong}</Typography>
                        </Grid>
                      )}
                      {isB2C && data.preferences.doNotPlay && (
                        <Grid item xs={12} sm={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Block sx={{ fontSize: 16, color: '#f44336' }} />
                            <Typography variant="caption" color="error">Ikke spill</Typography>
                          </Box>
                          <Typography variant="body2">{data.preferences.doNotPlay}</Typography>
                        </Grid>
                      )}
                      {isB2C && data.preferences.spotifyPlaylistUrl && (
                        <Grid item xs={12} sm={6}>
                          <Link href={data.preferences.spotifyPlaylistUrl} target="_blank" rel="noopener" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png" alt="Spotify" style={{ width: 20, height: 20 }} />
                            Spotify-spilleliste
                          </Link>
                        </Grid>
                      )}
                      {isB2C && data.preferences.youtubePlaylistUrl && (
                        <Grid item xs={12} sm={6}>
                          <Link href={data.preferences.youtubePlaylistUrl} target="_blank" rel="noopener" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img src="https://www.youtube.com/s/desktop/f506bd45/img/favicon_32x32.png" alt="YouTube" style={{ width: 20, height: 20 }} />
                            YouTube-spilleliste
                          </Link>
                        </Grid>
                      )}
                      {data.preferences.additionalNotes && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">Notater</Typography>
                          <Typography variant="body2">{data.preferences.additionalNotes}</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                </Collapse>
                <Divider />
              </Box>
            )}

            {/* Performances Section */}
            {data.performances.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 1 }}
                  onClick={() => toggleSection('performances')}
                >
                  <PlayArrow sx={{ fontSize: 20, mr: 1, color: '#FF9800' }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Opptredener ({data.performances.length})
                  </Typography>
                  {expandedSection === 'performances' ? <ExpandLess sx={{ ml: 'auto' }} /> : <ExpandMore sx={{ ml: 'auto' }} />}
                </Box>
                <Collapse in={expandedSection === 'performances'}>
                  <List disablePadding>
                    {data.performances.map((perf, idx) => (
                      <React.Fragment key={perf.id}>
                        {idx > 0 && <Divider variant="inset" />}
                        <ListItem sx={{ px: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: perf.completed ? '#4CAF50' : '#FF9800', width: 36, height: 36 }}>
                              {PERFORMANCE_ICONS[perf.performance_type?.toLowerCase() || ''] || <MusicNote />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight={600}>{perf.title}</Typography>
                                {perf.completed && <Chip label="Fullført" size="small" color="success" sx={{ height: 20 }} />}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                {perf.musician_name && <Chip icon={<Person />} label={perf.musician_name} size="small" variant="outlined" sx={{ height: 22 }} />}
                                {perf.date && <Chip icon={<AccessTime />} label={perf.date} size="small" variant="outlined" sx={{ height: 22 }} />}
                                {perf.time && <Chip label={perf.time} size="small" variant="outlined" sx={{ height: 22 }} />}
                                {perf.duration && <Chip label={perf.duration} size="small" variant="outlined" sx={{ height: 22 }} />}
                                {perf.performance_type && <Chip label={perf.performance_type} size="small" sx={{ height: 22, bgcolor: 'rgba(156,39,176,0.1)' }} />}
                              </Box>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Collapse>
                <Divider />
              </Box>
            )}

            {/* Setlists Section */}
            {data.setlists.length > 0 && (
              <Box>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', py: 1 }}
                  onClick={() => toggleSection('setlists')}
                >
                  <PlaylistPlay sx={{ fontSize: 20, mr: 1, color: '#2196F3' }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Spillelister ({data.setlists.length})
                  </Typography>
                  {expandedSection === 'setlists' ? <ExpandLess sx={{ ml: 'auto' }} /> : <ExpandMore sx={{ ml: 'auto' }} />}
                </Box>
                <Collapse in={expandedSection === 'setlists'}>
                  <List disablePadding>
                    {data.setlists.map((setlist, idx) => (
                      <React.Fragment key={setlist.id}>
                        {idx > 0 && <Divider variant="inset" />}
                        <ListItem sx={{ px: 1 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: '#2196F3', width: 36, height: 36 }}>
                              <QueueMusic />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography variant="body2" fontWeight={600}>{setlist.title}</Typography>}
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  {setlist.genre && <Chip label={setlist.genre} size="small" sx={{ height: 22, bgcolor: 'rgba(33,150,243,0.1)' }} />}
                                  {setlist.mood && <Chip label={setlist.mood} size="small" sx={{ height: 22 }} variant="outlined" />}
                                  {setlist.duration && <Chip icon={<AccessTime />} label={setlist.duration} size="small" sx={{ height: 22 }} variant="outlined" />}
                                </Box>
                                {setlist.songs && (
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {setlist.songs}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Collapse>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
