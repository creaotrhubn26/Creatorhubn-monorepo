/**
 * What, 's New Modal
 * Displays platform announcements and feature updates to users
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { PushNotificationSettings } from './shared/PushNotificationSettings';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Divider,
  LinearProgress,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  FiberNew as NewIcon,
  Update as UpdateIcon,
  Build as BuildIcon,
  Lightbulb as TipIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  PlayCircle as PlayCircleIcon,
  School as SchoolIcon,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'feature' | 'update' | 'maintenance' | 'tip';
  importance: 'low' | 'medium' | 'high' | 'critical';
  image_url?: string;
  action_label?: string;
  action_url?: string;
  version?: string;
  release_date: string;
  is_read: boolean;
  feature_key?: string;
  auto_generated?: boolean;
  tutorial_video_url?: string;
  tutorial_title?: string;
  tutorial_description?: string;
  featureInfo?: {
    id: string;
    enabled: boolean;
    plan: string;
    description: string;
    impact: string;
    dependencies?: string[];
  };
}

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
  userProfession?: string;
  autoShow?: boolean;
  previewMode?: boolean;
  previewAnnouncement?: Announcement;
}

const categoryConfig = {
  feature: {
    icon: <NewIcon />,
    label: 'Ny Funksjon',
    color: '#4caf50',
  },
  update: {
    icon: <UpdateIcon />,
    label: 'Oppdatering',
    color: '#2196f3',
  },
  maintenance: {
    icon: <BuildIcon />,
    label: 'Vedlikehold',
    color: '#ff9800',
  },
  tip: {
    icon: <TipIcon />,
    label: 'Tips',
    color: '#9c27b0',
  },
};

const importanceConfig = {
  critical: { color: '#f44336', label: 'Kritisk' },
  high: { color: '#ff9800', label: 'Viktig' },
  medium: { color: '#2196f3', label: 'Middels' },
  low: { color: '#9e9e9e', label: 'Lav' },
};

export default function WhatsNewModal({
  open,
  onClose,
  userProfession = 'photographer',
  autoShow = false,
  previewMode = false,
  previewAnnouncement,
}: WhatsNewModalProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Push notifications
  const { user } = useAuth();
  const userId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Fetch announcements (skip in preview mode)
  const { data, isLoading } = useQuery({
    queryKey: ['/api/announcements,', userProfession],
    queryFn: async () => {
      const response = await fetch(`/api/announcements?profession=${userProfession}`);
      if (!response.ok) throw new Error('Failed to fetch announcements, ');
      return response.json();
    },
    enabled: open && !previewMode,
    staleTime: 300000, // 5 minutes
  });

  const announcements: Announcement[] =
    previewMode && previewAnnouncement ? [previewAnnouncement] : data?.announcements || [];
  const unreadCount = previewMode ? 0 : data?.unreadCount || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await fetch(`/api/announcements/${announcementId}/read`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const response = await fetch(`/api/announcements/${announcementId}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to dismiss');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  // Auto-select first unread announcement
  useEffect(() => {
    if (announcements.length > 0 && !selectedAnnouncement) {
      const firstUnread = announcements.find((a) => !a.is_read);
      setSelectedAnnouncement(firstUnread || announcements[0]);

      // Mark first unread as read (skip in preview mode)
      if (firstUnread && !firstUnread.is_read && !previewMode) {
        markAsReadMutation.mutate(firstUnread.id);
      }
    }
  }, [announcements, selectedAnnouncement, previewMode]);

  const handleSelectAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);

    if (!announcement.is_read && !previewMode) {
      markAsReadMutation.mutate(announcement.id);
    }
  };

  const handleDismiss = (announcementId: string) => {
    dismissMutation.mutate(announcementId);

    // Select next announcement if current is dismissed
    if (selectedAnnouncement?.id === announcementId) {
      const remainingAnnouncements = announcements.filter((a) => a.id !== announcementId);
      setSelectedAnnouncement(remainingAnnouncements[0] || null);
    }
  };

  const handleAction = () => {
    if (selectedAnnouncement?.action_url) {
      window.open(selectedAnnouncement.action_url, '_blank');
    }
  };

  const handleClose = () => {
    // Mark all as read before closing (skip in preview mode)
    if (!previewMode) {
      announcements.forEach((announcement) => {
        if (!announcement.is_read) {
          markAsReadMutation.mutate(announcement.id);
        }
      });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: {} }}
    >
      {/* Header */}
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <NewIcon sx={{ color: '#ff8c00', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 600}}>
              {previewMode ? 'Forhåndsvisning av Kunngjøring' : 'Hva er nytt i CreatorHub Norge'}
            </Typography>
            {previewMode && (
              <Chip
                label="FORHÅNDSVISNING"
                size="small"
                sx={{ bgcolor: '#ff9800', color: 'white', fontWeight: 600}}
              />
            )}
            {!previewMode && unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error" sx={{ ml: 1 }}>
                <Box />
              </Badge>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {isSupported && !previewMode && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton onClick={() => setPushSettingsOpen(true)} size="small" color={pushEnabled ? 'primary' : 'default'}>
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 0, display: 'flex', height: '500px' }}>
        {/* Sidebar - Announcement List */}
        <Box
          sx={{
            width: 280,
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowY: 'auto',
            bgcolor: 'grey.50'}}
        >
          {isLoading ? (
            <Box sx={{ p: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                Laster kunngjøringer...
              </Typography>
            </Box>
          ) : announcements.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Ingen nye kunngjøringer
              </Typography>
            </Box>
          ) : (
            announcements.map((announcement) => {
              const category = categoryConfig[announcement.category];
              const importance = importanceConfig[announcement.importance];
              const isSelected = selectedAnnouncement?.id === announcement.id;

              return (
                <Box
                  key={announcement.id}
                  onClick={() => handleSelectAnnouncement(announcement)}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'white' : 'transparent',
                    borderLeft: isSelected ? '3px solid #ff8c00' : '3px solid transparent', '&:hover': {
                      bgcolor: 'white',
                    },
                    transition: 'all 0.2s'}}
                >
                  <Box display="flex" alignItems="flex-start" justifyContent="space-between">
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                        <Box sx={{ color: category.color, display: 'flex', alignItems: 'center' }}>
                          {category.icon}
                        </Box>
                        {!announcement.is_read && (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: '#ff8c00'}} />
                        )}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: nnouncement.is_read ? 400 : 600,
                          fontSize: '0.875rem',
                          lineHeight: 1.4 }}>
                        {announcement.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5 }}>
                        {new Date(announcement.release_date).toLocaleDateString('nb-NO', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Main Content - Selected Announcement */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {selectedAnnouncement ? (
            <Box>
              {/* Header */}
              <Box mb={3}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Chip
                    icon={categoryConfig[selectedAnnouncement.category].icon}
                    label={categoryConfig[selectedAnnouncement.category].label}
                    size="small"
                    sx={{
                      bgcolor: categoryConfig[selectedAnnouncement.category].color,
                      color: 'white','& .MuiChip-icon': { color: 'white' }}}
                  />
                  <Chip
                    label={importanceConfig[selectedAnnouncement.importance].label}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: importanceConfig[selectedAnnouncement.importance].color,
                      color: importanceConfig[selectedAnnouncement.importance].color}} />
                  {selectedAnnouncement.version && (
                    <Chip
                      label={`v${selectedAnnouncement.version}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  {selectedAnnouncement.title}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  {new Date(selectedAnnouncement.release_date).toLocaleDateString('nb-NO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Typography>
              </Box>

              {/* Image */}
              {selectedAnnouncement.image_url && (
                <Box mb={3}>
                  <img
                    src={selectedAnnouncement.image_url}
                    alt={selectedAnnouncement.title}
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      maxHeight: 250,
                      objectFit: 'cover'}} />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Feature Info Card (if linked to feature) */}
              {selectedAnnouncement.featureInfo && (
                <Card
                  sx={{ mb: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <SettingsIcon sx={{ color: '#ff8c00' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600}}>
                        Om denne funksjonen
                      </Typography>
                    </Box>

                    <Box display="flex" flexDirection="column" gap={1}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Status
                        </Typography>
                        <Chip
                          label={
                            selectedAnnouncement.featureInfo.enabled ? 'Aktivert' : 'Tilgjengelig'
                          }
                          size="small"
                          color={selectedAnnouncement.featureInfo.enabled ? 'success' : 'default'}
                          sx={{ mt: 0.5 }} />
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Abonnement
                        </Typography>
                        <Chip
                          label={selectedAnnouncement.featureInfo.plan.toUpperCase()}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5 }} />
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Betydning
                        </Typography>
                        <Chip
                          label={selectedAnnouncement.featureInfo.impact}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5 }} />
                      </Box>

                      {selectedAnnouncement.featureInfo.dependencies &&
                        selectedAnnouncement.featureInfo.dependencies.length > 0 && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              mb={0.5}
                            >
                              Avhengigheter
                            </Typography>
                            {selectedAnnouncement.featureInfo.dependencies.map((dep: string) => (
                              <Chip key={dep} label={dep} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                          </Box>
                        )}

                      {!selectedAnnouncement.featureInfo.enabled && (
                        <Box mt={1}>
                          <Button
                            size="small"
                            startIcon={<SettingsIcon />}
                            variant="outlined"
                            sx={{ borderColor: '#ff8c00', color: '#ff8c00' }}
                            onClick={() => (window.location.href = '/settings/features')}
                          >
                            Aktiver Funksjon
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Tutorial Video Section */}
              {selectedAnnouncement.tutorial_video_url && (
                <Card
                  sx={{
                    mb: 3,
                    background: 'linear-gradient(135deg, #fff5e6 0%, #ffe4cc 100%)',
                    border: '2px solid #ff8c00',
                    boxShadow: '0 4px 12px rgba(2, 5, 5, 140, 0, 0.15)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(2, 5, 5, 140, 0, 0.25)',
                    },
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Box
                        sx={{
                          bgcolor: '#ff8c00',
                          borderRadius: '50%',
                          width: 40,
                          height: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'}}>
                        <SchoolIcon sx={{ color: 'white', fontSize: 24 }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#ff8c00' }}>
                        {selectedAnnouncement.tutorial_title || 'Se hvordan det fungerer'}
                      </Typography>
                    </Box>

                    {selectedAnnouncement.tutorial_description && (
                      <Typography variant="body2" color="text.secondary" mb={2} sx={{ pl: 6 }}>
                        {selectedAnnouncement.tutorial_description}
                      </Typography>
                    )}

                    {/* Video Player */}
                    <Box
                      sx={{
                        position: 'relative',
                        paddingTop: '56.25%', // 16:9 aspect ratio
                        bgcolor: '#000',
                        borderRadius: 2,
                        overflow: 'hidden',
                        mb: 2,
                        border: '3px solid #ff8c00',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'}}>
                      <iframe
                        src={selectedAnnouncement.tutorial_video_url}
                        title={selectedAnnouncement.tutorial_title || 'Tutorial video'}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%'}} />
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Auto-generated badge */}
              {selectedAnnouncement.auto_generated && (
                <Box mb={2}>
                  <Chip
                    icon={<InfoIcon />}
                    label="Automatisk generert kunngjøring"
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }} />
                </Box>
              )}

              {/* Content */}
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  color: 'text.primary'}}>
                {selectedAnnouncement.content}
              </Typography>

              {/* Action Button */}
              {selectedAnnouncement.action_label && selectedAnnouncement.action_url && (
                <Box mt={3}>
                  <Button
                    variant="contained"
                    endIcon={<OpenInNewIcon />}
                    onClick={handleAction}
                    sx={{
                      bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' }}}
                  >
                    {selectedAnnouncement.action_label}
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box textAlign="center" py={5}>
              <Typography variant="body1" color="text.secondary">
                Velg en kunngjøring fra listen
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3, py: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
          <Typography variant="caption" color="text.secondary">
            {previewMode
              ? 'Forhåndsvisning - Ingen data vil bli lagret'
              : `${announcements.length} kunngjøring(er)`}
          </Typography>
          <Box display="flex" gap={1}>
            {selectedAnnouncement && !previewMode && (
              <Button
                onClick={() => handleDismiss(selectedAnnouncement.id)}
                size="small"
                color="inherit"
              >
                Skjul denne
              </Button>
            )}
            <Button
              onClick={handleClose}
              variant="contained"
              size="small"
              sx={{
                bgcolor: '#ff8c00',
                '&:hover': { bgcolor: '#e67e00' }
              }}
            >
              Lukk
            </Button>
          </Box>
        </Box>
      </DialogActions>

      {/* Push Notification Settings Dialog */}
      {isSupported && !previewMode && (
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
    </Dialog>
  );
}
