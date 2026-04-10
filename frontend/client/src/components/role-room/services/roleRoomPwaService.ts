import { isRoleRoomDedicatedHost } from '../utils/runtime';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export interface RoleRoomSerializedPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const ROLE_ROOM_SERVICE_WORKER_PATH = '/role-room-sw.js';

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) {
    return '';
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

export function serializePushSubscription(
  subscription: PushSubscription | null,
): RoleRoomSerializedPushSubscription | null {
  if (!subscription) {
    return null;
  }

  const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
  const auth = arrayBufferToBase64(subscription.getKey('auth'));
  if (!subscription.endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
  };
}

export function isRoleRoomPwaRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isRoleRoomDedicatedHost(window.location.hostname);
}

export function isRoleRoomInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

export function getRoleRoomInstallHint(): string {
  if (typeof window === 'undefined') {
    return 'Åpne The Role Room direkte på mobilen for å installere appen.';
  }

  if (!isRoleRoomDedicatedHost(window.location.hostname)) {
    return 'Åpne theroleroom.com direkte for å installere The Role Room som app.';
  }

  if (isIosWebKit()) {
    return 'Åpne Del-menyen i Safari og velg «Legg til på Hjem-skjermen».';
  }

  return 'Bruk nettleserens installeringsvalg for å legge The Role Room på hjemskjermen.';
}

export async function registerRoleRoomPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (
    typeof window === 'undefined'
    || !isRoleRoomDedicatedHost(window.location.hostname)
    || !('serviceWorker' in navigator)
  ) {
    return null;
  }

  return navigator.serviceWorker.register(ROLE_ROOM_SERVICE_WORKER_PATH, { scope: '/' });
}
