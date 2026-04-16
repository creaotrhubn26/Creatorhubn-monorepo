// @ts-nocheck
/**
 * AgentThreadList — lightweight popover that lists the user's recent
 * agent threads for a project and lets them resume or archive.
 *
 * Rendered from RoleRoomAgentChatPanel via a header button; invisible
 * unless a thread exists.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { Archive as ArchiveIcon, ChatBubbleOutline as ChatIcon } from '@mui/icons-material';

import {
  archiveAgentThread,
  listAgentThreads,
  type RoleRoomAgentThread,
} from '../../services/roleRoomAgentClaudeApi';

interface AgentThreadListProps {
  projectId: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  currentThreadId: string | null;
  onPick: (threadId: string) => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export const AgentThreadList: React.FC<AgentThreadListProps> = ({
  projectId,
  anchorEl,
  open,
  onClose,
  currentThreadId,
  onPick,
}) => {
  const [threads, setThreads] = useState<RoleRoomAgentThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!projectId || !open) return;
    setLoading(true);
    try {
      const rows = await listAgentThreads(projectId);
      setThreads(rows);
    } finally {
      setLoading(false);
    }
  }, [projectId, open]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  const handleArchive = useCallback(
    async (threadId: string) => {
      if (!projectId) return;
      await archiveAgentThread(projectId, threadId);
      setTick((n) => n + 1);
    },
    [projectId],
  );

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: { mt: 0.5, width: 'min(420px, 92vw)', maxHeight: 420, borderRadius: 2 },
        },
      }}
    >
      <Stack sx={{ p: 1.25 }} spacing={0.5}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Tidligere samtaler
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : threads.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 1 }}>
            Ingen lagrede samtaler ennå.
          </Typography>
        ) : (
          <List disablePadding>
            {threads.map((thread) => {
              const isActive = thread.id === currentThreadId;
              return (
                <Box
                  key={thread.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'stretch',
                    border: '1px solid',
                    borderColor: isActive ? '#6366f1' : 'divider',
                    borderRadius: 1,
                    mb: 0.5,
                  }}
                >
                  <ListItemButton
                    onClick={() => {
                      onPick(thread.id);
                      onClose();
                    }}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    <ChatIcon fontSize="small" sx={{ mr: 1, color: isActive ? '#6366f1' : 'text.secondary' }} />
                    <ListItemText
                      primary={thread.title || 'Uten tittel'}
                      primaryTypographyProps={{ noWrap: true, fontWeight: isActive ? 700 : 500 }}
                      secondary={`Sist aktiv ${formatWhen(thread.lastActiveAt)}`}
                    />
                  </ListItemButton>
                  <Divider flexItem orientation="vertical" />
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleArchive(thread.id);
                    }}
                    aria-label="Arkiver samtale"
                    sx={{ mx: 0.5 }}
                  >
                    <ArchiveIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </List>
        )}
      </Stack>
    </Popover>
  );
};

export default AgentThreadList;
