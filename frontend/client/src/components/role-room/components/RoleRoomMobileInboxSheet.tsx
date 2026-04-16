// @ts-nocheck
/**
 * RoleRoomMobileInboxSheet — minimal Innboks surface for mobile + iPad.
 *
 * Covers backlog items:
 *  - 276: Innboks as own icon button (wired via topbar prop)
 *  - 277: fullscreen modal on phone
 *  - 278: side panel on iPad
 *  - 286: mark-as-read action from mobile (tap to read)
 *
 * Presentational — notifications are fetched by the parent via
 * useProducerNotifications and passed down. Skip filters/grouping/swipe for
 * this slice; those are follow-up work.
 */

import React from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Inbox as InboxIcon } from '@mui/icons-material';

import type { RoleRoomViewportMode } from '../hooks/useRoleRoomViewportMode';

export interface InboxItem {
  id: string;
  title: string;
  message?: string | null;
  read: boolean;
  createdAt?: string;
  eventType?: string | null;
}

interface RoleRoomMobileInboxSheetProps {
  open: boolean;
  onClose: () => void;
  mode: RoleRoomViewportMode;
  items: InboxItem[];
  loading?: boolean;
  error?: string | null;
  onItemClick?: (id: string) => void;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export const RoleRoomMobileInboxSheet: React.FC<RoleRoomMobileInboxSheetProps> = ({
  open,
  onClose,
  mode,
  items,
  loading,
  error,
  onItemClick,
}) => {
  const useDrawer = mode === 'tabletPortrait' || mode === 'tabletLandscape';

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          pt: useDrawer ? 2 : 'calc(var(--rr-safe-top, 0px) + 12px)',
          pb: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <InboxIcon fontSize="small" sx={{ color: '#6366f1' }} />
          <Typography variant="h6" fontWeight={700}>
            Innboks
          </Typography>
        </Stack>
        <IconButton
          onClick={onClose}
          aria-label="Lukk innboks"
          sx={{
            width: 'var(--rr-touch-target-min, 44px)',
            height: 'var(--rr-touch-target-min, 44px)',
          }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />

      {loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" color="error">{error}</Typography>
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Ingen varsler enda
          </Typography>
        </Box>
      ) : (
        <List disablePadding sx={{ flex: 1, overflowY: 'auto', pb: 'var(--rr-safe-bottom, 0px)' }}>
          {items.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => onItemClick?.(item.id)}
              sx={{
                alignItems: 'flex-start',
                minHeight: 'var(--rr-touch-target-min, 44px)',
                px: 2,
                py: 1.25,
                bgcolor: item.read ? 'transparent' : 'rgba(99,102,241,0.06)',
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: item.read ? 'transparent' : '#6366f1',
                  mt: 1,
                  mr: 1.5,
                  flexShrink: 0,
                }}
              />
              <ListItemText
                primary={item.title}
                primaryTypographyProps={{ fontWeight: item.read ? 500 : 700 }}
                secondary={
                  <>
                    {item.message ? <span>{item.message}</span> : null}
                    {item.createdAt ? (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.25 }}
                      >
                        {formatTimestamp(item.createdAt)}
                      </Typography>
                    ) : null}
                  </>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );

  if (useDrawer) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: 'min(420px, 90vw)',
            maxWidth: 420,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="rr-inbox-title"
      PaperProps={{
        className: 'rr-mobile-sheet',
        sx: {
          margin: 0,
          borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
          borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
        },
      }}
    >
      <DialogTitle id="rr-inbox-title" sx={{ p: 0 }}>
        <span className="sr-only">Innboks</span>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>{content}</DialogContent>
    </Dialog>
  );
};

export default RoleRoomMobileInboxSheet;
