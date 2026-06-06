/**
 * webPushClient.ts — Slice 9X.43
 *
 * Frontend helpers for å subscribe på web-push via service-worker.
 * Stine får varsler på mobilen selv når app er lukket — viktig for plan-B
 * og overtid-aktivering.
 */

import { apiRequest } from '@/lib/queryClient';

/** base64-url → Uint8Array for VAPID-applicationServerKey */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!(await isPushSupported())) return { ok: false, reason: 'unsupported' };

  let permission = await getPushPermission();
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Re-registrer hos backend i tilfelle subscription er ny for denne brukeren
      await apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: existing.toJSON() as Record<string, unknown>,
      });
      return { ok: true };
    }

    const keyRes: any = await apiRequest('/api/push/public-key').catch(() => null);
    if (!keyRes?.publicKey) return { ok: false, reason: 'no_vapid_key' };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // urlBase64ToUint8Array returnerer Uint8Array<ArrayBufferLike>;
      // pushManager.subscribe forventer BufferSource — cast eksplisitt.
      applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) as BufferSource,
    });
    await apiRequest('/api/push/subscribe', {
      method: 'POST',
      body: sub.toJSON() as Record<string, unknown>,
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'subscribe_failed' };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!(await isPushSupported())) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    await apiRequest('/api/push/unsubscribe', {
      method: 'POST',
      body: { endpoint: sub.endpoint },
    });
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

export async function sendTestPush(): Promise<any> {
  return apiRequest('/api/push/test', { method: 'POST' });
}
