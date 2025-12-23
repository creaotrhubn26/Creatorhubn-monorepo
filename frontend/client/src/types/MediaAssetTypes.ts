/**
 * Unified Media Asset Type System
 *
 * Provides consistent type definitions across:
 * - PhotographerPhotoSuite
 * - StoryArcStudio
 * - UniversalShowcase
 */

export enum MediaAssetType {
  PHOTO = 'photo',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  RAW_PHOTO = 'raw_photo',
  RAW_VIDEO = 'raw_video',
}

export enum AssetProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  QUEUED = 'queued',
}

export enum AssetSource {
  UPLOAD = 'upload',
  GOOGLE_DRIVE = 'google_drive',
  CAMERA_IMPORT = 'camera_import',
  PHOTO_SUITE_EXPORT = 'photo_suite_export',
  VIDEO_EDITOR_EXPORT = 'video_editor_export',
  CLIENT_UPLOAD = 'client_upload',
}

/**
 * Base Media Asset Interface
 * All asset types extend from this
 */
export interface BaseMediaAsset {
  // Identity
  id: string;
  name: string;
  type: MediaAssetType;
  source: AssetSource;

  // Storage
  url: string;
  thumbnailUrl?: string;
  googleDriveId?: string;
  googleDrivePath?: string;

  // Metadata
  size: number; // bytes
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: string; // userId

  // Project association
  projectId?: string;
  clientId?: string;

  // Processing
  processingStatus: AssetProcessingStatus;
  processingError?: string;

  // Tags and organization
  tags?: string[];
  category?: string;
  collection?: string;

  // Permissions
  isPublic: boolean;
  sharedWith?: string[]; // userIds
  clientVisible: boolean;
}

/**
 * Photo-specific metadata
 */
export interface PhotoMetadata {
  // Dimensions
  width: number;
  height: number;
  aspectRatio: string; // e.g. "16:9""4:3"

  // EXIF data
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number; // f-stop
  shutterSpeed?: string;
  iso?: number;
  capturedAt?: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Processing history
  editHistory?: PhotoEdit[];
  presetsApplied?: string[];
  enhancementsApplied?: PhotoEnhancement[];

  // Color profile
  colorSpace?: string;
  colorProfile?: string;
  bitDepth?: number;
}

export interface PhotoEdit {
  id: string;
  timestamp: Date;
  editorType: 'photographer_photo_suite' | 'external';
  controls: {
    temperature?: number;
    tint?: number;
    exposure?: number;
    contrast?: number;
    highlights?: number;
    shadows?: number;
    whites?: number;
    blacks?: number;
    clarity?: number;
    vibrance?: number;
    saturation?: number;
    sharpness?: number;
    grain?: number;
    vignette?: number;
    whiteBalance?: string;
    [key: string]: unknown;
  };
  previewUrl?: string;
}

export interface PhotoEnhancement {
  type: 'face_restoration' | 'upscaling' | 'noise_reduction' | 'color_correction';
  quality: number;
  appliedAt: Date;
  settings: Record<string, unknown>;
}

/**
 * Photo Asset
 */
export interface PhotoAsset extends BaseMediaAsset {
  type: MediaAssetType.PHOTO | MediaAssetType.RAW_PHOTO;
  metadata: PhotoMetadata;

  // Photo-specific
  originalUrl?: string; // Before any edits
  processedUrl?: string; // After edits
  versions?: PhotoVersion[];
}

export interface PhotoVersion {
  id: string;
  versionNumber: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: Date;
  editsSummary: string;
  isPublished: boolean;
}

/**
 * Video-specific metadata
 */
export interface VideoMetadata {
  // Dimensions
  width: number;
  height: number;
  aspectRatio: string;

  // Duration
  duration: number; // seconds
  frameRate: number; // fps
  bitrate?: number; // kbps

  // Codec info
  videoCodec?: string;
  audioCodec?: string;
  container?: string;

  // Timeline data (for StoryArcStudio)
  timelineData?: TimelineData;
  beatSync?: BeatSyncData;

  // Color grading
  colorGradingApplied?: boolean;
  lutApplied?: string;

  // Captions/subtitles
  hasSubtitles?: boolean;
  subtitleTracks?: SubtitleTrack[];
}

export interface TimelineData {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  transitions?: Transition[];
  effects?: Effect[];
  markers?: Marker[];
}

export interface TimelineClip {
  id: string;
  assetId?: string; // Reference to photo/video asset
  startTime: number;
  endTime: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  speed?: number; // 1.0 = normal
  volume?: number; // 0-1,

  trackId: string;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  order: number;
  muted?: boolean;
  locked?: boolean;
}

export interface Transition {
  id: string;
  type: string; // 'fade','dissolve','wipe', etc.
  fromClipId: string;
  toClipId: string;
  duration: number;
  settings: Record<string, unknown>;
}

export interface Effect {
  id: string;
  type: string;
  clipId: string;
  startTime: number;
  duration?: number;
  settings: Record<string, unknown>;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color?: string;
}

export interface BeatSyncData {
  bpm: number;
  beats: number[];
  analysisData: Record<string, unknown>;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  entries: SubtitleEntry[];
}

export interface SubtitleEntry {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Video Asset
 */
export interface VideoAsset extends BaseMediaAsset {
  type: MediaAssetType.VIDEO | MediaAssetType.RAW_VIDEO;
  metadata: VideoMetadata;

  // Video-specific
  originalUrl?: string;
  processedUrl?: string;
  posterUrl?: string; // Thumbnail/poster image
  previewUrl?: string; // Low-res preview for scrubbing

  // Source clips (if created from photos)
  sourcePhotoIds?: string[];
}

/**
 * Audio-specific metadata
 */
export interface AudioMetadata {
  duration: number; // seconds
  bitrate?: number; // kbps
  sampleRate?: number; // Hz
  channels?: number; // 1=mono, 2=stereo
  codec?: string;

  // Music metadata
  artist?: string;
  album?: string;
  genre?: string;
  bpm?: number;

  // Waveform data
  waveformUrl?: string;
}

/**
 * Audio Asset
 */
export interface AudioAsset extends BaseMediaAsset {
  type: MediaAssetType.AUDIO;
  metadata: AudioMetadata;
}

/**
 * Document Asset (contracts, PDFs, etc.)
 */
export interface DocumentAsset extends BaseMediaAsset {
  type: MediaAssetType.DOCUMENT;
  metadata: {
    pageCount?: number;
    author?: string;
    title?: string;
  };
}

/**
 * Union type for all asset types
 */
export type MediaAsset = PhotoAsset | VideoAsset | AudioAsset | DocumentAsset;

/**
 * Type guards
 */
export function isPhotoAsset(asset: MediaAsset): asset is PhotoAsset {
  return asset.type === MediaAssetType.PHOTO || asset.type === MediaAssetType.RAW_PHOTO;
}

export function isVideoAsset(asset: MediaAsset): asset is VideoAsset {
  return asset.type === MediaAssetType.VIDEO || asset.type === MediaAssetType.RAW_VIDEO;
}

export function isAudioAsset(asset: MediaAsset): asset is AudioAsset {
  return asset.type === MediaAssetType.AUDIO;
}

export function isDocumentAsset(asset: MediaAsset): asset is DocumentAsset {
  return asset.type === MediaAssetType.DOCUMENT;
}

/**
 * Asset Collection (for batch operations)
 */
export interface AssetCollection {
  id: string;
  name: string;
  description?: string;
  assetIds: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // userId
  projectId?: string;
  tags?: string[];
}

/**
 * Asset filters for querying
 */
export interface AssetFilters {
  types?: MediaAssetType[];
  projectId?: string;
  clientId?: string;
  uploadedBy?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  processingStatus?: AssetProcessingStatus[];
  source?: AssetSource[];
  search?: string;
}

/**
 * Asset sort options
 */
export enum AssetSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  SIZE = 'size',
  TYPE = 'type',
}

export enum AssetSortOrder {
  ASC = 'asc',
  DESC ='desc',
}

export interface AssetSortOptions {
  field: AssetSortField;
  order: AssetSortOrder;
}
