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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'points' | 'badge' | 'achievement' | 'unlock' | 'discount';
  value: number;
  cost: number;
  category: 'content' | 'interaction' | 'collaboration' | 'learning' | 'performance';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
  requirements: RewardRequirement[]
}

interface RewardRequirement {
  id: string;
  description: string;
  completed: boolean;
  value: number;
  maxValue: number
}

interface RewardShop {
  id: string;
  name: string;
  description: string;
  items: Reward[];
  category: string;
  available: boolean
}

interface UserReward {
  id: string;
  rewardId: string;
  userId: string;
  earnedAt: Date;
  used: boolean;
  usedAt?: Date;
  expiresAt?: Date
}

interface RewardSystemProps {
  className?: string;
  onRewardEarned?: (reward: Reward) => void;
  onRewardUsed?: (reward: Reward) => void;
  onShopPurchase?: (reward: Reward) => void
}

// Mock data






const RewardSystem: React.FC<RewardSystemProps> = ({
  className ='',
  onRewardEarned,
  onRewardUsed,
  onShopPurchase
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [showShopDialog, setShowShopDialog] = useState(false);
  const [userPoints, setUserPoints] = useState(150);
  const [rewards, setRewards] = useState<Reward[]>(mockRewards);
  const [userRewards, setUserRewards] = useState<UserReward[]>(mockUserRewards);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  // Handlers
  const handleRewardClick = useCallback((reward: Reward) => {
    setSelectedReward(reward);
    setShowRewardDialog(true);
}, []);

  const handleRewardUse = useCallback((reward: Reward) => {
    setUserRewards(prev => prev.map(ur => 
      ur.rewardId === reward.id 
        ? { ..., urused: true, usedAt: new Date(),}
        : ur
    ));
    onRewardUsed?.(reward);
}, [onRewardUsed]);

  const handleShopPurchase = useCallback((reward: Reward) => {
    if (userPoints >= reward.cost) {
      setUserPoints(prev => prev - reward.cost);
      setRewards(prev => prev.map(r => 
        r.id === reward.id ? { .., .unlocked: true, unlockedAt: new Date(),} : r
      ));
      setUserRewards(prev => [...prev, {
        id: Date.now().toString(),
        rewardId: reward.d,
        userId: 'user',
        earnedAt: new Date(),
        used: false
  }]);
      onShopPurchase?.(reward);
  }
}, [userPoints, onShopPurchase]);

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

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'points': return <CREATOR_HUB_ICONS.assessment />;
      case 'badge': return <CREATOR_HUB_ICONS.star />;
      case 'achievement': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'unlock': return <CREATOR_HUB_ICONS.lock />;
      case 'discount': return <CREATOR_HUB_ICONS.percent />;
      default: return <CREATOR_HUB_ICONS.star />;
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

  const getRewardIcon = useCallback((iconName: string) => {
    switch (iconName) {
      case 'article': return <CREATOR_HUB_ICONS.article />;
      case 'group': return <CREATOR_HUB_ICONS.group />;
      case 'palette': return <CREATOR_HUB_ICONS.palette />;
      case 'assessment': return <CREATOR_HUB_ICONS.assessment />;
      case 'star': return <CREATOR_HUB_ICONS.star />;
      case 'code': return <CREATOR_HUB_ICONS.code />;
      case 'timeline': return <CREATOR_HUB_ICONS.timeline />;
      default: return <CREATOR_HUB_ICONS.star />;
}
}, []);

  const canAfford = useCallback((reward: Reward) => {
    return userPoints >= reward.cost;
}, [userPoints]);

  const isUnlocked = useCallback((reward: Reward) => {
    return reward.unlocked || userRewards.some(ur => ur.rewardId === reward.id && !ur.used);
}, [userRewards]);

  // Memoized data
  const filteredRewards = useMemo(() => {
    let filtered = rewards;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(r => r.category === selectedCategory);
  }
    
    if (showUnlockedOnly) {
      filtered = filtered.filter(r => isUnlocked(r));
  }
    
    return filtered;
}, [rewards, selectedCategory, showUnlockedOnly, isUnlocked]);

  const unlockedRewards = useMemo(() => {
    return rewards.filter(r => isUnlocked(r));
}, [rewards, isUnlocked]);

  const availableRewards = useMemo(() => {
    return rewards.filter(r => !isUnlocked(r) && canAfford(r));
}, [rewards, isUnlocked, canAfford]);

  const usedRewards = useMemo(() => {
    return userRewards.filter(ur => ur.used);
}, [userRewards]);

  const activeRewards = useMemo(() => {
    return userRewards.filter(ur => !ur.used);
}, [userRewards]);

  // Auto-check for new rewards
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate reward checking
      const newRewards = rewards.filter(r => 
        !r.unlocked && r.requirements.every(req => req.completed)
      );
      
      newRewards.forEach(reward => {
        setRewards(prev => prev.map(r => 
          r.id === reward.id ? { ...r, unlocked: true, unlockedAt: new Date(),} : r
        ));
        onRewardEarned?.(reward);
    });
  }, 10000);

    return () => clearInterval(interval);
}, [rewards, onRewardEarned]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.star sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Reward System</Typography>
              <Typography variant="body2" color="text.secondary">
                Earn and use rewards for your achievements
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip 
              label={`${userPoints} points`}
              color="primary" 
              icon={<CREATOR_HUB_ICONS.assessment />}
            />
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.store />}
              onClick={() => setShowShopDialog(true)}
            >
              Shop
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150}}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="content">Content</MenuItem>
              <MenuItem value="interaction">Interaction</MenuItem>
              <MenuItem value="collaboration">Collaboration</MenuItem>
              <MenuItem value="learning">Learning</MenuItem>
              <MenuItem value="performance">Performance</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={showUnlockedOnly}
                onChange={(e) => setShowUnlockedOnly(e.target.checked)}
              />
          }
            label="Show unlocked only"
          />
        </Stack>
      </Paper>

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb:  2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.star color="primary" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{unlockedRewards.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unlocked Rewards
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
                <CREATOR_HUB_ICONS.assessment color="success" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{availableRewards.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Available Rewards
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
                <CREATOR_HUB_ICONS.checkCircle color="info" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{activeRewards.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Rewards
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
                <CREATOR_HUB_ICONS.timeline color="warning" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{usedRewards.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Used Rewards
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="All Rewards" icon={<CREATOR_HUB_ICONS.star />} />
        <Tab label="Unlocked" icon={<CREATOR_HUB_ICONS.checkCircle />} />
        <Tab label="Available" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="My Rewards" icon={<CREATOR_HUB_ICONS.group />} />
      </Tabs>

      {/* All Rewards Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {filteredRewards.map((reward) => (
            <Grid item xs={12} sm={6} md={4} key={reward.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  opacity: isUnlocked(reward) ? 1 : 0.8 }}
                onClick={() => handleRewardClick(reward)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Box sx={{ position: 'relative'}}>
                      {getRewardIcon(reward.icon)}
                      {isUnlocked(reward) && (
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                          badgeContent={<CREATOR_HUB_ICONS.checkCircle color="success" />}
                        />
                      )}
                    </Box>
                    <Box sx={{ flex:  1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb:  1 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          {reward.name}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip 
                            label={reward.rarity}
                            size="small" 
                            color={getRarityColor(reward.rarity)}
                          />
                          {reward.cost > 0 && (
                            <Chip 
                              label={`${reward.cost} pts`}
                              size="small" 
                              color={canAfford(reward) ? 'primary' : 'error'}
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {reward.description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getTypeIcon(reward.type)}
                          <Typography variant="body2" sx={{ textTransform: 'capitalize'}}>
                            {reward.type}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {getCategoryIcon(reward.category)}
                          <Typography variant="caption" sx={{ textTransform: 'capitalize'}}>
                            {reward.category}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Unlocked Tab */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          {unlockedRewards.map((reward) => (
            <Grid item xs={12} sm={6} md={4} key={reward.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <CREATOR_HUB_ICONS.checkCircle color="success" />
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {reward.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {reward.description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={reward.rarity}
                          size="small" 
                          color={getRarityColor(reward.rarity)}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Unlocked {reward.unlockedAt?.toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Available Tab */}
      {activeTab === 2 && (
        <Grid container spacing={2}>
          {availableRewards.map((reward) => (
            <Grid item xs={12} sm={6} md={4} key={reward.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getRewardIcon(reward.icon)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {reward.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {reward.description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={`${reward.cost} pts`}
                          size="small" 
                          color="primary"
                        />
                        <Button size="small"
                          variant="contained"
                          onClick={() => handleShopPurchase(reward)} sx={theming.getThemedButtonSx()}
                          disabled={!canAfford(reward)}
                        >
                          Purchase
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* My Rewards Tab */}
      {activeTab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Active Rewards
              </Typography>
              <List>
                {activeRewards.map((userReward) => {
                  const reward = rewards.find(r => r.id === userReward.rewardId);
                  if (!reward) return null;
                  
                  return (
                    <ListItem key={userReward.id}>
                      <ListItemIcon>
                        {getRewardIcon(reward.icon)}
                      </ListItemIcon>
                      <ListItemText
                        primary={reward.name}
                        secondary={`Earned ${userReward.earnedAt.toLocaleDateString()}`}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleRewardUse(reward)}
                      >
                        Use
                      </Button>
                    </ListItem>
                  );
              })}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Used Rewards
              </Typography>
              <List>
                {usedRewards.map((userReward) => {
                  const reward = rewards.find(r => r.id === userReward.rewardId);
                  if (!reward) return null;
                  
                  return (
                    <ListItem key={userReward.id}>
                      <ListItemIcon>
                        <CREATOR_HUB_ICONS.checkCircle color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={reward.name}
                        secondary={`Used ${userReward.usedAt?.toLocaleDateString()}`}
                      />
                    </ListItem>
                  );
              })}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Reward Dialog */}
      <Dialog open={showRewardDialog} onClose={() => setShowRewardDialog(false)}>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {selectedReward && getRewardIcon(selectedReward.icon)}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedReward?.name}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedReward && (
            <Stack spacing={2}>
              <Typography variant="body1">
                {selectedReward.description}
              </Typography>
              
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip 
                  label={selectedReward.rarity}
                  color={getRarityColor(selectedReward.rarity)}
                />
                <Chip 
                  label={selectedReward.type}
                  color="primary"
                />
                <Chip 
                  label={selectedReward.category}
                  color="secondary"
                />
              </Stack>

              {selectedReward.cost > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Cost: {selectedReward.cost} points
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    You have {userPoints} points available
                  </Typography>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Requirements: </Typography>
                {selectedReward.requirements.map((req) => (
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
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRewardDialog(false)}>
            Close
          </Button>
          {selectedReward && selectedReward.cost > 0 && !isUnlocked(selectedReward) && (
            <Button variant="contained" 
              onClick={() => {
                handleShopPurchase(selectedReward);
                setShowRewardDialog(false);
            } sx={theming.getThemedButtonSx()}}
              disabled={!canAfford(selectedReward)}
            >
              Purchase
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RewardSystem;

