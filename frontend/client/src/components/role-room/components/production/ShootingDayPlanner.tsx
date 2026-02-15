/**
 * ShootingDayPlanner Component
 * Day-of-Days (DOOD) overview and shooting day management
 * Features: Calendar view, cast availability, conflict detection
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Divider,
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { nb } from 'date-fns/locale';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Restaurant as MealIcon,
  LocalHospital as HospitalIcon,
  LocalParking as ParkingIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  WbSunny as SunnyIcon,
  Cloud as CloudyIcon,
  AcUnit as SnowIcon,
  Water as RainIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  productionWorkflowService,
  ShootingDay,
  CastMember,
  CrewMember,
  StripboardStrip,
} from '../../services/productionWorkflowService';

// ============================================
// TYPES
// ============================================

interface ShootingDayPlannerProps {
  projectId: string;
  onDaySelect?: (dayId: string) => void;
  onGenerateCallSheet?: (dayId: string) => void;
}

interface DayFormData {
  date: Date | null;
  callTime: string;
  location: string;
  locationAddress: string;
  notes: string;
  scenes: string[];
}

interface AvailabilityStatus {
  castId: string;
  available: boolean;
  reason?: string;
}

// ============================================
// CONSTANTS
// ============================================

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  sunny: <SunnyIcon sx={{ color: '#f9a825' }} />,
  cloudy: <CloudyIcon sx={{ color: '#90a4ae' }} />,
  rain: <RainIcon sx={{ color: '#42a5f5' }} />,
  snow: <SnowIcon sx={{ color: '#81d4fa' }} />,
  fog: <CloudyIcon sx={{ color: '#b0bec5' }} />,
  wind: <CloudyIcon sx={{ color: '#78909c' }} />,
};

const STATUS_COLORS: Record<ShootingDay['status'], string> = {
  planned: '#1976d2',
  'in-progress': '#ff9800',
  wrapped: '#4caf50',
  postponed: '#f44336',
  cancelled: '#9e9e9e',
};

// ============================================
// COMPONENT
// ============================================

const ShootingDayPlanner: React.FC<ShootingDayPlannerProps> = ({
  projectId,
  onDaySelect,
  onGenerateCallSheet,
}) => {
  // State
  const [shootingDays, setShootingDays] = useState<ShootingDay[]>([]);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [strips, setStrips] = useState<StripboardStrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<ShootingDay | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [conflicts, setConflicts] = useState<Map<string, string[]>>(new Map());
  
  const [formData, setFormData] = useState<DayFormData>({
    date: null,
    callTime: '07:00',
    location: '',
    locationAddress: '',
    notes: '',
    scenes: [],
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [dayData, castData, crewData, stripData] = await Promise.all([
          productionWorkflowService.getShootingDays(projectId),
          productionWorkflowService.getCast(projectId),
          productionWorkflowService.getCrew(projectId),
          productionWorkflowService.getStripboard(projectId),
        ]);
        setShootingDays(dayData);
        setCast(castData);
        setCrew(crewData);
        setStrips(stripData);
        
        // Check conflicts for each day
        const conflictMap = new Map<string, string[]>();
        for (const day of dayData) {
          const result = await productionWorkflowService.getScheduleConflicts(day.date);
          const issues: string[] = [];
          result.castConflicts.forEach(c => issues.push(c.reason));
          result.crewConflicts.forEach(c => issues.push(c.reason));
          if (issues.length > 0) {
            conflictMap.set(day.id, issues);
          }
        }
        setConflicts(conflictMap);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  // Calculate Day-out-of-Days (DOOD)
  const dood = useMemo(() => {
    return productionWorkflowService.calculateDayOutOfDays(cast, strips);
  }, [cast, strips]);

  // Stats
  const stats = useMemo(() => {
    const total = shootingDays.length;
    const wrapped = shootingDays.filter(d => d.status === 'wrapped').length;
    const planned = shootingDays.filter(d => d.status === 'planned').length;
    const inProgress = shootingDays.filter(d => d.status === 'in-progress').length;
    
    const totalPages = strips.reduce((sum, s) => sum + s.pages, 0);
    const pagesShot = strips.filter(s => s.status === 'shot').reduce((sum, s) => sum + s.pages, 0);
    
    return { total, wrapped, planned, inProgress, totalPages, pagesShot };
  }, [shootingDays, strips]);

  // Handlers
  const handleCreateDay = useCallback(async () => {
    if (!formData.date || !formData.location) return;
    
    const newDay = await productionWorkflowService.createShootingDay({
      projectId,
      dayNumber: shootingDays.length + 1,
      date: formData.date.toISOString().split('T')[0],
      callTime: formData.callTime,
      location: formData.location,
      locationAddress: formData.locationAddress,
      notes: formData.notes,
      scenes: formData.scenes,
      status: 'planned',
      crewCallTimes: {},
      castCallTimes: {},
      equipmentNeeded: [],
      meals: [],
    });
    
    setShootingDays(prev => [...prev, newDay]);
    setShowCreateDialog(false);
    setFormData({
      date: null,
      callTime: '07:00',
      location: '',
      locationAddress: '',
      notes: '',
      scenes: [],
    });
  }, [formData, projectId, shootingDays.length]);

  const handleUpdateStatus = useCallback(async (dayId: string, status: ShootingDay['status']) => {
    const updated = await productionWorkflowService.updateShootingDay(dayId, { status });
    if (updated) {
      setShootingDays(prev => prev.map(d => d.id === dayId ? updated : d));
    }
  }, []);

  const getCastForDay = useCallback((dayId: string): CastMember[] => {
    const dayStrips = strips.filter(s => s.shootingDayId === dayId);
    const characterNames = new Set(dayStrips.flatMap(s => s.cast));
    return cast.filter(c => characterNames.has(c.character));
  }, [strips, cast]);

  // Render day card
  const renderDayCard = (day: ShootingDay) => {
    const dayCast = getCastForDay(day.id);
    const dayConflicts = conflicts.get(day.id) || [];
    const dayStrips = strips.filter(s => s.shootingDayId === day.id);
    const totalPages = dayStrips.reduce((sum, s) => sum + s.pages, 0);
    const totalTime = dayStrips.reduce((sum, s) => sum + s.estimatedTime, 0);
    
    return (
      <Card
        key={day.id}
        sx={{
          mb: 2,
          border: `2px solid ${STATUS_COLORS[day.status]}`,
          cursor: 'pointer',
          '&:hover': { boxShadow: 4 },
        }}
        onClick={() => {
          setSelectedDay(day);
          setShowDetailsDialog(true);
        }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: STATUS_COLORS[day.status] }}>
              {day.dayNumber}
            </Avatar>
          }
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">Dag {day.dayNumber}</Typography>
              {dayConflicts.length > 0 && (
                <Tooltip title={dayConflicts.join(', ')}>
                  <Badge badgeContent={dayConflicts.length} color="error">
                    <WarningIcon color="error" />
                  </Badge>
                </Tooltip>
              )}
            </Box>
          }
          subheader={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                icon={<EventIcon />}
                label={new Date(day.date).toLocaleDateString('nb-NO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
                size="small"
              />
              <Chip
                label={day.status === 'wrapped' ? 'Ferdig' : 
                       day.status === 'in-progress' ? 'Pågår' : 
                       day.status === 'planned' ? 'Planlagt' : 'Utsatt'}
                size="small"
                sx={{ bgcolor: STATUS_COLORS[day.status], color: '#fff' }}
              />
            </Box>
          }
          action={
            day.weather && WEATHER_ICONS[day.weather.condition]
          }
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PlaceIcon fontSize="small" color="action" />
                <Typography variant="body2">{day.location}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TimeIcon fontSize="small" color="action" />
                <Typography variant="body2">Call: {day.callTime}</Typography>
              </Box>
              {day.weather && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {day.weather.temperature}°C | ☀️ {day.weather.sunrise} - 🌙 {day.weather.sunset}
                  </Typography>
                </Box>
              )}
            </Grid>
            <Grid size={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {dayStrips.length} scener | {totalPages}p | {Math.floor(totalTime / 60)}t {totalTime % 60}m
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Box sx={{ display: 'flex' }}>
                  {dayCast.slice(0, 4).map(c => (
                    <Tooltip key={c.id} title={`${c.name} (${c.character})`}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 10, ml: -0.5, border: '2px solid white' }}>{c.name[0]}</Avatar>
                    </Tooltip>
                  ))}
                  {dayCast.length > 4 && (
                    <Avatar sx={{ width: 24, height: 24, fontSize: 10, ml: -0.5, bgcolor: 'grey.400' }}>+{dayCast.length - 4}</Avatar>
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
          
          {day.notes && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
              📝 {day.notes}
            </Typography>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onGenerateCallSheet?.(day.id);
              }}
            >
              Call Sheet
            </Button>
            {day.status === 'planned' && (
              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateStatus(day.id, 'in-progress');
                }}
              >
                Start dag
              </Button>
            )}
            {day.status === 'in-progress' && (
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateStatus(day.id, 'wrapped');
                }}
              >
                Wrap dag
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Render DOOD table
  const renderDOODTable = () => (
    <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>Skuespiller</TableCell>
            <TableCell sx={{ fontWeight: 'bold', minWidth: 120 }}>Rolle</TableCell>
            {shootingDays.map(day => (
              <TableCell 
                key={day.id} 
                align="center"
                sx={{ 
                  fontWeight: 'bold',
                  minWidth: 50,
                  bgcolor: STATUS_COLORS[day.status],
                  color: '#fff',
                }}
              >
                {day.dayNumber}
              </TableCell>
            ))}
            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Totalt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cast.map(member => {
            const memberDood = dood[member.id];
            return (
              <TableRow key={member.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>
                      {member.name[0]}
                    </Avatar>
                    <Typography variant="body2">{member.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {member.character}
                  </Typography>
                </TableCell>
                {shootingDays.map(day => {
                  const isWorkDay = memberDood?.workDays.includes(day.dayNumber);
                  const isAvailable = member.availability[day.date] !== false;
                  
                  return (
                    <TableCell key={day.id} align="center">
                      {isWorkDay ? (
                        <Tooltip title={isAvailable ? 'Arbeidsdag' : 'KONFLIKT - Ikke tilgjengelig!'}>
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: isAvailable ? '#4caf50' : '#f44336',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mx: 'auto',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 'bold',
                            }}
                          >
                            W
                          </Box>
                        </Tooltip>
                      ) : isAvailable ? (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      ) : (
                        <Tooltip title="Ikke tilgjengelig">
                          <CancelIcon fontSize="small" color="error" />
                        </Tooltip>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell align="center">
                  <Chip
                    label={`${memberDood?.totalDays || 0} dager`}
                    size="small"
                    color="primary"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>
          Laster opptaksplan...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">
            📅 Opptaksplan - TROLL
          </Typography>
          <Chip
            label={`${stats.wrapped}/${stats.total} dager ferdig`}
            color={stats.wrapped === stats.total ? 'success' : 'default'}
            size="small"
          />
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowCreateDialog(true)}
        >
          Ny opptaksdag
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2}>
          <Grid size={2}>
            <Box textAlign="center">
              <Typography variant="h5" color="primary.main">{stats.total}</Typography>
              <Typography variant="caption">Opptaksdager</Typography>
            </Box>
          </Grid>
          <Grid size={2}>
            <Box textAlign="center">
              <Typography variant="h5" color="success.main">{stats.wrapped}</Typography>
              <Typography variant="caption">Ferdig</Typography>
            </Box>
          </Grid>
          <Grid size={2}>
            <Box textAlign="center">
              <Typography variant="h5" color="warning.main">{stats.inProgress}</Typography>
              <Typography variant="caption">Pågår</Typography>
            </Box>
          </Grid>
          <Grid size={2}>
            <Box textAlign="center">
              <Typography variant="h5" color="info.main">{stats.planned}</Typography>
              <Typography variant="caption">Planlagt</Typography>
            </Box>
          </Grid>
          <Grid size={4}>
            <Box>
              <Typography variant="caption">Totalt fremdrift</Typography>
              <LinearProgress
                variant="determinate"
                value={(stats.pagesShot / stats.totalPages) * 100}
                sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
              />
              <Typography variant="caption" color="text.secondary">
                {stats.pagesShot.toFixed(1)} / {stats.totalPages} sider skutt
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, v) => setCurrentTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab label="Opptaksdager" />
        <Tab label="Day-out-of-Days (DOOD)" />
        <Tab label="Kalendervisning" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {currentTab === 0 && (
          <Grid container spacing={2}>
            {shootingDays.map(day => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={day.id}>
                {renderDayCard(day)}
              </Grid>
            ))}
            {shootingDays.length === 0 && (
              <Grid size={12}>
                <Alert severity="info">
                  Ingen opptaksdager er planlagt ennå. Klikk "Ny opptaksdag" for å begynne.
                </Alert>
              </Grid>
            )}
          </Grid>
        )}
        
        {currentTab === 1 && renderDOODTable()}
        
        {currentTab === 2 && (
          <Alert severity="info">
            Kalendervisning kommer snart. Kobles til ProductionCalendarPanel.
          </Alert>
        )}
      </Box>

      {/* Create Day Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opprett ny opptaksdag</DialogTitle>
        <DialogContent>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={6}>
                <DatePicker
                  label="Dato"
                  value={formData.date}
                  onChange={(date) => setFormData({ ...formData, date })}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Call time"
                  type="time"
                  value={formData.callTime}
                  onChange={(e) => setFormData({ ...formData, callTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Lokasjon"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="f.eks. Dovre - Tunnelåpning"
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={formData.locationAddress}
                  onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                  placeholder="f.eks. Hjerkinnvegen 200, 2661 Hjerkinn"
                />
              </Grid>
              <Grid size={12}>
                <TextField
                fullWidth
                multiline
                rows={3}
                label="Notater"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Spesielle instruksjoner, VFX-krav, etc."
              />
            </Grid>
          </Grid>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleCreateDay}
            disabled={!formData.date || !formData.location}
          >
            Opprett dag
          </Button>
        </DialogActions>
      </Dialog>

      {/* Day Details Dialog */}
      <Dialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedDay && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: STATUS_COLORS[selectedDay.status] }}>
                  {selectedDay.dayNumber}
                </Avatar>
                <Box>
                  <Typography variant="h6">Dag {selectedDay.dayNumber}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(selectedDay.date).toLocaleDateString('nb-NO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid size={6}>
                  <Typography variant="subtitle2" gutterBottom>Lokasjon</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <PlaceIcon color="action" />
                    <Box>
                      <Typography>{selectedDay.location}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedDay.locationAddress}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Typography variant="subtitle2" gutterBottom>Call time</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <TimeIcon color="action" />
                    <Typography>{selectedDay.callTime}</Typography>
                  </Box>
                  
                  {selectedDay.weather && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>Vær</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {WEATHER_ICONS[selectedDay.weather.condition]}
                        <Typography>
                          {selectedDay.weather.temperature}°C | 
                          ☀️ {selectedDay.weather.sunrise} - 
                          🌙 {selectedDay.weather.sunset}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Grid>
                
                <Grid size={6}>
                  <Typography variant="subtitle2" gutterBottom>Scener</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {strips
                      .filter(s => s.shootingDayId === selectedDay.id)
                      .map(s => (
                        <Chip
                          key={s.id}
                          label={`Scene ${s.sceneNumber}`}
                          size="small"
                          sx={{ bgcolor: s.color }}
                        />
                      ))}
                  </Box>
                  
                  <Typography variant="subtitle2" gutterBottom>Cast</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {getCastForDay(selectedDay.id).map(c => (
                      <Chip
                        key={c.id}
                        avatar={<Avatar>{c.name[0]}</Avatar>}
                        label={c.character}
                        size="small"
                      />
                    ))}
                  </Box>
                </Grid>
                
                {selectedDay.notes && (
                  <Grid size={12}>
                    <Alert severity="info">{selectedDay.notes}</Alert>
                  </Grid>
                )}
                
                {selectedDay.dailyReport && (
                  <Grid size={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>Dagsrapport</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Chip
                        icon={<CheckCircleIcon />}
                        label={`${selectedDay.dailyReport.completedScenes.length} scener ferdig`}
                        color="success"
                        size="small"
                      />
                      <Chip
                        label={`${selectedDay.dailyReport.pagesShot} sider`}
                        size="small"
                      />
                      <Chip
                        label={`${selectedDay.dailyReport.totalSetups} setups`}
                        size="small"
                      />
                    </Box>
                    {selectedDay.dailyReport.delays.length > 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Forsinkelser: {selectedDay.dailyReport.delays.map(d => `${d.reason} (${d.duration}m)`).join(', ')}
                      </Alert>
                    )}
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowDetailsDialog(false)}>Lukk</Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => {
                  onGenerateCallSheet?.(selectedDay.id);
                  setShowDetailsDialog(false);
                }}
              >
                Generer Call Sheet
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ShootingDayPlanner;
