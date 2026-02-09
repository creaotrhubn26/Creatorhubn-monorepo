// Client Communication Dashboard
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Email,
  Sms,
  Notifications,
  Schedule,
  Group,
  TrendingUp,
  Add,
  Edit,
  Delete,
  Send
} from '@mui/icons-material';
import { useClientCommunication } from '../../../hooks/useClientCommunication';

interface ClientCommunicationDashboardProps {
  onSettingsClick: () => void;
  onTemplatesClick: () => void;
  onSegmentsClick: () => void;
  onAutomationClick: () => void;
  onAnalyticsClick: () => void;
  onDeadlinesClick: () => void; 
}

const ClientCommunicationDashboard: React.FC<ClientCommunicationDashboardProps> = ({
  onSettingsClick,
  onTemplatesClick,
  onSegmentsClick,
  onAutomationClick,
  onAnalyticsClick,
  onDeadlinesClick
}) => {
  const {
    communications,
    templates,
    segments,
    loading,
    createCommunication,
    createTemplate,
    createSegment,
    getAnalytics
} = useClientCommunication();

  const [selectedView, setSelectedView] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState('overview');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'email',
    subject: '',
    content: ''
});
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    criteria: {}
});

  const analytics = getAnalytics();

  const handleCreateTemplate = () => {
    createTemplate(newTemplate);
    setTemplateDialogOpen(false);
    setNewTemplate({ name: '', type: 'email', subject: ',', content: ', ',});
};

  const handleCreateSegment = () => {
    createSegment(newSegment);
    setSegmentDialogOpen(false);
    setNewSegment({ name: ', ', description: ', ', criteria: {} });
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
            <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
              {analytics.totalCommunications}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total sent
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
            <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
              {analytics.openRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="textSecondary">
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
            <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
              {analytics.activeSegments}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Client groups
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
            <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
              {analytics.overdueDeadlines}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Overdue alerts
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Recent Communications</Typography>
              <Button
                startIcon={theming.getThemedIcon('add')}
                variant="outlined"
                size="small"
                onClick={() => setTemplateDialogOpen(true)}
              >
                New Template
              </Button>
            </Box>
            <List>
              {communications.slice(0, 5).map((comm: any) => (
                <ListItem key={comm.d}>
                  <ListItemText
                    primary={comm.subject || 'No Subject'}
                    secondary={`${comm.type} • ${comm.status} • ${new Date(comm.createdAt).toLocaleDateString()}`}
                  />
                  <Chip
                    label={comm.status}
                    color={comm.status === 'sent' ? 'success' : 'default'}
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
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Client Segments</Typography>
              <Button
                startIcon={theming.getThemedIcon('add')}
                variant="outlined"
                size="small"
                onClick={() => setSegmentDialogOpen(true)}
              >
                New Segment
              </Button>
            </Box>
            <List>
              {segments.map((segment: any) => (
                <ListItem key={segment.d}>
                  <ListItemText
                    primary={segment.name}
                    secondary={segment.description}
                  />
                  <Chip
                    label={`${segment.clients.length} clients`}
                    color="primary"
                    size="small"
                  />
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
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Communication Templates</Typography>
        <Button
          startIcon={theming.getThemedIcon('add')}
          variant="contained"
          onClick={() => setTemplateDialogOpen(true)}
          sx={theming.getThemedButtonSx()}
        >
          Create Template
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templates.map((template: any) => (
          <Grid item xs={2} md={6} lg={4} key={template.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                  <Box>
                    <IconButton size="small">
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                    <IconButton size="small" color="error">
                      {theming.getThemedIcon('delete')}
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  {template.description}
                </Typography>
                <Chip
                  label={template.type}
                  color="primary"
                  size="small"
                  sx={{ mr:  1 }}
                />
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
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Client Segments</Typography>
        <Button
          startIcon={theming.getThemedIcon('add')}
          variant="contained"
          onClick={() => setSegmentDialogOpen(true)}
          sx={theming.getThemedButtonSx()}
        >
          Create Segment
        </Button>
      </Box>

      <Grid container spacing={3}>
        {segments.map((segment: any) => (
          <Grid item xs={2} md={6} lg={4} key={segment.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{segment.name}</Typography>
                  <Box>
                    <IconButton size="small">
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                    <IconButton size="small" color="error">
                      {theming.getThemedIcon('delete')}
                    </IconButton>
                  </Box>
                </Box>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  {segment.description}
                </Typography>
                <Chip
                  label={`${segment.clients.length} clients`}
                  color="primary"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p:  3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>Client Communication</Typography>
        <Box>
          <Button
            startIcon={theming.getThemedIcon('email')}
            onClick={onTemplatesClick}
            sx={{ mr: 1 }}
          >
            Templates
          </Button>
          <Button
            startIcon={theming.getThemedIcon('group')}
            onClick={onSegmentsClick}
            sx={{ mr: 1 }}
          >
            Segments
          </Button>
          <Button
            startIcon={theming.getThemedIcon('schedule')}
            onClick={onDeadlinesClick}
            sx={{ mr: 1 }}
          >
            Deadlines
          </Button>
          <Button
            startIcon={theming.getThemedIcon('trendingUp')}
            onClick={onAnalyticsClick}
          >
            Analytics
          </Button>
        </Box>
      </Box>

      <Box mb={3}>
        <Button
          variant={selectedView === 'overview' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('overview')}
          sx={{ mr:  1 }}
        >
          Overview
        </Button>
        <Button
          variant={selectedView === 'templates' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('templates')}
          sx={{ mr:  1 }}
        >
          Templates
        </Button>
        <Button
          variant={selectedView === 'segments' ? 'contained' : 'outlined'}
          onClick={() => setSelectedView('segments')}
        >
          Segments
        </Button>
      </Box>

      {selectedView === 'overview' && renderOverview()}
      {selectedView === 'templates' && renderTemplates()}
      {selectedView ==='segments' && renderSegments()}

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Communication Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, type: e.target.value }))}
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="push">Push Notification</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={newTemplate.subject}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Content"
                value={newTemplate.content}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTemplate} variant="contained" sx={theming.getThemedButtonSx()}>
            Create Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Segment Dialog */}
      <Dialog open={segmentDialogOpen} onClose={() => setSegmentDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Client Segment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Segment Name"
                value={newSegment.name}
                onChange={(e) => setNewSegment(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={newSegment.description}
                onChange={(e) => setNewSegment(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSegmentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateSegment} variant="contained" sx={theming.getThemedButtonSx()}>
            Create Segment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientCommunicationDashboard;




