import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
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
  ListItemSecondaryAction,
  Avatar,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  RecordVoiceOver,
  AccessTime,
  Person,
  Schedule,
  Notes,
  Mic,
  ExpandMore,
  ExpandLess,
  Refresh,
  EmojiEvents,
  Campaign,
} from '@mui/icons-material';
import { isEventFeatureEnabled, EventType, getEventTypeLabel } from '@/lib/evendi-api';

interface Speech {
  id: string;
  couple_id: string;
  speaker_name: string;
  role?: string;
  duration_minutes: number;
  sort_order: number;
  notes?: string;
  scheduled_time?: string;
  created_at?: string;
  updated_at?: string;
}

interface SpeechesResponse {
  speeches: Speech[];
  coupleId: string;
  eventType: string;
  organizerName: string;
}

interface EvendiSpeechesProps {
  coupleId: string;
  organizerName?: string;
  eventType?: EventType;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  bride: <Person fontSize="small" sx={{ color: '#E91E63' }} />,
  groom: <Person fontSize="small" sx={{ color: '#1976D2' }} />,
  bestman: <EmojiEvents fontSize="small" sx={{ color: '#FF9800' }} />,
  maid_of_honor: <EmojiEvents fontSize="small" sx={{ color: '#E91E63' }} />,
  parent: <Person fontSize="small" sx={{ color: '#4CAF50' }} />,
  toastmaster: <Campaign fontSize="small" sx={{ color: '#9C27B0' }} />,
  keynote: <Campaign fontSize="small" sx={{ color: '#FF5722' }} />,
  presenter: <Mic fontSize="small" sx={{ color: '#00BCD4' }} />,
  host: <Campaign fontSize="small" sx={{ color: '#607D8B' }} />,
};

const ROLE_LABELS: Record<string, string> = {
  bride: 'Brud',
  groom: 'Brudgom',
  bestman: 'Bestmann',
  maid_of_honor: 'Forlover',
  parent: 'Forelder',
  toastmaster: 'Toastmaster',
  friend: 'Venn',
  keynote: 'Hovedtaler',
  presenter: 'Presentatør',
  host: 'Konferansier',
  colleague: 'Kollega',
  manager: 'Leder',
  ceo: 'CEO',
};

function getRoleLabel(role?: string): string {
  if (!role) return 'Taler';
  return ROLE_LABELS[role.toLowerCase()] || role;
}

function getRoleIcon(role?: string): React.ReactNode {
  if (!role) return <RecordVoiceOver fontSize="small" />;
  return ROLE_ICONS[role.toLowerCase()] || <RecordVoiceOver fontSize="small" />;
}

function getRoleColor(role?: string): string {
  const colors: Record<string, string> = {
    bride: '#E91E63',
    groom: '#1976D2',
    bestman: '#FF9800',
    maid_of_honor: '#E91E63',
    parent: '#4CAF50',
    toastmaster: '#9C27B0',
    keynote: '#FF5722',
    presenter: '#00BCD4',
    host: '#607D8B',
    friend: '#8BC34A',
    colleague: '#795548',
  };
  if (!role) return '#9E9E9E';
  return colors[role.toLowerCase()] || '#9E9E9E';
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}t ${mins}min` : `${hrs}t`;
}

export default function EvendiSpeeches({ coupleId, organizerName, eventType }: EvendiSpeechesProps) {
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseEventType, setResponseEventType] = useState<string>('');
  const [responseOrganizerName, setResponseOrganizerName] = useState<string>('');

  useEffect(() => {
    if (coupleId) {
      loadSpeeches();
    }
  }, [coupleId]);

  async function loadSpeeches() {
    setLoading(true);
    setError('');
    try {
      const data: SpeechesResponse = await apiRequest(`/api/evendi/speeches/${coupleId}`);
      setSpeeches(data.speeches || []);
      setResponseEventType(data.eventType || '');
      setResponseOrganizerName(data.organizerName || '');
    } catch (err: any) {
      console.error('Failed to load speeches:', err);
      if (err.message?.includes('403')) {
        setError('Tilgang til taler er ikke aktivert for denne kontrakten');
      } else {
        setError('Kunne ikke hente taler');
      }
    } finally {
      setLoading(false);
    }
  }

  const effectiveEventType = eventType || responseEventType || 'wedding';
  const effectiveOrganizerName = organizerName || responseOrganizerName;

  // Feature-gate: only show if this event type supports speeches
  if (effectiveEventType && !isEventFeatureEnabled(effectiveEventType as EventType, 'speeches')) {
    return null;
  }

  const totalDuration = speeches.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Get the right terminology based on event type
  const speechLabel = effectiveEventType === 'wedding' ? 'Taler' :
    effectiveEventType === 'conference' || effectiveEventType === 'seminar' ? 'Programpunkter' :
    effectiveEventType === 'awards_night' ? 'Prisutdelinger & Taler' :
    'Taler / Program';

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RecordVoiceOver sx={{ color: '#9C27B0' }} />
            <Typography variant="h6">{speechLabel}</Typography>
            {effectiveOrganizerName && (
              <Chip
                size="small"
                label={effectiveOrganizerName}
                sx={{ ml: 1, bgcolor: 'rgba(156, 39, 176, 0.1)', color: '#9C27B0' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {speeches.length > 0 && (
              <Tooltip title="Total varighet">
                <Chip
                  icon={<AccessTime />}
                  label={formatDuration(totalDuration)}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            )}
            <Tooltip title="Oppdater">
              <IconButton size="small" onClick={loadSpeeches} disabled={loading}>
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

        {/* Error */}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Empty state */}
        {!loading && !error && speeches.length === 0 && (
          <Alert severity="info" icon={<Mic />}>
            Ingen {speechLabel.toLowerCase()} er lagt til ennå.
            Arrangøren kan legge til {speechLabel.toLowerCase()} i Evendi-appen.
          </Alert>
        )}

        {/* Speech list */}
        {speeches.length > 0 && (
          <List disablePadding>
            {speeches.map((speech, index) => (
              <React.Fragment key={speech.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    px: 1,
                    py: 1.5,
                    cursor: speech.notes ? 'pointer' : 'default',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                  }}
                  onClick={() => {
                    if (speech.notes) {
                      setExpandedId(expandedId === speech.id ? null : speech.id);
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: `${getRoleColor(speech.role)}20`,
                        color: getRoleColor(speech.role),
                        width: 40,
                        height: 40,
                      }}
                    >
                      {getRoleIcon(speech.role)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {speech.speaker_name}
                        </Typography>
                        <Chip
                          size="small"
                          label={getRoleLabel(speech.role)}
                          sx={{
                            bgcolor: `${getRoleColor(speech.role)}15`,
                            color: getRoleColor(speech.role),
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            height: 22,
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {speech.duration_minutes} min
                          </Typography>
                        </Box>
                        {speech.scheduled_time && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              {speech.scheduled_time}
                            </Typography>
                          </Box>
                        )}
                        {speech.notes && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Notes sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Notater
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        size="small"
                        label={`#${speech.sort_order}`}
                        variant="outlined"
                        sx={{ minWidth: 40 }}
                      />
                      {speech.notes && (
                        <IconButton size="small" edge="end">
                          {expandedId === speech.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      )}
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>

                {/* Expandable notes */}
                {speech.notes && (
                  <Collapse in={expandedId === speech.id}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, mx: 1, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {speech.notes}
                      </Typography>
                    </Box>
                  </Collapse>
                )}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Summary footer */}
        {speeches.length > 0 && (
          <>
            <Divider sx={{ mt: 1, mb: 1.5 }} />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">{speeches.length}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {speechLabel}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">{formatDuration(totalDuration)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total varighet
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    {speeches[0]?.scheduled_time || '–'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Første start
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
}
