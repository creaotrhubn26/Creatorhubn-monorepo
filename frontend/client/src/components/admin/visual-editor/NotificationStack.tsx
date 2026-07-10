/**
 * NotificationStack.tsx
 *
 * addNotification()/state.notifications in VisualEditorContext had no
 * renderer anywhere in EnhancedVisualEditorPage.tsx — every toast (including
 * the Save/Publish success and failure messages) was pushed into state and
 * never shown to the user. This renders that queue as stacked, auto-
 * dismissing alerts.
 */

import React, { useEffect } from 'react';
import { Alert, AlertTitle, Box, Slide } from '@mui/material';
import { useVisualEditor } from './VisualEditorContext';

const AUTO_DISMISS_MS = 5000;

export function NotificationStack() {
  const { state, removeNotification } = useVisualEditor();

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 88,
        right: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxWidth: 380,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {state.notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </Box>
  );
}

function NotificationItem({
  notification,
  onDismiss,
}: {
  notification: { id: string; type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string };
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id]);

  return (
    <Slide direction="left" in mountOnEnter unmountOnExit>
      <Alert
        severity={notification.type}
        onClose={onDismiss}
        sx={{ pointerEvents: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.24)' }}
      >
        <AlertTitle>{notification.title}</AlertTitle>
        {notification.message}
      </Alert>
    </Slide>
  );
}
