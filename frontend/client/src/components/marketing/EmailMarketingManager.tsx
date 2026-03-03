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
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoMode as AutoModeIcon,
  Campaign as CampaignIcon,
  CheckCircle as CheckCircleIcon,
  Drafts as DraftIcon,
  Email as EmailIcon,
  Pause as PauseIcon,
  People as PeopleIcon,
  PlayArrow as PlayArrowIcon,
  Preview as PreviewIcon,
  Schedule as ScheduleIcon,
  Segment as SegmentIcon,
  Send as SendIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

type CampaignType = 'newsletter' | 'automation' | 'promotion' | 'welcome' | 'retention';
type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';

interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
}

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  type: CampaignType;
  status: CampaignStatus;
  audienceSegment: string;
  createdAt: string;
  scheduledAt?: string;
  lastSentAt?: string;
  stats?: CampaignStats;
  content?: {
    html: string;
    text: string;
    previewText?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  previewText?: string;
  html?: string;
  text?: string;
  thumbnail?: string;
}

interface ContactSegment {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  lastUpdated: string;
}

interface MarketingAnalytics {
  totalSent: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
}

interface CampaignFormState {
  name: string;
  subject: string;
  type: CampaignType;
  audienceSegment: string;
  scheduledAt: string;
}

const emptyCampaignStats: CampaignStats = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  unsubscribed: 0,
  bounced: 0,
};

const initialCampaignForm: CampaignFormState = {
  name: '',
  subject: '',
  type: 'newsletter',
  audienceSegment: '',
  scheduledAt: '',
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function statusColor(status: CampaignStatus): ChipProps['color'] {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'scheduled':
      return 'primary';
    case 'completed':
      return 'info';
    case 'draft':
    default:
      return 'default';
  }
}

function statusIcon(status: CampaignStatus): React.ReactNode {
  switch (status) {
    case 'active':
      return <PlayArrowIcon color="success" />;
    case 'paused':
      return <PauseIcon color="warning" />;
    case 'scheduled':
      return <ScheduleIcon color="primary" />;
    case 'completed':
      return <CheckCircleIcon color="info" />;
    case 'draft':
    default:
      return <DraftIcon color="action" />;
  }
}

function campaignTypeLabel(type: CampaignType): string {
  switch (type) {
    case 'newsletter':
      return 'Nyhetsbrev';
    case 'automation':
      return 'Automatisering';
    case 'promotion':
      return 'Kampanje';
    case 'welcome':
      return 'Velkommen';
    case 'retention':
      return 'Oppfølging';
    default:
      return type;
  }
}

export default function EmailMarketingManager(): JSX.Element {
  const theming = useTheming('photographer');
  const { user } = useAuth();
  const { getCurrentUserProfession, getProfessionDisplayName } = useDynamicProfessions();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<EmailCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(initialCampaignForm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const campaignsQuery = useQuery({
    queryKey: ['/api/email-marketing/campaigns', user?.id],
    queryFn: async (): Promise<EmailCampaign[]> => {
      const data = await apiRequest(`/api/email-marketing/campaigns/${user?.id}`);
      return safeArray<EmailCampaign>(data);
    },
    enabled: Boolean(user?.id),
  });

  const templatesQuery = useQuery({
    queryKey: ['/api/email-marketing/templates', getCurrentUserProfession()],
    queryFn: async (): Promise<EmailTemplate[]> => {
      const data = await apiRequest(
        `/api/email-marketing/templates?profession=${encodeURIComponent(getCurrentUserProfession())}`,
      );
      return safeArray<EmailTemplate>(data);
    },
    enabled: Boolean(user?.id),
  });

  const segmentsQuery = useQuery({
    queryKey: ['/api/email-marketing/segments', user?.id],
    queryFn: async (): Promise<ContactSegment[]> => {
      const data = await apiRequest(`/api/email-marketing/segments/${user?.id}`);
      return safeArray<ContactSegment>(data);
    },
    enabled: Boolean(user?.id),
  });

  const analyticsQuery = useQuery({
    queryKey: ['/api/email-marketing/analytics', user?.id],
    queryFn: async (): Promise<MarketingAnalytics> => {
      const data = (await apiRequest(`/api/email-marketing/analytics/${user?.id}`)) as Partial<MarketingAnalytics>;
      return {
        totalSent: safeNumber(data.totalSent),
        openRate: safeNumber(data.openRate),
        clickRate: safeNumber(data.clickRate),
        unsubscribeRate: safeNumber(data.unsubscribeRate),
      };
    },
    enabled: Boolean(user?.id),
  });

  const createCampaign = useMutation({
    mutationFn: async (payload: CampaignFormState): Promise<void> => {
      await apiRequest('/api/email-marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          userId: user?.id,
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/email-marketing/campaigns', user?.id] });
      setCampaignDialogOpen(false);
      setCampaignForm(initialCampaignForm);
      setSnackbar({ open: true, message: 'Kampanje opprettet', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Kunne ikke opprette kampanje', severity: 'error' });
    },
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: string; status: CampaignStatus }): Promise<void> => {
      await apiRequest(`/api/email-marketing/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/email-marketing/campaigns', user?.id] });
    },
  });

  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string): Promise<void> => {
      await apiRequest(`/api/email-marketing/campaigns/${campaignId}/send`, {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/email-marketing/campaigns', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['/api/email-marketing/analytics', user?.id] }),
      ]);
      setSnackbar({ open: true, message: 'Kampanje sendt', severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: 'Kampanjesending feilet', severity: 'error' });
    },
  });

  const campaigns = campaignsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const segments = segmentsQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const busy = campaignsQuery.isLoading || templatesQuery.isLoading || segmentsQuery.isLoading;

  const activeAutomationSummary = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.type === 'automation' && campaign.status === 'active');
    return active.length;
  }, [campaigns]);

  const handleCreateCampaign = (): void => {
    if (!campaignForm.name.trim() || !campaignForm.subject.trim() || !campaignForm.audienceSegment.trim()) {
      setSnackbar({ open: true, message: 'Fyll ut navn, emne og målgruppe', severity: 'error' });
      return;
    }
    createCampaign.mutate(campaignForm);
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Email Marketing
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Bygg sterkere relasjoner og øk konvertering som{' '}
          {getProfessionDisplayName(getCurrentUserProfession()).toLowerCase()} med målrettede kampanjer.
        </Typography>
      </Alert>

      {(busy || createCampaign.isPending) && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
        <Tab icon={<CampaignIcon />} label="Kampanjer" />
        <Tab icon={<EmailIcon />} label="Maler" />
        <Tab icon={<PeopleIcon />} label="Segmenter" />
        <Tab icon={<AutoModeIcon />} label="Automatisering" />
        <Tab icon={<AnalyticsIcon />} label="Analyse" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Kampanjer
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCampaignDialogOpen(true)}>
              Ny kampanje
            </Button>
          </Box>

          <Grid container spacing={2}>
            {campaigns.map((campaign) => {
              const stats = campaign.stats ?? emptyCampaignStats;
              const openRate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0;
              const clickRate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0;

              return (
                <Grid item xs={12} key={campaign.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
                        <Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            {statusIcon(campaign.status)}
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              {campaign.name}
                            </Typography>
                            <Chip label={campaignTypeLabel(campaign.type)} variant="outlined" size="small" />
                            <Chip label={campaign.status} color={statusColor(campaign.status)} size="small" />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {campaign.subject}
                          </Typography>
                        </Box>

                        <Box display="flex" gap={1}>
                          <Button
                            size="small"
                            startIcon={<PreviewIcon />}
                            onClick={() => {
                              setPreviewCampaign(campaign);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            Preview
                          </Button>
                          {campaign.status === 'draft' && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<SendIcon />}
                              onClick={() => sendCampaign.mutate(campaign.id)}
                              disabled={sendCampaign.isPending}
                            >
                              Send
                            </Button>
                          )}
                          {campaign.status === 'active' && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<PauseIcon />}
                              onClick={() => updateCampaignStatus.mutate({ campaignId: campaign.id, status: 'paused' })}
                            >
                              Pause
                            </Button>
                          )}
                          {campaign.status === 'paused' && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<PlayArrowIcon />}
                              onClick={() => updateCampaignStatus.mutate({ campaignId: campaign.id, status: 'active' })}
                            >
                              Resume
                            </Button>
                          )}
                        </Box>
                      </Box>

                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Sendt
                          </Typography>
                          <Typography variant="h6">{stats.sent.toLocaleString('no-NO')}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Åpningsrate
                          </Typography>
                          <Typography variant="h6">{openRate.toFixed(1)}%</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Klikkrate
                          </Typography>
                          <Typography variant="h6">{clickRate.toFixed(1)}%</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="caption" color="text.secondary">
                            Sist sendt
                          </Typography>
                          <Typography variant="body2">
                            {campaign.lastSentAt
                              ? new Date(campaign.lastSentAt).toLocaleDateString('no-NO')
                              : 'Ikke sendt'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} md={6} lg={4} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {template.subject}
                  </Typography>
                  <Chip label={template.category} size="small" variant="outlined" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 2 && (
        <Grid container spacing={2}>
          {segments.map((segment) => (
            <Grid item xs={12} md={6} key={segment.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {segment.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {segment.description}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 1 }}>
                    {segment.contactCount.toLocaleString('no-NO')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sist oppdatert {new Date(segment.lastUpdated).toLocaleDateString('no-NO')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tab === 3 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Automatisering
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aktiv automatisering: {activeAutomationSummary}
            </Typography>

            <Stepper orientation="vertical">
              <Step active>
                <StepLabel>Velkommen</StepLabel>
                <StepContent>
                  <Typography variant="body2">Sendes ved registrering.</Typography>
                </StepContent>
              </Step>
              <Step active>
                <StepLabel>Oppfølging</StepLabel>
                <StepContent>
                  <Typography variant="body2">Sendes 48 timer etter første åpning.</Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Retention</StepLabel>
                <StepContent>
                  <Typography variant="body2">Sendes til inaktive kontakter etter 30 dager.</Typography>
                </StepContent>
              </Step>
            </Stepper>

            <Box mt={2}>
              <FormControlLabel control={<Switch defaultChecked />} label="Automatisering aktiv" />
              <FormControlLabel control={<Switch />} label="Smart sendetid" />
            </Box>
          </CardContent>
        </Card>
      )}

      {tab === 4 && analytics && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.totalSent.toLocaleString('no-NO')}</Typography>
                <Typography variant="caption">Totalt sendt</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.openRate.toFixed(1)}%</Typography>
                <Typography variant="caption">Åpningsrate</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.clickRate.toFixed(1)}%</Typography>
                <Typography variant="caption">Klikkrate</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h5">{analytics.unsubscribeRate.toFixed(2)}%</Typography>
                <Typography variant="caption">Avmeldingsrate</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={campaignDialogOpen} onClose={() => setCampaignDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Ny kampanje</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Kampanjenavn"
            margin="normal"
            value={campaignForm.name}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <TextField
            fullWidth
            label="Emne"
            margin="normal"
            value={campaignForm.subject}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, subject: event.target.value }))}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="campaign-type-label">Type</InputLabel>
            <Select
              labelId="campaign-type-label"
              label="Type"
              value={campaignForm.type}
              onChange={(event) => setCampaignForm((prev) => ({ ...prev, type: event.target.value as CampaignType }))}
            >
              <MenuItem value="newsletter">Nyhetsbrev</MenuItem>
              <MenuItem value="promotion">Kampanje</MenuItem>
              <MenuItem value="welcome">Velkommen</MenuItem>
              <MenuItem value="retention">Oppfølging</MenuItem>
              <MenuItem value="automation">Automatisering</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Målgruppe"
            margin="normal"
            value={campaignForm.audienceSegment}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, audienceSegment: event.target.value }))}
          />
          <TextField
            fullWidth
            label="Planlagt tid"
            margin="normal"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={campaignForm.scheduledAt}
            onChange={(event) => setCampaignForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateCampaign} disabled={createCampaign.isPending}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Preview</DialogTitle>
        <DialogContent>
          {previewCampaign ? (
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {previewCampaign.name}
              </Typography>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>
                {previewCampaign.subject}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {previewCampaign.content?.previewText ?? 'Ingen preview-tekst tilgjengelig.'}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen kampanje valgt.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
