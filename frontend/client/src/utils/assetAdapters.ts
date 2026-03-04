/**
 * Asset Adapter Utilities
 *
 * Converts between different asset representations:
 * - PhotoFile (PhotographerPhotoSuite)
 * - BeatClip (StoryArcStudio)
 * - MediaAsset (Universal type)
 * - Showcase items
 */

import type {
  MediaAsset,
  PhotoAsset,
  VideoAsset,
  VideoMetadata} from '../types/MediaAssetTypes';
import {
  MediaAssetType,
  AssetSource,
  AssetProcessingStatus,
  PhotoMetadata
} from '../types/MediaAssetTypes';

/**
 * PhotoFile interface from PhotographerPhotoSuite
 */
export interface PhotoFile {
  id?: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  lastModified?: number;
}

/**
 * Beat Clip interface from StoryArcStudio
 */
export interface BeatClip {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  duration: number;
  startTime: number;
  endTime: number;
  trackId?: string;
  type: 'video' | 'audio' | 'image';
  metadata?: Record<string, unknown>;
}

/**
 * Convert PhotoFile to PhotoAsset
 */
export function photoFileToPhotoAsset(
  photoFile: PhotoFile,
  userId: string,
  projectId?: string,
): PhotoAsset {
  const now = new Date();

  return {
    id: photoFile.id || `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: photoFile.name,
    type: MediaAssetType.PHOTO,
    source: AssetSource.PHOTO_SUITE_EXPORT,
    url: photoFile.url,
    thumbnailUrl: photoFile.url, // Same as full image initially
    size: photoFile.size || 0,
    mimeType: photoFile.type || 'image/jpeg',
    createdAt: photoFile.lastModified ? new Date(photoFile.lastModified) : now,
    updatedAt: now,
    uploadedBy: userId,
    projectId,
    processingStatus: AssetProcessingStatus.COMPLETED,
    isPublic: false,
    clientVisible: false,
    metadata: {
      width: 0, // Will be populated when image loads
      height: 0,
      aspectRatio: '16:9',
    },
  };
}

/**
 * Convert PhotoAsset to PhotoFile
 */
export function photoAssetToPhotoFile(photoAsset: PhotoAsset): PhotoFile {
  return {
    id: photoAsset.id,
    name: photoAsset.name,
    url: photoAsset.processedUrl || photoAsset.url,
    size: photoAsset.size,
    type: photoAsset.mimeType,
    lastModified: photoAsset.updatedAt.getTime(),
  };
}

/**
 * Convert PhotoAsset to BeatClip (for video editing)
 */
export function photoAssetToBeatClip(
  photoAsset: PhotoAsset,
  duration: number = 5, // Default 5 seconds
  startTime: number = 0,
): BeatClip {
  return {
    id: photoAsset.id,
    name: photoAsset.name,
    url: photoAsset.processedUrl || photoAsset.url,
    thumbnail: photoAsset.thumbnailUrl,
    duration,
    startTime,
    endTime: startTime + duration,
    type: 'image',
    metadata: {
      originalAssetId: photoAsset.id,
      assetType: 'photo',
      photoMetadata: photoAsset.metadata,
    },
  };
}

/**
 * Convert multiple PhotoAssets to BeatClips for timeline
 */
export function photoAssetsToTimelineClips(
  photoAssets: PhotoAsset[],
  defaultDuration: number = 5,
  transitionDuration: number = 0.5,
): BeatClip[] {
  let currentTime = 0;

  return photoAssets.map((photo) => {
    const clip = photoAssetToBeatClip(photo, defaultDuration, currentTime);
    currentTime += defaultDuration - transitionDuration; // Overlap for transitions
    return clip;
  });
}

/**
 * Convert BeatClip to MediaAsset
 */
export function beatClipToMediaAsset(
  beatClip: BeatClip,
  userId: string,
  projectId?: string,
): MediaAsset {
  const now = new Date();

  if (beatClip.type === 'image') {
    return {
      id: beatClip.id,
      name: beatClip.name,
      type: MediaAssetType.PHOTO,
      source: AssetSource.UPLOAD,
      url: beatClip.url,
      thumbnailUrl: beatClip.thumbnail,
      size: 0,
      mimeType: 'image/jpeg',
      createdAt: now,
      updatedAt: now,
      uploadedBy: userId,
      projectId,
      processingStatus: AssetProcessingStatus.COMPLETED,
      isPublic: false,
      clientVisible: false,
      metadata: {
        width: 0,
        height: 0,
        aspectRatio: '16:9',
      },
    } as PhotoAsset;
  }

  // Video or audio
  return {
    id: beatClip.id,
    name: beatClip.name,
    type: beatClip.type === 'audio' ? MediaAssetType.AUDIO : MediaAssetType.VIDEO,
    source: AssetSource.VIDEO_EDITOR_EXPORT,
    url: beatClip.url,
    thumbnailUrl: beatClip.thumbnail,
    posterUrl: beatClip.thumbnail,
    size: 0,
    mimeType: beatClip.type === 'audio' ? 'audio/mpeg' : 'video/mp4',
    createdAt: now,
    updatedAt: now,
    uploadedBy: userId,
    projectId,
    processingStatus: AssetProcessingStatus.COMPLETED,
    isPublic: false,
    clientVisible: false,
    metadata: {
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      duration: beatClip.duration,
      frameRate: 30,
    },
  } as VideoAsset;
}

/**
 * Convert showcase item to MediaAsset
 */
export interface ShowcaseItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio';
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export function showcaseItemToMediaAsset(
  item: ShowcaseItem,
  userId: string,
  projectId?: string,
): MediaAsset {
  const now = new Date();
  const baseAsset = {
    id: item.id,
    name: item.title || 'Untitled',
    url: item.url,
    thumbnailUrl: item.thumbnailUrl || item.url,
    size: 0,
    createdAt: now,
    updatedAt: now,
    uploadedBy: userId,
    projectId,
    processingStatus: AssetProcessingStatus.COMPLETED,
    isPublic: true,
    clientVisible: true,
  };

  if (item.type === 'image') {
    return {
      ...baseAsset,
      type: MediaAssetType.PHOTO,
      source: AssetSource.UPLOAD,
      mimeType: 'image/jpeg',
      metadata: {
        width: 0,
        height: 0,
        aspectRatio: '16:9',
      },
    } as PhotoAsset;
  }

  if (item.type === 'video') {
    return {
      ...baseAsset,
      type: MediaAssetType.VIDEO,
      source: AssetSource.UPLOAD,
      mimeType: 'video/mp4',
      posterUrl: item.thumbnailUrl,
      metadata: {
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        duration: 0,
        frameRate: 30,
      },
    } as VideoAsset;
  }

  // Audio
  return {
    ...baseAsset,
    type: MediaAssetType.AUDIO,
    source: AssetSource.UPLOAD,
    mimeType: 'audio/mpeg',
    metadata: {
      duration: 0,
    },
  } as MediaAsset;
}

/**
 * Convert MediaAsset to ShowcaseItem
 */
export function mediaAssetToShowcaseItem(asset: MediaAsset): ShowcaseItem {
  let type: 'image' | 'video' | 'audio' = 'image';

  if (asset.type === MediaAssetType.VIDEO || asset.type === MediaAssetType.RAW_VIDEO) {
    type = 'video';
  } else if (asset.type === MediaAssetType.AUDIO) {
    type = 'audio';
  }

  return {
    id: asset.id,
    url: asset.url,
    type,
    title: asset.name,
    thumbnailUrl: asset.thumbnailUrl,
    metadata: {
      projectId: asset.projectId,
      source: asset.source,
      tags: asset.tags,
    },
  };
}

/**
 * Batch convert PhotoFiles to PhotoAssets
 */
export function photoFilesToPhotoAssets(
  photoFiles: PhotoFile[],
  userId: string,
  projectId?: string,
): PhotoAsset[] {
  return photoFiles.map((file) => photoFileToPhotoAsset(file, userId, projectId));
}

/**
 * Batch convert PhotoAssets to PhotoFiles
 */
export function photoAssetsToPhotoFiles(photoAssets: PhotoAsset[]): PhotoFile[] {
  return photoAssets.map(photoAssetToPhotoFile);
}

/**
 * Extract image dimensions from file/url
 */
export async function extractImageDimensions(
  url: string,
): Promise<{ width: number; height: number; aspectRatio: string }> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(width, height);
      const aspectRatio = `${width / divisor}:${height / divisor}`;

      resolve({ width, height, aspectRatio });
    };

    img.onerror = () => {
      // Default fallback
      resolve({ width: 1920, height: 1080, aspectRatio: '16:9' });
    };

    img.src = url;
  });
}

/**
 * Enrich PhotoAsset with actual image dimensions
 */
export async function enrichPhotoAsset(photoAsset: PhotoAsset): Promise<PhotoAsset> {
  try {
    const dimensions = await extractImageDimensions(photoAsset.url);

    return {
      ...photoAsset,
      metadata: {
        ...photoAsset.metadata,
        ...dimensions,
      },
    };
  } catch (error) {
    console.error('Failed to extract image dimensions: ', error);
    return photoAsset;
  }
}

/**
 * Create video metadata from photo sequence
 */
export function createVideoMetadataFromPhotos(
  photos: PhotoAsset[],
  fps: number = 30,
  duration: number = 5,
): VideoMetadata {
  const totalDuration = photos.length * duration;

  return {
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    duration: totalDuration,
    frameRate: fps,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
    timelineData: {
      clips: photos.map((photo, index) => ({
        id: `clip_${index}`,
        assetId: photo.id,
        startTime: index * duration,
        endTime: (index + 1) * duration,
        duration,
        trackId: 'track_0',
      })),
      tracks: [
        {
          id: 'track_0',
          type: 'video',
          name:'Main Video Track',
          order: 0,
        },
      ],
    },
  };
}

/**
 * Validate asset compatibility for video editing
 */
export function isAssetVideoCompatible(asset: MediaAsset): boolean {
  return (
    asset.type === MediaAssetType.PHOTO ||
    asset.type === MediaAssetType.RAW_PHOTO ||
    asset.type === MediaAssetType.VIDEO ||
    asset.type === MediaAssetType.RAW_VIDEO
  );
}

/**
 * Group assets by type
 */
export function groupAssetsByType(assets: MediaAsset[]): {
  photos: PhotoAsset[];
  videos: VideoAsset[];
  audio: MediaAsset[];
  other: MediaAsset[];
} {
  return assets.reduce(
    (acc, asset) => {
      if (asset.type === MediaAssetType.PHOTO || asset.type === MediaAssetType.RAW_PHOTO) {
        acc.photos.push(asset as PhotoAsset);
      } else if (asset.type === MediaAssetType.VIDEO || asset.type === MediaAssetType.RAW_VIDEO) {
        acc.videos.push(asset as VideoAsset);
      } else if (asset.type === MediaAssetType.AUDIO) {
        acc.audio.push(asset);
      } else {
        acc.other.push(asset);
      }
      return acc;
    },
    { photos: [], videos: [], audio: [], other: [] } as {
      photos: PhotoAsset[];
      videos: VideoAsset[];
      audio: MediaAsset[];
      other: MediaAsset[];
    },
  );
}
