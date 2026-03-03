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
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Download, GppGood, Policy, PrivacyTip } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface PrivacySetting {
  id: string;
  name: string;
  description: string;
  category: 'data_collection' | 'analytics' | 'sharing' | 'retention' | 'consent';
  enabled: boolean;
  required: boolean;
  level: 'basic' | 'enhanced' | 'maximum';
  dataTypes: string[];
}

interface ConsentRecord {
  id: string;
  userId: string;
  settingId: string;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress: string;
  userAgent: string;
}

interface DataRequest {
  id: string;
  userId: string;
  type: 'access' | 'portability' | 'deletion' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  submitted: Date;
  completed?: Date;
  description: string;
}

interface PrivacyControlsProps {
  className?: string;
  onSettingChange?: (setting: PrivacySetting) => void;
  onConsentChange?: (consent: ConsentRecord) => void;
  onDataRequestChange?: (request: DataRequest) => void;
  onPrivacyExport?: (data: {
    settings: PrivacySetting[];
    consents: ConsentRecord[];
    requests: DataRequest[];
  }) => void;
}

const INITIAL_SETTINGS: PrivacySetting[] = [
  {
    id: 'essential-cookies',
    name: 'Essential Cookies',
    description: 'Required for session security and core navigation.',
    category: 'consent',
    enabled: true,
    required: true,
    level: 'basic',
    dataTypes: ['session', 'csrf-token'],
  },
  {
    id: 'analytics-basic',
    name: 'Basic Analytics',
    description: 'Collect usage and performance metrics.',
    category: 'analytics',
    enabled: true,
    required: false,
    level: 'basic',
    dataTypes: ['page-view', 'session-duration'],
  },
  {
    id: 'analytics-enhanced',
    name: 'Enhanced Analytics',
    description: 'Collect deeper clickstream and interaction signals.',
    category: 'analytics',
    enabled: false,
    required: false,
    level: 'enhanced',
    dataTypes: ['click-events', 'heatmap'],
  },
  {
    id: 'data-sharing',
    name: 'Anonymized Data Sharing',
    description: 'Share aggregated metrics with approved partners.',
    category: 'sharing',
    enabled: false,
    required: false,
    level: 'maximum',
    dataTypes: ['anonymized-usage'],
  },
];

const INITIAL_CONSENTS: ConsentRecord[] = [
  {
    id: 'consent-1',
    userId: 'user-1',
    settingId: 'essential-cookies',
    granted: true,
    timestamp: new Date('2026-02-20T09:00:00Z'),
    version: '2.1',
    ipAddress: '127.0.0.1',
    userAgent: 'CreatorHub Local',
  },
  {
    id: 'consent-2',
    userId: 'user-1',
    settingId: 'analytics-basic',
    granted: true,
    timestamp: new Date('2026-02-20T09:00:00Z'),
    version: '2.1',
    ipAddress: '127.0.0.1',
    userAgent: 'CreatorHub Local',
  },
];

const INITIAL_REQUESTS: DataRequest[] = [
  {
    id: 'req-1',
    userId: 'user-2',
    type: 'access',
    status: 'completed',
    submitted: new Date('2026-02-11T11:00:00Z'),
    completed: new Date('2026-02-12T11:00:00Z'),
    description: 'Requested full export of profile and project metadata.',
  },
  {
    id: 'req-2',
    userId: 'user-3',
    type: 'deletion',
    status: 'processing',
    submitted: new Date('2026-02-24T13:30:00Z'),
    description: 'Requested deletion of archived project drafts.',
  },
];

export default function PrivacyControls({
  className,
  onSettingChange,
  onConsentChange,
  onDataRequestChange,
  onPrivacyExport,
}: PrivacyControlsProps): React.ReactElement {
  const theming = useTheming('photographer');

  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<PrivacySetting[]>(INITIAL_SETTINGS);
  const [consents, setConsents] = useState<ConsentRecord[]>(INITIAL_CONSENTS);
  const [requests, setRequests] = useState<DataRequest[]>(INITIAL_REQUESTS);

  const [newRequestType, setNewRequestType] = useState<DataRequest['type']>('access');
  const [newRequestDescription, setNewRequestDescription] = useState('');
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const requiredEnabled = useMemo(
    () => settings.filter((setting) => setting.required && setting.enabled).length,
    [settings],
  );

  const toggleSetting = (settingId: string): void => {
    setSettings((previous) =>
      previous.map((setting) => {
        if (setting.id !== settingId) {
          return setting;
        }
        if (setting.required) {
          return setting;
        }
        const updated = { ...setting, enabled: !setting.enabled };

        const consent: ConsentRecord = {
          id: `consent-${Date.now()}`,
          userId: 'user-1',
          settingId: setting.id,
          granted: updated.enabled,
          timestamp: new Date(),
          version: '2.1',
          ipAddress: '127.0.0.1',
          userAgent: 'CreatorHub Local',
        };

        setConsents((records) => [consent, ...records]);
        onSettingChange?.(updated);
        onConsentChange?.(consent);

        return updated;
      }),
    );
  };

  const createRequest = (): void => {
    if (!newRequestDescription.trim()) {
      return;
    }

    const request: DataRequest = {
      id: `req-${Date.now()}`,
      userId: 'user-1',
      type: newRequestType,
      status: 'pending',
      submitted: new Date(),
      description: newRequestDescription.trim(),
    };

    setRequests((previous) => [request, ...previous]);
    setNewRequestDescription('');
    setShowRequestDialog(false);
    onDataRequestChange?.(request);
  };

  const exportPrivacySnapshot = (): void => {
    onPrivacyExport?.({ settings, consents, requests });
  };

  return (
    <Box className={className} sx={{ width: '100%' }}>
      <Paper sx={{ ...theming.getThemedCardSx(), mb: 2, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <PrivacyTip color="primary" />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Privacy Controls
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage consent, retention settings, and GDPR-style data requests.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Chip label={`${requiredEnabled} required enabled`} size="small" />
            <Button size="small" variant="outlined" startIcon={<Download />} onClick={exportPrivacySnapshot}>
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_event, tab) => setActiveTab(tab)}>
          <Tab icon={<Policy />} iconPosition="start" label="Settings" />
          <Tab icon={<GppGood />} iconPosition="start" label="Consent Log" />
          <Tab icon={<PrivacyTip />} iconPosition="start" label="Data Requests" />
        </Tabs>
      </Paper>

      {activeTab === 0 ? (
        <Card>
          <CardContent>
            <List>
              {settings.map((setting) => (
                <ListItem key={setting.id}>
                  <ListItemText
                    primary={setting.name}
                    secondary={`${setting.description} • ${setting.level}`}
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {setting.required ? <Chip size="small" label="Required" /> : null}
                      <Switch
                        checked={setting.enabled}
                        disabled={setting.required}
                        onChange={() => toggleSetting(setting.id)}
                      />
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 1 ? (
        <Card>
          <CardContent>
            {consents.length === 0 ? (
              <Alert severity="info">No consent records yet.</Alert>
            ) : (
              <List>
                {consents.map((consent) => (
                  <ListItem key={consent.id}>
                    <ListItemText
                      primary={`${consent.settingId} • ${consent.granted ? 'Granted' : 'Denied'}`}
                      secondary={`${consent.userId} • ${consent.timestamp.toLocaleString()}`}
                    />
                    <Chip size="small" color={consent.granted ? 'success' : 'default'} label={consent.version} />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === 2 ? (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Data Subject Requests</Typography>
              <Button size="small" variant="outlined" onClick={() => setShowRequestDialog(true)}>
                New Request
              </Button>
            </Stack>

            <Grid container spacing={2}>
              {requests.map((request) => (
                <Grid key={request.id} size={{ xs: 12, md: 6 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Chip size="small" label={request.type} />
                          <Chip
                            size="small"
                            color={request.status === 'completed' ? 'success' : 'warning'}
                            label={request.status}
                          />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {request.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Submitted {request.submitted.toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showRequestDialog} onClose={() => setShowRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Data Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="request-type-label">Request type</InputLabel>
              <Select
                labelId="request-type-label"
                label="Request type"
                value={newRequestType}
                onChange={(event) => {
                  const value = event.target.value as DataRequest['type'];
                  setNewRequestType(value);
                }}
              >
                <MenuItem value="access">Access</MenuItem>
                <MenuItem value="portability">Portability</MenuItem>
                <MenuItem value="deletion">Deletion</MenuItem>
                <MenuItem value="rectification">Rectification</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={newRequestDescription}
              onChange={(event) => setNewRequestDescription(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRequestDialog(false)}>Cancel</Button>
          <Button onClick={createRequest} variant="contained">
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
