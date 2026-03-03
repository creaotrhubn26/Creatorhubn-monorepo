import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  faceDetectionWorker,
  type FaceDetectionProgress,
  type FaceDetectionResult,
} from '../../../services/face-detection-worker';
import { videoEngine } from '../../../services/video-playback-engine';
import type { BeatClip, Track } from '../../../services/storyArcDataIntegration';
import type { TimelineMarker } from '../../ProfessionalTimeline';
import type { StoryArcLongJobKind } from './useStoryArcLongJobManager';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface UseStoryArcFaceDetectionFlowParams {
  faceDetectionRunning: boolean;
  clips: BeatClip[];
  tracks: Track[];
  totalDuration: number;
  hydrateClipSources: (clips: BeatClip[]) => BeatClip[];
  extractRenderableVideoSources: (clips: BeatClip[]) => string[];
  groupFaceDetectionsIntoSegments: (
    timestamps: number[],
    clipDuration: number,
    gapThreshold?: number,
    minSegmentDuration?: number
  ) => Array<{ start: number; duration: number }>;
  setFaceDetectionRunning: Dispatch<SetStateAction<boolean>>;
  setShowFaceDetectionDialog: Dispatch<SetStateAction<boolean>>;
  setFaceDetectionProgress: Dispatch<SetStateAction<FaceDetectionProgress | null>>;
  setFaceDetectionOptions: Dispatch<
    SetStateAction<{ scanEntire: boolean; fps: number; taskChoice: string }>
  >;
  setShowFaceDetectionOptionsDialog: Dispatch<SetStateAction<boolean>>;
  setPendingFaceDetectionResolve: Dispatch<
    SetStateAction<
      ((
        options: { scanEntire: boolean; fps: number; taskChoice: string } | null
      ) => void) | null
    >
  >;
  setClipMeta: Dispatch<SetStateAction<Record<string, any>>>;
  setClips: Dispatch<SetStateAction<BeatClip[]>>;
  setMarkers: Dispatch<SetStateAction<TimelineMarker[]>>;
  setPendingSubclipsResolve: Dispatch<
    SetStateAction<((createSubclips: boolean) => void) | null>
  >;
  setSubclipsConfirmData: Dispatch<
    SetStateAction<{ facesFound: number; totalClips: number } | null>
  >;
  setShowSubclipsConfirmDialog: Dispatch<SetStateAction<boolean>>;
  setAvailableVideoSources: Dispatch<SetStateAction<string[]>>;
  setTotalDuration: Dispatch<SetStateAction<number>>;
  setSnackbar: Dispatch<SetStateAction<SnackbarState>>;
  runManagedJob: <T>(options: {
    kind: StoryArcLongJobKind;
    task: (context: { signal: AbortSignal; attempt: number }) => Promise<T>;
    maxRetries?: number;
    retryDelayMs?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    onCancel?: () => void;
  }) => Promise<T>;
  cancelManagedJob: (kind: StoryArcLongJobKind) => void;
}

export function useStoryArcFaceDetectionFlow({
  faceDetectionRunning,
  clips,
  tracks,
  totalDuration,
  hydrateClipSources,
  extractRenderableVideoSources,
  groupFaceDetectionsIntoSegments,
  setFaceDetectionRunning,
  setShowFaceDetectionDialog,
  setFaceDetectionProgress,
  setFaceDetectionOptions,
  setShowFaceDetectionOptionsDialog,
  setPendingFaceDetectionResolve,
  setClipMeta,
  setClips,
  setMarkers,
  setPendingSubclipsResolve,
  setSubclipsConfirmData,
  setShowSubclipsConfirmDialog,
  setAvailableVideoSources,
  setTotalDuration,
  setSnackbar,
  runManagedJob,
  cancelManagedJob,
}: UseStoryArcFaceDetectionFlowParams) {
  const handleFaceDetectionToggle = useCallback(async () => {
    if (faceDetectionRunning) {
      cancelManagedJob('face');
      setFaceDetectionRunning(false);
      return;
    }

    setFaceDetectionRunning(true);
    setShowFaceDetectionDialog(true);
    setFaceDetectionProgress({
      total: clips.length,
      processed: 0,
      current: null,
      results: [],
      errors: [],
    });

    try {
      await runManagedJob({
        kind: 'face',
        maxRetries: 1,
        retryDelayMs: 1000,
        onCancel: () => {
          faceDetectionWorker.cancel();
        },
        task: async () => {
          const userOptions = await new Promise<{
            scanEntire: boolean;
            fps: number;
            taskChoice: string;
          } | null>((resolve) => {
            setPendingFaceDetectionResolve(() => resolve);
            setFaceDetectionOptions({ scanEntire: false, fps: 0.5, taskChoice: '1' });
            setShowFaceDetectionOptionsDialog(true);
          });

          if (!userOptions) {
            setShowFaceDetectionDialog(false);
            return;
          }

          const { scanEntire, fps, taskChoice } = userOptions;
          let tasks:
            | 'all'
            | 'parsing'
            | 'landmarks'
            | 'headpose'
            | 'attributes'
            | Array<'parsing' | 'landmarks' | 'headpose' | 'attributes'> = 'all';

          if (taskChoice) {
            const choice = taskChoice.trim().toLowerCase();
            if (choice === '1' || choice === 'all') {
              tasks = 'all';
            } else if (choice === '2' || choice === 'parsing') {
              tasks = 'parsing';
            } else if (choice === '3' || choice === 'landmarks') {
              tasks = 'landmarks';
            } else if (choice === '4' || choice === 'headpose') {
              tasks = 'headpose';
            } else if (choice === '5' || choice === 'attributes') {
              tasks = 'attributes';
            } else if (choice === '6' || choice.includes(',')) {
              const taskList = choice
                .split(',')
                .map(
                  (task) => task.trim() as 'parsing' | 'landmarks' | 'headpose' | 'attributes'
                )
                .filter(Boolean);
              if (taskList.length > 0) {
                tasks = taskList;
              }
            }
          }

          const results: FaceDetectionResult[] = await faceDetectionWorker.processClips(
            clips.map((clip) => ({
              id: clip.id,
              sourceFile: clip.sourceFile || '',
              duration: clip.duration || 5,
            })),
            {
              batchSize: scanEntire ? 1 : 3,
              scanEntireVideo: scanEntire,
              framesPerSecond: fps,
              tasks,
              onProgress: (progress) => {
                setFaceDetectionProgress(progress);
                progress.results.forEach((result) => {
                  setClipMeta((previous) => ({
                    ...previous,
                    [result.clipId]: {
                      ...previous[result.clipId],
                      faceDetection: {
                        hasFace: result.hasFace,
                        faceCount: result.faceCount,
                        confidence: result.confidence,
                        analyzedAt: Date.now(),
                        comprehensiveAnalysis: result.comprehensiveAnalysis,
                        bestTimestamp: result.timestamp,
                        scanMetadata: result.scanMetadata,
                      },
                      tags: [
                        ...(previous[result.clipId]?.tags || []),
                        ...(result.hasFace && !previous[result.clipId]?.tags?.includes('face')
                          ? ['face']
                          : []),
                        ...(result.comprehensiveAnalysis?.landmarks
                          ? previous[result.clipId]?.tags?.includes('landmarks')
                            ? []
                            : ['landmarks']
                          : []),
                        ...(result.comprehensiveAnalysis?.headpose
                          ? previous[result.clipId]?.tags?.includes('headpose')
                            ? []
                            : ['headpose']
                          : []),
                        ...(result.comprehensiveAnalysis?.parsing
                          ? previous[result.clipId]?.tags?.includes('parsing')
                            ? []
                            : ['parsing']
                          : []),
                        ...(result.comprehensiveAnalysis?.attributes
                          ? previous[result.clipId]?.tags?.includes('attributes')
                            ? []
                            : ['attributes']
                          : []),
                      ],
                    },
                  }));
                });
              },
            }
          );

          results.forEach((result) => {
            setClipMeta((previous) => ({
              ...previous,
              [result.clipId]: {
                ...previous[result.clipId],
                faceDetection: {
                  hasFace: result.hasFace,
                  faceCount: result.faceCount,
                  confidence: result.confidence,
                  analyzedAt: Date.now(),
                  comprehensiveAnalysis: result.comprehensiveAnalysis,
                  bestTimestamp: result.timestamp,
                  scanMetadata: result.scanMetadata,
                },
                tags: [
                  ...(previous[result.clipId]?.tags || []),
                  ...(result.hasFace && !previous[result.clipId]?.tags?.includes('face')
                    ? ['face']
                    : []),
                  ...(result.comprehensiveAnalysis?.landmarks
                    ? previous[result.clipId]?.tags?.includes('landmarks')
                      ? []
                      : ['landmarks']
                    : []),
                  ...(result.comprehensiveAnalysis?.headpose
                    ? previous[result.clipId]?.tags?.includes('headpose')
                      ? []
                      : ['headpose']
                    : []),
                  ...(result.comprehensiveAnalysis?.parsing
                    ? previous[result.clipId]?.tags?.includes('parsing')
                      ? []
                      : ['parsing']
                    : []),
                  ...(result.comprehensiveAnalysis?.attributes
                    ? previous[result.clipId]?.tags?.includes('attributes')
                      ? []
                      : ['attributes']
                    : []),
                ],
              },
            }));

            if (result.hasFace) {
              setClips((previous) =>
                previous.map((clip) =>
                  clip.id === result.clipId ? { ...clip, color: '#10b981' } : clip
                )
              );
            }
          });

          const faceMarkers: TimelineMarker[] = [];
          results.forEach((result) => {
            const clip = clips.find((candidate) => candidate.id === result.clipId);
            if (!clip) {
              return;
            }

            if (result.hasFace && result.scanMetadata) {
              const faceTimestamps = result.scanMetadata.timestamps
                .filter((timestamp) => timestamp.hasFace)
                .map((timestamp) => timestamp.timestamp);
              const sampledTimestamps =
                faceTimestamps.length > 20
                  ? faceTimestamps.filter(
                      (_, index) =>
                        index % Math.ceil(faceTimestamps.length / 20) === 0
                    )
                  : faceTimestamps;

              sampledTimestamps.forEach((timestamp, index) => {
                const absoluteTime = clip.start + timestamp;
                faceMarkers.push({
                  id: `face_${result.clipId}_${index}_${Date.now()}`,
                  time: absoluteTime,
                  color: '#10b981',
                  label: `Face @ ${timestamp.toFixed(1)}s`,
                });
              });
              return;
            }

            if (result.hasFace && result.timestamp !== undefined) {
              const absoluteTime = clip.start + result.timestamp;
              faceMarkers.push({
                id: `face_${result.clipId}_${Date.now()}`,
                time: absoluteTime,
                color: '#10b981',
                label: `Face @ ${result.timestamp.toFixed(1)}s`,
              });
            }
          });

          if (faceMarkers.length > 0) {
            setMarkers((previous) => [...previous, ...faceMarkers]);
          }

          const facesFound = results.filter((result) => result.hasFace).length;
          const createSubclips = await new Promise<boolean>((resolve) => {
            setPendingSubclipsResolve(() => resolve);
            setSubclipsConfirmData({ facesFound, totalClips: results.length });
            setShowSubclipsConfirmDialog(true);
          });

          if (!createSubclips) {
            setSnackbar({
              open: true,
              message: `Face detection complete! Found faces in ${
                results.filter((result) => result.hasFace).length
              } of ${results.length} clips. ${faceMarkers.length} markers added to timeline.`,
              severity: 'success',
            });
            return;
          }

          let newClips: BeatClip[] = [...clips];
          const clipsToProcess = results.filter(
            (result) => result.hasFace && result.scanMetadata
          );
          for (const result of clipsToProcess) {
            const originalClip = clips.find((clip) => clip.id === result.clipId);
            if (!originalClip || !result.scanMetadata) {
              continue;
            }

            const segments = groupFaceDetectionsIntoSegments(
              result.scanMetadata.timestamps
                .filter((timestamp) => timestamp.hasFace)
                .map((timestamp) => timestamp.timestamp),
              originalClip.duration
            );
            if (segments.length === 0) {
              continue;
            }

            newClips = newClips.filter((clip) => clip.id !== result.clipId);
            segments.forEach((segment, index) => {
              const subClip: BeatClip = {
                ...originalClip,
                id: `${result.clipId}_face_segment_${index}_${Date.now()}`,
                start: originalClip.start + segment.start,
                duration: segment.duration,
                name: `${originalClip.name || 'Clip'} - Face Segment ${index + 1}`,
                synopsis: `Auto-extracted face segment (${segment.start.toFixed(
                  1
                )}s - ${(segment.start + segment.duration).toFixed(1)}s)`,
                color: '#10b981',
                sourceFile: originalClip.sourceFile,
                metadata: {
                  ...originalClip.metadata,
                  sourceStartTime:
                    (typeof originalClip.metadata?.sourceStartTime === 'number'
                      ? originalClip.metadata.sourceStartTime
                      : 0) + segment.start,
                },
              };
              newClips.push(subClip);
            });
          }

          const hydratedDetectedClips = hydrateClipSources(newClips);
          setClips(hydratedDetectedClips);
          setAvailableVideoSources((previous) => {
            const merged = new Set([
              ...previous,
              ...extractRenderableVideoSources(hydratedDetectedClips),
            ]);
            return Array.from(merged);
          });
          const newTotalDuration = Math.max(
            ...hydratedDetectedClips.map((clip) => clip.start + clip.duration),
            totalDuration
          );
          setTotalDuration(newTotalDuration);

          videoEngine.setTimeline(hydratedDetectedClips, tracks, newTotalDuration);

          setSnackbar({
            open: true,
            message: `Created ${clipsToProcess.reduce((sum, result) => {
              const segments = groupFaceDetectionsIntoSegments(
                result.scanMetadata!.timestamps
                  .filter((timestamp) => timestamp.hasFace)
                  .map((timestamp) => timestamp.timestamp),
                clips.find((clip) => clip.id === result.clipId)?.duration || 0
              );
              return sum + segments.length;
            }, 0)} sub-clips from face-detected segments`,
            severity: 'success',
          });
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        setSnackbar({
          open: true,
          message: 'Face detection cancelled',
          severity: 'info',
        });
      } else {
        setSnackbar({
          open: true,
          message: `Face detection, error: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          severity: 'error',
        });
      }
    } finally {
      setFaceDetectionRunning(false);
    }
  }, [
    faceDetectionRunning,
    clips,
    tracks,
    totalDuration,
    hydrateClipSources,
    extractRenderableVideoSources,
    groupFaceDetectionsIntoSegments,
    setFaceDetectionRunning,
    setShowFaceDetectionDialog,
    setFaceDetectionProgress,
    setFaceDetectionOptions,
    setShowFaceDetectionOptionsDialog,
    setPendingFaceDetectionResolve,
    setClipMeta,
    setClips,
    setMarkers,
    setPendingSubclipsResolve,
    setSubclipsConfirmData,
    setShowSubclipsConfirmDialog,
    setAvailableVideoSources,
    setTotalDuration,
    setSnackbar,
    runManagedJob,
    cancelManagedJob,
  ]);

  return {
    handleFaceDetectionToggle,
  };
}
