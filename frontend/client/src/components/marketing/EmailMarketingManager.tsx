import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
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
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Email as EmailIcon,
  Campaign as CampaignIcon,
  Analytics as AnalyticsIcon,
  People as PeopleIcon,
  AutoMode as AutoModeIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Send as SendIcon,
  Drafts as DraftIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  PersonAdd as PersonAddIcon,
  FilterList as FilterListIcon,
  Segment as SegmentIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  Preview as PreviewIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Refresh as RefreshIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  type: 'newsletter' | 'automation' | 'promotion' | 'welcome' | 'retention';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  audienceSegment: string;
  createdAt: string;
  scheduledAt?: string;
  lastSentAt?: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
    bounced: number;
};
  content: {
    html: string;
    text: string;
    previewText: string;
};
  automation?: {
    trigger: string;
    delay: number;
    conditions: any[];
};
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
  thumbnail: string;
  profession: string;
  isCustom: boolean
}

interface ContactSegment {
  id: string;
  name: string;
  description: string;
  criteria: any;
  contactCount: number;
  lastUpdated: string;
  profession?: string
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
      id={`email-tabpanel-${index}`}
      aria-labelledby={`email-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function EmailMarketingManager() {
  const [activeTab, setActiveTab] = useState(0);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [segmentDialog, setSegmentDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
}>({
    open: false,
    message: '',
    severity: 'info',
});
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<EmailCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name:  ',',
    subject: '',
    type: 'newsletter' as const,
    audienceSegment: '',
    scheduledAt: '',
    template: '',
});

  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  // Fetch email campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['/api/email-marketing/campaigns', user?.id],
    queryFn: () => apiRequest(`/api/email-marketing/campaigns/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch email templates
  const { data: templates = [, ],} = useQuery({
    queryKey: ['/api/email-marketing/templates', getCurrentUserProfession()],
    queryFn: () =>
      apiRequest(`/api/email-marketing/templates?profession=${getCurrentUserProfession()}`),
    enabled: !!user?.d,
});

  // Fetch contact segments
  const { data: segments = [, ],} = useQuery({
    queryKey: ['/api/email-marketing/segments', user?.id],
    queryFn: () => apiRequest(`/api/email-marketing/segments/${user?.d}`),
    enabled: !!user?.d,
});

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/email-marketing/analytics', user?.id],
    queryFn: () => apiRequest(`/api/email-marketing/analytics/${user?.d}`),
    enabled: !!user?.d,
});

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/email-marketing/campaigns', {
        method: 'POS',
        body: JSON.stringify({ ...data, userId: user?.id }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/email-marketing/campaigns', ],
    });
      setCampaignDialog(false);
      setCampaignForm({
        name: '',
        subject: '',
        type: 'newsletter',
        audienceSegment: '',
        scheduledAt: ', ',
        template: ', ',
    });
  },
});

  // Update campaign status
  const updateCampaignStatus = useMutation({
    mutationFn: async ({ campaignd, status }: { campaignId: string; status: string }) =>
      apiRequest(`/api/email-marketing/campaigns/${campaignId}/status`, {
        method: 'PATC',
        body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/email-marketing/campaigns', ],
    });
  },
});

  // Send email campaign
  const sendCampaign = useMutation({
    mutationFn: async ({ campaignI, d,}: { campaignId: string }) => {
      setSendingProgress(true);
      setSendStatus({
        open: true,
        message: 'Sender email kampanje...',
        severity: 'info',
    });

      return apiRequest(`/api/email-marketing/campaigns/${campaignId}/send`, {
        method: 'POS',
        body: JSON.stringify({ userId: user?.id }),
    });
  },
    onSuccess: (data) => {
      setSendingProgress(false);
      setSendStatus({
        open: true,
        message: `Email kampanje sendt til ${data.sentCount || 0} mottakere!`,
        severity: 'success',
    });

      // Dispatch notification event for real-time updates
      window.dispatchEvent(
        new CustomEvent('emailCampaignSent', {
          detail: {
            campaignName: data.campaignName || 'Email kampanje',
            sentCount: data.sentCount || 0,
            targetCount: data.targetCount || 0,
            campaignId: data.campaignd,
        },
      }),
      );

      queryClient.invalidateQueries({
        queryKey: ['/api/email-marketing/campaigns', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/email-marketing/analytics', ],
    });
  },
    onError: (error) => {
      setSendingProgress(false);
      setSendStatus({
        open: true,
        message: 'Feil ved sending av email kampanje. Prøv igjen.',
        severity: 'error',
    });
      console.error('Send campaign error: ', error);
  },
});

  // Preview email template
  const previewEmail = useMutation({
    mutationFn: async ({ templateI, d,}: { templateId: string }) =>
      apiRequest(`/api/email-marketing/templates/${templateId}/preview`, {
        method: 'GE',
    }),
    onSuccess: (data) => {
      setPreviewCampaign(data);
      setPreviewDialog(true);
},
});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'info';
      case 'scheduled':
        return 'primary';
      default:
        return 'default';
}
};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayArrowIcon />;
      case 'paused':
        return <PauseIcon />;
      case 'completed':
        return <CheckCircleIcon />;
      case 'scheduled':
        return <ScheduleIcon />;
      case 'draft':
        return <DraftIcon />;
      default:
        return <EmailIcon />;
}
};

  const getCampaignTypeLabel = (type: string) => {
    const labels = {
      newsletter: 'Nyhetsbrev',
      automation: 'Automatisering',
      promotion: 'Kampanje',
      welcome: 'Velkommen',
      retention: 'Oppfølging',
  };
    return labels[type as keyof typeof labels] || type;
};

  const handleCreateCampaign = () => {
    if (!campaignForm.name || !campaignForm.subject || !campaignForm.audienceSegment) return;
    createCampaign.mutate(campaignForm);
};

  if (campaignsLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <LinearProgress />
        <Typography sx={{ mt:  2 }}>Laster email marketing...</Typography>
      </Box>
    );
}

  return (
    <Box sx={{ width: '100%'}}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Email Marketing
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="body2">
          Bygg sterke kundeforhold og øk salget som{', '}
          {getProfessionDisplayName(getCurrentUserProfession()).toLowerCase()}
          med automatiserte email-kampanjer og personalisert kommunikasjon.
        </Typography>
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Kampanjer" icon={<CampaignIcon />} />
          <Tab label="Maler" icon={<EmailIcon />} />
          <Tab label="Kontakter" icon={<PeopleIcon />} />
          <Tab label="Automatisering" icon={<AutoModeIcon />} />
          <Tab label="Analyse" icon={<AnalyticsIcon />} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Email Kampanjer</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCampaignDialog(true)}
          >
            Ny Kampanje
          </Button>
        </Box>

        <Grid container spacing={2}>
          {campaigns.map((campaign: EmailCampaign) => (
            <Grid item xs={12} key={campaign.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center" gap={2}>
                      {getStatusIcon(campaign.status)}
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{campaign.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {campaign.subject}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          <Chip
                            label={getCampaignTypeLabel(campaign.type)}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={campaign.status}
                            size="small"
                            color={getStatusColor(campaign.status) as any}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box display="flex" gap={1}>
                      {campaign.status === 'draft' && (
                        <>
                          <Tooltip title="Forhåndsvis email">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setPreviewCampaign(campaign);
                                setPreviewDialog(true);
                            }}
                            >
                              <PreviewIcon />
                            </IconButton>
                          </Tooltip>
                          <Button size="small"
                            variant="contained"
                            color="primary"
                            startIcon={
                              sendingProgress ? <CircularProgress size={16} sx={theming.getThemedButtonSx()}> : <SendIcon />
                          }
                            onClick={() => sendCampaign.mutate({ campaignId: campaign.id })}
                            disabled={sendingProgress || sendCampaign.isPending}
                          >
                            {sendingProgress ? 'Sender...' : 'Send'}
                          </Button>
                        </>
                      )}
                      {campaign.status === 'active' && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PauseIcon />}
                          onClick={() =>
                            updateCampaignStatus.mutate({
                              campaignId: campaign.d,
                              status: 'paused',
                          })
                        }
                        >
                          Pause
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PlayArrowIcon />}
                          onClick={() =>
                            updateCampaignStatus.mutate({
                              campaignId: campaign.d,
                              status: 'active',
                          })
                        }
                        >
                          Resume
                        </Button>
                      )}
                      <Tooltip title="Redigerer kampanje">
                        <IconButton size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {campaign.stats && (
                    <Box mt={2}>
                      <Grid container spacing={2}>
                        <Grid item xs={2} >
                          <Typography variant="caption" display="block">
                            Sendt
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {campaign.stats.sent.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={2} >
                          <Typography variant="caption" display="block">
                            Åpnet
                          </Typography>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {campaign.stats.opened.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {((campaign.stats.opened / campaign.stats.sent) * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={2} >
                          <Typography variant="caption" display="block">
                            Klikket
                          </Typography>
                          <Typography variant="h6" color="secondary" sx={{ color: theming.colors.primary }}>
                            {campaign.stats.clicked.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {((campaign.stats.clicked / campaign.stats.sent) * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={3} >
                          <Typography variant="caption" display="block">
                            Sist sendt
                          </Typography>
                          <Typography variant="body2">
                            {campaign.lastSentAt
                              ? new Date(campaign.lastSentAt).toLocaleDateString('no-NO')
                              : 'Ikke sendt'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Email Maler</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTemplateDialog(true)}
          >
            Ny Mal
          </Button>
        </Box>

        <Grid container spacing={3}>
          {templates.map((template: EmailTemplate) => (
            <Grid item xs={12} md={6} lg={4} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    height: 20,
                    overflow: 'hidden',
                    backgroundColor: 'grey.10'}}
                >
                  {template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'}}
                    />
                  ) : (
                    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                      <EmailIcon sx={{ fontSize:  48, color: 'grey.400'}} />
                    </Box>
                  )}
                </Box>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.subject}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <Chip label={template.category} size="small" variant="outlined" />
                    <Box>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                      <Button size="small" variant="contained" sx={theming.getThemedButtonSx()}>
                        Bruk
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kontakt Segmenter</Typography>
          <Box>
            <Button variant="outlined" startIcon={<PersonAddIcon />} sx={{ mr:  1 }}>
              Importer Kontakter
            </Button>
            <Button variant="contained"
              startIcon={<SegmentIcon />}
              onClick={() => setSegmentDialog(true)}
            >
              Nytt Segment
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {segments.map((segment: ContactSegment) => (
            <Grid item xs={12} md={6} key={segment.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{segment.name}</Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {segment.description}
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {segment.contactCount.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        kontakter
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small">
                        <FilterListIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="caption" display="block" mt={2}>
                    Sist oppdatert: {new Date(segment.lastUpdated).toLocaleDateString(', ')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Email Automatisering
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Velkommen Serie
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Automatisk velkommen-sekvens for nye kontakter
                </Typography>

                <Stepper orientation="vertical" sx={{ mt:  2 }}>
                  <Step active>
                    <StepLabel>Øyeblikkelig velkommen</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        Send velkommen email umiddelbart etter registrering
                      </Typography>
                    </StepContent>
                  </Step>
                  <Step active>
                    <StepLabel>Introduksjon (1 dag)</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        Introduser dine tjenester og portefølje
                      </Typography>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>Tilbud (3 dager)</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        Send personalisert tilbud basert på interesser
                      </Typography>
                    </StepContent>
                  </Step>
                </Stepper>

                <Box mt={2}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Aktiver automatisering"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Oppfølging Serie
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Re-engager inaktive kontakter
                </Typography>

                <Box mt={2}>
                  <Alert severity="info">
                    <Typography variant="body2">
                      Automatisk oppfølging av kontakter som ikke har åpnet emails på 30 dager.
                    </Typography>
                  </Alert>
                </Box>

                <Box mt={2}>
                  <FormControlLabel control={theming.getThemedIcon('switch')}} label="Aktiver oppfølging" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Email Marketing Analyse
        </Typography>

        {analytics && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {analytics.totalSent?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="caption">Totalt sendt</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                    {analytics.openRate || '0'}%
                  </Typography>
                  <Typography variant="caption">Åpningsrate</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                    {analytics.clickRate || '0'}%
                  </Typography>
                  <Typography variant="caption">Klikkrate</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                    {analytics.unsubscribeRate || '0'}%
                  </Typography>
                  <Typography variant="caption">Avmeldingsrate</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Create Campaign Dialog */}
      <Dialog
        open={campaignDialog}
        onClose={() => setCampaignDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Opprett Ny Email Kampanje</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                label="Kampanje Navn"
                fullWidth
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Email Emne"
                fullWidth
                value={campaignForm.subject}
                onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Kampanje Type</InputLabel>
                <Select
                  value={campaignForm.type}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      type: e.target.value as any,
                  })
                }
                >
                  <MenuItem value="newsletter">Nyhetsbrev</MenuItem>
                  <MenuItem value="promotion">Kampanje</MenuItem>
                  <MenuItem value="welcome">Velkommen</MenuItem>
                  <MenuItem value="retention">Oppfølging</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Målgruppe</InputLabel>
                <Select
                  value={campaignForm.audienceSegment}
                  onChange={(e) =>
                    setCampaignForm({
                      ...campaignForm,
                      audienceSegment: e.target.value,
                  })
                }
                >
                  {segments.map((segment: ContactSegment) => (
                    <MenuItem key={segment.d} value={segment.id}>
                      {segment.name} ({segment.contactCount} kontakter)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Planlagt Sending (valgfritt)"
                type="datetime-local"
                fullWidth
                value={campaignForm.scheduledAt}
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    scheduledAt: e.target.value,
                })
              }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDialog(false)}>Avbryt</Button>
          <Button onClick={handleCreateCampaign}
            variant="contained"
            disabled={createCampaign.isPending}
           sx={theming.getThemedButtonSx()}>
            Opprett Kampanje
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <PreviewIcon />
          Email Forhåndsvisning
          {previewCampaign && <Chip label={previewCampaign.type} size="small" sx={{ ml:  1 }} />}
        </DialogTitle>
        <DialogContent>
          {previewCampaign && (
            <Box>
              <Alert severity="info" sx={{ mb:  2 }}>
                <Typography variant="body2">
                  Forhåndsvisning av "{previewCampaign.name}" - dette er hvordan mottakerne vil se
                  emailen.
                </Typography>
              </Alert>

              <Paper sx={{ p: 2, border: '1px solid #e0e0e0', mb:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  {previewCampaign.subject}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Fra: CreatorHub Norge &lt;noreply@creatorhubn.com&gt;
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Til: Dine valgte kontakter ({previewCampaign.audienceSegment || 'Alle'})
                </Typography>
                <Divider sx={{ my:  2 }} />

                {previewCampaign.content ? (
                  <Box
                    dangerouslySetInnerHTML={{
                      __html: previewCampaign.content.html || '<p>Email innhold vil bli vist her...</p>'}}
                  />
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    Email mal vil bli lastet inn basert på valgt template...
                  </Typography>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Lukk</Button>
          {previewCampaign && previewCampaign.status === 'draft' && (
            <Button variant="contained"
              startIcon={<SendIcon />}
              onClick={() => {
                setPreviewDialog(false);
                sendCampaign.mutate({ campaignId: previewCampaign.id });
            }}
            >
              Send Nå
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Status Snackbar */}
      <Snackbar
        open={sendStatus.open}
        autoHideDuration={6000}
        onClose={() => setSendStatus({ ...sendStatus, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}}
      >
        <Alert
          onClose={() => setSendStatus({ ...sendStatus, open: false })}
          severity={sendStatus.severity}
          sx={{ width:'100%'}}
        >
          {sendStatus.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
