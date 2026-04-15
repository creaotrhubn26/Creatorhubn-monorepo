// @ts-nocheck
/**
 * CreatorHub Verified Badge System - Gamifisert belonningssystem
 * Brukere tjener poeng og badges gjennom a lage kvalitets-tutorials
 */

import React, { useMemo, useState } from 'react';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  Psychology as ExpertIcon,
  Security as QualityIcon,
  Star as StarIcon,
  TrendingUp as TrendingIcon,
  Verified as VerifiedIcon,
  VideoLibrary as VideoIcon,
  PhotoLibrary as PhotoIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

interface BadgeLevel {
  id: string;
  name: string;
  description: string;
  requiredPoints: number;
  color: string;
  icon: React.ReactNode;
  benefits: string[];
  nextLevel?: string;
}

interface UserProgress {
  currentPoints: number;
  currentLevel: string;
  totalTutorials: number;
  videoTutorials: number;
  screenshotTutorials: number;
  totalViews: number;
  totalLikes: number;
  averageRating: number;
  faqPublished: number;
  streakDays: number;
  lastActivity: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  points: number;
  unlocked: boolean;
}

interface CreatorHubBadgeSystemProps {
  open?: boolean;
  onClose?: () => void;
  userProgress?: UserProgress;
  onPointsEarned?: (points: number, reason: string) => void;
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: unknown) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: unknown) => void;
  selectedProject?: unknown;
  onProjectSelect?: (project: unknown) => void;
}

const BADGE_LEVELS: BadgeLevel[] = [
  {
    id: 'newcomer',
    name: 'Newcomer',
    description: 'Velkommen til CreatorHub community',
    requiredPoints: 0,
    color: '#9E9E9E',
    icon: <VerifiedIcon fontSize="small" />,
    benefits: ['Tilgang til tutorial creator', 'Community support'],
    nextLevel: 'bronze',
  },
  {
    id: 'bronze',
    name: 'Bronze Verified',
    description: 'Din forste verified-status',
    requiredPoints: 10,
    color: '#CD7F32',
    icon: <VerifiedIcon fontSize="small" />,
    benefits: ['Bronze badge', 'Prioritert support', 'Tutorial featured mulighet'],
    nextLevel: 'silver',
  },
  {
    id: 'silver',
    name: 'Silver Verified',
    description: 'Etablert community bidragsyter',
    requiredPoints: 30,
    color: '#C0C0C0',
    icon: <StarIcon fontSize="small" />,
    benefits: ['Silver badge', 'FAQ curator rolle', 'Beta features access'],
    nextLevel: 'gold',
  },
  {
    id: 'gold',
    name: 'Gold Verified',
    description: 'Elite content creator',
    requiredPoints: 70,
    color: '#FFD700',
    icon: <TrophyIcon fontSize="small" />,
    benefits: ['Gold badge', 'Direct FAQ publish', 'Revenue sharing'],
    nextLevel: 'platinum',
  },
  {
    id: 'platinum',
    name: 'Platinum Expert',
    description: 'CreatorHub champion og ekspert',
    requiredPoints: 150,
    color: '#E5E4E2',
    icon: <ExpertIcon fontSize="small" />,
    benefits: ['Platinum badge', 'Community moderator', 'Ekspertkonsultasjoner', 'Platform partnership'],
  },
];

const DEFAULT_PROGRESS: UserProgress = {
  currentPoints: 0,
  currentLevel: 'newcomer',
  totalTutorials: 0,
  videoTutorials: 0,
  screenshotTutorials: 0,
  totalViews: 0,
  totalLikes: 0,
  averageRating: 0,
  faqPublished: 0,
  streakDays: 0,
  lastActivity: new Date(0).toISOString(),
};

const getCurrentLevel = (progress: UserProgress): BadgeLevel => {
  for (let i = BADGE_LEVELS.length - 1; i >= 0; i -= 1) {
    if (progress.currentPoints >= BADGE_LEVELS[i].requiredPoints) {
      return BADGE_LEVELS[i];
    }
  }
  return BADGE_LEVELS[0];
};

const getNextLevel = (level: BadgeLevel): BadgeLevel | null => {
  if (!level.nextLevel) return null;
  return BADGE_LEVELS.find((entry) => entry.id === level.nextLevel) ?? null;
};

export const CreatorHubBadgeSystem: React.FC<CreatorHubBadgeSystemProps> = ({
  open = false,
  onClose,
  userProgress = DEFAULT_PROGRESS,
}) => {
  const theming = useTheming('photographer');
  const [showAchievements, setShowAchievements] = useState(false);

  const currentLevel = useMemo(() => getCurrentLevel(userProgress), [userProgress]);
  const nextLevel = useMemo(() => getNextLevel(currentLevel), [currentLevel]);

  const progressToNext = useMemo(() => {
    if (!nextLevel) return 100;
    const span = nextLevel.requiredPoints - currentLevel.requiredPoints;
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, ((userProgress.currentPoints - currentLevel.requiredPoints) / span) * 100));
  }, [currentLevel, nextLevel, userProgress.currentPoints]);

  const pointsToNext = nextLevel ? Math.max(0, nextLevel.requiredPoints - userProgress.currentPoints) : 0;

  const achievements: Achievement[] = useMemo(
    () => [
      {
        id: 'first_tutorial',
        title: 'First Steps',
        description: 'Lag din forste tutorial',
        icon: <VideoIcon color="primary" fontSize="small" />,
        points: 25,
        unlocked: userProgress.totalTutorials > 0,
      },
      {
        id: 'video_master',
        title: 'Video Master',
        description: 'Lag 5 video-tutorials',
        icon: <VideoIcon color="primary" fontSize="small" />,
        points: 75,
        unlocked: userProgress.videoTutorials >= 5,
      },
      {
        id: 'popular_creator',
        title: 'Popular Creator',
        description: 'Fa 1000+ visninger totalt',
        icon: <ViewIcon color="info" fontSize="small" />,
        points: 50,
        unlocked: userProgress.totalViews >= 1000,
      },
      {
        id: 'quality_guru',
        title: 'Quality Guru',
        description: 'Oppna 4.5+ gjennomsnittlig rating',
        icon: <QualityIcon color="success" fontSize="small" />,
        points: 10,
        unlocked: userProgress.averageRating >= 4.5,
      },
      {
        id: 'faq_contributor',
        title: 'FAQ Contributor',
        description: 'Fa 3+ tutorials publisert i FAQ',
        icon: <TrophyIcon color="warning" fontSize="small" />,
        points: 15,
        unlocked: userProgress.faqPublished >= 3,
      },
      {
        id: 'streak_champion',
        title: 'Streak Champion',
        description: '7 dager pa rad med aktivitet',
        icon: <TrendingIcon color="error" fontSize="small" />,
        points: 75,
        unlocked: userProgress.streakDays >= 7,
      },
    ],
    [userProgress],
  );

  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);
  const totalAchievementPoints = unlockedAchievements.reduce((sum, achievement) => sum + achievement.points, 0);

  const pointBreakdown = {
    videoTutorials: userProgress.videoTutorials * 25,
    screenshotTutorials: userProgress.screenshotTutorials * 10,
    faqPublished: userProgress.faqPublished * 50,
    qualityBonus: Math.floor(userProgress.averageRating * 20),
    popularityBonus: Math.floor(userProgress.totalViews / 100),
    likesBonus: userProgress.totalLikes * 2,
    achievements: totalAchievementPoints,
    streakBonus: userProgress.streakDays * 5,
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                bgcolor: currentLevel.color,
                width: 56,
                height: 56,
                border: '3px solid #fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {currentLevel.icon}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ color: currentLevel.color, fontWeight: 'bold' }}>
                CreatorHub {currentLevel.name}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {userProgress.currentPoints} poeng • {currentLevel.description}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Card
            sx={{
              mb: 3,
              background: 'linear-gradient(135deg, rgba(255,193,7,0.1), rgba(255,152,0,0.1))',
              ...theming.getThemedCardSx(),
            }}
          >
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Progress til {nextLevel ? nextLevel.name : 'Maksniva'}
              </Typography>

              {nextLevel ? (
                <>
                  <LinearProgress
                    variant="determinate"
                    value={progressToNext}
                    sx={{
                      height: 12,
                      borderRadius: 6,
                      bgcolor: 'rgba(0,0,0,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel.color})`,
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="body2">{Math.round(progressToNext)}% fullfort</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {pointsToNext} poeng igjen
                    </Typography>
                  </Box>
                  {progressToNext >= 70 ? (
                    <Alert severity="info" sx={{ mt: 2, bgcolor: 'rgba(5,118,210,0.1)' }}>
                      Nesten der. Du er {Math.round(progressToNext)}% av veien til {nextLevel.name}.
                    </Alert>
                  ) : (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(6,175,80,0.1)', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Fortsett a dele kunnskap. Hver veiledning gir poeng og hjelper andre.
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Alert severity="success">Gratulerer! Du har nadd maksimalt niva.</Alert>
              )}
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                  <VideoIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                    {userProgress.totalTutorials}
                  </Typography>
                  <Typography variant="caption">Totale tutorials</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                  <ViewIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                    {userProgress.totalViews.toLocaleString()}
                  </Typography>
                  <Typography variant="caption">Visninger</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                  <StarIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                    {userProgress.averageRating.toFixed(1)}
                  </Typography>
                  <Typography variant="caption">Snitt rating</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', py: 2, ...theming.getThemedCardSx() }}>
                  <TrophyIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                    {userProgress.faqPublished}
                  </Typography>
                  <Typography variant="caption">FAQ publisert</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Poengoversikt
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <VideoIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Video tutorials (${userProgress.videoTutorials})`}
                        secondary={`${pointBreakdown.videoTutorials} poeng`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <PhotoIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Screenshots (${userProgress.screenshotTutorials})`}
                        secondary={`${pointBreakdown.screenshotTutorials} poeng`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TrophyIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`FAQ (${userProgress.faqPublished})`}
                        secondary={`${pointBreakdown.faqPublished} poeng`}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <QualityIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary="Kvalitet" secondary={`${pointBreakdown.qualityBonus} poeng`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ViewIcon color="info" />
                      </ListItemIcon>
                      <ListItemText primary="Popularitet" secondary={`${pointBreakdown.popularityBonus} poeng`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TrendingIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Streak (${userProgress.streakDays} dager)`}
                        secondary={`${pointBreakdown.streakBonus} poeng`}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Badge-nivaer
              </Typography>
              <Stepper orientation="vertical">
                {BADGE_LEVELS.map((level) => {
                  const isCompleted = userProgress.currentPoints >= level.requiredPoints;
                  const isCurrent = level.id === currentLevel.id;

                  return (
                    <Step key={level.id} completed={isCompleted} active={isCurrent}>
                      <StepLabel
                        StepIconComponent={() => (
                          <Avatar
                            sx={{
                              bgcolor: level.color,
                              color: 'white',
                              width: 32,
                              height: 32,
                              opacity: isCompleted ? 1 : 0.5,
                            }}
                          >
                            {level.icon}
                          </Avatar>
                        )}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {level.name} ({level.requiredPoints} poeng)
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {level.description}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            {level.benefits.map((benefit) => (
                              <Chip
                                key={benefit}
                                label={benefit}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5 }}
                                color={isCompleted ? 'success' : 'default'}
                                variant={isCompleted ? 'filled' : 'outlined'}
                              />
                            ))}
                          </Box>
                        </Box>
                      </StepLabel>
                    </Step>
                  );
                })}
              </Stepper>
            </CardContent>
          </Card>

          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Achievements ({unlockedAchievements.length}/{achievements.length})
                </Typography>
                <Button variant="outlined" size="small" onClick={() => setShowAchievements(true)}>
                  Se alle
                </Button>
              </Box>

              <Grid container spacing={1}>
                {achievements.slice(0, 6).map((achievement) => (
                  <Grid size={{ xs: 6, md: 4 }} key={achievement.id}>
                    <Tooltip title={achievement.description}>
                      <Card
                        sx={{
                          opacity: achievement.unlocked ? 1 : 0.5,
                          border: achievement.unlocked ? '2px solid gold' : '1px solid #ccc',
                          ...theming.getThemedCardSx(),
                        }}
                      >
                        <CardContent sx={{ textAlign: 'center', py: 1, ...theming.getThemedCardSx() }}>
                          {achievement.icon}
                          <Typography variant="caption" display="block">
                            {achievement.title}
                          </Typography>
                          <Chip
                            label={`${achievement.points}p`}
                            size="small"
                            color={achievement.unlocked ? 'success' : 'default'}
                          />
                        </CardContent>
                      </Card>
                    </Tooltip>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      <Dialog open={showAchievements} onClose={() => setShowAchievements(false)} maxWidth="md" fullWidth>
        <DialogTitle>Alle achievements</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {achievements.map((achievement) => (
              <Grid size={{ xs: 12, md: 6 }} key={achievement.id}>
                <Card sx={{ opacity: achievement.unlocked ? 1 : 0.6, ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {achievement.icon}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {achievement.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {achievement.description}
                        </Typography>
                        <Chip
                          label={achievement.unlocked ? `Unlocked! +${achievement.points}p` : `${achievement.points} poeng`}
                          color={achievement.unlocked ? 'success' : 'default'}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatorHubBadgeSystem;
