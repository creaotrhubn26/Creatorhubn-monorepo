import { useCallback, useEffect, useMemo, useState } from 'react';

import { roleRoomPushApi } from '../services/castingApiService';
import {
  getRoleRoomInstallHint,
  isIosWebKit,
  isRoleRoomInstalled,
  isRoleRoomPwaRuntime,
  registerRoleRoomPwaServiceWorker,
  serializePushSubscription,
  type BeforeInstallPromptEvent,
  urlBase64ToUint8Array,
} from '../services/roleRoomPwaService';

type RoleRoomNotificationPermission = NotificationPermission | 'unsupported';

function getNotificationPermission(): RoleRoomNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export function useRoleRoomPwa(projectId?: string | null, enabled = true) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRoleRoomInstalled());
  const [notificationPermission, setNotificationPermission] = useState<RoleRoomNotificationPermission>(
    () => getNotificationPermission(),
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLastError, setPushLastError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const canUseDedicatedHost = isRoleRoomPwaRuntime();
  const supportsServiceWorkers = typeof window !== 'undefined' && 'serviceWorker' in navigator;
  const supportsPush = typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
  const isSupported = canUseDedicatedHost && supportsServiceWorkers;
  const canInstall = isSupported && !isInstalled && (Boolean(deferredPrompt) || isIosWebKit());

  const refreshState = useCallback(async () => {
    setIsInstalled(isRoleRoomInstalled());
    setNotificationPermission(getNotificationPermission());

    if (!enabled || !isSupported) {
      setRegistration(null);
      setPushEnabled(false);
      setPushLastError(null);
      return;
    }

    const nextRegistration = await registerRoleRoomPwaServiceWorker();
    setRegistration(nextRegistration);

    if (!nextRegistration || !supportsPush || !projectId) {
      setPushEnabled(false);
      setPushLastError(null);
      return;
    }

    const browserSubscription = await nextRegistration.pushManager.getSubscription();
    const serializedSubscription = serializePushSubscription(browserSubscription);
    if (!serializedSubscription) {
      setPushEnabled(false);
      setPushLastError(null);
      return;
    }

    const subscriptions = await roleRoomPushApi.listProducerSubscriptions(projectId);
    const currentEntry = subscriptions.find((entry) => (
      entry.endpoint === serializedSubscription.endpoint
      && !entry.disabled_at
    ));

    setPushEnabled(Boolean(currentEntry));
    setPushLastError(currentEntry?.last_error ?? null);
  }, [enabled, isSupported, projectId, supportsPush]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setStatusMessage('The Role Room er lagt til på hjemskjermen.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    void refreshState().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : 'Kunne ikke klargjøre mobilappen.');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [enabled, refreshState]);

  const installPwa = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError(getRoleRoomInstallHint());
      return false;
    }

    if (isInstalled) {
      setStatusMessage('The Role Room er allerede installert som app.');
      return true;
    }

    if (!deferredPrompt) {
      setStatusMessage(getRoleRoomInstallHint());
      return false;
    }

    setError(null);
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setStatusMessage('The Role Room er lagt til som app.');
      return true;
    }

    return false;
  }, [deferredPrompt, isInstalled, isSupported]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!projectId) {
      setError('Velg et aktivt prosjekt før du aktiverer mobilvarsler.');
      return false;
    }
    if (!isSupported || !supportsPush) {
      setError('Mobilvarsler støttes ikke i denne nettleseren eller på denne hosten.');
      return false;
    }

    setIsBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        setError('Tillat varsler i nettleseren for å aktivere mobilvarsler.');
        return false;
      }

      const nextRegistration = registration ?? await registerRoleRoomPwaServiceWorker();
      if (!nextRegistration) {
        throw new Error('Kunne ikke registrere The Role Room som mobilapp.');
      }

      setRegistration(nextRegistration);

      const vapidPublicKey = String(import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
      if (!vapidPublicKey) {
        throw new Error('Push-varsler er ikke konfigurert ennå.');
      }

      const browserSubscription = await nextRegistration.pushManager.getSubscription()
        ?? await nextRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

      const serializedSubscription = serializePushSubscription(browserSubscription);
      if (!serializedSubscription) {
        throw new Error('Kunne ikke lese push-abonnementet fra mobilen.');
      }

      await roleRoomPushApi.subscribeProducer(projectId, serializedSubscription);
      await refreshState();
      setStatusMessage('Mobilvarsler er aktive for dette prosjektet.');
      return true;
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Kunne ikke aktivere mobilvarsler.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, projectId, refreshState, registration, supportsPush]);

  const disablePush = useCallback(async (): Promise<boolean> => {
    if (!projectId) {
      setError('Velg et aktivt prosjekt før du skrur av mobilvarsler.');
      return false;
    }

    setIsBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const nextRegistration = registration ?? await registerRoleRoomPwaServiceWorker();
      const browserSubscription = nextRegistration
        ? await nextRegistration.pushManager.getSubscription()
        : null;
      const endpoint = browserSubscription?.endpoint?.trim() || '';
      if (!endpoint) {
        setPushEnabled(false);
        return true;
      }

      await roleRoomPushApi.unsubscribeProducer(projectId, endpoint);
      await refreshState();
      setStatusMessage('Mobilvarsler er skrudd av for dette prosjektet.');
      return true;
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Kunne ikke skru av mobilvarsler.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [projectId, refreshState, registration]);

  const sendTestPush = useCallback(async (): Promise<boolean> => {
    if (!projectId) {
      setError('Velg et aktivt prosjekt før du sender testvarsel.');
      return false;
    }

    setIsBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const sent = await roleRoomPushApi.sendProducerTest(projectId);
      setStatusMessage(sent > 0
        ? 'Testvarsel sendt til mobilen.'
        : 'Ingen aktiv mobilabonnement ble funnet for dette prosjektet.');
      await refreshState();
      return sent > 0;
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : 'Kunne ikke sende testvarsel.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [projectId, refreshState]);

  const installHint = useMemo(() => getRoleRoomInstallHint(), []);

  return {
    canInstall,
    error,
    installHint,
    installPwa,
    isBusy,
    isInstalled,
    isSupported,
    notificationPermission,
    pushEnabled,
    pushLastError,
    sendTestPush,
    statusMessage,
    supportsPush,
    disablePush,
    enablePush,
  };
}
