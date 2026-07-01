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
  Alert,
} from '@mui/material';
import {
  Close,
  Send,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import type { VirtuosoHandle } from 'react-virtuoso';
import { Virtuoso } from 'react-virtuoso';
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_FIELD_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

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
  channelId?: string;
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
    if (!replyContent.trim() || sending || !channelId) return;

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
        ...(isParent ? COMMUNITY_DIALOG_SURFACE_SX : COMMUNITY_DIALOG_SURFACE_SUBTLE_SX),
        p: 2.25,
        mb: 2,
        border: isParent
          ? '1px solid rgba(255, 140, 0, 0.24)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Avatar
          src={message.user_avatar}
          sx={{
            width: 40,
            height: 40,
            bgcolor: isParent ? 'rgba(255, 140, 0, 0.18)' : 'rgba(255,255,255,0.08)',
            color: isParent ? '#ff8c00' : COMMUNITY_DIALOG_TEXT,
          }}
        >
          {message.user_name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: COMMUNITY_DIALOG_TEXT }}>
              {message.user_name}
            </Typography>
            {isParent && (
              <Typography variant="caption" sx={{ color: '#ffd27a', fontWeight: 700 }}>
                Original melding
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: nb })}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: COMMUNITY_DIALOG_TEXT }}>
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
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReplyIcon sx={{ color: '#ffd27a' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
              Tråd
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX} dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#ff8c00' }} />
          </Box>
        ) : (
          <>
            {/* Parent Message */}
            {parentMessage && renderMessage(parentMessage, true)}

            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                {replies.length} {replies.length === 1 ? 'svar' : 'svar'}
              </Typography>
            </Divider>

            {/* Replies - Virtualized for performance */}
            {replies.length === 0 ? (
              <Box sx={{ ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX, textAlign: 'center', py: 4 }}>
                <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
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

      <DialogActions sx={{ ...COMMUNITY_DIALOG_ACTIONS_SX, alignItems: 'stretch' }}>
        {!channelId && (
          <Alert severity="warning" sx={{ width: '100%', mr: 1 }}>
            Velg en kanal først for å kunne sende svar i denne tråden.
          </Alert>
        )}
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
                  disabled={!replyContent.trim() || sending || !channelId}
                  sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}
                >
                  {sending ? <CircularProgress size={24} sx={{ color: '#ff8c00' }} /> : <Send />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={COMMUNITY_DIALOG_FIELD_SX}
        />
      </DialogActions>
    </Dialog>
  );
}

