import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Tooltip,
  Alert,
  Divider,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Share as ShareIcon,
  People as PeopleIcon,
  EmojiEvents as EmojiEventsIcon,
  MonetizationOn as MonetizationOnIcon,
  TrendingUp as TrendingUpIcon,
  ContentContentCopy as ContentCopyIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  LocalOffer as LocalOfferIcon,
  DirectionsCardGiftcard as CardGiftcardIcon,
  AccountBalance as AccountBalanceIcon,
  Psychology as PsychologyIcon,
  Timeline as TimelineIcon,
  Groups as GroupsIcon,
  Campaign as CampaignIcon,
  Leaderboard as LeaderboardIcon,
  ExpandMore as ExpandMoreIcon,
  Launch as LaunchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface ReferralProgram {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  type: 'percentage' | 'fixed' | 'tiered' | 'recurring';
  reward: {
    referrer: number;
    referee: number;
    currency: string;
    description: string;
};
  conditions: {
    minimumSpend?: number;
    validPeriod?: number;
    maxRedemptions?: number;
    professionTarget?: string[];
};
  createdAt: string;
  stats: {
    totalReferrals: number;
    successfulReferrals: number;
    totalRewards: number;
    conversionRate: number;
};
}

interface ReferralData {
  id: string;
  referrerId: string;
  refereeEmail: string;
  refereeId?: string;
  programId: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  referralCode: string;
  shareUrl: string;
  createdAt: string;
  completedAt?: string;
  reward: {
    amount: number;
    currency: string;
    paid: boolean;
    paidAt?: string;
};
  refereeData?: {
    name: string;
    profession: string;
    signupDate: string;
    firstPurchase?: number;
};
}

interface GrowthCampaign {
  id: string;
  name: string;
  type: 'viral_loop' | 'referral_contest' | 'milestone_reward' | 'network_effect';
  status: 'active' | 'paused' | 'completed';
  description: string;
  mechanics: {
    trigger: string;
    reward: string;
    target: number;
    duration: number;
};
  performance: {
    participants: number;
    completions: number;
    viralCoefficient: number;
    roi: number;
};
  createdAt: string;
  endsAt?: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`referral-tabpanel-${index}`}
      aria-labelledby={`referral-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function ReferralGrowthSystem() {
  const [activeTab, setActiveTab] = useState(0);
  const [referralDialog, setReferralDialog] = useState(false);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ReferralProgram | null>(null);
  const [referralForm, setReferralForm] = useState({
    name:  ',',
    type: 'percentage' as const,
    referrerReward:  0,
    refereeReward:  0,
    minimumSpend:  0,
    description: '',
});

  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer,');
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  // Fetch referral programs
  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ['/api/referral/programs', user?.id],
    queryFn: () => apiRequest(`/api/referral/programs/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch user's referrals
  const { data: referrals = [, ],} = useQuery({
    queryKey: ['/api/referral/my-referrals', user?.id],
    queryFn: () => apiRequest(`/api/referral/my-referrals/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch growth campaigns
  const { data: campaigns = [, ],} = useQuery({
    queryKey: ['/api/referral/campaigns', user?.id],
    queryFn: () => apiRequest(`/api/referral/campaigns/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch referral analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/referral/analytics', user?.id],
    queryFn: () => apiRequest(`/api/referral/analytics/${user?.d}`),
    enabled: !!user?.d,
});

  // Create referral program mutation
  const createProgram = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/referral/programs', {
        method: 'POS',
        body: JSON.stringify({ ...data, userId: user?.id }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/referral/programs', ],});
      setReferralDialog(false);
      setReferralForm({
        name: ', ',
        type: 'percentage',
        referrerReward:  0,
        refereeReward:  0,
        minimumSpend:  0,
        description: ', ',
    });
  },
});

  // Create referral link mutation
  const createReferralLink = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/referral/create-link', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/referral/my-referrals', ],
    });
  },
});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'paused':
        return 'warning';
      case 'pending':
        return 'primary';
      default:
        return 'default';
}
};

  const getRewardTypeLabel = (type: string) => {
    const labels = {
      percentage: 'Prosent',
      fixed: 'Fast belø',
      tiered: 'Nivåbasert',
      recurring: 'Gjentagende',
  };
    return labels[type as keyof typeof labels] || type;
};

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show toast notification
};

  const shareOnPlatform = (platform: string, url: string, message: string) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedMessage = encodeURIComponent(message);

    let shareUrl = ', ';
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedMessage}%20${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https: //www.facebook.com/sharer/sharer.php?u=${encodedUl}`;
        break;
      case 'linkedin':
        shareUrl = `https: //www.linkedin.com/sharing/share-offsite/?url=${encodedUl}`;
        break;
      case 'twitter':
        shareUrl = `https: //twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`;
        break;
      case 'email':
        shareUrl = `mailto: ?subject=${encodeURIComponent('Invitasjon til CreatorHub Norge')}&body=${encodedMessage}%20${encodedUrl}`;
        break;
  }

    if (shareUrl) {
      window.open(shareUrl, ', '_blank');
  }
};

  const handleCreateProgram = () => {
    if (!referralForm.name || !referralForm.referrerReward) return;
    createProgram.mutate(referralForm);
};

  if (programsLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <LinearProgress />
        <Typography sx={{ mt:  2 }}>Laster referral system...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ width: '100%'}}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Referral & Growth Hacking
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="body2">
          Voks eksponentielt som{''}
          {getProfessionDisplayName(getCurrentUserProfession()).toLowerCase()}
          med kraftige referral programmer, viral kampanjer og growth hacking strategier.
        </Typography>
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Referral Programmer" icon={<ShareIcon />} />
          <Tab label="Mine Referrals" icon={<PeopleIcon />} />
          <Tab label="Growth Campaigns" icon={<CampaignIcon />} />
          <Tab label="Leaderboard" icon={<LeaderboardIcon />} />
          <Tab label="Analytics" icon={<TrendingUpIcon />} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Referral Programmer</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setReferralDialog(true)}
          >
            Nytt Program
          </Button>
        </Box>

        <Grid container spacing={2}>
          {programs.map((program: ReferralProgram) => (
            <Grid item xs={12} key={program.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Box display="flex" alignItems="center" gap={2} mb={1}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{program.name}</Typography>
                        <Chip
                          label={program.status}
                          color={getStatusColor(program.status) as any}
                          size="small"
                        />
                        <Chip
                          label={getRewardTypeLabel(program.type)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {program.description}
                      </Typography>

                      <Box display="flex" gap={3} mb={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Referrer Belønning
                          </Typography>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {program.type === 'percentage'
                              ? `${program.reward.referrer}%`
                              : `${program.reward.referrer} ${program.reward.currency}`}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Referee Belønning
                          </Typography>
                          <Typography variant="h6" color="secondary" sx={{ color: theming.colors.primary }}>
                            {program.type === 'percentage'
                              ? `${program.reward.referee}%`
                              : `${program.reward.referee} ${program.reward.currency}`}
                          </Typography>
                        </Box>
                      </Box>

                      <Grid container spacing={2}>
                        <Grid item xs={3} >
                          <Typography variant="caption" display="block">
                            Totale Referrals
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{program.stats.totalReferrals}</Typography>
                        </Grid>
                        <Grid item xs={3} >
                          <Typography variant="caption" display="block">
                            Suksessrate
                          </Typography>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                            {program.stats.conversionRate.toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={3} >
                          <Typography variant="caption" display="block">
                            Total Belønning
                          </Typography>
                          <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                            {program.stats.totalRewards.toLocaleString()} NOK
                          </Typography>
                        </Grid>
                        <Grid item xs={3} >
                          <Typography variant="caption" display="block">
                            Opprettet
                          </Typography>
                          <Typography variant="body2">
                            {new Date(program.createdAt).toLocaleDateString('no-NO')}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setSelectedProgram(program);
                          setShareDialog(true);
                      }}
                        startIcon={<ShareIcon />}
                      >
                        Del
                      </Button>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Mine Referrals</Typography>
          <Box>
            <Typography variant="h4" component="span" color="primary" sx={{ color: theming.colors.primary }}>
              {analytics?.totalEarnings || 0} NOK
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              Total opptjent
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3} sx={{ mb:  3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  {referrals.length}
                </Typography>
                <Typography variant="caption">Totale referrals</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {referrals.filter((r: ReferralData) => r.status === 'completed').length}
                </Typography>
                <Typography variant="caption">Fullførte referrals</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  {referrals.filter((r: ReferralData) => r.status === 'pending').length}
                </Typography>
                <Typography variant="caption">Ventende referrals</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                  {analytics?.conversionRate || 0}%
                </Typography>
                <Typography variant="caption">Konverteringsrate</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Referral Kode</TableCell>
                <TableCell>Referee</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Dato</TableCell>
                <TableCell>Belønning</TableCell>
                <TableCell>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {referrals.map((referral: ReferralData) => (
                <TableRow key={referral.d}>
                  <TableCell>
                    <Chip label={referral.referralCode} size="small" />
                  </TableCell>
                  <TableCell>
                    {referral.refereeData ? (
                      <Box>
                        <Typography variant="body2">{referral.refereeData.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {referral.refereeData.profession}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {referral.refereeEmail}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={referral.status}
                      color={getStatusColor(referral.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{new Date(referral.createdAt).toLocaleDateString('no-NO')}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">
                        {referral.reward.amount} {referral.reward.currency}
                      </Typography>
                      {referral.reward.paid && <CheckCircleIcon color="success" fontSize="small" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => copyToClipboard(referral.shareUrl)}>
                      <ContentCopyIcon />
                    </IconButton>
                    <IconButton size="small">
                      <ShareIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Growth Hacking Campaigns</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCampaignDialog(true)}
          >
            Ny Kampanje
          </Button>
        </Box>

        <Grid container spacing={3}>
          {campaigns.map((campaign: GrowthCampaign) => (
            <Grid item xs={12} md={6} key={campaign.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {campaign.name}
                      </Typography>
                      <Chip
                        label={campaign.type.replace('_', ', ')}
                        size="small"
                        variant="outlined"
                        sx={{ mb:  1 }}
                      />
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {campaign.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={campaign.status}
                      color={getStatusColor(campaign.status) as any}
                      size="small"
                    />
                  </Box>

                  <Divider sx={{ my:  2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6} >
                      <Typography variant="caption" display="block">
                        Deltakere
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{campaign.performance.participants}</Typography>
                    </Grid>
                    <Grid item xs={6} >
                      <Typography variant="caption" display="block">
                        Fullføringer
                      </Typography>
                      <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                        {campaign.performance.completions}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} >
                      <Typography variant="caption" display="block">
                        Viral Koeffisient
                      </Typography>
                      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                        {campaign.performance.viralCoefficient.toFixed(2)}x
                      </Typography>
                    </Grid>
                    <Grid item xs={6} >
                      <Typography variant="caption" display="block">
                        ROI
                      </Typography>
                      <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {campaign.performance.roi.toFixed(0)}%
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box mt={2}>
                    <LinearProgress
                      variant="determinate"
                      value={(campaign.performance.completions / campaign.mechanics.target) * 100}
                      sx={{ mb:  1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {campaign.performance.completions} / {campaign.mechanics.target} mål
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Referral Leaderboard
        </Typography>

        <Alert severity="success" sx={{ mb:  3 }}>
          <Typography variant="body2">
            🏆 Du er på plass #{analytics?.leaderboardPosition || 'N/A'} i måneden! Fortsett å
            henvise for å klatre på leaderboardet.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Top Referrers Denne Måneden
              </Typography>
              <List>
                {analytics?.topReferrers?.map((referrer: any, index: number) => (
                  <ListItem key={referrer.d}>
                    <ListItemIcon>
                      <Avatar
                        sx={{
                          bgcolor: index < 3 ? 'gold' : 'grey.30',
                          color: index < 3 ? 'text.primary' : 'text.secondary'}}
                      >
                        {index + 1}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={referrer.name}
                      secondary={`${referrer.profession} • ${referrer.referrals} referrals`}
                    />
                    <ListItemSecondaryAction>
                      <Box textAlign="right">
                        <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                          {referrer.earnings} NOK
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          opptjent
                        </Typography>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                )) || []}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Achievements
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <EmojiEventsIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Første Referral"
                    secondary="Få din første suksessfulle referral"
                  />
                  <CheckCircleIcon color="success" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <StarIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText primary="5-stjerner" secondary="Få 5 suksessfulle referrals" />
                  <ScheduleIcon color="action" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <MonetizationOnIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Money Maker" secondary="Tjen 10,000 NOK i referrals" />
                  <ScheduleIcon color="action" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Referral & Growth Analytics
        </Typography>

        {analytics && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {analytics.totalReferralsSent || 0}
                  </Typography>
                  <Typography variant="caption">Totale referrals sendt</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                    {analytics.conversionRate || 0}%
                  </Typography>
                  <Typography variant="caption">Konverteringsrate</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                    {analytics.viralCoefficient || 0}x
                  </Typography>
                  <Typography variant="caption">Viral koeffisient</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                    {analytics.totalEarnings || 0} NOK
                  </Typography>
                  <Typography variant="caption">Total opptjent</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Create Referral Program Dialog */}
      <Dialog
        open={referralDialog}
        onClose={() => setReferralDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Opprett Referral Program</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                label="Program Navn"
                fullWidth
                value={referralForm.name}
                onChange={(e) => setReferralForm({ ...referralForm, name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Beskrivelse"
                fullWidth
                multiline
                rows={2}
                value={referralForm.description}
                onChange={(e) =>
                  setReferralForm({
                    ...referralForm,
                    description: e.target.value,
                })
              }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Belønning Type</InputLabel>
                <Select
                  value={referralForm.type}
                  onChange={(e) =>
                    setReferralForm({
                      ...referralForm,
                      type: e.target.value as any,
                  })
                }
                >
                  <MenuItem value="percentage">Prosent</MenuItem>
                  <MenuItem value="fixed">Fast beløp</MenuItem>
                  <MenuItem value="tiered">Nivåbasert</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Referrer Belønning"
                type="number"
                fullWidth
                value={referralForm.referrerReward}
                onChange={(e) =>
                  setReferralForm({
                    ...referralForm,
                    referrerReward: Number(e.target.value),
                })
              }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label="Referee Belønning"
                type="number"
                fullWidth
                value={referralForm.refereeReward}
                onChange={(e) =>
                  setReferralForm({
                    ...referralForm,
                    refereeReward: Number(e.target.value),
                })
              }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Minimum Kjøp (NOK)"
                type="number"
                fullWidth
                value={referralForm.minimumSpend}
                onChange={(e) =>
                  setReferralForm({
                    ...referralForm,
                    minimumSpend: Number(e.target.value),
                })
              }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReferralDialog(false)}>Avbryt</Button>
          <Button onClick={handleCreateProgram}
            variant="contained"
            disabled={createProgram.isPending}
           sx={theming.getThemedButtonSx()}>
            Opprett Program
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialog} onClose={() => setShareDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del Referral Program</DialogTitle>
        <DialogContent>
          {selectedProgram && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {selectedProgram.name}
              </Typography>

              <Alert severity="info" sx={{ mb:  2 }}>
                <Typography variant="body2">
                  Del din personlige referral link og tjen {selectedProgram.reward.referrer}
                  {selectedProgram.type === 'percentage'
                    ? '%'
                    : ` ${selectedProgram.reward.currency}`}
                  for hver suksessfull referral!
                </Typography>
              </Alert>

              <TextField
                label="Din Referral Link"
                fullWidth
                value={`https: //creatorhub.no/ref/${user?.d}/signup`}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton
                      onClick={() =>
                        copyToClipboard(`https://creatorhub.no/ref/${user?.d}/signup`)
                    }
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  )}}
                sx={{ mb:  2 }}
              />

              <Typography variant="subtitle2" gutterBottom>
                Del på sosiale medier: </Typography>

              <Box display="flex" gap=, {, 2}>
                <IconButton
                  color="success"
                  onClick={() =>
                    shareOnPlatform(
                      'whatsapp',
                      `https: //creatorhub.no/ref/${user?.d}/signup`,
                      `Bli med på CreatorHub Norge og få ${selectedProgram.reward.referee}% rabatt! Norges beste platform for kreative profesjonelle.`,
                    )
                }
                >
                  <WhatsAppIcon />
                </IconButton>
                <IconButton
                  color="primary"
                  onClick={() =>
                    shareOnPlatform(
                      'facebook',
                      `https: //creatorhub.no/ref/${user?.d}/signup`'Sjekk ut CreatorHub Norge!',
                    )
                }
                >
                  <FacebookIcon />
                </IconButton>
                <IconButton
                  sx={{ color: '#0077b5'}}
                  onClick={() =>
                    shareOnPlatform(
                      'linkedin',
                      `https: //creatorhub.no/ref/${user?.d}/signup`'Profesjonell platform for kreative i Norge',
                    )
                }
                >
                  <LinkedInIcon />
                </IconButton>
                <IconButton
                  onClick={() =>
                    shareOnPlatform(
                     'email',
                      `https: //creatorhub.no/ref/${user?.d}/signup`'Hei! Jeg vil gjerne invitere deg til CreatorHub Norge - Norges beste platform for kreative profesjonelle.',
                    )
                }
                >
                  <EmailIcon />
                </IconButton>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
