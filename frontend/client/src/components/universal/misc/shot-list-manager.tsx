import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Tooltip,
  Divider,
  Alert,
  Badge,
  LinearProgress,
  Paper,
  Stack,
  useMediaQuery,
  useTheme,
  Collapse,
  ListItemIcon,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Add,
  Edit,
  Delete,
  CheckCircle,
  Schedule,
  CameraAlt,
  VideoLibrary,
  PlayArrow,
  Pause,
  MoreVert,
} from '@mui/icons-material';

interface Shot {
  id: string;
  title: string;
  description: string;
  scene: string;
  shotType: 'Wide' | 'Medium' | 'Close-up' | 'Detail' | 'Establishing';
  duration: number; // in seconds
  status: 'Planned' | 'In Progress' | 'Completed' | 'Review';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  cameraSettings?: string;
  equipment?: string[];
  notes?: string;
  assignedTo?: string;
  scheduledTime?: Date;
  completedAt?: Date
}

interface ShotListManagerProps {
  projectId?: string;
  // Lokal-modus (opprettelse-modal uten projectId): kontrollert liste + callbacks
  // i stedet for API. Lagres når prosjektet opprettes.
  shots?: Shot[];
  onShotCreate?: (shot: Shot) => void;
  onShotUpdate?: (shot: Shot) => void;
  onShotDelete?: (shotId: string) => void;
  projectType?: string;
  culture?: string;
  estimatedHours?: number;
  totalDays?: number;
  template?: string;
  
  // Mobile & Timeline Integration
  mobileMode?: boolean; // Mobile-optimized view for wedding day
  timelineIntegration?: boolean; // Connect to EvendiTimelineAdmin
  upcomingEventTime?: string; // Next scheduled event (e.g. "First Dance in 15 min")
  onShotCompleteNotify?: (shot: Shot) => void // Notify when shot is completed
}

const normalizeShotListResponse = (response: unknown): Shot[] => {
  if (Array.isArray(response)) {
    return response as Shot[];
  }

  if (response && typeof response === 'object') {
    const payload = response as {
      data?: unknown;
      shots?: unknown;
      items?: unknown;
    };

    if (Array.isArray(payload.data)) {
      return payload.data as Shot[];
    }
    if (Array.isArray(payload.shots)) {
      return payload.shots as Shot[];
    }
    if (Array.isArray(payload.items)) {
      return payload.items as Shot[];
    }
  }

  return [];
};

export default function ShotListManager({
  projectId,
  shots: controlledShots,
  onShotCreate,
  onShotUpdate,
  onShotDelete,
  projectType = 'general',
  culture = 'norsk',
  estimatedHours = 8,
  totalDays = 1,
  template = 'basic',
  mobileMode = false,
  timelineIntegration = false,
  upcomingEventTime,
  onShotCompleteNotify
}: ShotListManagerProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')) || mobileMode;
  
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(isMobile ? 'Planned' : 'All'); // Mobile shows pending by default
  const [filterScene, setFilterScene] = useState<string>('All');
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set()); // Mobile: collapsible scenes
  const [shotForm, setShotForm] = useState<Partial<Shot>>({
    title: '',
    description: '',
    scene: '',
    shotType: 'Wide',
    duration: 0,
    status: 'Planned',
    priority: 'Medium',
    cameraSettings: '',
    notes: ''
  });
  const [equipmentInput, setEquipmentInput] = useState('');

  const openCreateDialog = () => {
    setEditingShot(null);
    setShotForm({
      title: '',
      description: '',
      scene: '',
      shotType: 'Wide',
      duration: 0,
      status: 'Planned',
      priority: 'Medium',
      cameraSettings: '',
      notes: ''
    });
    setEquipmentInput('');
    setShowDialog(true);
  };

  const openEditDialog = (shot: Shot) => {
    setEditingShot(shot);
    setShotForm({ ...shot });
    setEquipmentInput(shot.equipment?.join(', ') || '');
    setShowDialog(true);
  };

  const openDetailsDialog = useCallback((shot: Shot) => {
    setSelectedShot(shot);
    setShowDetailsDialog(true);
  }, []);

  useEffect(() => {
    if (!showDialog) {
      setEditingShot(null);
    }
  }, [showDialog]);

  // Database connection for ShotListManager
  const { data: shotListResponse, isLoading } = useQuery<unknown>({
    queryKey: ['/api/shot-list', projectId || 'default'],
    queryFn: () => apiRequest(`/api/shot-list/${projectId || 'default'}`),
    retry: false,
  });
  // Lokal-modus når ingen projectId (opprettelse-modal): bruk kontrollert liste.
  const isLocalMode = !projectId;
  const shots = isLocalMode ? (controlledShots ?? []) : normalizeShotListResponse(shotListResponse);

  // Mutation for updating shot data
  const updateShotListManager = useMutation({
    mutationFn: async (data: Shot) =>
      apiRequest('/api/shot-list/update', {
        method: 'PUT',
        body: data as unknown as Record<string, unknown>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shot-list'] });
    }
  });

  // Create new shot
  const createShot = useMutation({
    mutationFn: async (shotData: Omit<Shot, 'id'>) =>
      apiRequest('/api/shot-list/create', {
        method: 'POST',
        body: { ...shotData, projectId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shot-list'] });
      setShowDialog(false);
      setEditingShot(null);
    }
  });

  // Delete shot
  const deleteShot = useMutation({
    mutationFn: async (shotId: string) =>
      apiRequest(`/api/shot-list/${shotId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, shotId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shot-list'] });
      onShotDelete?.(shotId);
    }
  });

  // Persist-wrappere: lokal-modus bruker parent-callbacks, ellers API-mutasjoner.
  const persistCreate = useCallback((payload: Omit<Shot, 'id'>) => {
    if (isLocalMode) {
      const newShot = { ...payload, id: `local-${Date.now()}-${Math.round(Math.random() * 1e6)}` } as Shot;
      onShotCreate?.(newShot);
    } else {
      createShot.mutate(payload);
    }
  }, [isLocalMode, onShotCreate, createShot]);

  const persistUpdate = useCallback((shot: Shot) => {
    if (isLocalMode) onShotUpdate?.(shot);
    else { updateShotListManager.mutate(shot); onShotUpdate?.(shot); }
  }, [isLocalMode, onShotUpdate, updateShotListManager]);

  const persistDelete = useCallback((shotId: string) => {
    if (isLocalMode) onShotDelete?.(shotId);
    else deleteShot.mutate(shotId);
  }, [isLocalMode, onShotDelete, deleteShot]);

  // Handle shot status change (with notification on complete)
  const handleStatusChange = useCallback((shotId: string, newStatus: Shot['status']) => {
    const shot = shots.find(s => s.id === shotId);
    if (shot) {
      const updatedShot = {
        ...shot,
        status: newStatus,
        completedAt: newStatus === 'Completed' ? new Date() : undefined
  };
      persistUpdate(updatedShot);
      
      // Mobile notification when shot completed (inspired by Day of Timeline)
      if (newStatus === 'Completed' && isMobile) {
        onShotCompleteNotify?.(updatedShot);
        
        // Haptic feedback on mobile devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50); // Short vibration
        }
      }
  }
}, [shots, updateShotListManager, onShotUpdate, isMobile, onShotCompleteNotify]);

  // Get unique scenes
  const scenes = Array.from(new Set(shots.map(shot => shot.scene)));

  // Filter shots
  const filteredShots = shots.filter(shot => {
    const statusMatch = filterStatus === 'All' || shot.status === filterStatus;
    const sceneMatch = filterScene === 'All' || shot.scene === filterScene;
    return statusMatch && sceneMatch;
});

  // Group shots by scene (for mobile view)
  const shotsByScene = filteredShots.reduce<Record<string, Shot[]>>((acc, shot) => {
    if (!acc[shot.scene]) acc[shot.scene] = [];
    acc[shot.scene].push(shot);
    return acc;
  }, {});

  // Calculate completion stats
  const totalShots = shots.length;
  const completedShots = shots.filter(s => s.status === 'Completed').length;
  const criticalShots = shots.filter(s => s.priority === 'Critical').length;
  const completedCritical = shots.filter(s => s.priority === 'Critical' && s.status === 'Completed').length;
  const completionPercentage = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;

  // Toggle scene expansion (mobile)
  const toggleScene = (scene: string) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(scene)) {
      newExpanded.delete(scene);
    } else {
      newExpanded.add(scene);
    }
    setExpandedScenes(newExpanded);
  };

  // Get status color
  type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

  const getStatusColor = (status: Shot['status']): ChipColor => {
    switch (status) {
      case 'Completed': return 'success';
      case 'In Progress': return 'warning';
      case 'Review': return 'info';
      case 'Planned': return 'default';
      default: return 'default';
}
};

  const getStatusIcon = (status: Shot['status']) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle sx={{ color: '#4CAF50' }} />;
      case 'In Progress':
        return <PlayArrow sx={{ color: '#FF9800' }} />;
      case 'Review':
        return <VideoLibrary sx={{ color: '#2196F3' }} />;
      case 'Planned':
        return <Pause sx={{ color: '#9E9E9E' }} />;
      default:
        return <Pause sx={{ color: '#9E9E9E' }} />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: Shot['priority']): ChipColor => {
    switch (priority) {
      case 'Critical': return 'error';
      case 'High': return 'warning';
      case 'Medium': return 'info';
      case 'Low': return 'default';
      default: return 'default';
}
};

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  // Generate template-based shot suggestions — nøklet på PROSJEKTTYPE
  // (bryllup er kultur-bevisst). Dekker alle prosjekttyper.
  const generateTemplateShots = (_template: string, projectType: string, culture: string, hours: number) => {
    const baseShots: Shot[] = [];
    type Mini = { title: string; scene: string; shotType: Shot['shotType']; duration: number; priority: Shot['priority'] };
    const toShots = (prefix: string, list: Mini[], note: string, equipment: string[] = ['Kamera', 'Objektiv']): Shot[] =>
      list.map((s, i) => ({
        id: `${prefix}-${i}`,
        title: s.title,
        scene: s.scene,
        shotType: s.shotType,
        duration: s.duration,
        priority: s.priority,
        description: s.title,
        status: 'Planned' as const,
        equipment,
        notes: note,
      }));

    if (projectType === 'wedding') {
      // Bryllup: kultur-bevisste maler
      const weddingShots: Record<string, Mini[]> = {
        norsk: [
          { title: 'Forberedelser brud', scene: 'Getting Ready', shotType: 'Close-up', duration: 30, priority: 'High' },
          { title: 'Forberedelser brudgom', scene: 'Getting Ready', shotType: 'Medium', duration: 10, priority: 'Medium' },
          { title: 'First Look', scene: 'Pre-Ceremony', shotType: 'Wide', duration: 10, priority: 'Critical' },
          { title: 'Inntog seremoni', scene: 'Ceremony', shotType: 'Wide', duration: 10, priority: 'Critical' },
          { title: 'Ringutveksling', scene: 'Ceremony', shotType: 'Close-up', duration: 60, priority: 'Critical' },
          { title: 'Første kyss', scene: 'Ceremony', shotType: 'Wide', duration: 30, priority: 'Critical' },
          { title: 'Familiebilder', scene: 'Post-Ceremony', shotType: 'Medium', duration: 60, priority: 'High' },
          { title: 'Første dans', scene: 'Reception', shotType: 'Wide', duration: 20, priority: 'Critical' },
          { title: 'Kakeskjæring', scene: 'Reception', shotType: 'Close-up', duration: 90, priority: 'High' },
        ],
        indisk: [
          { title: 'Mehndi-seremoni', scene: 'Pre-Wedding', shotType: 'Close-up', duration: 30, priority: 'High' },
          { title: 'Baraat-prosesjon', scene: 'Wedding Day', shotType: 'Wide', duration: 60, priority: 'Critical' },
          { title: 'Jaimala', scene: 'Wedding Day', shotType: 'Close-up', duration: 10, priority: 'Critical' },
          { title: 'Kanyadaan', scene: 'Wedding Day', shotType: 'Wide', duration: 10, priority: 'Critical' },
          { title: 'Pheras', scene: 'Wedding Day', shotType: 'Wide', duration: 90, priority: 'Critical' },
          { title: 'Reception grand entrance', scene: 'Reception', shotType: 'Wide', duration: 30, priority: 'High' },
        ],
        arabisk: [
          { title: 'Henna-kveld', scene: 'Pre-Wedding', shotType: 'Close-up', duration: 20, priority: 'High' },
          { title: 'Zaffa-prosesjon', scene: 'Wedding Day', shotType: 'Wide', duration: 30, priority: 'Critical' },
          { title: 'Katb Al-Kitab', scene: 'Wedding Day', shotType: 'Wide', duration: 10, priority: 'Critical' },
          { title: 'Ringutveksling', scene: 'Wedding Day', shotType: 'Close-up', duration: 60, priority: 'Critical' },
          { title: 'Dabke-dans', scene: 'Reception', shotType: 'Wide', duration: 30, priority: 'High' },
        ],
      };
      const key = (culture || 'norsk') as keyof typeof weddingShots;
      const cultureShots = weddingShots[key] || weddingShots.norsk;
      baseShots.push(...toShots(`wedding-${key}`, cultureShots, `Viktig øyeblikk – ${key} bryllupstradisjon`, ['Kamera', 'Objektiv', 'Stativ']));
    } else {
      // Øvrige prosjekttyper
      const byType: Record<string, Mini[]> = {
        portrait: [
          { title: 'Headshot', scene: 'Portrett', shotType: 'Close-up', duration: 20, priority: 'Critical' },
          { title: 'Halvfigur', scene: 'Portrett', shotType: 'Medium', duration: 15, priority: 'High' },
          { title: 'Helfigur', scene: 'Portrett', shotType: 'Wide', duration: 15, priority: 'High' },
          { title: 'Miljøportrett', scene: 'Lokasjon', shotType: 'Wide', duration: 20, priority: 'Medium' },
          { title: 'Detalj / rekvisitter', scene: 'Detaljer', shotType: 'Detail', duration: 10, priority: 'Low' },
        ],
        event: [
          { title: 'Venue / oppsett', scene: 'Pre-Event', shotType: 'Wide', duration: 30, priority: 'Medium' },
          { title: 'Gjester ankommer', scene: 'Ankomst', shotType: 'Medium', duration: 20, priority: 'High' },
          { title: 'Hovedprogram', scene: 'Event', shotType: 'Wide', duration: 60, priority: 'Critical' },
          { title: 'Taler', scene: 'Event', shotType: 'Close-up', duration: 30, priority: 'High' },
          { title: 'Mingling / nettverk', scene: 'Networking', shotType: 'Medium', duration: 20, priority: 'Medium' },
        ],
        commercial: [
          { title: 'Hero-produkt', scene: 'Produkt', shotType: 'Detail', duration: 30, priority: 'Critical' },
          { title: 'Produkt i bruk', scene: 'Lifestyle', shotType: 'Medium', duration: 30, priority: 'High' },
          { title: 'Merkevare / logo', scene: 'Branding', shotType: 'Detail', duration: 15, priority: 'High' },
          { title: 'B-roll', scene: 'Coverage', shotType: 'Wide', duration: 20, priority: 'Medium' },
        ],
        video: [
          { title: 'Etablerings-shot', scene: 'Intro', shotType: 'Wide', duration: 20, priority: 'High' },
          { title: 'Intervju', scene: 'Interview', shotType: 'Close-up', duration: 45, priority: 'Critical' },
          { title: 'B-roll', scene: 'Coverage', shotType: 'Medium', duration: 30, priority: 'High' },
          { title: 'Cutaways / detaljer', scene: 'Detaljer', shotType: 'Detail', duration: 15, priority: 'Medium' },
          { title: 'Avslutning', scene: 'Outro', shotType: 'Wide', duration: 15, priority: 'Medium' },
        ],
        music: [
          { title: 'Opptreden vidvinkel', scene: 'Performance', shotType: 'Wide', duration: 60, priority: 'Critical' },
          { title: 'Instrument nærbilde', scene: 'Performance', shotType: 'Close-up', duration: 30, priority: 'High' },
          { title: 'Artist-portrett', scene: 'Portrett', shotType: 'Medium', duration: 20, priority: 'High' },
          { title: 'Publikum', scene: 'Crowd', shotType: 'Wide', duration: 20, priority: 'Medium' },
        ],
        family: [
          { title: 'Gruppebilde', scene: 'Familie', shotType: 'Wide', duration: 20, priority: 'Critical' },
          { title: 'Candid barn', scene: 'Candid', shotType: 'Medium', duration: 20, priority: 'High' },
          { title: 'Individuelle portretter', scene: 'Portrett', shotType: 'Close-up', duration: 20, priority: 'High' },
          { title: 'Lifestyle / hjemme', scene: 'Lifestyle', shotType: 'Wide', duration: 20, priority: 'Medium' },
        ],
        product: [
          { title: 'Hero-shot', scene: 'Produkt', shotType: 'Detail', duration: 30, priority: 'Critical' },
          { title: 'Vinkler / 360', scene: 'Produkt', shotType: 'Medium', duration: 30, priority: 'High' },
          { title: 'Makro / detalj', scene: 'Detaljer', shotType: 'Detail', duration: 20, priority: 'High' },
          { title: 'Kontekst / skala', scene: 'Lifestyle', shotType: 'Wide', duration: 15, priority: 'Medium' },
          { title: 'Emballasje', scene: 'Produkt', shotType: 'Detail', duration: 10, priority: 'Low' },
        ],
      };
      const list = byType[projectType] || byType.portrait;
      baseShots.push(...toShots(projectType || 'shot', list, `${projectType || 'Generell'}-dekning`));
    }

    const priorityWeight: Record<Shot['priority'], number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };

    const targetShots = Math.max(4, Math.round(hours * 1.5));
    const sortedShots = [...baseShots].sort(
      (a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]
    );

    if (sortedShots.length >= targetShots) {
      return sortedShots.slice(0, targetShots);
    }

    const fillerScene = projectType === 'wedding' ? 'B-roll' : 'Coverage';
    const fillersNeeded = targetShots - sortedShots.length;
    const fillerShots: Shot[] = Array.from({ length: fillersNeeded }, (_, index) => ({
      id: `auto-${projectType}-${index}`,
      title: `Extra ${projectType} shot ${index + 1}`,
      description: `Additional coverage to match ${hours}h schedule`,
      scene: fillerScene,
      shotType: 'Wide',
      duration: 15,
      status: 'Planned',
      priority: 'Low',
      equipment: ['Camera'],
      notes: 'Auto-generated to match estimated hours'
    }));

    return [...sortedShots, ...fillerShots];
};

  // Auto-generate shots based on template and project details
  const generateShotsFromTemplate = useCallback(() => {
    const suggestedShots = generateTemplateShots(template, projectType, culture, estimatedHours);
    // Add shots to the existing shots array
    suggestedShots.forEach((shot) => {
      const { id: _ignored, ...payload } = shot;
      persistCreate(payload);
  });
}, [template, projectType, culture, estimatedHours, persistCreate]);

  return (
    <Box sx={{ p: isMobile ? 1 : 2 }}>
      {/* Mobile-Optimized Header (inspired by Day of Timeline) */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 1 : 0 }}>
        <Typography variant={isMobile ? "h5" : "h4"} component="h1" sx={{ color: theming.colors.primary }}>
          {isMobile ? 'Shot-liste' : 'Shot-liste'}
        </Typography>
        
        {/* Completion Progress (Mobile-First) */}
        {isMobile && (
          <Box sx={{ width: '100%', mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600}}>
                {completedShots}/{totalShots} shots ({completionPercentage}%)
              </Typography>
              <Typography variant="caption" color={completedCritical === criticalShots ? 'success.main' : 'error.main'}>
                {completedCritical}/{criticalShots} must-haves ✓
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={completionPercentage} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                bgcolor: 'rgba(0,0,0,0.1)','& .MuiLinearProgress-bar': {
                  bgcolor: completionPercentage === 100 ? '#4CAF50' : '#FF8C00'
                }
              }} 
            />
          </Box>
        )}
        
        {/* Timeline Integration Alert */}
        {upcomingEventTime && isMobile && (
          <Alert 
            severity="warning" 
            icon={<Schedule />}
            sx={{ 
              width: '100%', 
              mb: 1,
              animation: 'pulse 2s infinite',
              fontSize: '0.9rem'
            }}
          >
            ⏰ {upcomingEventTime}
          </Alert>
        )}

          {timelineIntegration && (
            <Alert
              severity="info"
              icon={<Schedule />}
              sx={{ width: '100%', mb: 1, fontSize: '0.9rem' }}
            >
              Timeline sync aktiv: {completedShots}/{totalShots} ferdige shots
            </Alert>
          )}
        
        <Box sx={{ display: 'flex', gap: isMobile ? 1 : 2, width: isMobile ? '100%' : 'auto' }}>
          {!isMobile && (
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('videoLibrary')}
              onClick={generateShotsFromTemplate}
              disabled={shots.length > 0}
              size={isMobile ? 'small' : 'medium'}
            >
              {isMobile ? 'Mal' : 'Generer fra mal'}
            </Button>
          )}
          {!isMobile && (
            <Tooltip title="Hurtig-legg til">
              <IconButton
                onClick={openCreateDialog}
                sx={{ border: `1px solid ${theming.colors.primary}30` }}
              >
                <Add />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            onClick={openCreateDialog}
            fullWidth={isMobile}
            size={isMobile ? 'small' : 'medium'}
            sx={theming.getThemedButtonSx()}
          >
            {isMobile ? 'Legg til' : 'Legg til shot'}
          </Button>
        </Box>
      </Box>

      {/* Project Info */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Project Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="textSecondary">Project Type</Typography>
              <Typography variant="body1">{projectType}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="textSecondary">Template</Typography>
              <Typography variant="body1">{template}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="textSecondary">Culture</Typography>
              <Typography variant="body1">{culture}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="textSecondary">Estimated Hours</Typography>
              <Typography variant="body1">{estimatedHours}h over {totalDays} day(s)</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="All">Alle statuser</MenuItem>
                  <MenuItem value="Planned">Planned</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Review">Review</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Scene</InputLabel>
                <Select
                  value={filterScene}
                  onChange={(e) => setFilterScene(e.target.value)}
                >
                  <MenuItem value="All">Alle scener</MenuItem>
                  {scenes.map(scene => (
                    <MenuItem key={scene} value={scene}>{scene}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="textSecondary">
                {filteredShots.length} shots found
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Shots List - Mobile-Optimized (inspired by Day of Timeline) */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <Typography>Loading shots...</Typography>
        </Box>
      ) : filteredShots.length === 0 ? (
        <Alert severity="info">
          No shots found. {isMobile ? 'Tap "Add" to create your first shot' : 'Create your first shot to get started.'}
        </Alert>
      ) : isMobile ? (
        /* MOBILE VIEW: Grouped by Scene with Collapsible Cards */
        <Box>
          {Object.entries(shotsByScene).map(([scene, sceneShots]) => {
            const sceneCompleted = sceneShots.filter(s => s.status === 'Completed').length;
            const sceneTotal = sceneShots.length;
            const sceneProgress = Math.round((sceneCompleted / sceneTotal) * 100);
            const isExpanded = expandedScenes.has(scene);

            return (
              <Paper 
                key={scene}
                elevation={2}
                sx={{ 
                  mb: 2, 
                  overflow: 'hidden',
                  border: sceneCompleted === sceneTotal ? '2px solid #4CAF50' : 'none'
                }}
              >
                {/* Scene Header - Tap to Expand */}
                <Box
                  onClick={() => toggleScene(scene)}
                  sx={{
                    p: 2,
                    bgcolor: sceneCompleted === sceneTotal ? '#E8F5E9' : '#F5F5F5',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600}}>
                      {scene}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sceneCompleted}/{sceneTotal} shots ({sceneProgress}%)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {sceneCompleted === sceneTotal && <CheckCircle sx={{ color: '#4CAF50' }} />}
                    <Badge badgeContent={sceneTotal - sceneCompleted} color="primary">
                      <CameraAlt />
                    </Badge>
                  </Box>
                </Box>

                {/* Scene Progress Bar */}
                <LinearProgress 
                  variant="determinate" 
                  value={sceneProgress} 
                  sx={{ height: 4 }}
                />

                {/* Shots in Scene - Collapsible */}
                <Collapse in={isExpanded}>
                  <List sx={{ p: 0 }}>
                    {sceneShots.map((shot, index) => (
                      <ListItem
                        key={shot.id}
                        sx={{
                          py: 2,
                          px: 2,
                          borderBottom: index < sceneShots.length - 1 ? '1px solid #eee' : 'none',
                          bgcolor: shot.status === 'Completed' ? '#F1F8E9' : 'transparent'
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {getStatusIcon(shot.status)}
                        </ListItemIcon>
                        {/* Large Touch-Friendly Checkbox */}
                        <Checkbox
                          checked={shot.status === 'Completed'}
                          onChange={(e) => handleStatusChange(
                            shot.id, 
                            e.target.checked ? 'Completed' : 'Planned'
                          )}
                          sx={{ 
                            '& .MuiSvgIcon-root': { fontSize: 32 } // Larger for mobile
                          }}
                        />
                        
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: shot.priority === 'Critical' ? 700 : 500,
                                  textDecoration: shot.status === 'Completed' ? 'line-through' : 'none',
                                  color: shot.status === 'Completed' ? 'text.secondary' : 'text.primary'
                                }}
                              >
                                {shot.title}
                              </Typography>
                              {shot.priority === 'Critical' && (
                                <Chip 
                                  label="MUST" 
                                  color="error"
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700}}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {shot.shotType} • {formatDuration(shot.duration)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <Tooltip title="Rediger">
                                  <IconButton size="small" onClick={() => openEditDialog(shot)}>
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Slett">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      setSelectedShot(shot);
                                      persistDelete(shot.id);
                                    }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Detaljer">
                                  <IconButton size="small" onClick={() => openDetailsDialog(shot)}>
                                    <MoreVert fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      ) : (
        /* DESKTOP VIEW: Traditional List */
        <List>
          {filteredShots.map((shot, index) => (
            <React.Fragment key={shot.id}>
              <ListItem
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius:  1,
                  mb: 1, '&:hover': { bgcolor: 'action.hover',}
              }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getStatusIcon(shot.status)}
                </ListItemIcon>
                <Checkbox
                  checked={shot.status === 'Completed'}
                  onChange={(e) => handleStatusChange(
                    shot.id, 
                    e.target.checked ? 'Completed' : 'Planned'
                  )}
                />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{shot.title}</Typography>
                      <Chip
                        label={shot.status}
                        color={getStatusColor(shot.status)}
                        size="small"
                      />
                      <Chip
                        label={shot.priority}
                        color={getPriorityColor(shot.priority)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {shot.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip 
                          icon={<CameraAlt />} 
                          label={shot.shotType} 
                          size="small" 
                          variant="outlined"
                        />
                        <Chip
                          icon={<Schedule />}
                          label={formatDuration(shot.duration)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip 
                          label={shot.scene} 
                          size="small" 
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap:  1 }}>
                    <Tooltip title="Rediger shot">
                      <IconButton onClick={() => openEditDialog(shot)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett shot">
                      <IconButton
                        onClick={() => {
                          setSelectedShot(shot);
                          persistDelete(shot.id);
                      }}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Detaljer">
                      <IconButton onClick={() => openDetailsDialog(shot)}>
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
              {index < filteredShots.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Shot Dialog */}
      <Dialog 
        open={showDialog} 
        onClose={() => {
          setShowDialog(false);
          setEditingShot(null);
      }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingShot ? 'Rediger shot' : 'Nytt shot'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tittel"
                value={shotForm.title || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                multiline
                rows={3}
                value={shotForm.description || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Scene"
                value={shotForm.scene || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, scene: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={shotForm.shotType || 'Wide'}
                  onChange={(e) => setShotForm((prev) => ({ ...prev, shotType: e.target.value as Shot['shotType'] }))}
                >
                  <MenuItem value="Wide">Wide Shot</MenuItem>
                  <MenuItem value="Medium">Medium Shot</MenuItem>
                  <MenuItem value="Close-up">Close-up</MenuItem>
                  <MenuItem value="Detail">Detail Shot</MenuItem>
                  <MenuItem value="Establishing">Establishing Shot</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Varighet (sekunder)"
                type="number"
                value={shotForm.duration ?? 0}
                onChange={(e) => setShotForm((prev) => ({ ...prev, duration: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={shotForm.priority || 'Medium'}
                  onChange={(e) => setShotForm((prev) => ({ ...prev, priority: e.target.value as Shot['priority'] }))}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Kamerainnstillinger"
                value={shotForm.cameraSettings || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, cameraSettings: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Utstyr"
                value={equipmentInput}
                onChange={(e) => setEquipmentInput(e.target.value)}
                helperText="Separate multiple items with commas"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notater"
                multiline
                rows={2}
                value={shotForm.notes || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={() => {
              if (!shotForm.title || !shotForm.scene) return;
              const equipment = equipmentInput
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

              const basePayload: Omit<Shot, 'id'> = {
                title: shotForm.title,
                description: shotForm.description || '',
                scene: shotForm.scene,
                shotType: shotForm.shotType || 'Wide',
                duration: Number(shotForm.duration) || 0,
                status: shotForm.status || 'Planned',
                priority: shotForm.priority || 'Medium',
                cameraSettings: shotForm.cameraSettings || '',
                equipment,
                notes: shotForm.notes || '',
                assignedTo: shotForm.assignedTo || user?.id,
                scheduledTime: shotForm.scheduledTime,
                completedAt: shotForm.completedAt
              };

              if (editingShot) {
                persistUpdate({ ...editingShot, ...basePayload });
              } else {
                persistCreate(basePayload);
              }
              setShowDialog(false);
              setEditingShot(null);
          }}
          >
            {editingShot ? 'Oppdater shot' : 'Opprett shot'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showDetailsDialog && !!selectedShot}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Shot Details</DialogTitle>
        <DialogContent>
          {selectedShot && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getStatusIcon(selectedShot.status)}
                <Typography variant="h6">{selectedShot.title}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedShot.description}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={selectedShot.scene} size="small" variant="outlined" />
                <Chip label={selectedShot.shotType} size="small" variant="outlined" />
                <Chip label={selectedShot.priority} size="small" color={getPriorityColor(selectedShot.priority)} />
                <Chip label={selectedShot.status} size="small" color={getStatusColor(selectedShot.status)} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Duration: {formatDuration(selectedShot.duration)}
              </Typography>
              {selectedShot.cameraSettings && (
                <Typography variant="body2" color="text.secondary">
                  Camera: {selectedShot.cameraSettings}
                </Typography>
              )}
              {selectedShot.equipment?.length ? (
                <Typography variant="body2" color="text.secondary">
                  Equipment: {selectedShot.equipment.join(', ')}
                </Typography>
              ) : null}
              {selectedShot.notes && (
                <Typography variant="body2" color="text.secondary">
                  Notes: {selectedShot.notes}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>
            Close
          </Button>
          {selectedShot && (
            <Button
              onClick={() => {
                openEditDialog(selectedShot);
                setShowDetailsDialog(false);
              }}
              startIcon={<Edit />}
            >
              Edit
            </Button>
          )}
          {selectedShot && (
            <Button
              color="error"
              onClick={() => {
                persistDelete(selectedShot.id);
                setShowDetailsDialog(false);
              }}
              startIcon={<Delete />}
            >
              Delete
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
