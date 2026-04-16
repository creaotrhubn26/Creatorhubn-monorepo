import { useCallback, useEffect, useRef, useState } from 'react';
import { productionWorkflowService, type ShootingDay } from '../services/productionWorkflowService';

export function useShootingDays(projectId?: string) {
  const [items, setItems] = useState<ShootingDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
      const days = await productionWorkflowService.getShootingDays(projectId);
      if (requestId !== requestIdRef.current) return;
      setItems(days);
    } catch (loadErr) {
      if (requestId !== requestIdRef.current) return;
      setError(loadErr instanceof Error ? loadErr.message : 'Kunne ikke hente skytedager');
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

  const updateStatus = useCallback(
    async (dayId: string, status: ShootingDay['status']) => {
      setSaveError(null);
      try {
        const updated = await productionWorkflowService.updateShootingDay(dayId, { status });
        if (updated) {
          setItems((prev) => prev.map((d) => (d.id === dayId ? updated : d)));
        }
        return updated;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Kunne ikke oppdatere status');
        throw err;
      }
    },
    [],
  );

  return { items, loading, error, saveError, reload: load, updateStatus };
}
