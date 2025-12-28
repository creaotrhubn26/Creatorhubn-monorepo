/**
 * CreatorHub Norge Community - Badge Notification
 * 
 * Shows a toast notification when user earns a new badge using notistack
 */

import React, { forwardRef } from 'react';
import { Box, Typography, Chip, IconButton, Paper } from '@mui/material';
import { EmojiEvents, Close, Celebration } from '@mui/icons-material';
import { useSnackbar, SnackbarKey, SnackbarContent } from 'notistack';

interface BadgeData {
  badgeName: string;
  badgeIcon: string;
  badgeColor: string;
  badgeDescription: string;
}

interface BadgeNotificationContentProps {
  id: SnackbarKey;
  badge: BadgeData;
}

// Custom notification content component
const BadgeNotificationContent = forwardRef<HTMLDivElement, BadgeNotificationContentProps>(
  ({ id, badge }, ref) => {
    const { closeSnackbar } = useSnackbar();

    return (
      <SnackbarContent ref={ref}>
        <Paper
          elevation={6}
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            minWidth: 320,
            maxWidth: 400,
            border: '2px solid #4caf50',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <EmojiEvents sx={{ color: '#FFD700', fontSize: 32 }} />
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Celebration sx={{ color: '#f59e0b', fontSize: 20 }} />
                Ny Badge Opptjent!
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip
                  label={`${badge.badgeIcon} ${badge.badgeName}`}
                  sx={{
                    bgcolor: badge.badgeColor,
                    color: 'white',
                    fontWeight: 600,
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {badge.badgeDescription}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => closeSnackbar(id)}
              sx={{ ml: 'auto' }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </SnackbarContent>
    );
  }
);

BadgeNotificationContent.displayName = 'BadgeNotificationContent';

// Hook to show badge notifications
export function useBadgeNotification() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const showBadgeNotification = (badge: BadgeData) => {
    enqueueSnackbar('', {
      autoHideDuration: 6000,
      anchorOrigin: { vertical: 'top', horizontal: 'center' },
      content: (key) => (
        <BadgeNotificationContent
          id={key}
          badge={badge}
        />
      ),
    });
  };

  return { showBadgeNotification, closeSnackbar };
}

// Legacy component for backwards compatibility
// This can be used as a wrapper that triggers the notification when 'open' changes
interface BadgeNotificationProps {
  open: boolean;
  onClose: () => void;
  badgeName: string;
  badgeIcon: string;
  badgeColor: string;
  badgeDescription: string;
}

export default function BadgeNotification({
  open,
  onClose,
  badgeName,
  badgeIcon,
  badgeColor,
  badgeDescription,
}: BadgeNotificationProps) {
  const { showBadgeNotification } = useBadgeNotification();
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !shownRef.current) {
      showBadgeNotification({
        badgeName,
        badgeIcon,
        badgeColor,
        badgeDescription,
      });
      shownRef.current = true;
      // Call onClose after showing the notification
      onClose();
    }
    
    if (!open) {
      shownRef.current = false;
    }
  }, [open, badgeName, badgeIcon, badgeColor, badgeDescription, showBadgeNotification, onClose]);

  // This component doesn't render anything - notistack handles the display
  return null;
}
