/**
 * PushNotificationSettings Component
 * Reusable component for push notification subscription settings
 */

import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { Notifications, NotificationsOff } from '@mui/icons-material';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTheming } from '../../utils/theming-helper';

interface PushNotificationSettingsProps {
  userId?: string;
  contextId?: string; // Optional context ID (e.g., timeline ID, project ID)
  showDescription?: boolean;
}

export function PushNotificationSettings({
  userId,
  contextId,
  showDescription = true,
}: PushNotificationSettingsProps) {
  const { pushEnabled, isSupported, isLoading, toggle } = usePushNotifications(userId, contextId);
  const theming = useTheming();

  if (!isSupported) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Push-varsler er ikke støttet i denne nettleseren.
      </Alert>
    );
  }

  if (!userId || userId === 'guest') {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        Logg inn for å aktivere push-varsler.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
      {showDescription && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Motta varsler selv når appen er lukket. Du vil få beskjed om nye innleveringer, tidslinjeendringer og viktige oppdateringer.
        </Typography>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={pushEnabled}
            onChange={toggle}
            disabled={isLoading}
            color="primary"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLoading ? (
              <CircularProgress size={16} />
            ) : pushEnabled ? (
              <Notifications color="primary" />
            ) : (
              <NotificationsOff />
            )}
            <Typography variant="body1">
              {pushEnabled ? 'Push-varsler aktivert' : 'Push-varsler deaktivert'}
            </Typography>
          </Box>
        }
        sx={{
         '& .MuiFormControlLabel-label': {
            color: theming.colors.text,
          }}}
      />

      {pushEnabled && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Du vil nå motta push-varsler for viktige oppdateringer.
        </Alert>
      )}

      {!pushEnabled && !isLoading && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Aktiver push-varsler for å få beskjed selv når appen er lukket.
        </Alert>
      )}
    </Box>
  );
}
























