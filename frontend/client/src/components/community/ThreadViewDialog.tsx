/**
 * CreatorHub Norge Community - Thread View Dialog
 *
 * Shows a message and all its replies in a threaded view
 * Uses React Virtuoso for performance with large threads
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Avatar,
  Divider,
  CircularProgress,
  Paper,
  InputAdornment,
} from '@mui/material';
import {
  Close,
  Send,
  Reply as ReplyIcon,
  AttachFile,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

interface ThreadMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  attachments?: any[];
  created_at: string;
  reactions?: any;
}

interface ThreadViewDialogProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  userId: string;
  channelId: string;
}

export default function ThreadViewDialog({
  open,
  onClose,
  messageId,
  userId,
  channelId,
}: ThreadViewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [parentMessage, setParentMessage] = useState<ThreadMessage | null>(null);
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (open && messageId) {
      fetchThread();
    }
  }, [open, messageId]);

  const fetchThread = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/community/messages/${messageId}/thread`);
      setParentMessage(response.parent);
      setReplies(response.replies || []);
    } catch (error) {
      console.error('Error fetching thread: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyContent.trim() || sending) return;

    try {
      setSending(true);
      await apiRequest(`/api/community/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          content: replyContent,
          parent_message_id: messageId,
        }),
      });

      setReplyContent('');
      await fetchThread(); // Refresh thread

      // Scroll to bottom to show new reply
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: replies.length,
          align: 'end',
          behavior: 'smooth',
        });
      }, 100);
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (message: ThreadMessage, isParent = false) => (
    <Paper
      key={message.id}
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        mb: { xs: 1.5, sm: 2, md: 2.5 },
        background: isParent 
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)'
          : 'rgba(26, 26, 46, 0.6)',
        border: isParent 
          ? '2px solid rgba(245, 158, 11, 0.4)' 
          : '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        boxShadow: isParent 
          ? '0 4px 16px rgba(245, 158, 11, 0.2)' 
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(245, 158, 11, 0.5)',
          boxShadow: isParent 
            ? '0 6px 20px rgba(245, 158, 11, 0.3)' 
            : '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 2.5 } }}>
        <Avatar 
          src={message.user_avatar} 
          sx={{ 
            width: { xs: 44, sm: 48, md: 52 },
            height: { xs: 44, sm: 48, md: 52 },
            border: '2px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(234, 88, 12, 0.2) 100%)',
          }}
        >
          {message.user_name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, mb: { xs: 0.75, sm: 1 }, flexWrap: 'wrap' }}>
            <Typography 
              variant="subtitle2" 
              fontWeight={700}
              sx={{
                color: isParent ? '#f59e0b' : '#fff',
                fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
              }}
            >
              {message.user_name}
            </Typography>
            {isParent && (
              <Box
                sx={{
                  px: { xs: 1, sm: 1.5 },
                  py: 0.5,
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#f59e0b', 
                    fontWeight: 600,
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                  }}
                >
                  Original melding
                </Typography>
              </Box>
            )}
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
              }}
            >
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: nb })}
            </Typography>
          </Box>
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: 1.7,
              fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 3,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
          color: '#fff',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
          p: { xs: 2, sm: 2.5, md: 3 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 } }}>
            <Box
              sx={{
                width: { xs: 40, sm: 44, md: 48 },
                height: { xs: 40, sm: 44, md: 48 },
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
              }}
            >
              <ReplyIcon sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24 } }} />
            </Box>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#fff', 
                fontWeight: 700,
                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' },
              }}
            >
              Tråd
            </Typography>
          </Box>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              '&:hover': {
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent 
        dividers
        sx={{
          bgcolor: 'rgba(18, 18, 31, 0.5)',
          borderColor: 'rgba(245, 158, 11, 0.2)',
          p: { xs: 2, sm: 2.5, md: 3 },
          '&::-webkit-scrollbar': {
            width: '10px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(26, 26, 46, 0.3)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            '&:hover': {
              background: 'rgba(245, 158, 11, 0.5)',
            },
          },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#f59e0b' }} />
          </Box>
        ) : (
          <>
            {/* Parent Message */}
            {parentMessage && renderMessage(parentMessage, true)}

            <Divider 
              sx={{ 
                my: { xs: 2, sm: 2.5, md: 3 },
                borderColor: 'rgba(245, 158, 11, 0.2)',
              }}
            >
              <Box
                sx={{
                  px: { xs: 1.5, sm: 2 },
                  py: 0.5,
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#f59e0b',
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' },
                  }}
                >
                  {replies.length} {replies.length === 1 ? 'svar' : 'svar'}
                </Typography>
              </Box>
            </Divider>

            {/* Replies - Virtualized for performance */}
            {replies.length === 0 ? (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: { xs: 6, sm: 8, md: 10 },
                  px: 2,
                }}
              >
                <Box
                  sx={{
                    width: { xs: 64, sm: 80, md: 96 },
                    height: { xs: 64, sm: 80, md: 96 },
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: { xs: 2, sm: 3 },
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <ReplyIcon sx={{ fontSize: { xs: 32, sm: 40, md: 48 }, color: '#f59e0b' }} />
                </Box>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: { xs: '0.95rem', sm: '1rem', md: '1.125rem' },
                  }}
                >
                  Ingen svar ennå. Vær den første til å svare!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ height: { xs: 300, sm: 400, md: 500 }, minHeight: { xs: 300, sm: 400, md: 500 } }}>
                <Virtuoso
                  ref={virtuosoRef}
                  data={replies}
                  itemContent={(index, reply) => (
                    <Box key={reply.id} sx={{ mb: { xs: 1.5, sm: 2 } }}>
                      {renderMessage(reply, false)}
                    </Box>
                  )}
                  followOutput="smooth"
                  alignToBottom
                  style={{ height: '100%' }}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: { xs: 2, sm: 2.5, md: 3 },
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
          borderTop: '1px solid rgba(245, 158, 11, 0.2)',
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Skriv et svar..."
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key ==='Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendReply();
            }
          }}
          disabled={sending}
          sx={{
            '& .MuiOutlinedInput-root': {
              background: 'rgba(26, 26, 46, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              color: '#fff',
              '& fieldset': {
                borderColor: 'rgba(245, 158, 11, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(245, 158, 11, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#f59e0b',
                borderWidth: '2px',
              },
            },
            '& .MuiInputBase-input': {
              color: '#fff',
              fontSize: { xs: '14px', sm: '15px', md: '16px' },
              '&::placeholder': {
                color: 'rgba(255, 255, 255, 0.4)',
                opacity: 1,
              },
            },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || sending}
                  sx={{
                    color: replyContent.trim() && !sending ? '#f59e0b' : 'rgba(255, 255, 255, 0.4)',
                    background: replyContent.trim() && !sending 
                      ? 'rgba(245, 158, 11, 0.1)' 
                      : 'transparent',
                    '&:hover': {
                      background: replyContent.trim() && !sending 
                        ? 'rgba(245, 158, 11, 0.2)' 
                        : 'rgba(255, 255, 255, 0.05)',
                      color: replyContent.trim() && !sending ? '#f59e0b' : 'rgba(255, 255, 255, 0.6)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {sending ? (
                    <CircularProgress size={24} sx={{ color: '#f59e0b' }} />
                  ) : (
                    <Send />
                  )}
                </IconButton>
              </InputAdornment>
            )}}
        />
      </DialogActions>
    </Dialog>
  );
}


