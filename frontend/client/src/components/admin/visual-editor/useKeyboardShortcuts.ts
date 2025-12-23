import { useEffect, useRef } from 'react';
import { useVisualEditor } from './VisualEditorContext';
import { EditorElement } from './VisualEditorContext';

export const useKeyboardShortcuts = () => {
  const {
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
    addElement,
  } = useVisualEditor();
  
  // Placeholder functions for features not yet in context
  const groupElements = (_ids: string[]) => { console.log('Group elements not yet implemented'); };
  const ungroupElements = (_id: string) => { console.log('Ungroup elements not yet implemented'); };
  const bringForward = (_id: string) => { console.log('Bring forward not yet implemented'); };
  const sendBackward = (_id: string) => { console.log('Send backward not yet implemented'); };

  const clipboardRef = useRef<EditorElement[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Prevent default browser shortcuts for our custom ones
      const shouldPreventDefault =
        (modifier &&
          ['z','y','c','v','d','a','g','0','=','-','[',']'].includes(
            e.key.toLowerCase(),
          )) ||
        ['Delete','Backspace'].includes(e.key);

      if (shouldPreventDefault) {
        e.preventDefault();
      }

      // Undo: Cmd/Ctrl + Z
      if (modifier && e.key.toLowerCase() === 'z' && !e.shiftKey && canUndo) {
        console.log('⌨️ Undo');
        undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        modifier &&
        ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') &&
        canRedo) {
        console.log('⌨️ Redo');
        redo();
        return;
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused()) {
        console.log('⌨️ Delete selected');
        if (state.selectedElement) {
          deleteElement(state.selectedElement);
        } else if (state.selectedElements.length > 0) {
          state.selectedElements.forEach((elemId) => deleteElement(elemId));
        }
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (modifier && e.key.toLowerCase() === 'd') {
        console.log('⌨️ Duplicate');
        if (state.selectedElement) {
          duplicateElement(state.selectedElement);
        } else if (state.selectedElements.length > 0) {
          state.selectedElements.forEach((id) => duplicateElement(id));
        }
        return;
      }

      // Select All: Cmd/Ctrl + A
      if (modifier && e.key.toLowerCase() === 'a') {
        console.log('⌨️ Select All');
        const allIds = state.elements.map((el) => el.id);
        selectElements(allIds);
        return;
      }

      // Deselect: Escape
      if (e.key === 'Escape') {
        console.log('⌨️ Deselect');
        selectElement(null);
        selectElements([]);
        return;
      }

      // Copy: Cmd/Ctrl + C
      if (modifier && e.key.toLowerCase() === 'c' && !isInputFocused()) {
        console.log('⌨️ Copy');
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
            navigator.clipboard
              .writeText(JSON.stringify(clipboardData))
              .then(() => console.log(`✅ Copied ${copiedElements.length} element(s) to clipboard`))
              .catch((err) => console.warn('⚠️ Could not write to clipboard:', err));
          } else {
            console.log(`✅ Copied ${copiedElements.length} element(s) (internal only)`);
          }
        }
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (modifier && e.key.toLowerCase() === 'v' && !isInputFocused()) {
        console.log('⌨️ Paste');

        const pasteFromInternalClipboard = () => {
          if (clipboardRef.current.length > 0) {
            const pasteX = 50;
            const pasteY = 50;

            clipboardRef.current.forEach((element) => {
              const newElement = {
                ...element,
                id: undefined as any,
                x: element.x + pasteX,
                y: element.y + pasteY,
              };
              delete newElement.id;
              addElement(newElement);
            });

            pasteElements(pasteX, pasteY);
            console.log(`✅ Pasted ${clipboardRef.current.length} element(s)`);
          } else {
            console.log('⚠️ Nothing to paste');
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
                  // Valid clipboard data from our editor
                  const pasteX = 50;
                  const pasteY = 50;

                  clipboardData.elements.forEach((element: EditorElement) => {
                    const newElement = {
                      ...element,
                      id: undefined as any,
                      x: element.x + pasteX,
                      y: element.y + pasteY,
                    };
                    delete newElement.id;
                    addElement(newElement);
                  });

                  pasteElements(pasteX, pasteY);
                  console.log(
                    `✅ Pasted ${clipboardData.elements.length} element(s) from clipboard`,
                  );
                  return;
                }
              } catch (err) {
                // Not valid JSON or not our data format, fall back to internal clipboard
              }

              // Fall back to internal clipboard
              pasteFromInternalClipboard();
            })
            .catch(() => {
              // Clipboard API failed, use internal clipboard
              pasteFromInternalClipboard();
            });
        } else {
          // Clipboard API not available, use internal clipboard
          pasteFromInternalClipboard();
        }

        return;
      }

      // Zoom In: Cmd/Ctrl + +
      if (modifier && (e.key === '=' || e.key === '+')) {
        console.log('⌨️ Zoom In');
        const newZoom = Math.min(state.zoom + 0.1, 3); // Max 300%
        setZoom(newZoom);
        console.log(`🔍 Zoom: ${Math.round(newZoom * 100)}%`);
        return;
      }

      // Zoom Out: Cmd/Ctrl + -
      if (modifier && e.key === '-') {
        console.log('⌨️ Zoom Out');
        const newZoom = Math.max(state.zoom - 0.1, 0.1); // Min 10%
        setZoom(newZoom);
        console.log(`🔍 Zoom: ${Math.round(newZoom * 100)}%`);
        return;
      }

      // Fit to Screen: Cmd/Ctrl + 0
      if (modifier && e.key === '0') {
        console.log('⌨️ Fit to Screen');
        setZoom(1); // Reset to 100%
        console.log('🔍 Zoom: 100% (Reset)');
        return;
      }

      // Group: Cmd/Ctrl + G
      if (modifier && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        console.log('⌨️ Group');
        if (state.selectedElements.length > 1) {
          groupElements(state.selectedElements);
          console.log(`✅ Grouped ${state.selectedElements.length} elements`);
        } else {
          console.log('⚠️ Select at least 2 elements to group');
        }
        return;
      }

      // Ungroup: Cmd/Ctrl + Shift + G
      if (modifier && e.key.toLowerCase() === 'g' && e.shiftKey) {
        console.log('⌨️ Ungroup');
        if (state.selectedElement) {
          const element = state.elements.find((el) => el.id === state.selectedElement);
          if (element && element.children && element.children.length > 0) {
            ungroupElements(state.selectedElement);
            console.log(`✅ Ungrouped element with ${element.children.length} children`);
          } else {
            console.log('⚠️ Selected element is not a group');
          }
        } else {
          console.log('⚠️ Select a group to ungroup');
        }
        return;
      }

      // Bring Forward: Cmd/Ctrl + ]
      if (modifier && e.key === ']') {
        console.log('⌨️ Bring Forward');
        if (state.selectedElement) {
          bringForward(state.selectedElement);
          console.log('✅ Brought element forward');
        }
        return;
      }

      // Send Backward: Cmd/Ctrl + [
      if (modifier && e.key === '[') {
        console.log('⌨️ Send Backward');
        if (state.selectedElement) {
          sendBackward(state.selectedElement);
          console.log('✅ Sent element backward');
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
    addElement,
    groupElements,
    ungroupElements,
    bringForward,
    sendBackward,
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
