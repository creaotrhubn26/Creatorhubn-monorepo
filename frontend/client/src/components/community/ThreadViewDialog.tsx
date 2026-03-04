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
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';

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

      setReplyContent(', ');
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
        p: 2,
        mb: 2,
        bgcolor: isParent ? 'primary.light' : 'background.paper',
        border: isParent ? 2 : 1,
        borderColor: isParent ? 'primary.main' : 'divider'}}
    >
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Avatar src={message.user_avatar} sx={{ width: 40, height: 40 }}>
          {message.user_name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              {message.user_name}
            </Typography>
            {isParent && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600}}>
                Original melding
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: nb })}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReplyIcon />
            <Typography variant="h6">Tråd</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Parent Message */}
            {parentMessage && renderMessage(parentMessage, true)}

            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {replies.length} {replies.length === 1 ? 'svar' : 'svar'}
              </Typography>
            </Divider>

            {/* Replies - Virtualized for performance */}
            {replies.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Ingen svar ennå. Vær den første til å svare!
                </Typography>
              </Box>
            ) : (
              <Box sx={{ height: 400, minHeight: 400 }}>
                <Virtuoso
                  ref={virtuosoRef}
                  data={replies}
                  itemContent={(index, reply) => (
                    <Box key={reply.id} sx={{ mb: 1 }}>
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

      <DialogActions sx={{ p: 2 }}>
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleSendReply}
                  disabled={!replyContent.trim() || sending}
                  color="primary"
                >
                  {sending ? <CircularProgress size={24} /> : <Send />}
                </IconButton>
              </InputAdornment>
            )}}
        />
      </DialogActions>
    </Dialog>
  );
}


