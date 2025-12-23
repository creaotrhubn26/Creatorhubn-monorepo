import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Badge,
  Avatar,
  Card,
  CardContent,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Share,
  Link as LinkIcon,
  ContentCopy,
  Delete,
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  Schedule,
  Comment,
  CheckCircle,
  Cancel,
  ExpandMore,
  ExpandLess,
  Send,
  PersonOutline,
  Email,
  Download,
  Settings,
  Refresh,
  QrCode2,
} from '@mui/icons-material';
import {
  clientSharingService,
  ShareLink,
  SharePermissions,
  ClientComment,
  ApprovalStatus,
} from '../../core/services/clientSharingService';
import { useVirtualStudio } from '../../../VirtualStudioContext';

interface ClientSharingPanelProps {
  projectId: string;
  projectName: string;
}

export function ClientSharingPanel({ projectId, projectName }: ClientSharingPanelProps) {
  const { addToast } = useVirtualStudio();

  // State
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ShareLink | null>(null);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  // Create link form state
  const [newLinkPin, setNewLinkPin] = useState('');
  const [newLinkExpiry, setNewLinkExpiry] = useState<number | ''>(',');
  const [newLinkPermissions, setNewLinkPermissions] = useState<SharePermissions>({
    canView: true,
    canComment: true,
    canApprove: true,
    canDownload: false,
    canViewLighting: true,
    canViewCamera: true,
    canViewEquipment: true,
  });

  // Load share links
  useEffect(() => {
    loadShareLinks();
  }, [projectId]);

  const loadShareLinks = async () => {
    setLoading(true);
    try {
      const links = await clientSharingService.getShareLinks(projectId);
      setShareLinks(links);
    } catch (error) {
      addToast({
        message: 'Failed to load share links, ',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new share link
  const handleCreateLink = async () => {
    try {
      const link = await clientSharingService.createShareLink(projectId, projectName, {
        permissions: newLinkPermissions,
        pin: newLinkPin || undefined,
        expiresIn: newLinkExpiry || undefined,
      });

      setShareLinks((prev) => [...prev, link]);
      setCreateDialogOpen(false);
      resetCreateForm();

      addToast({
        message: 'Share link created successfully, ',
        type: 'success',
        duration: 3000,
      });

      // Auto-copy to clipboard
      await clientSharingService.copyShareUrl(link.token);
      addToast({
        message: 'Link copied to clipboard',
        type: 'info',
        duration: 2000,
      });
    } catch (error) {
      addToast({
        message: 'Failed to create share link',
        type: 'error',
        duration: 3000,
      });
    }
  };

  const resetCreateForm = () => {
    setNewLinkPin('');
    setNewLinkExpiry('');
    setNewLinkPermissions({
      canView: true,
      canComment: true,
      canApprove: true,
      canDownload: false,
      canViewLighting: true,
      canViewCamera: true,
      canViewEquipment: true,
    });
  };

  // Copy link to clipboard
  const handleCopyLink = async (token: string) => {
    const success = await clientSharingService.copyShareUrl(token);
    if (success) {
      addToast({
        message: 'Link copied to clipboard',
        type: 'success',
        duration: 2000,
      });
    }
  };

  // Revoke link
  const handleRevokeLink = async (linkId: string) => {
    try {
      await clientSharingService.revokeShareLink(linkId);
      setShareLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, isActive: false } : l)));
      addToast({
        message: 'Share link revoked',
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      addToast({
        message: 'Failed to revoke link',
        type: 'error',
        duration: 3000,
      });
    }
  };

  // Load comments for a link
  const handleViewComments = async (link: ShareLink) => {
    setSelectedLink(link);
    try {
      const [linkComments, status] = await Promise.all([
        clientSharingService.getComments(link.id),
        clientSharingService.getApprovalStatus(link.id),
      ]);
      setComments(linkComments);
      setApprovalStatus(status);
      setCommentsDialogOpen(true);
    } catch (error) {
      addToast({
        message: 'Failed to load comments',
        type: 'error',
        duration: 3000,
      });
    }
  };

  // Resolve comment
  const handleResolveComment = async (commentId: string) => {
    try {
      await clientSharingService.resolveComment(commentId, 'current_user');
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, resolved: true, resolvedBy: 'current_user', resolvedAt: new Date() }
            : c
        )
      );
      addToast({
        message: 'Comment resolved',
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      addToast({
        message: 'Failed to resolve comment',
        type: 'error',
        duration: 3000,
      });
    }
  };

  // Format date
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get status color
  const getStatusColor = (status: ApprovalStatus['status']) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      case 'revision_requested':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1a1a1a', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Share color="primary" />
          <Typography variant="h6">Client Sharing</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<LinkIcon />}
          onClick={() => setCreateDialogOpen(true)}
          size="small"
        >
          Create Link
        </Button>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Share Links List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : shareLinks.length === 0 ? (
        <Alert severity="info" sx={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
          No share links created yet. Create one to share this project with clients.
        </Alert>
      ) : (
        <List sx={{ bgcolor: 'transparent' }}>
          {shareLinks.map((link) => (
            <React.Fragment key={link.id}>
              <ListItem
                sx={{
                  bgcolor: '#222',
                  borderRadius: 1,
                  mb: 1,
                  flexDirection: 'column',
                  alignItems: 'stretch'}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {link.projectName}
                      </Typography>
                      {!link.isActive && (
                        <Chip label="Revoked" size="small" color="error" />
                      )}
                      {link.pin && (
                        <Tooltip title="PIN protected">
                          <Lock fontSize="small" color="primary" />
                        </Tooltip>
                      )}
                      {link.expiresAt && (
                        <Tooltip title={`Expires: ${formatDate(link.expiresAt)}`}>
                          <Schedule fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Created {formatDate(link.createdAt)} | {link.accessCount} views
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Copy link">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyLink(link.token)}
                        disabled={!link.isActive}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View comments">
                      <IconButton size="small" onClick={() => handleViewComments(link)}>
                        <Badge badgeContent={0} color="error">
                          <Comment fontSize="small" />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={expandedLinkId === link.id ? 'Hide details' : 'Show details'}>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedLinkId(expandedLinkId === link.id ? null : link.id)
                        }
                      >
                        {expandedLinkId === link.id ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Revoke link">
                      <IconButton
                        size="small"
                        onClick={() => handleRevokeLink(link.id)}
                        disabled={!link.isActive}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Expanded Details */}
                <Collapse in={expandedLinkId === link.id}>
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #333' }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Share URL:
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        bgcolor: '#111',
                        p: 1,
                        borderRadius: 1,
                        wordBreak: 'break-all'}}
                    >
                      {clientSharingService.getShareUrl(link.token)}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Permissions:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {link.permissions.canView && <Chip label="View" size="small" />}
                      {link.permissions.canComment && <Chip label="Comment" size="small" />}
                      {link.permissions.canApprove && <Chip label="Approve" size="small" />}
                      {link.permissions.canDownload && <Chip label="Download" size="small" />}
                    </Box>

                    {link.pin && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          PIN: {link.pin}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Create Link Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Share Link</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Security */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Security
              </Typography>
              <TextField
                label="PIN Protection (optional)"
                value={newLinkPin}
                onChange={(e) => setNewLinkPin(e.target.value)}
                placeholder="4-6 digits"
                fullWidth
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  )}}
              />
            </Box>

            {/* Expiration */}
            <FormControl fullWidth size="small">
              <InputLabel>Link Expiration</InputLabel>
              <Select
                value={newLinkExpiry}
                onChange={(e) => setNewLinkExpiry(e.target.value as number | '')}
                label="Link Expiration"
              >
                <MenuItem value="">Never expires</MenuItem>
                <MenuItem value={24}>24 hours</MenuItem>
                <MenuItem value={72}>3 days</MenuItem>
                <MenuItem value={168}>7 days</MenuItem>
                <MenuItem value={720}>30 days</MenuItem>
              </Select>
            </FormControl>

            {/* Permissions */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Client Permissions
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canComment}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canComment: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Allow comments"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canApprove}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canApprove: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Allow approval/rejection"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canDownload}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canDownload: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Allow downloads"
                />
              </Stack>
            </Box>

            {/* Visibility */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Visible Information
              </Typography>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canViewLighting}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canViewLighting: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Show lighting setup"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canViewCamera}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canViewCamera: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Show camera settings"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={newLinkPermissions.canViewEquipment}
                      onChange={(e) =>
                        setNewLinkPermissions((p) => ({ ...p, canViewEquipment: e.target.checked }))
                      }
                      size="small"
                    />
                  }
                  label="Show equipment list"
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateLink} startIcon={<LinkIcon />}>
            Create Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog
        open={commentsDialogOpen}
        onClose={() => setCommentsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Client Feedback</span>
            {approvalStatus && (
              <Chip
                label={approvalStatus.status.replace('_', ', ').toUpperCase()}
                color={getStatusColor(approvalStatus.status)}
                size="small"
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {comments.length === 0 ? (
            <Alert severity="info">No comments yet</Alert>
          ) : (
            <List>
              {comments.map((comment) => (
                <ListItem
                  key={comment.id}
                  sx={{
                    bgcolor: comment.resolved ? 'action.disabledBackground': 'background.paper',
                    borderRadius: 1,
                    mb: 1,
                    border: '1px solid',
                    borderColor: 'divider'}}
                >
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                        {(comment.clientName || 'C')[0].toUpperCase()}
                      </Avatar>
                      <Typography variant="subtitle2">
                        {comment.clientName ||'Anonymous Client'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.timestamp)}
                      </Typography>
                      {comment.resolved && (
                        <Chip label="Resolved" size="small" color="success" />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {comment.content}
                    </Typography>
                    {!comment.resolved && (
                      <Button
                        size="small"
                        startIcon={<CheckCircle />}
                        onClick={() => handleResolveComment(comment.id)}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default ClientSharingPanel;

