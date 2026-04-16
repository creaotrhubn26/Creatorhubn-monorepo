import { useCallback, useEffect, useRef, useState } from 'react';
import {
  productionWorkflowService,
  type CrewMember,
} from '../services/productionWorkflowService';

export function useProductionCrew(projectId?: string) {
  const [items, setItems] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const crew = await productionWorkflowService.getCrew(projectId);
      if (requestId !== requestIdRef.current) return;
      setItems(crew);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Kunne ikke hente crew');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  return { items, loading, error, reload: load };
}
