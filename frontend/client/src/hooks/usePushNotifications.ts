/**
 * usePushNotifications Hook
 * Handles push notification subscription and management
 */

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications(userId?: string, contextId?: string) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    if (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    ) {
      setIsSupported(true);
      checkExistingSubscription();
    }
  }, []);

  // Check for existing subscription
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        setSubscription({
          endpoint: existingSubscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(existingSubscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(existingSubscription.getKey('auth')!),
          },
        });
        setPushEnabled(true);
      }
    } catch (error) {
      console.error('Error checking push subscription: ', error);
    }
  };

  // Convert VAPID public key from base64 URL to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) {
      console.warn('Push notifications not supported or user not logged in');
      return false;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        setIsLoading(false);
        return false;
      }

      // Register service worker if not already registered
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported');
      }

      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from environment
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }
      const applicationServerKey = Uint8Array.from(urlBase64ToUint8Array(vapidPublicKey));

      // Subscribe to push notifications
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subscriptionData: PushSubscription = {
        endpoint: newSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(newSubscription.getKey('auth')!),
        },
      };

      // Send subscription to server
      await apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subscriptionData,
          timelineId: contextId, // Optional context ID (e.g., timeline ID)
        }),
      });

      setSubscription(subscriptionData);
      setPushEnabled(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      setIsLoading(false);
      return false;
    }
  }, [isSupported, userId, contextId]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) {
      return false;
    }

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      // Remove subscription from server
      await apiRequest('/api/push/unsubscribe', {
        method:'POST',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      setSubscription(null);
      setPushEnabled(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      setIsLoading(false);
      return false;
    }
  }, [subscription]);

  // Toggle push notifications
  const toggle = useCallback(async () => {
    if (pushEnabled) {
      return await unsubscribe();
    } else {
      return await subscribe();
    }
  }, [pushEnabled, subscribe, unsubscribe]);

  return {
    pushEnabled,
    isSupported,
    isLoading,
    subscription,
    subscribe,
    unsubscribe,
    toggle,
  };
}




