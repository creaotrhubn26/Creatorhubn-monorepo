/**
 * Scenene en produksjonsdag kan velge blant.
 *
 * Velgeren leste tidligere bare det lokale prosjektet, som kjenner en scene
 * først når den har fått en shotliste eller et scene-breakdown. Troll har ti
 * scener i manuset og fire med shotliste, så seks av dem fantes ikke for den
 * som skulle planlegge dagen — uten noe som forklarte hvorfor.
 *
 * Manuset er fasiten. Det lokale prosjektet får fortsatt bidra, slik at en
 * scene som bare finnes i en shotliste ikke forsvinner, og slik at velgeren
 * virker også når manuskallet ikke svarer.
 */

import type { SceneBreakdown } from '../../models/casting';

export interface SceneOption {
  id: string;
  name: string;
  thumbnail?: string;
}

/** Tallet foran scenen, brukt til sortering. `null` når scenen ikke har ett. */
export function sceneSortKey(scene: { id: string; name: string }): number | null {
  const fromName = scene.name.match(/(\d+)/);
  const fromId = scene.id.match(/scene-(\d+)/i);
  const raw = fromId?.[1] ?? fromName?.[1];
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Visningsnavnet for en manusscene: «12 — Tobias våkner», eller det som finnes. */
export function sceneOptionName(scene: SceneBreakdown): string {
  const nummer = scene.sceneNumber !== undefined && scene.sceneNumber !== null
    ? String(scene.sceneNumber).trim()
    : '';
  const tittel = [scene.sceneName, scene.heading, scene.sceneHeading, scene.locationName]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) ?? '';
  if (nummer && tittel) return `${nummer} — ${tittel}`;
  if (tittel) return tittel;
  if (nummer) return `Scene ${nummer}`;
  return scene.id;
}

/**
 * Slår sammen manusets scener med dem det lokale prosjektet allerede kjenner.
 * Manuset vinner på navn, fordi det er der scenen faktisk heter noe.
 */
export function mergeSceneOptions(
  fromManuscript: readonly SceneBreakdown[],
  fromProject: readonly SceneOption[],
): SceneOption[] {
  const merged = new Map<string, SceneOption>();

  for (const option of fromProject) {
    if (option.id) merged.set(option.id, option);
  }
  for (const scene of fromManuscript) {
    if (!scene.id) continue;
    merged.set(scene.id, {
      id: scene.id,
      name: sceneOptionName(scene),
      thumbnail: merged.get(scene.id)?.thumbnail,
    });
  }

  return [...merged.values()].sort((a, b) => {
    const aKey = sceneSortKey(a);
    const bKey = sceneSortKey(b);
    // Scener uten nummer havner sist, i stedet for å blande seg inn i rekka.
    if (aKey === null && bKey === null) return a.name.localeCompare(b.name, 'nb');
    if (aKey === null) return 1;
    if (bKey === null) return -1;
    return aKey - bKey;
  });
}
