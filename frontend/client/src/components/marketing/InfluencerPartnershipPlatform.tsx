import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  IconButton,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Rating,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
} from '@mui/material';
import {
  PersonAdd,
  Campaign,
  Analytics,
  TrendingUp,
  Instagram,
  LinkedIn,
  YouTube,
  Facebook,
  Twitter,
  ExpandMore,
  Search,
  FilterListList,
  Star,
  Visibility,
  ThumbUp,
  Share,
  Comment,
  AttachMoney,
  Assignment,
  CheckCircle,
  Schedule,
  Warning,
  Info,
  Add,
  Edit,
  Delete,
  Launch,
  ContactPage,
  Handshake,
  CampaignOutlined,
  BoxChart,
  TrendingUpOutlined,
  DirectionsBusinessCenter,
  LocationOn,
  Language,
  VerifiedPerson,
  MonetizationOn,
  PeopleAlt,
  ContentContentCopy,
  Email,
  Phone,
} from '@mui/icons-material';

interface Influencer {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  location: string;
  categories: string[];
  platforms: {
    platform: 'instagram' | 'youtube' | 'tiktok' | 'linkedin' | 'facebook';
    followers: number;
    engagement: number;
    verified: boolean;
    username: string;
}[];
  metrics: {
    totalFollowers: number;
    avgEngagement: number;
    reachEstimate: number;
    priceRange: {
      min: number;
      max: number;
};
};
  rating: number;
  collaborations: number;
  lastActive: string;
  languages: string[];
  verified: boolean;
  tags: string[];
  contactInfo: {
    email?: string;
    phone?: string;
    website?: string;
    manager?: string;
};
}

interface Campaign {
  id: string;
  name: string;
  brand: string;
  status: 'planning' | 'active' | 'completed' | 'paused';
  budget: number;
  startDate: string;
  endDate: string;
  objective: string;
  targetAudience: string;
  deliverables: string[];
  influencers: string[];
  metrics: {
    impressions: number;
    clicks: number;
    engagement: number;
    conversions: number;
    roi: number;
};
  description: string;
  requirements: string[];
  timeline: Array<{
    phase: string;
    deadline: string;
    status: 'pending' | 'in-progress' | 'completed';
}>;
}

interface Partnership {
  id: string;
  influencerId: string;
  campaignId: string;
  status: 'proposed' | 'negotiating' | 'contracted' | 'active' | 'completed' | 'cancelled';
  agreement: {
    compensation: number;
    deliverables: string[];
    timeline: string;
    terms: string[];
};
  content: Array<{
    id: string;
    type: 'post' | 'story' | 'video' | 'reel';
    platform: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'published';
    metrics?: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
};
}>;
  communication: Array<{
    id: string;
    timestamp: string;
    from: 'brand' | 'influencer';
    message: string;
    type: 'message' | 'approval' | 'revision';
}>;
}

interface InfluencerPartnershipPlatformProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const InfluencerPartnershipPlatform: React.FC<InfluencerPartnershipPlatformProps> = ({ 
  profession = 'photographer' 
}) => {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [selectedCampaign, setCampaign] = useState<Campaign | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'influencer' | 'campaign' | 'partnership'>('influencer',
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(' ');
  const [filterCategory, setFilterCategory] = useState('all,');
  const [filterLocation, setFilterLocation] = useState('all,');
  const [followerRange, setFollowerRange] = useState<number[]>([1000, 1000000]);

  // Load data on component mount
  useEffect(() => {
    loadInfluencerData();
}, []);

  const loadInfluencerData = async () => {
    setLoading(true);
    try {
      const [influencersRes, campaignsRes, partnershipsRes] = await Promise.all([
        fetch('/api/influencer-platform/influencers'),
        fetch('/api/influencer-platform/campaigns'),
        fetch('/api/influencer-platform/partnerships'),
      ]);

      const [influencerData, campaignData, partnershipData] = await Promise.all([
        influencersRes.json(),
        campaignsRes.json(),
        partnershipsRes.json(),
      ]);

      setInfluencers(influencerData.data || []);
      setCampaigns(campaignData.data || []);
      setPartnerships(partnershipData.data || []);
  } catch (error) {
      console.error('Error loading influencer data: ', error);
  } finally {
      setLoading(false);
  }
};

  const handleCreateCampaign = async (campaignData: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/influencer-platform/campaigns', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(campaignData),
    });

      if (response.ok) {
        await loadInfluencerData();
        setDialogOpen(false);
    }
  } catch (error) {
      console.error('Error creating campaign:', error);
  } finally {
      setLoading(false);
  }
};

  const handlePartnershipProposal = async (
    influencerId: string,
    campaignId: string,
    proposal: any,
  ) => {
    setLoading(true);
    try {
      const response = await fetch('/api/influencer-platform/partnerships', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({
          influencerd,
          campaignId,
          ...proposal,
      }),
    });

      if (response.ok) {
        await loadInfluencerData();
    }
  } catch (error) {
      console.error('Error creating partnership:', error);
  } finally {
      setLoading(false);
  }
};

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram />;
      case 'youtube':
        return <YouTube />;
      case 'linkedin':
        return <LinkedIn />;
      case 'facebook':
        return <Facebook />;
      case 'twitter':
        return <Twitter />;
      default:
        return <Language />;
}
};

  const formatFollowers = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed()}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
      case 'approved':
      case 'published':
        return 'success';
      case 'planning':
      case 'pending':
      case 'negotiating':
      case 'draft':
        return 'warning';
      case 'paused':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
}
};

  const filteredInfluencers = influencers.filter((influencer) => {
    const matchesSearch =
      influencer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      influencer.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || influencer.categories.includes(filterCategory);
    const matchesLocation =
      filterLocation === 'all' || influencer.location.includes(filterLocation);
    const matchesFollowers =
      influencer.metrics.totalFollowers >= followerRange[0] &&
      influencer.metrics.totalFollowers <= followerRange[1];

    return matchesSearch && matchesCategory && matchesLocation && matchesFollowers;
});

  const renderInfluencerDiscovery = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Influencer Discovery</Typography>
        <Button variant="contained" startIcon={<PersonAdd />}>
          Inviter Influencer
        </Button>
      </Box>

      {/* Search and Filter Section */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Søk influencere"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Navn eller @brukernavn"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />}}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                label="Kategori"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="lifestyle">Livsstil</MenuItem>
                <MenuItem value="photography">Fotografi</MenuItem>
                <MenuItem value="travel">Reise</MenuItem>
                <MenuItem value="food">Mat</MenuItem>
                <MenuItem value="fashion">Mote</MenuItem>
                <MenuItem value="tech">Teknologi</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Lokasjon</InputLabel>
              <Select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                label="Lokasjon"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="Oslo">Oslo</MenuItem>
                <MenuItem value="Bergen">Bergen</MenuItem>
                <MenuItem value="Trondheim">Trondheim</MenuItem>
                <MenuItem value="Stavanger">Stavanger</MenuItem>
                <MenuItem value="Tromsø">Tromsø</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="body2" gutterBottom>
              Følgere: {formatFollowers(followerRange[0])} - {formatFollowers(followerRange[1])}
            </Typography>
            <Slider
              value={followerRange}
              onChange={(_, newValue) => setFollowerRange(newValue as number[])}
              valueLabelDisplay="auto"
              min={1000}
              max={10000000}
              scale={(x) => x}
              valueLabelFormat={formatFollowers}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Influencer Grid */}
      <Grid container spacing={3}>
        {filteredInfluencers.map((influencer) => (
          <Grid item xs={12} md={6} lg={4} key={influencer.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar src={influencer.avatar} sx={{ width:  56, height:  56, mr:  2 }} />
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{influencer.name}</Typography>
                      {influencer.verified && <VerifiedUser color="primary" fontSize="small" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      @{influencer.username}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="caption">{influencer.location}</Typography>
                    </Box>
                  </Box>
                  <Rating value={influencer.rating} size="small" readOnly />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40}}>
                  {influencer.bio.length > 100
                    ? `${influencer.bio.substring(0, 100)}...`
                    : influencer.bio}
                </Typography>

                {/* Platform Stats */}
                <Box mb={2}>
                  {influencer.platforms.slice(0, 3).map((platform) => (
                    <Box
                      key={platform.platform}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      mb={1}
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        {getPlatformIcon(platform.platform)}
                        <Typography variant="caption" sx={{ textTransform: 'capitalize'}}>
                          {platform.platform}
                        </Typography>
                        {platform.verified && <CheckCircle color="primary" sx={{ fontSize: 16}} />}
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatFollowers(platform.followers)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {platform.engagement.toFixed(1)}% eng.
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                {/* Categories */}
                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {influencer.categories.slice(0, 3).map((category) => (
                    <Chip key={category} label={category} size="small" variant="outlined" />
                  ))}
                </Box>

                {/* Metrics */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box textAlign="center">
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      {formatFollowers(influencer.metrics.totalFollowers)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total følgere
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                      {influencer.metrics.avgEngagement.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Snitt engagement
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                      {influencer.collaborations}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Samarbeid
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    kr {influencer.metrics.priceRange.min.toLocaleString()} -{', '}
                    {influencer.metrics.priceRange.max.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Aktiv: {new Date(influencer.lastActive).toLocaleDateString('')}
                  </Typography>
                </Box>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  size="small"
                  startIcon={theming.getThemedIcon('visibility')}
                  onClick={() => setSelectedInfluencer(influencer)}
                >
                  Se Profil
                </Button>
                <Button size="small" startIcon={<Handshake />} variant="contained">
                  Foreslå Samarbeid
                </Button>
                <IconButton size="small">
                  {theming.getThemedIcon('email')}
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderCampaignManagement = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Kampanje Management</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => {
            setDialogType('campaign');
            setDialogOpen(true);
        }}
        >
          Ny Kampanje
        </Button>
      </Box>

      <Grid container spacing={3}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} md={6} lg={4} key={campaign.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {campaign.name}
                  </Typography>
                  <Chip
                    label={campaign.status}
                    color={getStatusColor(campaign.status)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {campaign.brand}
                </Typography>

                <Typography variant="body2" sx={{ mb: 2, minHeight: 40}}>
                  {campaign.description}
                </Typography>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Budsjett
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      kr {campaign.budget.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="caption" color="text.secondary">
                      ROI
                    </Typography>
                    <Typography variant="h6"
                      color={campaign.metrics.roi  sx={{ color: theming.colors.primary }}> 0 ? 'success.main' : 'text.primary'}
                    >
                      {campaign.metrics.roi > 0 ? '+': ','}
                      {campaign.metrics.roi.toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>

                <Box mb={2}>
                  <Typography variant="caption" color="text.secondary">
                    Periode: {new Date(campaign.startDate).toLocaleDateString('')} -{', '}
                    {new Date(campaign.endDate).toLocaleDateString('no-NO')}
                  </Typography>
                </Box>

                {/* Progress indicators */}
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="caption">Fremdrift</Typography>
                    <Typography variant="caption">
                      {campaign.timeline.filter((t) => t.status === 'completed').length} /{', '}
                      {campaign.timeline.length}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      (campaign.timeline.filter((t) => t.status === 'completed').length /
                        campaign.timeline.length) *
                      100 }
                    sx={{ height:  6, borderRadius:  3 }}
                  />
                </Box>

                {/* Key metrics */}
                <Grid container spacing={1} sx={{ mb:  2 }}>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Influencere
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {campaign.influencers.length}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Leveranser
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {campaign.deliverables.length}
                    </Typography>
                  </Grid>
                </Grid>

                <Box display="flex" gap={1} flexWrap="wrap">
                  {campaign.deliverables.slice(0, 2).map((deliverable, index) => (
                    <Chip key={index} label={deliverable} size="small" variant="outlined" />
                  ))}
                  {campaign.deliverables.length > 2 && (
                    <Chip
                      label={`+${campaign.deliverables.length - 2} til`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button size="small" startIcon={<BarChart />}>
                  Analyser
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                  Rediger
                </Button>
                <Button size="small" startIcon={<PeopleAlt />}>
                  Influencere
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderPartnershipManagement = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Partnership Management
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Influencer</TableCell>
              <TableCell>Kampanje</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Kompensasjon</TableCell>
              <TableCell>Leveranser</TableCell>
              <TableCell>Fremdrift</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partnerships.map((partnership) => {
              const influencer = influencers.find((i) => i.id === partnership.influencerId);
              const campaign = campaigns.find((c) => c.id === partnership.campaignId);
              const completedContent = partnership.content.filter(
                (c) => c.status === 'published',
              ).length;

              return (
                <TableRow key={partnership.id}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar src={influencer?.avatar} sx={{ width:  32, height: 32}} />
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {influencer?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{influencer?.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{campaign?.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={partnership.status}
                      color={getStatusColor(partnership.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      kr {partnership.agreement.compensation.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {partnership.agreement.deliverables.join(', ')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 100}}>
                      <Typography variant="caption" color="text.secondary">
                        {completedContent} / {partnership.content.length}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(completedContent / partnership.content.length) * 100}
                        sx={{ mt: 0.5}}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small">
                      {theming.getThemedIcon('launch')}
                    </IconButton>
                    <IconButton size="small">
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                    <IconButton size="small">
                      {theming.getThemedIcon('email')}
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
          })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderAnalytics = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Influencer Analytics
      </Typography>

      <Grid container spacing={3}>
        {/* Key Metrics */}
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {influencers.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registrerte Influencere
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {campaigns.filter((c) => c.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Kampanjer
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {partnerships.filter((p) => p.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Partnership
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                kr {campaigns.reduce((sum, c) => sum + c.budget, 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Kampanje Budsjett
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Performing Influencers */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Top Influencere
            </Typography>
            <List>
              {influencers
                .sort((a, b) => b.metrics.totalFollowers - a.metrics.totalFollowers)
                .slice(0, 5)
                .map((influencer, index) => (
                  <ListItem key={influencer.id}>
                    <ListItemAvatar>
                      <Badge
                        badgeContent={index + 1}
                        color="primary"
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'right'}}
                      >
                        <Avatar src={influencer.avatar} />
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={influencer.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {formatFollowers(influencer.metrics.totalFollowers)} følgere •{' '}
                            {influencer.metrics.avgEngagement.toFixed(1)}% engagement
                          </Typography>
                          <Box display="flex" gap={0.5} mt={0.5}>
                            {influencer.categories.slice(0, 2).map((cat) => (
                              <Chip key={cat} label={cat} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                    }
                    />
                    <Rating value={influencer.rating} size="small" readOnly />
                  </ListItem>
                ))}
            </List>
          </Paper>
        </Grid>

        {/* Campaign Performance */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Kampanje Ytelse
            </Typography>
            <List>
              {campaigns
                .sort((a, b) => b.metrics.roi - a.metrics.roi)
                .slice(0, 5)
                .map((campaign) => (
                  <ListItem key={campaign.id}>
                    <ListItemText
                      primary={campaign.name}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            Budsjett: kr {campaign.budget.toLocaleString()} • ROI: {', '}
                            {campaign.metrics.roi.toFixed(1)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {campaign.influencers.length} influencere •{', '}
                            {campaign.deliverables.length} leveranser
                          </Typography>
                        </Box>
                    }
                    />
                    <Chip
                      label={campaign.status}
                      color={getStatusColor(campaign.status)}
                      size="small"
                    />
                  </ListItem>
                ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ width:'100%', p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Influencer Partnership Platform
      </Typography>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb:  3 }}>
        <Tab icon={theming.getThemedIcon('search')}} label="Discover" />
        <Tab icon={<CampaignOutlined />} label="Kampanjer" />
        <Tab icon={<Handshake />} label="Partnerships" />
        <Tab icon={<BarChart />} label="Analyser" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb:  2 }} />}

      {tabValue === 0 && renderInfluencerDiscovery()}
      {tabValue === 1 && renderCampaignManagement()}
      {tabValue === 2 && renderPartnershipManagement()}
      {tabValue === 3 && renderAnalytics()}
    </Box>
  );
};

export default InfluencerPartnershipPlatform;
