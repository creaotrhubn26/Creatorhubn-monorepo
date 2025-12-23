/**
 * GoogleDriveExportService - Upload exported videos to Google Drive
 * 
 * Features:
 * - Direct upload to Google Drive
 * - Folder selection/creation
 * - Progress tracking
 * - Automatic organization
 */

import { ExportResult } from './VideoExportService';

// ============================================================================
// Types
// ============================================================================

export interface GoogleDriveUploadConfig {
  userId: string;
  projectId?: string;
  projectName?: string;
  folderId?: string;
  folderName?: string;
  createFolder?: boolean;
}

export interface GoogleDriveUploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  status: 'preparing, ' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface GoogleDriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  webContentLink?: string;
  folderId?: string;
  folderLink?: string;
  error?: string;
}

export type UploadProgressCallback = (progress: GoogleDriveUploadProgress) => void;

// ============================================================================
// Export Presets
// ============================================================================

export interface ExportPreset {
  id: string;
  name: string;
  icon: string;
  platform: string;
  description: string;
  config: {
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    format: 'webm' | 'mp4';
    aspectRatio: string;
  };
  tips: string[];
}

export const EXPORT_PRESETS: ExportPreset[] = [
  // YouTube
  {
    id: 'youtube_4k',
    name: 'YouTube 4K',
    icon: '📺',
    platform: 'YouTube',
    description: 'Best quality for YouTube',
    config: {
      width: 3840,
      height: 2160,
      fps: 60,
      bitrate: 45_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Best for detailed content','Large file size ~675 MB/min','Recommended for 4K monitors',
    ],
  },
  {
    id: 'youtube_1080p',
    name: 'YouTube 1080p HD',
    icon: '📺',
    platform: 'YouTube',
    description: 'Standard HD for YouTube',
    config: {
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 10_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Most common format','Good balance of quality/size','~75 MB/min',
    ],
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    icon: '📱',
    platform: 'YouTube',
    description: 'Vertical video for Shorts',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 8_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 60 seconds','Vertical format required','Fast-paced content works best',
    ],
  },

  // Instagram
  {
    id: 'instagram_feed',
    name: 'Instagram Feed',
    icon: '📸',
    platform: 'Instagram',
    description: 'Square video for feed',
    config: {
      width: 1080,
      height: 1080,
      fps: 30,
      bitrate: 5_000_000,
      format: 'mp4',
      aspectRatio: '1:1',
    },
    tips: [
      'Max 60 seconds','Square format for feed','Keep text within safe area',
    ],
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    icon: '🎬',
    platform: 'Instagram',
    description: 'Vertical video for Reels',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 8_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 90 seconds','Vertical format','First 3 seconds are crucial',
    ],
  },
  {
    id: 'instagram_story',
    name: 'Instagram Story',
    icon: '📖',
    platform: 'Instagram',
    description: 'Vertical story format',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 6_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 15 seconds per segment','Leave space for UI elements','Use engaging hooks',
    ],
  },

  // TikTok
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    platform: 'TikTok',
    description: 'Optimized for TikTok',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 10_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 10 minutes','Hook viewers in first second','Trending sounds boost reach',
    ],
  },

  // Twitter/X
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: '🐦',
    platform: 'Twitter',
    description: 'Optimized for Twitter',
    config: {
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 5_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Max 2:20 minutes','Keep file under 512 MB','Captions recommended',
    ],
  },

  // LinkedIn
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    platform: 'LinkedIn',
    description: 'Professional video format',
    config: {
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 8_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Max 10 minutes','Professional tone','Captions increase engagement',
    ],
  },

  // Facebook
  {
    id: 'facebook_feed',
    name: 'Facebook Feed',
    icon: '👍',
    platform: 'Facebook',
    description: 'Standard Facebook video',
    config: {
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 6_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Max 240 minutes','Square also works well','Auto-play is muted',
    ],
  },
  {
    id: 'facebook_reels',
    name: 'Facebook Reels',
    icon: '🎭',
    platform: 'Facebook',
    description: 'Vertical Reels format',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 8_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 90 seconds','Cross-post from Instagram','Vertical format only',
    ],
  },

  // Vimeo
  {
    id: 'vimeo_4k',
    name: 'Vimeo 4K',
    icon: '🎥',
    platform: 'Vimeo',
    description: 'High quality for Vimeo',
    config: {
      width: 3840,
      height: 2160,
      fps: 30,
      bitrate: 35_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      'Premium quality platform','No ads on videos','Great for portfolios',
    ],
  },

  // Pinterest
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    platform: 'Pinterest',
    description: 'Vertical pin format',
    config: {
      width: 1000,
      height: 1500,
      fps: 25,
      bitrate: 4_000_000,
      format: 'mp4',
      aspectRatio: '2:3',
    },
    tips: [
      'Max 15 minutes','2:3 aspect ratio','Lifestyle content works best',
    ],
  },

  // Snapchat
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: '👻',
    platform: 'Snapchat',
    description: 'Vertical Snap format',
    config: {
      width: 1080,
      height: 1920,
      fps: 30,
      bitrate: 5_000_000,
      format: 'mp4',
      aspectRatio: '9:16',
    },
    tips: [
      'Max 60 seconds for Spotlight','Vertical only','Fast-paced content',
    ],
  },

  // Professional
  {
    id: 'broadcast_1080p',
    name: 'Broadcast 1080p',
    icon: '📡',
    platform: 'Broadcast',
    description: 'Professional broadcast quality',
    config: {
      width: 1920,
      height: 1080,
      fps: 25,
      bitrate: 15_000_000,
      format: 'mp4',
      aspectRatio: '16:9',
    },
    tips: [
      '25fps for PAL regions','High bitrate for quality','Suitable for TV',
    ],
  },
  {
    id: 'cinema_dcp',
    name: 'Cinema 2K',
    icon: '🎬',
    platform: 'Cinema',
    description: 'Digital cinema projection',
    config: {
      width: 2048,
      height: 1080,
      fps: 24,
      bitrate: 25_000_000,
      format: 'mp4',
      aspectRatio: '1.9:1',
    },
    tips: [
      '24fps for cinema','Flat aspect ratio','High dynamic range',
    ],
  },
];

// ============================================================================
// Google Drive Export Service
// ============================================================================

export class GoogleDriveExportService {
  private baseUrl = '/api/google-drive';

  // -------------------------------------------------------------------------
  // Check Drive Status
  // -------------------------------------------------------------------------

  async checkDriveStatus(userId: string): Promise<{
    connected: boolean;
    oauthAvailable: boolean;
  }> {
    try {
      const response = await fetch('/test/api/google-drive/hybrid/test');
      const data = await response.json();
      return {
        connected: data.success,
        oauthAvailable: data.oauthAvailable,
      };
    } catch {
      return { connected: false, oauthAvailable: false };
    }
  }

  // -------------------------------------------------------------------------
  // Get Project Folders
  // -------------------------------------------------------------------------

  async getProjectFolders(userId: string): Promise<Array<{
    id: string;
    name: string;
    webViewLink: string;
  }>> {
    try {
      const response = await fetch(`${this.baseUrl}/project-folders/${userId}`);
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Upload Video to Drive
  // -------------------------------------------------------------------------

  async uploadVideo(
    exportResult: ExportResult,
    config: GoogleDriveUploadConfig,
    onProgress?: UploadProgressCallback
  ): Promise<GoogleDriveUploadResult> {
    if (!exportResult.success || !exportResult.blob) {
      return { success: false, error: 'No video to upload' };
    }

    try {
      onProgress?.({
        bytesUploaded: 0,
        totalBytes: exportResult.blob.size,
        percentage: 0,
        status: 'preparing',
      });

      // Create folder if needed
      let targetFolderId = config.folderId;

      if (config.createFolder && config.projectName) {
        const folderResult = await this.createExportFolder(config);
        if (!folderResult.success) {
          return { success: false, error: folderResult.error };
        }
        targetFolderId = folderResult.folderId;
      }

      onProgress?.({
        bytesUploaded: 0,
        totalBytes: exportResult.blob.size,
        percentage: 5,
        status: 'uploading',
      });

      // Prepare form data
      const formData = new FormData();
      formData.append('file', exportResult.blob, exportResult.filename || 'animation.webm');
      formData.append('userId', config.userId);
      if (targetFolderId) {
        formData.append('folderId', targetFolderId);
      }
      if (config.projectId) {
        formData.append('projectId', config.projectId);
      }

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<GoogleDriveUploadResult>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentage = 5 + (e.loaded / e.total) * 90; // 5-95%
            onProgress?.({
              bytesUploaded: e.loaded,
              totalBytes: e.total,
              percentage,
              status: 'uploading',
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            onProgress?.({
              bytesUploaded: exportResult.blob!.size,
              totalBytes: exportResult.blob!.size,
              percentage: 100,
              status: 'complete',
            });
            resolve({
              success: true,
              fileId: result.fileId,
              webViewLink: result.webViewLink,
              webContentLink: result.webContentLink,
              folderId: targetFolderId,
            });
          } else {
            onProgress?.({
              bytesUploaded: 0,
              totalBytes: exportResult.blob!.size,
              percentage: 0,
              status: 'error',
              error: `Upload, failed: ${xhr.status}`,
            });
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          onProgress?.({
            bytesUploaded: 0,
            totalBytes: exportResult.blob!.size,
            percentage: 0,
            status: 'error',
            error: 'Network error',
          });
          reject(new Error('Network error'));
        };

        xhr.open('POST', `${this.baseUrl}/upload-video`);
        xhr.send(formData);
      });

      return uploadPromise;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({
        bytesUploaded: 0,
        totalBytes: exportResult.blob.size,
        percentage: 0,
        status: 'error',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  // -------------------------------------------------------------------------
  // Create Export Folder
  // -------------------------------------------------------------------------

  async createExportFolder(config: GoogleDriveUploadConfig): Promise<{
    success: boolean;
    folderId?: string;
    folderLink?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/create-export-folder`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          userId: config.userId,
          projectId: config.projectId,
          folderName: config.folderName || `${config.projectName} - Exports`,
          parentFolderId: config.folderId,
        }),
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to create folder' };
      }

      const data = await response.json();
      return {
        success: true,
        folderId: data.folderId,
        folderLink: data.webViewLink,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message :'Unknown error',
      };
    }
  }

  // -------------------------------------------------------------------------
  // Get Preset by Platform
  // -------------------------------------------------------------------------

  getPresetsByPlatform(platform: string): ExportPreset[] {
    return EXPORT_PRESETS.filter(
      (p) => p.platform.toLowerCase() === platform.toLowerCase()
    );
  }

  getPresetById(id: string): ExportPreset | undefined {
    return EXPORT_PRESETS.find((p) => p.id === id);
  }

  getAllPlatforms(): string[] {
    return [...new Set(EXPORT_PRESETS.map((p) => p.platform))];
  }
}

// Export singleton
export const googleDriveExportService = new GoogleDriveExportService();

export default googleDriveExportService;

