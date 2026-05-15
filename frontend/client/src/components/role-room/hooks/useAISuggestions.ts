/**
 * useAISuggestions.ts
 *
 * React-hook for AI Suggestion System. Henter forslag for et prosjekt
 * (eventuelt filtrert), eksponerer count + accept/reject-handlere, og
 * refetcher etter handlinger så UI er konsistent.
 *
 * Arkitekturreferanse:
 *   ../ai-suggestion-architecture.md
 *
 * Eksempel-bruk:
 *   const { suggestions, pendingCount, accept, reject } = useAISuggestions(
 *     projectId,
 *     { sourceType: 'scene', sourceId: sceneId }
 *   );
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AISuggestion, AISuggestionFilter } from '../models/casting';
import {
  fetchSuggestions,
  acceptSuggestion as acceptSuggestionApi,
  rejectSuggestion as rejectSuggestionApi,
} from '../services/aiSuggestionsClient';

export interface UseAISuggestionsResult {
  suggestions: AISuggestion[];
  pendingCount: number;
  loading: boolean;
  error: Error | null;
  accept: (id: string, note?: string) => Promise<void>;
  reject: (id: string, note?: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAISuggestions(
  projectId: string | null | undefined,
  filter?: AISuggestionFilter,
): UseAISuggestionsResult {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stabiliser filter-referanse så useEffect ikke fyrer på hver render.
  const filterKey = useMemo(
    () => (filter ? JSON.stringify(filter) : ''),
    [filter],
  );
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const load = useCallback(async () => {
    if (!projectId) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuggestions(projectId, filterRef.current);
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, filterKey]);

  const accept = useCallback(
    async (id: string, note?: string) => {
      // Optimistic: fjern fra listen umiddelbart
      setSuggestions((current) => current.filter((s) => s.id !== id));
      try {
        await acceptSuggestionApi(id, note);
      } catch (err) {
        // Rull tilbake ved feil — refetch henter sann tilstand
        await load();
        throw err;
      }
    },
    [load],
  );

  const reject = useCallback(
    async (id: string, note?: string) => {
      setSuggestions((current) => current.filter((s) => s.id !== id));
      try {
        await rejectSuggestionApi(id, note);
      } catch (err) {
        await load();
        throw err;
      }
    },
    [load],
  );

  return {
    suggestions,
    pendingCount: suggestions.length,
    loading,
    error,
    accept,
    reject,
    refetch: load,
  };
}
