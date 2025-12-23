/**
 * useKeyboardShortcuts - Keyboard shortcuts for Virtual Studio
 * 
 * Shortcuts:
 * - G: Toggle grid
 * - R: Rotate selected (15° increments)
 * - Shift+R: Rotate selected (90° increments)
 * - T: Translate mode
 * - S: Scale mode
 * - Delete/Backspace: Delete selected
 * - Ctrl+D: Duplicate selected
 * - Ctrl+G: Group selected
 * - Ctrl+Shift+G: Ungroup
 * - Ctrl+Z: Undo
 * - Ctrl+Shift+Z / Ctrl+Y: Redo
 * - Space: Toggle play/pause animation
 * - F: Frame selected (zoom to fit)
 * - H: Hide selected
 * - Shift+H: Show all
 * - 1-9: Quick select camera presets
 * - Escape: Deselect all
 */

import { useEffect, useCallback, useRef } from 'react';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface KeyboardShortcutCallbacks {
  onToggleGrid?: () => void;
  onRotate?: (degrees: number) => void;
  onSetTransformMode?: (mode: TransformMode) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onTogglePlay?: () => void;
  onFrameSelected?: () => void;
  onHideSelected?: () => void;
  onShowAll?: () => void;
  onCameraPreset?: (index: number) => void;
  onDeselect?: () => void;
  onToggleSnap?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  callbacks: KeyboardShortcutCallbacks;
}

export interface UseKeyboardShortcutsReturn {
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  activeModifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions
): UseKeyboardShortcutsReturn {
  const { enabled = true, callbacks } = options;
  const enabledRef = useRef(enabled);
  const modifiersRef = useRef({
    shift: false,
    ctrl: false,
    alt: false,
    meta: false,
  });

  // Update ref when enabled changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Update modifiers
      modifiersRef.current = {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
      };

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey; // Support both Ctrl and Cmd (Mac)
      const shift = e.shiftKey;

      // Ctrl/Cmd combinations
      if (ctrl) {
        switch (key) {
          case 'z':
            e.preventDefault();
            if (shift) {
              callbacks.onRedo?.();
            } else {
              callbacks.onUndo?.();
            }
            return;
          case 'y':
            e.preventDefault();
            callbacks.onRedo?.();
            return;
          case 'd':
            e.preventDefault();
            callbacks.onDuplicate?.();
            return;
          case 'g':
            e.preventDefault();
            if (shift) {
              callbacks.onUngroup?.();
            } else {
              callbacks.onGroup?.();
            }
            return;
          case 'c':
            e.preventDefault();
            callbacks.onCopy?.();
            return;
          case 'v':
            e.preventDefault();
            callbacks.onPaste?.();
            return;
          case 'a':
            e.preventDefault();
            callbacks.onSelectAll?.();
            return;
        }
        return;
      }

      // Single key shortcuts
      switch (key) {
        case 'g':
          e.preventDefault();
          callbacks.onToggleGrid?.();
          break;
        case 'r':
          e.preventDefault();
          callbacks.onRotate?.(shift ? 90 : 15);
          break;
        case 't':
          e.preventDefault();
          callbacks.onSetTransformMode?.('translate');
          break;
        case 's':
          // Only if not in input and S key (not ctrl+s for save)
          e.preventDefault();
          callbacks.onSetTransformMode?.('scale');
          break;
        case 'e':
          e.preventDefault();
          callbacks.onSetTransformMode?.('rotate');
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          callbacks.onDelete?.();
          break;
        case '':
          e.preventDefault();
          callbacks.onTogglePlay?.();
          break;
        case 'f':
          e.preventDefault();
          callbacks.onFrameSelected?.();
          break;
        case 'h':
          e.preventDefault();
          if (shift) {
            callbacks.onShowAll?.();
          } else {
            callbacks.onHideSelected?.();
          }
          break;
        case 'escape':
          e.preventDefault();
          callbacks.onDeselect?.();
          break;
        case 'x':
          e.preventDefault();
          callbacks.onToggleSnap?.();
          break;
        // Number keys for camera presets
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          callbacks.onCameraPreset?.(parseInt(key, 10));
          break;
      }
    },
    [callbacks]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    modifiersRef.current = {
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
    };
  }, []);

  // Attach event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isEnabled: enabled,
    setEnabled: (newEnabled: boolean) => {
      enabledRef.current = newEnabled;
    },
    activeModifiers: modifiersRef.current,
  };
}

/**
 * Shortcut reference for UI display
 */
export const SHORTCUT_REFERENCE = [
  { key: 'G', description: 'Toggle grid', category: 'View' },
  { key: 'X', description: 'Toggle snap', category: 'View' },
  { key: 'F', description: 'Frame selected', category: 'View' },
  { key: 'H', description: 'Hide selected', category: 'View' },
  { key: 'Shift+H', description: 'Show all', category: 'View' },
  { key: 'T', description: 'Translate mode', category: 'Transform' },
  { key: 'R', description: 'Rotate 15°', category: 'Transform' },
  { key: 'Shift+R', description: 'Rotate 90°', category: 'Transform' },
  { key: 'E', description: 'Rotate mode', category: 'Transform' },
  { key: 'S', description: 'Scale mode', category: 'Transform' },
  { key: 'Delete', description: 'Delete selected', category: 'Edit' },
  { key: 'Ctrl+D', description: 'Duplicate', category: 'Edit' },
  { key: 'Ctrl+C', description: 'Copy', category: 'Edit' },
  { key: 'Ctrl+V', description: 'Paste', category: 'Edit' },
  { key: 'Ctrl+G', description: 'Group', category: 'Edit' },
  { key: 'Ctrl+Shift+G', description: 'Ungroup', category: 'Edit' },
  { key: 'Ctrl+Z', description: 'Undo', category: 'History' },
  { key: 'Ctrl+Shift+Z', description: 'Redo', category: 'History' },
  { key: 'Ctrl+A', description: 'Select all', category: 'Selection' },
  { key: 'Escape', description: 'Deselect all', category: 'Selection' },
  { key: 'Space', description: 'Play/Pause', category: 'Animation' },
  { key: '1-9', description: 'Camera presets', category: 'Camera' },
];

export default useKeyboardShortcuts;

