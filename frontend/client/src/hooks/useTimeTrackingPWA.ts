import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface PWASnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

interface GeolocationData {
  lat: number;
  lng: number;
  accuracy: number;
  address?: string;
}

interface PWAStatus {
  isInstalled: boolean;
  isOnline: boolean;
  hasNotificationPermission: boolean;
  hasGeolocationPermission: boolean;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
}

export function useTimeTrackingPWA() {
  const [pwaStatus, setPwaStatus] = useState<PWAStatus>({
    isInstalled: false,
    isOnline: navigator.onLine,
    hasNotificationPermission: false,
    hasGeolocationPermission: false,
    serviceWorkerRegistration: null,
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Initialize PWA
  useEffect(() => {
    // Check if installed
    const isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Check notification permission
    const hasNotificationPermission = Notification.permission === 'granted';

    // Check geolocation permission
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((result) => {
      setPwaStatus((prev) => ({
        ...prev,
        hasGeolocationPermission: result.state === 'granted',
      }));
    });

    setPwaStatus((prev) => ({
      ...prev,
      isInstalled,
      hasNotificationPermission,
    }));

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker-time-tracking.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered: ', registration);
          setPwaStatus((prev) => ({
            ...prev,
            serviceWorkerRegistration: registration,
          }));
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for online/offline
    const handleOnline = () => setPwaStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaStatus((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Snackbar state for notifications
  const [pwaSnackbar, setPwaSnackbar] = useState<PWASnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Install PWA
  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      setPwaSnackbar({ open: true, message: 'Appen er allerede installert eller installasjonsforespørsel er ikke tilgjengelig', severity: 'warning' });
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setPwaStatus((prev) => ({ ...prev, isInstalled: true }));
      return true;
    }

    return false;
  }, [deferredPrompt]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setPwaSnackbar({ open: true, message: 'Varsler støttes ikke i denne nettleseren', severity: 'error' });
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';

    setPwaStatus((prev) => ({ ...prev, hasNotificationPermission: granted }));

    if (granted && pwaStatus.serviceWorkerRegistration) {
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
      if (!vapidKey) {
        setPwaSnackbar({
          open: true,
          message: 'Push-varsler er ikke konfigurert (mangler VAPID-nokkel).',
          severity: 'warning'
        });
        return false;
      }

      // Subscribe to push notifications
      try {
        const subscription = await pwaStatus.serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
        });

        // Send subscription to server
        await apiRequest('/api/time-tracking/push-subscription', {
          method: 'POST',
          body: JSON.stringify(subscription),
        });
      } catch (error) {
        console.error('[PWA] Push subscription failed:', error);
      }
    }

    return granted;
  }, [pwaStatus.serviceWorkerRegistration]);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<GeolocationData> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          // Reverse geocode to get address
          let address = ', ';
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            );
            const data = await response.json();
            address = data.display_name || ', ';
          } catch (error) {
            console.warn('[PWA] Reverse geocoding failed:', error);
          }

          resolve({
            lat: latitude,
            lng: longitude,
            accuracy,
            address,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    });
  }, []);

  // Send local notification
  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!pwaStatus.hasNotificationPermission) {
        console.warn('[PWA] Notification permission not granted');
        return;
      }

      if (pwaStatus.serviceWorkerRegistration) {
        pwaStatus.serviceWorkerRegistration.showNotification(title, {
          icon: '/icons/time-tracking-192.png',
          badge: '/icons/time-tracking-badge.png',
          ...options,
        });
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      } else {
        new Notification(title, options);
      }
    },
    [pwaStatus.hasNotificationPermission, pwaStatus.serviceWorkerRegistration],
  );

  // Schedule reminder
  const scheduleReminder = useCallback(
    (message: string, delayMs: number) => {
      setTimeout(() => {
        sendNotification('Smart Stempling', {
          body: message,
          tag: 'time-tracking-reminder',
          requireInteraction: true,
        });
      }, delayMs);
    },
    [sendNotification],
  );

  // Save for offline sync
  const saveForOfflineSync = useCallback(
    async (type: 'entry' | 'clock-out', data: any) => {
      if (!pwaStatus.serviceWorkerRegistration) {
        console.warn('[PWA] Service Worker not registered');
        return false;
      }

      try {
        // Open IndexedDB
        const db = await openDB();
        const storeName = type === 'entry' ? 'pending-entries' : 'pending-clock-out';

        await new Promise((resolve, reject) => {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.add({ data, timestamp: Date.now() });

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        // Trigger background sync when back online
        const registration = pwaStatus.serviceWorkerRegistration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (registration.sync?.register) {
          await registration.sync.register(
            type === 'entry' ? 'sync-time-entries' : 'sync-clock-out',
          );
        }

        return true;
      } catch (error) {
        console.error('[PWA] Failed to save for offline sync:', error);
        return false;
      }
    },
    [pwaStatus.serviceWorkerRegistration],
  );

  return {
    pwaStatus,
    installPWA,
    requestNotificationPermission,
    getCurrentLocation,
    sendNotification,
    scheduleReminder,
    saveForOfflineSync,
    pwaSnackbar,
    setPwaSnackbar,
  };
}

// Helper: Convert VAPID key
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}

// Helper: Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('time-tracking-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('pending-entries')) {
        db.createObjectStore('pending-entries', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('pending-clock-out')) {
        db.createObjectStore('pending-clock-out', { keyPath:'id', autoIncrement: true });
      }
    };
  });
}






