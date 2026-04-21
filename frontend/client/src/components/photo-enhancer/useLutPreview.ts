import { useEffect, useState } from 'react';
import { encodeLutAtlas, type LutAtlas } from '../../services/preview-shader/lut-atlas';
import { fetchLutTable } from '../../lib/enhancer-session/lut-registry';

/**
 * Fetch + cache a LUT atlas for the WebGL preview. The hook swaps the
 * returned atlas reactively as the selected LUT name changes. Returns
 * ``null`` while loading or when no LUT is selected.
 */
export function useLutPreview(lutName: string | null | undefined): LutAtlas | null {
  const [atlas, setAtlas] = useState<LutAtlas | null>(null);

  useEffect(() => {
    if (!lutName) {
      setAtlas(null);
      return;
    }
    let cancelled = false;
    void fetchLutTable(lutName).then((payload) => {
      if (cancelled || !payload) {
        if (!cancelled) setAtlas(null);
        return;
      }
      try {
        const next = encodeLutAtlas(payload.size, payload.table);
        if (!cancelled) setAtlas(next);
      } catch {
        if (!cancelled) setAtlas(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lutName]);

  return atlas;
}
