// @ts-nocheck
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Stack,
  LinearProgress,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface UserSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'editor' | 'viewer' | 'external';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pagesVisited: number;
  interactions: number;
  device: 'desktop' | 'tablet' | 'mobile';
  browser: string;
  location: string;
  referrer?: string;
  isActive: boolean
}

interface UserJourney {
  id: string;
  userId: string;
  steps: JourneyStep[];
  totalDuration: number;
  completionRate: number;
  satisfaction?: number;
  createdAt: Date
}

interface JourneyStep {
  id: string;
  action: string;
  target: string;
  timestamp: Date;
  duration: number;
  metadata?: Record<string, any>;
}

interface HeatmapData {
  element: string;
  clicks: number;
  hovers: number;
  scrolls: number;
  x: number;
  y: number;
  width: number;
  height: number
}

interface BehaviorPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  users: string[];
  impact: 'positive' | 'negative' | 'neutral';
  category: 'navigation' | 'interaction' | 'content' | 'performance'
}

interface UserBehaviorTrackerProps {
  className?: string;
  onUserSelect?: (userId: string) => void;
  onPatternDetected?: (pattern: BehaviorPattern) => void;
  onExport?: (data: any) => void
}

// Mock data








const UserBehaviorTracker: React.FC<UserBehaviorTrackerProps> = ({
  className ='',
  onUserSelect,
  onPatternDetected,
  onExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  // Handlers
  const handleUserSelect = useCallback((userId: string) => {
    setSelectedUser(userId);
    onUserSelect?.(userId);
}, [onUserSelect]);

  const handlePatternDetected = useCallback((pattern: BehaviorPattern) => {
    onPatternDetected?.(pattern);
}, [onPatternDetected]);

  const getRoleColor = useCallback((role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'editor': return 'warning';
      case 'viewer': return 'info';
      case 'external': return 'default';
      default: return 'default';
}
}, []);

  const getDeviceIcon = useCallback((device: string) => {
    switch (device) {
      case 'desktop': return <CREATOR_HUB_ICONS.computer />;
      case 'tablet': return <CREATOR_HUB_ICONS.tablet />;
      case 'mobile': return <CREATOR_HUB_ICONS.phone />;
      default: return <CREATOR_HUB_ICONS.computer />;
}
}, []);

  const getImpactColor = useCallback((impact: string) => {
    switch (impact) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'default';
      default: return 'default';
}
}, []);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
  } else {
      return `${secs}s`;
  }
}, []);

  // Memoized data
  const activeSessions = useMemo(() => {
    return mockSessions.filter(session => session.isActive);
}, []);

  const completedSessions = useMemo(() => {
    return mockSessions.filter(session => !session.isActive);
}, []);

  const userStats = useMemo(() => {
    const totalSessions = mockSessions.length;
    const activeUsers = activeSessions.length;
    const avgDuration = completedSessions.reduce((sum, session) => 
      sum + (session.duration || 0), 0) / completedSessions.length;
    const totalInteractions = mockSessions.reduce((sum, session) => 
      sum + session.interactions, 0);

    return {
      totalSessions,
      activeUsers,
      avgDuration: avgDuration || 0,
      totalInteractions
  };
}, [activeSessions, completedSessions]);

  // Auto-detect patterns
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate pattern detection
      const randomPattern = mockPatterns[Math.floor(Math.random() * mockPatterns.length)];
      if (Math.random() > 0.7) {
        handlePatternDetected(randomPattern);
    }
  }, 10000);

    return () => clearInterval(interval);
}, [handlePatternDetected]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.psychology sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>User Behavior Tracker</Typography>
              <Typography variant="body2" color="text.secondary">
                Monitor user interactions and behavior patterns
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={trackingEnabled}
                  onChange={(e) => setTrackingEnabled(e.target.checked)}
                />
            }
              label="Tracking"
            />
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={() => onExport?.(mockSessions)}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb:  2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.group color="primary" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{userStats.totalSessions}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Sessions
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.visibility color="success" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{userStats.activeUsers}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.timeline color="info" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{formatDuration(userStats.avgDuration)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Duration
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.smartToy color="warning" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{userStats.totalInteractions}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Interactions
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Live Sessions" icon={<CREATOR_HUB_ICONS.visibility />} />
        <Tab label="User Journeys" icon={<CREATOR_HUB_ICONS.timeline />} />
        <Tab label="Heatmap" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="Patterns" icon={<CREATOR_HUB_ICONS.autoFixHigh />} />
      </Tabs>

      {/* Live Sessions Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Active Sessions
              </Typography>
              <List>
                {activeSessions.map((session) => (
                  <ListItem 
                    key={session.id}
                    button
                    onClick={() => handleUserSelect(session.userId)}
                    selected={selectedUser === session.userId}
                  >
                    <ListItemIcon>
                      <Badge color="success" variant="dot">
                        <Avatar sx={{ width:  32, height: 32}}>
                          {session.userName.charAt(0)}
                        </Avatar>
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">{session.userName}</Typography>
                          <Chip label={session.userRole} size="small" color={getRoleColor(session.userRole)} />
                        </Stack>
                    }
                      secondary={
                        <Stack spacing={1}>
                          <Typography variant="body2">
                            {session.pagesVisited} pages • {session.interactions} interactions
                          </Typography>
                          <Stack direction="row" spacing={2} alignItems="center">
                            {getDeviceIcon(session.device)}
                            <Typography variant="caption">{session.browser}</Typography>
                            <Typography variant="caption">{session.location}</Typography>
                          </Stack>
                        </Stack>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Recent Sessions
              </Typography>
              <List>
                {completedSessions.slice(0, 5).map((session) => (
                  <ListItem key={session.id}>
                    <ListItemIcon>
                      <Avatar sx={{ width:  32, height: 32}}>
                        {session.userName.charAt(0)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">{session.userName}</Typography>
                          <Chip label={session.userRole} size="small" color={getRoleColor(session.userRole)} />
                        </Stack>
                    }
                      secondary={
                        <Stack spacing={1}>
                          <Typography variant="body2">
                            {formatDuration(session.duration || 0)} • {session.pagesVisited} pages
                          </Typography>
                          <Typography variant="caption">
                            {session.startTime.toLocaleString()}
                          </Typography>
                        </Stack>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* User Journeys Tab */}
      {activeTab === 1 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            User Journey Analysis
          </Typography>
          {mockJourneys.map((journey) => (
            <Accordion key={journey.id} sx={{ mb:  2 }}>
              <AccordionSummary expandIcon={<CREATOR_HUB_ICONS.expandMore />}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%'}}>
                  <Typography variant="subtitle1">
                    Journey {journey.id} - {journey.steps.length} steps
                  </Typography>
                  <Chip 
                    label={`${journey.completionRate}% complete`}
                    size="small" 
                    color="success" 
                  />
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration(journey.totalDuration)}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {journey.steps.map((step, index) => (
                    <ListItem key={step.id}>
                      <ListItemIcon>
                        <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primary={`${step.action} ${step.target}`}
                        secondary={`${formatDuration(step.duration)} at ${step.timestamp.toLocaleTimeString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}

      {/* Heatmap Tab */}
      {activeTab === 2 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb:  2 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Interaction Heatmap</Typography>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.visibility />}
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              {showHeatmap ? 'Hide' : 'Show'} Heatmap
            </Button>
          </Stack>
          {showHeatmap && (
            <Box sx={{ position: 'relative', height: 40, border: '1px solid #ddd', borderRadius:  1 }}>
              {mockHeatmapData.map((data, index) => (
                <Tooltip
                  key={index}
                  title={`${data.element}: ${data.clicks} clicks, ${data.hovers} hovers`}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: data.x,
                      top: data.y,
                      width: data.width,
                      height: data.height,
                      bgcolor: data.clicks > 50 ? 'error.main' : data.clicks > 20 ? 'warning.main' : 'info.main',
                      opacity: 0.3,
                      borderRadius:  1,
                      cursor: 'pointer','&:hover': { opacity: 0.6,}
                  }}
                  />
                </Tooltip>
              ))}
            </Box>
          )}
          <TableContainer sx={{ mt:  2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Element</TableCell>
                  <TableCell align="right">Clicks</TableCell>
                  <TableCell align="right">Hovers</TableCell>
                  <TableCell align="right">Scrolls</TableCell>
                  <TableCell align="right">Position</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockHeatmapData.map((data, index) => (
                  <TableRow key={index}>
                    <TableCell>{data.element}</TableCell>
                    <TableCell align="right">{data.clicks}</TableCell>
                    <TableCell align="right">{data.hovers}</TableCell>
                    <TableCell align="right">{data.scrolls}</TableCell>
                    <TableCell align="right">{data.x}, {data.y}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Patterns Tab */}
      {activeTab === 3 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Behavior Patterns
          </Typography>
          <Grid container spacing={2}>
            {mockPatterns.map((pattern) => (
              <Grid item xs={12} md={6} key={pattern.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <CREATOR_HUB_ICONS.autoFixHigh color={getImpactColor(pattern.impact)} />
                      <Box sx={{ flex:  1 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {pattern.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {pattern.description}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip 
                            label={pattern.category}
                            size="small" 
                            variant="outlined" 
                          />
                          <Chip 
                            label={`${pattern.frequency} users`}
                            size="small" 
                            color={getImpactColor(pattern.impact)}
                          />
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default UserBehaviorTracker;

