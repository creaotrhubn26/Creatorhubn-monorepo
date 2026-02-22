import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface PrivacySetting {
  id: string;
  name: string;
  description: string;
  category: 'data_collection' | 'analytics' | 'sharing' | 'retention' | 'consent';
  enabled: boolean;
  required: boolean;
  level: 'basic' | 'enhanced' | 'maximum';
  dataTypes: string[]
}

interface ConsentRecord {
  id: string;
  userId: string;
  settingId: string;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress: string;
  userAgent: string
}

interface DataRequest {
  id: string;
  userId: string;
  type: 'access' | 'portability' | 'deletion' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  submitted: Date;
  completed?: Date;
  description: string
}

interface PrivacyControlsProps {
  className?: string;
  onSettingChange?: (setting: PrivacySetting) => void;
  onConsentChange?: (consent: ConsentRecord) => void;
  onDataRequestChange?: (request: DataRequest) => void;
  onPrivacyExport?: (data: { settings: PrivacySetting[], consents: ConsentRecord[], requests: DataRequest[, ],}) => void;
}

// Mock data
const defaultSettings: PrivacySetting[] = [
  {
    id: 'analytics-basic',
    name: 'Basic Analytics',
    description: 'Collect basic usage statistics and performance metrics',
    category: 'analytics',
    enabled: true,
    required: false,
    level: 'basic',
    dataTypes: ['page_views','session_duration','device_type']
},
  {
    id: 'analytics-enhanced',
    name: 'Enhanced Analytics',
    description: 'Collect detailed user behavior and interaction data',
    category: 'analytics',
    enabled: false,
    required: false,
    level: 'enhanced',
    dataTypes: ['click_events','scroll_behavior','form_interactions','heatmaps']
},
  {
    id: 'data-sharing',
    name: 'Data Sharing',
    description: 'Share anonymized data with third-party services',
    category: 'sharing',
    enabled: false,
    required: false,
    level: 'basic',
    dataTypes: ['anonymized_usage','aggregated_metrics']
},
  {
    id: 'data-retention',
    name: 'Data Retention',
    description: 'Retain user data for extended periods',
    category: 'retention',
    enabled: true,
    required: true,
    level: 'basic',
    dataTypes: ['user_profiles','content_data','interaction_history']
},
  {
    id: 'cookies-essential',
    name: 'Essential Cookies',
    description: 'Required cookies for basic functionality',
    category: 'consent',
    enabled: true,
    required: true,
    level: 'basic',
    dataTypes: ['session_cookies','security_cookies']
},
  {
    id: 'cookies-analytics',
    name: 'Analytics Cookies',
    description: 'Optional cookies for analytics and personalization',
    category: 'consent',
    enabled: false,
    required: false,
    level: 'enhanced',
    dataTypes: ['analytics_cookies','preference_cookies']
}
];

const defaultConsents: ConsentRecord[] = [
  {
    id: 'consent',
    userId: 'user',
    settingId: 'analytics-basic',
    granted: true,
    timestamp: new Date('2024-01-15', ),
    version: '1.',
    ipAddress: '192.168.1.',
    userAgent: 'Mozilla/5.0...'
},
  {
    id: 'consent',
    userId: 'user',
    settingId: 'data-sharing',
    granted: false,
    timestamp: new Date('2024-01-14,', ),
    version: '1.',
    ipAddress: '192.168.1.',
    userAgent: 'Mozilla/5.0...'
}
];

const defaultRequests: DataRequest[] = [
  {
    id: 'req',
    userId: 'user',
    type: 'access',
    status: 'completed',
    submitted: new Date('2024-01-10,', ),
    completed: new Date('2024-01-12', ),
    description: 'Request for personal data access'
},
  {
    id: 'req',
    userId: 'user',
    type: 'deletion',
    status: 'processing',
    submitted: new Date('2024-01-13', ),
    description: 'Request for account deletion'
}
];

const PrivacyControls: React.FC<PrivacyControlsProps> = ({
  className =', ',
  onSettingChange,
  onConsentChange,
  onDataRequestChange,
  onPrivacyExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedSetting, setSelectedSetting] = useState<PrivacySetting | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DataRequest | null>(null);
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [settings, setSettings] = useState<PrivacySetting[]>(defaultSettings);
  const [consents, setConsents] = useState<ConsentRecord[]>(defaultConsents);
  const [requests, setRequests] = useState<DataRequest[]>(defaultRequests);
  const [privacyScore, setPrivacyScore] = useState(85);

  // Handlers
  const handleSettingSelect = useCallback((setting: PrivacySetting) => {
    setSelectedSetting(setting);
    onSettingChange?.(setting);
}, [onSettingChange]);

  const handleRequestSelect = useCallback((request: DataRequest) => {
    setSelectedRequest(request);
    setShowRequestDialog(true);
}, []);

  const handleSettingEdit = useCallback((setting: PrivacySetting) => {
    setSelectedSetting(setting);
    setShowSettingEditor(true);
}, []);

  const handleSettingSave = useCallback(() => {
    if (selectedSetting) {
      const existingIndex = settings.findIndex(s => s.id === selectedSetting.id);
      if (existingIndex >= 0) {
        setSettings(prev => prev.map((s, i) => i === existingIndex ? selectedSetting : s));
    } else {
        setSettings(prev => [...prev, selectedSetting]);
    }
      setShowSettingEditor(false);
  }
}, [selectedSetting, settings]);

  const handleSettingToggle = useCallback((settingId: string, enabled: boolean) => {
    setSettings(prev => prev.map(s => 
      s.id === settingId ? { .., .enabled } : s
    ));
}, []);

  const handleRequestStatusChange = useCallback((requestId: string, status: DataRequest['status']) => {
    setRequests(prev => prev.map(r => 
      r.id === requestId ? { .., .status, completed: status === 'completed' ? new Date() : undefined } : r
    ));
}, []);

  const handlePrivacyExport = useCallback(() => {
    onPrivacyExport?.({ settings, consents, requests });
}, [settings, consents, requests, onPrivacyExport]);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'data_collection': return <CREATOR_HUB_ICONS.collect />;
      case 'analytics': return <CREATOR_HUB_ICONS.analytics />;
      case 'sharing': return <CREATOR_HUB_ICONS.share />;
      case 'retention': return <CREATOR_HUB_ICONS.storage />;
      case 'consent': return <CREATOR_HUB_ICONS.checkCircle />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getLevelColor = useCallback((level: string) => {
    switch (level) {
      case 'basic': return 'success';
      case 'enhanced': return 'warning';
      case 'maximum': return 'error';
      default: return 'default';
}
}, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'pending': return <CREATOR_HUB_ICONS.schedule />;
      case 'processing': return <CREATOR_HUB_ICONS.refresh />;
      case 'completed': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'rejected': return <CREATOR_HUB_ICONS.error />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'completed': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
}
}, []);

  const getRequestTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'access': return <CREATOR_HUB_ICONS.visibility />;
      case 'portability': return <CREATOR_HUB_ICONS.download />;
      case 'deletion': return <CREATOR_HUB_ICONS.delete />;
      case 'rectification': return <CREATOR_HUB_ICONS.edit />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized data
  const privacyStats = useMemo(() => {
    const totalSettings = settings.length;
    const enabledSettings = settings.filter(s => s.enabled).length;
    const requiredSettings = settings.filter(s => s.required).length;
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    
    return { totalSettings, enabledSettings, requiredSettings, totalRequests, pendingRequests };
}, [settings, requests]);

  const consentStats = useMemo(() => {
    const totalConsents = consents.length;
    const grantedConsents = consents.filter(c => c.granted).length;
    const deniedConsents = totalConsents - grantedConsents;
    
    return { totalConsents, grantedConsents, deniedConsents };
}, [consents]);

  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'Privacy setting updated', setting: 'Analytics', timestamp: new Date(), type: 'setting',},
      { id: 2, action: 'Data request submitted', request: 'Access request', timestamp: new Date(), type: 'request',},
      { id:  3, action: 'Consent granted', setting: 'Data sharing', timestamp: new Date(), type: 'consent',},
    ];
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.privacy sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Privacy Controls</Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive privacy and data protection management
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedSetting({
                  id: `setting-${Date.now()}`,
                  name: 'New Setting',
                  description: 'Custom privacy setting',
                  category: 'data_collection',
                  enabled: false,
                  required: false,
                  level: 'basic',
                  dataTypes: []
            });
                setShowSettingEditor(true);
            }}
            >
              New Setting
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={handlePrivacyExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Privacy Score */}
      <Paper elevation={1} sx={{ p: 2, mb: 3, background: 'linear-gradient(45deg, #1976d2, #42a5f5)' ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" color="white" sx={{ color: theming.colors.primary }}>
              Privacy Score: {privacyScore}%
            </Typography>
            <Typography variant="body2" color="rgba(255,255,255,0.8)">
              Based on current privacy settings and compliance
            </Typography>
          </Box>
          <Box sx={{ width: 10, height: 100}}>
            <LinearProgress
              variant="determinate"
              value={privacyScore}
              sx={{ height:  8, borderRadius:  4, backgroundColor: 'rgba(25,255,255,0.3)' }}
            />
          </Box>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.settings sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{privacyStats.totalSettings}</Typography>
                  <Typography variant="body2" color="text.secondary">Privacy Settings</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{consentStats.grantedConsents}</Typography>
                  <Typography variant="body2" color="text.secondary">Consents Granted</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.schedule sx={{ fontSize:  40, color: 'warning.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{privacyStats.pendingRequests}</Typography>
                  <Typography variant="body2" color="text.secondary">Pending Requests</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.security sx={{ fontSize:  40, color: 'info.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{privacyStats.requiredSettings}</Typography>
                  <Typography variant="body2" color="text.secondary">Required Settings</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Settings" icon={<CREATOR_HUB_ICONS.settings />} />
        <Tab label="Consents" icon={<CREATOR_HUB_ICONS.checkCircle />} />
        <Tab label="Data Requests" icon={<CREATOR_HUB_ICONS.schedule />} />
        <Tab label="Activity" icon={<CREATOR_HUB_ICONS.history />} />
      </Tabs>

      {/* Settings Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {settings.map((setting) => (
            <Grid item xs={12} sm={6} md={4} key={setting.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedSetting?.id === setting.id ? 2 : 0,
                  borderColor: selectedSetting?.id === setting.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleSettingSelect(setting)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getCategoryIcon(setting.category)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {setting.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {setting.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={setting.category.replace('_', ', ')}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          label={setting.level}
                          size="small" 
                          color={getLevelColor(setting.level) as any}
                        />
                        {setting.required && (
                          <Chip 
                            label="Required" 
                            size="small" 
                            color="error"
                          />
                        )}
                      </Stack>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Data Types: {setting.dataTypes.join(', ')}
                      </Typography>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSettingEdit(setting);
                        }}
                        >
                          Edit
                        </Button>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={setting.enabled}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSettingToggle(setting.id, e.target.checked);
                            }}
                              disabled={setting.required}
                            />
                        }
                          label="Enabled"
                        />
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Consents Tab */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Consent Records
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Setting</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {consents.map((consent) => (
                  <TableRow key={consent.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        User {consent.userId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {settings.find(s => s.id === consent.settingId)?.name || 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={consent.granted ? <CREATOR_HUB_ICONS.checkCircle /> : <CREATOR_HUB_ICONS.cancel />}
                        label={consent.granted ? 'Granted' : 'Denied'}
                        color={consent.granted ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {consent.timestamp.toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {consent.version}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Data Requests Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Data Subject Requests
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getRequestTypeIcon(request.type)}
                        <Typography variant="subtitle2">
                          {request.type.charAt(0).toUpperCase() + request.type.slice(1)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        User {request.userId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(request.status)}
                        label={request.status}
                        color={getStatusColor(request.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {request.submitted.toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleRequestSelect(request)}
                        >
                          View
                        </Button>
                        <FormControl size="small">
                          <Select
                            value={request.status}
                            onChange={(e) => handleRequestStatusChange(request.id, e.target.value as any)}
                          >
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="processing">Processing</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Privacy Activity
          </Typography>
          <List>
            {recentActivity.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <CREATOR_HUB_ICONS.history />
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={`${activity.setting || activity.request} • ${activity.timestamp.toLocaleString()}`}
                />
                <Chip 
                  label={activity.type}
                  size="small" 
                  color="primary"
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Setting Editor Dialog */}
      <Dialog open={showSettingEditor} onClose={() => setShowSettingEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedSetting?.id.startsWith('setting-') ? 'Create Setting' : 'Edit Setting'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedSetting && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Setting Name"
                value={selectedSetting.name}
                onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedSetting.description}
                onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedSetting.category}
                  onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, category: e.target.value as any } : null)}
                >
                  <MenuItem value="data_collection">Data Collection</MenuItem>
                  <MenuItem value="analytics">Analytics</MenuItem>
                  <MenuItem value="sharing">Sharing</MenuItem>
                  <MenuItem value="retention">Retention</MenuItem>
                  <MenuItem value="consent">Consent</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Level</InputLabel>
                <Select
                  value={selectedSetting.level}
                  onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, level: e.target.value as any } : null)}
                >
                  <MenuItem value="basic">Basic</MenuItem>
                  <MenuItem value="enhanced">Enhanced</MenuItem>
                  <MenuItem value="maximum">Maximum</MenuItem>
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedSetting.enabled}
                      onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                    />
                }
                  label="Enabled"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedSetting.required}
                      onChange={(e) => setSelectedSetting(prev => prev ? { ...prev, required: e.target.checked } : null)}
                    />
                }
                  label="Required"
                />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleSettingSave}
           sx={theming.getThemedButtonSx()}>
            {selectedSetting?.id.startsWith('setting-') ? 'Create' : 'Update'} Setting
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Dialog */}
      <Dialog open={showRequestDialog} onClose={() => setShowRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {selectedRequest && getRequestTypeIcon(selectedRequest.type)}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Data Request Details
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Stack spacing={2} sx={{ mt:  2 }}>
              <Box>
                <Typography variant="subtitle2">Type</Typography>
                <Typography variant="body1">
                  {selectedRequest.type.charAt(0).toUpperCase() + selectedRequest.type.slice(1)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">User</Typography>
                <Typography variant="body1">
                  User {selectedRequest.userId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  icon={getStatusIcon(selectedRequest.status)}
                  label={selectedRequest.status}
                  color={getStatusColor(selectedRequest.status) as any}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2">Description</Typography>
                <Typography variant="body1">
                  {selectedRequest.description}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Submitted</Typography>
                <Typography variant="body1">
                  {selectedRequest.submitted.toLocaleString()}
                </Typography>
              </Box>
              {selectedRequest.completed && (
                <Box>
                  <Typography variant="subtitle2">Completed</Typography>
                  <Typography variant="body1">
                    {selectedRequest.completed.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRequestDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrivacyControls;

