/**
 * useResolveIntellisearch — leser nyeste Resolve 21 AI IntelliSearch-
 * data fra plugin-broen og memoriserer resultatet. Brukes av Story-tab
 * og Multi-Agent Director for å vise ekte face/object-data per klipp
 * i stedet for syntetiske signals.
 *
 * Behovs-basert: krever at brukeren har kjørt analyze-intellisearch.lua
 * i Resolve. Hvis ingen analyse foreligger, returneres { found: false,
 * hint } og UI viser en CTA for å kjøre Lua-scriptet.
 */

import { useCallback, useEffect, useState } from "react";
import {
  photoshop,
  type ResolveIntellisearchResult,
} from "../services/photoshopBridgeService";

export interface UseResolveIntellisearch {
  data: ResolveIntellisearchResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResolveIntellisearch(
  options: { clipNameFilter?: string; autoFetch?: boolean } = {},
): UseResolveIntellisearch {
  const { clipNameFilter, autoFetch = false } = options;
  const [data, setData] = useState<ResolveIntellisearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await photoshop.resolveReadIntellisearch(clipNameFilter);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clipNameFilter]);

  useEffect(() => {
    if (autoFetch) {
      void refresh();
    }
  }, [autoFetch, refresh]);

  return { data, loading, error, refresh };
}
