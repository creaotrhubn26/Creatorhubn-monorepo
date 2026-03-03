import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  LocalOffer,
  Redeem,
  ShoppingCart,
  Star,
  WorkspacePremium,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface RewardRequirement {
  id: string;
  description: string;
  completed: boolean;
  value: number;
  maxValue: number;
}

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
  requirements: RewardRequirement[];
}

interface UserReward {
  id: string;
  rewardId: string;
  userId: string;
  earnedAt: Date;
  used: boolean;
  usedAt?: Date;
  expiresAt?: Date;
}

interface RewardSystemProps {
  className?: string;
  onRewardEarned?: (reward: Reward) => void;
  onRewardUsed?: (reward: Reward) => void;
  onShopPurchase?: (reward: Reward) => void;
}

const INITIAL_REWARDS: Reward[] = [
  {
    id: 'rw-1',
    name: 'Priority Export Slot',
    description: 'Unlock one fast export slot.',
    type: 'unlock',
    value: 1,
    cost: 80,
    category: 'performance',
    rarity: 'rare',
    icon: 'workspace_premium',
    unlocked: false,
    requirements: [
      {
        id: 'req-1',
        description: 'Complete 3 project exports',
        completed: true,
        value: 3,
        maxValue: 3,
      },
    ],
  },
  {
    id: 'rw-2',
    name: 'Discount Voucher',
    description: 'Get 10% off next premium feature purchase.',
    type: 'discount',
    value: 10,
    cost: 60,
    category: 'interaction',
    rarity: 'uncommon',
    icon: 'local_offer',
    unlocked: false,
    requirements: [
      {
        id: 'req-2',
        description: 'Reach 200 contribution points',
        completed: true,
        value: 200,
        maxValue: 200,
      },
    ],
  },
  {
    id: 'rw-3',
    name: 'Creator Star Badge',
    description: 'Permanent profile badge for your workspace.',
    type: 'badge',
    value: 1,
    cost: 40,
    category: 'content',
    rarity: 'common',
    icon: 'star',
    unlocked: true,
    unlockedAt: new Date('2026-02-20T10:00:00Z'),
    requirements: [
      {
        id: 'req-3',
        description: 'Publish 1 project',
        completed: true,
        value: 1,
        maxValue: 1,
      },
    ],
  },
];

function rarityColor(rarity: Reward['rarity']): 'default' | 'success' | 'info' | 'warning' | 'error' {
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

function rewardIcon(iconName: string): React.ReactNode {
  switch (iconName) {
    case 'workspace_premium':
      return <WorkspacePremium color="warning" />;
    case 'local_offer':
      return <LocalOffer color="primary" />;
    case 'star':
    default:
      return <Star color="secondary" />;
  }
}

export default function RewardSystem({
  className,
  onRewardEarned,
  onRewardUsed,
  onShopPurchase,
}: RewardSystemProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState(0);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | Reward['category']>('all');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const [userPoints, setUserPoints] = useState(150);
  const [rewards, setRewards] = useState<Reward[]>(INITIAL_REWARDS);
  const [userRewards, setUserRewards] = useState<UserReward[]>([
    {
      id: 'ur-1',
      rewardId: 'rw-3',
      userId: 'user-1',
      earnedAt: new Date('2026-02-20T10:00:00Z'),
      used: false,
    },
  ]);

  const filteredRewards = useMemo(() => {
    return rewards.filter((reward) => {
      if (selectedCategory !== 'all' && reward.category !== selectedCategory) {
        return false;
      }
      if (showUnlockedOnly && !reward.unlocked) {
        return false;
      }
      return true;
    });
  }, [rewards, selectedCategory, showUnlockedOnly]);

  const selectedReward = useMemo(
    () => rewards.find((reward) => reward.id === selectedRewardId) ?? null,
    [rewards, selectedRewardId],
  );

  const handlePurchase = (reward: Reward): void => {
    if (reward.unlocked || userPoints < reward.cost) {
      return;
    }

    const unlockedReward = {
      ...reward,
      unlocked: true,
      unlockedAt: new Date(),
    };

    setUserPoints((previous) => previous - reward.cost);
    setRewards((previous) =>
      previous.map((entry) => (entry.id === reward.id ? unlockedReward : entry)),
    );

    const userReward: UserReward = {
      id: `ur-${Date.now()}`,
      rewardId: reward.id,
      userId: 'user-1',
      earnedAt: new Date(),
      used: false,
    };

    setUserRewards((previous) => [userReward, ...previous]);
    onShopPurchase?.(unlockedReward);
    onRewardEarned?.(unlockedReward);
  };

  const handleUseReward = (reward: Reward): void => {
    if (!reward.unlocked) {
      return;
    }

    setUserRewards((previous) =>
      previous.map((entry) =>
        entry.rewardId === reward.id && !entry.used
          ? {
              ...entry,
              used: true,
              usedAt: new Date(),
            }
          : entry,
      ),
    );

    onRewardUsed?.(reward);
  };

  const openReward = (rewardId: string): void => {
    setSelectedRewardId(rewardId);
    setShowRewardDialog(true);
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Redeem color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Reward System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Earn, purchase, and apply rewards across Story Arc workflows.
              </Typography>
            </Box>
          </Stack>
          <Chip label={`${userPoints} points`} color="primary" />
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, next) => setActiveTab(next)}>
          <Tab icon={<ShoppingCart />} iconPosition="start" label="Shop" />
          <Tab icon={<Redeem />} iconPosition="start" label="My Rewards" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="reward-category-label">Category</InputLabel>
                  <Select
                    labelId="reward-category-label"
                    label="Category"
                    value={selectedCategory}
                    onChange={(event) => {
                      const value = event.target.value as 'all' | Reward['category'];
                      setSelectedCategory(value);
                    }}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="content">Content</MenuItem>
                    <MenuItem value="interaction">Interaction</MenuItem>
                    <MenuItem value="collaboration">Collaboration</MenuItem>
                    <MenuItem value="learning">Learning</MenuItem>
                    <MenuItem value="performance">Performance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                  <Typography variant="body2">Unlocked only</Typography>
                  <Switch checked={showUnlockedOnly} onChange={(event) => setShowUnlockedOnly(event.target.checked)} />
                </Stack>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              {filteredRewards.map((reward) => (
                <Grid key={reward.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            {rewardIcon(reward.icon)}
                            <Typography variant="subtitle1">{reward.name}</Typography>
                          </Stack>
                          <Chip size="small" label={reward.rarity} color={rarityColor(reward.rarity)} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {reward.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cost: {reward.cost} points
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => openReward(reward.id)}>
                            Details
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={reward.unlocked || userPoints < reward.cost}
                            onClick={() => handlePurchase(reward)}
                          >
                            {reward.unlocked ? 'Unlocked' : 'Purchase'}
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 1 ? (
        <Card>
          <CardContent>
            {userRewards.length === 0 ? (
              <Alert severity="info">No rewards earned yet.</Alert>
            ) : (
              <List>
                {userRewards.map((userReward) => {
                  const reward = rewards.find((entry) => entry.id === userReward.rewardId);
                  if (!reward) {
                    return null;
                  }

                  return (
                    <ListItem
                      key={userReward.id}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={userReward.used}
                          onClick={() => handleUseReward(reward)}
                        >
                          {userReward.used ? 'Used' : 'Use'}
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={reward.name}
                        secondary={`Earned ${userReward.earnedAt.toLocaleDateString()} • ${reward.category}`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showRewardDialog} onClose={() => setShowRewardDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedReward?.name ?? 'Reward'}</DialogTitle>
        <DialogContent>
          {selectedReward ? (
            <Stack spacing={1}>
              <Typography>{selectedReward.description}</Typography>
              <Typography variant="body2" color="text.secondary">
                Type: {selectedReward.type}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Category: {selectedReward.category}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cost: {selectedReward.cost} points
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {selectedReward.unlocked ? 'Unlocked' : 'Locked'}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRewardDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
