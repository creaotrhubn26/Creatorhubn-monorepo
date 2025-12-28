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
  Paper,
  useTheme,
  useMediaQuery,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!isSupported) {
    return (
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          mb: 2,
        }}
      >
        <Alert
          severity="info"
          sx={{
            bgcolor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            '& .MuiAlert-icon': {
              color: '#3b82f6',
            },
          }}
        >
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
            }}
          >
            Push-varsler er ikke støttet i denne nettleseren.
          </Typography>
        </Alert>
      </Paper>
    );
  }

  if (!userId || userId === 'guest') {
    return (
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5 },
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          mb: 2,
        }}
      >
        <Alert
          severity="info"
          sx={{
            bgcolor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            '& .MuiAlert-icon': {
              color: '#3b82f6',
            },
          }}
        >
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
            }}
          >
            Logg inn for å aktivere push-varsler.
          </Typography>
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        background: 'rgba(26, 26, 46, 0.6)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      {showDescription && (
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255, 255, 255, 0.8)',
            mb: 2.5,
            fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
            lineHeight: 1.6,
          }}
        >
          Motta varsler selv når appen er lukket. Du vil få beskjed om nye innleveringer, tidslinjeendringer og viktige oppdateringer.
        </Typography>
      )}

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: { xs: 1.5, sm: 2 },
          background: 'rgba(26, 26, 46, 0.4)',
          borderRadius: '10px',
          border: '1px solid rgba(245, 158, 11, 0.1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, flex: 1 }}>
          {isLoading ? (
            <CircularProgress
              size={isMobile ? 20 : 24}
              sx={{
                color: '#f59e0b',
              }}
            />
          ) : pushEnabled ? (
            <Notifications
              sx={{
                color: '#f59e0b',
                fontSize: { xs: 24, sm: 28, md: 32 },
              }}
            />
          ) : (
            <NotificationsOff
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: { xs: 24, sm: 28, md: 32 },
              }}
            />
          )}
          <Box>
            <Typography
              variant="body1"
              sx={{
                color: '#fff',
                fontWeight: 600,
                fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem' },
                mb: 0.25,
              }}
            >
              {pushEnabled ? 'Push-varsler aktivert' : 'Push-varsler deaktivert'}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
              }}
            >
              {pushEnabled
                ? 'Du vil motta varsler selv når appen er lukket'
                : 'Aktiver for å motta varsler'}
            </Typography>
          </Box>
        </Box>
        <Switch
          checked={pushEnabled}
          onChange={toggle}
          disabled={isLoading}
          sx={{
            '& .MuiSwitch-switchBase': {
              '&.Mui-checked': {
                color: '#f59e0b',
                '& + .MuiSwitch-track': {
                  backgroundColor: '#f59e0b',
                },
              },
            },
            '& .MuiSwitch-track': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
        />
      </Box>

      {pushEnabled && (
        <Paper
          sx={{
            mt: 2,
            p: { xs: 1.5, sm: 2 },
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
          }}
        >
          <Alert
            severity="success"
            icon={false}
            sx={{
              bgcolor: 'transparent',
              color: '#10b981',
              p: 0,
              '& .MuiAlert-message': {
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontSize: '1.2rem' }}>✅</Box>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                }}
              >
                Du vil nå motta push-varsler for viktige oppdateringer.
              </Typography>
            </Box>
          </Alert>
        </Paper>
      )}

      {!pushEnabled && !isLoading && (
        <Paper
          sx={{
            mt: 2,
            p: { xs: 1.5, sm: 2 },
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.08) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
          }}
        >
          <Alert
            severity="info"
            icon={false}
            sx={{
              bgcolor: 'transparent',
              color: '#3b82f6',
              p: 0,
              '& .MuiAlert-message': {
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box component="span" sx={{ fontSize: '1.2rem' }}>💡</Box>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                }}
              >
                Aktiver push-varsler for å få beskjed selv når appen er lukket.
              </Typography>
            </Box>
          </Alert>
        </Paper>
      )}
    </Paper>
  );
}
























