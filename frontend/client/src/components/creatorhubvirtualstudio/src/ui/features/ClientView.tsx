import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Avatar,
  Card,
  CardContent,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Lock,
  Visibility,
  Comment,
  ThumbUp,
  ThumbDown,
  Edit,
  Send,
  CheckCircle,
  Cancel,
  Lightbulb,
  CameraAlt,
  Inventory,
  Download,
  Close,
  ViewInAr,
} from '@mui/icons-material';
import type {
  ShareLink,
  ClientComment,
  ApprovalStatus} from '../../core/services/clientSharingService';
import {
  clientSharingService,
  SharePermissions
} from '../../core/services/clientSharingService';

interface ClientViewProps {
  token: string;
}

type ViewMode = 'pin' | 'loading' | 'view' | 'error';

export function ClientView({ token }: ClientViewProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [pin, setPin] = useState('');

  // Client info
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  // Comments
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Approval
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [currentApproval, setCurrentApproval] = useState<ApprovalStatus | null>(null);

  // Validate token on mount
  useEffect(() => {
    validateLink();
  }, [token]);

  const validateLink = async (enteredPin?: string) => {
    setViewMode('loading');
    setError(null);

    try {
      const result = await clientSharingService.validateShareLink(token, enteredPin);

      if (result.valid && result.shareLink) {
        setShareLink(result.shareLink);
        setViewMode('view');

        // Load comments if allowed
        if (result.shareLink.permissions.canComment) {
          const linkComments = await clientSharingService.getComments(result.shareLink.id);
          setComments(linkComments);
        }

        // Load approval status
        const status = await clientSharingService.getApprovalStatus(result.shareLink.id);
        setCurrentApproval(status);
      } else if (result.error === 'Invalid PIN') {
        setViewMode('pin');
        setError('Invalid PIN. Please try again.');
      } else {
        setViewMode('error');
        setError(result.error || 'This link is invalid or has expired.');
      }
    } catch (err) {
      setViewMode('error');
      setError('Failed to validate link. Please try again.');
    }
  };

  // Handle PIN submission
  const handlePinSubmit = () => {
    if (pin.length >= 4) {
      validateLink(pin);
    }
  };

  // Submit comment
  const handleSubmitComment = async () => {
    if (!shareLink || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const comment = await clientSharingService.addComment(shareLink.id, newComment, {
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
      });

      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      setError('Failed to submit comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit approval
  const handleSubmitApproval = async (status: 'approved' | 'rejected' | 'revision_requested') => {
    if (!shareLink) return;

    setSubmittingApproval(true);
    try {
      const approval = await clientSharingService.submitApproval(shareLink.id, status, {
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        feedback: approvalFeedback || undefined,
      });

      setCurrentApproval(approval);
      setApprovalDialogOpen(false);
      setApprovalFeedback(', ');
    } catch (err) {
      setError('Failed to submit approval');
    } finally {
      setSubmittingApproval(false);
    }
  };

  // PIN Entry View
  if (viewMode === 'pin') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0a',
          p: 2}}
      >
        <Paper
          elevation={4}
          sx={{
            p: 4,
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
            bgcolor: '#1a1a1a',
            color: '#fff'}}
        >
          <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Enter PIN
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This project is protected. Please enter the PIN to view.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            label="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            fullWidth
            sx={{ mb: 2 }}
            inputProps={{ maxLength: 6 }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handlePinSubmit}
            disabled={pin.length < 4}
          >
            Continue
          </Button>
        </Paper>
      </Box>
    );
  }

  // Loading View
  if (viewMode === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0a'}}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error View
  if (viewMode === 'error') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0a',
          p: 2}}
      >
        <Paper
          elevation={4}
          sx={{
            p: 4,
            maxWidth: 400,
            width: '100%',
            textAlign: 'center',
            bgcolor: '#1a1a1a',
            color: '#fff'}}
        >
          <Cancel sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Link Unavailable
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Main View
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a1a',
          borderBottom: '1px solid #333',
          position: 'sticky',
          top: 0,
          zIndex: 10}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ViewInAr color="primary" />
            <Typography variant="h6">{shareLink?.projectName}</Typography>
            {currentApproval && (
              <Chip
                label={currentApproval.status.replace('_', ', ').toUpperCase()}
                color={
                  currentApproval.status === 'approved'
                    ? 'success'
                    : currentApproval.status === 'rejected'
                    ? 'error'
                    : 'warning'
                }
                size="small"
              />
            )}
          </Box>

          {shareLink?.permissions.canApprove && !currentApproval && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<ThumbUp />}
                onClick={() => {
                  setApprovalDialogOpen(true);
                }}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Edit />}
                onClick={() => {
                  setApprovalDialogOpen(true);
                }}
              >
                Request Changes
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ThumbDown />}
                onClick={() => {
                  setApprovalDialogOpen(true);
                }}
              >
                Reject
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* 3D Viewport Placeholder */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#111',
            m: 2,
            borderRadius: 2}}
        >
          <Typography color="text.secondary">
            3D Scene Preview
          </Typography>
        </Box>

        {/* Side Panel */}
        <Box sx={{ width: 360, bgcolor: '#1a1a1a', p: 2, overflowY: 'auto' }}>
          {/* Client Info */}
          <Typography variant="subtitle2" gutterBottom>
            Your Information (optional)
          </Typography>
          <TextField
            label="Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 1 }}
          />
          <TextField
            label="Email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
          />

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Project Details */}
          {shareLink?.permissions.canViewLighting && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Lightbulb fontSize="small" />
                <Typography variant="subtitle2">Lighting Setup</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                3-point lighting with softbox key
              </Typography>
            </Box>
          )}

          {shareLink?.permissions.canViewCamera && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CameraAlt fontSize="small" />
                <Typography variant="subtitle2">Camera Settings</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                85mm f/2.8 ISO 100
              </Typography>
            </Box>
          )}

          {shareLink?.permissions.canViewEquipment && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Inventory fontSize="small" />
                <Typography variant="subtitle2">Equipment List</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                2x Softbox, 1x Reflector, Backdrop
              </Typography>
            </Box>
          )}

          {shareLink?.permissions.canDownload && (
            <Button
              variant="outlined"
              startIcon={<Download />}
              fullWidth
              sx={{ mb: 2 }}
            >
              Download Setup
            </Button>
          )}

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Comments Section */}
          {shareLink?.permissions.canComment && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Comments ({comments.length})
              </Typography>

              <List dense sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
                {comments.map((comment) => (
                  <ListItem
                    key={comment.id}
                    sx={{
                      bgcolor: '#222',
                      borderRadius: 1,
                      mb: 1,
                      flexDirection: 'column',
                      alignItems: 'flex-start'}}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>
                        {(comment.clientName || 'C')[0]}
                      </Avatar>
                      <Typography variant="caption">
                        {comment.clientName || 'Anonymous'}
                      </Typography>
                      {comment.resolved && (
                        <CheckCircle color="success" sx={{ fontSize: 14 }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {comment.content}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              <TextField
                label="Add a comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                multiline
                rows={2}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
                fullWidth
              >
                {submittingComment ? 'Sending...' : 'Send Comment'}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)}>
        <DialogTitle>Submit Feedback</DialogTitle>
        <DialogContent>
          <TextField
            label="Feedback (optional)"
            value={approvalFeedback}
            onChange={(e) => setApprovalFeedback(e.target.value)}
            multiline
            rows={4}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button
            color="success"
            onClick={() => handleSubmitApproval('approved')}
            disabled={submittingApproval}
          >
            Approve
          </Button>
          <Button
            color="warning"
            onClick={() => handleSubmitApproval('revision_requested')}
            disabled={submittingApproval}
          >
            Request Changes
          </Button>
          <Button
            color="error"
            onClick={() => handleSubmitApproval('rejected')}
            disabled={submittingApproval}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ClientView;

