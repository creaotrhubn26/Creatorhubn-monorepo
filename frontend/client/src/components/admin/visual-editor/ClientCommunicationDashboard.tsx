import React, { useEffect, useMemo, useState } from 'react';
import {
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
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Email,
  Group,
  Notifications,
  Schedule,
  Send,
  Sms,
  TrendingUp,
} from '@mui/icons-material';
import { useClientCommunication } from '../../../hooks/useClientCommunication';
import { useTheming } from '../../../utils/theming-helper';
import type {
  ClientCommunication,
  ClientSegment,
  CommunicationTemplate,
} from '../../../utils/clientCommunicationManager';

interface ClientCommunicationDashboardProps {
  onSettingsClick: () => void;
  onTemplatesClick: () => void;
  onSegmentsClick: () => void;
  onAutomationClick: () => void;
  onAnalyticsClick: () => void;
  onDeadlinesClick: () => void;
}

type DashboardView = 'overview' | 'templates' | 'segments';
type CommunicationChannel = ClientCommunication['type'];

interface CommunicationAnalytics {
  totalCommunications: number;
  openRate: number;
  activeSegments: number;
  overdueDeadlines: number;
}

const emptyTemplate = (): {
  id: string | null;
  name: string;
  type: CommunicationTemplate['type'];
  subject: string;
  content: string;
  isActive: boolean;
} => ({
  id: null,
  name: '',
  type: 'welcome',
  subject: '',
  content: '',
  isActive: true,
});

const emptySegment = (): {
  id: string | null;
  name: string;
  description: string;
  criteria: ClientSegment['criteria'];
} => ({
  id: null,
  name: '',
  description: '',
  criteria: {},
});

const emptyCommunication = (): {
  clientId: string;
  projectId: string;
  template: string;
  subject: string;
  content: string;
  priority: ClientCommunication['metadata']['priority'];
  scheduledFor: string;
} => ({
  clientId: 'manual-client',
  projectId: '',
  template: '',
  subject: '',
  content: '',
  priority: 'medium',
  scheduledFor: '',
});

const ClientCommunicationDashboard: React.FC<ClientCommunicationDashboardProps> = ({
  onSettingsClick,
  onTemplatesClick,
  onSegmentsClick,
  onAutomationClick,
  onAnalyticsClick,
  onDeadlinesClick,
}) => {
  const {
    communications,
    templates,
    segments,
    loading,
    createCommunication,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createSegment,
    updateSegment,
    deleteSegment,
    getAnalytics,
  } = useClientCommunication();

  const theming = useTheming('prototype_tester');

  const [selectedView, setSelectedView] = useState<DashboardView>('overview');
  const [activeTab, setActiveTab] = useState<CommunicationChannel>('email');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [communicationDialogOpen, setCommunicationDialogOpen] = useState(false);
  const [sendImmediately, setSendImmediately] = useState(true);
  const [newTemplate, setNewTemplate] = useState(emptyTemplate);
  const [newSegment, setNewSegment] = useState(emptySegment);
  const [newCommunication, setNewCommunication] = useState(emptyCommunication);

  useEffect(() => {
    if (!newCommunication.template && templates[0]) {
      setNewCommunication((current) => ({ ...current, template: templates[0].id }));
    }
  }, [newCommunication.template, templates]);

  const analytics = useMemo<CommunicationAnalytics>(() => {
    const data = getAnalytics();

    return {
      totalCommunications:
        typeof data.totalCommunications === 'number' ? data.totalCommunications : 0,
      openRate: typeof data.openRate === 'number' ? data.openRate : 0,
      activeSegments: typeof data.activeSegments === 'number' ? data.activeSegments : 0,
      overdueDeadlines:
        typeof data.overdueDeadlines === 'number' ? data.overdueDeadlines : 0,
    };
  }, [getAnalytics]);

  const communicationItems = communications;
  const templateItems = templates;
  const segmentItems = segments;

  const getCommunicationStatusColor = (
    status: ClientCommunication['status'],
  ): ChipProps['color'] => {
    if (status === 'sent' || status === 'delivered' || status === 'opened' || status === 'clicked') {
      return 'success';
    }
    if (status === 'failed') {
      return 'error';
    }
    return 'default';
  };

  const handleOpenTemplates = () => {
    setSelectedView('templates');
    onTemplatesClick();
  };

  const handleOpenSegments = () => {
    setSelectedView('segments');
    onSegmentsClick();
  };

  const openTemplateDialog = (template?: CommunicationTemplate) => {
    if (template) {
      setNewTemplate({
        id: template.id,
        name: template.name,
        type: template.type,
        subject: template.content.subject,
        content: template.content.body,
        isActive: template.isActive,
      });
    } else {
      setNewTemplate(emptyTemplate());
    }

    setTemplateDialogOpen(true);
  };

  const openSegmentDialog = (segment?: ClientSegment) => {
    if (segment) {
      setNewSegment({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        criteria: segment.criteria,
      });
    } else {
      setNewSegment(emptySegment());
    }

    setSegmentDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.content.trim()) {
      return;
    }

    const payload = {
      name: newTemplate.name.trim(),
      description: newTemplate.subject.trim() || 'Custom communication template',
      type: newTemplate.type,
      trigger: {
        event: 'custom' as const,
        conditions: {},
      },
      channels: [activeTab],
      content: {
        subject: newTemplate.subject.trim(),
        body: newTemplate.content.trim(),
        variables: [],
      },
      isActive: newTemplate.isActive,
    };

    if (newTemplate.id) {
      updateTemplate(newTemplate.id, payload);
    } else {
      createTemplate(payload);
    }

    setTemplateDialogOpen(false);
    setNewTemplate(emptyTemplate());
    handleOpenTemplates();
  };

  const handleDeleteTemplate = (templateId: string) => {
    const shouldDelete = window.confirm('Delete this communication template?');
    if (!shouldDelete) return;

    deleteTemplate(templateId);
  };

  const handleSaveSegment = () => {
    if (!newSegment.name.trim()) {
      return;
    }

    const payload = {
      name: newSegment.name.trim(),
      description: newSegment.description.trim(),
      criteria: newSegment.criteria,
      clients: [],
    };

    if (newSegment.id) {
      updateSegment(newSegment.id, payload);
    } else {
      createSegment(payload);
    }

    setSegmentDialogOpen(false);
    setNewSegment(emptySegment());
    handleOpenSegments();
  };

  const handleDeleteSegment = (segmentId: string) => {
    const shouldDelete = window.confirm('Delete this client segment?');
    if (!shouldDelete) return;

    deleteSegment(segmentId);
  };

  const handleCreateCommunication = () => {
    if (!newCommunication.subject.trim() || !newCommunication.content.trim()) {
      return;
    }

    const scheduledFor = sendImmediately
      ? new Date()
      : new Date(newCommunication.scheduledFor || Date.now());

    createCommunication({
      clientId: newCommunication.clientId.trim() || 'manual-client',
      projectId: newCommunication.projectId.trim() || undefined,
      type: activeTab,
      template: newCommunication.template || 'manual-template',
      subject: newCommunication.subject.trim(),
      content: newCommunication.content.trim(),
      scheduledFor,
      status: sendImmediately ? 'sent' : 'pending',
      metadata: {
        variables: {},
        priority: newCommunication.priority,
        channel: activeTab,
      },
      sentAt: sendImmediately ? new Date() : undefined,
    });

    setCommunicationDialogOpen(false);
    setSendImmediately(true);
    setNewCommunication(emptyCommunication());
    setSelectedView('overview');
  };

  const renderOverview = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Email color="primary" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Communications
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary }}>
              {analytics.totalCommunications}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total sent or scheduled
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <TrendingUp color="success" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Open Rate
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary }}>
              {analytics.openRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Email engagement
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Group color="info" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Segments
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary }}>
              {analytics.activeSegments}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active client groups
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" alignItems="center" mb={2}>
              <Schedule color="warning" />
              <Typography variant="h6" ml={1} sx={{ color: theming.colors.primary }}>
                Deadlines
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theming.colors.primary }}>
              {analytics.overdueDeadlines}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overdue alerts
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Recent Communications
              </Typography>
              <Button
                startIcon={<Send />}
                variant="outlined"
                size="small"
                onClick={() => setCommunicationDialogOpen(true)}
                disabled={loading}
              >
                Compose
              </Button>
            </Box>
            <List>
              {communicationItems.slice(0, 5).map((communication) => (
                <ListItem key={communication.id}>
                  <ListItemText
                    primary={communication.subject || 'No Subject'}
                    secondary={`${communication.type} • ${communication.status} • ${new Date(communication.createdAt).toLocaleDateString()}`}
                  />
                  <Chip
                    label={communication.status}
                    color={getCommunicationStatusColor(communication.status)}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Client Segments
              </Typography>
              <Button
                startIcon={<Add />}
                variant="outlined"
                size="small"
                onClick={() => openSegmentDialog()}
                disabled={loading}
              >
                New Segment
              </Button>
            </Box>
            <List>
              {segmentItems.map((segment) => (
                <ListItem key={segment.id}>
                  <ListItemText primary={segment.name} secondary={segment.description} />
                  <Chip label={`${segment.clients.length} clients`} color="primary" size="small" />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderTemplates = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>
          Communication Templates
        </Typography>
        <Button
          startIcon={<Add />}
          variant="contained"
          onClick={() => openTemplateDialog()}
          sx={theming.getThemedButtonSx()}
          disabled={loading}
        >
          Create Template
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templateItems.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Box>
                    <IconButton size="small" onClick={() => openTemplateDialog(template)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(template.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {template.description}
                </Typography>
                <Chip label={template.type} color="primary" size="small" sx={{ mr: 1 }} />
                <Chip
                  label={template.isActive ? 'Active' : 'Inactive'}
                  color={template.isActive ? 'success' : 'default'}
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderSegments = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>
          Client Segments
        </Typography>
        <Button
          startIcon={<Add />}
          variant="contained"
          onClick={() => openSegmentDialog()}
          sx={theming.getThemedButtonSx()}
          disabled={loading}
        >
          Create Segment
        </Button>
      </Box>

      <Grid container spacing={3}>
        {segmentItems.map((segment) => (
          <Grid item xs={12} md={6} lg={4} key={segment.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {segment.name}
                  </Typography>
                  <Box>
                    <IconButton size="small" onClick={() => openSegmentDialog(segment)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteSegment(segment.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {segment.description}
                </Typography>
                <Chip label={`${segment.clients.length} clients`} color="primary" size="small" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={1}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>
          Client Communication
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Button startIcon={<Email />} onClick={handleOpenTemplates}>
            Templates
          </Button>
          <Button startIcon={<Group />} onClick={handleOpenSegments}>
            Segments
          </Button>
          <Button startIcon={<Schedule />} onClick={onDeadlinesClick}>
            Deadlines
          </Button>
          <Button startIcon={<TrendingUp />} onClick={onAnalyticsClick}>
            Analytics
          </Button>
          <Button startIcon={<Notifications />} onClick={onAutomationClick}>
            Automation
          </Button>
          <Button variant="contained" startIcon={<Edit />} onClick={onSettingsClick} sx={theming.getThemedButtonSx()}>
            Settings
          </Button>
        </Box>
      </Box>

      <Box mb={3} display="flex" gap={1} flexWrap="wrap" alignItems="center">
        <Button
          variant={selectedView === 'overview' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('overview')}
          sx={selectedView === 'overview' ? theming.getThemedButtonSx() : undefined}
        >
          Overview
        </Button>
        <Button
          variant={selectedView === 'templates' ? 'contained' : 'outlined'}
          onClick={handleOpenTemplates}
          sx={selectedView === 'templates' ? theming.getThemedButtonSx() : undefined}
        >
          Templates
        </Button>
        <Button
          variant={selectedView === 'segments' ? 'contained' : 'outlined'}
          onClick={handleOpenSegments}
          sx={selectedView === 'segments' ? theming.getThemedButtonSx() : undefined}
        >
          Segments
        </Button>
        <Chip label={loading ? 'Syncing…' : 'Live data ready'} color={loading ? 'warning' : 'success'} size="small" />
      </Box>

      {selectedView === 'overview' && renderOverview()}
      {selectedView === 'templates' && renderTemplates()}
      {selectedView === 'segments' && renderSegments()}

      <Dialog open={communicationDialogOpen} onClose={() => setCommunicationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Compose Communication</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Button
              variant={activeTab === 'email' ? 'contained' : 'outlined'}
              startIcon={<Email />}
              onClick={() => setActiveTab('email')}
              sx={activeTab === 'email' ? theming.getThemedButtonSx() : undefined}
            >
              Email
            </Button>
            <Button
              variant={activeTab === 'sms' ? 'contained' : 'outlined'}
              startIcon={<Sms />}
              onClick={() => setActiveTab('sms')}
              sx={activeTab === 'sms' ? theming.getThemedButtonSx() : undefined}
            >
              SMS
            </Button>
            <Button
              variant={activeTab === 'push' ? 'contained' : 'outlined'}
              startIcon={<Notifications />}
              onClick={() => setActiveTab('push')}
              sx={activeTab === 'push' ? theming.getThemedButtonSx() : undefined}
            >
              Push
            </Button>
          </Box>

          <FormControl fullWidth>
            <InputLabel id="communication-template-label">Template</InputLabel>
            <Select
              labelId="communication-template-label"
              label="Template"
              value={newCommunication.template}
              onChange={(event) =>
                setNewCommunication((current) => ({ ...current, template: event.target.value }))
              }
            >
              {templateItems.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Client Id"
                value={newCommunication.clientId}
                onChange={(event) =>
                  setNewCommunication((current) => ({ ...current, clientId: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Project Id"
                value={newCommunication.projectId}
                onChange={(event) =>
                  setNewCommunication((current) => ({ ...current, projectId: event.target.value }))
                }
              />
            </Grid>
          </Grid>

          <TextField
            fullWidth
            label="Subject"
            value={newCommunication.subject}
            onChange={(event) =>
              setNewCommunication((current) => ({ ...current, subject: event.target.value }))
            }
          />

          <TextField
            fullWidth
            multiline
            rows={5}
            label="Message"
            value={newCommunication.content}
            onChange={(event) =>
              setNewCommunication((current) => ({ ...current, content: event.target.value }))
            }
          />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="communication-priority-label">Priority</InputLabel>
                <Select
                  labelId="communication-priority-label"
                  label="Priority"
                  value={newCommunication.priority}
                  onChange={(event) =>
                    setNewCommunication((current) => ({
                      ...current,
                      priority: event.target.value as ClientCommunication['metadata']['priority'],
                    }))
                  }
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Scheduled For"
                InputLabelProps={{ shrink: true }}
                disabled={sendImmediately}
                value={newCommunication.scheduledFor}
                onChange={(event) =>
                  setNewCommunication((current) => ({
                    ...current,
                    scheduledFor: event.target.value,
                  }))
                }
              />
            </Grid>
          </Grid>

          <FormControlLabel
            control={
              <Switch
                checked={sendImmediately}
                onChange={(event) => setSendImmediately(event.target.checked)}
              />
            }
            label={sendImmediately ? 'Send immediately' : 'Schedule for later'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommunicationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCommunication} variant="contained" startIcon={<Send />} sx={theming.getThemedButtonSx()}>
            Send Communication
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{newTemplate.id ? 'Edit Communication Template' : 'Create Communication Template'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={newTemplate.name}
                onChange={(event) =>
                  setNewTemplate((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="template-type-label">Type</InputLabel>
                <Select
                  labelId="template-type-label"
                  label="Type"
                  value={newTemplate.type}
                  onChange={(event) =>
                    setNewTemplate((current) => ({
                      ...current,
                      type: event.target.value as CommunicationTemplate['type'],
                    }))
                  }
                >
                  <MenuItem value="welcome">Welcome</MenuItem>
                  <MenuItem value="project_update">Project Update</MenuItem>
                  <MenuItem value="proof_ready">Proof Ready</MenuItem>
                  <MenuItem value="deadline_reminder">Deadline Reminder</MenuItem>
                  <MenuItem value="delivery">Delivery</MenuItem>
                  <MenuItem value="follow_up">Follow Up</MenuItem>
                  <MenuItem value="payment_reminder">Payment Reminder</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={newTemplate.subject}
                onChange={(event) =>
                  setNewTemplate((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Content"
                value={newTemplate.content}
                onChange={(event) =>
                  setNewTemplate((current) => ({ ...current, content: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newTemplate.isActive}
                    onChange={(event) =>
                      setNewTemplate((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                }
                label={newTemplate.isActive ? 'Template active' : 'Template inactive'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained" sx={theming.getThemedButtonSx()}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={segmentDialogOpen} onClose={() => setSegmentDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{newSegment.id ? 'Edit Client Segment' : 'Create Client Segment'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Segment Name"
                value={newSegment.name}
                onChange={(event) =>
                  setNewSegment((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={newSegment.description}
                onChange={(event) =>
                  setNewSegment((current) => ({ ...current, description: event.target.value }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSegmentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSegment} variant="contained" sx={theming.getThemedButtonSx()}>
            Save Segment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientCommunicationDashboard;
