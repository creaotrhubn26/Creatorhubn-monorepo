// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealTime } from '../../contexts/RealTimeContext';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Avatar,
  Divider,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  alpha,
} from '@mui/material';
import {
  Comment,
  Reply,
  CheckCircle,
  Cancel,
  MoreVert,
  AccessTime,
  Person,
  Videocam,
  Image as ImageIcon,
  CheckCircleOutline,
  RadioButtonUnchecked,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

interface ProjectComment {
  id: string;
  source: 'showcase' | 'client_gallery';
  authorName: string;
  authorEmail: string;
  content: string;
  commentType?: string;
  rating?: number;
  status: string;
  isApproved: boolean;
  isPrivate: boolean;
  isResolved: boolean;
  parentCommentId?: number;
  timestampSeconds?: number;
  photographerResponse?: string;
  metadata?: any;
  showcaseId?: string;
  showcaseItemId?: string;
  projectId?: string;
  imageId?: string;
  galleryId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ProjectCommentsPanelProps {
  projectId: string;
  onCommentUpdate?: () => void;
}

export const ProjectCommentsPanel: React.FC<ProjectCommentsPanelProps> = ({
  projectId,
  onCommentUpdate,
}) => {
  const queryClient = useQueryClient();
  const { isConnected, onEvent, offEvent, emitEvent } = useRealTime();

  const [filter, setFilter] = useState<'all' | 'unresolved' | 'pending'>('unresolved');
  const [selectedComment, setSelectedComment] = useState<ProjectComment | null>(null);
  const [responseText, setResponseText] = useState('');
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [contextComment, setContextComment] = useState<ProjectComment | null>(null);

  // Fetch unified comments for project
  const {
    data: commentsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [`/api/projects/${projectId}/comments/unified`, filter],
    queryFn: async () => {
      const includeResolved = filter === 'all' ? 'true' : 'false';
      const response = await fetch(
        `/api/projects/${projectId}/comments/unified?includeResolved=${includeResolved}&includePrivate=true`,
      );
      if (!response.ok) throw new Error('Failed to fetch comments, ');
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Real-time comment updates
  useEffect(() => {
    if (!isConnected) return;

    const handleCommentAdded = (data: unknown) => {
      if (data.projectId === projectId) {
        refetch();
        onCommentUpdate?.();
      }
    };

    const handleCommentUpdated = (data: unknown) => {
      if (data.projectId === projectId) {
        refetch();
        onCommentUpdate?.();
      }
    };

    onEvent('comment_added,', handleCommentAdded);
    onEvent('comment_updated', handleCommentUpdated);
    onEvent('comment_resolved', handleCommentUpdated);
    onEvent('comment_approved', handleCommentUpdated);

    return () => {
      offEvent('comment_added', handleCommentAdded);
      offEvent('comment_updated', handleCommentUpdated);
      offEvent('comment_resolved', handleCommentUpdated);
      offEvent('comment_approved', handleCommentUpdated);
    };
  }, [isConnected, projectId, refetch, onEvent, offEvent, onCommentUpdate]);

  // Mutation: Add photographer response
  const respondMutation = useMutation({
    mutationFn: async ({ commentId, response }: { commentId: string; response: string }) => {
      const id = commentId.replace('showcase_', ',').replace('gallery_', ',');
      const res = await fetch(`/api/projects/${projectId}/comments/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ response }),
      });
      if (!res.ok) throw new Error('Failed to add response');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setShowResponseDialog(false);
      setResponseText(', ');
      setSelectedComment(null);

      // Emit real-time event
      if (isConnected) {
        emitEvent('comment_updated', { projectId });
      }
    },
  });

  // Mutation: Resolve comment
  const resolveMutation = useMutation({
    mutationFn: async ({ commentId, isResolved }: { commentId: string; isResolved: boolean }) => {
      const id = commentId.replace('showcase_', ',').replace('gallery_', ',');
      const res = await fetch(`/api/projects/${projectId}/comments/${id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ isResolved }),
      });
      if (!res.ok) throw new Error('Failed to resolve comment');
      return res.json();
    },
    onSuccess: () => {
      refetch();

      // Emit real-time event
      if (isConnected) {
        emitEvent('comment_resolved', { projectId });
      }
    },
  });

  // Mutation: Update status
  const statusMutation = useMutation({
    mutationFn: async ({ commentId, status }: { commentId: string; status: string }) => {
      const id = commentId.replace('showcase_', ', ').replace('gallery_', ', ');
      const res = await fetch(`/api/projects/${projectId}/comments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      refetch();

      // Emit real-time event
      if (isConnected) {
        emitEvent('comment_approved', { projectId });
      }
    },
  });

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, comment: ProjectComment) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
    setContextComment(comment);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setContextComment(null);
  };

  const handleRespond = (comment: ProjectComment) => {
    setSelectedComment(comment);
    setResponseText(comment.photographerResponse || ', ');
    setShowResponseDialog(true);
    handleCloseMenu();
  };

  const handleResolve = (comment: ProjectComment) => {
    resolveMutation.mutate({ commentId: comment.id, isResolved: !comment.isResolved });
    handleCloseMenu();
  };

  const handleApprove = (comment: ProjectComment) => {
    const newStatus = comment.status === 'approved' ? 'pending' : 'approved';
    statusMutation.mutate({ commentId: comment.id, status: newStatus });
    handleCloseMenu();
  };

  const handleReject = (comment: ProjectComment) => {
    statusMutation.mutate({ commentId: comment.id, status: 'rejected' });
    handleCloseMenu();
  };

  const toggleExpanded = (commentId: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getSourceIcon = (source: string) => {
    return source === 'showcase' ? <ImageIcon fontSize="small" /> : <Videocam fontSize="small" />;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  const comments = commentsData?.comments || [];
  const stats = {
    total: commentsData?.total || 0,
    unresolved: commentsData?.unresolved || 0,
    pending: commentsData?.pending || 0,
  };

  return (
    <Paper sx={{ p: 3, bgcolor: 'background.paper' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Comment />
          <Typography variant="h6">Project Comments</Typography>
          <Badge badgeContent={stats.unresolved} color="error">
            <Chip label={`${stats.total} Total`} size="small" />
          </Badge>
        </Box>

        {/* Real-time indicator */}
        {isConnected && (
          <Tooltip title="Live updates enabled">
            <Chip
              icon={<CheckCircleOutline />}
              label="Live"
              color="success"
              size="small"
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>

      {/* Filter Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip
          label="Unresolved"
          color={filter === 'unresolved' ? 'primary' : 'default'}
          onClick={() => setFilter('unresolved')}
          variant={filter === 'unresolved' ? 'filled' : 'outlined'}
        />
        <Chip
          label="Pending Approval"
          color={filter === 'pending' ? 'warning' : 'default'}
          onClick={() => setFilter('pending')}
          variant={filter === 'pending' ? 'filled' : 'outlined'}
        />
        <Chip
          label="All Comments"
          color={filter === 'all' ? 'primary' : 'default'}
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'filled' : 'outlined'}
        />
      </Stack>

      {/* Comments List */}
      {comments.length === 0 ? (
        <Alert severity="info">No comments found for this project.</Alert>
      ) : (
        <Stack spacing={2}>
          {comments.map((comment: ProjectComment) => {
            const isExpanded = expandedComments.has(comment.id);

            return (
              <Paper
                key={comment.id}
                elevation={1}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: comment.isResolved ? 'success.light' : 'divider',
                  bgcolor: comment.isResolved ? alpha('#4caf50', 0.05) : 'background.paper'}}>
                {/* Comment Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      {comment.authorName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">{comment.authorName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(comment.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {comment.timestampSeconds && (
                      <Chip
                        icon={<AccessTime />}
                        label={formatTimestamp(comment.timestampSeconds)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    <Chip
                      label={comment.status}
                      size="small"
                      color={getStatusColor(comment.status) as any}
                    />
                    {comment.isResolved && <CheckCircle color="success" fontSize="small" />}
                    <IconButton size="small" onClick={(e) => handleContextMenu(e, comment)}>
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {/* Comment Content */}
                <Typography variant="body2" sx={{ mb: 1, pl: 5 }}>
                  {comment.content}
                </Typography>

                {/* Metadata */}
                <Box sx={{ display: 'flex', gap: 1, pl: 5, mb: 1 }}>
                  <Chip
                    icon={getSourceIcon(comment.source)}
                    label={comment.source === 'showcase' ? 'Showcase' : 'Gallery'}
                    size="small"
                    variant="outlined"
                  />
                  {comment.commentType && (
                    <Chip label={comment.commentType} size="small" variant="outlined" />
                  )}
                  {comment.rating && (
                    <Chip label={`★ ${comment.rating}/5`} size="small" variant="outlined" />
                  )}
                </Box>

                {/* Photographer Response */}
                {comment.photographerResponse && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ pl: 5, bgcolor: alpha('#2196f3', 0.05), p: 1, borderRadius: 1 }}>
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                        Your Response: </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {comment.photographerResponse}
                      </Typography>
                    </Box>
                  </>
                )}

                {/* Expand for more details */}
                {comment.metadata && (
                  <Box sx={{ pl: 5, mt: 1 }}>
                    <Button
                      size="small"
                      onClick={() => toggleExpanded(comment.id)}
                      endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                    >
                      {isExpanded ? 'Less Info' : 'More Info'}
                    </Button>
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography
                          variant="caption"
                          component="pre"
                          sx={{ whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(comment.metadata, null, 2)}
                        </Typography>
                      </Box>
                    </Collapse>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={() => contextComment && handleRespond(contextComment)}>
          <Reply fontSize="small" sx={{ mr: 1 }} />
          Respond
        </MenuItem>
        <MenuItem onClick={() => contextComment && handleResolve(contextComment)}>
          {contextComment?.isResolved ? (
            <>
              <RadioButtonUnchecked fontSize="small" sx={{ mr: 1 }} />
              Mark Unresolved
            </>
          ) : (
            <>
              <CheckCircle fontSize="small" sx={{ mr: 1 }} />
              Mark Resolved
            </>
          )}
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => contextComment && handleApprove(contextComment)}>
          <CheckCircle fontSize="small" sx={{ mr: 1 }} />
          {contextComment?.status === 'approved' ? 'Unapprove' : 'Approve'}
        </MenuItem>
        <MenuItem onClick={() => contextComment && handleReject(contextComment)}>
          <Cancel fontSize="small" sx={{ mr: 1 }} />
          Reject
        </MenuItem>
      </Menu>

      {/* Response Dialog */}
      <Dialog
        open={showResponseDialog}
        onClose={() => setShowResponseDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Respond to Comment</DialogTitle>
        <DialogContent>
          {selectedComment && (
            <>
              <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {selectedComment.authorName}
                </Typography>
                <Typography variant="body2">{selectedComment.content}</Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Your Response"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type your response here..."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResponseDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() =>
              selectedComment &&
              respondMutation.mutate({ commentId: selectedComment.id, response: responseText })
            }
            disabled={!responseText.trim() || respondMutation.isPending}
          >
            {respondMutation.isPending ? 'Sending...' : 'Send Response'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProjectCommentsPanel;
