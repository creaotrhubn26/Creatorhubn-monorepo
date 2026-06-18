/**
 * RoleRoomChatBubble — flytende chat-boble (launcher + panel) som gjør
 * klient-samtalen tilgjengelig overalt i Creative Sync Workspace, ikke bare i
 * Meldinger-fanen. FAB nederst til høyre med ulest-badge → utvider et kompakt
 * panel som rendrer ClientConversationView. Mountes på shell-nivå.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Badge, Box, Fab, IconButton, Paper, Stack, Typography, CircularProgress } from '@mui/material';
import {
  ChatBubbleOutlineRounded as ChatIcon,
  CloseRounded as CloseIcon,
  OpenInFullRounded as ExpandIcon,
} from '@mui/icons-material';
import { producerWorkflowService } from '../../services/producerWorkflowService';

const ClientConversationView = lazy(() => import('./ClientConversationView'));

export default function RoleRoomChatBubble({
  projectId,
  onOpenFullTab,
  canUseInternal = false,
}: {
  projectId: string;
  /** Valgfri: hopp til full Meldinger-fane. */
  onOpenFullTab?: () => void;
  /** Produsent: vis intern/delt rom-toggle. */
  canUseInternal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const items = await producerWorkflowService.getNotifications(projectId);
      setUnread(items.filter((n) => !n.read && !n.resolved_at && !n.archived_at).length);
    } catch {
      /* stille */
    }
  }, [projectId]);

  useEffect(() => { void refreshUnread(); }, [refreshUnread]);
  // Lett polling så badgen oppdateres når motparten sender noe.
  useEffect(() => {
    const t = window.setInterval(() => { if (!open) void refreshUnread(); }, 45000);
    return () => window.clearInterval(t);
  }, [open, refreshUnread]);

  const handleClose = useCallback(() => { setOpen(false); void refreshUnread(); }, [refreshUnread]);

  return (
    <>
      {/* Panel */}
      {open ? (
        <Paper
          elevation={0}
          role="dialog"
          aria-label="Klient-samtale"
          sx={{
            position: 'fixed', zIndex: 1301,
            right: { xs: 8, sm: 24 }, bottom: { xs: 8, sm: 96 },
            width: { xs: 'calc(100vw - 16px)', sm: 400 },
            height: { xs: 'calc(100dvh - 16px)', sm: 'min(620px, 80vh)' },
            display: 'flex', flexDirection: 'column',
            borderRadius: 3, overflow: 'hidden',
            background: 'linear-gradient(180deg,#0c0a18,#0a0a14)',
            border: '1px solid rgba(168,85,247,0.3)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          }}
        >
          <Stack
            direction="row" alignItems="center" spacing={1}
            sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid rgba(148,163,184,0.14)', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.12))' }}
          >
            <ChatIcon sx={{ fontSize: 18, color: '#c4b5fd' }} />
            <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.92rem', flex: 1 }}>
              Samtale
            </Typography>
            {onOpenFullTab ? (
              <IconButton aria-label="Åpne full samtale" onClick={() => { onOpenFullTab(); handleClose(); }} sx={{ width: 36, height: 36, color: 'rgba(226,232,240,0.7)' }}>
                <ExpandIcon sx={{ fontSize: 17 }} />
              </IconButton>
            ) : null}
            <IconButton aria-label="Lukk samtale" onClick={handleClose} sx={{ width: 36, height: 36, color: 'rgba(226,232,240,0.8)' }}>
              <CloseIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>}>
              <ClientConversationView projectId={projectId} canUseInternal={canUseInternal} />
            </Suspense>
          </Box>
        </Paper>
      ) : null}

      {/* Flytende launcher */}
      <Box sx={{ position: 'fixed', right: { xs: 16, sm: 24 }, bottom: { xs: 16, sm: 24 }, zIndex: 1300 }}>
        <Badge
          color="error"
          badgeContent={unread > 0 ? unread : undefined}
          max={99}
          overlap="circular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Fab
            aria-label={open ? 'Lukk samtale' : `Åpne samtale${unread > 0 ? ` (${unread} ulest)` : ''}`}
            onClick={() => (open ? handleClose() : setOpen(true))}
            sx={{
              width: 64, height: 64, p: 0,
              background: open ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#140a2e',
              color: '#fff', boxShadow: '0 10px 30px rgba(124,58,237,0.5)',
              border: open ? 'none' : '1px solid rgba(168,85,247,0.45)',
              '&:hover': { background: open ? 'linear-gradient(135deg,#6d28d9,#9333ea)' : '#1c1040' },
              '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 3 },
            }}
          >
            {open ? (
              <CloseIcon sx={{ fontSize: 26 }} />
            ) : (
              <Box component="img" src="/RoleRoom_Chat_Icon.png" alt=""
                sx={{ width: 46, height: 46, objectFit: 'contain', display: 'block' }} />
            )}
          </Fab>
        </Badge>
      </Box>
    </>
  );
}
