// @ts-nocheck
// ============================================
// useEquipmentInventory — fetch + cache per projectId
// ============================================
// Moves equipment data out of main component state
// into a dedicated hook with project-keyed caching.
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { castingService } from '../../services/castingService';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
}

type CategoryKey = 'camera' | 'lens' | 'rig';

const CATEGORY_MAP: Record<CategoryKey, string[]> = {
  camera: ['camera', 'kamera'],
  lens: ['lens', 'linse', 'optikk', 'optics'],
  rig: ['rig', 'stabilizer', 'stativ', 'tripod', 'gimbal', 'dolly', 'crane', 'slider'],
};

/** Normalize a raw category string to a canonical CategoryKey (or 'other') */
function normalizeCategory(raw: string): CategoryKey | 'other' {
  const lower = raw.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(CATEGORY_MAP) as [CategoryKey, string[]][]) {
    if (aliases.includes(lower)) return key;
  }
  return 'other';
}

// Derived list of all recognized aliases (used externally if needed)
const _EQUIPMENT_CATEGORIES = [
  'equipment',
  ...Object.values(CATEGORY_MAP).flat(),
];

// Module-level cache: projectId → equipment list
const cache = new Map<string, EquipmentItem[]>();

export interface UseEquipmentInventoryReturn {
  equipment: EquipmentItem[];
  loading: boolean;
  getByCategory: (category: CategoryKey) => EquipmentItem[];
  refresh: () => void;
}

export function useEquipmentInventory(projectId: string): UseEquipmentInventoryReturn {
  const [equipment, setEquipment] = useState<EquipmentItem[]>(() => cache.get(projectId) ?? []);
  const [loading, setLoading] = useState(!cache.has(projectId));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchEquipment = useCallback(async () => {
    if (!projectId) return;

    // Use cache if available
    const cached = cache.get(projectId);
    if (cached) {
      setEquipment(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Ensure mock data is initialized
      try {
        await castingService.initializeMockData();
      } catch (_error) {
        console.warn('Could not initialize mock data:', _error);
      }

      const project = await castingService.getProject(projectId);
      if (!mountedRef.current) return;

      if (project?.props) {
        const items: EquipmentItem[] = project.props
          .filter((prop: { category: string }) => {
            const norm = normalizeCategory(prop.category);
            return norm !== 'other' || prop.category.toLowerCase() === 'equipment';
          })
          .map((prop: { id: string; name: string; category: string }) => ({
            id: prop.id,
            name: prop.name,
            category: normalizeCategory(prop.category) as string,
          }));
        cache.set(projectId, items);
        setEquipment(items);
      } else {
        cache.set(projectId, []);
        setEquipment([]);
      }
    } catch (_error) {
      console.error('Error loading equipment:', _error);
      if (mountedRef.current) setEquipment([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  const getByCategory = useCallback((category: CategoryKey): EquipmentItem[] => {
    // Items are stored with normalized category keys, so direct comparison suffices
    return equipment.filter(item => item.category === category);
  }, [equipment]);

  const refresh = useCallback(() => {
    cache.delete(projectId);
    fetchEquipment();
  }, [projectId, fetchEquipment]);

  return { equipment, loading, getByCategory, refresh };
}
