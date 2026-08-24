// @ts-nocheck
/**
 * useProjectImages — delt opplasting/visning av prosjekt-bilder mot B2.
 *
 * Brukes av alle bilde-flater (moodboard / referanser / media). Henter
 * eksisterende bilder (GET /api/projects/:id/images?panel=) og gir en onUpload
 * som POSTer fila (multipart) → backend skyver til B2 (Role Room-bøtta) →
 * returnerer presigned URL. Samme flyt for ALLE paneler, kun `panel` varierer.
 */
import { useEffect, useState, useCallback } from 'react';
import { apiRequest, getAuthHeader, buildApiUrl } from '@/lib/queryClient';

export type { WsImageItem } from './ui';
import type { WsImageItem } from './ui';

export function useProjectImages(projectId: string, panel: string) {
  const [images, setImages] = useState<WsImageItem[]>([]);
  const isReal = projectId && projectId !== 'sample';

  const reload = useCallback(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images?panel=${encodeURIComponent(panel)}`)
      .then((r: any) => { setImages(Array.isArray(r?.images) ? r.images : []); })
      .catch(() => {});
  }, [projectId, panel, isReal]);

  useEffect(() => { reload(); }, [reload]);

  // onUpload: multipart-POST (apiRequest serialiserer JSON, så vi bruker rå fetch
  // med FormData + credentials). category valgfri (moodboard-tagging).
  const onUpload = useCallback(async (file: File, category?: string): Promise<WsImageItem | void> => {
    if (!isReal) return; // demo: WsImageGrid beholder lokal forhåndsvisning
    const fd = new FormData();
    fd.append('file', file);
    fd.append('panel', panel);
    fd.append('label', file.name);
    if (category) fd.append('category', category);
    // Auth-token MÅ med (appen autentiserer via Bearer, ikke cookie) og URL-en må
    // gå gjennom buildApiUrl (ellers treffer relativ URL Vercel-fronten, ikke API-et).
    // Content-Type fjernes så browseren setter multipart-boundary selv.
    const headers = await getAuthHeader();
    delete (headers as any)['Content-Type'];
    const res = await fetch(buildApiUrl(`/api/projects/${encodeURIComponent(projectId)}/images`), {
      method: 'POST', headers, body: fd, credentials: 'include',
    });
    if (!res.ok) throw new Error('Opplasting til B2 feilet');
    const saved = await res.json();
    setImages((p) => [{ id: saved.id, url: saved.url, label: saved.label, category: saved.category }, ...p]);
    return { id: saved.id, url: saved.url, label: saved.label, category: saved.category };
  }, [projectId, panel, isReal]);

  const setCategory = useCallback(async (id: string, category: string | null) => {
    if (!isReal) return;
    setImages((p) => p.map((im) => im.id === id ? { ...im, category } : im));
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${id}`, { method: 'PATCH', body: { category } }); } catch { reload(); }
  }, [projectId, isReal, reload]);

  return { images, onUpload, setCategory, reload, isReal };
}
