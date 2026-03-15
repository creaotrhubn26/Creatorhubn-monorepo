import { useCallback, useEffect, useState } from 'react';
import { castingService } from '../services/castingService';
import type {
  CastingShot,
  ShotList,
  ShotNote,
  ShotStatus,
  TakeStatus,
} from '../models/casting';
import type { CaptureTakePayload, LiveSetCameraMetadata, LiveSetTake } from './useLiveSet';
import type { ShotOption } from './useLiveSetContext';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const compactText = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

export interface ShotListSyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
  at?: string;
}

export interface TakeCaptureForm {
  shotId: string;
  quality: TakeStatus;
  notes: string;
  continuityFlags: string[];
}

export interface UseShotListSyncOptions {
  projectId: string;
  activeSceneId: string;
  activeShotOptions: ShotOption[];
  sceneShotListMap: Record<string, string>;
  cameraMetadata: LiveSetCameraMetadata;
  activeCam: string;
  activeSetup: string;
  takes: LiveSetTake[];
  captureTake: (payload: CaptureTakePayload) => void;
  resolveQualityLabel?: (quality: string) => string;
}

const DEFAULT_CAPTURE_FORM: TakeCaptureForm = {
  shotId: '',
  quality: 'normal',
  notes: '',
  continuityFlags: [],
};

export function useShotListSync({
  projectId,
  activeSceneId,
  activeShotOptions,
  sceneShotListMap,
  cameraMetadata,
  activeCam,
  activeSetup,
  takes,
  captureTake,
  resolveQualityLabel,
}: UseShotListSyncOptions) {
  const [shotListSync, setShotListSync] = useState<ShotListSyncState>({ status: 'idle' });
  const [takeCapture, setTakeCapture] = useState<TakeCaptureForm>(DEFAULT_CAPTURE_FORM);

  useEffect(() => {
    if (activeShotOptions.length === 0) {
      setTakeCapture((current) => (current.shotId ? { ...current, shotId: '' } : current));
      return;
    }
    setTakeCapture((current) => (
      activeShotOptions.some((shot) => shot.id === current.shotId)
        ? current
        : { ...current, shotId: activeShotOptions[0].id }
    ));
  }, [activeShotOptions]);

  useEffect(() => {
    if (shotListSync.status !== 'success') return;
    const timeoutId = window.setTimeout(() => setShotListSync({ status: 'idle' }), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [shotListSync.status]);

  const handleTakeCaptureChange = useCallback((patch: Partial<TakeCaptureForm>) => {
    setTakeCapture((current) => ({ ...current, ...patch }));
  }, []);

  const handleToggleContinuityFlag = useCallback((flag: string) => {
    setTakeCapture((current) => {
      const exists = current.continuityFlags.includes(flag);
      return {
        ...current,
        continuityFlags: exists
          ? current.continuityFlags.filter((entry) => entry !== flag)
          : [...current.continuityFlags, flag],
      };
    });
  }, []);

  const handleCaptureTake = useCallback(async () => {
    if (!takeCapture.shotId) {
      setShotListSync({ status: 'error', message: 'Velg shot før capture' });
      return;
    }
    const selectedShot = activeShotOptions.find((shot) => shot.id === takeCapture.shotId);
    const nowIso = new Date().toISOString();

    captureTake({
      shotId: takeCapture.shotId,
      shotLabel: selectedShot?.label,
      quality: takeCapture.quality,
      notes: takeCapture.notes,
      continuityFlags: takeCapture.continuityFlags,
      camera: compactText(cameraMetadata.camera, activeCam) || activeCam,
      lens: compactText(cameraMetadata.lens),
      fps: asNumber(cameraMetadata.fps),
    });

    if (!projectId || !activeSceneId) {
      setShotListSync({ status: 'error', message: 'Mangler projectId eller sceneId for sync' });
      return;
    }

    setShotListSync({ status: 'syncing', message: 'Synkroniserer Shot List…', at: nowIso });

    try {
      const shotLists = await castingService.getShotLists(projectId);
      const sceneShotListId = sceneShotListMap[activeSceneId];
      const targetShotList = shotLists.find((list) => compactText(list.id) === sceneShotListId)
        || shotLists.find((list) => compactText(list.sceneId, list.scene_id) === activeSceneId);

      if (!targetShotList) {
        throw new Error('Fant ingen shot list for aktiv scene');
      }
      const shots = Array.isArray(targetShotList.shots) ? [...targetShotList.shots] : [];
      const targetIndex = shots.findIndex((shot) => compactText(shot.id) === takeCapture.shotId);
      if (targetIndex < 0) {
        throw new Error('Fant ikke valgt shot i shot list');
      }

      const existingShot = shots[targetIndex];
      const takeNumber = takes.filter((take) => take.setupLabel === activeSetup).length + 1;
      const qualityLabel = resolveQualityLabel?.(takeCapture.quality) || takeCapture.quality;
      const technicalSummary = `Take ${takeNumber} • ${qualityLabel} • ${compactText(cameraMetadata.camera, activeCam) || activeCam} ${compactText(cameraMetadata.lens) || ''} ${cameraMetadata.fps ? `${cameraMetadata.fps}fps` : ''}`.trim();
      const liveSetTakeLog = {
        id: `liveset-take-${Date.now()}`,
        takeNumber,
        quality: takeCapture.quality,
        camera: compactText(cameraMetadata.camera, activeCam) || activeCam,
        lens: compactText(cameraMetadata.lens),
        fps: asNumber(cameraMetadata.fps),
        notes: compactText(takeCapture.notes),
        continuityFlags: takeCapture.continuityFlags,
        loggedAt: nowIso,
        loggedBy: 'Script Supervisor',
      };
      const existingTakeLogs = Array.isArray((existingShot as { liveSetTakes?: unknown[] }).liveSetTakes)
        ? ((existingShot as { liveSetTakes?: unknown[] }).liveSetTakes as unknown[])
        : [];
      const existingNotesList = Array.isArray((existingShot as { notesList?: unknown[] }).notesList)
        ? ((existingShot as { notesList?: unknown[] }).notesList as ShotNote[])
        : [];
      const combinedFieldNotes = [
        compactText(existingShot.fieldNotes),
        compactText(takeCapture.notes),
      ].filter(Boolean).join('\n');

      const nextStatus: ShotStatus =
        takeCapture.quality === 'selected' || takeCapture.quality === 'circled' || takeCapture.quality === 'print'
          ? 'completed'
          : compactText(existingShot.status) === 'completed'
            ? 'completed'
            : 'in_progress';

      const updatedShot: CastingShot = {
        ...existingShot,
        liveSetTakes: [liveSetTakeLog, ...existingTakeLogs],
        notesList: [
          {
            id: `liveset-note-${Date.now()}`,
            text: technicalSummary,
            tag: 'technical',
            createdBy: 'Live Set',
            createdAt: nowIso,
          },
          ...existingNotesList,
        ],
        fieldNotes: combinedFieldNotes || undefined,
        status: nextStatus,
        updatedAt: nowIso,
      };

      shots[targetIndex] = updatedShot;

      await castingService.updateShotList(projectId, targetShotList.id, {
        shots,
        updatedAt: nowIso,
      });

      setShotListSync({ status: 'success', message: 'Shot List oppdatert', at: nowIso });
      setTakeCapture((current) => ({
        ...current,
        notes: '',
        continuityFlags: [],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukjent feil under shot list-sync';
      setShotListSync({ status: 'error', message, at: nowIso });
    }
  }, [
    takeCapture,
    activeShotOptions,
    captureTake,
    projectId,
    activeSceneId,
    sceneShotListMap,
    cameraMetadata,
    activeCam,
    takes,
    activeSetup,
    resolveQualityLabel,
  ]);

  return {
    shotListSync,
    takeCapture,
    handleTakeCaptureChange,
    handleToggleContinuityFlag,
    handleCaptureTake,
    setShotListSync,
    setTakeCapture,
  };
}
