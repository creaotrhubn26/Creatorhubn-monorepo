import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Badge,
} from '@mui/material';
import {
  SupervisorAccount,
  Person,
  Visibility,
  Edit,
  Event,
  Mic,
  Refresh,
  CheckCircle,
  Schedule,
} from '@mui/icons-material';
import type { EventType } from '@/lib/evendi-api';

interface Coordinator {
  id: string;
  name: string;
  roleLabel: string;
  email?: string;
  canViewSpeeches: boolean;
  canViewSchedule: boolean;
  canEditSpeeches: boolean;
  canEditSchedule: boolean;
  status: string;
  lastAccessedAt?: string;
  createdAt: string;
}

interface CoordinatorsResponse {
  coordinators: Coordinator[];
  coupleId: string;
  eventType: string;
  organizerName: string;
  totalCoordinators: number;
}

interface EvendiCoordinatorsProps {
  coupleId: string;
  organizerName?: string;
  eventType?: EventType | string;
}

const ROLE_COLORS: Record<string, string> = {
  'Toastmaster': '#9C27B0',
  'Koordinator': '#1976D2',
  'Bestmann': '#FF9800',
  'Forlover': '#E91E63',
  'Programansvarlig': '#4CAF50',
  'Seremonimester': '#FF5722',
  'Teknisk ansvarlig': '#607D8B',
  'DJ': '#00BCD4',
};

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || '#9E9E9E';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Aldri';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Nettopp';
    if (diffMins < 60) return `${diffMins} min siden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}t siden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d siden`;
    return formatDate(dateStr);
  } catch { return 'Ukjent'; }
}

export default function EvendiCoordinators({ coupleId, organizerName, eventType }: EvendiCoordinatorsProps) {
  const { toast } = useToast();
  const [data, setData] = useState<CoordinatorsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (coupleId) loadCoordinators();
  }, [coupleId]);

  async function loadCoordinators() {
    setLoading(true);
    try {
      const result: CoordinatorsResponse = await apiRequest(`/api/evendi/coordinators/${coupleId}`);
      setData(result);
    } catch (err: any) {
      console.error('Failed to load coordinators:', err);
      if (err.message?.includes('403')) {
        toast({ title: 'Ingen tilgang', description: 'Tilgang til koordinatorer er ikke aktivert for denne kontrakten', variant: 'warning' });
      } else {
        toast({ title: 'Feil', description: 'Kunne ikke hente koordinatorer', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }

  const effectiveEventType = eventType || data?.eventType || 'wedding';

  const coordinatorLabel = effectiveEventType === 'wedding' ? 'Koordinatorer & Toastmastere' :
    effectiveEventType === 'conference' || effectiveEventType === 'seminar' ? 'Programledere' :
    'Koordinatorer';

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SupervisorAccount sx={{ color: '#4CAF50' }} />
            <Typography variant="h6">{coordinatorLabel}</Typography>
            {(organizerName || data?.organizerName) && (
              <Chip
                size="small"
                label={organizerName || data?.organizerName}
                sx={{ ml: 1, bgcolor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {data && (
              <Chip
                icon={<Person />}
                label={`${data.totalCoordinators} aktive`}
                size="small"
                variant="outlined"
              />
            )}
            <Tooltip title="Oppdater">
              <IconButton size="small" onClick={loadCoordinators} disabled={loading}>
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
        {!loading && (!data?.coordinators || data.coordinators.length === 0) && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <SupervisorAccount sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              Ingen {coordinatorLabel.toLowerCase()} er lagt til ennå.
              Arrangøren kan invitere koordinatorer i Evendi-appen.
            </Typography>
          </Box>
        )}

        {/* Coordinator list */}
        {data && data.coordinators.length > 0 && (
          <List disablePadding>
            {data.coordinators.map((coord, index) => (
              <React.Fragment key={coord.id}>
                {index > 0 && <Divider />}
                <ListItem sx={{ px: 1, py: 1.5 }}>
                  <ListItemAvatar>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        coord.lastAccessedAt ? (
                          <CheckCircle sx={{ fontSize: 14, color: '#4CAF50', bgcolor: 'white', borderRadius: '50%' }} />
                        ) : null
                      }
                    >
                      <Avatar sx={{
                        bgcolor: getRoleColor(coord.roleLabel),
                        width: 40,
                        height: 40,
                        fontSize: 16,
                      }}>
                        {coord.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{coord.name}</Typography>
                        <Chip
                          label={coord.roleLabel}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            bgcolor: `${getRoleColor(coord.roleLabel)}15`,
                            color: getRoleColor(coord.roleLabel),
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {/* Permissions */}
                        {coord.canViewSchedule && (
                          <Tooltip title="Kan se tidslinje">
                            <Chip icon={<Visibility sx={{ fontSize: '14px !important' }} />} label="Tidslinje" size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                          </Tooltip>
                        )}
                        {coord.canViewSpeeches && (
                          <Tooltip title="Kan se taler">
                            <Chip icon={<Mic sx={{ fontSize: '14px !important' }} />} label="Taler" size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                          </Tooltip>
                        )}
                        {coord.canEditSchedule && (
                          <Tooltip title="Kan redigere tidslinje">
                            <Chip icon={<Edit sx={{ fontSize: '14px !important' }} />} label="Rediger tidslinje" size="small" color="primary" sx={{ height: 20, fontSize: 10 }} />
                          </Tooltip>
                        )}
                        {coord.canEditSpeeches && (
                          <Tooltip title="Kan redigere taler">
                            <Chip icon={<Edit sx={{ fontSize: '14px !important' }} />} label="Rediger taler" size="small" color="secondary" sx={{ height: 20, fontSize: 10 }} />
                          </Tooltip>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Sist aktiv
                      </Typography>
                      <Typography variant="caption" fontWeight={500} sx={{
                        color: coord.lastAccessedAt ? '#4CAF50' : 'text.disabled'
                      }}>
                        {formatRelativeTime(coord.lastAccessedAt)}
                      </Typography>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
