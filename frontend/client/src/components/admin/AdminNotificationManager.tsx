import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Send,
  Notifications,
  NotificationsActive,
  Schedule,
  People,
  Warning,
  Info,
  CheckCircle,
  Error,
  Campaign,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { nb } from 'date-fns/locale';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface NotificationFormData {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: 'all' | 'photographers' | 'videographers' | 'music_producers' | 'vendors' | 'prototype_testers';
  actionType?: 'open_url' | 'extend_program' | 'acknowledge' | null;
  actionPayload?: Record<string, any>;
  expiresAt?: Date | null;
  scheduledFor?: Date | null;
  actionButton?: string;
  actionUrl?: string;
}

const typeIcons = {
  info: <Info color="info" />,
  warning: <Warning color="warning" />,
  success: <CheckCircle color="success" />,
  error: <Error color="error" />,
  announcement: <Campaign color="primary" />,
};

const typeColors = {
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
  announcement: 'primary',
} as const;

const priorityColors = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: 'error',
} as const;

export default function AdminNotificationManager() {
  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState<any>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = auth.state.user?.id || (auth.state.user as { sub?: string })?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  const [formData, setFormData] = useState<NotificationFormData>({
    title: '',
    message: ', ',
    type: 'info',
    priority: 'medium',
    targetAudience: 'all',
    expiresAt: null,
    actionButton: '',
    actionUrl: '',
});

  // Fetch notifications
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['/api/admin/notifications'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/notifications', { headers });
    },
    refetchInterval: 30000, // Refresh every 30 seconds
});

  // Fetch pending provisioning requests for notifications
  const { data: pendingRequests, isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/admin-provisioning/pending-approvals'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin-provisioning/pending-approvals', { headers });
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
});

  // Fetch provisioning metrics for dashboard notifications
  const { data: provisioningMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin-provisioning/metrics'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin-provisioning/metrics', { headers });
    },
    refetchInterval: 30000,
});

  // Create notification mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/notifications', {
        headers,
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
      setShowCreateDialog(false);
      resetForm();
  },
});

  // Toggle notification status
  const toggleNotificationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/notifications/${id}`, {
        headers,
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
  },
});

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/notifications/${id}`, {
        headers,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
  },
});

  // Create automatic notification for new user requests
  const createUserRequestNotificationMutation = useMutation({
    mutationFn: async (userData: { userId: string; userType: string; businessName: string; contactEmail: string }) => {
      const headers = await auth.getAuthHeader();
      const notificationData: NotificationFormData = {
        title: `Ny ${userData.userType} søknad`,
        message: `${userData.businessName} (${userData.contactEmail}) har sendt inn en søknad som ${userData.userType}. Vurder søknaden i provisioning-systemet.`,
        type: 'info',
        priority: 'medium',
        targetAudience: 'all',
        actionButton: 'Se søknad',
        actionUrl: '/admin?tab=provisioning-widget',
    };
      return apiRequest('/api/admin/notifications', {
        headers,
        method: 'POST',
        body: JSON.stringify(notificationData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
  },
});

  // Create automatic notification for user dashboard access
  const createDashboardAccessNotificationMutation = useMutation({
    mutationFn: async (userData: { userId: string; userType: string; businessName: string }) => {
      const headers = await auth.getAuthHeader();
      const notificationData: NotificationFormData = {
        title: `Ny ${userData.userType} har fått tilgang`,
        message: `${userData.businessName} har fått tilgang til ${userData.userType}-dashbordet og kan nå begynne å bruke plattformen.`,
        type: 'success',
        priority: 'low',
        targetAudience: 'all',
        actionButton: 'Se bruker',
        actionUrl: '/admin?tab=brukere-roller',
    };
      return apiRequest('/api/admin/notifications', {
        headers,
        method: 'POST',
        body: JSON.stringify(notificationData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/notifications'] });
  },
});

  const resetForm = () => {
    setFormData({
      title: '',
      message: ', ',
      type: 'info',
      priority: 'medium',
      targetAudience: 'all',
      expiresAt: null,
      scheduledFor: null,
      actionButton: '',
      actionUrl: ', ',
  });
    setEditingNotification(null);
};

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      return;
  }

    createNotificationMutation.mutate(formData);
};

  const handleEdit = (notification: any) => {
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      targetAudience: notification.targetAudience,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
      scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : null,
      actionButton: notification.actionButton || ', ',
      actionUrl: notification.actionUrl || ', ',
  });
    setEditingNotification(notification);
    setShowCreateDialog(true);
};

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('nb-NO');
};


  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={nb}>
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3}}
        >
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="h4" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            <Notifications sx={{ mr: 2, verticalAlign: 'middle' }} />
            Admin Notifikasjoner
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            <Button variant="contained"
              startIcon={theming.getThemedIcon('add')}
              onClick={() => setShowCreateDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                borderRadius: 2}}
            >
              Ny Notifikasjon
            </Button>
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr',
              md: 'repeat(4, 1fr)',
          },
            gap: 3,
            mb: 4}}
        >
          <MuiCard
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
              color: 'white'}}
          >
            <CardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Aktive</Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {notifications?.data?.filter((n: any) => n.isActive).length || 0}
              </Typography>
            </CardContent>
          </MuiCard>
          <MuiCard
            sx={{
              background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
              color: 'white'}}
          >
            <CardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Høy Prioritet</Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {notifications?.data?.filter(
                  (n: any) => n.priority === 'high' || n.priority === 'urgent',
                ).length || 0}
              </Typography>
            </CardContent>
          </MuiCard>
          <MuiCard
            sx={{
              background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
              color: 'white'}}
          >
            <CardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Totalt</Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>{notifications?.data?.length || 0}</Typography>
            </CardContent>
          </MuiCard>
          <MuiCard
            sx={{
              background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
              color: 'white'}}
          >
            <CardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Venter på godkjenning</Typography>
              <Typography variant="h3" sx={{ color: theming.colors.primary }}>
                {pendingRequests?.data?.length || 0}
              </Typography>
            </CardContent>
          </MuiCard>
        </Box>

        {/* Pending User Requests Section */}
        {pendingRequests?.data?.length > 0 && (
          <MuiCard sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <People color="primary" />
                Venter på godkjenning ({pendingRequests.data.length})
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Disse brukerne har sendt inn søknader og venter på godkjenning. Du kan opprette notifikasjoner for dem.
              </Alert>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr',
                    md: 'repeat(3, 1fr)',
                },
                  gap: 2}}
              >
                {pendingRequests.data.slice(0, 3).map((request: any) => (
                  <Paper key={request.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {request.businessName || 'Ukjent bedrift'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {request.userType} • {request.contactEmail}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Søknad sendt: {new Date(request.requestedAt).toLocaleDateString('nb-NO')}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={theming.getThemedIcon('add')}
                        onClick={() => {
                          createUserRequestNotificationMutation.mutate({
                            userId: request.userId,
                            userType: request.userType,
                            businessName: request.businessName || 'Ukjent bedrift',
                            contactEmail: request.contactEmail,
                        });
                      }}
                        disabled={createUserRequestNotificationMutation.isPending}
                      >
                        Opprett notifikasjon
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
              {pendingRequests.data.length > 3 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  ... og {pendingRequests.data.length - 3} flere
                </Typography>
              )}
            </CardContent>
          </MuiCard>
        )}

        {/* Notifications List */}
        <MuiCard>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
              Alle Notifikasjoner
            </Typography>
            {isLoading ? (
              <Typography>Laster notifikasjoner...</Typography>
            ) : notifications?.data?.length === 0 ? (
              <Typography color="text.secondary">Ingen notifikasjoner opprettet ennå.</Typography>
            ) : (
              <List>
                {notifications?.data?.map((notification: any, index: number) => (
                  <React.Fragment key={notification.id}>
                    <ListItem
                      sx={{
                        bgcolor: notification.isActive ? 'transparent' : 'action.disabled',
                        borderRadius: 1,
                        mb: 1}}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                        {typeIcons[notification.type as keyof typeof typeIcons]}
                      </Box>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1}}
                          >
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>{notification.title}</Typography>
                            <Chip
                              label={notification.type}
                              size="small"
                              color={typeColors[notification.type as keyof typeof typeColors]}
                            />
                            <Chip
                              label={notification.priority}
                              size="small"
                              color={
                                priorityColors[notification.priority as keyof typeof priorityColors]
                            }
                            />
                            <Chip
                              label={
                                notification.targetAudience === 'all'
                                  ? 'Alle brukere'
                                  : notification.targetAudience
                            }
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Schedule sx={{ fontSize: 14 }} />
                              Opprettet: {formatDate(notification.createdAt)}
                              {notification.expiresAt && (
                                <> • Utløper: {formatDate(notification.expiresAt)}</>
                              )}
                            </Typography>
                          </Box>
                      }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            onClick={() =>
                              toggleNotificationMutation.mutate({
                                id: notification.id,
                                isActive: !notification.isActive,
                            })
                          }
                            color={notification.isActive ? 'primary' : 'default'}
                          >
                            {notification.isActive ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                          </IconButton>
                          <IconButton onClick={() => handleEdit(notification)}>
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                            color="error"
                          >
                            {theming.getThemedIcon('delete')}
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < notifications.data.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </MuiCard>

        {/* Create/Edit Dialog */}
        <Dialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            resetForm();
        }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'}}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {editingNotification ? 'Rediger Notifikasjon' : 'Opprett Ny Notifikasjon'}
            </Typography>
            <IconButton
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
            }}
            >
              {theming.getThemedIcon('close')}
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr',
                  sm: 'repeat(2, 1fr)',
              },
                gap: 3,
                mt: 1}}
            >
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <TextField
                  label="Tittel"
                  fullWidth
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <TextField
                  label="Melding"
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </Box>
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={formData.type}
                    label="Type"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="warning">Advarsel</MenuItem>
                    <MenuItem value="success">Suksess</MenuItem>
                    <MenuItem value="error">Feil</MenuItem>
                    <MenuItem value="announcement">Kunngjøring</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Prioritet"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as any,
                    })
                  }
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                    <MenuItem value="urgent">Akutt</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <FormControl fullWidth>
                  <InputLabel>Målgruppe</InputLabel>
                  <Select
                    value={formData.targetAudience}
                    label="Målgruppe"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetAudience: e.target.value as any,
                    })
                  }
                  >
                    <MenuItem value="all">Alle brukere</MenuItem>
                    <MenuItem value="photographers">{getProfessionDisplayName('photographer')}er</MenuItem>
                    <MenuItem value="videographers">{getProfessionDisplayName('videographer')}er</MenuItem>
                    <MenuItem value="music_producers">{getProfessionDisplayName('music_producer')}er</MenuItem>
                    <MenuItem value="vendors">{getProfessionDisplayName('vendor')}er</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <DateTimePicker
                  label="Utløpsdato (valgfritt)"
                  value={formData.expiresAt}
                  onChange={(date) => setFormData({ ...formData, expiresAt: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'La stå tom for permanent notifikasjon',
                  }}}
                />
              </Box>
              <Box>
                <DateTimePicker
                  label="Send tid (valgfritt)"
                  value={formData.scheduledFor}
                  onChange={(date) => setFormData({ ...formData, scheduledFor: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'La stå tom for å sende umiddelbart',
                  }}}
                />
              </Box>
              <Box>
                <TextField
                  label="Handling Knapp Tekst (valgfritt)"
                  fullWidth
                  value={formData.actionButton}
                  onChange={(e) => setFormData({ ...formData, actionButton: e.target.value })}
                  placeholder="Les mer"
                />
              </Box>
              <Box>
                <TextField
                  label="Handling URL (valgfritt)"
                  fullWidth
                  value={formData.actionUrl}
                  onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                  placeholder="https: //..."
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
            }}
            >
              Avbryt
            </Button>
            <Button variant="contained"
              onClick={handleSubmit}
              disabled={
                !formData.title.trim() ||
                !formData.message.trim() ||
                createNotificationMutation.isPending
            }
              startIcon={<Send />}
            >
              {createNotificationMutation.isPending
                ? 'Sender...'
                : editingNotification
                  ? 'Oppdater' : 'Send Notifikasjon'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Push Notification Settings Dialog */}
        {isSupported && (
          <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Push-varsler innstillinger</DialogTitle>
            <DialogContent>
              <Box sx={{ mt: 2 }}>
                <PushNotificationSettings userId={userId} showDescription={false} />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </LocalizationProvider>
  );
}
