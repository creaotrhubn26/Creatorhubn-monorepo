/**
 * Marketing Workflow Integration
 * Connects EmailDesigner, ContentCalendar, AnnouncementCreator, and Marketing Automation API
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Email as EmailIcon,
  Campaign as CampaignIcon,
  CalendarMonth as CalendarIcon,
  AutoAwesome as AutomateIcon,
  Send as SendIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import EmailDesigner from '../EmailDesigner/EmailDesigner';
import { AdminButton, adminTokens } from './design-system';

interface WorkflowIntegrationProps {
  open: boolean;
  onClose: () => void;
  initialData?: {
    type: 'announcement' | 'campaign' | 'calendar-event';
    data: any;
  };
  onComplete?: (result: any) => void;
}

interface WorkflowData {
  // Email Design
  emailTemplate?: any;
  emailSubject?: string;
  emailPreheader?: string;

  // Announcement
  announcementTitle?: string;
  announcementContent?: string;
  announcementCategory?: string;
  importance?: string;

  // Scheduling
  scheduledDate?: string;
  scheduledTime?: string;
  publishImmediately?: boolean;

  // Marketing Automation
  workflowId?: string;
  segmentIds?: string[];
  campaignId?: string;
  autoTrigger?: boolean;

  // Targeting
  targetProfessions?: string[];
  targetAudience?: string[];
  marketingPurpose?: string;
}

export default function MarketingWorkflowIntegration({
  open,
  onClose,
  initialData,
  onComplete,
}: WorkflowIntegrationProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    publishImmediately: false,
    autoTrigger: true,
    targetProfessions: [],
    segmentIds: [],
  });
  const [emailDesignerOpen, setEmailDesignerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const queryClient = useQueryClient();

  const steps = [
    'Innholdstype',
    'Design E-post',
    'Kunngjøring Detaljer',
    'Planlegging',
    'Automatisering',
    'Bekreft & Publiser',
  ];

  // Fetch marketing automation data
  const { data: workflows } = useQuery({
    queryKey: ['/api/marketing-automation/workflows', 'active'],
    queryFn: async () => {
      const response = await fetch('/api/marketing-automation/workflows?status=active');
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json();
    },
  });

  const { data: segments } = useQuery({
    queryKey: ['/api/marketing-automation/segments'],
    queryFn: async () => {
      const response = await fetch('/api/marketing-automation/segments?active=true');
      if (!response.ok) throw new Error('Failed to fetch segments');
      return response.json();
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ['/api/marketing-automation/campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/marketing-automation/campaigns?status=active');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
  });

  // Create complete marketing workflow
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: WorkflowData) => {
      // Step 1: Create email template if designed
      let emailTemplateId;
      if (data.emailTemplate) {
        const emailResponse = await fetch('/api/email-templates', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            name: data.announcementTitle || 'Marketing Email',
            subject: data.emailSubject,
            preheader: data.emailPreheader,
            template: data.emailTemplate,
          }),
        });
        const emailResult = await emailResponse.json();
        emailTemplateId = emailResult.id;
      }

      // Step 2: Create announcement
      let announcementId;
      if (data.announcementTitle && data.announcementContent) {
        const announcementResponse = await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            title: data.announcementTitle,
            content: data.announcementContent,
            category: data.announcementCategory || 'feature',
            importance: data.importance || 'medium',
            targetProfessions: data.targetProfessions,
            targetAudience: data.targetAudience,
            marketingPurpose: data.marketingPurpose,
            emailTemplateId,
            publishedAt: data.publishImmediately ? new Date().toISOString() : undefined,
          }),
        });
        const announcementResult = await announcementResponse.json();
        announcementId = announcementResult.announcement?.id;
      }

      // Step 3: Create calendar event
      if (data.scheduledDate && !data.publishImmediately) {
        await fetch('/api/content-calendar/events', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            title: data.announcementTitle || 'Marketing Campaign',
            event_type: 'announcement',
            scheduled_date: data.scheduledDate,
            scheduled_time: data.scheduledTime,
            status: 'ready',
            marketing_purpose: data.marketingPurpose,
            target_audience: data.targetAudience,
            metadata: {
              announcementId,
              emailTemplateId,
            },
          }),
        });
      }

      // Step 4: Create/trigger marketing automation workflow
      if (data.autoTrigger && data.workflowId) {
        await fetch(`/api/marketing-automation/workflows/${data.workflowId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            leadData: {
              announcementId,
              emailTemplateId,
              segments: data.segmentIds,
              targetProfessions: data.targetProfessions,
            },
          }),
        });
      }

      // Step 5: Add to email campaign if selected
      if (data.campaignId && emailTemplateId) {
        await fetch(`/api/marketing-automation/campaigns/${data.campaignId}/add-email`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            emailTemplateId,
            subject: data.emailSubject,
            sendDelay: data.publishImmediately ? 0 : undefined,
          }),
        });
      }

      return {
        success: true,
        announcementId,
        emailTemplateId,
        message: 'Marketing workflow opprettet!',
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/announcements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketing-automation'] });

      if (onComplete) {
        onComplete(result);
      }
    },
  });

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Final step - create workflow
      createWorkflowMutation.mutate(workflowData);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleEmailDesignComplete = (template: any) => {
    setWorkflowData((prev) => ({
      ...prev,
      emailTemplate: template,
    }));
    setEmailDesignerOpen(false);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        // Content Type Selection
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Velg innholdstype
            </Typography>
            <Grid container spacing={2}>
              {[
                {
                  type: 'announcement',
                  icon: <CampaignIcon />,
                  label: 'Kunngjøring',
                  description: 'Plattform-kunngjøring med e-post',
                },
                {
                  type: 'campaign',
                  icon: <EmailIcon />,
                  label: 'E-postkampanje',
                  description: 'Dedikert e-postmarkedsføring',
                },
                {
                  type: 'workflow',
                  icon: <AutomateIcon />,
                  label: 'Automatisert Workflow',
                  description: 'Multi-trinn automatisering',
                },
              ].map((item) => (
                <Grid item xs={12} md={4} key={item.type}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: 2,
                      borderColor: 'divider', '&:hover': {
                        borderColor: adminTokens.color.brand,
                      }}}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Box sx={{ color: adminTokens.color.brand, mb: 2 }}>{item.icon}</Box>
                      <Typography variant="h6">{item.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 1:
        // Email Design
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Design e-postmal
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Design din e-postmal med EmailDesigner. Denne vil brukes for kunngjøringen og
              kampanjen.
            </Alert>

            {workflowData.emailTemplate ? (
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center" gap={2}>
                      <CheckIcon color="success" />
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          E-postmal opprettet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {workflowData.emailSubject || 'Ingen emne enda'}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => setEmailDesignerOpen(true)}
                    >
                      Rediger
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <AdminButton
                tone="primary"
                startIcon={<EmailIcon />}
                onClick={() => setEmailDesignerOpen(true)}
              >
                Åpne E-postdesigner
              </AdminButton>
            )}

            <Box mt={3}>
              <TextField
                fullWidth
                label="E-post Emnelinje"
                value={workflowData.emailSubject || ''}
                onChange={(e) =>
                  setWorkflowData((prev) => ({ ...prev, emailSubject: e.target.value }))
                }
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Preheader Tekst"
                value={workflowData.emailPreheader || ''}
                onChange={(e) =>
                  setWorkflowData((prev) => ({ ...prev, emailPreheader: e.target.value }))
                }
              />
            </Box>
          </Box>
        );

      case 2:
        // Announcement Details
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Kunngjøring Detaljer
            </Typography>
            <TextField
              fullWidth
              label="Tittel"
              value={workflowData.announcementTitle || ''}
              onChange={(e) =>
                setWorkflowData((prev) => ({ ...prev, announcementTitle: e.target.value }))
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Innhold"
              value={workflowData.announcementContent || ', '}
              onChange={(e) =>
                setWorkflowData((prev) => ({ ...prev, announcementContent: e.target.value }))
              }
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={workflowData.announcementCategory || 'feature'}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({
                        ...prev,
                        announcementCategory: e.target.value,
                      }))
                    }
                  >
                    <MenuItem value="feature">Ny Funksjon</MenuItem>
                    <MenuItem value="update">Oppdatering</MenuItem>
                    <MenuItem value="maintenance">Vedlikehold</MenuItem>
                    <MenuItem value="tip">Tips</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Viktighet</InputLabel>
                  <Select
                    value={workflowData.importance || 'medium'}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({ ...prev, importance: e.target.value }))
                    }
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Middels</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="critical">Kritisk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        // Scheduling
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Planlegging
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={workflowData.publishImmediately}
                  onChange={(e) =>
                    setWorkflowData((prev) => ({ ...prev, publishImmediately: e.target.checked }))
                  }
                />
              }
              label="Publiser umiddelbart"
              sx={{ mb: 3 }}
            />

            {!workflowData.publishImmediately && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Planlagt Dato"
                    value={workflowData.scheduledDate || ', '}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Planlagt Tid"
                    value={workflowData.scheduledTime || ', '}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({ ...prev, scheduledTime: e.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            )}

            <Alert severity="info" sx={{ mt: 3 }}>
              {workflowData.publishImmediately
                ? 'Innholdet vil publiseres umiddelbart etter godkjenning.'
                : `Innholdet vil publiseres ${workflowData.scheduledDate || 'på valgt dato'}.`}
            </Alert>
          </Box>
        );

      case 4:
        // Marketing Automation
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Markedsføringsautomatisering
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={workflowData.autoTrigger}
                  onChange={(e) =>
                    setWorkflowData((prev) => ({ ...prev, autoTrigger: e.target.checked }))
                  }
                />
              }
              label="Aktiver automatisering"
              sx={{ mb: 3 }}
            />

            {workflowData.autoTrigger && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Velg Workflow</InputLabel>
                  <Select
                    value={workflowData.workflowId || ''}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({ ...prev, workflowId: e.target.value }))
                    }
                  >
                    {(Array.isArray(workflows?.data) ? workflows.data : []).map((workflow: any) => (
                      <MenuItem key={workflow.id} value={workflow.id}>
                        {workflow.name} - {workflow.description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Målgruppe Segmenter</InputLabel>
                  <Select
                    multiple
                    value={workflowData.segmentIds || []}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({
                        ...prev,
                        segmentIds:
                          typeof e.target.value === 'string'
                            ? e.target.value.split(', ')
                            : e.target.value,
                      }))
                    }
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {(Array.isArray(segments?.data) ? segments.data : []).map((segment: any) => (
                      <MenuItem key={segment.id} value={segment.id}>
                        {segment.name} ({segment.size} kontakter)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>E-postkampanje</InputLabel>
                  <Select
                    value={workflowData.campaignId || ''}
                    onChange={(e) =>
                      setWorkflowData((prev) => ({ ...prev, campaignId: e.target.value }))
                    }
                  >
                    <MenuItem value="">
                      <em>Ingen</em>
                    </MenuItem>
                    {(Array.isArray(campaigns?.data) ? campaigns.data : []).map((campaign: any) => (
                      <MenuItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.type})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Box>
        );

      case 5:
        // Confirmation
        return (
          <Box>
            <Typography variant="h6" component="h2" gutterBottom>
              Bekreft og Publiser
            </Typography>
            <Alert severity="success" sx={{ mb: 3 }}>
              Alt klart! Gjennomgå detaljene og klikk "Publiser" for å fullføre.
            </Alert>

            <List>
              <ListItem>
                <ListItemIcon>
                  <EmailIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="E-postmal"
                  secondary={
                    workflowData.emailTemplate
                      ? workflowData.emailSubject
                      : 'Ingen e-postmal opprettet'
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CampaignIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Kunngjøring"
                  secondary={workflowData.announcementTitle || 'Ingen tittel'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <ScheduleIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Publisering"
                  secondary={
                    workflowData.publishImmediately
                      ? 'Umiddelbart'
                      : `${workflowData.scheduledDate} kl ${workflowData.scheduledTime}`
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AutomateIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Automatisering"
                  secondary={
                    workflowData.autoTrigger ? 'Aktivert' : 'Deaktivert'
                  }
                />
              </ListItem>
            </List>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <CampaignIcon sx={{ color: adminTokens.color.brand }} aria-hidden="true" />
            <Typography variant="h6" component="h2">Marketing Workflow</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}

          {createWorkflowMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              En feil oppstod: {createWorkflowMutation.error?.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={onClose} disabled={createWorkflowMutation.isPending}>
            Avbryt
          </AdminButton>
          {activeStep > 0 && (
            <AdminButton tone="ghost" onClick={handleBack} disabled={createWorkflowMutation.isPending}>
              Tilbake
            </AdminButton>
          )}
          <AdminButton
            tone="primary"
            onClick={handleNext}
            loading={createWorkflowMutation.isPending}
            startIcon={
              activeStep === steps.length - 1 ? <SendIcon /> : undefined
            }
          >
            {activeStep === steps.length - 1 ? 'Publiser' : 'Neste'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Email Designer Dialog */}
      <Dialog
        open={emailDesignerOpen}
        onClose={() => setEmailDesignerOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>E-postdesigner</DialogTitle>
        <DialogContent>
          <EmailDesigner
            context="general"
            onSave={handleEmailDesignComplete}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
