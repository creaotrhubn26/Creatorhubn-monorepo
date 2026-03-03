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
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  Campaign as CampaignIcon,
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
  EmojiEvents as EmojiEventsIcon,
  MonetizationOn as MonetizationOnIcon,
  People as PeopleIcon,
  Share as ShareIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

type RewardType = 'percentage' | 'fixed' | 'tiered' | 'recurring';
type ProgramStatus = 'active' | 'completed' | 'paused' | 'pending';
type ReferralStatus = 'pending' | 'completed' | 'cancelled';

interface ReferralProgram {
  id: string;
  name: string;
  description: string;
  type: RewardType;
  status: ProgramStatus;
  reward: {
    referrer: number;
    referee: number;
    currency: string;
  };
  stats: {
    totalReferrals: number;
    conversionRate: number;
    totalRewards: number;
  };
  createdAt: string;
}

interface ReferralData {
  id: string;
  referralCode: string;
  refereeEmail: string;
  status: ReferralStatus;
  createdAt: string;
  reward: {
    amount: number;
    currency: string;
    paid: boolean;
  };
}

interface GrowthCampaign {
  id: string;
  name: string;
  type: string;
  status: ProgramStatus;
  participants: number;
  completions: number;
  roi: number;
}

interface ReferralAnalytics {
  totalReferralsSent: number;
  conversionRate: number;
  viralCoefficient: number;
  totalEarnings: number;
}

interface ProgramForm {
  name: string;
  description: string;
  type: RewardType;
  referrerReward: number;
  refereeReward: number;
  minimumSpend: number;
}

const initialProgramForm: ProgramForm = {
  name: '',
  description: '',
  type: 'percentage',
  referrerReward: 10,
  refereeReward: 10,
  minimumSpend: 0,
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function programStatusColor(status: ProgramStatus): ChipProps['color'] {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'completed':
      return 'info';
    case 'pending':
    default:
      return 'default';
  }
}

function referralStatusColor(status: ReferralStatus): ChipProps['color'] {
  switch (status) {
    case 'completed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'cancelled':
    default:
      return 'default';
  }
}

function rewardTypeLabel(type: RewardType): string {
  switch (type) {
    case 'percentage':
      return 'Prosent';
    case 'fixed':
      return 'Fast';
    case 'tiered':
      return 'Nivåbasert';
    case 'recurring':
      return 'Gjentagende';
    default:
      return type;
  }
}

export default function ReferralGrowthSystem(): JSX.Element {
  const theming = useTheming('photographer');
  const { user } = useAuth();
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ReferralProgram | null>(null);
  const [programForm, setProgramForm] = useState<ProgramForm>(initialProgramForm);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ['/api/referral/programs', user?.id],
    queryFn: async (): Promise<ReferralProgram[]> => {
      const data = await apiRequest(`/api/referral/programs/${user?.id}`);
      return safeArray<ReferralProgram>(data);
    },
    enabled: Boolean(user?.id),
  });

  const referralsQuery = useQuery({
    queryKey: ['/api/referral/my-referrals', user?.id],
    queryFn: async (): Promise<ReferralData[]> => {
      const data = await apiRequest(`/api/referral/my-referrals/${user?.id}`);
      return safeArray<ReferralData>(data);
    },
    enabled: Boolean(user?.id),
  });

  const campaignsQuery = useQuery({
    queryKey: ['/api/referral/growth-campaigns', user?.id],
    queryFn: async (): Promise<GrowthCampaign[]> => {
      const data = await apiRequest(`/api/referral/growth-campaigns/${user?.id}`);
      return safeArray<GrowthCampaign>(data);
    },
    enabled: Boolean(user?.id),
  });

  const analyticsQuery = useQuery({
    queryKey: ['/api/referral/analytics', user?.id],
    queryFn: async (): Promise<ReferralAnalytics> => {
      const data = (await apiRequest(`/api/referral/analytics/${user?.id}`)) as Partial<ReferralAnalytics>;
      return {
        totalReferralsSent: safeNumber(data.totalReferralsSent),
        conversionRate: safeNumber(data.conversionRate),
        viralCoefficient: safeNumber(data.viralCoefficient),
        totalEarnings: safeNumber(data.totalEarnings),
      };
    },
    enabled: Boolean(user?.id),
  });

  const createProgram = useMutation({
    mutationFn: async (payload: ProgramForm): Promise<void> => {
      await apiRequest('/api/referral/programs', {
        method: 'POST',
        body: JSON.stringify({ ...payload, userId: user?.id }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/referral/programs', user?.id] });
      setProgramDialogOpen(false);
      setProgramForm(initialProgramForm);
      setSnackbarMessage('Referral-program opprettet');
    },
  });

  const programs = programsQuery.data ?? [];
  const referrals = referralsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const busy =
    programsQuery.isLoading ||
    referralsQuery.isLoading ||
    campaignsQuery.isLoading ||
    analyticsQuery.isLoading ||
    createProgram.isPending;

  const completedReferrals = useMemo(
    () => referrals.filter((item) => item.status === 'completed').length,
    [referrals],
  );

  const totalPending = useMemo(
    () => referrals.filter((item) => item.status === 'pending').length,
    [referrals],
  );

  const shareLink = useMemo(() => {
    const userId = user?.id ?? 'guest';
    return `https://creatorhub.no/ref/${encodeURIComponent(String(userId))}/signup`;
  }, [user?.id]);

  const handleCopyShareLink = async (): Promise<void> => {
    await navigator.clipboard.writeText(shareLink);
    setSnackbarMessage('Referral-link kopiert');
  };

  const handleCreateProgram = (): void => {
    if (!programForm.name.trim()) {
      setSnackbarMessage('Programnavn er påkrevd');
      return;
    }
    createProgram.mutate(programForm);
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Referral & Growth Hacking
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Skap organisk vekst som {getProfessionDisplayName(getCurrentUserProfession()).toLowerCase()} med målbare referral-programmer.
        </Typography>
      </Alert>

      {busy && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <Tab icon={<ShareIcon />} label="Programmer" />
        <Tab icon={<PeopleIcon />} label="Referrals" />
        <Tab icon={<CampaignIcon />} label="Kampanjer" />
        <Tab icon={<EmojiEventsIcon />} label="Leaderboard" />
        <Tab icon={<TrendingUpIcon />} label="Analytics" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Referral-programmer
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setProgramDialogOpen(true)}>
              Nytt program
            </Button>
          </Box>

          <Grid container spacing={2}>
            {programs.map((program) => (
              <Grid item xs={12} key={program.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {program.name}
                          </Typography>
                          <Chip label={program.status} color={programStatusColor(program.status)} size="small" />
                          <Chip label={rewardTypeLabel(program.type)} variant="outlined" size="small" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {program.description}
                        </Typography>

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Referrer</Typography>
                            <Typography variant="h6">
                              {program.type === 'percentage'
                                ? `${program.reward.referrer}%`
                                : `${program.reward.referrer} ${program.reward.currency}`}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Referee</Typography>
                            <Typography variant="h6">
                              {program.type === 'percentage'
                                ? `${program.reward.referee}%`
                                : `${program.reward.referee} ${program.reward.currency}`}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Suksessrate</Typography>
                            <Typography variant="h6">{program.stats.conversionRate.toFixed(1)}%</Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="caption" color="text.secondary">Total belønning</Typography>
                            <Typography variant="h6">{program.stats.totalRewards.toLocaleString('no-NO')} NOK</Typography>
                          </Grid>
                        </Grid>
                      </Box>

                      <Box display="flex" gap={1}>
                        <Button
                          size="small"
                          startIcon={<ShareIcon />}
                          onClick={() => {
                            setSelectedProgram(program);
                            setShareDialogOpen(true);
                          }}
                        >
                          Del
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h5">{referrals.length}</Typography>
                  <Typography variant="caption">Totale referrals</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h5">{completedReferrals}</Typography>
                  <Typography variant="caption">Fullførte</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h5">{totalPending}</Typography>
                  <Typography variant="caption">Ventende</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            {referrals.map((referral) => (
              <Grid item xs={12} md={6} key={referral.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Chip label={referral.referralCode} size="small" />
                      <Chip label={referral.status} size="small" color={referralStatusColor(referral.status)} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {referral.refereeEmail}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {referral.reward.amount} {referral.reward.currency}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(referral.createdAt).toLocaleDateString('no-NO')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {tab === 2 && (
        <Grid container spacing={2}>
          {campaigns.map((campaign) => (
            <Grid item xs={12} md={6} key={campaign.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {campaign.name}
                    </Typography>
                    <Chip size="small" label={campaign.status} color={programStatusColor(campaign.status)} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {campaign.type}
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Deltakere</Typography>
                      <Typography variant="h6">{campaign.participants}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Fullføringer</Typography>
                      <Typography variant="h6">{campaign.completions}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">ROI</Typography>
                      <Typography variant="h6">{campaign.roi.toFixed(0)}%</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary }} gutterBottom>
                  Top Referrers
                </Typography>
                <List>
                  {programs.slice(0, 5).map((program, index) => (
                    <ListItem key={program.id}>
                      <ListItemIcon>
                        <Avatar>{index + 1}</Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={program.name}
                        secondary={`${program.stats.totalReferrals} referrals • ${program.stats.totalRewards.toLocaleString('no-NO')} NOK`}
                      />
                      <ListItemSecondaryAction>
                        <Chip size="small" label={`${program.stats.conversionRate.toFixed(1)}%`} />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ color: theming.colors.primary }} gutterBottom>
                  Achievements
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <StarIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText primary="Første referral" secondary="Fullfør én referral" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <MonetizationOnIcon color="success" />
                    </ListItemIcon>
                    <ListItemText primary="Money Maker" secondary="Tjen 10 000 NOK" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 4 && analytics && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.totalReferralsSent}</Typography>
                <Typography variant="caption">Totalt sendt</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.conversionRate.toFixed(1)}%</Typography>
                <Typography variant="caption">Konverteringsrate</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.viralCoefficient.toFixed(2)}x</Typography>
                <Typography variant="caption">Viral koeffisient</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.totalEarnings.toLocaleString('no-NO')} NOK</Typography>
                <Typography variant="caption">Total opptjent</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={programDialogOpen} onClose={() => setProgramDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt referral-program</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Programnavn"
            value={programForm.name}
            onChange={(event) => setProgramForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Beskrivelse"
            value={programForm.description}
            onChange={(event) => setProgramForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="reward-type-label">Belønningstype</InputLabel>
            <Select
              labelId="reward-type-label"
              label="Belønningstype"
              value={programForm.type}
              onChange={(event) =>
                setProgramForm((prev) => ({ ...prev, type: event.target.value as RewardType }))
              }
            >
              <MenuItem value="percentage">Prosent</MenuItem>
              <MenuItem value="fixed">Fast</MenuItem>
              <MenuItem value="tiered">Nivåbasert</MenuItem>
              <MenuItem value="recurring">Gjentagende</MenuItem>
            </Select>
          </FormControl>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Referrer"
                margin="normal"
                value={programForm.referrerReward}
                onChange={(event) =>
                  setProgramForm((prev) => ({ ...prev, referrerReward: Number(event.target.value) }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Referee"
                margin="normal"
                value={programForm.refereeReward}
                onChange={(event) =>
                  setProgramForm((prev) => ({ ...prev, refereeReward: Number(event.target.value) }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgramDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateProgram} disabled={createProgram.isPending}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Del referral-program</DialogTitle>
        <DialogContent>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {selectedProgram?.name ?? 'Program'}
          </Typography>
          <TextField fullWidth margin="normal" label="Referral-link" value={shareLink} InputProps={{ readOnly: true }} />
          <Button startIcon={<ContentCopyIcon />} onClick={() => void handleCopyShareLink()}>
            Kopier link
          </Button>
          <Button startIcon={<EmailIcon />} sx={{ ml: 1 }} href={`mailto:?subject=CreatorHub referral&body=${encodeURIComponent(shareLink)}`}>
            Del på e-post
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(snackbarMessage)} onClose={() => setSnackbarMessage(null)}>
        <DialogTitle>Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{snackbarMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnackbarMessage(null)}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
