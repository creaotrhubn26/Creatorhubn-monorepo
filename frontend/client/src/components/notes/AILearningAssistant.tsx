/**
 * AI Learning Assistant - adaptive recommendations for learning workflows.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AutoAwesome,
  EmojiEvents,
  Psychology,
  School,
  Timeline,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

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
  achievements: Achievement[];
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlockedAt: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
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
  content: {
    moduleId: string;
    topic: string;
    url: string;
  };
  priority: 'low' | 'medium' | 'high';
}

interface AILearningAssistantProps {
  userId: string;
  onRecommendationClick: (recommendation: LearningRecommendation) => void;
  onUpdateProfile: (profile: LearningProfile) => void;
  className?: string;
}

const RECOMMENDATIONS: LearningRecommendation[] = [
  {
    id: 'rec-1',
    type: 'content',
    title: 'Type-safe Timeline Actions',
    description: 'Learn how to wire keyboard timeline actions with strict type safety.',
    difficulty: 'medium',
    estimatedTime: 25,
    relevance: 0.94,
    reason: 'Based on recent timeline commits and keyboard-map work.',
    content: {
      moduleId: 'mod-ts-timeline',
      topic: 'TypeScript + Timeline',
      url: '/academy/timeline-types',
    },
    priority: 'high',
  },
  {
    id: 'rec-2',
    type: 'exercise',
    title: 'Refactor Parsing Hotspots',
    description: 'Practice transforming malformed components into robust typed modules.',
    difficulty: 'hard',
    estimatedTime: 35,
    relevance: 0.89,
    reason: 'Detected recurring parser failures in notes and onboarding modules.',
    content: {
      moduleId: 'mod-refactor-hotspots',
      topic: 'Refactoring',
      url: '/academy/refactor-hotspots',
    },
    priority: 'high',
  },
  {
    id: 'rec-3',
    type: 'project',
    title: 'Build an Editor Hard-pass Suite',
    description: 'Create deterministic end-to-end tests for insert/overwrite and captions.',
    difficulty: 'medium',
    estimatedTime: 45,
    relevance: 0.83,
    reason: 'Aligned with active Story Arc regression goals.',
    content: {
      moduleId: 'mod-editor-hardpass',
      topic: 'E2E Testing',
      url: '/academy/editor-hardpass',
    },
    priority: 'medium',
  },
];

function difficultyColor(value: LearningRecommendation['difficulty']): 'success' | 'warning' | 'error' {
  if (value === 'easy') {
    return 'success';
  }
  if (value === 'medium') {
    return 'warning';
  }
  return 'error';
}

export const AILearningAssistant: React.FC<AILearningAssistantProps> = ({
  userId,
  onRecommendationClick,
  onUpdateProfile,
  className,
}) => {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState(0);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const [profile, setProfile] = useState<LearningProfile>({
    id: userId,
    name: 'Alex Johnson',
    level: 'intermediate',
    interests: ['React', 'TypeScript', 'UI/UX', 'AI/ML'],
    learningStyle: 'visual',
    strengths: ['Problem Solving', 'Code Organization', 'Team Collaboration'],
    weaknesses: ['Performance Tuning', 'Security Reviews'],
    progress: 68,
    lastActive: new Date(),
    totalTime: 120,
    completedModules: ['react-basics', 'typescript-fundamentals', 'ui-design'],
    currentStreak: 7,
    achievements: [
      {
        id: 'ach-1',
        title: 'First Steps',
        description: 'Completed your first module',
        icon: <School fontSize="small" />,
        unlockedAt: new Date('2026-02-12T10:00:00Z'),
        rarity: 'common',
      },
      {
        id: 'ach-2',
        title: 'Week Warrior',
        description: 'Maintained a seven-day streak',
        icon: <Timeline fontSize="small" />,
        unlockedAt: new Date('2026-02-18T10:00:00Z'),
        rarity: 'rare',
      },
    ],
  });

  const profileScore = useMemo(() => Math.round(profile.progress), [profile.progress]);

  const applyRecommendation = (recommendation: LearningRecommendation): void => {
    onRecommendationClick(recommendation);
    const updated = {
      ...profile,
      totalTime: profile.totalTime + recommendation.estimatedTime,
      progress: Math.min(100, profile.progress + recommendation.relevance * 5),
      lastActive: new Date(),
    };
    setProfile(updated);
    onUpdateProfile(updated);
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Psychology color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                AI Learning Assistant
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Personalized learning recommendations based on your workflow.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`Streak: ${profile.currentStreak}d`} size="small" />
            <Chip label={`Progress ${profileScore}%`} color="primary" size="small" />
            <Button size="small" variant="outlined" onClick={() => setShowProfileDialog(true)}>
              Profile
            </Button>
          </Stack>
        </Stack>

        <LinearProgress variant="determinate" value={profileScore} sx={{ mt: 1.5 }} />
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)}>
          <Tab icon={<AutoAwesome />} iconPosition="start" label="Recommendations" />
          <Tab icon={<EmojiEvents />} iconPosition="start" label="Achievements" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Grid container spacing={2}>
          {RECOMMENDATIONS.map((recommendation) => (
            <Grid key={recommendation.id} size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1">{recommendation.title}</Typography>
                      <Chip
                        size="small"
                        label={recommendation.difficulty}
                        color={difficultyColor(recommendation.difficulty)}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {recommendation.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {recommendation.estimatedTime} min • relevance {(recommendation.relevance * 100).toFixed(0)}%
                    </Typography>
                    <Alert severity={recommendation.priority === 'high' ? 'warning' : 'info'}>
                      {recommendation.reason}
                    </Alert>
                    <Button
                      variant="contained"
                      onClick={() => applyRecommendation(recommendation)}
                      sx={theming.getThemedButtonSx()}
                    >
                      Open Recommendation
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}

      {activeTab === 1 ? (
        <Card>
          <CardContent>
            {profile.achievements.length === 0 ? (
              <Alert severity="info">No achievements yet.</Alert>
            ) : (
              <List>
                {profile.achievements.map((achievement) => (
                  <ListItem key={achievement.id}>
                    <ListItemAvatar>
                      <Avatar>{achievement.icon}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={achievement.title}
                      secondary={`${achievement.description} • ${achievement.unlockedAt.toLocaleDateString()}`}
                    />
                    <Chip size="small" label={achievement.rarity} />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Learning Profile</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2">Name: {profile.name}</Typography>
            <Typography variant="body2">Level: {profile.level}</Typography>
            <Typography variant="body2">Learning style: {profile.learningStyle}</Typography>
            <Typography variant="body2">Interests: {profile.interests.join(', ')}</Typography>
            <Typography variant="body2">Strengths: {profile.strengths.join(', ')}</Typography>
            <Typography variant="body2">Areas to improve: {profile.weaknesses.join(', ')}</Typography>
            <Typography variant="body2">Completed modules: {profile.completedModules.length}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProfileDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AILearningAssistant;
