import { useTheming } from '../../utils/theming-helper';
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
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Box,
} from '@mui/material';
import type {
  Campaign} from '@mui/icons-material';
import {
  TrendingUp,
  People,
  Analytics,
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
  Email,
  Phone,
  PersonAdd,
  Star,
  Visibility,
  ThumbUp,
  Share,
  Comment,
  AttachMoney,
  FilterList as FilterListList,
  Search,
  ExpandMore,
  GetApp,
  Speed as Speed,
  Psychology,
  RocketLaunch as Rocket,
  AutoGraph,
  PeopleAlt,
  CampaignOutlined,
  LeaderboardOutlined,
  AssignmentTurnedIn,
  BusinessCenter as DirectionsBusinessCenter,
  MonetizationOn,
  TrendingUpOutlined,
  BarChart as BoxChart,
  BarChart as BoxChart,
  ShowChart,
  Assessment,
  AccountCircle,
  LocationOn,
  Language,
  ContentCopy as ContentContentCopy,
  WhatsApp,
  LinkedIn,
  Facebook,
  Instagram,
  YouTube,
  Download,
  Upload,
  PlayArrow as PlayArrowArrow,
  Pause,
  Stop,
  Settings,
  NotificationsActive,
  Timer,
  EventNote,
  CallMade,
  CallReceived,
  History,
  TrendingFlat,
} from '@mui/icons-material';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  location: string;
  source: string;
  status: 'new' | 'qualified' | 'nurturing' | 'hot' | 'converted' | 'lost';
  score: number;
  tags: string[];
  interests: string[];
  budget?: {
    min: number;
    max: number;
};
  projectType?: string;
  timeline?: string;
  lastActivity: string;
  touchpoints: Array<{
    id: string;
    type: 'email' | 'call' | 'meeting' | 'form' | 'social' | 'website';
    timestamp: string;
    description: string;
    outcome?: string;
}>;
  demographics: {
    age?: number;
    gender?: string;
    profession?: string;
    industry?: string;
};
  behavior: {
    websiteVisits: number;
    pageViews: number;
    timeOnSite: number;
    downloadedContent: string[];
    emailOpens: number;
    emailClicks: number;
};
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string
}

interface LeadMagnet {
  id: string;
  title: string;
  description: string;
  type: 'ebook' | 'template' | 'checklist' | 'webinar' | 'course' | 'toolkit';
  profession: string[];
  downloadCount: number;
  conversionRate: number;
  landingPageUrl: string;
  fileUrl: string;
  thumbnail: string;
  isActive: boolean;
  tags: string[];
  createdAt: string
}

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'social' | 'content' | 'paid' | 'referral';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetAudience: string;
  budget?: number;
  startDate: string;
  endDate?: string;
  metrics: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    cost: number;
    roi: number;
};
  leadMagnets: string[];
  automationRules: Array<{
    trigger: string;
    action: string;
    delay?: number;
}>;
  createdAt: string
}

interface ConversionFunnel {
  name: string;
  stages: Array<{
    name: string;
    count: number;
    conversionRate: number;
    avgTimeInStage: number;
}>;
  totalLeads: number;
  totalConversions: number;
  overallConversionRate: number;
  avgSalesCycleLength: number
}

const AutomatedLeadGenerationSystem: React.FC = () => {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadMagnets, setLeadMagnets] = useState<LeadMagnet[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [funnelData, setFunnelData] = useState<ConversionFunnel | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'lead' | 'magnet' | 'campaign'>('lead');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [scoreRange, setScoreRange] = useState<number[]>([0, 100]);

  // Load data on component mount
  useEffect(() => {
    loadLeadData();
}, []);

  const loadLeadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, magnetsRes, campaignsRes, funnelRes] = await Promise.all([
        fetch('/api/lead-generation/leads'),
        fetch('/api/lead-generation/lead-magnets'),
        fetch('/api/lead-generation/campaigns'),
        fetch('/api/lead-generation/funnel-analytics'),
      ]);

      const [leadsData, magnetsData, campaignsData, funnelData] = await Promise.all([
        leadsRes.json(),
        magnetsRes.json(),
        campaignsRes.json(),
        funnelRes.json(),
      ]);

      setLeads(leadsData.data || []);
      setLeadMagnets(magnetsData.data || []);
      setCampaigns(campaignsData.data || []);
      setFunnelData(funnelData.data || null);
  } catch (error) {
      console.error('Error loading lead data: ', error);
  } finally {
      setLoading(false);
  }
};

  const handleCreateLead = async (leadData: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/lead-generation/leads', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(leadData),
    });

      if (response.ok) {
        await loadLeadData();
        setDialogOpen(false);
    }
  } catch (error) {
      console.error('Error creating lead:', error);
  } finally {
      setLoading(false);
  }
};

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lead-generation/leads/${leadd}`, {
        method: 'PATC',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ status: newStatus }),
    });

      if (response.ok) {
        await loadLeadData();
    }
  } catch (error) {
      console.error('Error updating lead status:', error);
  } finally {
      setLoading(false);
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'info';
      case 'qualified':
        return 'primary';
      case 'nurturing':
        return 'warning';
      case 'hot':
        return 'error';
      case 'converted':
        return 'success';
      case 'lost':
        return 'default';
      default:
        return 'default';
}
};

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success.main';
    if (score >= 60) return 'warning.main';
    if (score >= 40) return 'info.main';
    return 'text.secondary';
};

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSource = filterSource === 'all' || lead.source === filterSource;
    const matchesScore = lead.score >= scoreRange[0] && lead.score <= scoreRange[1];

    return matchesSearch && matchesStatus && matchesSource && matchesScore;
});

  const renderLeadOverview = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Lead Oversikt</Typography>
        <Button variant="contained"
          startIcon={<PersonAdd />}
          onClick={() => {
            setDialogType('lead');
            setDialogOpen(true);
        }}
        >
          Ny Lead
        </Button>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {leads.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Leads
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {leads.filter((l) => l.status === 'hot').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Varme Leads
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {leads.filter((l) => l.status === 'nurturing').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Under Pleie
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length) || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Snitt Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {funnelData ? `${funnelData.overallConversionRate.toFixed(1)}%` : '0%'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Konvertering
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Section */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Søk leads"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Navn, email eller firma"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />}}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="new">Nye</MenuItem>
                <MenuItem value="qualified">Kvalifisert</MenuItem>
                <MenuItem value="nurturing">Under pleie</MenuItem>
                <MenuItem value="hot">Varme</MenuItem>
                <MenuItem value="converted">Konvertert</MenuItem>
                <MenuItem value="lost">Tapt</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Kilde</InputLabel>
              <Select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                label="Kilde"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="website">Nettside</MenuItem>
                <MenuItem value="social">Sosiale medier</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="referral">Henvisning</MenuItem>
                <MenuItem value="paid">Betalt annonsering</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <Typography variant="body2" gutterBottom>
              Lead Score: {scoreRange[0]} - {scoreRange[1]}
            </Typography>
            <Slider
              value={scoreRange}
              onChange={(_, newValue) => setScoreRange(newValue as number[])}
              valueLabelDisplay="auto"
              min={0}
              max={100}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Lead Grid */}
      <Grid container spacing={3}>
        {filteredLeads.map((lead) => (
          <Grid item xs={12} md={6} lg={4} key={lead.id}>
            <Card sx={{ height: '100%',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {lead.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {lead.email}
                    </Typography>
                    {lead.company && (
                      <Typography variant="body2" color="text.secondary">
                        {lead.company}
                      </Typography>
                    )}
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="h6" color={getScoreColor(lead.score)} sx={{ color: theming.colors.primary }}>
                      {lead.score}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Score
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Chip label={lead.status} color={getStatusColor(lead.status)} size="small" />
                  <Chip label={lead.source} variant="outlined" size="small" />
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {lead.location}
                  </Typography>
                </Box>

                {lead.projectType && (
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    <strong>Prosjekt: </strong> {lead.projectType}
                  </Typography>
                )}

                {lead.budget && (
                  <Typography variant="body2" sx={{ mb:  1 }}>
                    <strong>Budsjett: </strong> kr {lead.budget.min.toLocaleString()} -{', '}
                    {lead.budget.max.toLocaleString()}
                  </Typography>
                )}

                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {lead.interests.slice(0, 3).map((interest) => (
                    <Chip key={interest} label={interest} size="small" variant="outlined" />
                  ))}
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Siste aktivitet: {new Date(lead.lastActivity).toLocaleDateString(', ')}
                </Typography>

                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Aktivitet
                  </Typography>
                  <Box display="flex" justifyContent="space-between">
                    <Box textAlign="center">
                      <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                        {lead.behavior.websiteVisits}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Besøk
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                        {lead.behavior.emailOpens}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Email åpnet
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                        {lead.behavior.downloadedContent.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Nedlastinger
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                        {lead.touchpoints.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kontakt
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  size="small"
                  startIcon={theming.getThemedIcon('visibility')}
                  onClick={() => setSelectedLead(lead)}
                >
                  Se Detaljer
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('email')}>
                  Send Email
                </Button>
                <FormControl size="small" sx={{ minWidth: 100}}>
                  <Select
                    value={lead.status}
                    onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                    size="small"
                  >
                    <MenuItem value="new">Ny</MenuItem>
                    <MenuItem value="qualified">Kvalifisert</MenuItem>
                    <MenuItem value="nurturing">Under pleie</MenuItem>
                    <MenuItem value="hot">Varm</MenuItem>
                    <MenuItem value="converted">Konvertert</MenuItem>
                    <MenuItem value="lost">Tapt</MenuItem>
                  </Select>
                </FormControl>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderLeadMagnets = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Lead Magneter</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => {
            setDialogType('magnet');
            setDialogOpen(true);
        }}
        >
          Ny Lead Magnet
        </Button>
      </Box>

      <Grid container spacing={3}>
        {leadMagnets.map((magnet) => (
          <Grid item xs={12} md={6} lg={4} key={magnet.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {magnet.title}
                  </Typography>
                  <Chip label={magnet.type} color="primary" size="small" />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40}}>
                  {magnet.description}
                </Typography>

                <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
                  {magnet.profession.map((prof) => (
                    <Chip key={prof} label={prof} size="small" variant="outlined" />
                  ))}
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      {magnet.downloadCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nedlastinger
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                      {magnet.conversionRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Konvertering
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
                  {magnet.tags.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>

                <FormControlLabel
                  control={<Switch checked={magnet.isActive} size="small" />}
                  label="Aktiv"
                  sx={{ mt:  1 }}
                />
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button size="small" startIcon={theming.getThemedIcon('launch')}>
                  Se Landing Page
                </Button>
                <Button size="small" startIcon={<BarChart />}>
                  Analyser
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                  Rediger
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderConversionFunnel = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Konverteringskanal
      </Typography>

      {funnelData && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Salgskanal Ytelse
              </Typography>

              {funnelData.stages.map((stage, index) => {
                const isLast = index === funnelData.stages.length - 1;
                const dropoffRate =
                  index > 0
                    ? ((funnelData.stages[index - 1].count - stage.count) /
                        funnelData.stages[index - 1].count) *
                      100
                    : 0;

                return (
                  <Box key={stage.name} mb={3}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{stage.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {stage.avgTimeInStage} dager
                      </Typography>
                    </Box>

                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Box flex={1}>
                        <LinearProgress
                          variant="determinate"
                          value={(stage.count / funnelData.totalLeads) * 100}
                          sx={{ height:  20, borderRadius:  2 }}
                        />
                      </Box>
                      <Typography variant="h6" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                        {stage.count}
                      </Typography>
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="success.main">
                        {stage.conversionRate.toFixed(1)}% konvertering
                      </Typography>
                      {index > 0 && (
                        <Typography variant="body2" color="error.main">
                          -{dropoffRate.toFixed(1)}% frafall
                        </Typography>
                      )}
                    </Box>

                    {!isLast && <Divider sx={{ mt:  2 }} />}
                  </Box>
                );
            })}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Kanal Sammendrag
              </Typography>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Total Leads
                </Typography>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  {funnelData.totalLeads}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Total Konverteringer
                </Typography>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {funnelData.totalConversions}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Samlet Konverteringsrate
                </Typography>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  {funnelData.overallConversionRate.toFixed(1)}%
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Snitt Salgssyklus
                </Typography>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  {funnelData.avgSalesCycleLength} dager
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Optimalisering Tips
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <TrendingUp color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Forbedre første steg"
                    secondary="Øk konvertering fra besøkende til leads"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Psychology color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Optimaliser lead scoring"
                    secondary="Fokuser på høy-score leads"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Speed color="warning" />
                  </ListItemIcon>
                  <ListItemText primary="Reduser salgssyklus" secondary="Automatiser oppfølging" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}
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
                    color={campaign.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Box display="flex" gap={0.5} mb={2}>
                  <Chip label={campaign.type} variant="outlined" size="small" />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {campaign.targetAudience}
                </Typography>

                {campaign.budget && (
                  <Typography variant="body2" sx={{ mb:  2 }}>
                    <strong>Budsjett: </strong> kr {campaign.budget.toLocaleString()}
                  </Typography>
                )}

                <Grid container spacing={2} sx={{ mb:  2 }}>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Leads
                    </Typography>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{campaign.metrics.leads}</Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      Konverteringer
                    </Typography>
                    <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                      {campaign.metrics.conversions}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      CTR
                    </Typography>
                    <Typography variant="body2">
                      {campaign.metrics.impressions > 0
                        ? ((campaign.metrics.clicks / campaign.metrics.impressions) * 100).toFixed(
                            2,
                          )
                        : 0}
                      %
                    </Typography>
                  </Grid>
                  <Grid item xs={6} >
                    <Typography variant="caption" color="text.secondary">
                      ROI
                    </Typography>
                    <Typography
                      variant="body2"
                      color={campaign.metrics.roi > 0 ? 'success.main' : 'error.main'}
                    >
                      {campaign.metrics.roi > 0 ? '+' : ', '}
                      {campaign.metrics.roi.toFixed(1)}%
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="caption" color="text.secondary">
                  {new Date(campaign.startDate).toLocaleDateString('no-NO')} -
                  {campaign.endDate
                    ? new Date(campaign.endDate).toLocaleDateString('no-NO')
                    : 'Pågående'}
                </Typography>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button size="small" startIcon={<BarChart />}>
                  Analyser
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                  Rediger
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('settings')}>
                  Automatisering
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ width:'100%', p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Automatisert Lead Generering & Konvertering
      </Typography>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb:  3 }}>
        <Tab icon={theming.getThemedIcon('people')} label="Leads" />
        <Tab icon={theming.getThemedIcon('getApp')} label="Lead Magneter" />
        <Tab icon={theming.getThemedIcon('trendingUp')} label="Konverteringskanal" />
        <Tab icon={<CampaignOutlined />} label="Kampanjer" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb:  2 }} />}

      {tabValue === 0 && renderLeadOverview()}
      {tabValue === 1 && renderLeadMagnets()}
      {tabValue === 2 && renderConversionFunnel()}
      {tabValue === 3 && renderCampaignManagement()}
    </Box>
  );
};

export default AutomatedLeadGenerationSystem;
