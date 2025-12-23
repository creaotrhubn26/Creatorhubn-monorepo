/**
 * Custom hook for Google Services integration
 * Manages Google Drive, Docs, Sheets, Photos, YouTube, and other Google services
 */

import { useState, useEffect, useCallback } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parents?: string[];
  shared: boolean;
  owners: Array<{
    displayName: string;
    emailAddress: string;
}>;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: 'application/vnd.google-apps.folder';
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  children?: GoogleFile[];
}

export interface GoogleDoc {
  id: string;
  title: string;
  content: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  collaborators: Array<{
    displayName: string;
    emailAddress: string;
    role: string;
}>;
}

export interface GoogleSheet {
  id: string;
  title: string;
  sheets: Array<{
    title: string;
    gridProperties: {
      rowCount: number;
      columnCount: number;
  };
}>;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
}

export interface GooglePhoto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  createdTime: string;
  baseUrl: string;
  productUrl: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
    photo: {
      cameraMake?: string;
      cameraModel?: string;
      focalLength?: number;
      apertureFNumber?: number;
      isoEquivalent?: number;
  };
};
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  channelTitle: string;
  channelId: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
}

export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  version: string;
  lastModified: string;
  files: Record<string, string>;
  category: string;
}

export interface GoogleServiceStatus {
  drive: boolean;
  docs: boolean;
  sheets: boolean;
  photos: boolean;
  youtube: boolean;
  fonts: boolean;
  analytics: boolean;
  translate: boolean;
  maps: boolean;
}

export const useGoogleServices = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<GoogleServiceStatus>({
    drive: false,
    docs: false,
    sheets: false,
    photos: false,
    youtube: false,
    fonts: false,
    analytics: false,
    translate: false,
    maps: false
});

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<GoogleFile[]>([]);
  const [driveFolders, setDriveFolders] = useState<GoogleDriveFolder[]>([]);
  const [currentDriveFolder, setCurrentDriveFolder] = useState<string | null>(null);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  // Google Docs state
  const [googleDocs, setGoogleDocs] = useState<GoogleDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Google Sheets state
  const [googleSheets, setGoogleSheets] = useState<GoogleSheet[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Google Photos state
  const [googlePhotos, setGooglePhotos] = useState<GooglePhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // YouTube state
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);

  // Google Fonts state
  const [googleFonts, setGoogleFonts] = useState<GoogleFont[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  const { auth } = useEnhancedMasterIntegration();
  const getUserEmail = useCallback(() => auth.state.user?.email || '', [auth.state.user]);

  // Initialize Google Services
  const initializeServices = useCallback(async () => {
    try {
      setIsLoadingDrive(true);
      setError(null);

      const response = await apiRequest('/api/google/services/initialize', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

      if (response.ok) {
        const services = await response.json();
        setServiceStatus(services);
        setIsInitialized(true);
        return true;
    } else {
        throw new Error('Failed to initialize Google services');
    }
  } catch (error) {
      console.error('Google services initialization failed: ', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return false;
  } finally {
      setIsLoadingDrive(false);
  }
}, []);

  // Google Drive operations
  const loadDriveFiles = useCallback(async (folderId?: string) => {
    try {
      setIsLoadingDrive(true);
      setError(null);

      const response = await apiRequest(`/api/google/drive/files${folderId ? `?folderId=${folderId}` : ', '}`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const data = await response.json();
        setDriveFiles(data.files || []);
        setDriveFolders(data.folders || []);
        setCurrentDriveFolder(folderId || null);
        return data;
    } else {
        throw new Error('Failed to load Drive files');
    }
  } catch (error) {
      console.error('Failed to load Drive files:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingDrive(false);
  }
}, []);

  const uploadToDrive = useCallback(async (file: File, folderId?: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (folderId) formData.append('folderId', folderId);

      const response = await apiRequest('/api/google/drive/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const uploadedFile = await response.json();
        setDriveFiles(prev => [...prev, uploadedFile]);
        return uploadedFile;
    } else {
        throw new Error('Failed to upload file to Drive');
    }
  } catch (error) {
      console.error('Failed to upload to Drive:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  }
}, []);

  const createDriveFolder = useCallback(async (name: string, parentId?: string) => {
    try {
      const response = await apiRequest('/api/google/drive/folders', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json','X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      },
        body: JSON.stringify({ name, parentId })
    });

      if (response.ok) {
        const folder = await response.json();
        setDriveFolders(prev => [...prev, folder]);
        return folder;
    } else {
        throw new Error('Failed to create Drive folder');
    }
  } catch (error) {
      console.error('Failed to create Drive folder:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  }
}, []);

  // Google Docs operations
  const loadGoogleDocs = useCallback(async () => {
    try {
      setIsLoadingDocs(true);
      setError(null);

      const response = await apiRequest('/api/google/docs', {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const docs = await response.json();
        setGoogleDocs(docs);
        return docs;
    } else {
        throw new Error('Failed to load Google Docs');
    }
  } catch (error) {
      console.error('Failed to load Google Docs:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingDocs(false);
  }
}, []);

  const createGoogleDoc = useCallback(async (title: string, content: string = ', ') => {
    try {
      const response = await apiRequest('/api/google/docs', {
        method: 'POST',
        headers: {
          'Content-Type':'application/json','X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      },
        body: JSON.stringify({ title, content })
    });

      if (response.ok) {
        const doc = await response.json();
        setGoogleDocs(prev => [...prev, doc]);
        return doc;
    } else {
        throw new Error('Failed to create Google Doc');
    }
  } catch (error) {
      console.error('Failed to create Google Doc:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  }
}, []);

  // Google Sheets operations
  const loadGoogleSheets = useCallback(async () => {
    try {
      setIsLoadingSheets(true);
      setError(null);

      const response = await apiRequest('/api/google/sheets', {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const sheets = await response.json();
        setGoogleSheets(sheets);
        return sheets;
    } else {
        throw new Error('Failed to load Google Sheets');
    }
  } catch (error) {
      console.error('Failed to load Google Sheets:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingSheets(false);
  }
}, []);

  // Google Photos operations
  const loadGooglePhotos = useCallback(async (pageToken?: string) => {
    try {
      setIsLoadingPhotos(true);
      setError(null);

      const response = await apiRequest(`/api/google/photos${pageToken ? `?pageToken=${pageToken}` : ', '}`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const data = await response.json();
        setGooglePhotos(prev => pageToken ? [...prev, ...data.photos] : data.photos);
        return data;
    } else {
        throw new Error('Failed to load Google Photos');
    }
  } catch (error) {
      console.error('Failed to load Google Photos:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingPhotos(false);
  }
}, []);

  // YouTube operations
  const loadYouTubeVideos = useCallback(async (channelId?: string) => {
    try {
      setIsLoadingYouTube(true);
      setError(null);

      const response = await apiRequest(`/api/google/youtube/videos${channelId ? `?channelId=${channelId}` : ', '}`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const data = await response.json();
        setYoutubeVideos(data.videos || []);
        return data;
    } else {
        throw new Error('Failed to load YouTube videos');
    }
  } catch (error) {
      console.error('Failed to load YouTube videos:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingYouTube(false);
  }
}, []);

  // Google Fonts operations
  const loadGoogleFonts = useCallback(async () => {
    try {
      setIsLoadingFonts(true);
      setError(null);

      const response = await apiRequest('/api/google/fonts', {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const fonts = await response.json();
        setGoogleFonts(fonts);
        return fonts;
    } else {
        throw new Error('Failed to load Google Fonts');
    }
  } catch (error) {
      console.error('Failed to load Google Fonts:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  } finally {
      setIsLoadingFonts(false);
  }
}, []);

  // Search across services
  const searchAcrossServices = useCallback(async (query: string) => {
    try {
      const response = await apiRequest(`/api/google/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'X-Google-Impersonation' : 'true', 'X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        return await response.json();
    } else {
        throw new Error('Search failed');
    }
  } catch (error) {
      console.error('Search failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      return null;
  }
}, []);

  // Check service access
  const checkServiceAccess = useCallback(async (service: keyof GoogleServiceStatus) => {
    try {
      const response = await apiRequest(`/api/google/services/${service}/access`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': getUserEmail()
      }
    });

      if (response.ok) {
        const data = await response.json();
        setServiceStatus(prev => ({ ...prev, [service]: data.hasAccess }));
        return data.hasAccess;
    } else {
        return false;
    }
  } catch (error) {
      console.error(`Failed to check ${service} access:`, error);
      return false;
  }
}, []);

  // Get service statistics
  const getServiceStats = useCallback(() => {
    return {
      driveFiles: driveFiles.length,
      driveFolders: driveFolders.length,
      googleDocs: googleDocs.length,
      googleSheets: googleSheets.length,
      googlePhotos: googlePhotos.length,
      youtubeVideos: youtubeVideos.length,
      googleFonts: googleFonts.length,
      isInitialized,
      serviceStatus
  };
}, [
    driveFiles.length,
    driveFolders.length,
    googleDocs.length,
    googleSheets.length,
    googlePhotos.length,
    youtubeVideos.length,
    googleFonts.length,
    isInitialized,
    serviceStatus
  ]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
}, []);

  return {
    // State
    isInitialized,
    serviceStatus,
    driveFiles,
    driveFolders,
    currentDriveFolder,
    googleDocs,
    googleSheets,
    googlePhotos,
    youtubeVideos,
    googleFonts,
    error,
    isLoadingDrive,
    isLoadingDocs,
    isLoadingSheets,
    isLoadingPhotos,
    isLoadingYouTube,
    isLoadingFonts,

    // Setters
    setCurrentDriveFolder,

    // Service operations
    initializeServices,
    checkServiceAccess,

    // Drive operations
    loadDriveFiles,
    uploadToDrive,
    createDriveFolder,

    // Docs operations
    loadGoogleDocs,
    createGoogleDoc,

    // Sheets operations
    loadGoogleSheets,

    // Photos operations
    loadGooglePhotos,

    // YouTube operations
    loadYouTubeVideos,

    // Fonts operations
    loadGoogleFonts,

    // Search operations
    searchAcrossServices,

    // Utility operations
    getServiceStats,
    clearError
};
};


