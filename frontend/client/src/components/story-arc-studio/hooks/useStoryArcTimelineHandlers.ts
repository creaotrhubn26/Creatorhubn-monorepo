import { useMemo } from 'react';
import type { BeatClip, Track } from '../../../services/storyArcDataIntegration';
import type {
  AudioTrackRole,
  TimelineMarker,
  TimelineTransition,
  TrackState,
} from '../../ProfessionalTimeline';

interface StoryArcClipMeta {
  camera?: string;
  shotName?: string;
  scene?: string;
  take?: string;
  tags?: string[];
  faceDetection?: {
    hasFace: boolean;
    faceCount: number;
    confidence: number;
    analyzedAt: number;
    bestTimestamp?: number;
    scanMetadata?: {
      totalFramesAnalyzed: number;
      framesWithFaces: number;
      faceDetectionRate: number;
      timestamps: Array<{ timestamp: number; hasFace: boolean }>;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface UseStoryArcTimelineHandlersParams {
  clips: BeatClip[];
  tracks: Track[];
  zoom: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClips: Set<string>;
  handleTimelineClipSelect: (clipId: string, multiSelect?: boolean) => void;
  handleTimelineClipMove: (clipId: string, newStart: number, newTrackId: string) => void;
  handleTimelineClipResize: (
    clipId: string,
    newStart: number,
    newDuration: number,
    resizeMode?: 'resize-left' | 'resize-right'
  ) => void;
  handleTimelineClick: (time: number) => void;
  handleCurrentTimeChange: (time: number) => void;
  handleTimelineZoomChange: (zoom: number) => void;
  trackHeightScale: number;
  markers: TimelineMarker[];
  trackStates: Record<string, TrackState>;
  handleTimelineTrackToggle: (trackId: string, changes: Partial<TrackState>) => void;
  handleTimelineTrackRename: (trackId: string, name: string) => void;
  handleTimelineTrackTypeChange: (trackId: string, type: TrackState['type']) => void;
  setTrackAudioRole: (trackId: string, role: AudioTrackRole) => void;
  transitions: TimelineTransition[];
  clipMeta: Record<string, StoryArcClipMeta>;
  filterTags: string[];
  searchQuery: string;
  handleTimelineContextMenuAction: (action: string, payload: unknown) => void;
  reviewerMode: boolean;
  compareMode: boolean;
  compareSnapshot: BeatClip[];
  collabLocks: Record<string, { user?: string }>;
  handleTimelineMediaDrop: (detail: {
    media: { id?: string; name?: string; url?: string; type?: string; mimeType?: string; file?: File };
    trackId?: string;
    startTime: number;
  }) => void;
  selectedInspectorClips: BeatClip[];
  handleInspectorClipUpdate: (clipId: string, updates: Partial<BeatClip>) => void;
  handleInspectorBulkUpdate: (clipIds: string[], updates: Partial<BeatClip>) => void;
  handleInspectorMetaUpdate: (clipId: string, updates: Partial<StoryArcClipMeta>) => void;
  waveformAudioUrl: string;
  handleWaveformReady: (wavesurfer: unknown) => void;
  handleWaveformRegionCreated: (region: unknown) => void;
}

export function useStoryArcTimelineHandlers({
  clips,
  tracks,
  zoom,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClips,
  handleTimelineClipSelect,
  handleTimelineClipMove,
  handleTimelineClipResize,
  handleTimelineClick,
  handleCurrentTimeChange,
  handleTimelineZoomChange,
  trackHeightScale,
  markers,
  trackStates,
  handleTimelineTrackToggle,
  handleTimelineTrackRename,
  handleTimelineTrackTypeChange,
  setTrackAudioRole,
  transitions,
  clipMeta,
  filterTags,
  searchQuery,
  handleTimelineContextMenuAction,
  reviewerMode,
  compareMode,
  compareSnapshot,
  collabLocks,
  handleTimelineMediaDrop,
  selectedInspectorClips,
  handleInspectorClipUpdate,
  handleInspectorBulkUpdate,
  handleInspectorMetaUpdate,
  waveformAudioUrl,
  handleWaveformReady,
  handleWaveformRegionCreated,
}: UseStoryArcTimelineHandlersParams) {
  const timelineProps = useMemo(
    () => ({
      clips,
      tracks,
      zoom,
      currentTime,
      totalDuration,
      isPlaying,
      selectedClips,
      onClipSelect: handleTimelineClipSelect,
      onClipMove: handleTimelineClipMove,
      onClipResize: handleTimelineClipResize,
      onTimelineClick: handleTimelineClick,
      onCurrentTimeChange: handleCurrentTimeChange,
      onZoomChange: handleTimelineZoomChange,
      trackHeightScale,
      markers,
      trackStates,
      onTrackToggle: handleTimelineTrackToggle,
      onTrackRename: handleTimelineTrackRename,
      onTrackTypeChange: handleTimelineTrackTypeChange,
      onTrackAudioRoleChange: setTrackAudioRole,
      transitions,
      clipMetadata: clipMeta,
      filterTags,
      searchQuery,
      onContextMenuAction: handleTimelineContextMenuAction,
      reviewerMode,
      compareClips: compareMode ? compareSnapshot : [],
      collabLocks,
      onMediaDrop: handleTimelineMediaDrop,
    }),
    [
      clips,
      tracks,
      zoom,
      currentTime,
      totalDuration,
      isPlaying,
      selectedClips,
      handleTimelineClipSelect,
      handleTimelineClipMove,
      handleTimelineClipResize,
      handleTimelineClick,
      handleCurrentTimeChange,
      handleTimelineZoomChange,
      trackHeightScale,
      markers,
      trackStates,
      handleTimelineTrackToggle,
      handleTimelineTrackRename,
      handleTimelineTrackTypeChange,
      setTrackAudioRole,
      transitions,
      clipMeta,
      filterTags,
      searchQuery,
      handleTimelineContextMenuAction,
      reviewerMode,
      compareMode,
      compareSnapshot,
      collabLocks,
      handleTimelineMediaDrop,
    ]
  );

  const inspectorProps = useMemo(
    () => ({
      selectedClips: selectedInspectorClips,
      onClipUpdate: handleInspectorClipUpdate,
      onBulkUpdate: handleInspectorBulkUpdate,
      metaMap: clipMeta,
      onMetaUpdate: handleInspectorMetaUpdate,
      height: '100%',
    }),
    [
      selectedInspectorClips,
      handleInspectorClipUpdate,
      handleInspectorBulkUpdate,
      clipMeta,
      handleInspectorMetaUpdate,
    ]
  );

  const waveformProps = useMemo(
    () => ({
      audioUrl: waveformAudioUrl,
      height: 72,
      waveColor: '#667eea',
      progressColor: '#764ba2',
      enableRegions: true,
      onReady: handleWaveformReady,
      onRegionCreated: handleWaveformRegionCreated,
    }),
    [waveformAudioUrl, handleWaveformReady, handleWaveformRegionCreated]
  );

  return {
    timelineProps,
    inspectorProps,
    waveformProps,
  };
}
