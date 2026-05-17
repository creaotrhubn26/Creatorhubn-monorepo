import { useState, useCallback } from 'react';

type EventCallback = (data: unknown) => void;

// DEV-only logging — produksjons-konsoll spammes ikke av real-time-emits
const DEV = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export function useRealTime() {
  const [isConnected, setIsConnected] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const eventListeners = new Map<string, EventCallback[]>();

  const emitEvent = useCallback((event: string, data: unknown) => {
    if (DEV) console.log(`[RealTime] Emit: ${event}`, data);
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }, []);

  const onEvent = useCallback((event: string, callback: EventCallback) => {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, []);
    }
    eventListeners.get(event)!.push(callback);
  }, []);

  const offEvent = useCallback((event: string, callback?: EventCallback) => {
    if (callback) {
      const listeners = eventListeners.get(event);
      if (listeners) {
        eventListeners.set(event, listeners.filter(cb => cb !== callback));
      }
    } else {
      eventListeners.delete(event);
    }
  }, []);

  const createSession = useCallback(async (sessionName: string) => {
    const id = `session-${Date.now()}`;
    setSessionId(id);
    if (DEV) console.log(`[RealTime] Session created: ${id}`);
    return id;
  }, []);

  const joinSession = useCallback(async (id: string) => {
    setSessionId(id);
    if (DEV) console.log(`[RealTime] Joined session: ${id}`);
    return true;
  }, []);

  const leaveSession = useCallback(async () => {
    if (DEV) console.log(`[RealTime] Left session: ${sessionId}`);
    setSessionId(null);
  }, [sessionId]);

  return {
    isConnected,
    sessionId,
    emitEvent,
    onEvent,
    offEvent,
    createSession,
    joinSession,
    leaveSession,
  };
}

export default useRealTime;
