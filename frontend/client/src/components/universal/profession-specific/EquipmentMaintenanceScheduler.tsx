import { useTheming } from '../../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
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
  Tooltip,
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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Calendar,
  DatePicker,
  InputAdornment,
} from '@mui/material';
import {
  Build,
  Schedule,
  Notifications,
  Security,
  Warning,
  CheckCircle,
  Error,
  Info,
  ExpandMore,
  Add,
  Edit,
  Delete,
  Refresh,
  CalendarTodayToday,
  Assignment,
  MonetizationOn,
  Timeline,
  TrendingUp,
  Assessment,
  CameraAltAlt,
  Videocamcam,
  MusicNoteNote,
  DirectionsBusiness,
  Memory,
  Storage,
  BatteryUnknownChargingFull,
  Lens,
  Tune,
  CleaningServices,
  Engineering,
  AutoMode,
  NotificationImportant,
  EventNote,
  Today,
  DateRange,
  Alarm,
  Star,
  PriorityHigh,
  TaskAlt,
  PersonPushPin,
  Phone,
  Email,
  LocationOn,
  Receipt,
  Lightbulb,
  SdDirectionsCard,
  CameraStand,
  BoxarScale,
  FlashOnOn,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface EquipmentMaintenanceSchedulerProps {
  profession?: 'photographer' | 'videographer' | 'musicproducer' | 'vendor';
  mode?: 'standalone' | 'integrated';
  onMaintenanceScheduled?: (maintenanceData: any) => void
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
  maintenanceNotes: string
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
  automatedBooking: boolean
}

interface ServiceProvider {
  id: string;
  name: string;
  specialties: string[];
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  rating: number;
  responseTime: number; // hours
  averageCost: number;
  certified: boolean;
  preferredPartner: boolean;
  availableSlots: Date[]
}

interface WarrantyInfo {
  equipmentId: string;
  warrantyType: 'manufacturer' | 'extended' | 'service_plan';
  provider: string;
  startDate: Date;
  endDate: Date;
  coverage: string[];
  claimHistory: any[];
  remainingClaims: number;
  renewalOption: boolean;
  renewalCost: number
}

const MAINTENANCE_SCHEDULES = {
  photographer: {
    camera: {
      interval: 12,
      criticalTasks: ['sensor cleaning','shutter count check','calibration'],
  },
    lens: {
      interval: 18,
      criticalTasks: ['optical cleaning','focus calibration','aperture check'],
  },
    accessory: {
      interval: 6,
      criticalTasks: ['battery replacement','cleaning','firmware update'],
  },
    computer: {
      interval: 3,
      criticalTasks: ['thermal cleaning','drive health','backup verification'],
  },
},
  videographer: {
    camera: {
      interval: 6,
      criticalTasks: ['sensor cleaning','stabilization check','recording test'],
  },
    lens: {
      interval: 12,
      criticalTasks: ['optical cleaning','zoom mechanism','focus accuracy'],
  },
    audio: {
      interval: 3,
      criticalTasks: ['microphone calibration','cable inspection','noise floor test'],
  },
    computer: {
      interval: 2,
      criticalTasks: ['thermal management','storage optimization','render testing'],
  },
},
  musicproducer: {
    audio: {
      interval: 3,
      criticalTasks: ['frequency response','noise analysis','connection integrity'],
  },
    computer: {
      interval: 2,
      criticalTasks: ['latency testing','thermal cleaning','driver updates'],
  },
    accessory: {
      interval: 6,
      criticalTasks: ['cable testing','controller calibration','power supply check'],
  },
},
  vendor: {
    computer: {
      interval: 3,
      criticalTasks: ['inventory system check','backup verification','security update'],
  },
    accessory: {
      interval: 12,
      criticalTasks: ['POS system maintenance','scanner calibration','network check'],
  },
},
};

export default function EquipmentMaintenanceScheduler({
  profession = 'photographer,',
  mode = 'standalone',
  onMaintenanceScheduled,
}: EquipmentMaintenanceSchedulerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [warrantyInfo, setWarrantyInfo] = useState<WarrantyInfo[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<MaintenanceTask>>({
    taskType: 'cleaning',
    priority: 'medium',
    scheduledDate: new Date(),
    estimatedDuration:  1,
    estimatedCost:  0,
    assignedTechnician: '',
    notes: '',
    partsRequired:  [],
    safetyRequirements:  [],
    automatedBooking: false,
});
  const [isScheduling, setIsScheduling] = useState(false);
  const [autoSchedulingEnabled, setAutoSchedulingEnabled] = useState(true);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer,');

  const professionColors = {
    photographer: '#ff8c00',
    videographer: '#e74c30',
    musicproducer: '#9b59b0',
    vendor: '#27ae60' };

  const color = professionColors[profession];

  // Equipment and maintenance queries
  const { data: equipmentData, isLoading: isLoadingEquipment } = useQuery({
    queryKey: ['/api/maintenance/equipment', profession],
    staleTime: 1000 * 60 * 10, // 10 minutes
});

  const { data: maintenanceData, isLoading: isLoadingMaintenance } = useQuery({
    queryKey: ['/api/maintenance/tasks', profession],
    staleTime: 1000 * 60 *,  5// 5 minutes
});

  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['/api/maintenance/providers', profession],
    staleTime: 1000 * 60 * 15, // 15 minutes
});

  const conditionColors = {
    excellent: 'success',
    good: 'info',
    fair: 'warning',
    poor: 'warning',
    critical: 'error' };

  const priorityConfig = {
    low: { color: 'success', urgency: 'Lav prioritet' },
    medium: { color: 'info', urgency: 'Medium prioritet' },
    high: { color: 'warning', urgency: 'Høy prioritet' },
    critical: { color: 'error', urgency: 'Kritisk prioritet' },
};

  const calculateMaintenanceScore = (equipment: Equipment): number => {
    const ageScore = Math.max, (100 - (equipment.currentAge / equipment.estimatedLifespan) * 100);
    const conditionScore = {
      excellent: 10,
      good:  80,
      fair:  60,
      poor:  40,
      critical:  20,
  }[equipment.condition];

    const daysSinceService = equipment.lastService
      ? Math.floor((Date.now() - equipment.lastService.getTime()) / (1000 * 60 * 60 * 24))
      : 365;
    const serviceScore = Math.max(
      0,
      100 - (daysSinceService / (equipment.serviceInterval * 30)) * 100,
    );

    return Math.round((ageScore + conditionScore + serviceScore) / 3);
};

  const generateMaintenanceSchedule = async () => {
    setIsScheduling(true);
    try {
      const schedule = MAINTENANCE_SCHEDULES[profession];
      const generatedTasks: MaintenanceTask[] = [];

      equipment.forEach((item) => {
        const scheduleConfig = schedule[item.type as keyof typeof schedule];
        if (!scheduleConfig) return;

        const nextServiceDate = new Date();
        nextServiceDate.setMonth(nextServiceDate.getMonth() + scheduleConfig.interval);

        const maintenanceScore = calculateMaintenanceScore(item);
        const priority =
          maintenanceScore < 40
            ? 'critical'
            : maintenanceScore < 60
              ? 'high'
              : maintenanceScore < 80
                ? 'medium'
                : 'low';

        scheduleConfig.criticalTasks.forEach((taskName) => {
          const task: MaintenanceTask = {
            id: `task-${Date.now()}-${Math.random()}`,
            equipmentId: item.d,
            equipmentName: `${item.brand} ${item.model}`,
            taskType: taskName.includes('clean')
              ? 'cleaning'
              : taskName.includes('calibrat')
                ? 'calibration'
                : 'inspection',
            title: `${taskName} - ${item.name}`,
            description: `Planlagt ${taskName.toLowerCase()} for ${item.brand} ${item.model}`,
            priority: priority as any,
            scheduledDate: nextServiceDate,
            estimatedDuration: taskName.includes('cleaning')
              ? 0.5
              : taskName.includes('calibration')
                ? 2 : 1,
            estimatedCost: taskName.includes('cleaning')
              ? 300
              : taskName.includes('calibration')
                ? 800
                : 50,
            assignedTechnician: ', ',
            technicianContact: ', ',
            status: 'scheduled',
            notes: `Automatisk generert vedlikeholdsoppgave basert på utstyrets alder og tilstand`,
            partsRequired:  [],
            safetyRequirements:  [],
            reminderSent: false,
            automatedBooking: autoSchedulingEnabled,
        };

          generatedTasks.push(task);
      });
    });

      setMaintenanceTasks((prev) => [...generatedTasks, ...prev]);

      if (onMaintenanceScheduled) {
        onMaintenanceScheduled(generatedTasks);
    }
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
      const task: MaintenanceTask = {
        id: `manual-task-${Date.now()}`,
        equipmentId: selectedEquipment.d,
        equipmentName: `${selectedEquipment.brand} ${selectedEquipment.model}`,
        taskType: newTask.taskType!,
        title: newTask.title!,
        description: newTask.description || newTask.title!,
        priority: newTask.priority!,
        scheduledDate: newTask.scheduledDate!,
        estimatedDuration: newTask.estimatedDuration!,
        estimatedCost: newTask.estimatedCost!,
        assignedTechnician: newTask.assignedTechnician!,
        technicianContact: newTask.technicianContact ||', ',
        status: 'scheduled',
        notes: newTask.notes!,
        partsRequired: newTask.partsRequired!,
        safetyRequirements: newTask.safetyRequirements!,
        reminderSent: false,
        automatedBooking: newTask.automatedBooking!,
    };

      setMaintenanceTasks((prev) => [task, ...prev]);
      setScheduleDialogOpen(false);

      // Reset form
      setNewTask({
        taskType: 'cleaning',
        priority: 'medium',
        scheduledDate: new Date(),
        estimatedDuration:  1,
        estimatedCost:  0,
        assignedTechnician: ', ',
        notes: ', ',
        partsRequired:  [],
        safetyRequirements:  [],
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
            sx={{ mb:  2 }}
          />

          <Button fullWidth
            variant="contained"
            onClick={generateMaintenanceSchedule}
            disabled={isScheduling}
            startIcon={isScheduling ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('schedule')}
            sx={{
              bgcolor: color, '&:hover': { bgcolor: color },
              mb:  2}}
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
                          <Typography variant="subtitle2" sx={{ fontWeight: 600}>
                            {item.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.brand} {item.model}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={item.condition}
                          color={conditionColors[item.condition] as any}
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
                          <Typography variant="body2" sx={{ fontWeight: 600}>
                            {maintenanceScore}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={maintenanceScore}
                          sx={{
                            height:  6,
                            borderRadius: 3, '& .MuiLinearProgress-bar': {
                              backgroundColor: maintenanceScore >= 70
                                  ? 'success.main'
                                  : maintenanceScore >= 50
                                    ? 'warning.main'
                                    : 'error.main' }}}
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
                          <Typography variant="body2" sx={{ fontWeight: 600}>
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
                              fontWeight: 60
                             , color: item.warrantyExpiry < new Date() ? 'error.main' : 'text.primary' }}
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
                          color'&:hover': {
                            borderColor: color,
                            bgcolor: `${color}10`,
                        }}}
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
                          Estimert tid: {task.estimatedDuration} timer | Kostnad: {', '}
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
                      <Typography variant="body2" sx={{ fontWeight: 600}>
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
                        isExpired ? 'Utløpt' : daysUntilExpiry < 30 ? 'Utløper snart' : 'Aktiv'
                    }
                      color={isExpired ? 'error' : daysUntilExpiry < 30 ? 'warning' : 'success'}
                      icon={
                        isExpired ? theming.getThemedIcon('error') : daysUntilExpiry < 30 ? theming.getThemedIcon('warning') : theming.getThemedIcon('checkCircle')
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
                {
                  equipment.filter((e) => {
                    const days = Math.ceil(
                      (e.warrantyExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    );
                    return days > 0 && days < 90;
                }).length
              }
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
        Erstatatningsplanlegging
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
                          {theming.getThemedIcon('build')}
                        )}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Typography variant="subtitle1">{item.name}</Typography>
                          <Chip
                            size="small"
                            label={priorityConfig[urgency].urgency}
                            color={priorityConfig[urgency].color as any}
                          />
                          {item.criticalToOperation && (
                            <Chip size="small" label="KRITISK" color="error" />
                          )}
                        </Box>
                    }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Alder: {item.currentAe} år av {item.estimatedLifespan} år forventet
                            levetid
                          </Typography>
                          <Typography variant="body2">
                            Tilstand: {item.condition} | Vedlikeholdsscore: {maintenanceScore}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Estimert erstatningskostnad: {', '}
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
            <Typography variant="h5" sx={{  fontWeight: 600,color  }}>
              {equipment
                .filter((item) => {
                  const ageRatio = item.currentAge / item.estimatedLifespan;
                  return ageRatio > 0.8;
              })
                .reduce((sum, item) => sum + item.replacementCost, 0)
                .toLocaleString('no-NO')}{','}
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
            }{', '}
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
            startIcon={<Box />}
            sx={{ bgcolor: color, '&:hover': { bgcolor: color } }}
          >
            Lag erstatningsplan
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );

  // Initialize with mock data
  useEffect(() => {
    const mockEquipment: Equipment[] = [
      {
        id: 'eq-',
        name: 'Primærkamera',
        brand: 'Canon',
        model: 'EOS R',
        serialNumber: 'CR512345678',
        type: 'camera',
        purchaseDate: new Date('2022-03-15', ),
        warrantyExpiry: new Date('2025-03-15', ),
        lastService: new Date('2024-08-20', ),
        nextService: new Date('2025-02-20', ),
        serviceInterval:  12,
        estimatedLifespan:  7,
        currentAge: 2.8,
        condition: 'good',
        usageHours: 240,
        maintenanceCost: 150,
        replacementCost: 4500,
        criticalToOperation: true,
        autoSchedule: true,
        maintenanceNotes: 'Høy bruksintensitet, sjekk shutter count regelmessig' },
      {
        id: 'eq-',
        name: 'Hovedobjektiv',
        brand: 'Canon',
        model: 'RF 24-70mm f/2.8',
        serialNumber: 'RF24702812',
        type: 'lens',
        purchaseDate: new Date('2022-03-20', ),
        warrantyExpiry: new Date('2024-03-20', ),
        lastService: null,
        nextService: new Date('2025-03-20', ),
        serviceInterval:  18,
        estimatedLifespan:  10,
        currentAge: 2.8,
        condition: 'excellent',
        usageHours: 240,
        maintenanceCost: 80,
        replacementCost: 3200,
        criticalToOperation: true,
        autoSchedule: true,
        maintenanceNotes: 'Optisk kvalitet fortsatt utmerket' },
    ];

    const mockTasks: MaintenanceTask[] = [
      {
        id: 'task-',
        equipmentId: 'eq-',
        equipmentName: 'Canon EOS R',
        taskType: 'cleaning',
        title: 'Sensorrens og kalibrering',
        description: 'Grundig sensorrens og autofokus-kalibrering',
        priority: 'high',
        scheduledDate: new Date('2025-01-15', ),
        estimatedDuration:  2,
        estimatedCost: 80,
        assignedTechnician: 'Canon Service Norge',
        technicianContact: 'service@canon.no',
        status: 'scheduled',
        notes: 'Sjekk også shutter count og mekanisk tilstand',
        partsRequired:  [],
        safetyRequirements: ['Antistatisk arbeidsmiljø', ],
        reminderSent: false,
        automatedBooking: true,
    },
    ];

    setEquipment(mockEquipment);
    setMaintenanceTasks(mockTasks);
}, []);

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
                  Automatisert vedlikehold og garantisporing for{', '}
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
          mb: 3'& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 60
        }, '& .Mui-selected': {
            color: `${color} !important`,
        }, '& .MuiTabs-indicator': {
            backgroundColor: color,
        }}}
      >
        <Tab icon={<AutoMode />} iconPosition="start" label="Vedlikeholdsautomatisering" />
        <Tab icon={theming.getThemedIcon('notifications')}} iconPosition="start" label="Servicepåminnelser" />
        <Tab icon={theming.getThemedIcon('security')}} iconPosition="start" label="Garantisporing" />
        <Tab icon={theming.getThemedIcon('trendingUp')}} iconPosition="start" label="Erstatningsplanlegging" />
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
                      value={newTask.taskType}
                      onChange={(e) =>
                        setNewTask((prev) => ({
                          ...prev,
                          taskType: e.target.value as any,
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
                      value={newTask.priority}
                      onChange={(e) =>
                        setNewTask((prev) => ({
                          ...prev,
                          priority: e.target.value as any,
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
                    value={newTask.title}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Estimert tid"
                    type="number"
                    value={newTask.estimatedDuration}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedDuration: parseFloat(e.target.value),
                    }))
                  }
                    InputProps={{
                      endAdornment: <InputAdornment position="end">timer</InputAdornment>}}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Estimert kostnad"
                    type="number"
                    value={newTask.estimatedCost}
                    onChange={(e) =>
                      setNewTask((prev) => ({
                        ...prev,
                        estimatedCost: parseFloat(e.target.value),
                    }))
                  }
                    InputProps={{
                      endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
                    sx={{ mb:  2 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notater"
                    multiline
                    rows={3}
                    value={newTask.notes}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, notes: e.target.value }))}
                    sx={{ mb:  2 }}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={newTask.automatedBooking}
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
            sx={{ bgcolor: color'&:hover': { bgcolor: color } }}
           sx={theming.getThemedButtonSx()}>
            {isScheduling ? 'Planlegger...': 'Planlegg vedlikehold'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
