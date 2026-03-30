import { useEffect, useRef } from 'react';
import { useVisualEditor, type EditorElement } from './VisualEditorContext';

export const useKeyboardShortcuts = () => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    state,
    addElement,
    deleteElement,
    duplicateElement,
    selectElement,
    selectElements,
    setZoom,
    copyElements,
    pasteElements,
    groupElements,
    ungroupElement,
    reorderElement,
    saveProject,
    setCurrentOrientation,
  } = useVisualEditor();

  const clipboardRef = useRef<EditorElement[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Prevent default browser shortcuts for our custom ones
      const shouldPreventDefault =
        (modifier &&
          ['z','y','c','v','d','a','g','s','0','=','-','[',']','r'].includes(
            e.key.toLowerCase(),
          )) ||
        ['Delete','Backspace'].includes(e.key);

      if (shouldPreventDefault) {
        e.preventDefault();
      }

      // Save: Cmd/Ctrl + S
      if (modifier && e.key.toLowerCase() === 's' && !isInputFocused()) {
        saveProject();
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if (modifier && e.key.toLowerCase() === 'z' && !e.shiftKey && canUndo) {
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        modifier &&
        ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') &&
        canRedo) {
        redo();
        return;
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
        if (state.selectedElement) {
          deleteElement(state.selectedElement);
        } else if (state.selectedElements.length > 0) {
          state.selectedElements.forEach((elemId) => deleteElement(elemId));
        }
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (modifier && e.key.toLowerCase() === 'd') {
        if (state.selectedElement) {
          duplicateElement(state.selectedElement);
        } else if (state.selectedElements.length > 0) {
          state.selectedElements.forEach((id) => duplicateElement(id));
        }
        return;
      }

      // Select All: Cmd/Ctrl + A
      if (modifier && e.key.toLowerCase() === 'a') {
        const allIds = state.elements.map((el) => el.id);
        selectElements(allIds);
        return;
      }

      // Deselect: Escape
      if (e.key === 'Escape') {
        selectElement(null);
        selectElements([]);
        return;
      }

      // Copy: Cmd/Ctrl + C
      if (modifier && e.key.toLowerCase() === 'c' && !isInputFocused()) {
        const elementsToCopy: string[] = [];
        if (state.selectedElement) {
          elementsToCopy.push(state.selectedElement);
        } else if (state.selectedElements.length > 0) {
          elementsToCopy.push(...state.selectedElements);
        }

        if (elementsToCopy.length > 0) {
          const copiedElements = state.elements.filter((el) => elementsToCopy.includes(el.id));
          clipboardRef.current = copiedElements;
          copyElements(elementsToCopy);

          // Also copy to system clipboard as JSON
          if (navigator.clipboard && navigator.clipboard.writeText) {
            const clipboardData = {
              type: 'visual-editor-elements',
              elements: copiedElements,
              timestamp: Date.now(),
            };
            navigator.clipboard.writeText(JSON.stringify(clipboardData)).catch(() => {
              // Fall back to internal clipboard if system clipboard rejects the write.
            });
          }
        }
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (modifier && e.key.toLowerCase() === 'v' && !isInputFocused()) {
        const pasteOffset = 50;

        const pasteFromInternalClipboard = () => {
          if (clipboardRef.current.length > 0) {
            clipboardRef.current.forEach((element) => {
              // Omit the old id so addElement generates a new one
              const { id: _oldId, ...rest } = element;
              addElement({
                ...rest,
                x: element.x + pasteOffset,
                y: element.y + pasteOffset,
              });
            });
            pasteElements(pasteOffset, pasteOffset);
          }
        };

        // Try to read from system clipboard first
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard
            .readText()
            .then((text) => {
              try {
                const clipboardData = JSON.parse(text);
                if (clipboardData.type === 'visual-editor-elements' && clipboardData.elements) {
                  (clipboardData.elements as EditorElement[]).forEach((element) => {
                    const { id: _oldId, ...rest } = element;
                    addElement({
                      ...rest,
                      x: element.x + pasteOffset,
                      y: element.y + pasteOffset,
                    });
                  });
                  pasteElements(pasteOffset, pasteOffset);
                  return;
                }
              } catch {
                // Not valid JSON, fall back to internal clipboard
              }
              pasteFromInternalClipboard();
            })
            .catch(() => {
              pasteFromInternalClipboard();
            });
        } else {
          pasteFromInternalClipboard();
        }

        return;
      }

      // Zoom In: Cmd/Ctrl + +
      if (modifier && (e.key === '=' || e.key === '+')) {
        const newZoom = Math.min(state.zoom + 0.1, 3);
        setZoom(newZoom);
        return;
      }

      // Zoom Out: Cmd/Ctrl + -
      if (modifier && e.key === '-') {
        const newZoom = Math.max(state.zoom - 0.1, 0.1);
        setZoom(newZoom);
        return;
      }

      // Fit to Screen: Cmd/Ctrl + 0
      if (modifier && e.key === '0') {
        const fitCanvasEvent = new CustomEvent('visual-editor:fit-canvas', {
          cancelable: true,
        });
        window.dispatchEvent(fitCanvasEvent);

        if (!fitCanvasEvent.defaultPrevented) {
          setZoom(1);
        }
        return;
      }

      // Rotate Device: Cmd/Ctrl + Shift + R
      if (modifier && e.shiftKey && e.key.toLowerCase() === 'r' && state.currentBreakpoint !== 'desktop') {
        setCurrentOrientation(state.currentOrientation === 'portrait' ? 'landscape' : 'portrait');
        return;
      }

      // Group: Cmd/Ctrl + G
      if (modifier && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        if (state.selectedElements.length > 1) {
          groupElements(state.selectedElements);
        }
        return;
      }

      // Ungroup: Cmd/Ctrl + Shift + G
      if (modifier && e.key.toLowerCase() === 'g' && e.shiftKey) {
        if (state.selectedElement) {
          const element = state.elements.find((el) => el.id === state.selectedElement);
          if (element && element.children && element.children.length > 0) {
            ungroupElement(state.selectedElement);
          }
        }
        return;
      }

      // Bring Forward: Cmd/Ctrl + ]
      if (modifier && e.key === ']') {
        if (state.selectedElement) {
          reorderElement(state.selectedElement, 'down');
        }
        return;
      }

      // Send Backward: Cmd/Ctrl + [
      if (modifier && e.key === '[') {
        if (state.selectedElement) {
          reorderElement(state.selectedElement, 'up');
        }
        return;
      }
    };

    // Helper to check if input/textarea is focused
    const isInputFocused = (): boolean => {
      const activeElement = document.activeElement;
      return (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true'
      );
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    state,
    deleteElement,
    duplicateElement,
    selectElement,
    selectElements,
    setZoom,
    copyElements,
    pasteElements,
    groupElements,
    ungroupElement,
    reorderElement,
    saveProject,
    setCurrentOrientation,
  ]);
};

// Helper to get shortcut display text
export const getShortcutText = (shortcut: string): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierSymbol = isMac ? '⌘' : 'Ctrl';

  return shortcut
    .replace('Cmd', modifierSymbol)
    .replace('Ctrl', modifierSymbol)
    .replace('Shift','⇧')
    .replace('Alt','⌥')
    .replace('Delete', '⌫')
    .replace('Backspace', '⌫');
};

// Keyboard shortcuts reference
export const SHORTCUTS = {
  undo: 'Cmd+Z',
  redo: 'Cmd+Shift+Z',
  delete: 'Delete',
  duplicate: 'Cmd+D',
  copy: 'Cmd+C',
  paste: 'Cmd+V',
  selectAll: 'Cmd+A',
  deselect: 'Esc',
  zoomIn: 'Cmd++',
  zoomOut: 'Cmd+-',
  fitToScreen: 'Cmd+0',
  group: 'Cmd+G',
  ungroup: 'Cmd+Shift+G',
  bringForward: 'Cmd+]',
  sendBackward:'Cmd+[',
};
