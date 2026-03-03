import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Drawer,
  AppBar,
  Toolbar,
  Menu,
  MenuList,
  MenuItem as MenuItemComponent,
  ListItemButton,
  ListItemIcon as ListItemIconComponent,
  ListItemText as ListItemTextComponent,
  Collapse,
  Breadcrumbs,
  Link,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Backdrop,
  CircularProgress,
  Skeleton,
  Alert as MuiAlert,
  Snackbar,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Import all phase components
import InteractiveDocumentSystem from './InteractiveDocumentSystem';
import AIContentEnhancement from './AIContentEnhancement';
import RealTimeCollaboration from './RealTimeCollaboration';
import AdvancedAnalytics from './AdvancedAnalytics';
import GamificationSystem from './GamificationSystem';
import MobileFirstDesign from './MobileFirstDesign';
import ThemeEngine from './ThemeEngine';
import AnimationSystem from './AnimationSystem';
import VisualEffects from './VisualEffects';
import AccessControl from './AccessControl';
import DataEncryption from './DataEncryption';
import PrivacyControls from './PrivacyControls';
import APIIntegration from './APIIntegration';
import TestingFramework from './TestingFramework';
import PerformanceMonitoring from './PerformanceMonitoring';

// Import the existing admin component
import AdminCreatorHubNotes from '../admin/CreatorHubNotes2.tsx.bak';

// Import the CreatorHub Norge documentation
import CreatorHubNorgeDocumentation from './CreatorHubNorgeDocumentation';

// Types
interface Phase {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  component: React.ComponentType<any>;
  status: 'completed' | 'in_progress' | 'pending';
  features: string[];
  progress: number
}

interface SystemStats {
  totalPhases: number;
  completedPhases: number;
  totalComponents: number;
  totalIcons: number;
  activeUsers: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical'
}

interface CreatorHubNotesProps {
  className?: string;
  onPhaseChange?: (phase: Phase) => void;
  onSystemExport?: (data: any) => void
}

// Phase definitions
const phases: Phase[] = [
  {
    id: 'phase',
    name: 'Admin Notes System',
    description: 'Original CreatorHub Notes with AI utilities and Google Docs integration',
    icon: CREATOR_HUB_ICONS.notes,
    component: AdminCreatorHubNotes,
    status: 'completed',
    features: ['Rich Text Editor','AI Utilities','Google Docs Integration','Note Management','Search & Categories','Auto-save'],
    progress: 100 },
  {
    id: 'phase',
    name: 'Core Interactive Documentation',
    description: 'Foundation interactive documentation system with advanced features',
    icon: CREATOR_HUB_ICONS.interactiveDocs,
    component: InteractiveDocumentSystem,
    status: 'completed',
    features: ['Interactive Documents','AI Integration','Real-time Collaboration','Advanced Analytics','Gamification','Mobile Design'],
    progress: 100 },
  {
    id: 'phase',
    name: 'Advanced Features & Intelligence',
    description: 'AI-powered content enhancement and intelligent features',
    icon: CREATOR_HUB_ICONS.i,
    component: AIContentEnhancement,
    status: 'completed',
    features: ['AI Content Enhancement','Real-time Collaboration','Advanced Analytics','Gamification System','Mobile-First Design'],
    progress: 100 },
  {
    id: 'phase',
    name: 'Advanced Visual Features & Customization',
    description: 'Advanced visual customization and theme management',
    icon: CREATOR_HUB_ICONS.themeEngine,
    component: ThemeEngine,
    status: 'completed',
    features: ['Theme Engine','Animation System','Visual Effects','Advanced Customization'],
    progress: 100 },
  {
    id: 'phase',
    name: 'Security & Privacy Features',
    description: 'Comprehensive security and privacy management',
    icon: CREATOR_HUB_ICONS.security,
    component: AccessControl,
    status: 'completed',
    features: ['Access Control','Data Encryption','Privacy Controls'],
    progress: 100 },
  {
    id: 'phase',
    name: 'Integration & Testing Features',
    description: 'API integration and comprehensive testing framework',
    icon: CREATOR_HUB_ICONS.apiIntegration,
    component: APIIntegration,
    status: 'completed',
    features: ['API Integration','Testing Framework','Performance Monitoring'],
    progress: 100 },
  {
    id: 'phase',
    name: 'CreatorHub Norge Documentation',
    description: 'Complete platform documentation and guides',
    icon: CREATOR_HUB_ICONS.documentation,
    component: CreatorHubNorgeDocumentation,
    status: 'completed',
    features: ['Platform Overview','Feature Documentation','API Guides', 'Deployment Guide','Support Resources'],
    progress: 100 }
];

const CreatorHubNotes: React.FC<CreatorHubNotesProps> = ({
  className ='',
  onPhaseChange,
  onSystemExport
}) => {
  // State
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPhaseDialog, setShowPhaseDialog] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalPhases: phases.length,
    completedPhases: phases.filter(p => p.status === 'completed').length,
    totalComponents:  17, // 15 new + 1 admin + 1 documentation
    totalIcons:  37, // 27 new + 1 notes + 9 documentation icons
    activeUsers: 127,
    systemHealth: 'excellent'
});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Handlers
  const handlePhaseSelect = useCallback((phase: Phase) => {
    setActivePhase(phase);
    setActiveTab(0);
    onPhaseChange?.(phase);
}, [onPhaseChange]);

  const handlePhaseEdit = useCallback((phase: Phase) => {
    setSelectedPhase(phase);
    setShowPhaseDialog(true);
}, []);

  const handleSystemExport = useCallback(() => {
    const exportData = {
      phases,
      systemStats,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
};
    onSystemExport?.(exportData);
}, [onSystemExport]);

  const getHealthColor = useCallback((health: string) => {
    switch (health) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
}
}, []);

  const getHealthIcon = useCallback((health: string) => {
    switch (health) {
      case 'excellent': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'good': return <CREATOR_HUB_ICONS.info />;
      case 'warning': return <CREATOR_HUB_ICONS.warning />;
      case 'critical': return <CREATOR_HUB_ICONS.error />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized data
  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'Phase 5 completed', phase: 'Integration & Testing', timestamp: new Date(), type: 'phase',},
      { id: 2, action: 'New component added', component: 'Performance Monitoring', timestamp: new Date(), type: 'component',},
      { id:  3, action: 'System health check', status: 'excellent', timestamp: new Date(), type: 'system',},
    ];
}, []);

  const quickActions = useMemo(() => [
    { icon: <CREATOR_HUB_ICONS.add  />, name: 'New Document', action: () => console.log('New Document', ),},
    { icon: <CREATOR_HUB_ICONS.analytics  />, name: 'View Analytics', action: () => console.log('View Analytics', ),},
    { icon: <CREATOR_HUB_ICONS.settings  />, name: 'Settings', action: () => console.log('Settings', ),},
    { icon: <CREATOR_HUB_ICONS.download  />, name: 'Export Data', action: handleSystemExport },
  ], [handleSystemExport]);

  return (
    <Box className={className} sx={{ display: 'flex', height: '100vh'}}>
      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={sidebarOpen}
        sx={{
          width: 20,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 20,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.interactiveDocs sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>CreatorHub</Typography>
              <Typography variant="body2" color="text.secondary">
                Interactive Documentation
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
        
        <Divider />
        
        {/* System Stats */}
        <Box sx={{ p:  2 }}>
          <Typography variant="subtitle2" gutterBottom>
            System Overview
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
              <Typography variant="body2">Phases</Typography>
              <Typography variant="body2" color="primary">
                {systemStats.completedPhases}/{systemStats.totalPhases}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
              <Typography variant="body2">Components</Typography>
              <Typography variant="body2" color="primary">
                {systemStats.totalComponents}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
              <Typography variant="body2">Icons</Typography>
              <Typography variant="body2" color="primary">
                {systemStats.totalIcons}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
              <Typography variant="body2">Health</Typography>
              <Chip
                icon={getHealthIcon(systemStats.systemHealth)}
                label={systemStats.systemHealth}
                color={getHealthColor(systemStats.systemHealth) as any}
                size="small"
              />
            </Box>
          </Stack>
        </Box>
        
        <Divider />
        
        {/* Phase Navigation */}
        <Box sx={{ flex: 1, overflow: 'auto'}}>
          <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
            Phases
          </Typography>
          <List>
            {phases.map((phase) => (
              <ListItem key={phase.id} disablePadding>
                <ListItemButton
                  selected={activePhase?.id === phase.id}
                  onClick={() => handlePhaseSelect(phase)}
                >
                  <ListItemIconComponent>
                    <phase.icon />
                  </ListItemIconComponent>
                  <ListItemTextComponent
                    primary={phase.name}
                    secondary={phase.description}
                  />
                  <Chip
                    label={phase.status}
                    color={phase.status === 'completed' ? 'success' : 'warning'}
                    size="small"
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
        
        <Divider />
        
        {/* Quick Actions */}
        <Box sx={{ p:  2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Actions
          </Typography>
          <Stack spacing={1}>
            {quickActions.map((action, index) => (
              <Button
                key={index}
                startIcon={action.icon}
                onClick={action.action}
                fullWidth
                variant="outlined"
                size="small"
              >
                {action.name}
              </Button>
            ))}
          </Stack>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column'}}>
        {/* Top App Bar */}
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr:  2 }}
            >
              <CREATOR_HUB_ICONS.menu />
            </IconButton>
            
            <Typography variant="h6" sx={{ flexGrow:  1, color: theming.colors.primary }}>
              {activePhase ? activePhase.name : 'CreatorHub Interactive Documentation'}
            </Typography>
            
            <Stack direction="row" spacing={1}>
              <IconButton
                color="inherit"
                onClick={() => setShowNotifications(true)}
              >
                <Badge badgeContent={notifications.length} color="error">
                  <CREATOR_HUB_ICONS.notifications />
                </Badge>
              </IconButton>
              
              <IconButton color="inherit">
                <CREATOR_HUB_ICONS.settings />
              </IconButton>
              
              <IconButton color="inherit">
                <CREATOR_HUB_ICONS.accountCircle />
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Content Area */}
        <Box sx={{ flex: 1, overflow: 'auto', p:  2 }}>
          {activePhase ? (
            <Box>
              {/* Phase Header */}
              <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
                <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <activePhase.icon sx={{ fontSize:  32, color: 'primary.main'}} />
                    <Box>
                      <Typography variant="h5" sx={{ color: theming.colors.primary }}>{activePhase.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activePhase.description}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<CREATOR_HUB_ICONS.edit />}
                      onClick={() => handlePhaseEdit(activePhase)}
                    >
                      Edit Phase
                    </Button>
                    <Button variant="contained"
                      startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
                      onClick={handleSystemExport}
                    >
                      Export
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {/* Phase Progress */}
              <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Phase Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={activePhase.progress}
                  sx={{ mb: 2, height:  8, borderRadius:  4 }}
                />
                <Stack direction="row" spacing={4} justifyContent="space-between">
                  <Typography variant="body2">
                    {activePhase.progress}% Complete
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activePhase.features.length} Features
                  </Typography>
                </Stack>
              </Paper>

              {/* Phase Features */}
              <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Features
                </Typography>
                <Grid container spacing={1}>
                  {activePhase.features.map((feature, index) => (
                    <Grid item key={index}>
                      <Chip
                        label={feature}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Phase Component */}
              <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <activePhase.component />
              </Paper>
            </Box>
          ) : (
            <Box>
              {/* Welcome Screen */}
              <Paper elevation={1} sx={{ p:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <CREATOR_HUB_ICONS.interactiveDocs sx={{ fontSize:  64, color: 'primary.main', mb:  2 }} />
                <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
                  Welcome to CreatorHub
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2, color: theming.colors.primary }}>
                  Interactive Documentation System
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  Select a phase from the sidebar to explore the comprehensive features and capabilities
                  of the CreatorHub Interactive Documentation System.
                </Typography>
                
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt:  3 }}>
                  <Button variant="contained"
                    startIcon={<CREATOR_HUB_ICONS.playArrow sx={theming.getThemedButtonSx()} />}
                    onClick={() => handlePhaseSelect(phases[0])}
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CREATOR_HUB_ICONS.info />}
                    onClick={() => setActiveTab(1)}
                  >
                    Learn More
                  </Button>
                </Stack>
              </Paper>

              {/* System Overview */}
              <Grid container spacing={2} sx={{ mt:  2 }}>
                <Grid item xs={12} md={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        System Statistics
                      </Typography>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">Total Phases</Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{systemStats.totalPhases}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">Completed Phases</Typography>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                            {systemStats.completedPhases}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">Total Components</Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{systemStats.totalComponents}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                          <Typography variant="body2">Custom Icons</Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{systemStats.totalIcons}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Recent Activity
                      </Typography>
                      <List>
                        {recentActivity.map((activity) => (
                          <ListItem key={activity.id}>
                            <ListItemIcon>
                              <CREATOR_HUB_ICONS.history />
                            </ListItemIcon>
                            <ListItemText
                              primary={activity.action}
                              secondary={activity.timestamp.toLocaleString()}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </Box>

      {/* Phase Dialog */}
      <Dialog open={showPhaseDialog} onClose={() => setShowPhaseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {selectedPhase && <selectedPhase.icon />}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedPhase?.name}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedPhase && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Phase Name"
                value={selectedPhase.name}
                fullWidth
                disabled
              />
              <TextField
                label="Description"
                value={selectedPhase.description}
                fullWidth
                multiline
                rows={3}
                disabled
              />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Features
                </Typography>
                <Grid container spacing={1}>
                  {selectedPhase.features.map((feature, index) => (
                    <Grid item key={index}>
                      <Chip
                        label={feature}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={selectedPhase.progress}
                  sx={{ height:  8, borderRadius:  4 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                  {selectedPhase.progress}% Complete
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPhaseDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={showNotifications}
        autoHideDuration={6000}
        onClose={() => setShowNotifications(false)}
      >
        <MuiAlert
          onClose={() => setShowNotifications(false)}
          severity="info"
          sx={{ width: '100%'}}
        >
          No new notifications
        </MuiAlert>
      </Snackbar>

      {/* Speed Dial */}
      <SpeedDial
        ariaLabel="Quick Actions"
        sx={{ position: 'fixed', bottom:  16, right: 16}}
        icon={<SpeedDialIcon />}
      >
        {quickActions.map((action, index) => (
          <SpeedDialAction
            key={index}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.action}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default CreatorHubNotes;
