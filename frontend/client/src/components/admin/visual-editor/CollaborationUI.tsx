/**
 * Collaboration UI Components
 * Live cursors, user presence, and collaboration controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Avatar,
  AvatarGroup,
  Tooltip,
  Chip,
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  Paper,
} from '@mui/material';
import { Person, Circle, MoreVert, Comment as CommentIcon } from '@mui/icons-material';
import {
  User,
  Cursor,
  Selection,
  Comment,
  realtimeCollaboration,
} from '@/services/RealtimeCollaborationService';

/**
 * Live Cursor Component
 */
interface LiveCursorProps {
  cursor: Cursor;
  user: User;
}

export const LiveCursor: React.FC<LiveCursorProps> = ({ cursor, user }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: cursor.x,
        top: cursor.y,
        pointerEvents: 'none',
        zIndex: 999,
        transition: 'left 0.1s, top 0.1s'}}>
      {/* Cursor pointer */}
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none">
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* User label */}
      <Chip
        label={user.name}
        size="small"
        sx={{
          ml: 2,
          mt: -1,
          bgcolor: user.color,
          color: 'white',
          fontWeight: 600,
          fontSize: '11px',
          height: 20}} />
    </Box>
  );
};

/**
 * Selection Highlight Component
 */
interface SelectionHighlightProps {
  elementId: string;
  user: User;
}

export const SelectionHighlight: React.FC<SelectionHighlightProps> = ({ elementId, user }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: `2px solid ${user.color}`,
        borderRadius: 1,
        pointerEvents: 'none',
        zIndex: 9998 '&::before': {
          content: `"${user.name}"`,
          position: 'absolute',
          top: -24,
          left: -2,
          padding: '2px 8px',
          bgcolor: user.color,
          color: 'white',
          fontSize: '11px',
          fontWeight: 600,
          borderRadius: 1,
        },
      }
    />
  );
};

/**
 * User Presence Panel
 */
interface UserPresencePanelProps {
  users: User[];
  currentUserId: string;
}

export const UserPresencePanel: React.FC<UserPresencePanelProps> = ({ users, currentUserId }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const activeUsers = users.filter((u) => u.id !== currentUserId);

  return (
    <>
      <AvatarGroup max={4} onClick={handleClick} sx={{ cursor: 'pointer' }}>
        {activeUsers.map((user) => (
          <Tooltip key={user.id} title={`${user.name} (${user.role})`}>
            <Badge
              variant="dot"
              color="success"
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
              <Avatar
                alt={user.name}
                src={user.avatar}
                sx={{
                  width: 32,
                  height: 32,
                  border: `2px solid ${user.color}`,
                  bgcolor: user.avatar ? 'transparent' : user.color}}
              >
                {!user.avatar && user.name.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          </Tooltip>
        ))}
      </AvatarGroup>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'}}>
        <Paper sx={{ width: 280, maxHeight: 400, overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Active Users ({activeUsers.length})
            </Typography>
          </Box>
          <List>
            {activeUsers.map((user) => (
              <ListItem key={user.id}>
                <ListItemAvatar>
                  <Badge variant="dot" color="success" overlap="circular">
                    <Avatar
                      src={user.avatar}
                      sx={{
                        bgcolor: user.color,
                        border: `2px solid ${user.color}`}}
                    >
                      {!user.avatar && user.name.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={user.name}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Circle sx={{ fontSize: 8, color: user.color }} />
                      <Typography variant="caption">{user.role}</Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Popover>
    </>
  );
};

/**
 * Comment Thread Component
 */
interface CommentThreadProps {
  comment: Comment;
  users: Map<string, User>;
  onReply: (commentId: string, text: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comment,
  users,
  onReply,
  onResolve,
  onDelete,
}) => {
  const author = users.get(comment.userId);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (replyText.trim() {
      onReply(comment.id, replyText);
      setReplyText(', ');
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: comment.x && comment.y ? 'absolute' : 'relative',
        left: comment.x,
        top: comment.y,
        width: 300,
        p: 2,
        zIndex: 1000,
        opacity: comment.resolved ? 0.6 : 1}}>
      {/* Main Comment */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Avatar
          src={author?.avatar}
          sx={{
            width: 32,
            height: 32,
            bgcolor: author?.color}}>
          {author?.name.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {author?.name}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {comment.text}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(comment.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => onDelete(comment.id)}>
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>

      {/* Replies */}
      {comment.replies.map((reply) => {
        const replyAuthor = users.get(reply.userId);
        return (
          <Box
            key={reply.id}
            sx={{
              display: 'flex',
              gap: 1,
              ml: 4,
              mb: 1,
              pb: 1,
              borderBottom: 1,
              borderColor: 'divider'}}>
            <Avatar
              src={replyAuthor?.avatar}
              sx={{
                width: 24,
                height: 24,
                bgcolor: replyAuthor?.color}}>
              {replyAuthor?.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="caption" fontWeight={600}>
                {replyAuthor?.name}
              </Typography>
              <Typography variant="body2">{reply.text}</Typography>
            </Box>
          </Box>
        );
      })}

      {/* Reply Input */}
      {!comment.resolved && (
        <Box sx={{ mt: 2 }}>
          <input
            type="text"
            placeholder="Reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReply()}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'}} />
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Chip
          label={comment.resolved ? 'Resolved' : 'Resolve'}
          size="small"
          color={comment.resolved ? 'default' : 'primary'}
          onClick={() => onResolve(comment.id)}
        />
      </Box>
    </Paper>
  );
};

/**
 * Collaboration Toolbar
 */
interface CollaborationToolbarProps {
  projectId: string;
  currentUser: User;
}

export const CollaborationToolbar: React.FC<CollaborationToolbarProps> = ({
  projectId,
  currentUser,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to collaboration
    realtimeCollaboration.connect(currentUser, projectId);

    // Listen for users
    const handleUserJoined = (user: User) => {
      setUsers((prev) => [...prev, user]);
    };

    const handleUserLeft = (userId: string) => {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    };

    const handleConnected = () => {
      setIsConnected(true);
      setUsers(realtimeCollaboration.getUsers();
    };

    realtimeCollaboration.on('connected', handleConnected);
    realtimeCollaboration.on('user:joined', handleUserJoined);
    realtimeCollaboration.on('user:left', handleUserLeft);

    return () => {
      realtimeCollaboration.off('connected', handleConnected);
      realtimeCollaboration.off('user:joined', handleUserJoined);
      realtimeCollaboration.off('user:left', handleUserLeft);
      realtimeCollaboration.disconnect();
    };
  }, [projectId, currentUser]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1,
        bgcolor: 'white',
        borderRadius: 1,
        boxShadow: 1}}>
      <Chip
        icon={<Circle sx={{ fontSize: 12 }} />}
        label={isConnected ? 'Connected' : 'Disconnected'}
        size="small"
        color={isConnected ? 'success' : 'default'}
      />
      <UserPresencePanel users={users} currentUserId={currentUser.id} />
    </Box>
  );
};
