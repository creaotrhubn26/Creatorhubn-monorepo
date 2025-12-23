import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  LinearProgress,
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
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
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
  maxProgress: number
}

interface AchievementRequirement {
  id: string;
  description: string;
  completed: boolean;
  value: number;
  maxValue: number
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
  rank: string
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: Date
}

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  points: number;
  level: number;
  achievements: number;
  rank: number
}

interface AchievementSystemProps {
  className?: string;
  onAchievementUnlocked?: (achievement: Achievement) => void;
  onLevelUp?: (newLevel: number) => void;
  onBadgeEarned?: (badge: Badge) => void
}

// Mock data


const mockUserProfile: UserProfile = {
  id: 'user',
  name: 'John Doe',
  avatar: '/avatars/john.jpg',
  level:  12,
  experience: 240,
  totalPoints: 120,
  achievements: mockAchievements,
  badges: [
    { id: '', name: 'Early Bird', description: 'First to use new features', icon: 'star', earned: true, earnedAt: new Date(),},
    { id: '', name: 'Team Player', description: 'Active collaborator', icon: 'group', earned: true, earnedAt: new Date(),},
    { id: '', name: 'Innovator', description: 'Created unique content', icon: 'autoFixHigh', earned: false }
  ],
  streak:  7,
  rank: ''
};



const AchievementSystem: React.FC<AchievementSystemProps> = ({
  className ='',
  onAchievementUnlocked,
  onLevelUp,
  onBadgeEarned
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(mockUserProfile);
  const [recentUnlocks, setRecentUnlocks] = useState<Achievement[]>([]);

  // Handlers
  const handleAchievementClick = useCallback((achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setShowAchievementDialog(true);
}, []);

  const handleAchievementUnlock = useCallback((achievement: Achievement) => {
    setUserProfile(prev => ({
      ...prev,
      achievements: prev.achievements.map(a => 
        a.id === achievement.id ? { .., .unlocked: true, unlockedAt: new Date(),} : a
      ),
      totalPoints: prev.totalPoints + achievement.points,
      experience: prev.experience + achievement.points
}));
    
    setRecentUnlocks(prev => [achievement, ...prev.slice(0, 4)]);
    onAchievementUnlocked?.(achievement);
}, [onAchievementUnlocked]);

  const getRarityColor = useCallback((rarity: string) => {
    switch (rarity) {
      case 'common': return 'default';
      case 'uncommon': return 'success';
      case 'rare': return 'info';
      case 'epic': return 'warning';
      case 'legendary': return 'error';
      default: return 'default';
}
}, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'content': return <CREATOR_HUB_ICONS.article />;
      case 'interaction': return <CREATOR_HUB_ICONS.smartToy />;
      case 'collaboration': return <CREATOR_HUB_ICONS.group />;
      case 'learning': return <CREATOR_HUB_ICONS.psychology />;
      case 'performance': return <CREATOR_HUB_ICONS.assessment />;
      default: return <CREATOR_HUB_ICONS.star />;
}
}, []);

  const getBadgeIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'star': return <CREATOR_HUB_ICONS.star />;
      case 'group': return <CREATOR_HUB_ICONS.group />;
      case 'autoFixHigh': return <CREATOR_HUB_ICONS.autoFixHigh />;
      default: return <CREATOR_HUB_ICONS.star />;
}
}, []);

  const getAchievementIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'playArrow': return <CREATOR_HUB_ICONS.playArrow />;
      case 'article': return <CREATOR_HUB_ICONS.article />;
      case 'group': return <CREATOR_HUB_ICONS.group />;
      case 'code': return <CREATOR_HUB_ICONS.code />;
      case 'star': return <CREATOR_HUB_ICONS.star />;
      default: return <CREATOR_HUB_ICONS.star />;
}
}, []);

  const getLevelProgress = useCallback(() => {
    const currentLevelExp = userProfile.experience % 1000;
    return (currentLevelExp / 1000) * 100;
}, [userProfile.experience]);

  const getNextLevelExp = useCallback(() => {
    return 1000 - (userProfile.experience % 1000);
}, [userProfile.experience]);

  // Memoized data
  const unlockedAchievements = useMemo(() => {
    return userProfile.achievements.filter(a => a.unlocked);
}, [userProfile.achievements]);

  const lockedAchievements = useMemo(() => {
    return userProfile.achievements.filter(a => !a.unlocked);
}, [userProfile.achievements]);

  const earnedBadges = useMemo(() => {
    return userProfile.badges.filter(b => b.earned);
}, [userProfile.badges]);

  const availableBadges = useMemo(() => {
    return userProfile.badges.filter(b => !b.earned);
}, [userProfile.badges]);

  // Auto-check for new achievements
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate achievement checking
      const newAchievements = userProfile.achievements.filter(a => 
        !a.unlocked && a.progress >= a.maxProgress
      );
      
      newAchievements.forEach(achievement => {
        handleAchievementUnlock(achievement);
    });
  }, 5000);

    return () => clearInterval(interval);
}, [userProfile.achievements, handleAchievementUnlock]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.star sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Achievement System</Typography>
              <Typography variant="body2" color="text.secondary">
                Track progress and unlock achievements
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label={`Level ${userProfile.level}`}
              color="primary" 
              icon={<CREATOR_HUB_ICONS.star />}
            />
            <Chip 
              label={`${userProfile.totalPoints} pts`}
              color="secondary" 
              icon={<CREATOR_HUB_ICONS.assessment />}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Recent Unlocks */}
      {recentUnlocks.length > 0 && (
        <Alert severity="success" sx={{ mb:  2 }}>
          <AlertTitle>Recent Unlocks!</AlertTitle>
          {recentUnlocks.map((achievement, index) => (
            <Typography key={achievement.id} variant="body2">
              🎉 {achievement.name} - {achievement.points} points
            </Typography>
          ))}
        </Alert>
      )}

      {/* User Profile Card */}
      <Grid container spacing={2} sx={{ mb:  2 }}>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ width:  48, height: 48}}>
                  {userProfile.name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{userProfile.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {userProfile.rank} • Level {userProfile.level}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my:  2 }} />
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">Experience</Typography>
                    <Typography variant="body2">{userProfile.experience} XP</Typography>
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={getLevelProgress()}
                    sx={{ mt: 1, height:  8, borderRadius:  4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {getNextLevelExp()} XP to next level
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{userProfile.streak}</Typography>
                    <Typography variant="caption">Day Streak</Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{unlockedAchievements.length}</Typography>
                    <Typography variant="caption">Achievements</Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{earnedBadges.length}</Typography>
                    <Typography variant="caption">Badges</Typography>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardHeader title="Recent Activity" sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <List dense>
                {recentUnlocks.slice(0, 3).map((achievement) => (
                  <ListItem key={achievement.id}>
                    <ListItemIcon>
                      {getAchievementIcon(achievement.icon)}
                    </ListItemIcon>
                    <ListItemText
                      primary={achievement.name}
                      secondary={`+${achievement.points} points`}
                    />
                    <Chip 
                      label={achievement.rarity}
                      size="small" 
                      color={getRarityColor(achievement.rarity)}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Achievements" icon={<CREATOR_HUB_ICONS.star />} />
        <Tab label="Badges" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="Leaderboard" icon={<CREATOR_HUB_ICONS.trendingUp />} />
        <Tab label="Progress" icon={<CREATOR_HUB_ICONS.timeline />} />
      </Tabs>

      {/* Achievements Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {userProfile.achievements.map((achievement) => (
            <Grid item xs={12} sm={6} md={4} key={achievement.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  opacity: achievement.unlocked ? 1 : 0.7 }}
                onClick={() => handleAchievementClick(achievement)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ position: 'relative'}}>
                      {getAchievementIcon(achievement.icon)}
                      {achievement.unlocked && (
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                          badgeContent={<CREATOR_HUB_ICONS.checkCircle color="success" />}
                        />
                      )}
                    </Box>
                    <Box sx={{ flex:  1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="subtitle1" gutterBottom>
                          {achievement.name}
                        </Typography>
                        <Chip 
                          label={achievement.rarity}
                          size="small" 
                          color={getRarityColor(achievement.rarity)}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {achievement.description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="primary">
                          {achievement.points} points
                        </Typography>
                        <Typography variant="caption">
                          {achievement.progress}/{achievement.maxProgress}
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={(achievement.progress / achievement.maxProgress) * 100}
                        sx={{ mt: 1, height:  4, borderRadius:  2 }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Badges Tab */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          {userProfile.badges.map((badge) => (
            <Grid item xs={12} sm={6} md={4} key={badge.id}>
              <Card sx={{ opacity: badge.earned ? 1 : 0.6,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative'}}>
                      {getBadgeIcon(badge.icon)}
                      {badge.earned && (
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                          badgeContent={<CREATOR_HUB_ICONS.checkCircle color="success" />}
                        />
                      )}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        {badge.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {badge.description}
                      </Typography>
                      {badge.earned && badge.earnedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Earned {badge.earnedAt.toLocaleDateString()}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 2 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Global Leaderboard
          </Typography>
          <List>
            {mockLeaderboard.map((entry) => (
              <ListItem key={entry.id}>
                <ListItemIcon>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    #{entry.rank}
                  </Typography>
                </ListItemIcon>
                <ListItemIcon>
                  <Avatar sx={{ width:  32, height: 32}}>
                    {entry.name.charAt(0)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={entry.name}
                  secondary={`Level ${entry.level} • ${entry.achievements} achievements`}
                />
                <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                  {entry.points}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Progress Tab */}
      {activeTab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Category Progress
              </Typography>
              <Stack spacing={2}>
                {['content','interaction','collaboration', 'learning','performance'].map((category) => {
                  const categoryAchievements = userProfile.achievements.filter(a => a.category === category);
                  const unlocked = categoryAchievements.filter(a => a.unlocked).length;
                  const total = categoryAchievements.length;
                  const progress = total > 0 ? (unlocked / total) * 100 : 0;
                  
                  return (
                    <Box key={category}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getCategoryIcon(category)}
                          <Typography variant="body2" sx={{ textTransform: 'capitalize'}}>
                            {category}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">
                          {unlocked}/{total}
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress}
                        sx={{ mt: 1, height:  6, borderRadius:  3 }}
                      />
                    </Box>
                  );
              })}
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Rarity Distribution
              </Typography>
              <Stack spacing={2}>
                {['common', 'uncommon','rare','epic','legendary'].map((rarity) => {
                  const rarityAchievements = userProfile.achievements.filter(a => a.rarity === rarity);
                  const unlocked = rarityAchievements.filter(a => a.unlocked).length;
                  const total = rarityAchievements.length;
                  const progress = total > 0 ? (unlocked / total) * 100 : 0;
                  
                  return (
                    <Box key={rarity}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip 
                            label={rarity}
                            size="small" 
                            color={getRarityColor(rarity)}
                          />
                        </Stack>
                        <Typography variant="body2">
                          {unlocked}/{total}
                        </Typography>
                      </Stack>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress}
                        color={getRarityColor(rarity)}
                        sx={{ mt: 1, height:  6, borderRadius:  3 }}
                      />
                    </Box>
                  );
              })}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Achievement Dialog */}
      <Dialog open={showAchievementDialog} onClose={() => setShowAchievementDialog(false)}>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {selectedAchievement && getAchievementIcon(selectedAchievement.icon)}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedAchievement?.name}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedAchievement && (
            <Stack spacing={2}>
              <Typography variant="body1">
                {selectedAchievement.description}
              </Typography>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Requirements: </Typography>
                {selectedAchievement.requirements.map((req) => (
                  <Box key={req.d} sx={{ mb:  1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">{req.description}</Typography>
                      <Typography variant="body2">
                        {req.value}/{req.maxValue}
                      </Typography>
                    </Stack>
                    <LinearProgress 
                      variant="determinate" 
                      value={(req.value / req.maxValue) * 100}
                      sx={{ mt: 0, .height:  4, borderRadius:  2 }}
                    />
                  </Box>
                ))}
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip 
                  label={selectedAchievement.rarity}
                  color={getRarityColor(selectedAchievement.rarity)}
                />
                <Typography variant="body2" color="primary">
                  {selectedAchievement.points} points
                </Typography>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAchievementDialog(false)}>
            Close
          </Button>
          {selectedAchievement && !selectedAchievement.unlocked && (
            <Button variant="contained" 
              onClick={() => {
                handleAchievementUnlock(selectedAchievement);
                setShowAchievementDialog(false);
            } sx={theming.getThemedButtonSx()}}
            >
              Unlock
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AchievementSystem;

