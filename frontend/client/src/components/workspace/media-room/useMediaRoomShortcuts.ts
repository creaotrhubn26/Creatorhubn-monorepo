import { useEffect, useRef } from 'react';
import {
  isEditableShortcutTarget,
  resolveMediaRoomShortcut,
  type MediaRoomShortcutId,
} from './mediaRoomShortcuts';

export type MediaRoomShortcutHandlers = Partial<Record<MediaRoomShortcutId, () => void>>;

export function useMediaRoomShortcuts(
  handlers: MediaRoomShortcutHandlers,
  enabled = true,
): void {
  const handlersRef = useRef(handlers);
  const enabledRef = useRef(enabled);
  handlersRef.current = handlers;
  enabledRef.current = enabled;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current || isEditableShortcutTarget(event.target)) return;
      const shortcut = resolveMediaRoomShortcut(event);
      if (!shortcut) return;
      const handler = handlersRef.current[shortcut];
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
