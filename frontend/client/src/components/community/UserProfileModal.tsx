/**
 * CreatorHub Norge Community - User Profile Modal
 * 
 * Shows user profile with stats, badges, roles, and recent activity
 * Includes Direct Message (DM) integration with UniversalChatWidget
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Avatar,
  Chip,
  Button,
  IconButton,
  Divider,
  Grid,
  Paper,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  Close,
  Star,
  Message,
  Favorite,
  TrendingUp,
  EmojiEvents,
  Chat,
  Block,
  PersonOff,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profile_picture?: string;
  profession?: string;
  created_at: string;
}

interface UserStats {
  message_count: number;
  reaction_count: number;
  thread_count: number;
  badges_count: number;
}

interface UserBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  awarded_at: string;
}

interface UserRole {
  id: string;
  name: string;
  color: string;
}

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentUserId?: string;
  onStartDM?: (userId: string, userName: string, userAvatar?: string) => void;
}

export default function UserProfileModal({
  open,
  onClose,
  userId,
  currentUserId,
  onStartDM,
}: UserProfileModalProps) {
  const { communication } = useEnhancedMasterIntegration();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Check if this is the current user's own profile
  const isOwnProfile = currentUserId === userId;

  useEffect(() => {
    if (open && userId) {
      fetchUserProfile();
    }
  }, [open, userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);

      // Fetch user profile
      const profileResponse = await apiRequest(`/api/users/${userId}`);
      setProfile(profileResponse);

      // Fetch user stats
      const statsResponse = await apiRequest(`/api/community/user/${userId}/stats`);
      setStats(statsResponse.stats);

      // Fetch user badges
      const badgesResponse = await apiRequest(`/api/community/user/${userId}/badges`);
      setBadges(badgesResponse.badges || []);

      // Fetch user roles
      const rolesResponse = await apiRequest(`/api/community/user/${userId}/roles`);
      setRoles(rolesResponse.roles || []);

      // Check if user is blocked/muted (only if viewing someone else's profile)
      if (currentUserId && currentUserId !== userId) {
        try {
          const blockStatusResponse = await apiRequest(`/api/community/user/${currentUserId}/blocked/${userId}`);
          setIsBlocked(blockStatusResponse.isBlocked || false);
          setIsMuted(blockStatusResponse.isMuted || false);
        } catch {
          // Endpoint may not exist yet, ignore
        }
      }
    } catch (error) {
      console.error('Error fetching user profile: ', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle starting a DM conversation
  const handleStartDM = async () => {
    if (!profile) return;

    try {
      // Create or get existing DM conversation
      const response = await apiRequest('/api/community/dm/conversations', {
        method: 'POST',
        body: JSON.stringify({
          participantId: userId,
        }),
      });

      if (response.success && response.conversation) {
        // Broadcast to open chat widget with this conversation
        communication.sendBroadcast('chat:open-dm', {
          conversationId: response.conversation.id,
          participantId: userId,
          participantName: profile.name,
          participantAvatar: profile.profile_picture,
        });

        // Also call the callback if provided
        if (onStartDM) {
          onStartDM(userId, profile.name, profile.profile_picture);
        }

        enqueueSnackbar(`Chat åpnet med ${profile.name}`, { variant: 'success' });

        // Close the profile modal
        onClose();
      }
    } catch (error) {
      console.error('Error starting DM:', error);
      enqueueSnackbar('Kunne ikke starte chat', { variant: 'error' });
    }
  };

  // Handle blocking a user
  const handleBlockUser = async () => {
    if (!profile) return;

    try {
      await apiRequest(`/api/community/user/${currentUserId}/block/${userId}`, {
        method: isBlocked ? 'DELETE' : 'POST',
      });

      setIsBlocked(!isBlocked);
      enqueueSnackbar(
        isBlocked ? `${profile.name} er ikke lenger blokkert` : `${profile.name} er blokkert`,
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Error blocking user:', error);
      enqueueSnackbar('Kunne ikke oppdatere blokkeringsstatus', { variant: 'error' });
    }
  };

  // Handle muting a user
  const handleMuteUser = async () => {
    if (!profile) return;

    try {
      await apiRequest(`/api/community/user/${currentUserId}/mute/${userId}`, {
        method: isMuted ? 'DELETE' : 'POST',
      });

      setIsMuted(!isMuted);
      enqueueSnackbar(
        isMuted ? `${profile.name} er ikke lenger dempet` : `${profile.name} er dempet`,
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Error muting user:', error);
      enqueueSnackbar('Kunne ikke oppdatere dempingsstatus', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#ff8c00' }} />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
            Brukerprofil
          </Typography>
          <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX} dividers>
        {/* Profile Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
          <Avatar
            src={profile.profile_picture}
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'rgba(255, 140, 0, 0.18)',
              color: '#ff8c00',
              border: '1px solid rgba(255, 140, 0, 0.24)',
            }}
          >
            {profile.name?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: COMMUNITY_DIALOG_TEXT }}>
              {profile.name}
            </Typography>
            <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
              {profile.profession || 'Medlem'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {roles.map((role) => (
                <Chip
                  key={role.id}
                  label={role.name}
                  size="small"
                  sx={{ bgcolor: role.color, color: 'white' }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Stats Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 2, textAlign: 'center' }}>
              <Message color="primary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_TEXT }}>{stats?.message_count || 0}</Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Meldinger
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 2, textAlign: 'center' }}>
              <Favorite color="error" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_TEXT }}>{stats?.reaction_count || 0}</Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Reaksjoner
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 2, textAlign: 'center' }}>
              <TrendingUp color="success" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_TEXT }}>{stats?.thread_count || 0}</Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Tråder
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 2, textAlign: 'center' }}>
              <EmojiEvents color="warning" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_TEXT }}>{badges.length}</Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Merker
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Badges Section */}
        {badges.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>
              Merker
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {badges.map((badge) => (
                <Tooltip key={badge.id} title={badge.description}>
                  <Chip
                    label={`${badge.icon} ${badge.name}`}
                    sx={{
                      bgcolor: badge.color,
                      color: 'white',
                      fontWeight: 600}}
                  />
                </Tooltip>
              ))}
            </Box>
          </>
        )}

        {/* Member Since */}
        <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
          Medlem siden{''}
          {formatDistanceToNow(new Date(profile.created_at), {
            addSuffix: true,
            locale: nb,
          })}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ ...COMMUNITY_DIALOG_ACTIONS_SX, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Block/Mute actions - only show for other users */}
          {!isOwnProfile && currentUserId && (
            <>
              <Tooltip title={isBlocked ? 'Fjern blokkering' : 'Blokker bruker'}>
                <IconButton
                  onClick={handleBlockUser}
                  sx={{
                    ...COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
                    color: isBlocked ? '#ff8e83' : COMMUNITY_DIALOG_TEXT,
                  }}
                  size="small"
                >
                  <Block />
                </IconButton>
              </Tooltip>
              <Tooltip title={isMuted ? 'Fjern demping' : 'Demp bruker'}>
                <IconButton
                  onClick={handleMuteUser}
                  sx={{
                    ...COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
                    color: isMuted ? '#ffd27a' : COMMUNITY_DIALOG_TEXT,
                  }}
                  size="small"
                >
                  <PersonOff />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* DM Button - only show for other users and if not blocked */}
          {!isOwnProfile && !isBlocked && (
            <Button
              variant="contained"
              startIcon={<Chat />}
              onClick={handleStartDM}
              sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
            >
              Send melding
            </Button>
          )}
          <Button onClick={onClose} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>Lukk</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
