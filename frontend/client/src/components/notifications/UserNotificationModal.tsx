// @ts-nocheck
/**
 * UserNotificationModal — Slice 9X.54
 *
 * Polles ved login + periodisk (3 min) for nye admin-varslinger som matcher
 * brukerens audience. Vises som modal — én notifikasjon om gangen, prioritert.
 *
 * Special action: 'extend_program' for prototype-testere som tilbyr forlengelse
 * av testperioden. Når akseptert, kaller server som forlenger automatisk.
 *
 * UI-design: én vinduskø, dismiss → POST /seen, accept → POST /act + dismiss.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Box,
  Chip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Campaign as AnnouncementIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackEvent } from '@/utils/ga4-client-tracking';

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: string;
  actionLabel: string | null;
  actionUrl: string | null;
  actionType: 'open_url' | 'extend_program' | 'acknowledge' | null;
  actionPayload: Record<string, any>;
  createdAt: string;
}

const ICONS: Record<string, React.ReactNode> = {
  info: <InfoIcon color="info" />,
  warning: <WarningIcon color="warning" />,
  success: <SuccessIcon color="success" />,
  error: <ErrorIcon color="error" />,
  announcement: <AnnouncementIcon color="primary" />,
};

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 min

const UserNotificationModal: React.FC = () => {
  const [queue, setQueue] = useState<AdminNotification[]>([]);
  const [current, setCurrent] = useState<AdminNotification | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const fetchInbox = async () => {
    try {
      const r: any = await apiRequest('/api/notifications/inbox');
      const next = Array.isArray(r?.notifications) ? r.notifications : [];
      setQueue(next);
      if (next.length > 0 && !current) {
        setCurrent(next[0]);
        trackEvent('user_notification_shown', {
          notification_id: next[0].id,
          type: next[0].type,
          priority: next[0].priority,
          target_audience: next[0].targetAudience,
          action_type: next[0].actionType,
        });
      }
    } catch {
      // Fail silently — varslinger er ikke kritiske
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceQueue = (afterId: string) => {
    const remaining = queue.filter((n) => n.id !== afterId);
    setQueue(remaining);
    setCurrent(remaining[0] || null);
    setActionResult(null);
  };

  const handleDismiss = async () => {
    if (!current) return;
    try { await apiRequest(`/api/notifications/${current.id}/seen`, { method: 'POST' }); } catch { /* ignore */ }
    trackEvent('user_notification_dismissed', { notification_id: current.id });
    advanceQueue(current.id);
  };

  const handleAct = async () => {
    if (!current || !current.actionType) return;
    setBusy(true);
    try {
      // open_url håndteres client-side — navigerer eller åpner ny fane
      if (current.actionType === 'open_url' && current.actionUrl) {
        trackEvent('user_notification_acted', {
          notification_id: current.id,
          action_type: 'open_url',
        });
        await apiRequest(`/api/notifications/${current.id}/act`, { method: 'POST' }).catch(() => undefined);
        window.open(current.actionUrl, '_blank', 'noopener');
        advanceQueue(current.id);
        return;
      }

      const r: any = await apiRequest(`/api/notifications/${current.id}/act`, { method: 'POST' });
      trackEvent('user_notification_acted', {
        notification_id: current.id,
        action_type: current.actionType,
        result: r?.result,
      });

      // extend_program: vis suksess-melding før vi går videre
      if (current.actionType === 'extend_program') {
        const ok = String(r?.result || '').startsWith('extended_');
        setActionResult(ok
          ? `Testperioden din er forlenget! ${r.result.match(/extended_(\d+)w/)?.[1] || ''} ekstra uker lagt til.`
          : 'Kunne ikke forlenge — du er kanskje ikke aktiv tester lenger.');
        // Vent på "OK"-trykk før advance — håndteres i UI
        setBusy(false);
        return;
      }

      advanceQueue(current.id);
    } catch (e: any) {
      setActionResult(e?.message || 'Action feilet');
    } finally {
      setBusy(false);
    }
  };

  if (!current) return null;

  return (
    <Dialog open={!!current} onClose={handleDismiss} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {ICONS[current.type] || ICONS.info}
          <Typography variant="h6">{current.title}</Typography>
        </Stack>
        <IconButton size="small" onClick={handleDismiss} aria-label="Lukk"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {current.priority === 'urgent' && (
            <Chip size="small" color="error" label="Viktig" sx={{ alignSelf: 'flex-start' }} />
          )}
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{current.message}</Typography>

          {actionResult && (
            <Alert severity={actionResult.startsWith('Test') ? 'success' : 'warning'}>
              {actionResult}
            </Alert>
          )}

          {queue.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              {queue.length - 1} flere varslinger venter
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        {actionResult ? (
          <Button onClick={() => advanceQueue(current.id)} variant="contained">OK</Button>
        ) : (
          <>
            <Button onClick={handleDismiss}>{current.actionType ? 'Senere' : 'OK'}</Button>
            {current.actionType && (
              <Button
                variant="contained"
                onClick={handleAct}
                disabled={busy}
              >
                {busy ? 'Behandler…' : (current.actionLabel || 'Aksepter')}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UserNotificationModal;
