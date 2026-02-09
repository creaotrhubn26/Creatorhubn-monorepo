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
  useMediaQuery,
  useTheme,
  Collapse,
  ListItemIcon
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
  MoreVert
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
  onShotUpdate?: (shot: Shot) => void;
  onShotDelete?: (shotId: string) => void;
  projectType?: string;
  culture?: string;
  estimatedHours?: number;
  totalDays?: number;
  template?: string;
  
  // Mobile & Timeline Integration
  mobileMode?: boolean; // Mobile-optimized view for wedding day
  timelineIntegration?: boolean; // Connect to WeddingTimelineAdmin
  upcomingEventTime?: string; // Next scheduled event (e.g. "First Dance in 15 min")
  onShotCompleteNotify?: (shot: Shot) => void // Notify when shot is completed
}

export default function ShotListManager({ 
  projectId, 
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

  useEffect(() => {
    if (!showDialog) {
      setEditingShot(null);
    }
  }, [showDialog]);

  // Database connection for ShotListManager
  const { data: shots = [], isLoading } = useQuery<Shot[]>({
    queryKey: ['/api/shot-list', projectId || 'default'],
    queryFn: () => apiRequest(`/api/shot-list/${projectId || 'default'}`),
    retry: false,
  });

  // Mutation for updating shot data
  const updateShotListManager = useMutation({
    mutationFn: async (data: Shot) =>
      apiRequest('/api/shot-list/update', {
        method: 'PUT',
        body: data,
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

  // Handle shot status change (with notification on complete)
  const handleStatusChange = useCallback((shotId: string, newStatus: Shot['status']) => {
    const shot = shots.find(s => s.id === shotId);
    if (shot) {
      const updatedShot = { 
        ...shot, 
        status: newStatus,
        completedAt: newStatus === 'Completed' ? new Date() : undefined
  };
      updateShotListManager.mutate(updatedShot);
      onShotUpdate?.(updatedShot);
      
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

  // Generate template-based shot suggestions
  const generateTemplateShots = (template: string, projectType: string, culture: string, hours: number) => {
    const baseShots: Shot[] = [];
    
    if (template === 'wedding' && projectType === 'wedding') {
      // Wedding-specific shots based on culture
      const weddingShots = {
        norsk: [
          { title: 'Bridal Preparation', scene: 'Getting Ready', shotType: 'Close-up' as const, duration: 30, priority: 'High' as const },
          { title: 'Groom Preparation', scene: 'Getting Ready', shotType: 'Medium' as const, duration: 10, priority: 'Medium' as const },
          { title: 'First Look', scene: 'Pre-Ceremony', shotType: 'Wide' as const, duration: 10, priority: 'Critical' as const },
          { title: 'Ceremony Processional', scene: 'Ceremony', shotType: 'Wide' as const, duration: 10, priority: 'Critical' as const },
          { title: 'Ring Exchange', scene: 'Ceremony', shotType: 'Close-up' as const, duration:  60, priority: 'Critical' as const },
          { title: 'First Kiss', scene: 'Ceremony', shotType: 'Wide' as const, duration:  30, priority: 'Critical' as const },
          { title: 'Recessional', scene: 'Ceremony', shotType: 'Wide' as const, duration: 10, priority: 'High' as const },
          { title: 'Family Photos', scene: 'Post-Ceremony', shotType: 'Medium' as const, duration: 60, priority: 'High' as const },
          { title: 'Reception Entrance', scene: 'Reception', shotType: 'Wide' as const, duration: 10, priority: 'High' as const },
          { title: 'First Dance', scene: 'Reception', shotType: 'Wide' as const, duration: 20, priority: 'Critical' as const },
          { title: 'Cake Cutting', scene: 'Reception', shotType: 'Close-up' as const, duration:  90, priority: 'High' as const },
          { title: 'Bouquet Toss', scene: 'Reception', shotType: 'Wide' as const, duration:  60, priority: 'Medium' as const }
        ],
        indisk: [
          { title: 'Mehndi Ceremony', scene: 'Pre-Wedding', shotType: 'Close-up' as const, duration: 30, priority: 'High' as const },
          { title: 'Sangam Ceremony', scene: 'Pre-Wedding', shotType: 'Wide' as const, duration: 10, priority: 'High' as const },
          { title: 'Baraat Procession', scene: 'Wedding Day', shotType: 'Wide' as const, duration: 60, priority: 'Critical' as const },
          { title: 'Jaimala Exchange', scene: 'Wedding Day', shotType: 'Close-up' as const, duration: 10, priority: 'Critical' as const },
          { title: 'Kanyadaan', scene: 'Wedding Day', shotType: 'Wide' as const, duration: 10, priority: 'Critical' as const },
          { title: 'Pheras', scene: 'Wedding Day', shotType: 'Wide' as const, duration: 90, priority: 'Critical' as const },
          { title: 'Sindoor Ceremony', scene: 'Wedding Day', shotType: 'Close-up' as const, duration:  60, priority: 'High' as const },
          { title: 'Reception Grand Entrance', scene: 'Reception', shotType: 'Wide' as const, duration: 30, priority: 'High' as const }
        ],
        arabisk: [
          { title: 'Henna Night', scene: 'Pre-Wedding', shotType: 'Close-up' as const, duration: 20, priority: 'High' as const },
          { title: 'Zaffa Procession', scene: 'Wedding Day', shotType: 'Wide' as const, duration: 30, priority: 'Critical' as const },
          { title: 'Katb Al-Kitab', scene: 'Wedding Day', shotType: 'Wide' as const, duration: 10, priority: 'Critical' as const },
          { title: 'Ring Exchange', scene: 'Wedding Day', shotType: 'Close-up' as const, duration:  60, priority: 'Critical' as const },
          { title: 'Reception Entrance', scene: 'Reception', shotType: 'Wide' as const, duration: 10, priority: 'High' as const },
          { title: 'Dabke Dance', scene: 'Reception', shotType: 'Wide' as const, duration: 30, priority: 'High' as const }
        ]
    };
      
      const cultureShots = weddingShots[culture as keyof typeof weddingShots] || weddingShots.norsk;
      baseShots.push(...cultureShots.map((shot, index) => ({
        id: `wedding-${culture}-${index}`,
        ...shot,
        description: `${shot.title} - ${culture} wedding tradition`,
        status: 'Planned' as const,
        equipment: ['Camera','Lens','Tripod'],
        notes: `Important moment in ${culture} wedding tradition`
    })));
  } else if (template === 'corporate') {
      baseShots.push(
        { id: 'corp-', title: 'Company Overview', scene: 'Introduction', shotType: 'Wide', duration:  60, priority: 'High', description: 'Company building exterior', status: 'Planned', equipment: ['Camera','Wide Lens'] },
        { id: 'corp-', title: 'CEO Interview', scene: 'Interview', shotType: 'Close-up', duration: 30, priority: 'Critical', description: 'CEO speaking about company vision', status: 'Planned', equipment: ['Camera','Microphone','Lighting'] },
        { id: 'corp-', title: 'Team Working', scene: 'Office', shotType: 'Medium', duration: 10, priority: 'Medium', description: 'Employees working in office', status: 'Planned', equipment: ['Camera','Tripod'] },
        { id: 'corp-', title: 'Product Showcase', scene: 'Product', shotType: 'Detail', duration: 10, priority: 'High', description: 'Product close-up shots', status: 'Planned', equipment: ['Camera','Macro Lens','Lighting'] }
      );
  } else if (template === 'event') {
      baseShots.push(
        { id: 'event-', title: 'Venue Setup', scene: 'Pre-Event', shotType: 'Wide', duration:  60, priority: 'Medium', description: 'Empty venue before setup', status: 'Planned', equipment: ['Camera','Wide Lens'] },
        { id: 'event-', title: 'Guest Arrival', scene: 'Arrival', shotType: 'Medium', duration: 10, priority: 'High', description: 'Guests arriving and mingling', status: 'Planned', equipment: ['Camera','Telephoto Lens'] },
        { id: 'event-', title: 'Main Event', scene: 'Event', shotType: 'Wide', duration: 60, priority: 'Critical', description: 'Main event activities', status: 'Planned', equipment: ['Camera', 'Tripod','Audio'] },
        { id: 'event-', title: 'Networking', scene: 'Networking', shotType: 'Medium', duration: 20, priority: 'Medium', description: 'People networking and socializing', status: 'Planned', equipment: ['Camera','Telephoto Lens'] }
      );
  }
    
    return baseShots;
};

  // Auto-generate shots based on template and project details
  const generateShotsFromTemplate = useCallback(() => {
    const suggestedShots = generateTemplateShots(template, projectType, culture, estimatedHours);
    // Add shots to the existing shots array
    suggestedShots.forEach((shot) => {
      const { id: _ignored, ...payload } = shot;
      createShot.mutate(payload);
  });
}, [template, projectType, culture, estimatedHours, createShot]);

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
          {isMobile ? '🎯 Shot List' : 'Shot List Manager'}
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
        
        <Box sx={{ display: 'flex', gap: isMobile ? 1 : 2, width: isMobile ? '100%' : 'auto' }}>
          {!isMobile && (
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('videoLibrary')}
              onClick={generateShotsFromTemplate}
              disabled={shots.length > 0}
              size={isMobile ? 'small' : 'medium'}
            >
              {isMobile ? 'Template' : 'Generate from Template'}
            </Button>
          )}
          <Button 
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            onClick={openCreateDialog}
            fullWidth={isMobile}
            size={isMobile ? 'small' : 'medium'}
            sx={theming.getThemedButtonSx()}
          >
            {isMobile ? 'Add' : 'Add Shot'}
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
                  <MenuItem value="All">All Status</MenuItem>
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
                  <MenuItem value="All">All Scenes</MenuItem>
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
                    <Tooltip title="Edit Shot">
                      <IconButton onClick={() => openEditDialog(shot)}>
                        {theming.getThemedIcon('edit')}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Shot">
                      <IconButton
                        onClick={() => {
                          setSelectedShot(shot);
                          deleteShot.mutate(shot.id);
                      }}
                        color="error"
                      >
                        {theming.getThemedIcon('delete')}
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
          {editingShot ? 'Edit Shot' : 'Add New Shot'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Shot Title"
                value={shotForm.title || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
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
                <InputLabel>Shot Type</InputLabel>
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
                label="Duration (seconds)"
                type="number"
                value={shotForm.duration ?? 0}
                onChange={(e) => setShotForm((prev) => ({ ...prev, duration: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
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
                label="Camera Settings"
                value={shotForm.cameraSettings || ''}
                onChange={(e) => setShotForm((prev) => ({ ...prev, cameraSettings: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Equipment Needed"
                value={equipmentInput}
                onChange={(e) => setEquipmentInput(e.target.value)}
                helperText="Separate multiple items with commas"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
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
                updateShotListManager.mutate({
                  ...editingShot,
                  ...basePayload
                });
              } else {
                createShot.mutate(basePayload);
              }
              setShowDialog(false);
              setEditingShot(null);
          }}
          >
            {editingShot ? 'Update Shot' : 'Create Shot'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
