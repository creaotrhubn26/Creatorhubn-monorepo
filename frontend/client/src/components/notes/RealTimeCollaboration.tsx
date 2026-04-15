// @ts-nocheck
/**
 * Real-time Collaboration Manager - Live editing, presence, and conflict resolution
 * Enables multiple users to collaborate on interactive documentation in real-time
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
  Card,
  CardContent,
  CardActions,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
  Badge,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  isOnline: boolean;
  lastSeen: Date;
  currentPosition?: {
    elementId: string;
    elementType: string;
    cursorPosition?: number;
};
}

interface CollaborationSession {
  id: string;
  title: string;
  description: string;
  owner: User;
  participants: User[];
  maxParticipants: number;
  isPublic: boolean;
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canInvite: boolean;
    canDelete: boolean;
};
  createdAt: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'ended'
}

interface Comment {
  id: string;
  author: User;
  content: string;
  elementId: string;
  position: {
    x: number;
    y: number;
};
  createdAt: Date;
  replies: Comment[];
  isResolved: boolean
}

interface Change {
  id: string;
  author: User;
  type: 'add' | 'edit' | 'delete' | 'move';
  elementId: string;
  data: any;
  timestamp: Date;
  version: number
}

interface RealTimeCollaborationProps {
  documentId: string;
  currentUser: User;
  onUserJoin: (user: User) => void;
  onUserLeave: (userId: string) => void;
  onContentChange: (change: Change) => void;
  onCommentAdd: (comment: Comment) => void;
  onCommentResolve: (commentId: string) => void;
  className?: string
}

export const RealTimeCollaboration: React.FC<RealTimeCollaborationProps> = ({
  documentd,
  currentUser,
  onUserJoin,
  onUserLeave,
  onContentChange,
  onCommentAdd,
  onCommentResolve,
  className,
}) => {
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [collaborationSession, setCollaborationSession] = useState<CollaborationSession | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [conflicts, setConflicts] = useState<Change[]>([]);
  const [showConflictResolution, setShowConflictResolution] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mock data for demonstration
  

  

  // WebSocket connection simulation
  useEffect(() => {
    // Simulate WebSocket connection
    const connect = () => {
      setIsConnected(true);
      setActiveUsers(mockUsers.filter(u => u.isOnline));
      setComments(mockComments);
      
      // Simulate real-time updates
      const interval = setInterval(() => {
        // Simulate user activity
        if (Math.random() > 0.7) {
          const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
          if (randomUser.isOnline) {
            setActiveUsers(prev => {
              const exists = prev.find(u => u.id === randomUser.id);
              if (!exists) {
                onUserJoin(randomUser);
                return [...prev, randomUser];
            }
              return prev;
          });
        }
      }
    }, 5000);

      return () => clearInterval(interval);
  };

    const disconnect = () => {
      setIsConnected(false);
      setActiveUsers([]);
  };

    connect();

    return () => {
      disconnect();
  };
}, [documentId, onUserJoin]);

  const handleInviteUser = useCallback(() => {
    if (!inviteEmail.trim()) return;

    // Simulate sending invite
    console.log('Inviting user: ', { email: inviteEmail, message: inviteMessage });
    
    setInviteEmail(', ');
    setInviteMessage(', ');
    setShowInviteDialog(false);
}, [inviteEmail, inviteMessage]);

  const handleAddComment = useCallback((elementId: string, content: string) => {
    const newComment: Comment = {
      id: Date.now().toString(),
      author: currentUser,
      content,
      elementId,
      position: { x: 0, y:  0 },
      createdAt: new Date(),
      replies:  [],
      isResolved: false
};

    setComments(prev => [...prev, newComment]);
    onCommentAdd(newComment);
}, [currentUser, onCommentAdd]);

  const handleResolveComment = useCallback((commentId: string) => {
    setComments(prev => 
      prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, isResolved: true }
          : comment
      )
    );
    onCommentResolve(commentId);
}, [onCommentResolve]);

  const handleTyping = useCallback(() => {
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
  }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
  }, 1000);
}, []);

  const handleConflictResolution = useCallback((changeId: string, resolution: 'accept' | 'reject') => {
    if (resolution === 'accept') {
      // Apply the change
      const change = conflicts.find(c => c.id === changeId);
      if (change) {
        onContentChange(change);
  }
  }
    
    setConflicts(prev => prev.filter(c => c.id !== changeId));
    
    if (conflicts.length === 1) {
      setShowConflictResolution(false);
  }
}, [conflicts, onContentChange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'ended': return 'error';
      default: return 'default';
}
};

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.group sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Real-time Collaboration</Typography>
              <Typography variant="body2" color="text.secondary">
                {isConnected ? 'Connected' : 'Disconnected'} • {activeUsers.length} users online
              </Typography>
            </Box>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => setShowInviteDialog(true)}
            >
              Invite
            </Button>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.comment />}
              onClick={() => setShowCommentsPanel(!showCommentsPanel)}
            >
              Comments ({comments.filter(c => !c.isResolved).length})
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Connection Status */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb:  2 }}>
          Connection lost. Attempting to reconnect...
        </Alert>
      )}

      {/* Active Users */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Active Users ({activeUsers.length})
        </Typography>
        
        <List dense>
          {activeUsers.map((user) => (
            <ListItem key={user.id}>
              <ListItemAvatar>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                  badgeContent={
                    <Box
                      sx={{
                        width:  12,
                        height:  12,
                        borderRadius: '50%',
                        bgcolor: user.isOnline ? 'success.main' : 'grey.40',
                        border: '2px solid white'
                  }}
                    />
                }
                >
                  <Avatar sx={{ bgcolor: user.color }}>
                    {user.name.charAt(0)}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              
              <ListItemText
                primary={user.name}
                secondary={
                  user.currentPosition 
                    ? `Editing ${user.currentPosition.elementType}` 
                    : 'Viewing document'
              }
              />
              
              <ListItemSecondaryAction>
                <Chip
                  label={user.isOnline ? 'Online' : formatLastSeen(user.lastSeen)}
                  size="small"
                  color={user.isOnline ? 'success' : 'default'}
                  variant="outlined"
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Comments Panel */}
      {showCommentsPanel && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Comments & Feedback
          </Typography>
          
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="All Comments" />
            <Tab label="Unresolved" />
            <Tab label="Resolved" />
          </Tabs>
          
          <Box sx={{ mt:  2 }}>
            {comments
              .filter(comment => {
                if (activeTab === 1) return !comment.isResolved;
                if (activeTab === 2) return comment.isResolved;
                return true;
            })
              .map((comment) => (
                <Card key={comment.id} variant="outlined" sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Avatar sx={{ bgcolor: comment.author.color, width:  32, height: 32}}>
                        {comment.author.name.charAt(0)}
                      </Avatar>
                      
                      <Box sx={{ flex:  1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb:  1 }}>
                          <Typography variant="subtitle2">{comment.author.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatLastSeen(comment.createdAt)}
                          </Typography>
                          {comment.isResolved && (
                            <Chip label="Resolved" size="small" color="success" />
                          )}
                        </Stack>
                        
                        <Typography variant="body2" sx={{ mb:  1 }}>
                          {comment.content}
                        </Typography>
                        
                        <Typography variant="caption" color="text.secondary">
                          Element: {comment.elementd}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                  
                  <CardActions sx={theming.getThemedCardSx()}>
                    {!comment.isResolved && (
                      <Button
                        size="small"
                        startIcon={<CREATOR_HUB_ICONS.checkCircle />}
                        onClick={() => handleResolveComment(comment.id)}
                      >
                        Resolve
                      </Button>
                    )}
                    <Button size="small" startIcon={<CREATOR_HUB_ICONS.reply />}>
                      Reply
                    </Button>
                  </CardActions>
                </Card>
              ))}
          </Box>
        </Paper>
      )}

      {/* Conflict Resolution */}
      {conflicts.length > 0 && (
        <Alert severity="warning" sx={{ mb:  2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {conflicts.length} conflict(s) detected
          </Typography>
          <Button
            size="small"
            onClick={() => setShowConflictResolution(true)}
          >
            Resolve Conflicts
          </Button>
        </Alert>
      )}

      {/* Invite Dialog */}
      <Dialog 
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.add />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Invite Collaborators</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
            />
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Message (Optional)"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              placeholder="Add a personal message..."
            />
            
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Allow editing"
            />
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={handleInviteUser}
            disabled={!inviteEmail.trim()}
           sx={theming.getThemedButtonSx()}>
            Send Invite
          </Button>
        </DialogActions>
      </Dialog>

      {/* Conflict Resolution Dialog */}
      <Dialog 
        open={showConflictResolution}
        onClose={() => setShowConflictResolution(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.warning />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Resolve Conflicts</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={2}>
            {conflicts.map((conflict) => (
              <Card key={conflict.id} variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:  2 }}>
                    <Avatar sx={{ bgcolor: conflict.author.color, width:  32, height: 32}}>
                      {conflict.author.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2">{conflict.author.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {conflict.type} • {formatLastSeen(conflict.timestamp)}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  <Typography variant="body2" sx={{ mb:  2 }}>
                    {JSON.stringify(conflict.data, null, 2)}
                  </Typography>
                  
                  <Stack direction="row" spacing={1}>
                    <Button size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleConflictResolution(conflict.id, 'accept')}
                      sx={theming.getThemedButtonSx()}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleConflictResolution(conflict.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowConflictResolution(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RealTimeCollaboration;
