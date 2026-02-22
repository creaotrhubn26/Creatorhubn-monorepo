import { useTheming } from '../../../utils/theming-helper';
import { useAuth } from '@/hooks/useAuth';
import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  CircularProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  InputAdornment,
} from '@mui/material';
import {
  Build,
  CameraAlt,
  Schedule,
  Notifications,
  Security,
  CheckCircle,
  ExpandMore,
  CalendarToday,
  MonetizationOn,
  TrendingUp,
  Assessment,
  MusicNote,
  Memory,
  Lens,
  AutoMode,
  Alarm,
  NotificationImportant,
  Receipt,
  Lightbulb,
  SdCard,
  CameraOutdoor as CameraStand,
  LinearScale,
  FlashOn,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface EquipmentMaintenanceSchedulerProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  mode?: 'standalone' | 'integrated';
  onMaintenanceScheduled?: (maintenanceData: MaintenanceTask[]) => void;
}

interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  type:
    | 'camera'
    | 'lens'
    | 'audio'
    | 'software'
    | 'accessory'
    | 'computer'
    | 'lighting'
    | 'memory'
    | 'tripod'
    | 'slider'
    | 'flash';
  purchaseDate: Date;
  warrantyExpiry: Date;
  lastService: Date | null;
  nextService: Date;
  serviceInterval: number; // months
  estimatedLifespan: number; // years
  currentAge: number; // years
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  usageHours: number;
  maintenanceCost: number;
  replacementCost: number;
  criticalToOperation: boolean;
  autoSchedule: boolean;
  maintenanceNotes: string;
}

interface MaintenanceTask {
  id: string;
  equipmentId: string;
  equipmentName: string;
  taskType: 'cleaning' | 'calibration' | 'repair' | 'inspection' | 'replacement' | 'upgrade';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledDate: Date;
  estimatedDuration: number; // hours
  estimatedCost: number;
  assignedTechnician: string;
  technicianContact: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  completedDate?: Date;
  actualCost?: number;
  actualDuration?: number;
  notes: string;
  partsRequired: string[];
  safetyRequirements: string[];
  reminderSent: boolean;
  automatedBooking: boolean;
}

interface EquipmentApi {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber?: string | null;
  type: Equipment['type'];
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  lastService?: string | null;
  nextService?: string | null;
  serviceInterval?: number | null;
  estimatedLifespan?: number | null;
  currentAge?: number | null;
  condition?: Equipment['condition'] | null;
  usageHours?: number | null;
  maintenanceCost?: number | null;
  replacementCost?: number | null;
  criticalToOperation?: boolean | null;
  autoSchedule?: boolean | null;
  maintenanceNotes?: string | null;
}

interface MaintenanceTaskApi {
  id: string;
  equipmentId: string;
  equipmentName: string;
  taskType: MaintenanceTask['taskType'];
  title: string;
  description: string;
  priority: MaintenanceTask['priority'];
  scheduledDate: string;
  estimatedDuration: number;
  estimatedCost: number;
  assignedTechnician: string;
  technicianContact: string;
  status: MaintenanceTask['status'];
  completedDate?: string | null;
  actualCost?: number | null;
  actualDuration?: number | null;
  notes: string;
  partsRequired: string[];
  safetyRequirements: string[];
  reminderSent: boolean;
  automatedBooking: boolean;
}

export default function EquipmentMaintenanceScheduler({
  profession = 'photographer',
  onMaintenanceScheduled,
}: EquipmentMaintenanceSchedulerProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [activeTab, setActiveTab] = useState(0);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<MaintenanceTask>>({
    taskType: 'cleaning',
    priority: 'medium',
    scheduledDate: new Date(),
    estimatedDuration: 1,
    estimatedCost: 0,
    assignedTechnician: '',
    notes: '',
    partsRequired: [],
    safetyRequirements: [],
    automatedBooking: false,
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [autoSchedulingEnabled, setAutoSchedulingEnabled] = useState(true);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming(profession);

  const professionColors = {
    photographer: '#ff8c00',
    videographer: '#e74c30',
    musicproducer: '#9b59b0',
    vendor: '#27ae60',
  };

  const color = professionColors[profession] ?? '#ff8c00';

  // Equipment and maintenance queries
  const { data: equipmentData = [], isLoading: isLoadingEquipment } = useQuery<
    EquipmentApi[]
  >({
    queryKey: ['/api/maintenance/equipment', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/maintenance/equipment?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as EquipmentApi[],
    staleTime: 1000 * 60 * 10, // 10 minutes
    enabled: Boolean(userId),
  });

  const { data: maintenanceData = [], isLoading: isLoadingMaintenance } = useQuery<
    MaintenanceTaskApi[]
  >({
    queryKey: ['/api/maintenance/tasks', profession, userId],
    queryFn: async () =>
      (await apiRequest(
        `/api/maintenance/tasks?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId ?? '')}`
      )) as MaintenanceTaskApi[],
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: Boolean(userId),
  });

  const equipment = useMemo<Equipment[]>(() => {
    return equipmentData.map((item) => {
      const purchaseDate = item.purchaseDate ? new Date(item.purchaseDate) : new Date();
      const warrantyExpiry = item.warrantyExpiry
        ? new Date(item.warrantyExpiry)
        : new Date(purchaseDate.getTime() + 1000 * 60 * 60 * 24 * 365 * 2);
      const lastService = item.lastService ? new Date(item.lastService) : null;
      const nextService = item.nextService
        ? new Date(item.nextService)
        : new Date();
      const estimatedLifespan = item.estimatedLifespan ?? 7;
      const currentAge = item.currentAge ??
        Math.max(0, (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365));

      return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serialNumber || '',
        type: item.type,
        purchaseDate,
        warrantyExpiry,
        lastService,
        nextService,
        serviceInterval: item.serviceInterval ?? 12,
        estimatedLifespan,
        currentAge,
        condition: item.condition ?? 'good',
        usageHours: item.usageHours ?? 0,
        maintenanceCost: item.maintenanceCost ?? 0,
        replacementCost: item.replacementCost ?? 0,
        criticalToOperation: Boolean(item.criticalToOperation),
        autoSchedule: Boolean(item.autoSchedule),
        maintenanceNotes: item.maintenanceNotes ?? '',
      };
    });
  }, [equipmentData]);

  const mapMaintenanceTask = (task: MaintenanceTaskApi): MaintenanceTask => ({
    id: task.id,
    equipmentId: task.equipmentId,
    equipmentName: task.equipmentName,
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    priority: task.priority,
    scheduledDate: new Date(task.scheduledDate),
    estimatedDuration: task.estimatedDuration,
    estimatedCost: task.estimatedCost,
    assignedTechnician: task.assignedTechnician,
    technicianContact: task.technicianContact,
    status: task.status,
    completedDate: task.completedDate ? new Date(task.completedDate) : undefined,
    actualCost: task.actualCost ?? undefined,
    actualDuration: task.actualDuration ?? undefined,
    notes: task.notes,
    partsRequired: task.partsRequired,
    safetyRequirements: task.safetyRequirements,
    reminderSent: task.reminderSent,
    automatedBooking: task.automatedBooking,
  });

  const maintenanceTasks = useMemo<MaintenanceTask[]>(() => {
    return maintenanceData.map(mapMaintenanceTask);
  }, [maintenanceData]);

  type ConditionColor = 'success' | 'info' | 'warning' | 'error';

  const conditionColors: Record<Equipment['condition'], ConditionColor> = {
    excellent: 'success',
    good: 'info',
    fair: 'warning',
    poor: 'warning',
    critical: 'error',
  };

  const priorityConfig: Record<MaintenanceTask['priority'], { color: ConditionColor; urgency: string }> = {
    low: { color: 'success', urgency: 'Lav prioritet' },
    medium: { color: 'info', urgency: 'Medium prioritet' },
    high: { color: 'warning', urgency: 'Høy prioritet' },
    critical: { color: 'error', urgency: 'Kritisk prioritet' },
  };

  const autoScheduleMutation = useMutation<MaintenanceTaskApi[], Error, void>({
    mutationFn: async () =>
      apiRequest('/api/maintenance/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profession }),
      }),
    onSuccess: (tasks: MaintenanceTaskApi[]) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/maintenance/tasks', profession, userId],
      });
      if (onMaintenanceScheduled) {
        onMaintenanceScheduled(tasks.map(mapMaintenanceTask));
      }
    },
  });

  const scheduleTaskMutation = useMutation<MaintenanceTaskApi, Error, Record<string, unknown>>({
    mutationFn: async (payload) =>
      apiRequest('/api/maintenance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (task: MaintenanceTaskApi) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/maintenance/tasks', profession, userId],
      });
      if (onMaintenanceScheduled) {
        onMaintenanceScheduled([mapMaintenanceTask(task)]);
      }
    },
  });

  const calculateMaintenanceScore = (item: Equipment): number => {
    const ageScore = Math.max(
      0,
      100 - (item.currentAge / item.estimatedLifespan) * 100
    );
    const conditionScore = {
      excellent: 100,
      good: 80,
      fair: 60,
      poor: 40,
      critical: 20,
    }[item.condition];

    const daysSinceService = item.lastService
      ? Math.floor((Date.now() - item.lastService.getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const serviceScore = Math.max(
      0,
      100 - (daysSinceService / (item.serviceInterval * 30)) * 100
    );

    return Math.round((ageScore + conditionScore + serviceScore) / 3);
  };

  const generateMaintenanceSchedule = async () => {
    setIsScheduling(true);
    try {
      if (!userId) {
        throw new Error('Missing user ID for auto-scheduling');
      }
      await autoScheduleMutation.mutateAsync();
    } catch (error) {
      console.error('Error generating maintenance schedule: ', error);
    } finally {
      setIsScheduling(false);
    }
  };

  const scheduleManualMaintenance = async () => {
    if (!selectedEquipment || !newTask.title) return;

    setIsScheduling(true);
    try {
      if (!userId) {
        throw new Error('Missing user ID for scheduling');
      }
      const payload = {
        userId,
        profession,
        equipmentId: selectedEquipment.id,
        taskType: newTask.taskType,
        title: newTask.title,
        description: newTask.description || newTask.title,
        priority: newTask.priority,
        scheduledDate: (newTask.scheduledDate ?? new Date()).toISOString(),
        estimatedDuration: newTask.estimatedDuration,
        estimatedCost: newTask.estimatedCost,
        assignedTechnician: newTask.assignedTechnician,
        technicianContact: newTask.technicianContact,
        notes: newTask.notes,
        partsRequired: newTask.partsRequired,
        safetyRequirements: newTask.safetyRequirements,
        automatedBooking: newTask.automatedBooking,
      };

      await scheduleTaskMutation.mutateAsync(payload);
      setScheduleDialogOpen(false);

      // Reset form
      setNewTask({
        taskType: 'cleaning',
        priority: 'medium',
        scheduledDate: new Date(),
        estimatedDuration: 1,
        estimatedCost: 0,
        assignedTechnician: '',
        notes: '',
        partsRequired: [],
        safetyRequirements: [],
        automatedBooking: false,
      });
    } catch (error) {
      console.error('Error scheduling manual maintenance:', error);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const renderMaintenanceAutomation = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <AutoMode sx={{ color }} />
        Vedlikeholdsautomatisering
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={
              <Switch
                checked={autoSchedulingEnabled}
                onChange={(e) => setAutoSchedulingEnabled(e.target.checked)}
                color="primary"
              />
            }
            label="Automatisk planlegging"
            sx={{ mb: 2 }}
          />

          <Button fullWidth
            variant="contained"
            onClick={generateMaintenanceSchedule}
            disabled={isScheduling}
            startIcon={
              isScheduling ? (
                <CircularProgress size={20} sx={theming.getThemedButtonSx()} />
              ) : (
                theming.getThemedIcon('schedule')
              )
            }
            sx={{
              bgcolor: color,
              '&:hover': { bgcolor: color },
              mb:  2,
            }}
          >
            {isScheduling ? 'Genererer...' : 'Generer vedlikeholdsplan'}
          </Button>

          <Alert severity="info" sx={{ mb:  2 }}>
            <Typography variant="body2">
              Automatisk planlegging basert på utstyrets alder, tilstand og bruksintensitet
            </Typography>
          </Alert>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Vedlikeholdsstatistikk
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {maintenanceTasks.filter((t) => t.status === 'overdue').length}
              </Typography>
              <Typography variant="body2">Forsinket</Typography>
            </Box>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {maintenanceTasks.filter((t) => t.status === 'scheduled').length}
              </Typography>
              <Typography variant="body2">Planlagt</Typography>
            </Box>
            <Box
              sx={{
                flex:  1,
                p:  2,
                bgcolor: 'success.light',
                color: 'success.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {maintenanceTasks.filter((t) => t.status === 'completed').length}
              </Typography>
              <Typography variant="body2">Fullført</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {equipment.length > 0 && (
        <Box sx={{ mt:  3 }}>
          <Divider sx={{ mb:  2 }} />
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Utstyrsstatus
          </Typography>

          <Grid container spacing={2}>
            {equipment.map((item) => {
              const maintenanceScore = calculateMaintenanceScore(item);
              return (
                <Grid item xs={12} md={6} lg={4} key={item.id}>
                  <Card sx={{ border: 1, borderColor: 'divider' ,  ...theming.getThemedCardSx() }}>
                    <CardContent sx={{ pb: '16px !important' ,  ...theming.getThemedCardSx() }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap:  1,
                          mb:  1}}
                      >
                        <Avatar
                          sx={{
                            bgcolor: `${conditionColors[item.condition]}.main`,
                            width:  32,
                            height:  32}}
                        >
                          {item.type === 'camera' ? (
                            <CameraAlt fontSize="small" />
                          ) : item.type === 'lens' ? (
                            <Lens fontSize="small" />
                          ) : item.type === 'audio' ? (
                            <MusicNote fontSize="small" />
                          ) : item.type === 'computer' ? (
                            <Memory fontSize="small" />
                          ) : item.type === 'lighting' ? (
                            <Lightbulb fontSize="small" />
                          ) : item.type === 'flash' ? (
                            <FlashOn fontSize="small" />
                          ) : item.type === 'memory' ? (
                            <SdCard fontSize="small" />
                          ) : item.type === 'tripod' ? (
                            <CameraStand fontSize="small" />
                          ) : item.type === 'slider' ? (
                            <LinearScale fontSize="small" />
                          ) : (
                            <Build fontSize="small" />
                          )}
                        </Avatar>
                        <Box sx={{ flex:  1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {item.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.brand} {item.model}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={item.condition}
                          color={conditionColors[item.condition]}
                        />
                      </Box>

                      <Box sx={{ mb:  2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb:  1}}
                        >
                          <Typography variant="body2">Vedlikeholdsscore</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {maintenanceScore}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={maintenanceScore}
                          sx={{
                            height:  6,
                            borderRadius: 3,
                            '& .MuiLinearProgress-bar': {
                              backgroundColor:
                                maintenanceScore >= 70
                                  ? 'success.main'
                                  : maintenanceScore >= 50
                                    ? 'warning.main'
                                    : 'error.main',
                            },
                          }}
                        />
                      </Box>

                      <Stack spacing={1}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between' }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            Neste service
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.nextService.toLocaleDateString('no-NO')}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between' }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            Garanti utløper
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: item.warrantyExpiry < new Date()
                                ? 'error.main'
                                : 'text.primary',
                            }}
                          >
                            {item.warrantyExpiry.toLocaleDateString('no-NO')}
                          </Typography>
                        </Box>
                      </Stack>

                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedEquipment(item);
                          setScheduleDialogOpen(true);
                        }}
                        startIcon={theming.getThemedIcon('schedule')}
                        sx={{
                          mt:  2,
                          borderColor: color,
                          color,
                          '&:hover': {
                            borderColor: color,
                            bgcolor: `${color}10`,
                          },
                        }}
                      >
                        Planlegg service
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}
    </Paper>
  );

  const renderServiceReminders = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Notifications sx={{ color }} />
        Servicepåminnelser
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Kommende servicer
          </Typography>

          <List>
            {maintenanceTasks
              .filter((task) => task.status === 'scheduled')
              .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
              .slice(0, 5)
              .map((task) => (
                <ListItem
                  key={task.id}
                  sx={{
                    border:  1,
                    borderColor: 'divider',
                    borderRadius:  1,
                    mb:  1}}
                >
                  <ListItemIcon>
                    <Badge badgeContent={task.priority === 'critical' ? '!' : null} color="error">
                      <CalendarToday sx={{ color: priorityConfig[task.priority].color }} />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={task.title}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {task.scheduledDate.toLocaleDateString('no-NO')} - {task.equipmentName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Estimert tid: {task.estimatedDuration} timer | Kostnad:{' '}
                          {task.estimatedCost.toLocaleString('no-NO')} NOK
                        </Typography>
                      </Box>
                    }
                  />
                  <IconButton size="small" color="primary">
                    <Alarm />
                  </IconButton>
                </ListItem>
              ))}
          </List>
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Påminnelsesinnstillinger
          </Typography>

          <Stack spacing={2}>
            <FormControlLabel control={<Switch defaultChecked />} label="E-postpåminnelser" />
            <FormControlLabel control={<Switch defaultChecked />} label="SMS-påminnelser" />
            <FormControlLabel control={<Switch defaultChecked />} label="Push-notifikasjoner" />
            <FormControlLabel
              control={<Switch defaultChecked={false} />}
              label="Kalendeintegrasjon"
            />

            <Divider />

            <Typography variant="body2" color="text.secondary">
              Påminnelsestidspunkt
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>Påminne meg</InputLabel>
              <Select defaultValue="7" label="Påminne meg">
                <MenuItem value="1">1 dag før</MenuItem>
                <MenuItem value="3">3 dager før</MenuItem>
                <MenuItem value="7">1 uke før</MenuItem>
                <MenuItem value="14">2 uker før</MenuItem>
                <MenuItem value="30">1 måned før</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info">
              <Typography variant="body2">
                Kritiske servicer får automatisk påminnelse 3 dager i forveien uavhengig av
                innstillinger
              </Typography>
            </Alert>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );

  const renderWarrantyTracking = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Security sx={{ color }} />
        Garantisporing
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Utstyr</TableCell>
              <TableCell>Garantitype</TableCell>
              <TableCell>Leverandør</TableCell>
              <TableCell>Utløper</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {equipment.map((item) => {
              const isExpired = item.warrantyExpiry < new Date();
              const daysUntilExpiry = Math.ceil(
                (item.warrantyExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.brand} {item.model}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label="Fabrikant" color="primary" />
                  </TableCell>
                  <TableCell>{item.brand}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isExpired
                          ? 'error.main'
                          : daysUntilExpiry < 30
                            ? 'warning.main'
                            : 'text.primary' }}
                    >
                      {item.warrantyExpiry.toLocaleDateString('no-NO')}
                    </Typography>
                    {!isExpired && daysUntilExpiry < 90 && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {daysUntilExpiry} dager igjen
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={
                        isExpired
                          ? 'Utløpt'
                          : daysUntilExpiry < 30
                            ? 'Utløper snart'
                            : 'Aktiv'
                      }
                      color={isExpired ? 'error' : daysUntilExpiry < 30 ? 'warning' : 'success'}
                      icon={
                        isExpired
                          ? theming.getThemedIcon('error')
                          : daysUntilExpiry < 30
                            ? theming.getThemedIcon('warning')
                            : theming.getThemedIcon('checkCircle')
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      <Receipt />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt:  3 }}>
        <Typography variant="subtitle1" sx={{ mb:  2 }}>
          Garantisammendrag
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Box
              sx={{
                p:  2,
                bgcolor: 'success.light',
                color: 'success.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {equipment.filter((e) => e.warrantyExpiry > new Date()).length}
              </Typography>
              <Typography variant="body2">Aktive garantier</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box
              sx={{
                p:  2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {equipment.filter((e) => {
                  const days = Math.ceil(
                    (e.warrantyExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return days > 0 && days < 90;
                }).length}
              </Typography>
              <Typography variant="body2">Utløper snart</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box
              sx={{
                p:  2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {equipment.filter((e) => e.warrantyExpiry < new Date()).length}
              </Typography>
              <Typography variant="body2">Utløpte</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box
              sx={{
                p:  2,
                bgcolor: 'info.light',
                color: 'info.contrastText',
                borderRadius:  1,
                textAlign: 'center' }}
            >
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                {equipment.reduce((sum, e) => sum + e.replacementCost, 0).toLocaleString('no-NO')}
              </Typography>
              <Typography variant="body2">NOK total verdi</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );

  const renderReplacementPlanning = () => (
    <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <TrendingUp sx={{ color }} />
        Erstatningsplanlegging
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Utstyr som bør erstattes
          </Typography>

          <List>
            {equipment
              .filter((item) => {
                const ageRatio = item.currentAge / item.estimatedLifespan;
                const maintenanceScore = calculateMaintenanceScore(item);
                return ageRatio > 0.8 || maintenanceScore < 50 || item.condition === 'critical';
            })
              .sort((a, b) => {
                const scoreA = calculateMaintenanceScore(a);
                const scoreB = calculateMaintenanceScore(b);
                return scoreA - scoreB;
            })
              .map((item) => {
                const ageRatio = item.currentAge / item.estimatedLifespan;
                const maintenanceScore = calculateMaintenanceScore(item);
                const urgency =
                  ageRatio > 0.9 || maintenanceScore < 30
                    ? 'critical'
                    : ageRatio > 0.8 || maintenanceScore < 50
                      ? 'high'
                      : ageRatio > 0.7 || maintenanceScore < 70
                        ? 'medium'
                        : 'low';

                return (
                  <ListItem
                    key={item.id}
                    sx={{
                      border:  1,
                      borderColor: 'divider',
                      borderRadius:  1,
                      mb:  1}}
                  >
                    <ListItemIcon>
                      <Avatar
                        sx={{
                          bgcolor: `${priorityConfig[urgency].color}.main`}}
                      >
                        {item.type === 'camera' ? (
                          <CameraAlt />
                        ) : item.type === 'lens' ? (
                          <Lens />
                        ) : item.type === 'audio' ? (
                          <MusicNote />
                        ) : item.type === 'computer' ? (
                          <Memory />
                        ) : item.type === 'lighting' ? (
                          <Lightbulb />
                        ) : item.type === 'flash' ? (
                          <FlashOn />
                        ) : item.type === 'memory' ? (
                          <SdCard />
                        ) : item.type === 'tripod' ? (
                          <CameraStand />
                        ) : item.type === 'slider' ? (
                          <LinearScale />
                        ) : (
                          theming.getThemedIcon('build')
                        )}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">{item.name}</Typography>
                          <Chip
                            size="small"
                            label={priorityConfig[urgency].urgency}
                            color={priorityConfig[urgency].color}
                          />
                          {item.criticalToOperation && (
                            <Chip size="small" label="KRITISK" color="error" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Alder: {item.currentAge.toFixed(1)} år av {item.estimatedLifespan} år forventet
                            levetid
                          </Typography>
                          <Typography variant="body2">
                            Tilstand: {item.condition} | Vedlikeholdsscore: {maintenanceScore}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Estimert erstatningskostnad:{' '}
                            {item.replacementCost.toLocaleString('no-NO')} NOK
                          </Typography>
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Button size="small" variant="outlined" startIcon={theming.getThemedIcon('assessment')}>
                        Analyser
                      </Button>
                      <Button size="small"
                        variant="contained"
                        startIcon={<MonetizationOn />}
                        sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
                      >
                        Planlegg
                      </Button>
                    </Box>
                  </ListItem>
                );
              })}
          </List>
        </Grid>

        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" sx={{ mb:  2 }}>
            Budsjettplanlegging
          </Typography>

          <Box
            sx={{
              p:  2,
              border:  1,
              borderColor: 'divider',
              borderRadius:  1,
              mb:  2}}
          >
            <Typography variant="body2" color="text.secondary">
              Estimert årlig kostnad
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, color }}>
              {equipment
                .filter((item) => {
                  const ageRatio = item.currentAge / item.estimatedLifespan;
                  return ageRatio > 0.8;
                  })
                .reduce((sum, item) => sum + item.replacementCost, 0)
                  .toLocaleString('no-NO')}
              NOK
            </Typography>
          </Box>

          <Box
            sx={{
              p:  2,
              border:  1,
              borderColor: 'divider',
              borderRadius:  1,
              mb:  2}}
          >
            <Typography variant="body2" color="text.secondary">
              Kritisk utstyr
            </Typography>
            <Typography variant="h6" sx={{  fontWeight: 600}}>
              {
                equipment.filter(
                  (item) => item.criticalToOperation && calculateMaintenanceScore(item) < 50,
                ).length
              }
              enheter
            </Typography>
          </Box>

          <Alert severity="warning" sx={{ mb:  2 }}>
            <Typography variant="body2">
              {equipment.filter((item) => item.condition === 'critical').length} enheter krever
              umiddelbar oppmerksomhet
            </Typography>
          </Alert>

          <Button fullWidth
            variant="contained"
            startIcon={<Assessment />}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
          >
            Lag erstatningsplan
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );

  if (isLoadingEquipment || isLoadingMaintenance) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb:  2}}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
              <Build sx={{ color, fontSize: 32}} />
              <Box>
                <Typography variant="h5" sx={{  color, fontWeight: 600}}>
                  Utstyrs vedlikeholdsplanlegger
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Automatisert vedlikehold og garantisporing for
                  {profession === 'photographer'
                    ? 'fotografer'
                    : profession === 'videographer'
                      ? 'videografer'
                      : profession === 'musicproducer'
                        ? 'musikkprodusenter'
                        : 'leverandører'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Chip
                icon={<AutoMode />}
                label={autoSchedulingEnabled ? 'Automatisk' : 'Manuell'}
                color={autoSchedulingEnabled ? 'success' : 'default'}
                size="small"
              />
              <Chip
                icon={<NotificationImportant />}
                label={`${maintenanceTasks.filter((t) => t.priority === 'critical').length} kritiske`}
                color={
                  maintenanceTasks.filter((t) => t.priority === 'critical').length > 0
                    ? 'error'
                    : 'success'
              }
                size="small"
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="fullWidth"
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
          },
          '& .Mui-selected': {
            color: `${color} !important`,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: color,
          },
        }}
      >
        <Tab icon={<AutoMode />} iconPosition="start" label="Vedlikeholdsautomatisering" />
        <Tab icon={theming.getThemedIcon('notifications')} iconPosition="start" label="Servicepåminnelser" />
        <Tab icon={theming.getThemedIcon('security')} iconPosition="start" label="Garantisporing" />
        <Tab icon={theming.getThemedIcon('trendingUp')} iconPosition="start" label="Erstatningsplanlegging" />
      </Tabs>

      {activeTab === 0 && renderMaintenanceAutomation()}
      {activeTab === 1 && renderServiceReminders()}
      {activeTab === 2 && renderWarrantyTracking()}
      {activeTab === 3 && renderReplacementPlanning()}

      {/* Manual Maintenance Scheduling Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => !isScheduling && setScheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Schedule sx={{ color }} />
            Planlegg vedlikehold
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEquipment && (
            <Box sx={{ pt:  2 }}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                {selectedEquipment.name} - {selectedEquipment.brand} {selectedEquipment.model}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb:  2 }}>
                    <InputLabel>Type vedlikehold</InputLabel>
                    <Select
                      value={newTask.taskType ?? 'cleaning'}
                      onChange={(e) =>
                        setNewTask((prev) => ({
                          ...prev,
                          taskType: e.target.value as MaintenanceTask['taskType'],
                        }))
                      }
                      label="Type vedlikehold"
                    >
                      <MenuItem value="cleaning">Rengjøring</MenuItem>
                      <MenuItem value="calibration">Kalibrering</MenuItem>
                      <MenuItem value="repair">Reparasjon</MenuItem>
                      <MenuItem value="inspection">Inspeksjon</MenuItem>
                      <MenuItem value="replacement">Utskifting</MenuItem>
                      <MenuItem value="upgrade">Oppgradering</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth sx={{ mb:  2 }}>
                    <InputLabel>Prioritet</InputLabel>
                    <Select
                      value={newTask.priority ?? 'medium'}
                      onChange={(e) =>
                        setNewTask((prev) => ({
                          ...prev,
                          priority: e.target.value as MaintenanceTask['priority'],
                        }))
                      }
                      label="Prioritet"
                    >
                      <MenuItem value="low">Lav</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">Høy</MenuItem>
                      <MenuItem value="critical">Kritisk</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Tittel"
                    value={newTask.title ?? ''}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Estimert tid"
                    type="number"
                    value={newTask.estimatedDuration ?? ''}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedDuration: Number(e.target.value),
                      }))
                    }
                    InputProps={{
                      endAdornment: <InputAdornment position="end">timer</InputAdornment>,
                    }}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Estimert kostnad"
                    type="number"
                    value={newTask.estimatedCost ?? ''}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedCost: Number(e.target.value),
                      }))
                    }
                    InputProps={{
                      endAdornment: <InputAdornment position="end">NOK</InputAdornment>,
                    }}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notater"
                    multiline
                    rows={3}
                    value={newTask.notes ?? ''}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, notes: e.target.value }))}
                    sx={{ mb:  2 }}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(newTask.automatedBooking)}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        automatedBooking: e.target.checked,
                      }))
                    }
                  />
                }
                label="Automatisk booking hos servicepartner"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)} disabled={isScheduling}>
            Avbryt
          </Button>
          <Button onClick={scheduleManualMaintenance}
            variant="contained"
            disabled={isScheduling || !newTask.title}
            sx={{
              ...theming.getThemedButtonSx(),
              bgcolor: color,
              '&:hover': { bgcolor: color },
            }}>
            {isScheduling ? 'Planlegger...': 'Planlegg vedlikehold'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
