/**
 * StoryboardSharingDialog - Team sharing and access control for storyboards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  Button,
  Avatar,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  InputAdornment,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Share,
  Link,
  ContentCopy,
  PersonAdd,
  Delete,
  Check,
  Close,
  Edit,
  Visibility,
  Comment as CommentIcon,
  AdminPanelSettings,
  Email,
  Lock,
  Schedule,
  GroupAdd,
} from '@mui/icons-material';
import type {
  TeamMember,
  ShareLink,
  PermissionLevel} from '../../core/storyboard/StoryboardCollaborationService';
import {
  storyboardCollaborationService
} from '../../core/storyboard/StoryboardCollaborationService';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// =============================================================================
// Types
// =============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

// =============================================================================
// Permission Selector
// =============================================================================

interface PermissionSelectorProps {
  value: PermissionLevel;
  onChange: (value: PermissionLevel) => void;
  disabled?: boolean;
}

const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const getPermissionIcon = (level: PermissionLevel) => {
    switch (level) {
      case 'view':
        return <Visibility fontSize="small" />;
      case 'comment':
        return <CommentIcon fontSize="small" />;
      case 'edit':
        return <Edit fontSize="small" />;
      case 'admin':
        return <AdminPanelSettings fontSize="small" />;
    }
  };

  const getPermissionLabel = (level: PermissionLevel) => {
    switch (level) {
      case 'view':
        return 'Can view';
      case 'comment':
        return 'Can comment';
      case 'edit':
        return 'Can edit';
      case 'admin':
        return 'Admin';
    }
  };

  return (
    <FormControl size="small" sx={{ minWidth: 130 }}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as PermissionLevel)}
        disabled={disabled}
      >
        {(['view','comment','edit','admin'] as PermissionLevel[]).map((level) => (
          <MenuItem key={level} value={level}>
            <Stack direction="row" spacing={1} alignItems="center">
              {getPermissionIcon(level)}
              <span>{getPermissionLabel(level)}</span>
            </Stack>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// =============================================================================
// Main Sharing Dialog
// =============================================================================

interface StoryboardSharingDialogProps {
  open: boolean;
  onClose: () => void;
  storyboardId: string;
  storyboardName: string;
}

export const StoryboardSharingDialog: React.FC<StoryboardSharingDialogProps> = ({
  open,
  onClose,
  storyboardId,
  storyboardName,
}) => {
  // Toast notifications
  const { addToast } = useVirtualStudio();

  const [activeTab, setActiveTab] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<PermissionLevel>('comment');
  const [inviteSent, setInviteSent] = useState(false);

  // Share link state
  const [newLinkPermission, setNewLinkPermission] = useState<PermissionLevel>('view');
  const [newLinkExpires, setNewLinkExpires] = useState(false);
  const [newLinkExpiresIn, setNewLinkExpiresIn] = useState(24);
  const [newLinkPassword, setNewLinkPassword] = useState(false);
  const [newLinkPasswordValue, setNewLinkPasswordValue] = useState('');
  const [newLinkMaxViews, setNewLinkMaxViews] = useState(false);
  const [newLinkMaxViewsValue, setNewLinkMaxViewsValue] = useState(100);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      setIsLoading(true);
      await storyboardCollaborationService.initialize(storyboardId);
      setTeamMembers(storyboardCollaborationService.getTeamMembers());
      setShareLinks(storyboardCollaborationService.getShareLinks());
      setIsLoading(false);
    };

    loadData();
  }, [open, storyboardId]);

  // Handlers - Team Members
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    await storyboardCollaborationService.inviteTeamMember(inviteEmail.trim(), invitePermission);
    setTeamMembers(storyboardCollaborationService.getTeamMembers());
    addToast({
      message: `Invitation sent to ${inviteEmail.trim()}`,
      type: 'success',
      duration: 3000,
    });
    setInviteEmail('');
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleUpdatePermission = async (memberId: string, permission: PermissionLevel) => {
    await storyboardCollaborationService.updateMemberPermission(memberId, permission);
    setTeamMembers(storyboardCollaborationService.getTeamMembers());
    addToast({
      message: 'Permissions updated',
      type: 'success',
      duration: 2000,
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    await storyboardCollaborationService.removeMember(memberId);
    setTeamMembers(storyboardCollaborationService.getTeamMembers());
    addToast({
      message: 'Team member removed',
      type: 'info',
      duration: 2000,
    });
  };

  // Handlers - Share Links
  const handleCreateLink = async () => {
    await storyboardCollaborationService.createShareLink({
      permission: newLinkPermission,
      expiresIn: newLinkExpires ? newLinkExpiresIn : undefined,
      maxViews: newLinkMaxViews ? newLinkMaxViewsValue : undefined,
      password: newLinkPassword ? newLinkPasswordValue : undefined,
    });
    setShareLinks(storyboardCollaborationService.getShareLinks());

    // Reset form
    setNewLinkPassword(false);
    setNewLinkPasswordValue(', ');
    setNewLinkExpires(false);
    setNewLinkMaxViews(false);
  };

  const handleCopyLink = async (link: ShareLink) => {
    const url = storyboardCollaborationService.getShareUrl(link);
    await navigator.clipboard.writeText(url);
    setCopiedLinkId(link.id);
    addToast({
      message: 'Share link copied to clipboard',
      type: 'success',
      duration: 2000,
    });
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleDeleteLink = async (linkId: string) => {
    await storyboardCollaborationService.deleteShareLink(linkId);
    setShareLinks(storyboardCollaborationService.getShareLinks());
    addToast({
      message: 'Share link deleted',
      type: 'info',
      duration: 2000,
    });
  };

  const formatExpiry = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    if (date < now) return 'Expired';
    const hours = Math.ceil((date.getTime() - now.getTime()) / 3600000);
    if (hours < 24) return `${hours}h left`;
    const days = Math.ceil(hours / 24);
    return `${days}d left`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Share />
          <Box>
            <Typography variant="h6">Share"{storyboardName}"</Typography>
            <Typography variant="caption" color="text.secondary">
              Collaborate with your team
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<GroupAdd />} label="Team Members" iconPosition="start" />
          <Tab icon={<Link />} label="Share Links" iconPosition="start" />
        </Tabs>

        {/* Team Members Tab */}
        <TabPanel value={activeTab} index={0}>
          {/* Invite Form */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Invite Team Member
            </Typography>
            <Stack direction="row" spacing={2} alignItems="flex-end">
              <TextField
                fullWidth
                size="small"
                label="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email fontSize="small" />
                    </InputAdornment>
                  )}}
              />
              <PermissionSelector
                value={invitePermission}
                onChange={setInvitePermission}
              />
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
              >
                Invite
              </Button>
            </Stack>
            {inviteSent && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Invitation sent successfully!
              </Alert>
            )}
          </Paper>

          {/* Team Members List */}
          <Typography variant="subtitle2" gutterBottom>
            Team Members ({teamMembers.length})
          </Typography>
          {teamMembers.length === 0 ? (
            <Alert severity="info">
              No team members yet. Invite someone to collaborate!
            </Alert>
          ) : (
            <List>
              {teamMembers.map((member) => (
                <ListItem key={member.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {member.userName.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.userName}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption">{member.userEmail}</Typography>
                        {!member.acceptedAt && (
                          <Chip label="Pending" size="small" color="warning" sx={{ height: 18 }} />
                        )}
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PermissionSelector
                        value={member.permission}
                        onChange={(p) => handleUpdatePermission(member.id, p)}
                      />
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Share Links Tab */}
        <TabPanel value={activeTab} index={1}>
          {/* Create Link Form */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Create Share Link
            </Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" sx={{ minWidth: 100 }}>Permission:</Typography>
                <PermissionSelector
                  value={newLinkPermission}
                  onChange={setNewLinkPermission}
                />
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkExpires}
                      onChange={(e) => setNewLinkExpires(e.target.checked)}
                    />
                  }
                  label="Expires"
                />
                {newLinkExpires && (
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={newLinkExpiresIn}
                      onChange={(e) => setNewLinkExpiresIn(e.target.value as number)}
                    >
                      <MenuItem value={1}>1 hour</MenuItem>
                      <MenuItem value={24}>24 hours</MenuItem>
                      <MenuItem value={72}>3 days</MenuItem>
                      <MenuItem value={168}>7 days</MenuItem>
                      <MenuItem value={720}>30 days</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPassword}
                      onChange={(e) => setNewLinkPassword(e.target.checked)}
                    />
                  }
                  label="Password"
                />
                {newLinkPassword && (
                  <TextField
                    size="small"
                    type="password"
                    value={newLinkPasswordValue}
                    onChange={(e) => setNewLinkPasswordValue(e.target.value)}
                    placeholder="Enter password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock fontSize="small" />
                        </InputAdornment>
                      )}}
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkMaxViews}
                      onChange={(e) => setNewLinkMaxViews(e.target.checked)}
                    />
                  }
                  label="View limit"
                />
                {newLinkMaxViews && (
                  <TextField
                    size="small"
                    type="number"
                    value={newLinkMaxViewsValue}
                    onChange={(e) => setNewLinkMaxViewsValue(parseInt(e.target.value) || 100)}
                    InputProps={{ inputProps: { min: 1 } }}
                    sx={{ width: 100 }}
                  />
                )}
              </Stack>

              <Button
                variant="contained"
                startIcon={<Link />}
                onClick={handleCreateLink}
              >
                Create Link
              </Button>
            </Stack>
          </Paper>

          {/* Share Links List */}
          <Typography variant="subtitle2" gutterBottom>
            Active Links ({shareLinks.length})
          </Typography>
          {shareLinks.length === 0 ? (
            <Alert severity="info">
              No share links created yet.
            </Alert>
          ) : (
            <List>
              {shareLinks.map((link) => (
                <ListItem key={link.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                      <Link />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {storyboardCollaborationService.getShareUrl(link)}
                        </Typography>
                        {link.requiresPassword && (
                          <Chip
                            icon={<Lock sx={{ fontSize: '12px !important' }} />}
                            label="Password"
                            size="small"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack direction="row" spacing={1}>
                        <Typography variant="caption">
                          {link.permission}
                        </Typography>
                        <Typography variant="caption">•</Typography>
                        <Typography variant="caption">
                          {link.viewCount} views
                          {link.maxViews && ` / ${link.maxViews}`}
                        </Typography>
                        <Typography variant="caption">•</Typography>
                        <Typography variant="caption">
                          {formatExpiry(link.expiresAt)}
                        </Typography>
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={copiedLinkId === link.id ? 'Copied!' : 'Copy link'}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyLink(link)}
                          color={copiedLinkId === link.id ? 'success' : 'default'}
                        >
                          {copiedLinkId === link.id ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete link">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoryboardSharingDialog;

