/**
 * useGalleryEventStream — Slice 9X.85
 *
 * Lytter på backend sin ticket-autentiserte per-bruker-WS og
 * surfacer galleri-relaterte broadcast-events til admin-UI:
 *   - "video.comment-added"          — ny klient-kommentar på timecode
 *   - "gallery.selection-submitted"  — klient submittet favoritt-utvalg
 *
 * Hook returnerer ingen state — den invaliderer React Query-cache og
 * kaller `onEvent`-callback med en formatert payload som caller-en kan
 * vise som toast. Holder seg stille (returnerer null) hvis bruker ikke
 * er innlogget eller env mangler WS-URL.
 *
 * Bruk:
 *   useGalleryEventStream({
 *     onEvent: (e) => enqueueSnackbar(e.message),
 *   });
 */
import { useQueryClient } from '@tanstack/react-query';
import { useUserEventStream } from './useUserEventStream';

interface GalleryEventMessage {
  kind: 'video.comment-added' | 'gallery.selection-submitted';
  message: string;
  galleryId: string;
  raw: Record<string, unknown>;
}

interface Options {
  enabled?: boolean;
  onEvent?: (event: GalleryEventMessage) => void;
}

export function useGalleryEventStream({ enabled = true, onEvent }: Options = {}): void {
  const queryClient = useQueryClient();
  useUserEventStream({
    enabled,
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
    },
    onEvent: (payload) => {
      if (payload.kind === 'video.comment-added') {
        const galleryId = String(payload.galleryId || '');
        const label = (payload.clientLabel as string | null) || 'En klient';
        const cat = payload.category ? ` (${payload.category})` : '';
        queryClient.invalidateQueries({
          queryKey: ['/api/photographer/galleries', galleryId, 'video-comments'],
        });
        queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
        onEvent?.({
          kind: 'video.comment-added',
          message: `${label} la til en kommentar${cat}`,
          galleryId,
          raw: payload,
        });
      }
      if (payload.kind === 'gallery.selection-submitted') {
        const galleryId = String(payload.galleryId || '');
        const label = (payload.clientName as string | null) || (payload.clientEmail as string | null) || 'En klient';
        const count = Number(payload.selectedCount ?? 0);
        queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
        onEvent?.({
          kind: 'gallery.selection-submitted',
          message: `${label} submittet utvalg (${count} bilder)`,
          galleryId,
          raw: payload,
        });
      }
    },
  });
}

export default useGalleryEventStream;
