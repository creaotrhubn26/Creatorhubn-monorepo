import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Portal,
  Typography,
} from '@mui/material';
import { Add, AlternateEmail, Google, PersonAdd, Settings, Speed, Sync } from '@mui/icons-material';

interface GoogleChatActionsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  accentColor: string;
  displayName: string;
  googleChatStatus: 'connected' | 'disconnected' | 'testing' | 'not_configured';
  zIndex?: number;
  onClose: () => void;
  onCreateProjectSpace: () => void;
  onJoinSpace: () => void;
  onSyncCrm: () => void;
  onMention: () => void;
  onTestApi: () => Promise<void> | void;
  onOpenSettings: () => void;
}

export default function GoogleChatActionsPopover({
  open,
  anchorEl,
  accentColor,
  displayName,
  googleChatStatus,
  zIndex,
  onClose,
  onCreateProjectSpace,
  onJoinSpace,
  onSyncCrm,
  onMention,
  onTestApi,
  onOpenSettings,
}: GoogleChatActionsPopoverProps) {
  return (
    <Portal>
      <Popover
        id="google-chat-popover"
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        sx={{
          zIndex,
          '& .MuiPopover-paper': {
            border: `2px solid ${accentColor}`,
            borderRadius: 2,
            mt: 1,
            minWidth: 320,
            maxWidth: 420,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(8px)',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Google sx={{ color: accentColor }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Google Chat Professional
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Advanced collaboration tools for {displayName}
          </Typography>
        </Box>

        <List sx={{ py: 0 }}>
          <ListItem onClick={onCreateProjectSpace} sx={{ py: 1.5, '&:hover': { bgcolor: `${accentColor}20` } }}>
            <ListItemIcon>
              <Add sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText
              primary="Opprett nytt prosjekt-space"
              secondary="Opprett Google Chat space for prosjektsamarbeid"
            />
          </ListItem>

          <ListItem onClick={onJoinSpace} sx={{ py: 1.5 }}>
            <ListItemIcon>
              <PersonAdd sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText primary="Join Space" />
          </ListItem>

          <ListItem onClick={onSyncCrm} sx={{ py: 1.5 }}>
            <ListItemIcon>
              <Sync sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText primary="Sync CRM Contacts" />
          </ListItem>

          <ListItem onClick={onMention} sx={{ py: 1.5 }}>
            <ListItemIcon>
              <AlternateEmail sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText primary="Legg til @mention" />
          </ListItem>

          <ListItem
            onClick={async () => {
              await onTestApi();
            }}
            sx={{ py: 1.5, '&:hover': { bgcolor: `${accentColor}20` } }}
          >
            <ListItemIcon>
              <Speed sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText
              primary="Test Google Chat API"
              secondary={`Status: ${googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}`}
            />
          </ListItem>

          <ListItem onClick={onOpenSettings} sx={{ py: 1.5 }}>
            <ListItemIcon>
              <Settings sx={{ color: accentColor }} />
            </ListItemIcon>
            <ListItemText primary="Chat Settings" />
          </ListItem>
        </List>
      </Popover>
    </Portal>
  );
}
