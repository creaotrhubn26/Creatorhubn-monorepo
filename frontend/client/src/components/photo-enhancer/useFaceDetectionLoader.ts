import { useCallback, useEffect, useRef } from 'react';
import { createFaceDetectionQueue } from '../../lib/enhancer-session/face-detector';
import type { DetectedFace, SessionImage } from '../../lib/enhancer-session/types';
import { apiRequest } from '../../lib/queryClient';

export interface FaceDetectionLoader {
  requestForImage: (image: SessionImage) => void;
}

export interface FaceDetectionLoaderHandlers {
  setStatus: (imageId: string, status: SessionImage['faceStatus']) => void;
  setFaces: (imageId: string, faces: DetectedFace[]) => void;
}

/**
 * Hook that owns the face-detection queue and dispatches results back to
 * the session. Re-runs are idempotent per image id — requesting an image
 * that already has faces resolved is a no-op.
 *
 * The hook does NOT auto-fire on its own; the caller decides when to
 * request detection (typically: when an image becomes active, or on a
 * "Detect faces" button click).
 */
export function useFaceDetectionLoader(handlers: FaceDetectionLoaderHandlers): FaceDetectionLoader {
  const queueRef = useRef(createFaceDetectionQueue<DetectedFace[]>(3));
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const requestedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const queue = queueRef.current;
    return () => {
      queue.cancelPending();
    };
  }, []);

  const requestForImage = useCallback((image: SessionImage) => {
    if (!image) return;
    if (requestedIdsRef.current.has(image.id)) return;
    if (image.faceStatus === 'ready' || image.faceStatus === 'pending' || image.faceStatus === 'none' || image.faceStatus === 'unavailable') {
      requestedIdsRef.current.add(image.id);
      return;
    }
    requestedIdsRef.current.add(image.id);
    handlersRef.current.setStatus(image.id, 'pending');

    void queueRef.current
      .enqueue({
        key: image.id,
        run: async () => {
          const formData = new FormData();
          formData.append('image', image.file);
          const raw = await apiRequest('/api/photo-enhancer/faces', {
            method: 'POST',
            body: formData,
          });
          const response = raw as {
            success?: boolean;
            available?: boolean;
            faces?: Array<{
              index?: number;
              score?: number | null;
              box?: { x: number; y: number; width: number; height: number } | null;
            }>;
          };
          if (!response?.success || response.available === false) {
            throw new Error('face_detection_unavailable');
          }
          const faces: DetectedFace[] = (response.faces ?? [])
            .filter((face): face is { index: number; score: number | null; box: DetectedFace['box'] } =>
              Boolean(face && face.box && typeof face.index === 'number'),
            )
            .map((face) => ({
              index: face.index,
              score: face.score ?? null,
              box: face.box,
            }));
          return faces;
        },
      })
      .then((faces) => {
        handlersRef.current.setFaces(image.id, faces);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'face_detection_cancelled') return;
        if (message === 'face_detection_unavailable') {
          handlersRef.current.setStatus(image.id, 'unavailable');
        } else {
          // Fall back to "none" so the UI shows "Ingen ansikter" rather
          // than a stuck spinner if the backend errored.
          handlersRef.current.setStatus(image.id, 'none');
        }
      });
  }, []);

  return { requestForImage };
}
