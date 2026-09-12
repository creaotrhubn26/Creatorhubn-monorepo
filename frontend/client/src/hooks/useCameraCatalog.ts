/**
 * useCameraCatalog — selvoppdaterende kamerakatalog.
 *
 * Starter med den innebygde statiske databasen (WORLD_CAMERA_DATABASE) og
 * merger inn kameraer fra Utstyrsdatabase-adminen (GET /api/equipment/cameras,
 * products-tabellen) når de finnes. Dedup på «Brand Model» — admin-oppføringer
 * VINNER over statiske (så spesifikasjoner kan korrigeres uten deploy).
 *
 * Best-effort: feiler API-et (offline, kaldstart) står den statiske lista
 * urørt. Resultatet caches per sidelast (modul-nivå) så flere komponenter
 * ikke fetcher hver for seg.
 */
import { useEffect, useState } from 'react';
import { WORLD_CAMERA_DATABASE, type CameraSpec } from '../../../shared/camera-database';

interface ApiCamera {
  brand: string;
  model: string;
  category: string | null;
  megapixels: number | null;
  averageRawSize: number | null;
  averageCrawSize: number | null;
  maxVideoBitrateMbps: number | null;
  cardTypes: unknown[];
  fileFormat: unknown[];
}

const CATEGORIES = new Set(['mirrorless', 'dslr', 'medium_format', 'cinema']);

function toSpec(camera: ApiCamera): CameraSpec | null {
  if (!camera.brand || !camera.model) return null;
  return {
    brand: camera.brand,
    model: camera.model,
    megapixels: camera.megapixels ?? 24,
    fileFormat: (camera.fileFormat || []).filter((f): f is string => typeof f === 'string'),
    // Uten oppgitt RAW-størrelse: ~1.1 MB/MP er en rimelig tommelfinger for
    // ukomprimert/lossless RAW — gir brukbare estimater til specs fylles inn.
    averageRawSize: camera.averageRawSize ?? Math.round((camera.megapixels ?? 24) * 1.1),
    averageCrawSize: camera.averageCrawSize ?? undefined,
    cardTypes: (camera.cardTypes || []).filter((c): c is string => typeof c === 'string'),
    category: (CATEGORIES.has(String(camera.category)) ? camera.category : 'mirrorless') as CameraSpec['category'],
    year: new Date().getFullYear(),
    maxVideoBitrateMbps: camera.maxVideoBitrateMbps ?? undefined,
  };
}

let cachedMerged: CameraSpec[] | null = null;
let inflight: Promise<CameraSpec[]> | null = null;

async function loadMerged(): Promise<CameraSpec[]> {
  if (cachedMerged) return cachedMerged;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const resp = await fetch('/api/equipment/cameras', { credentials: 'same-origin' });
      if (!resp.ok) throw new Error(String(resp.status));
      const data = (await resp.json()) as { cameras?: ApiCamera[] };
      const fromDb = (data.cameras || [])
        .map(toSpec)
        .filter((c): c is CameraSpec => c !== null);
      if (fromDb.length === 0) {
        cachedMerged = WORLD_CAMERA_DATABASE;
        return cachedMerged;
      }
      const byName = new Map<string, CameraSpec>();
      for (const cam of WORLD_CAMERA_DATABASE) byName.set(`${cam.brand} ${cam.model}`.toLowerCase(), cam);
      for (const cam of fromDb) byName.set(`${cam.brand} ${cam.model}`.toLowerCase(), cam); // admin vinner
      cachedMerged = Array.from(byName.values()).sort((a, b) =>
        `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`),
      );
      return cachedMerged;
    } catch {
      // Offline/kaldstart: statisk liste er alltid gyldig fallback.
      return WORLD_CAMERA_DATABASE;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useCameraCatalog(): CameraSpec[] {
  const [cameras, setCameras] = useState<CameraSpec[]>(cachedMerged ?? WORLD_CAMERA_DATABASE);
  useEffect(() => {
    let alive = true;
    void loadMerged().then((merged) => { if (alive) setCameras(merged); });
    return () => { alive = false; };
  }, []);
  return cameras;
}
