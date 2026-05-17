// @ts-nocheck
/**
 * PushSettingsCard — Slice 9X.43
 *
 * Lar Stine slå på/av PWA push-varsler og sende et test-push for å
 * verifisere at det fungerer på enheten.
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import { NotificationsActive as PushIcon } from '@mui/icons-material';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from '@/lib/webPushClient';

const PushSettingsCard: React.FC = () => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isPushSupported();
      setSupported(ok);
      if (!ok) return;
      setPermission(await getPushPermission());
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    setStatus(null);
    if (next) {
      const r = await subscribeToPush();
      if (r.ok) {
        setSubscribed(true);
        setStatus('Push-varsler aktivert');
        setPermission(await getPushPermission());
      } else {
        setStatus(r.reason === 'permission_denied' ? 'Nettleseren blokkerte tillatelse' : `Aktivering feilet: ${r.reason}`);
      }
    } else {
      const ok = await unsubscribeFromPush();
      setSubscribed(!ok ? subscribed : false);
      setStatus(ok ? 'Push-varsler deaktivert' : 'Kunne ikke deaktivere');
    }
    setBusy(false);
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      const r: any = await sendTestPush();
      setStatus(`Test sendt: ${r.sent} levert, ${r.failed} feilet, ${r.removed} fjernet`);
    } catch (e: any) {
      setStatus(e?.message || 'Test feilet');
    }
    setBusy(false);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <PushIcon color="primary" />
          <Typography variant="h6">Push-varsler (PWA)</Typography>
        </Stack>

        {supported === false && (
          <Alert severity="info">
            Nettleseren din støtter ikke push-varsler. Bruk Chrome eller Safari på mobil for å aktivere.
          </Alert>
        )}

        {supported === null && <CircularProgress size={20} />}

        {supported && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Få varsler på telefonen selv når appen er lukket — viktig for plan-B-aktivering,
              overtid og andre real-time hendelser fra brudeparet.
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <FormControlLabel
                control={<Switch checked={subscribed} onChange={(e) => handleToggle(e.target.checked)} disabled={busy} />}
                label={subscribed ? 'Aktivert' : 'Deaktivert'}
              />
              {permission === 'denied' && (
                <Chip size="small" color="error" label="Tillatelse blokkert i nettleser" />
              )}
            </Stack>

            {subscribed && (
              <Button size="small" onClick={handleTest} disabled={busy}>
                Send test-varsel
              </Button>
            )}

            {status && <Alert severity="info" sx={{ mt: 1.5 }}>{status}</Alert>}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PushSettingsCard;
