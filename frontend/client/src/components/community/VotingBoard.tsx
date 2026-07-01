// @ts-nocheck
/**
 * CreatorHub Norge Community - Voting Board System
 * 
 * Allows admins and promoted users to create voting boards for feature requests
 * Users can vote, comment, and track the status of their requests
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemIcon,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Badge,
  Collapse,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ThumbUp,
  ThumbDown,
  ThumbUpOutlined,
  ThumbDownOutlined,
  Add,
  Comment,
  MoreVert,
  Search,
  FilterList,
  Sort,
  HowToVote,
  Lightbulb,
  CheckCircle,
  Schedule,
  Build,
  Close,
  Cancel,
  ContentCopy,
  Flag,
  TrendingUp,
  NewReleases,
  AccessTime,
  Edit,
  Delete,
  Reply,
  ExpandMore,
  ExpandLess,
  ArrowBack,
  NotificationsActive,
  OpenInNew,
  Label,
  Groups,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import type { SnackbarKey} from 'notistack';
import { useSnackbar, SnackbarContent } from 'notistack';
import { forwardRef } from 'react';
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SWITCH_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

// ============================================
// VOTING NOTIFICATION INTERFACE
// ============================================

interface VotingNotification {
  id: string;
  boardId: string;
  boardTitle: string;
  boardDescription: string;
  boardType: string;
  creatorName: string;
  createdAt: string;
  itemCount: number;
  dismissed: boolean;
}

// ============================================
// CONFIGURATION OBJECTS
// ============================================

const boardTypeConfig: Record<string, { label: string; icon: React.ReactElement }> = {
  feature_request: { label: 'Funksjonsønsker', icon: <Lightbulb fontSize="small" /> },
  poll: { label: 'Avstemning', icon: <HowToVote fontSize="small" /> },
  priority: { label: 'Prioritering', icon: <TrendingUp fontSize="small" /> },
  feedback: { label: 'Tilbakemelding', icon: <Comment fontSize="small" /> },
  general: { label: 'Generelt', icon: <Flag fontSize="small" /> },
};

// ============================================
// CUSTOM VOTING NOTIFICATION COMPONENT
// ============================================

interface VotingNotificationContentProps {
  id: SnackbarKey;
  notification: VotingNotification;
  onJoin: (notification: VotingNotification) => void;
  onDismiss: (notificationId: string, snackbarKey: SnackbarKey) => void;
}

const VotingNotificationContent = forwardRef<HTMLDivElement, VotingNotificationContentProps>(
  ({ id, notification, onJoin, onDismiss }, ref) => {
    return (
      <SnackbarContent ref={ref}>
        <Paper
          elevation={8}
          sx={{
            p: 0,
            borderRadius: 3,
            overflow: 'hidden',
            maxWidth: 420,
            border: '2px solid #FF8C00',
            background: 'linear-gradient(135deg, #fff 0%, #fff8f0 100%)',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: '#FF8C00',
              color: 'white',
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HowToVote />
              <Typography variant="subtitle1" fontWeight={600}>
                🗳️ Ny avstemning pågår!
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => onDismiss(notification.id, id)}
              sx={{ color: 'white' }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {notification.boardTitle}
            </Typography>
            
            {notification.boardDescription && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {notification.boardDescription}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                icon={boardTypeConfig[notification.boardType]?.icon}
                label={boardTypeConfig[notification.boardType]?.label}
                sx={{ bgcolor: 'rgba(255, 140, 0, 0.1)', color: '#FF8C00' }}
              />
              <Chip
                size="small"
                icon={<AccessTime fontSize="small" />}
                label={formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: nb })}
                variant="outlined"
              />
              {notification.itemCount > 0 && (
                <Chip
                  size="small"
                  label={`${notification.itemCount} forslag`}
                  variant="outlined"
                />
              )}
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Opprettet av {notification.creatorName}
            </Typography>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<OpenInNew />}
                onClick={() => onJoin(notification)}
                sx={{ 
                  bgcolor: '#FF8C00', 
                  '&:hover': { bgcolor: '#e67e00' },
                  fontWeight: 600,
                }}
              >
                Delta i avstemningen
              </Button>
              <Button
                variant="outlined"
                onClick={() => onDismiss(notification.id, id)}
                sx={{ 
                  borderColor: 'grey.300',
                  color: 'text.secondary',
                  minWidth: 'auto',
                  px: 2,
                }}
              >
                Senere
              </Button>
            </Box>
          </Box>
        </Paper>
      </SnackbarContent>
    );
  }
);

// ============================================
// INTERFACES
// ============================================

interface VotingBoard {
  id: string;
  group_id: string;
  title: string;
  description: string;
  board_type: 'feature_request' | 'poll' | 'priority' | 'feedback' | 'general';
  status: 'active' | 'closed' | 'archived';
  created_by: string;
  creator_name?: string;
  creator_avatar?: string;
  allow_new_items: boolean;
  allow_comments: boolean;
  anonymous_voting: boolean;
  max_votes_per_user?: number;
  voting_deadline?: string;
  created_at: string;
  item_count?: number;
  total_votes?: number;
}

interface VotingItem {
  id: string;
  board_id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'open' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'declined' | 'duplicate';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by: string;
  creator_name?: string;
  creator_avatar?: string;
  is_anonymous: boolean;
  upvotes: number;
  downvotes: number;
  score: number;
  admin_response?: string;
  admin_response_by?: string;
  admin_response_at?: string;
  created_at: string;
  comment_count?: number;
  tags?: VotingTag[];
  userVote?: 'up' | 'down' | null;
}

interface VotingComment {
  id: string;
  item_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  content: string;
  is_admin_comment: boolean;
  parent_comment_id?: string;
  created_at: string;
}

interface VotingTag {
  id: string;
  name: string;
  color: string;
}

interface VotingPermissions {
  canCreateBoard: boolean;
  canCreateItem: boolean;
  canModerate: boolean;
  isAdmin: boolean;
}

interface VotingBoardProps {
  groupId: string;
  userId: string;
  onClose?: () => void;
}

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  open: { label: 'Åpen', color: '#2196f3', icon: <NewReleases fontSize="small" /> },
  under_review: { label: 'Under vurdering', color: '#ff9800', icon: <Search fontSize="small" /> },
  planned: { label: 'Planlagt', color: '#9c27b0', icon: <Schedule fontSize="small" /> },
  in_progress: { label: 'Under utvikling', color: '#ff5722', icon: <Build fontSize="small" /> },
  completed: { label: 'Fullført', color: '#4caf50', icon: <CheckCircle fontSize="small" /> },
  declined: { label: 'Avslått', color: '#f44336', icon: <Cancel fontSize="small" /> },
  duplicate: { label: 'Duplikat', color: '#9e9e9e', icon: <ContentCopy fontSize="small" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Lav', color: '#4caf50' },
  medium: { label: 'Medium', color: '#ff9800' },
  high: { label: 'Høy', color: '#f44336' },
  critical: { label: 'Kritisk', color: '#9c27b0' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function VotingBoard({ groupId, userId, onClose }: VotingBoardProps) {
  // State
  const [boards, setBoards] = useState<VotingBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<VotingBoard | null>(null);
  const [items, setItems] = useState<VotingItem[]>([]);
  const [tags, setTags] = useState<VotingTag[]>([]);
  const [permissions, setPermissions] = useState<VotingPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VotingItem | null>(null);
  const [comments, setComments] = useState<VotingComment[]>([]);

  // Dialog states
  const [createBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [createItemDialogOpen, setCreateItemDialogOpen] = useState(false);
  const [itemDetailDialogOpen, setItemDetailDialogOpen] = useState(false);

  // Filter/Sort states
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'oldest' | 'comments'>('score');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newBoardType, setNewBoardType] = useState<string>('feature_request');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemAnonymous, setNewItemAnonymous] = useState(false);
  const [newComment, setNewComment] = useState('');

  // Notification states
  const [activeVotingNotifications, setActiveVotingNotifications] = useState<VotingNotification[]>([]);
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [shownNotificationIds, setShownNotificationIds] = useState<Set<string>>(new Set());
  
  // Notistack hook
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  // Tab/Filter/Sort states
  const [activeTab, setActiveTab] = useState(0);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [itemMenuAnchor, setItemMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<VotingItem | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchBoards = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/voting/boards?groupId=${groupId}`);
      if (response.success) {
        setBoards(response.boards || []);
      }
    } catch (error) {
      console.error('Error fetching voting boards: ', error);
    }
  }, [groupId]);

  const fetchBoardDetails = useCallback(async (boardId: string) => {
    try {
      setLoading(true);
      const response = await apiRequest(
        `/api/community/voting/boards/${boardId}?sortBy=${sortBy}&status=${filterStatus !== 'all' ? filterStatus : ','}`
      );
      if (response.success) {
        setSelectedBoard(response.board);
        setItems(response.items || []);
        setTags(response.tags || []);
      }
    } catch (error) {
      console.error('Error fetching board details:', error);
    } finally {
      setLoading(false);
    }
  }, [sortBy, filterStatus]);

  const fetchItemDetails = useCallback(async (itemId: string) => {
    try {
      const response = await apiRequest(`/api/community/voting/items/${itemId}?userId=${userId}`);
      if (response.success) {
        setSelectedItem(response.item);
        setComments(response.comments || []);
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  }, [userId]);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/voting/user-permissions?groupId=${groupId}&userId=${userId}`);
      if (response.success) {
        setPermissions(response.permissions);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  }, [groupId, userId]);

  // ============================================
  // VOTING NOTIFICATIONS
  // ============================================

  // Dismiss a voting notification and close snackbar
  const dismissNotification = useCallback((notificationId: string, snackbarKey?: SnackbarKey) => {
    // Store in localStorage
    const dismissedIds = JSON.parse(localStorage.getItem(`voting_dismissed_${userId}`) || '[]');
    if (!dismissedIds.includes(notificationId)) {
      dismissedIds.push(notificationId);
      localStorage.setItem(`voting_dismissed_${userId}`, JSON.stringify(dismissedIds));
    }
    
    // Close the snackbar if key is provided
    if (snackbarKey) {
      closeSnackbar(snackbarKey);
    }
    
    // Remove from active notifications
    setActiveVotingNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, [userId, closeSnackbar]);

  // Join voting from notification
  const joinVotingFromNotification = useCallback((notification: VotingNotification) => {
    // Find and select the board
    const board = boards.find(b => b.id === notification.boardId);
    if (board) {
      setSelectedBoard(board);
    }
    // Dismiss after joining
    dismissNotification(notification.id);
  }, [boards, dismissNotification]);

  // Show a voting notification using notistack
  const showVotingNotification = useCallback((notification: VotingNotification) => {
    // Don't show if already shown
    if (shownNotificationIds.has(notification.id)) return;
    
    setShownNotificationIds(prev => new Set(prev).add(notification.id));
    
    enqueueSnackbar('', {
      key: `voting-${notification.id}`,
      persist: true,
      anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
      content: (key) => (
        <VotingNotificationContent
          id={key}
          notification={notification}
          onJoin={joinVotingFromNotification}
          onDismiss={dismissNotification}
        />
      ),
    });
  }, [enqueueSnackbar, shownNotificationIds, joinVotingFromNotification, dismissNotification]);

  // Fetch active voting notifications for the user
  const fetchVotingNotifications = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/community/voting/notifications?groupId=${groupId}&userId=${userId}`);
      if (response.success && response.notifications) {
        // Filter out dismissed notifications
        const dismissedIds = JSON.parse(localStorage.getItem(`voting_dismissed_${userId}`) || '[]');
        const activeNotifications = response.notifications.filter(
          (n: VotingNotification) => !dismissedIds.includes(n.id)
        );
        setActiveVotingNotifications(activeNotifications);
        
        // Show notifications using notistack
        activeNotifications.forEach((notification: VotingNotification) => {
          showVotingNotification(notification);
        });
      }
    } catch (error) {
      console.error('Error fetching voting notifications:', error);
    }
  }, [groupId, userId, showVotingNotification]);

  // Send notification to group members when a new voting is created
  const sendVotingNotification = useCallback(async (board: {
    id: string;
    title: string;
    description: string;
    boardType: string;
  }) => {
    if (!notifyOnCreate) return;
    
    try {
      await apiRequest('/api/community/voting/notify-members', {
        method: 'POST',
        body: JSON.stringify({
          groupId,
          boardId: board.id,
          boardTitle: board.title,
          boardDescription: board.description,
          boardType: board.boardType,
          createdBy: userId,
          notificationType: 'new_voting',
        }),
      });
      
      // Show success message
      enqueueSnackbar('Gruppemedlemmer har blitt varslet om avstemningen! 🔔', { 
        variant: 'success',
        autoHideDuration: 4000,
      });
    } catch (error) {
      console.error('Error sending voting notification:', error);
      enqueueSnackbar('Kunne ikke sende varsler til gruppemedlemmer', { variant: 'error' });
    }
  }, [groupId, userId, notifyOnCreate, enqueueSnackbar]);

  useEffect(() => {
    fetchBoards();
    fetchPermissions();
    fetchVotingNotifications();
    setLoading(false);
  }, [fetchBoards, fetchPermissions, fetchVotingNotifications]);

  // Poll for new voting notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchVotingNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchVotingNotifications]);

  useEffect(() => {
    if (selectedBoard) {
      fetchBoardDetails(selectedBoard.id);
    }
  }, [selectedBoard?.id, sortBy, filterStatus, fetchBoardDetails]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleCreateBoard = async () => {
    if (!newBoardTitle.trim()) return;

    try {
      const response = await apiRequest('/api/community/voting/boards', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          groupId,
          title: newBoardTitle,
          description: newBoardDescription,
          boardType: newBoardType,
          notifyMembers: notifyOnCreate,
        }),
      });

      if (response.success) {
        // Send notification to all group members about the new voting
        if (notifyOnCreate && response.board) {
          await sendVotingNotification({
            id: response.board.id,
            title: newBoardTitle,
            description: newBoardDescription,
            boardType: newBoardType,
          });
        }
        
        fetchBoards();
        setCreateBoardDialogOpen(false);
        setNewBoardTitle('');
        setNewBoardDescription('');
        setNewBoardType('feature_request');
      }
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  const handleCreateItem = async () => {
    if (!newItemTitle.trim() || !selectedBoard) return;

    try {
      const response = await apiRequest('/api/community/voting/items', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          boardId: selectedBoard.id,
          title: newItemTitle,
          description: newItemDescription,
          isAnonymous: newItemAnonymous,
        }),
      });

      if (response.success) {
        fetchBoardDetails(selectedBoard.id);
        setCreateItemDialogOpen(false);
        setNewItemTitle('');
        setNewItemDescription('');
        setNewItemAnonymous(false);
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const handleVote = async (itemId: string, voteType: 'up' | 'down') => {
    try {
      const item = items.find(i => i.id === itemId);
      
      // If user already voted the same way, remove vote
      if (item?.userVote === voteType) {
        await apiRequest('/api/community/voting/vote', {
          method: 'DELETE',
          body: JSON.stringify({ userId, itemId }),
        });
      } else {
        await apiRequest('/api/community/voting/vote', {
          method: 'POST',
          body: JSON.stringify({ userId, itemId, voteType }),
        });
      }

      // Update local state
      setItems(prev => prev.map(i => {
        if (i.id === itemId) {
          const wasUp = i.userVote === 'up';
          const wasDown = i.userVote === 'down';
          const nowUp = voteType === 'up' && i.userVote !== 'up';
          const nowDown = voteType === 'down' && i.userVote !== 'down';
          const removing = i.userVote === voteType;

          let newUpvotes = i.upvotes;
          let newDownvotes = i.downvotes;

          if (wasUp) newUpvotes--;
          if (wasDown) newDownvotes--;
          if (nowUp) newUpvotes++;
          if (nowDown) newDownvotes++;

          return {
            ...i,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
            score: newUpvotes - newDownvotes,
            userVote: removing ? null : voteType,
          };
        }
        return i;
      }));

      // Update selected item if viewing details
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? {
          ...prev,
          userVote: prev.userVote === voteType ? null : voteType,
        } : null);
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedItem) return;

    try {
      const response = await apiRequest('/api/community/voting/comments', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          itemId: selectedItem.id,
          content: newComment,
        }),
      });

      if (response.success) {
        setComments(prev => [...prev, response.comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Handle delete item
  const handleDeleteItem = async (itemId: string) => {
    try {
      const response = await apiRequest(`/api/community/voting/items/${itemId}`, {
        method: 'DELETE',
      });
      if (response.success) {
        setItems(prev => prev.filter(i => i.id !== itemId));
        setItemMenuAnchor(null);
        setMenuItemId(null);
        enqueueSnackbar('Forslaget ble slettet', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      enqueueSnackbar('Kunne ikke slette forslaget', { variant: 'error' });
    }
  };

  // Handle edit item
  const handleEditItem = async () => {
    if (!editingItem) return;
    try {
      const response = await apiRequest(`/api/community/voting/items/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingItem.title,
          description: editingItem.description,
        }),
      });
      if (response.success) {
        setItems(prev => prev.map(i => 
          i.id === editingItem.id ? { ...i, title: editingItem.title, description: editingItem.description } : i
        ));
        setEditingItem(null);
        enqueueSnackbar('Forslaget ble oppdatert', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error editing item:', error);
      enqueueSnackbar('Kunne ikke oppdatere forslaget', { variant: 'error' });
    }
  };

  // Handle reply to comment
  const handleReplyToComment = async (parentCommentId: string) => {
    if (!replyContent.trim() || !selectedItem) return;
    try {
      const response = await apiRequest('/api/community/voting/comments', {
        method: 'POST',
        body: JSON.stringify({
          itemId: selectedItem.id,
          userId,
          content: replyContent,
          parentId: parentCommentId,
        }),
      });
      if (response.success) {
        setComments(prev => [...prev, response.comment]);
        setReplyContent('');
        setReplyingToComment(null);
        enqueueSnackbar('Svar lagt til', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error replying to comment:', error);
    }
  };

  // Toggle item expansion
  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Open item menu
  const handleItemMenuOpen = (event: React.MouseEvent<HTMLElement>, itemId: string) => {
    setItemMenuAnchor(event.currentTarget);
    setMenuItemId(itemId);
  };

  // Get filtered and sorted items based on active tab
  const getFilteredItemsByTab = () => {
    let result = [...filteredItems];
    
    switch (activeTab) {
      case 0: // All
        break;
      case 1: // Popular (sorted by score)
        result.sort((a, b) => b.score - a.score);
        break;
      case 2: // Recent (sorted by date)
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 3: // My votes
        result = result.filter(item => item.userVote);
        break;
    }
    
    return result;
  };

  // ============================================
  // FILTERED ITEMS
  // ============================================

  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(query) && 
          !item.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  // ============================================
  // RENDER
  // ============================================

  // Board List View
  if (!selectedBoard) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onClose && (
              <IconButton onClick={onClose}>
                <ArrowBack />
              </IconButton>
            )}
            <Typography variant="h5" fontWeight={600}>
              <HowToVote sx={{ mr: 1, verticalAlign: 'middle' }} />
              Stemmebrett
            </Typography>
          </Box>
          {permissions?.canCreateBoard && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateBoardDialogOpen(true)}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            Nytt stemmebrett
          </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : boards.length === 0 ? (
          <Paper sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, p: 4, textAlign: 'center' }}>
            <HowToVote sx={{ fontSize: 64, color: COMMUNITY_DIALOG_MUTED, mb: 2 }} />
            <Typography variant="h6" sx={{ color: COMMUNITY_DIALOG_MUTED }} gutterBottom>
              Ingen stemmebrett ennå
            </Typography>
            <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
              {permissions?.canCreateBoard
                ? 'Opprett et nytt stemmebrett for å samle tilbakemeldinger og feature requests.'
                : 'Administratorer kan opprette stemmebrett for denne gruppen.'}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
            {boards.map(board => (
              <Card
                key={board.id}
                sx={{
                  ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                    borderColor: 'rgba(255, 140, 0, 0.24)',
                  },
                  border: board.status !== 'active' ? '2px solid' : undefined,
                  borderColor: board.status === 'closed' ? 'error.main' : 'grey.400'}}
                onClick={() => setSelectedBoard(board)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {boardTypeConfig[board.board_type]?.icon}
                    <Typography variant="h6" sx={{ flex: 1 }}>
                      {board.title}
                    </Typography>
                    <Chip
                      label={board.status === 'active' ? 'Aktiv' : board.status === 'closed' ? 'Lukket' : 'Arkivert'}
                      size="small"
                      color={board.status === 'active' ? 'success' : board.status === 'closed' ? 'error' : 'default'}
                    />
                  </Box>
                  {board.description && (
                    <Typography variant="body2" sx={{ mb: 2, color: COMMUNITY_DIALOG_MUTED }}>
                      {board.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Tooltip title="Antall forslag">
                        <Chip
                          icon={<Lightbulb />}
                          label={board.item_count || 0}
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                      <Tooltip title="Totalt antall stemmer">
                        <Chip
                          icon={<ThumbUp />}
                          label={board.total_votes || 0}
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                    </Box>
                    <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                      {formatDistanceToNow(new Date(board.created_at), { addSuffix: true, locale: nb })}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {/* Create Board Dialog */}
        <Dialog
          open={createBoardDialogOpen}
          onClose={() => setCreateBoardDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          sx={COMMUNITY_DIALOG_SX}
          PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
        >
          <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>Opprett nytt stemmebrett</DialogTitle>
          <DialogContent
            sx={{
              ...COMMUNITY_DIALOG_CONTENT_SX,
              '& .MuiFormControl-root': COMMUNITY_DIALOG_FIELD_SX,
              '& .MuiTextField-root': COMMUNITY_DIALOG_FIELD_SX,
              '& .MuiSwitch-root': COMMUNITY_DIALOG_SWITCH_SX,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Tittel"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Beskrivelse"
                value={newBoardDescription}
                onChange={(e) => setNewBoardDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
              />
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newBoardType}
                  onChange={(e) => setNewBoardType(e.target.value)}
                  label="Type"
                >
                  {Object.entries(boardTypeConfig).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {config.icon}
                        {config.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Notify members option */}
              <Paper 
                sx={{ 
                  ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
                  p: 2, 
                  bgcolor: notifyOnCreate ? 'rgba(255, 140, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: notifyOnCreate ? '1px solid #FF8C00' : '1px solid transparent',
                  borderRadius: 2
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifyOnCreate}
                      onChange={(e) => setNotifyOnCreate(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#FF8C00',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#FF8C00',
                        },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NotificationsActive sx={{ color: notifyOnCreate ? '#FF8C00' : 'text.secondary' }} />
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          Varsle gruppemedlemmer
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Send en notifikasjon til alle medlemmer om denne avstemningen
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
                {notifyOnCreate && (
                  <Alert severity="info" sx={{ mt: 1 }} icon={<Groups />}>
                    Alle gruppemedlemmer vil motta en notifikasjon med mulighet til å delta i avstemningen.
                  </Alert>
                )}
              </Paper>
            </Box>
          </DialogContent>
        <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
          <Button onClick={() => setCreateBoardDialogOpen(false)} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
            Avbryt
          </Button>
          <Button
            onClick={handleCreateBoard}
            variant="contained"
            disabled={!newBoardTitle.trim()}
            startIcon={notifyOnCreate ? <NotificationsActive /> : undefined}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            {notifyOnCreate ? 'Opprett og varsle' : 'Opprett'}
          </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Board Detail View
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => setSelectedBoard(null)}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {selectedBoard.title}
            </Typography>
            {selectedBoard.description && (
              <Typography variant="body2" color="text.secondary">
                {selectedBoard.description}
              </Typography>
            )}
          </Box>
        </Box>
        {selectedBoard.allow_new_items && selectedBoard.status === 'active' && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateItemDialogOpen(true)}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            Nytt forslag
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Søk i forslag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )}}
          />
          <Tooltip title="Sortering">
            <IconButton onClick={(e) => setSortMenuAnchor(e.currentTarget)}>
              <Badge color="primary" variant="dot" invisible={sortBy === 'score'}>
                <Sort />
              </Badge>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={() => setSortMenuAnchor(null)}
          >
            <MenuItem 
              selected={sortBy === 'score'} 
              onClick={() => { setSortBy('score'); setSortMenuAnchor(null); }}
            >
              <ListItemIcon><TrendingUp fontSize="small" /></ListItemIcon>
              <ListItemText>Mest stemt</ListItemText>
            </MenuItem>
            <MenuItem 
              selected={sortBy === 'newest'} 
              onClick={() => { setSortBy('newest'); setSortMenuAnchor(null); }}
            >
              <ListItemIcon><NewReleases fontSize="small" /></ListItemIcon>
              <ListItemText>Nyeste</ListItemText>
            </MenuItem>
            <MenuItem 
              selected={sortBy === 'oldest'} 
              onClick={() => { setSortBy('oldest'); setSortMenuAnchor(null); }}
            >
              <ListItemIcon><AccessTime fontSize="small" /></ListItemIcon>
              <ListItemText>Eldste</ListItemText>
            </MenuItem>
            <MenuItem 
              selected={sortBy === 'comments'} 
              onClick={() => { setSortBy('comments'); setSortMenuAnchor(null); }}
            >
              <ListItemIcon><Comment fontSize="small" /></ListItemIcon>
              <ListItemText>Mest diskutert</ListItemText>
            </MenuItem>
          </Menu>
          
          <Tooltip title="Filter">
            <IconButton onClick={(e) => setFilterMenuAnchor(e.currentTarget)}>
              <Badge color="primary" variant="dot" invisible={filterStatus === 'all'}>
                <FilterList />
              </Badge>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={filterMenuAnchor}
            open={Boolean(filterMenuAnchor)}
            onClose={() => setFilterMenuAnchor(null)}
          >
            <MenuItem 
              selected={filterStatus === 'all'} 
              onClick={() => { setFilterStatus('all'); setFilterMenuAnchor(null); }}
            >
              <ListItemText>Alle statuser</ListItemText>
            </MenuItem>
            <Divider />
            {Object.entries(statusConfig).map(([key, config]) => (
              <MenuItem 
                key={key}
                selected={filterStatus === key} 
                onClick={() => { setFilterStatus(key); setFilterMenuAnchor(null); }}
              >
                <ListItemIcon>{config.icon}</ListItemIcon>
                <ListItemText>{config.label}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Paper>

      {/* Tabs for filtering */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Alle" icon={<HowToVote />} iconPosition="start" />
          <Tab label="Populære" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Nyeste" icon={<NewReleases />} iconPosition="start" />
          <Tab 
            label={
              <Badge badgeContent={items.filter(i => i.userVote).length} color="primary">
                Mine stemmer
              </Badge>
            } 
          />
        </Tabs>
      </Paper>

      {/* Notification indicator */}
      {activeVotingNotifications.length > 0 && (
        <Alert 
          severity="info" 
          icon={<NotificationsActive />}
          sx={{ mb: 2 }}
          action={
            <Button size="small" onClick={() => activeVotingNotifications[0] && joinVotingFromNotification(activeVotingNotifications[0])}>
              Se ny avstemning
            </Button>
          }
        >
          Du har {activeVotingNotifications.length} nye avstemning{activeVotingNotifications.length > 1 ? 'er' : ''} å sjekke ut!
        </Alert>
      )}

      {/* Tags filter */}
      {tags.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Label sx={{ color: 'text.secondary', mr: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Tags:
            </Typography>
            {tags.map(tag => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                sx={{ bgcolor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Items List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : getFilteredItemsByTab().length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Lightbulb sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Ingen forslag funnet
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {getFilteredItemsByTab().map(item => (
            <Card key={item.id} sx={{ display: 'flex' }}>
              {/* Vote Section */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 2,
                  borderRight: 1,
                  borderColor: 'divider',
                  minWidth: 80,
                  bgcolor: 'grey.50'}}
              >
                <IconButton
                  onClick={() => handleVote(item.id, 'up')}
                  color={item.userVote === 'up' ? 'primary' : 'default'}
                >
                  {item.userVote === 'up' ? <ThumbUp /> : <ThumbUpOutlined />}
                </IconButton>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  color={item.score > 0 ? 'success.main' : item.score < 0 ? 'error.main' : 'text.secondary'}
                >
                  {item.score}
                </Typography>
                <IconButton
                  onClick={() => handleVote(item.id, 'down')}
                  color={item.userVote === 'down' ? 'error' : 'default'}
                >
                  {item.userVote === 'down' ? <ThumbDown /> : <ThumbDownOutlined />}
                </IconButton>
              </Box>

              {/* Content Section */}
              <CardContent
                sx={{ flex: 1, cursor: 'pointer' }}
                onClick={() => {
                  fetchItemDetails(item.id);
                  setItemDetailDialogOpen(true);
                }}
              >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ flex: 1 }}>
                      {item.title}
                    </Typography>
                    <Chip
                      icon={statusConfig[item.status]?.icon}
                      label={statusConfig[item.status]?.label}
                      size="small"
                      sx={{
                        bgcolor: statusConfig[item.status]?.color,
                        color: 'white','& .MuiChip-icon': { color: 'white' }}}
                    />
                  </Box>
                {item.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      mb: 1}}
                  >
                    {item.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Avatar
                      src={item.creator_avatar || undefined}
                      sx={{ width: 24, height: 24 }}
                    >
                      {item.creator_name?.[0]}
                    </Avatar>
                    <Typography variant="caption" color="text.secondary">
                      {item.is_anonymous ? 'Anonym' : item.creator_name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    <AccessTime sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: nb })}
                  </Typography>
                  <Chip
                    icon={<Comment />}
                    label={item.comment_count || 0}
                    size="small"
                    variant="outlined"
                  />
                  {item.tags?.map(tag => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      size="small"
                      sx={{ bgcolor: tag.color, color: 'white' }}
                    />
                  ))}
                </Box>

                {/* Expandable description */}
                <Collapse in={expandedItems.has(item.id)}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2">
                      {item.description}
                    </Typography>
                  </Box>
                </Collapse>
              </CardContent>

              {/* Actions menu */}
              <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
                <Tooltip title={expandedItems.has(item.id) ? 'Skjul detaljer' : 'Vis detaljer'}>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItemExpansion(item.id);
                    }}
                  >
                    {expandedItems.has(item.id) ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Tooltip>
                
                {(permissions?.canModerate || item.created_by === userId) && (
                  <Tooltip title="Flere valg">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemMenuOpen(e, item.id);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Card>
          ))}
        </Box>
      )}

      {/* Item context menu */}
      <Menu
        anchorEl={itemMenuAnchor}
        open={Boolean(itemMenuAnchor)}
        onClose={() => {
          setItemMenuAnchor(null);
          setMenuItemId(null);
        }}
      >
        <MenuItem onClick={() => {
          const item = items.find(i => i.id === menuItemId);
          if (item) {
            setEditingItem(item);
            setItemMenuAnchor(null);
          }
        }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Rediger</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (menuItemId) {
            handleDeleteItem(menuItemId);
          }
        }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Slett</ListItemText>
        </MenuItem>
      </Menu>

      {/* Edit item dialog */}
      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        maxWidth="sm"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>Rediger forslag</DialogTitle>
        <DialogContent sx={{ ...COMMUNITY_DIALOG_CONTENT_SX, '& .MuiTextField-root': COMMUNITY_DIALOG_FIELD_SX }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Tittel"
              value={editingItem?.title || ''}
              onChange={(e) => setEditingItem(prev => prev ? { ...prev, title: e.target.value } : null)}
              fullWidth
              required
            />
            <TextField
              label="Beskrivelse"
              value={editingItem?.description || ''}
              onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
              fullWidth
              multiline
              rows={4}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
          <Button onClick={() => setEditingItem(null)} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>Avbryt</Button>
          <Button 
            variant="contained" 
            onClick={handleEditItem}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Item Dialog */}
      <Dialog
        open={createItemDialogOpen}
        onClose={() => setCreateItemDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>Legg til nytt forslag</DialogTitle>
        <DialogContent
          sx={{
            ...COMMUNITY_DIALOG_CONTENT_SX,
            '& .MuiTextField-root': COMMUNITY_DIALOG_FIELD_SX,
            '& .MuiSwitch-root': COMMUNITY_DIALOG_SWITCH_SX,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Tittel"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              fullWidth
              required
              placeholder="Beskriv forslaget ditt kort og tydelig"
            />
            <TextField
              label="Beskrivelse"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              fullWidth
              multiline
              rows={4}
              placeholder="Gi mer detaljer om forslaget ditt, hvorfor det er viktig, og hvordan det kan implementeres"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={newItemAnonymous}
                  onChange={(e) => setNewItemAnonymous(e.target.checked)}
                />
              }
              label="Send inn anonymt"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
          <Button onClick={() => setCreateItemDialogOpen(false)} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
            Avbryt
          </Button>
          <Button
            onClick={handleCreateItem}
            variant="contained"
            disabled={!newItemTitle.trim()}
            sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
          >
            Send inn
          </Button>
        </DialogActions>
      </Dialog>

      {/* Item Detail Dialog */}
      <Dialog
        open={itemDetailDialogOpen}
        onClose={() => setItemDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        {selectedItem && (
          <>
            <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
                  {selectedItem.title}
                </Typography>
                <IconButton onClick={() => setItemDetailDialogOpen(false)} sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ ...COMMUNITY_DIALOG_CONTENT_SX, '& .MuiTextField-root': COMMUNITY_DIALOG_FIELD_SX }} dividers>
              <Box sx={{ display: 'flex', gap: 3 }}>
                {/* Vote Section */}
                <Box
                  sx={{
                    ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    minWidth: 100}}
                >
                  <IconButton
                    onClick={() => handleVote(selectedItem.id, 'up')}
                    color={selectedItem.userVote === 'up' ? 'primary' : 'default'}
                    size="large"
                  >
                    {selectedItem.userVote === 'up' ? <ThumbUp /> : <ThumbUpOutlined />}
                  </IconButton>
                  <Typography variant="h4" fontWeight={600}>
                    {selectedItem.score}
                  </Typography>
                  <IconButton
                    onClick={() => handleVote(selectedItem.id, 'down')}
                    color={selectedItem.userVote === 'down' ? 'error' : 'default'}
                    size="large"
                  >
                    {selectedItem.userVote === 'down' ? <ThumbDown /> : <ThumbDownOutlined />}
                  </IconButton>
                  <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                    {selectedItem.upvotes} opp / {selectedItem.downvotes} ned
                  </Typography>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={statusConfig[selectedItem.status]?.icon}
                      label={statusConfig[selectedItem.status]?.label}
                      sx={{
                        bgcolor: statusConfig[selectedItem.status]?.color,
                        color: 'white','& .MuiChip-icon': { color: 'white' }}}
                    />
                    <Chip
                      label={priorityConfig[selectedItem.priority]?.label}
                      sx={{
                        bgcolor: priorityConfig[selectedItem.priority]?.color,
                        color: 'white'}}
                    />
                  </Box>

                  {selectedItem.description && (
                    <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                      {selectedItem.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar src={selectedItem.creator_avatar || undefined}>
                      {selectedItem.creator_name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {selectedItem.is_anonymous ? 'Anonym' : selectedItem.creator_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                        {formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true, locale: nb })}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Admin Response */}
                  {selectedItem.admin_response && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Offisielt svar:
                      </Typography>
                      <Typography variant="body2">{selectedItem.admin_response}</Typography>
                    </Alert>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Comments */}
                  <Typography variant="h6" gutterBottom>
                    Kommentarer ({comments.length})
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Skriv en kommentar..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                    />
                    <Button
                      variant="contained"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      sx={COMMUNITY_DIALOG_PRIMARY_BUTTON_SX}
                    >
                      Send
                    </Button>
                  </Box>

                  <List>
                    {comments.map(comment => (
                      <React.Fragment key={comment.id}>
                        <ListItem
                          sx={{
                            bgcolor: comment.is_admin_comment ? 'primary.50' : undefined,
                            borderRadius: 1,
                            mb: 1}}
                        >
                          <ListItemAvatar>
                            <Avatar src={comment.user_avatar || undefined}>
                              {comment.user_name?.[0]}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems:'center', gap: 1 }}>
                                <Typography variant="subtitle2">
                                  {comment.user_name}
                                </Typography>
                                {comment.is_admin_comment && (
                                  <Chip label="Admin" size="small" color="primary" />
                                )}
                                <Typography variant="caption" color="text.secondary">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: nb })}
                                </Typography>
                              </Box>
                            }
                            secondary={comment.content}
                          />
                          <ListItemSecondaryAction>
                            <Tooltip title="Svar">
                              <IconButton 
                                size="small"
                                onClick={() => setReplyingToComment(
                                  replyingToComment === comment.id ? null : comment.id
                                )}
                                color={replyingToComment === comment.id ? 'primary' : 'default'}
                              >
                                <Reply />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        </ListItem>
                        
                        {/* Reply input */}
                        <Collapse in={replyingToComment === comment.id}>
                          <Box sx={{ ml: 7, mb: 2, display: 'flex', gap: 1 }}>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder={`Svar til ${comment.user_name}...`}
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleReplyToComment(comment.id)}
                            />
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => handleReplyToComment(comment.id)}
                              disabled={!replyContent.trim()}
                              sx={{ bgcolor: '#FF8C00', '&:hover': { bgcolor: '#e67e00' } }}
                            >
                              Svar
                            </Button>
                          </Box>
                        </Collapse>
                      </React.Fragment>
                    ))}
                  </List>
                </Box>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export { VotingBoard };
