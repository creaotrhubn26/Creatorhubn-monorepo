import { useEffect, useRef } from 'react';
import type { StarRating } from '../../lib/enhancer-session/types';

/**
 * Cull + navigation keyboard shortcuts. Matches Lightroom / Evoto
 * conventions so muscle memory carries over:
 *   1–5       — star rating on the active image
 *   0         — clear rating
 *   P         — pick flag
 *   X         — reject flag
 *   U         — unflag
 *   ArrowLeft — previous image in filmstrip
 *   ArrowRight— next image in filmstrip
 *   \ (hold)  — press-and-hold compare to original (toggle on keydown,
 *                restore on keyup). Meta/Cmd/Ctrl chords are ignored.
 *
 * The hook is disabled whenever focus is inside a text input, textarea,
 * or contentEditable so slider number edits don't fire rating changes.
 */

export interface EnhancerShortcutHandlers {
  activeId: string | null;
  imageIds: string[];
  enabled?: boolean;
  setRating: (id: string, rating: StarRating) => void;
  setFlag: (id: string, flag: 'none' | 'pick' | 'reject') => void;
  selectImage: (id: string) => void;
  setCompareHeld?: (held: boolean) => void;
  copyEdits?: () => void;
  openPasteDialog?: () => void;
  undo?: () => void;
  redo?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // MUI Select collapses into a div[role="combobox"] when focused — treat
  // as editable so the up/down arrows there don't walk the filmstrip.
  if (target.getAttribute('role') === 'combobox') return true;
  return false;
}

export function useEnhancerShortcuts(handlers: EnhancerShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const h = ref.current;
      if (h.enabled === false) return;
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) {
        // Reserve Cmd/Ctrl+Shift+C/V for copy/paste edits — handled below.
        if (event.shiftKey && (event.metaKey || event.ctrlKey)) {
          if (event.key.toLowerCase() === 'c' && h.copyEdits) {
            event.preventDefault();
            h.copyEdits();
            return;
          }
          if (event.key.toLowerCase() === 'v' && h.openPasteDialog) {
            event.preventDefault();
            h.openPasteDialog();
            return;
          }
          // Cmd/Ctrl+Shift+Z → redo (matches the macOS convention).
          if (event.key.toLowerCase() === 'z' && h.redo) {
            event.preventDefault();
            h.redo();
            return;
          }
        } else if (event.metaKey || event.ctrlKey) {
          if (event.key.toLowerCase() === 'z' && h.undo) {
            event.preventDefault();
            h.undo();
            return;
          }
          // Cmd/Ctrl+Y → redo (Windows convention).
          if (event.key.toLowerCase() === 'y' && h.redo) {
            event.preventDefault();
            h.redo();
            return;
          }
        }
        return;
      }

      if (!h.activeId) return;

      const key = event.key;

      if (key >= '0' && key <= '5') {
        event.preventDefault();
        h.setRating(h.activeId, Number(key) as StarRating);
        return;
      }

      switch (key.toLowerCase()) {
        case 'p':
          event.preventDefault();
          h.setFlag(h.activeId, 'pick');
          return;
        case 'x':
          event.preventDefault();
          h.setFlag(h.activeId, 'reject');
          return;
        case 'u':
          event.preventDefault();
          h.setFlag(h.activeId, 'none');
          return;
        case '\\':
          if (event.repeat) return;
          event.preventDefault();
          h.setCompareHeld?.(true);
          return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const ids = h.imageIds;
        const idx = ids.indexOf(h.activeId);
        if (idx < 0 || ids.length <= 1) return;
        event.preventDefault();
        const delta = key === 'ArrowRight' ? 1 : -1;
        const next = ids[(idx + delta + ids.length) % ids.length];
        h.selectImage(next);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const h = ref.current;
      if (h.enabled === false) return;
      if (event.key === '\\' && h.setCompareHeld) {
        h.setCompareHeld(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
