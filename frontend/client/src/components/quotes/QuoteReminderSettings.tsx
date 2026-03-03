/**
 * Quote Reminder Settings Component
 * UI for configuring automated quote reminders and follow-ups
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime as ClockIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  InfoOutlined as InfoIcon,
  Mail as MailIcon,
  Notifications as BellIcon,
} from '@mui/icons-material';

interface ReminderConfig {
  expiryReminders: {
    enabled: boolean;
    daysBeforeExpiry: number[];
  };
  followUpReminders: {
    enabled: boolean;
    daysAfterSent: number[];
  };
  emailSubjectPrefix: string;
  defaultEmailFrom: string;
}

interface QuoteReminderSettingsProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

interface ReminderServiceStatus {
  isRunning: boolean;
  lastCheck?: string;
}

interface ReminderConfigResponse {
  success: boolean;
  config?: ReminderConfig;
  error?: string;
}

interface ReminderStatusResponse {
  success: boolean;
  status?: ReminderServiceStatus;
}

function createDefaultConfig(): ReminderConfig {
  return {
    expiryReminders: {
      enabled: true,
      daysBeforeExpiry: [7, 3, 1],
    },
    followUpReminders: {
      enabled: true,
      daysAfterSent: [3, 7, 14],
    },
    emailSubjectPrefix: '[Påminnelse]',
    defaultEmailFrom: 'noreply@creatorhub.no',
  };
}

export default function QuoteReminderSettings({
  open,
  onClose,
  userId = 'user-1',
}: QuoteReminderSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [serviceStatus, setServiceStatus] = useState<ReminderServiceStatus | null>(null);
  const [config, setConfig] = useState<ReminderConfig>(createDefaultConfig);
  const [toast, setToast] = useState<{
    open: boolean;
    severity: 'success' | 'error' | 'info';
    message: string;
  }>({ open: false, severity: 'info', message: '' });

  useEffect(() => {
    if (open) {
      void fetchConfig();
      void fetchServiceStatus();
    }
  }, [open, userId]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quotes/reminders/config?userId=${encodeURIComponent(userId)}`);
      const data = (await response.json()) as ReminderConfigResponse;

      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch reminder config:', error);
      setToast({
        open: true,
        severity: 'error',
        message: 'Failed to load reminder settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/quotes/reminders/status');
      const data = (await response.json()) as ReminderStatusResponse;
      if (data.success && data.status) {
        setServiceStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch service status:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/quotes/reminders/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, config }),
      });

      const data = (await response.json()) as ReminderConfigResponse;

      if (!data.success) {
        throw new Error(data.error ?? 'Failed to save settings');
      }

      setToast({
        open: true,
        severity: 'success',
        message: 'Quote reminder settings updated successfully',
      });
      onClose();
    } catch (error) {
      console.error('Failed to save reminder config:', error);
      setToast({
        open: true,
        severity: 'error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestReminders = async () => {
    try {
      const response = await fetch('/api/quotes/reminders/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as { success: boolean };

      if (data.success) {
        setToast({
          open: true,
          severity: 'success',
          message: 'Reminder check executed. Check your email for any reminders.',
        });
      }
    } catch (error) {
      console.error('Failed to trigger test reminders:', error);
      setToast({
        open: true,
        severity: 'error',
        message: 'Failed to trigger test reminders',
      });
    }
  };

  const updateExpiryDays = (index: number, value: string) => {
    const days = Number.parseInt(value, 10);
    setConfig((prev) => {
      const nextDays = [...prev.expiryReminders.daysBeforeExpiry];
      nextDays[index] = Number.isFinite(days) ? days : 0;
      return {
        ...prev,
        expiryReminders: {
          ...prev.expiryReminders,
          daysBeforeExpiry: nextDays,
        },
      };
    });
  };

  const updateFollowUpDays = (index: number, value: string) => {
    const days = Number.parseInt(value, 10);
    setConfig((prev) => {
      const nextDays = [...prev.followUpReminders.daysAfterSent];
      nextDays[index] = Number.isFinite(days) ? days : 0;
      return {
        ...prev,
        followUpReminders: {
          ...prev.followUpReminders,
          daysAfterSent: nextDays,
        },
      };
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <BellIcon fontSize="small" />
            <Typography variant="h6">Quote Reminder Settings</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure automated reminders for expiring quotes and pending follow-ups
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {serviceStatus && (
            <Alert
              severity={serviceStatus.isRunning ? 'success' : 'warning'}
              icon={serviceStatus.isRunning ? <CheckCircleIcon /> : <ErrorIcon />}
              sx={{ mb: 2 }}
            >
              <Typography variant="body2">
                Service Status: {serviceStatus.isRunning ? 'Running' : 'Stopped'}
              </Typography>
              {serviceStatus.lastCheck && (
                <Typography variant="caption" display="block">
                  Last check: {new Date(serviceStatus.lastCheck).toLocaleString()}
                </Typography>
              )}
            </Alert>
          )}

          <Tabs value={activeTab} onChange={(_event, value: number) => setActiveTab(value)}>
            <Tab label="Expiry Reminders" />
            <Tab label="Follow-ups" />
            <Tab label="Email Settings" />
          </Tabs>

          {activeTab === 0 && (
            <Card sx={{ mt: 2 }}>
              <CardHeader
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ClockIcon fontSize="small" />
                    <Typography variant="subtitle1">Expiry Reminders</Typography>
                  </Stack>
                }
                subheader="Send reminder emails before quotes expire"
              />
              <CardContent>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.expiryReminders.enabled}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            expiryReminders: {
                              ...prev.expiryReminders,
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                    }
                    label="Enable expiry reminders"
                  />

                  {config.expiryReminders.enabled && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Days before expiry to send reminders
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {config.expiryReminders.daysBeforeExpiry.map((days, index) => (
                          <TextField
                            key={`expiry-${index}`}
                            type="number"
                            size="small"
                            label={`Reminder ${index + 1}`}
                            value={days}
                            onChange={(event) => updateExpiryDays(index, event.target.value)}
                            inputProps={{ min: 1 }}
                          />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        <InfoIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Reminders sendes {config.expiryReminders.daysBeforeExpiry.join(', ')} dager
                        før utløp.
                      </Typography>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeTab === 1 && (
            <Card sx={{ mt: 2 }}>
              <CardHeader
                title={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MailIcon fontSize="small" />
                    <Typography variant="subtitle1">Follow-up Reminders</Typography>
                  </Stack>
                }
                subheader="Send follow-up emails for pending quotes"
              />
              <CardContent>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.followUpReminders.enabled}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            followUpReminders: {
                              ...prev.followUpReminders,
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                    }
                    label="Enable follow-up reminders"
                  />

                  {config.followUpReminders.enabled && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Days after sending to follow up
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {config.followUpReminders.daysAfterSent.map((days, index) => (
                          <TextField
                            key={`follow-up-${index}`}
                            type="number"
                            size="small"
                            label={`Follow-up ${index + 1}`}
                            value={days}
                            onChange={(event) => updateFollowUpDays(index, event.target.value)}
                            inputProps={{ min: 1 }}
                          />
                        ))}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        <InfoIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                        Follow-ups sendes {config.followUpReminders.daysAfterSent.join(', ')} dager
                        etter at tilbudet ble sendt.
                      </Typography>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeTab === 2 && (
            <Card sx={{ mt: 2 }}>
              <CardHeader
                title={<Typography variant="subtitle1">Email Configuration</Typography>}
                subheader="Customize email settings for reminders"
              />
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    label="Email Subject Prefix"
                    value={config.emailSubjectPrefix}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, emailSubjectPrefix: event.target.value }))
                    }
                    fullWidth
                  />
                  <TextField
                    label='Default "From" Email'
                    type="email"
                    value={config.defaultEmailFrom}
                    onChange={(event) =>
                      setConfig((prev) => ({ ...prev, defaultEmailFrom: event.target.value }))
                    }
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>
          )}
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={handleTestReminders} disabled={saving}>
            <CheckCircleIcon sx={{ mr: 1 }} fontSize="small" />
            Test Now
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} variant="contained">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
