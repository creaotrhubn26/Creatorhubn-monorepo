/**
 * StoryboardCommentsPanel - Comments and feedback UI for storyboard frames
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  Button,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Collapse,
  List,
  ListItem,
  ListItemAvatar,
} from '@mui/material';
import {
  Comment as CommentIcon,
  Send,
  MoreVert,
  Edit,
  Delete,
  CheckCircle,
  CheckCircleOutline,
  Reply,
  ExpandMore,
  ExpandLess,
  FilterList,
  PushPin,
  Flag,
} from '@mui/icons-material';
import {
  storyboardCollaborationService,
  Comment,
  CommentStatus,
} from '../../core/storyboard/StoryboardCollaborationService';
import { useSelectedFrame, StoryboardFrame } from '../../state/storyboardStore';

// =============================================================================
// Comment Thread Component
// =============================================================================

interface CommentThreadProps {
  comment: Comment;
  onReply: (commentId: string, text: string) => void;
  onEdit: (commentId: string, text: string) => void;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
}

const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onReopen,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(comment.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText.trim());
      setReplyText(', ');
      setIsReplying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1,
        bgcolor: comment.status === 'resolved' ? 'rgba(76, 175, 80, 0.1)' : '#1e1e2e',
        borderLeft: 3,
        borderColor: comment.status === 'resolved' ? 'success.main' : 'primary.main'}}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main' }}>
          {comment.authorName.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
            {comment.authorName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDate(comment.createdAt)}
            {comment.updatedAt !== comment.createdAt && ' (edited)'}
          </Typography>
        </Box>
        {comment.status === 'resolved' && (
          <Chip
            icon={<CheckCircle sx={{ fontSize: 14 }} />}
            label="Resolved"
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 22 }}
          />
        )}
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVert fontSize="small" />
        </IconButton>
      </Stack>

      {/* Content */}
      {isEditing ? (
        <Box sx={{ mb: 1 }}>
          <TextField
            fullWidth
            multiline
            size="small"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button size="small" variant="contained" onClick={handleSaveEdit}>Save</Button>
          </Stack>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
          {comment.text}
        </Typography>
      )}

      {/* Position indicator */}
      {comment.position && (
        <Chip
          icon={<PushPin sx={{ fontSize: 12 }} />}
          label={`Pin at ${Math.round(comment.position.x)}%, ${Math.round(comment.position.y)}%`}
          size="small"
          variant="outlined"
          sx={{ mb: 1, height: 20, fontSize: '0.7rem' }}
        />
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          size="small"
          startIcon={<Reply sx={{ fontSize: 14 }} />}
          onClick={() => setIsReplying(!isReplying)}
          sx={{ fontSize: '0.75rem' }}
        >
          Reply
        </Button>
        {comment.replies && comment.replies.length > 0 && (
          <Button
            size="small"
            startIcon={showReplies ? <ExpandLess /> : <ExpandMore />}
            onClick={() => setShowReplies(!showReplies)}
            sx={{ fontSize: '0.75rem' }}
          >
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </Button>
        )}
      </Stack>

      {/* Reply Input */}
      <Collapse in={isReplying}>
        <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
          <TextField
            fullWidth
            multiline
            size="small"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setIsReplying(false)}>Cancel</Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
            >
              Reply
            </Button>
          </Stack>
        </Box>
      </Collapse>

      {/* Replies */}
      <Collapse in={showReplies && (comment.replies?.length || 0) > 0}>
        <List dense sx={{ mt: 1, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
          {comment.replies?.map((reply) => (
            <ListItem key={reply.id} alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemAvatar sx={{ minWidth: 36 }}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>
                  {reply.authorName.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" fontWeight={600}>
                    {reply.authorName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(reply.createdAt)}
                  </Typography>
                </Stack>
                <Typography variant="body2">{reply.text}</Typography>
              </Box>
            </ListItem>
          ))}
        </List>
      </Collapse>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); setIsEditing(true); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {comment.status === 'open' ? (
          <MenuItem onClick={() => { setMenuAnchor(null); onResolve(comment.id); }}>
            <ListItemIcon><CheckCircle fontSize="small" /></ListItemIcon>
            <ListItemText>Mark Resolved</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => { setMenuAnchor(null); onReopen(comment.id); }}>
            <ListItemIcon><CheckCircleOutline fontSize="small" /></ListItemIcon>
            <ListItemText>Reopen</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); onDelete(comment.id); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

// =============================================================================
// Main Comments Panel
// =============================================================================

interface StoryboardCommentsPanelProps {
  storyboardId: string;
  frameId?: string;
  frame?: StoryboardFrame;
}

export const StoryboardCommentsPanel: React.FC<StoryboardCommentsPanelProps> = ({
  storyboardId,
  frameId,
  frame,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load comments
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true);
      await storyboardCollaborationService.initialize(storyboardId);
      const loaded = storyboardCollaborationService.getComments(frameId);
      setComments(loaded);
      setIsLoading(false);
    };

    loadComments();

    // Listen for updates
    const unsubscribe = storyboardCollaborationService.on((event) => {
      if (event.type.startsWith('comment: ')) {
        const updated = storyboardCollaborationService.getComments(frameId);
        setComments(updated);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [storyboardId, frameId]);

  // Handlers
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await storyboardCollaborationService.addComment(newComment.trim(), frameId);
    setNewComment(', ');
    inputRef.current?.focus();
  };

  const handleReply = async (commentId: string, text: string) => {
    await storyboardCollaborationService.addComment(text, frameId, undefined, commentId);
  };

  const handleEdit = async (commentId: string, text: string) => {
    await storyboardCollaborationService.updateComment(commentId, text);
  };

  const handleDelete = async (commentId: string) => {
    await storyboardCollaborationService.deleteComment(commentId);
  };

  const handleResolve = async (commentId: string) => {
    await storyboardCollaborationService.resolveComment(commentId);
  };

  const handleReopen = async (commentId: string) => {
    await storyboardCollaborationService.reopenComment(commentId);
  };

  // Filter comments
  const filteredComments = comments.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'open') return c.status === 'open';
    if (filter === 'resolved') return c.status === 'resolved';
    return true;
  });

  const openCount = comments.filter((c) => c.status === 'open').length;
  const resolvedCount = comments.filter((c) => c.status === 'resolved').length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#12121a' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a2e',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Badge badgeContent={openCount} color="primary">
            <CommentIcon />
          </Badge>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Comments
            </Typography>
            {frame && (
              <Typography variant="caption" color="text.secondary">
                Frame {frame.index + 1}: {frame.title}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Filter */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Chip
            label={`All (${comments.length})`}
            size="small"
            variant={filter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilter('all')}
          />
          <Chip
            label={`Open (${openCount})`}
            size="small"
            color="primary"
            variant={filter === 'open' ? 'filled' : 'outlined'}
            onClick={() => setFilter('open')}
          />
          <Chip
            label={`Resolved (${resolvedCount})`}
            size="small"
            color="success"
            variant={filter === 'resolved' ? 'filled' : 'outlined'}
            onClick={() => setFilter('resolved')}
          />
        </Stack>
      </Paper>

      {/* Comments List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            Loading comments...
          </Typography>
        ) : filteredComments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CommentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              {filter === 'all'
                ? 'No comments yet'
                : filter === 'open'
                ? 'No open comments' : 'No resolved comments'}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Add a comment to start a discussion
            </Typography>
          </Box>
        ) : (
          filteredComments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onResolve={handleResolve}
              onReopen={handleReopen}
            />
          ))
        )}
      </Box>

      {/* New Comment Input */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a2e',
          borderTop: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            inputRef={inputRef}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <Tooltip title="Send (Enter)">
            <IconButton
              color="primary"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
            >
              <Send />
            </IconButton>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display:'block' }}>
          Press Enter to send, Shift+Enter for new line
        </Typography>
      </Paper>
    </Box>
  );
};

export default StoryboardCommentsPanel;

