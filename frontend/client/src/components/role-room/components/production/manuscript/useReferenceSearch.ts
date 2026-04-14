import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { SceneBreakdown } from '../../../models/casting';
import {
  INITIAL_SEARCH_STATE,
  searchReducer,
  type ReferenceImageResult,
  type SearchSource,
  type ShotCafeFilm,
} from '../types';
import { useObjectUrlUploads } from './useObjectUrlUploads';

const MAX_UPLOADED_REFS = 20;
const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_REFERENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const toShotCafeFilm = (film: Record<string, unknown>): ShotCafeFilm => {
  const project = String(film.project || film.pslug || film.slug || '');
  const slug = String(film.pslug || film.slug || project);
  return {
    id: `shotcafe-${project}`,
    title: String(film.title || ''),
    year: String(film.year || ''),
    slug,
    imageCount: typeof film.icount === 'number' ? film.icount : 0,
    thumbnail: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${slug}`)}`,
    url: `https://shot.cafe/movie/${slug}`,
    cinematographer: typeof film.dp === 'string' ? film.dp : undefined,
  };
};

export const useReferenceSearch = (selectedScene: SceneBreakdown | null) => {
  const [searchUI, dispatchSearch] = useReducer(searchReducer, INITIAL_SEARCH_STATE);
  const searchQueryIdRef = useRef(0);
  const searchSourceRef = useRef(searchUI.source);
  searchSourceRef.current = searchUI.source;

  const searchShotCafe = useCallback(async (query: string): Promise<ShotCafeFilm[]> => {
    try {
      const response = await fetch(`/api/shotcafe/search?z=nav&q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('shot.cafe search failed');
      const data = await response.json();
      return Array.isArray(data) ? data.map((film: Record<string, unknown>) => toShotCafeFilm(film)) : [];
    } catch (error) {
      console.error('shot.cafe search error:', error);
      return [];
    }
  }, []);

  const searchByCinematographer = useCallback(async (name: string): Promise<ShotCafeFilm[]> => {
    try {
      const response = await fetch(`/api/shotcafe/search?z=cinematographers&q=${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error('Cinematographer search failed');
      const data = await response.json();
      return Array.isArray(data) ? data.map((film: Record<string, unknown>) => toShotCafeFilm(film)) : [];
    } catch (error) {
      console.error('Cinematographer search error:', error);
      return [];
    }
  }, []);

  const loadFilmFrames = useCallback(async (slug: string, title: string) => {
    try {
      const response = await fetch(`/api/shotcafe/movie/${slug}`);
      if (response.ok) {
        const data = await response.json();
        const frames = Array.isArray(data.frames)
          ? data.frames.map((frame: Record<string, unknown>) => ({
              id: String(frame.id),
              url: String(frame.proxyUrl || frame.url || ''),
              thumbnailUrl: String(frame.proxyUrl || frame.thumbnailUrl || frame.url || ''),
            }))
          : [];

        dispatchSearch({
          type: 'SELECT_FILM',
          film: {
            title,
            slug,
            frames: frames.length > 0
              ? frames
              : Array.from({ length: 12 }, (_, index) => ({
                  id: `frame-${slug}-${index + 1}`,
                  url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${index + 1}.jpg`)}`,
                  thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${index + 1}.jpg`)}`,
                })),
          },
        });
      } else {
        const frameUrls = Array.from({ length: 12 }, (_, index) => ({
          id: `frame-${slug}-${index + 1}`,
          url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${index + 1}.jpg`)}`,
          thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/${slug}/${index + 1}.jpg`)}`,
        }));
        dispatchSearch({ type: 'SELECT_FILM', film: { title, slug, frames: frameUrls } });
      }
    } catch (error) {
      console.error('Failed to load film frames:', error);
    }
  }, []);

  const searchImages = useCallback(async (query: string): Promise<ReferenceImageResult[]> => {
    try {
      const response = await fetch(`/api/unsplash/search?q=${encodeURIComponent(query)}&per_page=12`);
      if (!response.ok) throw new Error('Image search failed');
      const data = await response.json();
      return Array.isArray(data.results) ? data.results : [];
    } catch (error) {
      console.error('Image search error:', error);
      return Array.from({ length: 6 }, (_, index) => ({
        id: `picsum-${index}`,
        url: `https://picsum.photos/seed/${encodeURIComponent(query)}${index}/400/225`,
        thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(query)}${index}/150/100`,
        source: 'picsum' as const,
        attribution: 'Placeholder Image',
      }));
    }
  }, []);

  const searchReferenceImages = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;

    const queryId = ++searchQueryIdRef.current;
    dispatchSearch({ type: 'SEARCH_START' });

    const source = searchSourceRef.current;
    const filmPromise = (source === 'all' || source === 'shotcafe')
      ? searchShotCafe(q).catch(() => [] as ShotCafeFilm[])
      : Promise.resolve([] as ShotCafeFilm[]);
    const imagePromise = (source === 'all' || source === 'unsplash')
      ? searchImages(q).catch(() => [] as ReferenceImageResult[])
      : Promise.resolve([] as ReferenceImageResult[]);

    const [filmResults, imageResults] = await Promise.all([filmPromise, imagePromise]);
    if (queryId !== searchQueryIdRef.current) return;

    dispatchSearch({ type: 'SEARCH_DONE', imageResults, filmResults });
  }, [searchImages, searchShotCafe]);

  useEffect(() => {
    if (searchUI.open && selectedScene) {
      const initialQuery = `${selectedScene.locationName || 'scene'} ${selectedScene.timeOfDay?.toLowerCase() || 'day'} cinematic`;
      dispatchSearch({ type: 'SET_QUERY', query: initialQuery });
      void searchReferenceImages(initialQuery);
    }
  }, [searchReferenceImages, searchUI.open, selectedScene]);

  const { handleObjectUrlUpload: handleReferenceUpload } = useObjectUrlUploads({
    maxFiles: MAX_UPLOADED_REFS,
    currentCount: searchUI.uploadedRefs.length,
    maxFileSize: MAX_REFERENCE_FILE_SIZE,
    allowedTypes: ALLOWED_REFERENCE_TYPES,
    onObjectUrl: (url) => dispatchSearch({ type: 'ADD_UPLOADED_REF', url }),
  });

  return {
    searchUI,
    dispatchSearch,
    referenceSearchOpen: searchUI.open,
    referenceSearchQuery: searchUI.query,
    referenceSearchResults: searchUI.imageResults,
    referenceSearchLoading: searchUI.loading,
    uploadedReferences: searchUI.uploadedRefs,
    searchSource: searchUI.source as SearchSource,
    shotCafeResults: searchUI.filmResults,
    selectedFilm: searchUI.selectedFilm,
    centerPanelReference: searchUI.centerReference,
    searchShotCafe,
    searchByCinematographer,
    loadFilmFrames,
    searchReferenceImages,
    handleReferenceUpload,
  };
};
