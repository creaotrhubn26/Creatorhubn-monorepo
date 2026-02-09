import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
	import { useAuth } from '@/hooks/useAuth';
	import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
	import { useTheming } from '../../utils/theming-helper';
	import { usePushNotifications } from '../../hooks/usePushNotifications';
	import { PushNotificationSettings } from '../shared/PushNotificationSettings';
	import { useProject } from '../../contexts/ProjectContext';
import { z } from 'zod';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
  Avatar,
  CircularProgress,
  Slider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Snackbar,
  Tooltip,
} from '@mui/material';
import {
  Face,
  BurstMode,
  HighQuality,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Assessment,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Twitter,
  LinkedIn,
  MusicNote,
  PushPin
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

// Helper to get basename from path (for Lightroom file paths)
const path = {
  basename: (filePath: string) => {
    return filePath.split('/, ').pop() || filePath.split('\\,').pop() || filePath;
  }
};

interface PhotoEnhancementSuiteProps {
	  userId: string;
  projectId?: string;
  // Integration props for universal connectivity
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

// Zod schemas for type safety and validation
const QualityMetricsSchema = z.object({
  psnr: z.number(),
  ssim: z.number(),
  lpips: z.number(),
  originalResolution: z.string(),
  enhancedResolution: z.string(),
});

const EnhancementJobSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalSize: z.number(),
  originalUrl: z.string(),
	  enhancedUrl: z.string().optional(),
	  enhancementType: z.enum(['upscale,', 'face_restore','denoise','colorize','batch']),
	  status: z.enum(['pending','processing','completed','error']),
  progress: z.number().min(0).max(10),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  processingTime: z.number().optional(),
  qualityMetrics: QualityMetricsSchema.optional(),
  errorMessage: z.string().optional(),
});

type EnhancementJob = z.infer<typeof EnhancementJobSchema>;

type QualityPreset = 'best' | 'balanced' | 'file_size' | 'custom';
type SocialMediaPreset = 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok' | 'pinterest' | 'none';

interface BatchProcessingOptions {
  enhancementType: 'upscale' | 'face_restore' | 'denoise' | 'colorize' | 'blind_restore';
  upscaleFactor: number;
  denoiseStrength: number;
  colorizeStrength: number;
  outputFormat: 'jpg' | 'png' | 'webp' | 'tiff' | 'tif';
  outputQuality: number;
  preserveOriginal: boolean;
  // GFPGAN-specific options
  gfpganVersion: string;
  gfpganWeight: number;
  preserveFaceShape: boolean;
  advancedSkinTexture: boolean;
  autoFaceDetection: boolean;
  // Real-ESRGAN-specific options
  modelName?: string;
  faceEnhance?: boolean;
  // Resolution and file size preservation
  preserveResolution: boolean;
  preserveFileSize: boolean;
  // Quality preset
  qualityPreset: QualityPreset;
  // Social media export
  socialMediaPreset: SocialMediaPreset;
  exportResolution?: string; // e.g., "1080x1080"
  // Google Drive integration
  googleDriveUpload?: boolean;
  googleDriveFolderId?: string;
  googleDriveDeliveryFolder?: string; // Delivery folder path
  // Lightroom preset integration
  presetId?: string;
  // TIFF conversion workflow
  convertRawToTiff?: boolean;
  exportToTiff?: boolean;
  // Delivery format (always JPEG for delivery)
  deliveryFormat: 'jpg';
  deliveryQuality: number; // Full resolution JPEG quality
}

const QualityComparisonSchema = z.object({
  originalMetrics: z.object({
    resolution: z.string(),
    fileSize: z.number(),
    sharpness: z.number(),
    noise: z.number(),
    colorBalance: z.number(),
}),
  enhancedMetrics: z.object({
    resolution: z.string(),
    fileSize: z.number(),
    sharpness: z.number(),
    noise: z.number(),
    colorBalance: z.number(),
    improvementScore: z.number(),
}),
});


interface SystemTelemetry {
  gpuUsage: number;
  memoryUsage: string;
  processingSpeed: string;
  totalJobsCompleted: number;
  avgProcessingTime: string;
  qualityImprovement: string
}

const PhotoEnhancementSuite: React.FC<PhotoEnhancementSuiteProps> = ({
	  userId,
  projectId,
  onFileUpload,
  onFileDownload,
  selectedProject,
  profession = 'photographer',
}) => {
  // Get current project from ProjectContext as fallback
  const { currentProject } = useProject();
  
  // Use selectedProject prop if provided, otherwise fall back to currentProject from context
  const effectiveProject = selectedProject || currentProject;
  
	  const [selectedTab, setSelectedTab] = useState(0);
	  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { user } = useAuth();
  const currentUserId = userId || user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(currentUserId);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [batchOptions, setBatchOptions] = useState<BatchProcessingOptions>({
    enhancementType: 'upscale',
    upscaleFactor:  4,
    denoiseStrength: 0.5,
    colorizeStrength: 0.7,
    outputFormat: 'png',
    outputQuality:  95,
    modelName: 'RealESRGAN_x4plus',
    faceEnhance: false,
    preserveOriginal: true,
    // GFPGAN-specific options (based on GFPGAN_SUCCESS.md)
    gfpganVersion: '1.3',
    gfpganWeight: 0.5,
    preserveFaceShape: true,
    advancedSkinTexture: false,
    autoFaceDetection: true,
    // Resolution and file size preservation (GFPGAN preserves original resolution by default)
    preserveResolution: true,
    preserveFileSize: false,
    // Quality preset
    qualityPreset: 'balanced',
    // Social media export
    socialMediaPreset: 'none',
    // Google Drive integration
    googleDriveUpload: false,
    googleDriveFolderId: undefined,
    googleDriveDeliveryFolder: undefined,
    // Lightroom preset integration
    presetId: undefined,
    // TIFF conversion workflow
    convertRawToTiff: false,
    exportToTiff: false,
    // Delivery format (always JPEG for delivery)
    deliveryFormat: 'jpg',
    deliveryQuality: 95
});

  // Quality presets for GFPGAN
  const gfpganPresets = {
    best: {
      label: 'Best Quality',
      description: 'Maximum restoration quality, larger file size',
      gfpganWeight: 0.7,
      outputQuality: 100,
      outputFormat: 'png' as const,
      preserveFileSize: false,
      advancedSkinTexture: true
    },
    balanced: {
      label: 'Balanced',
      description: 'Great quality with reasonable file size',
      gfpganWeight: 0.5,
      outputQuality: 95,
      outputFormat: 'jpg' as const,
      preserveFileSize: false,
      advancedSkinTexture: false
    },
    file_size: {
      label: 'File Size Optimized',
      description: 'Good quality, smaller file size',
      gfpganWeight: 0.4,
      outputQuality: 85,
      outputFormat: 'jpg' as const,
      preserveFileSize: true,
      advancedSkinTexture: false
    }
  };

  // Social media export presets
  const socialMediaPresets = {
    instagram: {
      label: 'Instagram',
      icon: <Instagram sx={{ fontSize: 20, color: '#E4405F' }} />,
      description: '1080x1080 (square), 1080x1350 (portrait), 1080x566 (landscape)',
      outputFormat: 'jpg' as const,
      outputQuality: 92,
      resolutions: ['1080x1080','1080x1350','1080x566']
    },
    facebook: {
      label: 'Facebook',
      icon: <Facebook sx={{ fontSize: 20, color: '#1877F2' }} />,
      description: '1200x630 (landscape), 1200x1200 (square)',
      outputFormat: 'jpg' as const,
      outputQuality: 90,
      resolutions: ['1200x630','1200x1200']
    },
    twitter: {
      label: 'Twitter/X',
      icon: <Twitter sx={{ fontSize: 20, color: '#1DA1F2' }} />,
      description: '1200x675 (landscape), 1200x1200 (square)',
      outputFormat: 'jpg' as const,
      outputQuality: 90,
      resolutions: ['1200x675','1200x1200']
    },
    linkedin: {
      label: 'LinkedIn',
      icon: <LinkedIn sx={{ fontSize: 20, color: '#0A66C2' }} />,
      description: '1200x627 (landscape)',
      outputFormat: 'jpg' as const,
      outputQuality: 92,
      resolutions: ['1200x627']
    },
    tiktok: {
      label: 'TikTok',
      icon: <MusicNote sx={{ fontSize: 20, color: '#000000' }} />,
      description: '1080x1920 (portrait), 1080x1080 (square)',
      outputFormat: 'jpg' as const,
      outputQuality: 90,
      resolutions: ['1080x1920','1080x1080']
    },
    pinterest: {
      label: 'Pinterest',
      icon: <PushPin sx={{ fontSize: 20, color: '#BD081C' }} />,
      description: '1000x1500 (portrait), 1000x1000 (square)',
      outputFormat: 'jpg' as const,
      outputQuality: 90,
      resolutions: ['1000x1500','1000x1000']
    }
  };

  const applyGfpganPreset = useCallback((preset: QualityPreset) => {
    if (preset === 'custom') {
      setBatchOptions(prev => ({ ...prev, qualityPreset: 'custom' }));
      return;
    }
    
    const presetConfig = gfpganPresets[preset];
    setBatchOptions(prev => ({
      ...prev,
      qualityPreset: preset,
      gfpganWeight: presetConfig.gfpganWeight,
      outputQuality: presetConfig.outputQuality,
      outputFormat: presetConfig.outputFormat,
      preserveFileSize: presetConfig.preserveFileSize,
      advancedSkinTexture: presetConfig.advancedSkinTexture
    }));
  }, []);

  const applySocialMediaPreset = useCallback((preset: SocialMediaPreset, resolution?: string) => {
    if (preset === 'none') {
      setBatchOptions(prev => ({ ...prev, socialMediaPreset: 'none', exportResolution: undefined }));
      return;
    }
    
    const presetConfig = socialMediaPresets[preset];
    const selectedResolution = resolution || presetConfig.resolutions[0];
    
    setBatchOptions(prev => ({
      ...prev,
      socialMediaPreset: preset,
      exportResolution: selectedResolution,
      outputFormat: presetConfig.outputFormat,
      outputQuality: presetConfig.outputQuality,
      qualityPreset: 'custom' // Switch to custom when social media preset is selected
    }));
  }, []);
  const [selectedJobForComparison, setSelectedJobForComparison] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [hashedFiles, setHashedFiles] = useState<Map<string, File>>(new Map());
  const [isHashing, setIsHashing] = useState(false);

  // Onboarding state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: ', ', severity: 'info' });
  
  // Recent projects state
  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    name: string;
    createdAt: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Worker initialization state
  const [workerInitStatus, setWorkerInitStatus] = useState<{
    inProgress: boolean;
    completed: boolean;
    error: string | null;
    progress: number;
    workers: Record<string, { ready: boolean; message: string; friendlyName?: string; description?: string }>;
  }>({
    inProgress: false,
    completed: false,
    error: null,
    progress: 0,
    workers: {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController>();
  const workerRef = useRef<Worker>();
	  const queryClient = useQueryClient();

  // Master Integration Provider
	  const { communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);

  // Smart polling with visibility API and exponential backoff
  const [pollingInterval] = useState(2000);
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
  };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      workerRef.current?.terminate();
    };
  }, []);

	  // Sanitize filename for safe display
	  const sanitizeFilename = useCallback((filename: string): string => {
	    return filename.replace(/[<>:"/\\|?*]/g, '_');
	  }, []);

  // Fetch Google Drive project folders for delivery folder selection
  // Always fetch to check for project subfolders even when upload is disabled
  const { data: projectFolders = [] } = useQuery({
    queryKey: ['google-drive-project-folders', userId],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/google-drive/project-folders/${userId}`, { signal });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Find "Leveranse til klient" subfolder from project folders
  const deliverySubfolder = useMemo(() => {
    if (!effectiveProject?.driveFolderId || !projectFolders.length) return null;
    const projectFolder = projectFolders.find((f: any) => f.id === effectiveProject.driveFolderId);
    if (!projectFolder?.subFolders) return null;
    return projectFolder.subFolders.find((sf: any) => sf.name === 'Leveranse til klient');
  }, [effectiveProject?.driveFolderId, projectFolders]);

  // Auto-populate Google Drive folder from selected project
  useEffect(() => {
    if (effectiveProject?.driveFolderId) {
      setBatchOptions(prev => ({
        ...prev,
        googleDriveFolderId: effectiveProject.driveFolderId,
        googleDriveDeliveryFolder: deliverySubfolder 
          ? `${effectiveProject.title || effectiveProject.name || 'Project'}/Leveranse til klient`
          : `${effectiveProject.title || effectiveProject.name || 'Project'}/Leveranse til klient`, // Backend will create if needed
        googleDriveUpload: true // Auto-enable if project has folder
      }));
    }
  }, [effectiveProject?.driveFolderId, effectiveProject?.title, effectiveProject?.name, deliverySubfolder]);

  // Fetch presets
  const { data: presets = [] } = useQuery({
    queryKey: ['/api/photo-enhancement/presets', userId],
    queryFn: async ({ signal }) => {
      const response = await apiRequest(
        `/api/photo-enhancement/presets?userId=${userId}`,
        { signal }
      );
      return response?.presets || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch enhancement jobs with smart polling
  const { data: enhancementJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/photo-enhancement/jobs', userId, projectId, effectiveProject?.id],
    queryFn: async ({ signal }) => {
      const effectiveProjectId = projectId || effectiveProject?.id?.toString();
      const response = await apiRequest(
        `/api/photo-enhancement/jobs?userId=${userId}${effectiveProjectId ? `&projectId=${effectiveProjectId}` : ', '}`,
        { signal }
      );
      return z.array(EnhancementJobSchema).parse(response || []);
  },
    refetchInterval: isTabVisible ? pollingInterval : false,
    staleTime: 100,
    gcTime: 5 * 60 * 100,
    retry: (failureCount, error: any) => {
      if (error?.name === 'AbortError') return false;
      return failureCount < 3;
},
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
});

  // Fetch quality comparison data
  const { data: qualityComparison } = useQuery({
    queryKey: ['/api/photo-enhancement/quality-comparison', selectedJobForComparison],
    queryFn: async ({ signal }) => {
      if (!selectedJobForComparison) return null;
      const response = await apiRequest(
        `/api/photo-enhancement/quality-comparison/${selectedJobForComparison}`,
        { signal }
      );
      return response ? QualityComparisonSchema.parse(response) : null;
  },
    enabled: !!selectedJobForComparison,
    staleTime: 5 * 60 * 100,
    gcTime: 10 * 60 * 100,
});

  // Fetch system telemetry (replaces hardcoded values)
  const { data: systemTelemetry } = useQuery({
    queryKey: ['/api/photo-enhancement/telemetry', ],
    queryFn: async ({ signal }) => {
      const response = await apiRequest('/api/photo-enhancement/telemetry', {
        headers: {
          "Content-Type" : "application/json"
    },
         signal });
      return response as SystemTelemetry;
  },
    staleTime: 30 * 100,
    refetchInterval: isTabVisible ? 30000 : false,
});

  // Start enhancement mutation with AbortController
  const startEnhancementMutation = useMutation({
    mutationFn: async (data: {
      files: File[];
      enhancementType: string;
      options: BatchProcessingOptions;
}) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const formData = new FormData();
      data.files.forEach(file => formData.append('files', file));
      formData.append('enhancementType', data.enhancementType);
      formData.append('options', JSON.stringify(data.options));
      formData.append('userId', userId);
      const effectiveProjectId = projectId || effectiveProject?.id?.toString();
      if (effectiveProjectId) formData.append('projectId', effectiveProjectId);

      const response = await fetch('/api/photo-enhancement/start', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

      return await response.json();
  },
    onSuccess: () => {
      setSelectedFiles([]);
      setHashedFiles(new Map());
      queryClient.invalidateQueries({ queryKey: ['/api/photo-enhancement/jobs', userId, projectId, effectiveProject?.id] });
  },
    retry: (failureCount, error: any) => {
      if (error?.name === 'AbortError') return false;
      return failureCount < 2;
},
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
});

  // Cancel enhancement mutation
  const cancelEnhancementMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000); // 10s timeout

      return await apiRequest(`/api/photo-enhancement/cancel/${jobId}`, {
        method: 'POST',
        signal: controller.signal,
      });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photo-enhancement/jobs', userId, projectId, effectiveProject?.id] });
  },
    retry:  1,
});

  // Download enhanced image mutation with secure URLs
  const downloadEnhancedMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 30000); // 30s timeout for download

      return await apiRequest(`/api/photo-enhancement/download/${jobId}`, {
        method: 'GET',
        signal: controller.signal,
      });
	  },
	    onSuccess: (data) => {
	      if (!data || !data.signedUrl) return;

	      // Notify parent components about file download
	      if (onFileDownload) {
	        const downloadData = {
	          id: `download_${Date.now()}`,
	          filename: data.filename,
	          url: data.signedUrl,
	          downloadedAt: new Date().toISOString(),
	          projectId: effectiveProject?.id?.toString() || projectId,
	          type: 'enhanced_photo',
	        };
	        console.log('File download notification: ', downloadData);
	        onFileDownload(downloadData);
	      }

	      const link = document.createElement('a');
	      link.href = data.signedUrl;
	      link.download = sanitizeFilename(data.filename);
	      link.rel = 'noopener noreferrer';
	      link.target = '_blank';
	      document.body.appendChild(link);
	      link.click();
	      document.body.removeChild(link);
	  }
	});

	  // Cleanup temporary files mutation (Neural Engine temp directory)
	  const cleanupTemporaryFilesMutation = useMutation({
	    mutationFn: async () => {
	      return apiRequest('/api/neural-engine/cleanup', {
	        method: 'DELETE',
	      });
	    },
	    onSuccess: () => {
	      // Refresh jobs after cleanup
	      queryClient.invalidateQueries({ queryKey: ['/api/photo-enhancement/jobs', userId, projectId] });
	      features.trackFeatureUsage('photo-enhancement-suite', 'quick-action', {
	        action: 'cleanup-temporary-files',
	      });
	    },
	  });

  // File hashing with Web Worker for deduplication
  const hashFileWithWorker = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        workerRef.current = new Worker('/workers/fileHashWorker.js');
    }

      const worker = workerRef.current;
      const timeout = setTimeout(() => {
        reject(new Error('Hashing timeout'));
    }, 30000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.error) {
          reject(new Error(e.data.error));
      } else {
          resolve(e.data.hash);
      }
    };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
    };

      worker.postMessage({ file, action: 'hash' });
  });
}, []);

  // Handle Lightroom project import
  const handleLightroomImport = useCallback(async (catalogFile: File) => {
    try {
      console.log('📷 Importing Lightroom project: ', catalogFile.name);
      
      // Read catalog file (it's actually a SQLite database)
      const catalogBuffer = await catalogFile.arrayBuffer();
      
      // Send to backend for processing
      const formData = new FormData();
      formData.append('catalog', catalogFile);
      formData.append('userId', userId);
      
      const response = await fetch('/api/photo-enhancement/import-lightroom', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to import Lightroom project');
      }
      
      const result = await response.json();
      console.log('✅ Lightroom project imported:', result);
      
      // Extract image files from Lightroom project
      if (result.files && result.files.length > 0) {
        // Convert File objects from paths
        const imageFiles: File[] = [];
        for (const filePath of result.files) {
          // Fetch and create File objects
          const fileResponse = await fetch(`/api/photo-enhancement/lightroom-file/${encodeURIComponent(filePath)}`);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            const fileName = path.basename(filePath);
            const file = new File([blob], fileName, { type: blob.type });
            imageFiles.push(file);
          }
        }
        
        if (imageFiles.length > 0) {
          setSelectedFiles(prev => [...prev, ...imageFiles]);
          // Enable RAW to TIFF conversion by default for Lightroom imports
          setBatchOptions(prev => ({ ...prev, convertRawToTiff: true }));
        }
      }
    } catch (error: any) {
      console.error('Lightroom import error:', error);
      alert(`Feil ved import av Lightroom-prosjekt: ${error.message}`);
    }
  }, [userId]);

	  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
	    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    setIsHashing(true);
    const newHashedFiles = new Map(hashedFiles);
    const validFiles: File[] = [];

    try {
      for (const file of files) {
        // Validate file type and size
        if (!file.type.startsWith('image/')) {
          console.warn(`Skipping non-image file: ${file.name}`);
          continue;
      }

        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          console.warn(`File too large: ${file.name}`);
          continue;
      }

        // Hash file for deduplication
        try {
          const hash = await hashFileWithWorker(file);
          
          if (!newHashedFiles.has(hash)) {
            newHashedFiles.set(hash, file);
            validFiles.push(file);
        } else {
            console.log(`Duplicate file detected: ${file.name}`);
        }
      } catch (error) {
          console.error(`Failed to hash file ${file.name}:`, error);
          // Add without hash if hashing fails
          validFiles.push(file);
      }
    }

      setHashedFiles(newHashedFiles);
      setSelectedFiles(prev => [...prev, ...validFiles]);
  } finally {
      setIsHashing(false);
  }

    // Reset file input
    if (event.target) {
      event.target.value = ', ';
  }
}, [hashedFiles, hashFileWithWorker]);

	  const handleStartEnhancement = useCallback(() => {
    if (selectedFiles.length === 0) return;
    
    // Determine effective enhancement type based on tab or preset selection
    let effectiveEnhancementType = batchOptions.enhancementType;
    if (selectedTab === 1) {
      effectiveEnhancementType = 'face_restore';
    } else if (selectedTab === 0) {
      effectiveEnhancementType = 'upscale';
    } else if (selectedTab === 4 && batchOptions.presetId) {
      // Preset selected - use the enhancement type from preset or default
      effectiveEnhancementType = batchOptions.enhancementType;
    }
    
    // Prepare options with workflow settings
    const effectiveOptions: BatchProcessingOptions = {
      ...batchOptions,
      enhancementType: effectiveEnhancementType,
      // Ensure RAW to TIFF conversion is enabled for RAW files
      convertRawToTiff: batchOptions.convertRawToTiff || selectedFiles.some(f => 
        ['.cr3','.cr2','.nef','.arw','.dng','.raf','.orf','.rw2','.srw'].includes(
          f.name.toLowerCase().substring(f.name.lastIndexOf('.'))
        )
      ),
      // Ensure delivery format is JPEG
      deliveryFormat: 'jpg',
      deliveryQuality: batchOptions.deliveryQuality || 95,
    };
    
    // Broadcast enhancement start event
    if ('broadcast' in communication && typeof communication.broadcast === 'function') {
      (communication as any).broadcast('photo-enhancement: started', {
        type: 'enhancement_started',
        data: {
          files: selectedFiles,
          enhancementType: effectiveEnhancementType,
          options: effectiveOptions,
          workflow: {
            step1: 'Lightroom Import',
            step2: 'RAW to TIFF Conversion',
            step3: effectiveOptions.presetId ? 'Apply Preset' : `Apply ${effectiveEnhancementType}`,
            step4: 'Export JPEG for Delivery',
            step5: effectiveOptions.googleDriveUpload ? 'Upload to Google Drive' : 'Local Storage',
          }
        },
        component: 'PhotoEnhancementSuite'
      });
    }
    
    // Notify parent components about file upload
    if (onFileUpload) {
      selectedFiles.forEach(file => {
	        const fileData = {
          id: `file_${Date.now()}_${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
	          status: 'processing',
	          uploadedAt: new Date().toISOString(),
	          projectId: effectiveProject?.id?.toString() || projectId,
	          enhancementType: effectiveEnhancementType,
	        };
        console.log('File upload notification:', fileData);
        onFileUpload(fileData);
    });
  }
    
	    startEnhancementMutation.mutate({
      files: selectedFiles,
      enhancementType: effectiveEnhancementType,
      options: effectiveOptions
});
}, [selectedFiles, batchOptions, selectedTab, startEnhancementMutation, onFileUpload, selectedProject, communication]);

	  // Quick action handlers
	  const handleOpenOutputFolder = useCallback(() => {
	    features.trackFeatureUsage('photo-enhancement-suite','quick-action', {
	      action: 'open-output-folder',
	    });

	    if (typeof window !== 'undefined') {
	      // Open the public downloads folder in a new tab
	      window.open('/downloads','_blank');
	    }
	  }, [features]);

	  const handleDownloadAllCompleted = useCallback(() => {
	    const completedJobs = enhancementJobs.filter(
	      (job: EnhancementJob) => job.status === 'completed' && job.enhancedUrl,
	    );

	    if (completedJobs.length === 0) {
	      return;
	    }

	    features.trackFeatureUsage('photo-enhancement-suite','quick-action', {
	      action: 'download-all-completed',
	      count: completedJobs.length,
	    });

	    completedJobs.forEach((job: EnhancementJob) => {
	      downloadEnhancedMutation.mutate(job.id);
	    });
	  }, [enhancementJobs, downloadEnhancedMutation, features]);

	  const handleCleanupTemporaryFiles = useCallback(() => {
	    cleanupTemporaryFilesMutation.mutate();
	  }, [cleanupTemporaryFilesMutation]);

	  
		  // Memoized utility functions for performance
	  const formatFileSize = useMemo(
	    () =>
	      (bytes: number) => {
	        const sizes = ['Bytes','KB','MB','GB'];
	        if (bytes === 0) return '0 Bytes';
	        const i = Math.floor(Math.log(bytes) / Math.log(1024));
	        return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ', ' + sizes[i];
	      },
	    [],
	  );

  const getStatusIcon = useMemo(() => (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'processing': return <CircularProgress size={0} />;
      case 'error': return <ErrorIcon color="error" />;
      case 'pending': return <Warning color="warning" />;
      default: return theming.getThemedIcon(', ');
  }
}, []);

  const getStatusColor = useMemo(() => (status: string) => {
    switch (status) {
      case 'completed': return 'success' as const;
      case 'processing': return 'info' as const;
      case 'error': return 'error' as const;
      case 'pending': return 'warning' as const;
      default: return 'default' as const;
}
}, []);

  // Statistics with real telemetry data
  const enhancementStats = useMemo(() => {
    const completedJobs = enhancementJobs.filter((j: EnhancementJob) => j.status === 'completed');
    return {
      totalCompleted: completedJobs.length,
      avgProcessingTime: systemTelemetry?.avgProcessingTime || 'N/',
      qualityImprovement: systemTelemetry?.qualityImprovement || 'N/',
      processingSpeed: systemTelemetry?.processingSpeed || 'N/',
  };
}, [enhancementJobs, systemTelemetry]);

	  const hasCompletedJobs = useMemo(
	    () => enhancementJobs.some((j: EnhancementJob) => j.status === 'completed' && j.enhancedUrl),
	    [enhancementJobs],
	  );

	  // Register component with MasterIntegrationProvider and integrate with data flow
	  useEffect(() => {
	    (componentRegistry as any).registerComponent('PhotoEnhancementSuite', {
	      type: 'enhancement',
	      capabilities: ['photo-enhancement','ai-processing','batch-processing'],
	      dataFlow: {
	        sources: ['enhancement-jobs','selected-files','batch-options'],
	        destinations: ['admin-dashboard','user-interface'],
	        processors: ['photo-processing','ai-processing'],
	      },
	    });

	    // Set up data flow nodes
	    (dataFlow as any).registerNode('enhancement-jobs', {
	      type: 'source',
	      data: enhancementJobs,
	      metadata: { component: 'PhotoEnhancementSuite', type: 'enhancement-jobs' },
	    });

	    (dataFlow as any).registerNode('selected-files', {
	      type: 'source',
	      data: selectedFiles,
	      metadata: { component: 'PhotoEnhancementSuite', type: 'selected-files' },
	    });

	    (dataFlow as any).registerNode('batch-options', {
	      type: 'source',
	      data: batchOptions,
	      metadata: { component: 'PhotoEnhancementSuite', type: 'batch-options' },
	    });

	    // Listen for enhancement events
	    if ('subscribe' in communication && typeof communication.subscribe === 'function') {
	      (communication as any).subscribe('photo-enhancement: start', (data: any) => {
	        if (data?.files && data?.options) {
	          handleStartEnhancement();
	        }
	      });

	      (communication as any).subscribe('photo-enhancement: file-select', (data: any) => {
	        if (data?.files) {
	          setSelectedFiles(data.files);
	        }
	      });
	    }

	    // Track feature usage
	    features.trackFeatureUsage('photo-enhancement-suite','opened', {
	      timestamp: Date.now(),
	      component: 'PhotoEnhancementSuite',
	      userId: user?.id,
	      profession: user?.profession,
	    });

	    return () => {
	      componentRegistry.unregisterComponent('PhotoEnhancementSuite');
	      dataFlow.unregisterNode('enhancement-jobs');
	      dataFlow.unregisterNode('selected-files');
	      dataFlow.unregisterNode('batch-options');
	    };
	  }, [
	    enhancementJobs,
	    selectedFiles,
	    batchOptions,
	    componentRegistry,
	    dataFlow,
	    communication,
	    features,
	    user?.id,
	    user?.profession,
	    handleStartEnhancement,
	  ]);

	  // Model descriptions for user information
  const modelDescriptions = {
    'gfpgan': {
      name: 'GFPGAN',
      description: 'Gjenoppretter og forbedrer ansiktsdetaljer i fotografier. Perfekt for portrettfotografi og gammelt materiale.',
      capabilities: ['Ansiktsgjenoppretting','Hudteksturforbedring','Øyegjenoppretting','Munnforbedring'],
      bestFor: ['Portrettfotografi','Gammelt materiale','Lavkvalitets bilder med ansikter'],
    }, 'realesrgan': {
      name: 'Real-ESRGAN',
      description: 'AI-drevet oppskaling som øker oppløsningen med 2x, 4x eller 8x uten kvalitetstap. Beholder detaljer og skarphet.',
      capabilities: ['Super-oppløsning','Detaljforbedring','Støyreduksjon','Skarphetsforbedring'],
      bestFor: ['Lavoppløste bilder','Upscaling for print','Gammelt materiale','Web-optimaliserte bilder'],
    }, 'diffbir': {
      name: 'DiffBIR',
      description: 'Blind bildegjenoppretting som fjerner støy, forbedrer kvalitet og oppskalerer bilder ved hjelp av diffusionsmodeller.',
      capabilities: ['Blind gjenoppretting','Støyreduksjon','Oppskaling','Kvalitetsforbedring'],
      bestFor: ['Høy støy','Komprimert materiale','Generell forbedring','Profesjonell gjenoppretting'],
    },
  };

  const tabData = [
    { label: 'Real-ESRGAN Upscaling', icon: <HighQuality />,},
    { label: 'GFPGAN Face Restore', icon: <Face /> },
    { label: 'Batch Processing', icon: <BurstMode />,},
    { label: 'Quality Comparison', icon: <Assessment /> },
    { label: 'Presets', icon: theming.getThemedIcon('tune') || <Assessment /> }
  ];


  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p:  3, borderRadius:  0 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600}}>
              <Avatar sx={{ bgcolor: '#e91e63' }}>
                {theming.getThemedIcon('autoFixHigh')}
              </Avatar>
              Fotoforbedringsstudio
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              AI-drevet bildeforbedring med Real-ESRGAN, GFPGAN og avansert batch-prosessering
            </Typography>
            
            {/* Feature Analytics Display */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1, mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip 
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18}}
              />
            </Box>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('cloudUpload')}
              onClick={() => fileInputRef.current?.click()}
            >
              Last opp bilder
            </Button>
            
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('folder')}
              onClick={() => {
                // Trigger Lightroom project import
                const lightroomInput = document.createElement('input');
                lightroomInput.type = 'file';
                lightroomInput.accept = '.lrcat,.lrlibrary';
                lightroomInput.webkitdirectory = false;
                lightroomInput.multiple = false;
                lightroomInput.onchange = async (e) => {
                  const target = e.target as HTMLInputElement;
                  const catalogFile = target.files?.[0];
                  if (catalogFile) {
                    // Import Lightroom project
                    handleLightroomImport(catalogFile);
                  }
                };
                lightroomInput.click();
              }}
            >
              Importer fra Lightroom
            </Button>
            
            <Button variant="contained"
              startIcon={theming.getThemedIcon('play')}
              onClick={handleStartEnhancement}
              disabled={selectedFiles.length === 0 || startEnhancementMutation.isPending}
             sx={theming.getThemedButtonSx()}>
              {startEnhancementMutation.isPending ? 'Starter...' : 'Start forbedring'}
            </Button>
            
            <IconButton
              onClick={() => setSettingsDialogOpen(true)}
              color="primary"
              aria-label="Åpne innstillinger for fotoforbedring"
            >
              {theming.getThemedIcon('settings')}
            </IconButton>
          </Stack>
        </Stack>

        {selectedFiles.length > 0 && (
          <Alert severity="info" sx={{ mt:  2 }}>
            <Stack spacing={1}>
              <Typography variant="body2">
                {selectedFiles.length} filer valgt for prosessering. 
                Total størrelse: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
                {isHashing && <CircularProgress size={16} sx={{ ml:  1 }} />}
              </Typography>
              {batchOptions.convertRawToTiff && (
                <Typography variant="caption">
                  📷 RAW-filer vil bli konvertert til TIFF før prosessering
                </Typography>
              )}
              {batchOptions.googleDriveUpload && batchOptions.googleDriveDeliveryFolder && (
                <Typography variant="caption">
                  ☁️ Leveranse-JPEG vil bli lastet opp til: {batchOptions.googleDriveDeliveryFolder}
                </Typography>
              )}
              {batchOptions.enhancementType && (
                <Typography variant="caption">
                  🤖 Modell: {modelDescriptions[
                    batchOptions.enhancementType === 'face_restore' ? 'gfpgan' :
                    batchOptions.enhancementType === 'upscale' ? 'realesrgan' :
                    'diffbir'
                  ]?.name || batchOptions.enhancementType}
                </Typography>
              )}
            </Stack>
          </Alert>
        )}
      </Paper>

	    <Box sx={{ flex: 1, display: 'flex' }}>
	      {/* Main Content */}
	      <Box sx={{ flex: 1, p: 3 }}>
          {/* Tabs */}
          <Paper sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              {tabData.map((tab, index) => (
                <Tab
                  key={index}
                  icon={tab.icon}
                  label={tab.label}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Paper>

          {/* Real-ESRGAN Upscaling Tab */}
          {selectedTab === 0 && (
            <Box>
              <Grid container spacing={3}>
                <Grid xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Real-ESRGAN Super-Resolution
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Avansert AI-oppskaling for skarpe, detaljrike bilder med 4x oppløsning
                      </Typography>
                      
                      <Stack spacing={3} sx={{ mt:  3 }}>
                        <FormControl fullWidth>
                          <InputLabel>Oppskaleringsfaktor</InputLabel>
                          <Select
                            value={batchOptions.upscaleFactor}
                            onChange={(e) => setBatchOptions(prev => ({ ...prev, upscaleFactor: Number(e.target.value, ),}))}
                            label="Oppskaleringsfaktor"
                          >
                            <MenuItem value={2}>2x (Rask)</MenuItem>
                            <MenuItem value={4}>4x (Anbefalt)</MenuItem>
                            <MenuItem value={8}>8x (Høy kvalitet)</MenuItem>
                          </Select>
                        </FormControl>

	                        <Box>
	                          <Typography gutterBottom>Utdataformat</Typography>
	                          <Stack direction="row" spacing={1} flexWrap="wrap">
	                            {['jpg','png','webp','tiff'].map((format) => (
	                              <Chip
	                                key={format}
	                                label={format.toUpperCase()}
	                                onClick={() =>
	                                  setBatchOptions((prev) => ({
	                                    ...prev,
	                                    outputFormat: format as any,
	                                  }))
	                                }
	                                color={batchOptions.outputFormat === format ? 'primary' : 'default'}
	                                variant={batchOptions.outputFormat === format ? 'filled' : 'outlined'}
	                              />
	                            ))}
	                          </Stack>
	                        </Box>

                        <Divider />

                        {/* Google Drive Upload Options */}
                        <Box>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={batchOptions.googleDriveUpload || false}
                                onChange={(e) => setBatchOptions(prev => ({ 
                                  ...prev, 
                                  googleDriveUpload: e.target.checked 
                                }))}
                              />
                            }
                            label="Last opp til Google Drive"
                          />
                          {batchOptions.googleDriveUpload && !effectiveProject?.driveFolderId && (
                            <Box sx={{ mt: 2 }}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Prosjektmappe (Leveranse)</InputLabel>
                                <Select
                                  value={batchOptions.googleDriveFolderId || ', '}
                                  onChange={(e) => {
                                    const folder = projectFolders.find((f: any) => f.id === e.target.value);
                                    setBatchOptions(prev => ({ 
                                      ...prev, 
                                      googleDriveFolderId: e.target.value,
                                      googleDriveDeliveryFolder: folder ? `${folder.name}/Leveranse til klient` : undefined
                                    }));
                                  }}
                                  label="Prosjektmappe (Leveranse)"
                                >
                                  {projectFolders.map((folder: any) => (
                                    <MenuItem key={folder.id} value={folder.id}>
                                      {folder.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {batchOptions.googleDriveDeliveryFolder && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  Leveranse-mappe: {batchOptions.googleDriveDeliveryFolder}
                                </Typography>
                              )}
                            </Box>
                          )}
                          {batchOptions.googleDriveUpload && effectiveProject?.driveFolderId && (
                            <Box sx={{ mt: 2 }}>
                              <Alert severity="info" sx={{ mt: 1 }}>
                                <Typography variant="body2">
                                  Prosjektmappe: <strong>{effectiveProject.title || effectiveProject.name || 'Project'}</strong>
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Leveranse-mappe: {batchOptions.googleDriveDeliveryFolder || `${effectiveProject.title || effectiveProject.name || 'Project'}/Leveranse til klient`}
                                </Typography>
                              </Alert>
                            </Box>
                          )}
                        </Box>

                        <Box>
                          <Typography gutterBottom>Kvalitet: {batchOptions.outputQuality}%</Typography>
                          <Slider
                            value={batchOptions.outputQuality}
                            onChange={(_, value) => setBatchOptions(prev => ({ ...prev, outputQuality: value as number }))}
                            min={70}
                            max={100}
                            step={5}
                            marks
                            valueLabelDisplay="auto"
                          />
                        </Box>

                        <FormControl fullWidth>
                          <InputLabel>Modell</InputLabel>
                          <Select
                            value={batchOptions.modelName || 'RealESRGAN_x4plus'}
                            onChange={(e) => setBatchOptions(prev => ({ ...prev, modelName: e.target.value }))}
                            label="Modell"
                          >
                            <MenuItem value="RealESRGAN_x4plus">RealESRGAN x4plus (Anbefalt)</MenuItem>
                            <MenuItem value="RealESRGAN_x4plus_anime">RealESRGAN x4plus Anime</MenuItem>
                            <MenuItem value="RealESRNet_x4plus">RealESRNet x4plus</MenuItem>
                            <MenuItem value="realesr-animevideov3">Anime Video v3</MenuItem>
                          </Select>
                        </FormControl>

                        <Box>
                          <Typography gutterBottom>Støyreduksjon: {batchOptions.denoiseStrength}</Typography>
                          <Slider
                            value={batchOptions.denoiseStrength}
                            onChange={(_, value) => setBatchOptions(prev => ({ ...prev, denoiseStrength: value as number }))}
                            min={0}
                            max={1}
                            step={0.1}
                            marks={[
                              { value: 0, label: 'Ingen' },
                              { value: 0.5, label: 'Moderat' },
                              { value: 1, label: 'Maks' }
                            ]}
                            valueLabelDisplay="auto"
                          />
                        </Box>

                        <FormControlLabel
                          control={
                            <Switch
                              checked={batchOptions.faceEnhance || false}
                              onChange={(e) => setBatchOptions(prev => ({ ...prev, faceEnhance: e.target.checked }))}
                            />
                          }
                          label="Aktiver ansiktsforbedring (GFPGAN)"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Prosessstatistikk
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Oppskaleringer utført: </Typography>
                          <Chip size="small" label={enhancementStats.totalCompleted} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Snitt behandlingstid: </Typography>
                          <Typography variant="body2">{enhancementStats.avgProcessingTime}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Total kvalitetsforbedring: </Typography>
                          <Typography variant="body2" color="success.main">{enhancementStats.qualityImprovement}</Typography>
                        </Stack>
                        {systemTelemetry && (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Prosesseringshastighet: </Typography>
                            <Typography variant="body2" color="info.main">{systemTelemetry.processingSpeed}</Typography>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* GFPGAN Face Restoration Tab */}
          {selectedTab === 1 && (
            <Box>
              <Grid container spacing={3}>
                <Grid xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        GFPGAN Ansiktsgjenoppretting
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Spesialisert AI for å gjenopprette og forbedre ansiktsdetaljer i fotografier
                        <br />
                        <strong>Status:</strong> Fullt funksjonell (GFPGAN v1.3)
                      </Typography>
                      
                      <Stack spacing={3} sx={{ mt:  3 }}>
                        {/* Quality Presets */}
                        <Box>
                          <Typography gutterBottom sx={{ mb: 1.5, fontWeight: 500}}>
                            Kvalitetspreset
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {Object.entries(gfpganPresets).map(([key, preset]) => (
                              <Chip
                                key={key}
                                label={preset.label}
                                onClick={() => applyGfpganPreset(key as QualityPreset)}
                                color={batchOptions.qualityPreset === key ? 'primary' : 'default'}
                                variant={batchOptions.qualityPreset === key ? 'filled' : 'outlined'}
                                sx={{ mb: 1 }}
                              />
                            ))}
                          </Stack>
                          {batchOptions.qualityPreset !== 'custom' && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {gfpganPresets[batchOptions.qualityPreset as keyof typeof gfpganPresets].description}
                            </Typography>
                          )}
                        </Box>

                        {/* Social Media Export Presets */}
                        <Box>
                          <Typography gutterBottom sx={{ mb: 1.5, fontWeight: 500}}>
                            Eksport for sosiale medier
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label="Ingen"
                              onClick={() => applySocialMediaPreset('none')}
                              color={batchOptions.socialMediaPreset === 'none' ? 'primary' : 'default'}
                              variant={batchOptions.socialMediaPreset === 'none' ? 'filled' : 'outlined'}
                              sx={{ mb: 1 }}
                            />
                            {Object.entries(socialMediaPresets).map(([key, preset]) => (
                              <Chip
                                key={key}
                                icon={preset.icon}
                                label={preset.label}
                                onClick={() => applySocialMediaPreset(key as SocialMediaPreset)}
                                color={batchOptions.socialMediaPreset === key ? 'primary' : 'default'}
                                variant={batchOptions.socialMediaPreset === key ? 'filled' : 'outlined'}
                                sx={{ mb: 1 }}
                              />
                            ))}
                          </Stack>
                          {batchOptions.socialMediaPreset !== 'none' && (
                            <Box sx={{ mt: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].description}
                              </Typography>
                              {socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].resolutions.length > 1 && (
                                <FormControl fullWidth size="small">
                                  <InputLabel>Oppløsning</InputLabel>
                                  <Select
                                    value={batchOptions.exportResolution || socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].resolutions[0]}
                                    onChange={(e) => {
                                      setBatchOptions(prev => ({ 
                                        ...prev, 
                                        exportResolution: e.target.value 
                                      }));
                                    }}
                                    label="Oppløsning"
                                  >
                                    {socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].resolutions.map((res) => (
                                      <MenuItem key={res} value={res}>{res}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {batchOptions.exportResolution && (
                                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                  Eksporteres som {batchOptions.exportResolution} ({socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].outputFormat.toUpperCase()})
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>

                        <Divider />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={batchOptions.autoFaceDetection}
                              onChange={(e) => {
                                setBatchOptions(prev => ({ 
                                  ...prev, 
                                  autoFaceDetection: e.target.checked,
                                  qualityPreset: 'custom'
                                }));
                              }}
                            />
                        }
                          label="Automatisk ansiktsdeteksjon"
                        />

                        <Box>
                          <Typography gutterBottom>
                            Gjenopprettingsstyrke: {batchOptions.gfpganWeight.toFixed(1)}
                          </Typography>
                          <Slider
                            value={batchOptions.gfpganWeight}
                            onChange={(_, value) => {
                              setBatchOptions(prev => ({ 
                                ...prev, 
                                gfpganWeight: value as number,
                                qualityPreset: 'custom'
                              }));
                            }}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            marks={[
                              { value: 0.1, label: '0.1' },
                              { value: 0.5, label: '0.5' },
                              { value: 1.0, label: '1.0' }
                            ]}
                            valueLabelDisplay="auto"
                            disabled={batchOptions.qualityPreset !== 'custom'}
                          />
                          {batchOptions.qualityPreset === 'custom' && (
                            <Typography variant="caption" color="text.secondary">
                              Høyere verdier gir mer aggressiv gjenoppretting
                            </Typography>
                          )}
                        </Box>

                        <FormControlLabel
                          control={
                            <Switch
                              checked={batchOptions.preserveFaceShape}
                              onChange={(e) => {
                                setBatchOptions(prev => ({ 
                                  ...prev, 
                                  preserveFaceShape: e.target.checked,
                                  qualityPreset: 'custom'
                                }));
                              }}
                            />
                        }
                          label="Bevar original ansiktsform"
                        />

                        <FormControlLabel
                          control={
                            <Switch
                              checked={batchOptions.advancedSkinTexture}
                              onChange={(e) => {
                                setBatchOptions(prev => ({ 
                                  ...prev, 
                                  advancedSkinTexture: e.target.checked,
                                  qualityPreset: 'custom'
                                }));
                              }}
                            />
                        }
                          label="Avansert hudtekstur"
                        />

                        {/* Advanced Options (Collapsible) */}
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Avanserte innstillinger
                          </Typography>
                          <Stack spacing={2}>
                            <FormControl fullWidth size="small">
                              <InputLabel>GFPGAN Versjon</InputLabel>
                              <Select
                                value={batchOptions.gfpganVersion}
                                onChange={(e) => {
                                  setBatchOptions(prev => ({ 
                                    ...prev, 
                                    gfpganVersion: e.target.value,
                                    qualityPreset: 'custom'
                                  }));
                                }}
                                label="GFPGAN Versjon"
                              >
                                <MenuItem value="1.3">v1.3 (Anbefalt)</MenuItem>
                                <MenuItem value="1.2">v1.2</MenuItem>
                                <MenuItem value="1.0">v1.0</MenuItem>
                              </Select>
                            </FormControl>

                            <Box>
                              <Typography gutterBottom variant="body2">
                                Utdataformat
                              </Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {['jpg','png','webp','tiff'].map((format) => (
                                  <Chip
                                    key={format}
                                    label={format.toUpperCase()}
                                    size="small"
                                    onClick={() => {
                                      setBatchOptions((prev) => ({
                                        ...prev,
                                        outputFormat: format as any,
                                        qualityPreset: 'custom'
                                      }));
                                    }}
                                    color={batchOptions.outputFormat === format ? 'primary' : 'default'}
                                    variant={batchOptions.outputFormat === format ? 'filled' : 'outlined'}
                                  />
                                ))}
                              </Stack>
                            </Box>

                            {/* Google Drive Upload Options */}
                            <Box sx={{ mt: 2 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={batchOptions.googleDriveUpload || false}
                                    onChange={(e) => setBatchOptions(prev => ({ 
                                      ...prev, 
                                      googleDriveUpload: e.target.checked 
                                    }))}
                                    size="small"
                                  />
                                }
                                label="Last opp til Google Drive"
                              />
                              {batchOptions.googleDriveUpload && !effectiveProject?.driveFolderId && (
                                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                  <InputLabel>Prosjektmappe</InputLabel>
                                  <Select
                                    value={batchOptions.googleDriveFolderId || ', '}
                                    onChange={(e) => {
                                      const folder = projectFolders.find((f: any) => f.id === e.target.value);
                                      setBatchOptions(prev => ({ 
                                        ...prev, 
                                        googleDriveFolderId: e.target.value,
                                        googleDriveDeliveryFolder: folder ? `${folder.name}/Leveranse til klient` : undefined
                                      }));
                                    }}
                                    label="Prosjektmappe"
                                  >
                                    {projectFolders.map((folder: any) => (
                                      <MenuItem key={folder.id} value={folder.id}>
                                        {folder.name}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              )}
                              {batchOptions.googleDriveUpload && selectedProject?.driveFolderId && (
                                <Box sx={{ mt: 1 }}>
                                  <Alert severity="info">
                                    <Typography variant="body2">
                                      Prosjektmappe: <strong>{selectedProject.title || 'Project'}</strong>
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      Leveranse-mappe: {batchOptions.googleDriveDeliveryFolder || `${selectedProject.title || 'Project'}/Leveranse til klient`}
                                    </Typography>
                                  </Alert>
                                </Box>
                              )}
                            </Box>

                            {batchOptions.qualityPreset === 'custom' && (
                              <Box>
                                <Typography gutterBottom variant="body2">
                                  Kvalitet: {batchOptions.outputQuality}%
                                </Typography>
                                <Slider
                                  value={batchOptions.outputQuality}
                                  onChange={(_, value) => setBatchOptions(prev => ({ 
                                    ...prev, 
                                    outputQuality: value as number 
                                  }))}
                                  min={70}
                                  max={100}
                                  step={5}
                                  marks
                                  valueLabelDisplay="auto"
                                />
                              </Box>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Ansiktsanalyse
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Ansikter behandlet: </Typography>
                          <Chip size="small" label={enhancementJobs.filter((j: EnhancementJob) => j.enhancementType === 'face_restore' && j.status === 'completed').length} />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Suksessrate:</Typography>
                          <Typography variant="body2" color="success.main">
                            {enhancementJobs.filter((j: EnhancementJob) => j.enhancementType === 'face_restore').length > 0
                              ? `${Math.round((enhancementJobs.filter((j: EnhancementJob) => j.enhancementType === 'face_restore' && j.status === 'completed').length / enhancementJobs.filter((j: EnhancementJob) => j.enhancementType === 'face_restore').length) * 100)}%`
                              : 'N/A'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Aktive jobber:</Typography>
                          <Chip 
                            size="small" 
                            label={enhancementJobs.filter((j: EnhancementJob) => j.enhancementType === 'face_restore' && j.status === 'processing').length}
                            color="info"
                          />
                        </Stack>
                        <Divider />
                        <Typography variant="subtitle2" gutterBottom>
                          GFPGAN Konfigurasjon
                        </Typography>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption">Versjon:</Typography>
                            <Typography variant="caption" fontWeight={500}>{batchOptions.gfpganVersion}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption">Weight:</Typography>
                            <Typography variant="caption" fontWeight={500}>{batchOptions.gfpganWeight.toFixed(1)}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption">Auto-deteksjon:</Typography>
                            <Chip size="small" label={batchOptions.autoFaceDetection ? 'På' : 'Av'} color={batchOptions.autoFaceDetection ? 'success' : 'default'} />
                          </Stack>
                          <Divider sx={{ my: 0.5 }} />
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption">Oppløsning:</Typography>
                            <Chip size="small" label="Bevart" color="success" />
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption">Preset:</Typography>
                            <Chip 
                              size="small" 
                              label={batchOptions.qualityPreset === 'best' ? 'Best' : 
                                     batchOptions.qualityPreset === 'balanced' ? 'Balanced' :
                                     batchOptions.qualityPreset === 'file_size' ? 'Optimized' : 'Custom'} 
                              color="primary" 
                            />
                          </Stack>
                          {batchOptions.socialMediaPreset !== 'none' && (
                            <>
                              <Divider sx={{ my: 0.5 }} />
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption">Eksport:</Typography>
                                <Chip 
                                  size="small" 
                                  icon={socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].icon}
                                  label={socialMediaPresets[batchOptions.socialMediaPreset as keyof typeof socialMediaPresets].label}
                                  color="secondary" 
                                />
                              </Stack>
                              {batchOptions.exportResolution && (
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="caption">Oppløsning:</Typography>
                                  <Typography variant="caption" fontWeight={500}>{batchOptions.exportResolution}</Typography>
                                </Stack>
                              )}
                            </>
                          )}
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
         )}

          {/* Batch Processing Tab */}
          {selectedTab === 2 && (
            <Box>
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Batch-prosessering
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Effektiv behandling av flere bilder samtidig med tilpassede innstillinger
                  </Typography>
                  
                  <Grid container spacing={3} sx={{ mt:  2 }}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Forbedringstype</InputLabel>
                        <Select
                          value={batchOptions.enhancementType}
                          onChange={(e) => setBatchOptions(prev => ({ ...prev, enhancementType: e.target.value as any }))}
                          label="Forbedringstype"
                        >
                          <MenuItem value="upscale">Real-ESRGAN Oppskaling</MenuItem>
                          <MenuItem value="face_restore">GFPGAN Ansiktsgjenoppretting</MenuItem>
                          <MenuItem value="denoise">Støyreduksjon</MenuItem>
                          <MenuItem value="colorize">Kolorisering</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={batchOptions.preserveOriginal}
                            onChange={(e) => setBatchOptions(prev => ({ ...prev, preserveOriginal: e.target.checked }))}
                          />
                      }
                        label="Bevar originale filer"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Active Jobs */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Aktive prosesseringsjobber
                  </Typography>
                  {jobsLoading ? (
                    <LinearProgress />
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Fil</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Fremdrift</TableCell>
                            <TableCell>Tid</TableCell>
                            <TableCell>Handlinger</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {enhancementJobs.map((job: EnhancementJob) => (
                            <TableRow key={job.id}>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={2}>
                                  <ImageIcon />
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {sanitizeFilename(job.filename)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {formatFileSize(job.originalSize)}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  size="small" 
                                  label={job.enhancementType}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  {getStatusIcon(job.status)}
                                  <Chip 
                                    size="small"
                                    label={job.status}
                                    color={getStatusColor(job.status)}
                                  />
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box sx={{ width: '100%', mr:  1 }}>
                                    <LinearProgress 
                                      variant="determinate" 
                                      value={job.progress}
                                      color={job.status === 'error' ? 'error' : 'primary'}
                                    />
                                  </Box>
                                  <Typography variant="body2">
                                    {job.progress}%
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {job.processingTime ? `${job.processingTime}s` : 
                                 job.status === 'processing' ? 'Prosesserer...' : '-'}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1}>
                                  {job.status === 'completed' && job.enhancedUrl && (
                                    <IconButton
                                      size="small"
                                      onClick={() => downloadEnhancedMutation.mutate(job.id)}
                                      aria-label={`Last ned forbedret versjon av ${sanitizeFilename(job.filename)}`}
                                    >
                                      {theming.getThemedIcon('download')}
                                    </IconButton>
                                  )}
                                  {job.status === 'completed' && (
                                    <IconButton
                                      size="small"
                                      onClick={() => {
                                        setSelectedJobForComparison(job.id);
                                    }}
                                      aria-label={`Vis kvalitetssammenligning for ${sanitizeFilename(job.filename)}`}
                                    >
                                      {theming.getThemedIcon('compareArrows')}
                                    </IconButton>
                                  )}
                                  {job.status === 'processing' && (
                                    <IconButton
                                      size="small"
                                      onClick={() => cancelEnhancementMutation.mutate(job.id)}
                                      color="error"
                                      aria-label={`Avbryt prosessering av ${sanitizeFilename(job.filename)}`}
                                    >
                                      {theming.getThemedIcon('stop')}
                                    </IconButton>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Presets Tab */}
          {selectedTab === 4 && (
            <Box>
              <Grid container spacing={3}>
                <Grid xs={12} md={8}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Velg Modell eller Preset
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Velg en AI-modell eller et Lightroom-preset for bildeforbedring
                      </Typography>
                      
                      <Stack spacing={3} sx={{ mt: 3 }}>
                        {/* Model Selection */}
                        <Box>
                          <Typography gutterBottom sx={{ mb: 1.5, fontWeight: 500}}>
                            AI-Modeller
                          </Typography>
                          <Grid container spacing={2}>
                            {Object.entries(modelDescriptions).map(([key, model]) => (
                              <Grid item xs={12} sm={6} key={key}>
                                <Card
                                  sx={{
                                    cursor: 'pointer',
                                    border: batchOptions.enhancementType === (key === 'gfpgan' ? 'face_restore' : key === 'realesrgan' ? 'upscale' : 'blind_restore') ? 2 : 1,
                                    borderColor: batchOptions.enhancementType === (key === 'gfpgan' ? 'face_restore' : key === 'realesrgan' ? 'upscale' : 'blind_restore') ? 'primary.main' : 'divider','&:hover': { boxShadow: 4 }
                                  }}
                                  onClick={() => {
                                    setBatchOptions(prev => ({
                                      ...prev,
                                      enhancementType: key === 'gfpgan' ? 'face_restore' : key === 'realesrgan' ? 'upscale' : 'blind_restore',
                                      presetId: undefined, // Clear preset when selecting model
                                    }));
                                  }}
                                >
                                  <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                      {model.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                      {model.description}
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" fontWeight={500}>
                                        Evner:
                                      </Typography>
                                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                                        {model.capabilities.map((cap, idx) => (
                                          <Chip key={idx} label={cap} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                                        ))}
                                      </Stack>
                                    </Box>
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" fontWeight={500}>
                                        Best for:
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {model.bestFor.join(', ')}
                                      </Typography>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>

                        <Divider />

                        {/* Preset Selection */}
                        <Box>
                          <Typography gutterBottom sx={{ mb: 1.5, fontWeight: 500}}>
                            Lightroom Presets
                          </Typography>
                          {presets.length === 0 ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              Ingen presets tilgjengelig. Opprett et preset ved å velge en modell og lagre innstillingene.
                            </Alert>
                          ) : (
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              {presets.map((preset: any) => (
                                <Grid item xs={12} sm={6} key={preset.id}>
                                  <Card
                                    sx={{
                                      cursor: 'pointer',
                                      border: batchOptions.presetId === preset.id ? 2 : 1,
                                      borderColor: batchOptions.presetId === preset.id ? 'primary.main' : 'divider',
                                      '&:hover': { boxShadow: 4 }
                                    }}
                                    onClick={() => {
                                      setBatchOptions(prev => ({
                                        ...prev,
                                        presetId: preset.id,
                                        enhancementType: prev.enhancementType, // Keep current enhancement type
                                      }));
                                    }}
                                  >
                                    <CardContent>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="subtitle1" fontWeight={500}>
                                          {preset.name}
                                        </Typography>
                                        {preset.isFavorite && (
                                          <Chip size="small" label="Favoritt" color="warning" />
                                        )}
                                      </Stack>
                                      {preset.category && (
                                        <Chip 
                                          label={preset.category} 
                                          size="small" 
                                          variant="outlined" 
                                          sx={{ mt: 0.5, mb: 0.5 }}
                                        />
                                      )}
                                      {preset.description && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                          {preset.description}
                                        </Typography>
                                      )}
                                      {preset.usageCount > 0 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                          Brukt {preset.usageCount} gang(er)
                                        </Typography>
                                      )}
                                    </CardContent>
                                  </Card>
                                </Grid>
                              ))}
                            </Grid>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Valgt Modell
                      </Typography>
                      {batchOptions.enhancementType && (
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {modelDescriptions[
                                batchOptions.enhancementType === 'face_restore' ? 'gfpgan' :
                                batchOptions.enhancementType === 'upscale' ? 'realesrgan' :
                                'diffbir'
                              ]?.name || 'Ukjent'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {modelDescriptions[
                                batchOptions.enhancementType === 'face_restore' ? 'gfpgan' :
                                batchOptions.enhancementType === 'upscale' ? 'realesrgan' : 'diffbir'
                              ]?.description}
                            </Typography>
                          </Box>
                          {batchOptions.presetId && (
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                Preset: {batchOptions.presetId}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Quality Comparison Tab */}
          {selectedTab === 3 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Original bilde
                      </Typography>
                      {qualityComparison && (
                        <Stack spacing={2}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Oppløsning: </Typography>
                            <Typography variant="body2">{qualityComparison.originalMetrics.resolution}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Filstørrelse: </Typography>
                            <Typography variant="body2">{formatFileSize(qualityComparison.originalMetrics.fileSize)}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Skarphet: </Typography>
                            <Typography variant="body2">{qualityComparison.originalMetrics.sharpness}%</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Støynivå:</Typography>
                            <Typography variant="body2">{qualityComparison.originalMetrics.noise}%</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Fargebalanse: </Typography>
                            <Typography variant="body2">{qualityComparison.originalMetrics.colorBalance}%</Typography>
                          </Stack>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Forbedret bilde
                      </Typography>
                      {qualityComparison && (
                        <Stack spacing={2}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Oppløsning: </Typography>
                            <Typography variant="body2" color="success.main">
                              {qualityComparison.enhancedMetrics.resolution}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Filstørrelse: </Typography>
                            <Typography variant="body2">{formatFileSize(qualityComparison.enhancedMetrics.fileSize)}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Skarphet: </Typography>
                            <Typography variant="body2" color="success.main">
                              {qualityComparison.enhancedMetrics.sharpness}%
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Støynivå:</Typography>
                            <Typography variant="body2" color="success.main">
                              {qualityComparison.enhancedMetrics.noise}%
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Fargebalanse: </Typography>
                            <Typography variant="body2" color="success.main">
                              {qualityComparison.enhancedMetrics.colorBalance}%
                            </Typography>
                          </Stack>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        Kvalitetsmetrikker
                      </Typography>
                      {qualityComparison && (
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {qualityComparison.enhancedMetrics.improvementScore}%
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Total forbedring
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                                28.5
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                PSNR Score
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                                0.92
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                SSIM Index
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <Paper sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                0.08
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                LPIPS Distance
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Paper sx={{ width: 30, borderRadius: 0, borderLeft: 1, borderColor: 'divider', p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Prosesseringsstatus
          </Typography>
          
          <Stack spacing={2}>
            {/* Current Queue */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Aktiv kø
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Prosesserer: </Typography>
                    <Chip size="small" label={enhancementJobs.filter((j: EnhancementJob) => j.status === 'processing').length} color="info" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">I kø:</Typography>
                    <Chip size="small" label={enhancementJobs.filter((j: EnhancementJob) => j.status === 'pending').length} color="warning" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Fullført: </Typography>
                    <Chip size="small" label={enhancementJobs.filter((j: EnhancementJob) => j.status === 'completed').length} color="success" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Systemressurser
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2">GPU-bruk: </Typography>
                    <LinearProgress variant="determinate" value={8} sx={{ mt:  1 }} />
                    <Typography variant="caption">78% (Real-ESRGAN)</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2">Minnebruk: </Typography>
                    <LinearProgress variant="determinate" value={5} sx={{ mt:  1 }} color="secondary" />
                    <Typography variant="caption">6.5GB / 10GB</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2">Prosesseringshastighet: </Typography>
                    <Typography variant="caption" color="success.main">2.3 bilder/min</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

	            {/* Quick Actions */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Hurtighandlinger
                </Typography>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('folder')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
	                    onClick={handleOpenOutputFolder}
                  >
                    Åpne utdatamappe
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('getApp')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
	                    onClick={handleDownloadAllCompleted}
	                    disabled={!hasCompletedJobs || downloadEnhancedMutation.isPending}
                  >
                    Last ned alle
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('delete')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
	                    onClick={handleCleanupTemporaryFiles}
	                    disabled={cleanupTemporaryFilesMutation.isPending}
                  >
                    Rydd opp midlertidige filer
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Paper>
      </Box>

      {/* Onboarding Dialog */}
      <Dialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Photo Enhancement Suite Onboarding</DialogTitle>
        <DialogContent>
          <Stepper activeStep={onboardingStep} orientation="vertical">
            <Step>
              <StepLabel>Connect or Create Project</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Link the enhancement suite to an existing project or create a new one to organize your enhanced photos.
                </Typography>

                {/* Recent Projects */}
                {recentProjects.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      Recent Projects
                    </Typography>
                    <Stack spacing={1}>
                      {recentProjects.map((project: any) => (
                        <Card
                          key={project.id}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                          onClick={() => {
                            // Use the project context to set the project
                            if (onProjectSelect) {
                              onProjectSelect(project);
                            }
                            setSnackbar({ open: true, message: 'Project connected successfully!', severity: 'success' });
                            setOnboardingStep((s) => s + 1);
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {project.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(project.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                            <Button size="small" variant="outlined">
                              Connect
                            </Button>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                )}

                {loadingProjects && (
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {effectiveProject && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setSnackbar({ open: true, message: 'Project connected successfully!', severity: 'success' });
                        setOnboardingStep((s) => s + 1);
                      }}
                    >
                      Connect Current Project
                    </Button>
                  )}
                  <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Skip</Button>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Preparing CreatorHub Features</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  We're getting everything ready so you can start enhancing photos right away. This will only take a moment.
                </Typography>

                {!workerInitStatus.inProgress && !workerInitStatus.completed && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={initializeWorkers}
                    sx={{ mb: 2 }}
                  >
                    Initialize AI Features
                  </Button>
                )}

                {workerInitStatus.inProgress && (
                  <Box>
                    <LinearProgress variant="determinate" value={workerInitStatus.progress} sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      {Object.entries(workerInitStatus.workers).slice(0, 6).map(([key, worker]: [string, any]) => (
                        <Grid item xs={12} sm={6} key={key}>
                          <Card>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
                              {worker.ready || worker.status === 'running' ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <CircularProgress size={16} />
                              )}
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {worker.friendlyName || key}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {worker.message || worker.description || 'Preparing...'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {workerInitStatus.completed && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    All AI features are ready! You can now enhance your photos with advanced AI models.
                  </Alert>
                )}

                {workerInitStatus.error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {workerInitStatus.error}
                  </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="contained" onClick={handleOnboardingComplete} disabled={workerInitStatus.inProgress}>
                    Finish
                  </Button>
                  {workerInitStatus.inProgress && (
                    <Button size="small" onClick={handleOnboardingComplete}>Skip</Button>
                  )}
                </Stack>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Avanserte innstillinger</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Automatisk kvalitetsoptimalisering"
            />
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="GPU-akselerasjon"
            />
	            <FormControlLabel
	              control={<Switch defaultChecked />}
	              label="Automatisk backup av originaler"
	            />
            <Box>
              <Typography gutterBottom>Maksimal batch-størrelse</Typography>
              <Slider
                defaultValue={10}
                min={1}
                max={50}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>Lagre</Button>
        </DialogActions>
      </Dialog>

      {/* Onboarding Dialog */}
      <Dialog open={onboardingOpen} onClose={() => setOnboardingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Photo Enhancement Suite Onboarding</DialogTitle>
        <DialogContent>
          <Stepper activeStep={onboardingStep} orientation="vertical">
            <Step>
              <StepLabel>Connect or Create Project</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Link the enhancement suite to an existing project or create a new one to organize your enhanced photos.
                </Typography>

                {/* Recent Projects */}
                {recentProjects.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      Recent Projects
                    </Typography>
                    <Stack spacing={1}>
                      {recentProjects.map((project: any) => (
                        <Card
                          key={project.id}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }}}
                          onClick={() => {
                            // Use the project context to set the project
                            if (onProjectSelect) {
                              onProjectSelect(project);
                            }
                            setSnackbar({ open: true, message: 'Project connected successfully!', severity: 'success' });
                            setOnboardingStep((s) => s + 1);
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {project.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(project.createdAt).toLocaleDateString()}
                              </Typography>
                            </Box>
                            <Button size="small" variant="outlined">
                              Connect
                            </Button>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                )}

                {loadingProjects && (
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <CircularProgress size={24} />
                  </Box>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {effectiveProject && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setSnackbar({ open: true, message: 'Project connected successfully!', severity: 'success' });
                        setOnboardingStep((s) => s + 1);
                      }}
                    >
                      Connect Current Project
                    </Button>
                  )}
                  <Button size="small" onClick={() => setOnboardingStep((s) => s + 1)}>Skip</Button>
                </Stack>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Preparing CreatorHub Features</StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  We're getting everything ready so you can start enhancing photos right away. This will only take a moment.
                </Typography>

                {!workerInitStatus.inProgress && !workerInitStatus.completed && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={initializeWorkers}
                    sx={{ mb: 2 }}
                  >
                    Initialize AI Features
                  </Button>
                )}

                {workerInitStatus.inProgress && (
                  <Box>
                    <LinearProgress variant="determinate" value={workerInitStatus.progress} sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                      {Object.entries(workerInitStatus.workers).slice(0, 6).map(([key, worker]: [string, any]) => (
                        <Grid item xs={12} sm={6} key={key}>
                          <Card>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
                              {worker.ready || worker.status === 'running' ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <CircularProgress size={16} />
                              )}
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {worker.friendlyName || key}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {worker.message || worker.description ||'Preparing...'}
                                </Typography>
                              </Box>
                            </Stack>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {workerInitStatus.completed && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    All AI features are ready! You can now enhance your photos with advanced AI models.
                  </Alert>
                )}

                {workerInitStatus.error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {workerInitStatus.error}
                  </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="contained" onClick={handleOnboardingComplete} disabled={workerInitStatus.inProgress}>
                    Finish
                  </Button>
                  {workerInitStatus.inProgress && (
                    <Button size="small" onClick={handleOnboardingComplete}>Skip</Button>
                  )}
                </Stack>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={currentUserId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default PhotoEnhancementSuite;