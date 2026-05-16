/**
 * useMoodBoardPalette — observer pinnede mood-board-bilder for en scene
 * og returner en kombinert target-palett som drawing-editor og
 * StyleConsistencyIndicator kan bruke som referanse.
 *
 * Re-ekstraherer kun når set-of-bilder endrer seg (signatur basert på
 * image-id-rekke). Lasting er async (Image-loading + canvas-read), så
 * vi eksponerer en `loading`-flag for UI som vil vise spinner.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { listMoodBoardImages } from './moodBoardStore';
import { extractCombinedPalette } from './moodBoardPalette';
import type { ColorBin } from './styleConsistency';

export interface UseMoodBoardPaletteResult {
  palette: ColorBin[];
  loading: boolean;
  imageCount: number;
}

export function useMoodBoardPalette(sceneId: string | null | undefined): UseMoodBoardPaletteResult {
  const [palette, setPalette] = useState<ColorBin[]>([]);
  const [loading, setLoading] = useState(false);
  const lastSignatureRef = useRef<string>('');

  const images = useMemo(() => {
    if (!sceneId) return [];
    return listMoodBoardImages(sceneId);
  }, [sceneId]);

  // Signaturen brukes til å unngå re-ekstrahering når lista er uendret.
  // Vi bruker id + sizeBytes — id'en alene er ikke nok om bildet er
  // erstattet (vi har riktig nok ikke replace-API, men sizeBytes er
  // billig forsikring).
  const signature = useMemo(
    () => images.map((image) => `${image.id}:${image.sizeBytes}`).join('|'),
    [images],
  );

  useEffect(() => {
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    if (images.length === 0) {
      setPalette([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    extractCombinedPalette(images).then((next) => {
      if (cancelled) return;
      setPalette(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [signature, images]);

  return { palette, loading, imageCount: images.length };
}
