/**
 * AI Learning Assistant - Personalized learning recommendations and adaptive content
 * Provides intelligent suggestions based on user behavior and learning patterns
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  Alert,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface LearningProfile {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  strengths: string[];
  weaknesses: string[];
  progress: number;
  lastActive: Date;
  totalTime: number;
  completedModules: string[];
  currentStreak: number;
  achievements: Achievement[]
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlockedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface LearningRecommendation {
  id: string;
  type: 'content' | 'exercise' | 'assessment' | 'project';
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  relevance: number;
  reason: string;
  content: any;
  priority: 'low' | 'medium' | 'high'
}

interface AILearningAssistantProps {
  userId: string;
  onRecommendationClick: (recommendation: LearningRecommendation) => void;
  onUpdateProfile: (profile: LearningProfile) => void;
  className?: string
}

export const AILearningAssistant: React.FC<AILearningAssistantProps> = ({
  userd,
  onRecommendationClick,
  onUpdateProfile,
  className,
}) => {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [recommendations, setRecommendations] = useState<LearningRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Mock learning profile data
  const mockProfile: LearningProfile = {
    id: userd,
    name: 'Alex Johnson',
    level: 'intermediate',
    interests: ['React','TypeScript','UI/UX','AI/ML'],
    learningStyle: 'visual',
    strengths: ['Problem Solving','Code Organization','Team Collaboration'],
    weaknesses: ['Testing','Performance Optimization','Security'],
    progress:  68,
    lastActive: new Date(),
    totalTime: 120, // minutes
    completedModules: ['react-basics','typescript-fundamentals''ui-design'],
    currentStreak:  7,
    achievements: [
      {
        id: '',
        title: 'First Steps',
        description: 'Completed your first module',
        icon: <CREATOR_HUB_ICONS.checkCircle  />,
        unlockedAt: new Date('2024-01-15', ),
        rarity: 'common'
  },
      {
        id: '',
        title: 'Week Warrior',
        description: '7-day learning streak',
        icon: <CREATOR_HUB_ICONS.timeline  />,
        unlockedAt: new Date('2024-01-22', ),
        rarity: 'rare'
  },
      {
        id: ', ',
        title: 'Code Master',
        description: 'Solved 50 coding challenges',
        icon: <CREATOR_HUB_ICONS.code  />,
        unlockedAt: new Date('2024-01-20', ),
        rarity: 'epic'
  }
    ]
};

  // Mock recommendations
  

  useEffect(() => {
    // Load user profile and recommendations
    setIsLoading(true);
    setTimeout(() => {
      setProfile(mockProfile);
      setRecommendations(mockRecommendations);
      setIsLoading(false);
  }, 1000);
}, [userId]);

  const handleRecommendationClick = useCallback((recommendation: LearningRecommendation) => {
    onRecommendationClick(recommendation);
}, [onRecommendationClick]);

  const handleProfileUpdate = useCallback((updatedProfile: LearningProfile) => {
    setProfile(updatedProfile);
    onUpdateProfile(updatedProfile);
}, [onUpdateProfile]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
}
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
}
};

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'error';
      case 'epic': return 'secondary';
      case 'rare': return 'primary';
      case 'common': return 'default';
      default: return 'default';
}
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'content': return <CREATOR_HUB_ICONS.article />;
      case 'exercise': return <CREATOR_HUB_ICONS.code />;
      case 'assessment': return <CREATOR_HUB_ICONS.assessment />;
      case 'project': return <CREATOR_HUB_ICONS.build />;
      default: return <CREATOR_HUB_ICONS.info />;
}
};

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

  if (isLoading) {
    return (
      <Box className={className} sx={{ width: '100%'}}>
        <Paper elevation={2} sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Stack spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.smartToy sx={{ fontSize:  48, color: 'primary.main'}} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Loading your learning profile...</Typography>
            <LinearProgress sx={{ width: '100%'}} />
          </Stack>
        </Paper>
      </Box>
    );
}

  if (!profile) {
    return (
      <Box className={className} sx={{ width: '100%'}}>
        <Alert severity="error">
          Failed to load learning profile. Please try again.
        </Alert>
      </Box>
    );
}

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main'}}>
              <CREATOR_HUB_ICONS.smartToy />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI Learning Assistant</Typography>
              <Typography variant="body2" color="text.secondary">
                Personalized learning recommendations for {profile.name}
              </Typography>
            </Box>
          </Stack>
          
          <Button
            variant="outlined"
            startIcon={<CREATOR_HUB_ICONS.settings />}
            onClick={() => setShowProfileDialog(true)}
          >
            Edit Profile
          </Button>
        </Stack>
      </Paper>

      {/* Learning Progress */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Learning Progress
        </Typography>
        
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:  1 }}>
              <Typography variant="body2">Overall Progress</Typography>
              <Typography variant="body2">{profile.progress}%</Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={profile.progress}
              sx={{ height:  8, borderRadius:  4 }}
            />
          </Box>
          
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {profile.currentStreak}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Day Streak
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {formatTime(profile.totalTime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Time
              </Typography>
            </Box>
            <Box>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {profile.completedModules.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Modules Completed
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Paper>

      {/* Achievements */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Recent Achievements
        </Typography>
        
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap:  1 }}>
          {profile.achievements.map((achievement) => (
            <Tooltip key={achievement.id} title={achievement.description}>
              <Chip
                icon={achievement.icon}
                label={achievement.title}
                color={getRarityColor(achievement.rarity)}
                variant="outlined"
                size="small"
              />
            </Tooltip>
          ))}
        </Stack>
      </Paper>

      {/* Recommendations */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Recommended for You
        </Typography>
        
        <Stack spacing={2}>
          {recommendations.map((recommendation) => (
            <Card key={recommendation.id} variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ mt: 0.5}}>
                    {getTypeIcon(recommendation.type)}
                  </Box>
                  
                  <Box sx={{ flex:  1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:  1 }}>
                      <Typography variant="subtitle1">{recommendation.title}</Typography>
                      <Chip 
                        label={recommendation.difficulty}
                        size="small" 
                        color={getDifficultyColor(recommendation.difficulty)}
                        variant="outlined"
                      />
                      <Chip 
                        label={recommendation.priority}
                        size="small" 
                        color={getPriorityColor(recommendation.priority)}
                        variant="outlined"
                      />
                      <Chip 
                        label={`${Math.round(recommendation.relevance * 100)}% match`}
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {recommendation.description}
                    </Typography>
                    
                    <Typography variant="caption" color="text.secondary">
                      {recommendation.reason} • {formatTime(recommendation.estimatedTime)}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
              
              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  size="small"
                  startIcon={<CREATOR_HUB_ICONS.visibility />}
                  onClick={() => handleRecommendationClick(recommendation)}
                >
                  Start Learning
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      </Paper>

      {/* Profile Dialog */}
      <Dialog 
        open={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Edit Learning Profile</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3}>
            <FormControl fullWidth>
              <InputLabel>Learning Level</InputLabel>
              <Select
                value={profile.level}
                onChange={(e) => setProfile(prev => prev ? { ...prev, level: e.target.value as any } : null)}
              >
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Learning Style</InputLabel>
              <Select
                value={profile.learningStyle}
                onChange={(e) => setProfile(prev => prev ? { ...prev, learningStyle: e.target.value as any } : null)}
              >
                <MenuItem value="visual">Visual</MenuItem>
                <MenuItem value="auditory">Auditory</MenuItem>
                <MenuItem value="kinesthetic">Kinesthetic</MenuItem>
                <MenuItem value="reading">Reading</MenuItem>
              </Select>
            </FormControl>
            
            <Box>
              <Typography gutterBottom>Learning Progress</Typography>
              <Slider
                value={profile.progress}
                onChange={(_, value) => setProfile(prev => prev ? { ...prev, progress: value as number } : null)}
                min={0}
                max={100}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowProfileDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={() => {
              if (profile) {
                handleProfileUpdate(profile);
                setShowProfileDialog(false);
            } sx={theming.getThemedButtonSx()}
          }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AILearningAssistant;

