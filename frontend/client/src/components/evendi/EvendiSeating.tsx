import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  TableRestaurant,
  Person,
  Groups,
  ExpandMore,
  ExpandLess,
  Refresh,
  Chair,
  EventSeat,
  Lock,
} from '@mui/icons-material';
import { isEventFeatureEnabled, EventType, getEventTypeLabel } from '@/lib/evendi-api';

interface Guest {
  guestId: string;
  guestName: string;
  guestCategory?: string;
  seatNumber?: number;
}

interface SeatingTable {
  id: string;
  tableNumber: number;
  name: string;
  category?: string;
  label?: string;
  seats: number;
  isReserved: boolean;
  vendorNotes?: string;
  sortOrder: number;
  guests: Guest[];
}

interface TablesResponse {
  tables: SeatingTable[];
  coupleId: string;
  eventType: string;
  organizerName: string;
  totalTables: number;
  totalSeats: number;
  assignedGuests: number;
}

interface EvendiSeatingProps {
  coupleId: string;
  organizerName?: string;
  eventType?: EventType;
}

const CATEGORY_LABELS: Record<string, string> = {
  bride_family: 'Brudens familie',
  groom_family: 'Brudgommens familie',
  friends: 'Venner',
  colleagues: 'Kolleger',
  reserved: 'Reservert',
  main: 'Hovedbord',
  vip: 'VIP',
  speakers: 'Foredragsholdere',
  management: 'Ledelse',
  team: 'Team',
  clients: 'Kunder',
};

const CATEGORY_COLORS: Record<string, string> = {
  bride_family: '#E91E63',
  groom_family: '#1976D2',
  friends: '#4CAF50',
  colleagues: '#FF9800',
  reserved: '#9E9E9E',
  main: '#9C27B0',
  vip: '#FFD700',
  speakers: '#FF5722',
  management: '#607D8B',
  team: '#00BCD4',
  clients: '#795548',
};

function getCategoryLabel(category?: string): string {
  if (!category) return 'Standard';
  return CATEGORY_LABELS[category.toLowerCase()] || category;
}

function getCategoryColor(category?: string): string {
  if (!category) return '#9E9E9E';
  return CATEGORY_COLORS[category.toLowerCase()] || '#9E9E9E';
}

export default function EvendiSeating({ coupleId, organizerName, eventType }: EvendiSeatingProps) {
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);
  const [responseEventType, setResponseEventType] = useState<string>('');
  const [responseOrganizerName, setResponseOrganizerName] = useState<string>('');
  const [stats, setStats] = useState({ totalTables: 0, totalSeats: 0, assignedGuests: 0 });

  useEffect(() => {
    if (coupleId) {
      loadTables();
    }
  }, [coupleId]);

  async function loadTables() {
    setLoading(true);
    setError('');
    try {
      const data: TablesResponse = await apiRequest(`/api/evendi/tables/${coupleId}`);
      setTables(data.tables || []);
      setResponseEventType(data.eventType || '');
      setResponseOrganizerName(data.organizerName || '');
      setStats({
        totalTables: data.totalTables || 0,
        totalSeats: data.totalSeats || 0,
        assignedGuests: data.assignedGuests || 0,
      });
    } catch (err: any) {
      console.error('Failed to load tables:', err);
      if (err.message?.includes('403')) {
        setError('Tilgang til bordplassering er ikke aktivert for denne kontrakten');
      } else {
        setError('Kunne ikke hente bordplassering');
      }
    } finally {
      setLoading(false);
    }
  }

  const effectiveEventType = eventType || responseEventType || 'wedding';
  const effectiveOrganizerName = organizerName || responseOrganizerName;

  // Feature-gate
  if (effectiveEventType && !isEventFeatureEnabled(effectiveEventType as EventType, 'seating')) {
    return null;
  }

  const seatingLabel = effectiveEventType === 'wedding' ? 'Bordplassering' :
    effectiveEventType === 'conference' || effectiveEventType === 'seminar' ? 'Plassering' :
    'Bordoversikt';

  const occupancyPercent = stats.totalSeats > 0
    ? Math.round((stats.assignedGuests / stats.totalSeats) * 100)
    : 0;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableRestaurant sx={{ color: '#1976D2' }} />
            <Typography variant="h6">{seatingLabel}</Typography>
            {effectiveOrganizerName && (
              <Chip
                size="small"
                label={effectiveOrganizerName}
                sx={{ ml: 1, bgcolor: 'rgba(25, 118, 210, 0.1)', color: '#1976D2' }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Oppdater">
              <IconButton size="small" onClick={loadTables} disabled={loading}>
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
        {!loading && !error && tables.length === 0 && (
          <Alert severity="info" icon={<EventSeat />}>
            Ingen {seatingLabel.toLowerCase()} er satt opp ennå.
            Arrangøren kan sette opp bord i Evendi-appen.
          </Alert>
        )}

        {/* Stats row */}
        {tables.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(25, 118, 210, 0.05)', borderRadius: 2 }}>
                  <Typography variant="h5" color="primary" fontWeight={700}>
                    {stats.totalTables}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Bord</Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.05)', borderRadius: 2 }}>
                  <Typography variant="h5" sx={{ color: '#4CAF50' }} fontWeight={700}>
                    {stats.assignedGuests}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Plassert</Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(156, 39, 176, 0.05)', borderRadius: 2 }}>
                  <Typography variant="h5" sx={{ color: '#9C27B0' }} fontWeight={700}>
                    {stats.totalSeats}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Plasser totalt</Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Occupancy bar */}
            <Box sx={{ mt: 2, px: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Belegg</Typography>
                <Typography variant="caption" color="text.secondary">{occupancyPercent}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={occupancyPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(0,0,0,0.08)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    bgcolor: occupancyPercent > 90 ? '#4CAF50' : occupancyPercent > 50 ? '#FF9800' : '#1976D2',
                  },
                }}
              />
            </Box>
          </Box>
        )}

        {/* Tables list */}
        {tables.length > 0 && (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.03)' }}>
                  <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Bord</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kategori</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Gjester</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>Plasser</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tables.map((table) => (
                  <React.Fragment key={table.id}>
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: expandedTableId === table.id ? 0 : undefined } }}
                      onClick={() => setExpandedTableId(expandedTableId === table.id ? null : table.id)}
                    >
                      <TableCell>
                        <Chip
                          size="small"
                          label={table.tableNumber}
                          sx={{ minWidth: 32, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            {table.name}
                          </Typography>
                          {table.isReserved && (
                            <Tooltip title="Reservert">
                              <Lock sx={{ fontSize: 14, color: '#FF9800' }} />
                            </Tooltip>
                          )}
                          {table.label && (
                            <Typography variant="caption" color="text.secondary">
                              ({table.label})
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={getCategoryLabel(table.category)}
                          sx={{
                            bgcolor: `${getCategoryColor(table.category)}15`,
                            color: getCategoryColor(table.category),
                            fontSize: '0.7rem',
                            height: 22,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Badge
                          badgeContent={table.guests.length}
                          color={table.guests.length >= table.seats ? 'success' : 'primary'}
                          max={99}
                        >
                          <Groups sx={{ color: 'text.secondary' }} />
                        </Badge>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color="text.secondary">
                          {table.guests.length}/{table.seats}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small">
                          {expandedTableId === table.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Expanded guest list */}
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                        <Collapse in={expandedTableId === table.id}>
                          <Box sx={{ py: 1.5, px: 2, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, mb: 1 }}>
                            {table.vendorNotes && (
                              <Alert severity="info" sx={{ mb: 1.5 }} variant="outlined">
                                <Typography variant="caption">{table.vendorNotes}</Typography>
                              </Alert>
                            )}

                            {table.guests.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontStyle: 'italic' }}>
                                Ingen gjester plassert ved dette bordet ennå.
                              </Typography>
                            ) : (
                              <Grid container spacing={1}>
                                {table.guests.map((guest) => (
                                  <Grid item xs={12} sm={6} md={4} key={guest.guestId}>
                                    <Box sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      p: 0.75,
                                      bgcolor: 'white',
                                      borderRadius: 1,
                                      border: '1px solid rgba(0,0,0,0.08)',
                                    }}>
                                      <Chair sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="body2" noWrap>
                                        {guest.guestName}
                                      </Typography>
                                      {guest.seatNumber && (
                                        <Chip
                                          size="small"
                                          label={`Plass ${guest.seatNumber}`}
                                          sx={{ fontSize: '0.65rem', height: 18, ml: 'auto' }}
                                        />
                                      )}
                                    </Box>
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
