/**
 * AgentDockLauncher — a docked, always-available entry point for "The Role
 * Room Agent". Instead of burying the conversational surface as a deep tab,
 * this renders a floating circular launcher pinned bottom-right that opens
 * the existing RoleRoomAgentChatPanel inside a right-side Drawer.
 *
 * It is a pure shell: it owns only open/closed state and forwards every prop
 * straight through to RoleRoomAgentChatPanel. It does NOT touch the chat panel
 * itself. Mount it once at the top level of the producer dashboard/dialog.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Drawer,
  Fab,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

import RoleRoomAgentChatPanel from '../ai/RoleRoomAgentChatPanel';
import type {
  RoleRoomAgentContext,
  RoleRoomAgentToolUse,
} from '../../services/roleRoomAgentClaudeApi';

const ACCENT = '#22d3ee';
const ACCENT_LIGHT = '#a5f3fc';
const PANEL_BG = 'rgba(15,23,42,0.55)';
const BORDER = '1px solid rgba(148,163,184,0.18)';

export interface AgentDockLauncherProps {
  projectId: string | null;
  currentUserId: string;
  /** Project context assembled by the parent — forwarded verbatim to the chat
   *  panel, which pseudonymizes it on the backend. */
  context?: RoleRoomAgentContext;
  /** Forwarded to the chat panel. Called when the user confirms a tool_use. */
  onConfirmToolUse?: (
    tool: RoleRoomAgentToolUse,
  ) => Promise<string | void> | string | void;
  /** Optional attention dot on the launcher (e.g. unanswered nudge). */
  attention?: boolean;
  /** Start opened (defaults to closed). */
  defaultOpen?: boolean;
}

export const AgentDockLauncher: React.FC<AgentDockLauncherProps> = ({
  projectId,
  currentUserId,
  context,
  onConfirmToolUse,
  attention = false,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  // Esc closes the drawer (MUI Drawer already handles this, but we keep an
  // explicit guard so the behavior is robust even if onClose is overridden).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <Tooltip title="The Role Room Agent" placement="left">
          <Badge
            color="error"
            variant="dot"
            invisible={!attention}
            overlap="circular"
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{
              position: 'fixed',
              bottom: { xs: 18, sm: 26 },
              right: { xs: 18, sm: 26 },
              zIndex: (theme) => theme.zIndex.drawer + 2,
            }}
          >
            <Fab
              aria-label="Åpne The Role Room Agent"
              onClick={handleOpen}
              sx={{
                bgcolor: ACCENT,
                color: '#06121a',
                boxShadow: '0 10px 30px rgba(34,211,238,0.35)',
                '&:hover': { bgcolor: ACCENT_LIGHT },
              }}
            >
              <AutoAwesomeIcon />
            </Fab>
          </Badge>
        </Tooltip>
      )}

      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        keepMounted={false}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 420 },
            maxWidth: '100vw',
            bgcolor: PANEL_BG,
            backdropFilter: 'blur(18px)',
            borderLeft: BORDER,
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: BORDER,
            flexShrink: 0,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.4,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(34,211,238,0.12)',
                color: ACCENT,
              }}
            >
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  color: '#f8fafc',
                }}
              >
                The Role Room Agent
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'rgba(226,232,240,0.55)',
                }}
              >
                Alltid tilgjengelig
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label="Lukk agent"
            onClick={handleClose}
            size="small"
            sx={{ color: 'rgba(226,232,240,0.66)' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.5 }}>
          <RoleRoomAgentChatPanel
            projectId={projectId}
            currentUserId={currentUserId}
            context={context}
            onConfirmToolUse={onConfirmToolUse}
          />
        </Box>
      </Drawer>
    </>
  );
};

export default AgentDockLauncher;
