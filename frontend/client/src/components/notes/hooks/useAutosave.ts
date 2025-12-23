// client/src/components/notes/hooks/useAutosave.ts
import { useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';

/**
 * Autosave hook: *  - Debounces onSave() whenever any dependency changes
 *  - Binds Cmd/Ctrl+S to immediate save
 */
export function useAutosave(onSave: () => void, deps: any[], delay = 800) {
  const debounced = useRef(debounce(onSave, delay)).current;

  useEffect(() => {
    debounced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [...deps, debounced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() ==='s') {
        e.preventDefault();
        try {
          onSave();
      } catch {}
    }
  };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
}, [onSave]);
}
