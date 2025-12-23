/**
 * CreatorHub Norge Community - Pinned Messages Bar
 * 
 * Shows pinned messages at the top of a channel
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Avatar,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  PushPin,
  ExpandMore,
  ExpandLess,
  Close,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';

interface PinnedMessage {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
}

interface PinnedMessagesBarProps {
  channelId: string;
  userId: string;
  isModerator: boolean;
  onUnpin?: (messageId: string) => void;
}

export default function PinnedMessagesBar({
  channelId,
  userId,
  isModerator,
  onUnpin,
}: PinnedMessagesBarProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (channelId) {
      fetchPinnedMessages();
    }
  }, [channelId]);

  const fetchPinnedMessages = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(`/api/community/channels/${channelId}/pinned`);
      setPinnedMessages(response.pinnedMessages || []);
    } catch (error) {
      console.error('Error fetching pinned messages: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    try {
      await apiRequest(`/api/community/messages/${messageId}/pin`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          isPinned: false,
        }),
      });

      setPinnedMessages(pinnedMessages.filter((m) => m.id !== messageId));
      if (onUnpin) onUnpin(messageId);
    } catch (error) {
      console.error('Error unpinning message:', error);
    }
  };

  if (loading || pinnedMessages.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={2}
      sx={{
        mb: 2,
        bgcolor: 'warning.light',
        borderLeft: 4,
        borderColor: 'warning.main'}}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          cursor: 'pointer'}}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PushPin fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600}>
            Festede meldinger ({pinnedMessages.length})
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      {/* Pinned Messages List */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {pinnedMessages.map((message) => (
            <Paper
              key={message.id}
              variant="outlined"
              sx={{ p: 1.5, mb: 1, bgcolor: 'background.paper' }}
            >
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Avatar src={message.user_avatar} sx={{ width: 32, height: 32 }}>
                  {message.user_name?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" fontWeight={600}>
                      {message.user_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace:'pre-wrap' }}>
                    {message.content}
                  </Typography>
                </Box>
                {isModerator && (
                  <Tooltip title="Fjern festing">
                    <IconButton size="small" onClick={() => handleUnpin(message.id)}>
                      <Close fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

