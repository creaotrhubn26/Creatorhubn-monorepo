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
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  EmojiEvents,
  Grade,
  Psychology,
  Star,
  TrendingUp,
  WorkspacePremium,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface AchievementRequirement {
  id: string;
  description: string;
  completed: boolean;
  value: number;
  maxValue: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'content' | 'interaction' | 'collaboration' | 'learning' | 'performance';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  requirements: AchievementRequirement[];
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: Date;
}

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  level: number;
  experience: number;
  totalPoints: number;
  achievements: Achievement[];
  badges: Badge[];
  streak: number;
  rank: string;
}

interface AchievementSystemProps {
  className?: string;
  onAchievementUnlocked?: (achievement: Achievement) => void;
  onLevelUp?: (newLevel: number) => void;
  onBadgeEarned?: (badge: Badge) => void;
}

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1',
    name: 'First Project',
    description: 'Create your first project.',
    icon: 'star',
    category: 'content',
    rarity: 'common',
    points: 100,
    requirements: [
      {
        id: 'r1',
        description: 'Create 1 project',
        completed: false,
        value: 0,
        maxValue: 1,
      },
    ],
    unlocked: false,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'a2',
    name: 'Collaboration Pro',
    description: 'Invite 5 collaborators.',
    icon: 'group',
    category: 'collaboration',
    rarity: 'uncommon',
    points: 350,
    requirements: [
      {
        id: 'r2',
        description: 'Invite 5 teammates',
        completed: false,
        value: 0,
        maxValue: 5,
      },
    ],
    unlocked: false,
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'a3',
    name: 'Workflow Master',
    description: 'Finish 20 timeline edits.',
    icon: 'timeline',
    category: 'performance',
    rarity: 'rare',
    points: 700,
    requirements: [
      {
        id: 'r3',
        description: 'Complete 20 edits',
        completed: false,
        value: 0,
        maxValue: 20,
      },
    ],
    unlocked: false,
    progress: 0,
    maxProgress: 20,
  },
];

const INITIAL_BADGES: Badge[] = [
  {
    id: 'b1',
    name: 'Early Bird',
    description: 'Active in your first week',
    icon: 'star',
    earned: true,
    earnedAt: new Date('2026-02-24T09:00:00Z'),
  },
  {
    id: 'b2',
    name: 'Focused Creator',
    description: 'Maintain a 7-day streak',
    icon: 'workspace_premium',
    earned: false,
  },
  {
    id: 'b3',
    name: 'Knowledge Seeker',
    description: 'Complete 10 learning modules',
    icon: 'psychology',
    earned: false,
  },
];

function iconForBadge(iconName: string): React.ReactNode {
  switch (iconName) {
    case 'workspace_premium':
      return <WorkspacePremium color="warning" />;
    case 'psychology':
      return <Psychology color="secondary" />;
    case 'star':
    default:
      return <Star color="primary" />;
  }
}

function rarityColor(rarity: Achievement['rarity']): 'default' | 'success' | 'info' | 'warning' | 'error' {
  switch (rarity) {
    case 'uncommon':
      return 'success';
    case 'rare':
      return 'info';
    case 'epic':
      return 'warning';
    case 'legendary':
      return 'error';
    case 'common':
    default:
      return 'default';
  }
}

export default function AchievementSystem({
  className,
  onAchievementUnlocked,
  onLevelUp,
  onBadgeEarned,
}: AchievementSystemProps): React.ReactElement {
  const theming = useTheming('photographer');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedAchievementId, setSelectedAchievementId] = useState<string | null>(null);
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: 'user-1',
    name: 'John Doe',
    avatar: '/avatars/john.jpg',
    level: 12,
    experience: 2400,
    totalPoints: 1200,
    achievements: INITIAL_ACHIEVEMENTS,
    badges: INITIAL_BADGES,
    streak: 7,
    rank: 'Silver',
  });

  const selectedAchievement = useMemo(
    () => userProfile.achievements.find((achievement) => achievement.id === selectedAchievementId) ?? null,
    [selectedAchievementId, userProfile.achievements],
  );

  const unlockedAchievements = useMemo(
    () => userProfile.achievements.filter((achievement) => achievement.unlocked),
    [userProfile.achievements],
  );

  const lockedAchievements = useMemo(
    () => userProfile.achievements.filter((achievement) => !achievement.unlocked),
    [userProfile.achievements],
  );

  const earnedBadges = useMemo(
    () => userProfile.badges.filter((badge) => badge.earned),
    [userProfile.badges],
  );

  const levelProgress = useMemo(() => {
    const currentLevelExp = userProfile.experience % 1000;
    return (currentLevelExp / 1000) * 100;
  }, [userProfile.experience]);

  const progressAchievement = (achievementId: string, amount: number): void => {
    setUserProfile((previous) => {
      let leveledUp = false;
      let unlockedAchievement: Achievement | null = null;
      let earnedBadge: Badge | null = null;

      const updatedAchievements = previous.achievements.map((achievement) => {
        if (achievement.id !== achievementId || achievement.unlocked) {
          return achievement;
        }

        const nextProgress = Math.min(achievement.maxProgress, achievement.progress + amount);
        const nowUnlocked = nextProgress >= achievement.maxProgress;
        const updated: Achievement = {
          ...achievement,
          progress: nextProgress,
          unlocked: nowUnlocked,
          unlockedAt: nowUnlocked ? new Date() : achievement.unlockedAt,
          requirements: achievement.requirements.map((requirement) => ({
            ...requirement,
            value: Math.min(requirement.maxValue, nextProgress),
            completed: nowUnlocked,
          })),
        };

        if (nowUnlocked) {
          unlockedAchievement = updated;
        }

        return updated;
      });

      let nextExperience = previous.experience;
      let nextPoints = previous.totalPoints;

      if (unlockedAchievement) {
        nextExperience += unlockedAchievement.points;
        nextPoints += unlockedAchievement.points;
      }

      const nextLevel = Math.floor(nextExperience / 1000) + 1;
      if (nextLevel > previous.level) {
        leveledUp = true;
      }

      const updatedBadges = previous.badges.map((badge) => {
        if (badge.earned) {
          return badge;
        }
        if (badge.id === 'b2' && previous.streak >= 7) {
          const unlockedBadge = { ...badge, earned: true, earnedAt: new Date() };
          earnedBadge = unlockedBadge;
          return unlockedBadge;
        }
        return badge;
      });

      if (unlockedAchievement) {
        onAchievementUnlocked?.(unlockedAchievement);
      }
      if (leveledUp) {
        onLevelUp?.(nextLevel);
      }
      if (earnedBadge) {
        onBadgeEarned?.(earnedBadge);
      }

      return {
        ...previous,
        achievements: updatedAchievements,
        badges: updatedBadges,
        experience: nextExperience,
        totalPoints: nextPoints,
        level: nextLevel,
      };
    });
  };

  const openAchievement = (achievementId: string): void => {
    setSelectedAchievementId(achievementId);
    setShowAchievementDialog(true);
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEvents color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Achievement System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track milestones, unlock badges, and level up your workspace profile.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={`Level ${userProfile.level}`} color="primary" />
            <Chip label={`${userProfile.totalPoints} pts`} variant="outlined" />
          </Stack>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Level Progress
          </Typography>
          <LinearProgress variant="determinate" value={levelProgress} sx={{ mt: 0.5 }} />
        </Box>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, value) => setActiveTab(value)}>
          <Tab label="Locked" />
          <Tab label="Unlocked" />
          <Tab label="Badges" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Grid container spacing={2}>
          {lockedAchievements.map((achievement) => (
            <Grid key={achievement.id} size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1">{achievement.name}</Typography>
                      <Chip size="small" color={rarityColor(achievement.rarity)} label={achievement.rarity} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {achievement.description}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(achievement.progress / achievement.maxProgress) * 100}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {achievement.progress}/{achievement.maxProgress}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openAchievement(achievement.id)}>
                        Details
                      </Button>
                      <Button size="small" variant="contained" onClick={() => progressAchievement(achievement.id, 1)}>
                        Add Progress
                      </Button>
                    </Stack>
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
            {unlockedAchievements.length === 0 ? (
              <Alert severity="info">No unlocked achievements yet.</Alert>
            ) : (
              <List>
                {unlockedAchievements.map((achievement) => (
                  <ListItem key={achievement.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Grade />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${achievement.name} (+${achievement.points})`}
                      secondary={`Unlocked ${achievement.unlockedAt?.toLocaleDateString() ?? 'now'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 2 ? (
        <Grid container spacing={2}>
          {userProfile.badges.map((badge) => (
            <Grid key={badge.id} size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1} alignItems="center">
                    {iconForBadge(badge.icon)}
                    <Typography variant="subtitle1">{badge.name}</Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      {badge.description}
                    </Typography>
                    <Chip
                      size="small"
                      color={badge.earned ? 'success' : 'default'}
                      label={badge.earned ? 'Earned' : 'Locked'}
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {earnedBadges.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">No badges earned yet.</Alert>
            </Grid>
          ) : null}
        </Grid>
      ) : null}

      <Dialog open={showAchievementDialog} onClose={() => setShowAchievementDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedAchievement?.name ?? 'Achievement'}</DialogTitle>
        <DialogContent>
          {selectedAchievement ? (
            <Stack spacing={1}>
              <Typography>{selectedAchievement.description}</Typography>
              <Typography variant="body2" color="text.secondary">
                Category: {selectedAchievement.category}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Points: {selectedAchievement.points}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Progress: {selectedAchievement.progress}/{selectedAchievement.maxProgress}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAchievementDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
