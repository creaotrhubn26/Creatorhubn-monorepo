/**
 * Pro Tools Comments Panel
 * Displays and manages timecode-linked comments synchronized from Pro Tools
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Comment as CommentIcon,
  Send as SendIcon,
  AccessTime as AccessTimeIcon,
  FilterList as FilterListIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface ProToolsComment {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  messageType: 'text' | 'audio' | 'file' | 'timecode_comment';
  timecodeReference?: string;
  trackReference?: string;
  createdAt: string;
  isRead?: boolean;
}

interface ProToolsCommentsPanelProps {
  sessionId: string;
  currentTimecode?: string; // Current playhead timecode
  onCommentClick?: (comment: ProToolsComment) => void; // Callback when comment is clicked (to seek to timecode)
}

export default function ProToolsCommentsPanel({
  sessionId,
  currentTimecode,
  onCommentClick,
}: ProToolsCommentsPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'music_producer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  const theming = useTheming(currentProfession);
  const [newComment, setNewComment] = useState('');
  const [filterTrack, setFilterTrack] = useState<string>('all');
  const [showTimecodeFilter, setShowTimecodeFilter] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch comments for session
  const { data: commentsData, isLoading: commentsLoading, refetch: refetchComments } = useQuery({
      queryKey: ['/api/protools/sessions', sessionId, 'comments'],
    queryFn: () => apiRequest(`/api/protools/sessions/${sessionId}/comments`),
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const comments: ProToolsComment[] = commentsData?.data || [];

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (commentData: { content: string; timecodeReference?: string; trackReference?: string }) => {
      return apiRequest(`/api/protools/sessions/${sessionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(commentData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/protools/sessions', sessionId, 'comments'] });
      setNewComment('');
    },
  });

  // WebSocket connection for real-time comment updates
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/protools/${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🎵 Pro Tools Comments WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'comment_added' || message.type === 'comment_updated') {
            // Refetch comments when new one is added
            refetchComments();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🎵 Pro Tools Comments WebSocket disconnected');
      };

      ws.onerror = (error) => {
        console.error('🎵 Pro Tools Comments WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, refetchComments]);

  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    
    createCommentMutation.mutate({
      content: newComment.trim(),
      timecodeReference: currentTimecode || undefined,
      messageType: 'timecode_comment',
    });
  };

  const handleCommentClick = (comment: ProToolsComment) => {
    if (comment.timecodeReference && onCommentClick) {
      onCommentClick(comment);
    }
  };

  // Filter comments
  const filteredComments = comments.filter((comment) => {
    if (filterTrack !== 'all' && comment.trackReference !== filterTrack) {
      return false;
    }
    return true;
  });

  // Group comments by timecode
  const commentsByTimecode = filteredComments.reduce((acc, comment) => {
    const timecode = comment.timecodeReference || 'No timecode';
    if (!acc[timecode]) {
      acc[timecode] = [];
    }
    acc[timecode].push(comment);
    return acc;
  }, {} as Record<string, ProToolsComment[]>);

  // Sort timecodes
  const sortedTimecodes = Object.keys(commentsByTimecode).sort((a, b) => {
    if (a === 'No timecode') return 1;
    if (b === 'No timecode') return -1;
    // Simple string comparison for timecode (HH:MM:SS:FF)
    return a.localeCompare(b);
  });

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <CommentIcon />
            <Typography variant="h6">
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Comments`
                : 'Comments'}
            </Typography>
            <Badge badgeContent={comments.length} color="primary">
              <Box />
            </Badge>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Track</InputLabel>
              <Select
                value={filterTrack}
                onChange={(e) => setFilterTrack(e.target.value)}
                label="Track"
              >
                <MenuItem value="all">All Tracks</MenuItem>
                {/* Track options would be populated from session tracks */}
              </Select>
            </FormControl>
            <IconButton
              size="small"
              onClick={() => setShowTimecodeFilter(!showTimecodeFilter)}
              color={showTimecodeFilter ? 'primary' : 'default'}
            >
              <FilterListIcon />
            </IconButton>
          </Box>
        </Box>

        {/* New Comment Input */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="Add a comment at current timecode..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
            InputProps={{
              endAdornment: (
                <IconButton
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  color="primary"
                >
                  <SendIcon />
                </IconButton>
              )}}
          />
          {currentTimecode && (
            <Chip
              icon={<AccessTimeIcon />}
              label={`At: ${currentTimecode}`}
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Comments List */}
        {commentsLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading comments...
          </Typography>
        ) : filteredComments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No comments yet. Add a comment to get started.
          </Typography>
        ) : (
          <List>
            {sortedTimecodes.map((timecode) => (
              <Box key={timecode}>
                {timecode !== 'No timecode' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 2 }}>
                    <AccessTimeIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" color="text.secondary">
                      {timecode}
                    </Typography>
                    <Chip label={commentsByTimecode[timecode].length} size="small" />
                  </Box>
                )}
                {commentsByTimecode[timecode].map((comment) => (
                  <ListItem
                    key={comment.id}
                    sx={{
                      mb: 1,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                      cursor: comment.timecodeReference ? 'pointer' : 'default',
                      '&:hover': {
                        bgcolor: comment.timecodeReference ? 'action.hover' : 'background.default',
                      }}}
                    onClick={() => handleCommentClick(comment)}
                  >
                    <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                      {comment.userId.charAt(0).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={comment.content}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(comment.createdAt).toLocaleString()}
                          </Typography>
                          {comment.trackReference && (
                            <Chip label={`Track: ${comment.trackReference}`} size="small" variant="outlined" />
                          )}
                          {comment.messageType === 'timecode_comment' && (
                            <Chip
                              icon={<AccessTimeIcon />}
                              label="Timecode"
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {comment.userId === user?.id && (
                        <Tooltip title="Your comment">
                          <CheckCircle color="primary" fontSize="small" />
                        </Tooltip>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </Box>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}























