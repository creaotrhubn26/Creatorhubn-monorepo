/**
 * useDanceAnnotationsAggregate — henter ALLE annotations for ALLE clips i
 * et prosjekt parallelt. Brukes av DanceAnnotationsListView + DanceStatisticsView.
 *
 * Backend har ingen aggregate-endpoint, så vi gjør clip-fetch + N parallelle
 * annotation-fetcher. For prosjekter med 100+ clips kan dette være tregt;
 * Promise.all-concurrency-limit kan legges til senere hvis nødvendig.
 */
import React from 'react';

import {
  listClips,
  listAnnotations,
  type VideoClip,
  type VideoAnnotation,
} from './danceVideoService';

export interface AggregatedAnnotation extends VideoAnnotation {
  /** Cached clip-tittel for tabell-visning uten dobbel join. */
  clipTitle: string;
  /** Cached clip-varighet (sek) for tids-relativ visning. */
  clipDurationSec: number | null;
}

export interface UseDanceAnnotationsAggregateOptions {
  projectId: string | null;
  /** Skip auto-fetch for SSR / tester. */
  disabled?: boolean;
}

export interface DanceAnnotationsAggregateHandle {
  clips: readonly VideoClip[];
  annotations: readonly AggregatedAnnotation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDanceAnnotationsAggregate(
  options: UseDanceAnnotationsAggregateOptions,
): DanceAnnotationsAggregateHandle {
  const [clips, setClips] = React.useState<readonly VideoClip[]>([]);
  const [annotations, setAnnotations] = React.useState<readonly AggregatedAnnotation[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (options.disabled) return;
    setLoading(true);
    setError(null);
    try {
      const clipList = await listClips({
        projectId: options.projectId ?? undefined,
        limit: 200,
      });
      // Parallell fetch av annotations per clip — bruker Promise.allSettled
      // så én feilende clip ikke knuser hele aggregate.
      const results = await Promise.allSettled(
        clipList.map((c) => listAnnotations(c.id).then((rows) => ({ clip: c, rows }))),
      );
      const all: AggregatedAnnotation[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const a of r.value.rows) {
            // Skjul tråd-svar (parent_id != null) fra aggregate — de er
            // konversasjons-respons, ikke selvstendige annotations.
            if (a.parentId) continue;
            all.push({
              ...a,
              clipTitle: r.value.clip.title,
              clipDurationSec: r.value.clip.durationSec,
            });
          }
        }
      }
      // Sortert etter clip-tittel + start-tid for forutsigbar visning.
      all.sort((a, b) => {
        const cmp = a.clipTitle.localeCompare(b.clipTitle);
        if (cmp !== 0) return cmp;
        return a.timestampSec - b.timestampSec;
      });
      setClips(clipList);
      setAnnotations(all);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste annotations');
      setLoading(false);
    }
  }, [options.disabled, options.projectId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { clips, annotations, loading, error, refresh };
}
