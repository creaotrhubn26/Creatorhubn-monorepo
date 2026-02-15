/**
 * Collaboration Tools Component
 * Voice tutorials, gamified learning, progress tracking
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Avatar,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  School,
  EmojiEvents,
  TrendingUp,
  Share,
  Group,
  HeadsetMic,
  Psychology,
  ExpandMore
} from '@mui/icons-material';

interface CollaborationToolsProps {
  selectedProject?: { id: string; name?: string };
  onNotificationCreate?: (notification: Record<string, unknown>) => void; 
}

export const CollaborationTools: React.FC<CollaborationToolsProps> = ({
  selectedProject,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('collaboration_tools_render,');
    
    lifecycle.registerComponent({
      id: 'CollaborationTools',
      type: 'collaboration-tools',
      version: '1.0.0',
      capabilities: {
        data: ['voice:manage','achievement:track','progress:monitor','session:manage'],
        events: ['voice:session:start','achievement:earned','progress:updated'],
        actions: ['voice:start','voice:stop','achievement:check','progress:track'],
        ui: ['voice:interface','achievement:display','progress:show'],
        system: ['performance:monitor','analytics:track','debug:log']
      },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    analytics.trackEvent('collaboration_tools_mounted', {
      componentId: 'CollaborationTools',
      projectId: selectedProject?.id,
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'CollaborationTools component mounted', {
      componentId: 'CollaborationTools',
      projectId: selectedProject?.id
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('CollaborationTools');
      analytics.trackEvent('collaboration_tools_unmounted', {
        componentId: 'CollaborationTools',
        timestamp: Date.now()
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedProject?.id]);

  const [activeVoiceSession, setActiveVoiceSession] = useState<Record<string, unknown> | null>(null);
  const [achievements, setAchievements] = useState<Record<string, unknown>[]>([
    { id: '1', title: 'First Project', description: 'Created your first project', earned: true },
    { id: '2', title: 'Quick Learner', description: 'Completed basic tutorial', earned: true },
    { id: '3', title: 'User Expert', description: 'Used all major features', earned: false }
  ]);
  const [recentActivities, setRecentActivities] = useState<Record<string, unknown>[]>([
    { id: '1', type: 'element_added', timestamp: new Date(), description: 'Added image element' },
    { id: '2', type: 'project_saved', timestamp: new Date(), description: 'Project auto-saved' }
  ]);
  const [userProgress, setUserProgress] = useState({
    level: 2,
    experience: 70,
    nextLevel: 100,
    badges: ['beginner', 'quick_learner'],
    timeSpent: 24.5,
    completions: 8
  });

  // Voice Control Functions
  const startVoiceSession = useCallback(async () => {
    try {
      // Simulate voice API call
      const newSession = {
        id: `voice_${Date.now()}`,
        started: new Date(),
        commands: []
      };

      setActiveVoiceSession(newSession);
      setIsVoiceEnabled(true);

      onNotificationCreate?.({
        id: `voice_session_${Date.now()}`,
        type: 'meeting_created',
        title: 'Voice Tutorial Started',
        message: 'Connected to voice guidance system',
        priority: 'medium',
        source: 'collaboration',
        timestamp: new Date().toISOString()
      });

  } catch (error) {
      console.error('Failed to start voice session: ', error);
      onNotificationCreate?.({
        id: `voice_error_${Date.now()}`,
        type: 'error',
        title: 'Voice Session Failed',
        message: 'Could not connect to voice guidance',
        priority: 'high',
        source: 'collaboration',
        timestamp: new Date().toISOString()
    ,});
  }
}, [onNotificationCreate]);

  const stopVoiceSession = useCallback(() => {
    setIsVoiceEnabled(false);
    setActiveVoiceSession(null);
    
    onNotificationCreate?.({
      id: `voice_session_ended_${Date.now()}`,
      type: 'meeting_created',
      title: 'Voice Tutorial Ended',
      message: 'Session completed successfully',
      priority: 'low',
      source: 'collaboration',
      timestamp: new Date().toISOString()
  ,});
}, [onNotificationCreate]);

  // Gamification Functions
  const unlockAchievement = useCallback((achievementId: string) => {
    setAchievements(prev => prev.map(achievement => 
      achievement.id === achievementId 
        ? { ...achievement, earned: true }
        : achievement
    ));

    const achieved = achievements.find(a => a.id === achievementId);
    if (achieved) {
      onNotificationCreate?.({
        id: `achievement_unlocked_${Date.now()}`,
        type: 'project_updated',
        title: 'Achievement Unlocked, !',
        message: `${achieved.title}: ${achieved.description as string}`,
        priority: 'medium',
        source: 'gamification',
        timestamp: new Date().toISOString()
    ,});
  }
}, [achievements, onNotificationCreate]);

  return (
    <Paper sx={{ p:  3, m:  2 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('group')}
        Collaboration & Learning
      </Typography>

      {/* Voice Guidance */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            {isVoiceEnabled ? theming.getThemedIcon('mic') : theming.getThemedIcon('micOff')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Voice-Guidance</Typography>
            {activeVoiceSession && (
              <Chip label="Active" color="success" size="small" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Voice Tutorial System
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Get step-by-step guidance as you work
                  </Typography>

                  {!isVoiceEnabled ? (
                    <Button variant="contained"
                      startIcon={theming.getThemedIcon('mic')}
                      onClick={startVoiceSession}
                      fullWidth
                      sx={theming.getThemedButtonSx()}>
                      Start Voice Tutorial
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={theming.getThemedIcon('micOff')}
                      onClick={stopVoiceSession}
                      fullWidth
                    >
                      End Session
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {activeVoiceSession && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Session Progress
                    </Typography>
                    <Typography variant="body2">
                      Started: {activeVoiceSession.started.toLocaleTimeString()}
                    </Typography>
                    <Typography variant="body2">
                      Commands: {activeVoiceSession.commands.length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Achievement System */}
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <EmojiEvents />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Achievements & Progress</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 3 }}>
            {/* User Level Progress */}
            <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Level {userProgress.level}</Typography>
                  <Typography variant="body2">{userProgress.experience}/{userProgress.nextLevel} XP</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(userProgress.experience / userProgress.nextLevel) * 100}
                />
                <Typography variant="caption" color="text.secondary">
                  {userProgress.nextLevel - userProgress.experience} XP to next level
                </Typography>
              </CardContent>
            </Card>

            {/* Achievements Grid */}
            <Grid container spacing={1}>
              {achievements.map((achievement) => (
                <Grid size={{ xs:  12, sm:  6 }} key={achievement.id}>
                  <Card 
                    sx={{ 
                      opacity: achievement.earned ? 1 : 0.6,
                      border: achievement.earned ? '2px solid gold' : '1px solid #ddd',
                      ...theming.getThemedCardSx()
                    }}>
                    <CardContent sx={{ p: 1.5,  ...theming.getThemedCardSx() }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <EmojiEvents 
                          color={achievement.earned ? 'secondary' : 'disabled'}
                        />
                        <Box sx={{ flex:  1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {achievement.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {achievement.description as string}
                          </Typography>
                        </Box>
                        {achievement.earned && (
                          <Chip label="✓" color="success" size="small" />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Recent Activity */}
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('trendingUp')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Recent Activity</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <List dense>
            {recentActivities.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 24, height: 24 }}>
                    <Typography variant="caption">✓</Typography>
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={activity.description as string}
                  secondary={activity.timestamp.toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Learning Analytics */}
      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <Psychology />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Learning Analytics</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {userProgress.timeSpent}h
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Time Spent
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {userProgress.completions}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tasks Completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {userProgress.badges.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Badges Earned
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign:'center', ...theming.getThemedCardSx() }}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    85%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Success Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default CollaborationTools;
