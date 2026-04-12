import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  AutoFixHigh as AutoFixHighIcon,
  CloudDone as CloudDoneIcon,
  CloudUpload as CloudUploadIcon,
  Compare as CompareIcon,
  Face as FaceIcon,
  Memory as MemoryIcon,
  Palette as PaletteIcon,
  Save as SaveIcon,
  Storage as StorageIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/queryClient';
import CompositionGuides, { GuideType } from '../../photo-enhancer/CompositionGuides';
import type { CompositionAnalysisResult } from '../../../services/composition-analysis';
import { compositionAnalyzer } from '../../../services/composition-analysis';
import EnhancementRatingDialog from '../../ai-training/EnhancementRatingDialog';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import { useDemoMode, useDemoModeData } from '../../../contexts/DemoModeContext';

type SupportedProfession = 'photographer' | 'videographer' | 'music_producer' | 'musicproducer' | 'vendor';
type ViewMode = 'single' | 'side-by-side' | 'slider';

interface CreatorHubPhotoEnhancerProps {
  profession?: SupportedProfession;
}

interface EnhancerProject {
  id: string;
  name: string;
}

interface EnhancementSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
}

interface PhotoEnhancerModelStatus {
  id: string;
  displayName?: string;
  modelType?: string;
  available?: boolean;
  reason?: string | null;
  r2Key?: string;
  recommendedFor?: string[];
}

interface PhotoEnhancerStatus {
  success?: boolean;
  models?: {
    gfpgan?: PhotoEnhancerModelStatus;
    registry?: PhotoEnhancerModelStatus[];
    faceApi?: { available?: boolean };
    imageHash?: { available?: boolean };
  };
  rawSupport?: {
    available?: boolean;
    supportedExtensions?: string[];
    rasterExtensions?: string[];
    converters?: Record<string, boolean>;
  };
  googleDrive?: {
    folderStructure?: Array<{ id: string; name: string; description?: string }>;
  };
  directUpload?: {
    enabled?: boolean;
    strategy?: string;
    maxBytes?: number;
    partSizeBytes?: number;
    maxPartUrlsPerRequest?: number;
    signedUrlTtlSeconds?: number;
    reason?: string | null;
    proxyUpload?: {
      enabled?: boolean;
      partSizeBytes?: number;
      maxPartBytes?: number;
      strategy?: string;
      reason?: string;
    };
    cors?: {
      requiresBrowserPut?: boolean;
      exposeHeaders?: string[];
      allowedMethods?: string[];
    };
  };
  improvements?: {
    total?: number;
    tracked?: Array<{ id: string; category: string; title: string; status: string }>;
  };
}

interface DirectUploadSource {
  storageType: 'r2';
  bucket: string;
  key: string;
  uploadId?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  etag?: string | null;
  lastModified?: string | null;
}

interface DirectUploadCache {
  fileSignature: string;
  source: DirectUploadSource;
}

interface DirectUploadProgress {
  active: boolean;
  phase: string;
  percent: number;
  detail?: string;
}

const PRESETS = [
  { id: 'auto', name: 'Auto Enhancer', description: 'Automatisk optimalisering', icon: <AutoFixHighIcon /> },
  { id: 'portrait', name: 'Portrait Pro', description: 'Ansiktsforbedring', icon: <FaceIcon /> },
  { id: 'landscape', name: 'Landscape Master', description: 'Landskap og natur', icon: <PaletteIcon /> },
  { id: 'studio', name: 'Studio Perfect', description: 'Studio og kommersiell', icon: <TuneIcon /> },
];

const DEFAULT_SETTINGS: EnhancementSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 75,
};

const RAW_UPLOAD_EXTENSIONS = [
  '.3fr',
  '.ari',
  '.arw',
  '.bay',
  '.braw',
  '.cr2',
  '.cr3',
  '.crw',
  '.dng',
  '.erf',
  '.fff',
  '.gpr',
  '.iiq',
  '.mef',
  '.mos',
  '.mrw',
  '.nef',
  '.nrw',
  '.orf',
  '.pef',
  '.raf',
  '.raw',
  '.rwl',
  '.rw2',
  '.sr2',
  '.srf',
  '.srw',
  '.x3f',
];

const PHOTO_UPLOAD_ACCEPT = [
  'image/*',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  ...RAW_UPLOAD_EXTENSIONS,
].join(',');

const DIRECT_UPLOAD_THRESHOLD_BYTES = 20 * 1024 * 1024;

function normalizeProfession(value: SupportedProfession | undefined): 'photographer' | 'videographer' | 'music_producer' | 'vendor' {
  if (value === 'photographer' || value === 'videographer' || value === 'vendor') return value;
  if (value === 'musicproducer' || value === 'music_producer') return 'music_producer';
  return 'photographer';
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toImageUrl(payload: unknown): string {
  const record = toRecord(payload);
  const candidates = [
    record.enhancedImageUrl,
    record.imageUrl,
    record.url,
    record.outputUrl,
    record.resultUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return '';
}

function toNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function formatBytes(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}

function getFileSignature(file: File): string {
  return [file.name, file.size, file.lastModified, file.type || 'application/octet-stream'].join(':');
}

function normalizeDirectUploadSource(value: unknown): DirectUploadSource {
  const source = toRecord(value);
  const bucket = typeof source.bucket === 'string' ? source.bucket : '';
  const key = typeof source.key === 'string' ? source.key : '';
  const fileName = typeof source.fileName === 'string' ? source.fileName : 'upload.raw';
  const mimeType = typeof source.mimeType === 'string' ? source.mimeType : 'application/octet-stream';
  const size = toNumber(source.size) || 0;
  if (!bucket || !key || !size) {
    throw new Error('Ugyldig R2-opplastingskilde fra server.');
  }
  return {
    storageType: 'r2',
    bucket,
    key,
    uploadId: typeof source.uploadId === 'string' ? source.uploadId : null,
    fileName,
    mimeType,
    size,
    etag: typeof source.etag === 'string' ? source.etag : null,
    lastModified: typeof source.lastModified === 'string' ? source.lastModified : null,
  };
}

function normalizeProjects(payload: unknown): EnhancerProject[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const record = toRecord(item);
      const id = typeof record.id === 'string' ? record.id : `project-${index}`;
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.title === 'string'
            ? record.title
            : `Project ${index + 1}`;
      return { id, name };
    })
    .filter((project) => project.id.length > 0);
}

const getFoldersForProfession = (profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor') => {
  if (profession === 'photographer') {
    return [
      { id: 'raw-footage', name: 'Raw Footage' },
      { id: 'edited-files', name: 'Edited Files' },
      { id: 'client-review', name: 'Client Review' },
      { id: 'final-delivery', name: 'Final Delivery' },
    ];
  }
  if (profession === 'videographer') {
    return [
      { id: 'raw-video', name: 'Raw Video' },
      { id: 'stills', name: 'Stills' },
      { id: 'review-cuts', name: 'Review Cuts' },
      { id: 'master-export', name: 'Master Export' },
    ];
  }
  if (profession === 'music_producer') {
    return [
      { id: 'cover-art', name: 'Cover Art' },
      { id: 'promo-assets', name: 'Promo Assets' },
      { id: 'social-exports', name: 'Social Exports' },
    ];
  }
  return [
    { id: 'assets', name: 'Assets' },
    { id: 'processed', name: 'Processed' },
  ];
};

export default function CreatorHubPhotoEnhancer({ profession: professionProp }: CreatorHubPhotoEnhancerProps) {
  const profession = normalizeProfession(professionProp);
  const { getProfessionConfig } = useDynamicProfessions();
  const { isDemoMode } = useDemoMode();

  const demoProjectsRaw = useDemoModeData<Record<string, unknown>>('projects', []);
  const demoProjects = useMemo(() => normalizeProjects(demoProjectsRaw), [demoProjectsRaw]);

  const [activePreset, setActivePreset] = useState('auto');
  const [settings, setSettings] = useState<EnhancementSettings>(DEFAULT_SETTINGS);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [enhancedImageUrl, setEnhancedImageUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [compareSlider, setCompareSlider] = useState(50);
  const [showCompositionGuides, setShowCompositionGuides] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [directUploadCache, setDirectUploadCache] = useState<DirectUploadCache | null>(null);
  const [directUploadProgress, setDirectUploadProgress] = useState<DirectUploadProgress | null>(null);

  const professionConfig = getProfessionConfig(profession);
  const accentColor = professionConfig?.iconColor || '#ff8c00';

  const statusQuery = useQuery<PhotoEnhancerStatus>({
    queryKey: ['creatorhub-photo-enhancer-status'],
    queryFn: async () => apiRequest('/api/photo-enhancer/status'),
    staleTime: 60_000,
    retry: 1,
  });

  const modelRegistry = statusQuery.data?.models?.registry || [];
  const availableModels = modelRegistry.filter((model) => model.available).length;
  const rawConverters = statusQuery.data?.rawSupport?.converters || {};
  const directUploadConfig = statusQuery.data?.directUpload;
  const directUploadEnabled = Boolean(directUploadConfig?.enabled);
  const directUploadMaxBytes = directUploadConfig?.maxBytes || 0;

  const folders = useMemo(() => {
    const driveStructure = statusQuery.data?.googleDrive?.folderStructure || [];
    if (driveStructure.length > 0) {
      return driveStructure.map((folder) => ({
        id: folder.id,
        name: folder.name,
        description: folder.description,
      }));
    }
    return getFoldersForProfession(profession);
  }, [profession, statusQuery.data?.googleDrive?.folderStructure]);

  const projectsQuery = useQuery<EnhancerProject[]>({
    queryKey: ['creatorhub-photo-enhancer-projects', profession],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?profession=${profession}`);
      return normalizeProjects(response);
    },
    enabled: !isDemoMode,
    retry: 1,
    staleTime: 30_000,
  });

  const projects = isDemoMode ? demoProjects : projectsQuery.data || [];

  useEffect(() => {
    if (!selectedFolderId && folders[0]?.id) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);

  useEffect(() => {
    return () => {
      if (originalImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
  }, [originalImageUrl]);

  const shouldUseDirectUpload = useCallback((file: File) => {
    if (!directUploadEnabled) return false;
    if (directUploadMaxBytes > 0 && file.size > directUploadMaxBytes) {
      return true;
    }
    return file.size >= DIRECT_UPLOAD_THRESHOLD_BYTES;
  }, [directUploadEnabled, directUploadMaxBytes]);

  const uploadFileDirectlyToR2 = useCallback(async (file: File): Promise<DirectUploadSource> => {
    if (!directUploadEnabled) {
      throw new Error(directUploadConfig?.reason || 'Direkte R2-opplasting er ikke konfigurert.');
    }
    if (directUploadMaxBytes > 0 && file.size > directUploadMaxBytes) {
      throw new Error(`Filen er større enn storfilgrensen på ${formatBytes(directUploadMaxBytes)}.`);
    }

    let uploadRef: { bucket: string; key: string; uploadId: string } | null = null;
    try {
      const useServerProxyUpload = Boolean(directUploadConfig?.proxyUpload?.enabled);
      setDirectUploadProgress({
        active: true,
        phase: 'Starter sikker storfil-opplasting',
        percent: 0,
        detail: `${file.name} · ${formatBytes(file.size)}${useServerProxyUpload ? ' · server-assistert R2' : ''}`,
      });
      const createResponse = await apiRequest('/api/photo-enhancer/uploads/multipart', {
        method: 'POST',
        body: {
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          projectId: selectedProjectId || undefined,
          preferredPartSizeBytes: useServerProxyUpload ? directUploadConfig?.proxyUpload?.partSizeBytes : undefined,
        },
      });
      const upload = toRecord(toRecord(createResponse).upload);
      const bucket = typeof upload.bucket === 'string' ? upload.bucket : '';
      const key = typeof upload.key === 'string' ? upload.key : '';
      const uploadId = typeof upload.uploadId === 'string' ? upload.uploadId : '';
      const partSize = toNumber(upload.partSize) || directUploadConfig?.partSizeBytes || 32 * 1024 * 1024;
      const partCount = toNumber(upload.partCount) || Math.ceil(file.size / partSize);
      const maxPartUrlsPerRequest = Math.max(1, toNumber(upload.maxPartUrlsPerRequest) || directUploadConfig?.maxPartUrlsPerRequest || 32);

      if (!bucket || !key || !uploadId || !partSize || !partCount) {
        throw new Error('Serveren returnerte ikke en komplett R2 multipart-opplasting.');
      }

      uploadRef = { bucket, key, uploadId };
      const completedParts: Array<{ partNumber: number; etag: string }> = [];
      let uploadedBytes = 0;

      if (useServerProxyUpload) {
        for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(file.size, start + partSize);
          const chunk = file.slice(start, end);
          setDirectUploadProgress({
            active: true,
            phase: 'Laster opp trygt i deler',
            percent: Math.max(1, Math.round((uploadedBytes / file.size) * 100)),
            detail: `Del ${partNumber}/${partCount} via backend til R2 · ${formatBytes(uploadedBytes)} av ${formatBytes(file.size)}`,
          });

          const formData = new FormData();
          formData.append('bucket', bucket);
          formData.append('key', key);
          formData.append('uploadId', uploadId);
          formData.append('partNumber', String(partNumber));
          formData.append('part', chunk, `${file.name}.part-${partNumber}`);
          const proxyResponse = await apiRequest('/api/photo-enhancer/uploads/multipart/proxy-part', {
            method: 'POST',
            body: formData,
          });
          const proxyPart = toRecord(toRecord(proxyResponse).part);
          const etag = typeof proxyPart.etag === 'string' ? proxyPart.etag : '';
          if (!etag) {
            throw new Error(`Server-assistert R2-opplasting manglet ETag for del ${partNumber}.`);
          }

          uploadedBytes += chunk.size;
          completedParts.push({ partNumber, etag });
          setDirectUploadProgress({
            active: true,
            phase: 'Laster opp trygt i deler',
            percent: Math.min(99, Math.round((uploadedBytes / file.size) * 100)),
            detail: `Del ${partNumber}/${partCount} ferdig · ${formatBytes(uploadedBytes)} av ${formatBytes(file.size)}`,
          });
        }
      } else {
        for (let firstPart = 1; firstPart <= partCount; firstPart += maxPartUrlsPerRequest) {
          const partNumbers = Array.from(
            { length: Math.min(maxPartUrlsPerRequest, partCount - firstPart + 1) },
            (_, index) => firstPart + index,
          );
          const partsResponse = await apiRequest('/api/photo-enhancer/uploads/multipart/parts', {
            method: 'POST',
            body: {
              bucket,
              key,
              uploadId,
              partNumbers,
            },
          });
          const signedParts = Array.isArray(toRecord(partsResponse).parts) ? toRecord(partsResponse).parts as unknown[] : [];

          for (const signedPart of signedParts) {
            const part = toRecord(signedPart);
            const partNumber = toNumber(part.partNumber);
            const url = typeof part.url === 'string' ? part.url : '';
            if (!partNumber || !url) {
              throw new Error('Serveren returnerte en ugyldig signert R2-del.');
            }

            const start = (partNumber - 1) * partSize;
            const end = Math.min(file.size, start + partSize);
            const chunk = file.slice(start, end);
            setDirectUploadProgress({
              active: true,
              phase: 'Laster opp direkte til R2',
              percent: Math.max(1, Math.round((uploadedBytes / file.size) * 100)),
              detail: `Del ${partNumber}/${partCount} · ${formatBytes(uploadedBytes)} av ${formatBytes(file.size)}`,
            });

            const response = await fetch(url, {
              method: 'PUT',
              body: chunk,
            });
            if (!response.ok) {
              throw new Error(`R2-opplasting feilet på del ${partNumber} (${response.status}).`);
            }
            const etag = response.headers.get('ETag') || response.headers.get('etag');
            if (!etag) {
              throw new Error('R2-opplastingen mangler ETag-header. Cloudflare R2 CORS må eksponere ETag for nettleseropplasting.');
            }

            uploadedBytes += chunk.size;
            completedParts.push({ partNumber, etag });
            setDirectUploadProgress({
              active: true,
              phase: 'Laster opp direkte til R2',
              percent: Math.min(99, Math.round((uploadedBytes / file.size) * 100)),
              detail: `Del ${partNumber}/${partCount} ferdig · ${formatBytes(uploadedBytes)} av ${formatBytes(file.size)}`,
            });
          }
        }
      }

      setDirectUploadProgress({
        active: true,
        phase: 'Fullfører R2-opplasting',
        percent: 99,
        detail: 'Setter sammen delene og låser kilden for analyse.',
      });
      const completeResponse = await apiRequest('/api/photo-enhancer/uploads/multipart/complete', {
        method: 'POST',
        body: {
          bucket,
          key,
          uploadId,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          parts: completedParts.sort((left, right) => left.partNumber - right.partNumber),
        },
      });
      const source = normalizeDirectUploadSource(toRecord(completeResponse).source);
      setDirectUploadProgress({
        active: true,
        phase: 'Storfil lagret i R2',
        percent: 100,
        detail: 'Klar for serveranalyse uten stor request mot Render.',
      });
      return source;
    } catch (error) {
      if (uploadRef) {
        await apiRequest('/api/photo-enhancer/uploads/multipart/abort', {
          method: 'POST',
          body: uploadRef,
        }).catch(() => undefined);
      }
      setDirectUploadProgress(null);
      throw error;
    }
  }, [
    directUploadConfig?.maxPartUrlsPerRequest,
    directUploadConfig?.partSizeBytes,
    directUploadConfig?.proxyUpload?.enabled,
    directUploadConfig?.proxyUpload?.partSizeBytes,
    directUploadConfig?.reason,
    directUploadEnabled,
    directUploadMaxBytes,
    selectedProjectId,
  ]);

  const getDirectUploadSource = useCallback(async (file: File): Promise<DirectUploadSource> => {
    const fileSignature = getFileSignature(file);
    if (directUploadCache?.fileSignature === fileSignature) {
      return directUploadCache.source;
    }
    const source = await uploadFileDirectlyToR2(file);
    setDirectUploadCache({ fileSignature, source });
    return source;
  }, [directUploadCache, uploadFileDirectlyToR2]);

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      if (shouldUseDirectUpload(file)) {
        const source = await getDirectUploadSource(file);
        setDirectUploadProgress({
          active: true,
          phase: 'Analyserer fra R2',
          percent: 100,
          detail: 'Serveren henter objektet internt fra R2.',
        });
        return apiRequest('/api/photo-enhancer/analyze-r2', {
          method: 'POST',
          body: {
            source,
            preset: activePreset,
          },
        });
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', activePreset);
      return apiRequest('/api/photo-enhancer/analyze', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const record = toRecord(response);
      setAnalysisResult(record);
      setDirectUploadProgress((previous) => previous?.active ? { ...previous, phase: 'Analyse fullført', percent: 100 } : previous);
    },
  });

  const enhanceMutation = useMutation({
    mutationFn: async (file: File) => {
      if (shouldUseDirectUpload(file)) {
        const source = await getDirectUploadSource(file);
        setDirectUploadProgress({
          active: true,
          phase: 'Forbedrer fra R2',
          percent: 100,
          detail: 'Serveren bruker R2-kilden, ikke en stor nettleser-til-Render request.',
        });
        return apiRequest('/api/photo-enhancer/enhance-r2', {
          method: 'POST',
          body: {
            source,
            preset: activePreset,
            settings,
          },
        });
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', activePreset);
      formData.append('settings', JSON.stringify(settings));

      return apiRequest('/api/photo-enhancer/enhance', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const imageUrl = toImageUrl(response);
      if (imageUrl) {
        setEnhancedImageUrl(imageUrl);
        setViewMode('side-by-side');
      }
      setDirectUploadProgress((previous) => previous?.active ? { ...previous, phase: 'Forbedring fullført', percent: 100 } : previous);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/photo-enhancer/save', {
        method: 'POST',
        body: {
          projectId: selectedProjectId,
          folderId: selectedFolderId,
          originalImageUrl,
          enhancedImageUrl,
          preset: activePreset,
          settings,
        },
      });
    },
    onSuccess: () => {
      setSaveDialogOpen(false);
    },
  });

  const onImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (originalImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(originalImageUrl);
    }

    setUploadedImage(file);
    setOriginalImageUrl(URL.createObjectURL(file));
    setEnhancedImageUrl('');
    setAnalysisResult(null);
    setCompositionAnalysis(null);
    setDirectUploadCache(null);
    setDirectUploadProgress(null);
    setViewMode('single');
    setCompareSlider(50);
  };

  const runAnalysis = async () => {
    if (!uploadedImage) return;
    await analyzeMutation.mutateAsync(uploadedImage);
  };

  const runEnhancement = async () => {
    if (!uploadedImage) return;
    await enhanceMutation.mutateAsync(uploadedImage);
  };

  const onImageLoaded = async (image: HTMLImageElement) => {
    if (!image.complete) return;

    const guides = new Set<GuideType>([
      GuideType.RULE_OF_THIRDS,
      GuideType.GOLDEN_RATIO,
      GuideType.SAFE_ZONES,
      GuideType.CENTER_POINT,
    ]);

    try {
      const analysis = await compositionAnalyzer.analyzeImage(image, guides);
      setCompositionAnalysis(analysis);
    } catch {
      setCompositionAnalysis(null);
    }
  };

  const handleSubmitRating = async (rating: number, feedback: string): Promise<void> => {
    await apiRequest('/api/ai-training/enhancement-rating', {
      method: 'POST',
      body: {
        enhancementType: 'photo',
        rating,
        feedback,
        preset: activePreset,
      },
    });
    setShowRatingDialog(false);
  };

  const canSave = Boolean(enhancedImageUrl && selectedProjectId && selectedFolderId);
  const selectedIsLargeUpload = Boolean(uploadedImage && uploadedImage.size >= DIRECT_UPLOAD_THRESHOLD_BYTES);
  const selectedUsesDirectUpload = uploadedImage ? shouldUseDirectUpload(uploadedImage) : false;

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  CreatorHub Photo Enhancer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI-enhancement for {profession.replace('_', ' ')} workflows.
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderColor: `${accentColor}33`,
                    bgcolor: `${accentColor}0d`,
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip
                        size="small"
                        icon={<StorageIcon />}
                        label={`${availableModels}/${modelRegistry.length || 0} R2-modeller`}
                        color={availableModels > 0 ? 'success' : 'warning'}
                      />
                      <Chip
                        size="small"
                        icon={<FaceIcon />}
                        label={statusQuery.data?.models?.faceApi?.available ? 'face-api aktiv' : 'face-api sjekkes'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<MemoryIcon />}
                        label={statusQuery.data?.models?.imageHash?.available ? 'image-hash aktiv' : 'hash fallback'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        icon={<CloudUploadIcon />}
                        label={directUploadEnabled ? 'R2 storfil aktiv' : 'R2 storfil av'}
                        color={directUploadEnabled ? 'success' : 'default'}
                        variant={directUploadEnabled ? 'filled' : 'outlined'}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      RAW-støtte: {statusQuery.data?.rawSupport?.available ? 'aktiv' : 'krever konverter på server'} ·
                      {' '}Konvertere: {Object.entries(rawConverters).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || 'ingen funnet'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Drive-struktur: {folders.length} mapper · Storfilgrense: {directUploadMaxBytes ? formatBytes(directUploadMaxBytes) : 'ikke konfigurert'}
                    </Typography>
                  </Stack>
                </Paper>

                <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
                  Last opp bilde
                  <input hidden accept={PHOTO_UPLOAD_ACCEPT} type="file" onChange={onImageUpload} />
                </Button>

                {uploadedImage ? <Chip label={uploadedImage.name} size="small" /> : null}

                {uploadedImage && selectedIsLargeUpload ? (
                  <Alert severity={selectedUsesDirectUpload ? 'info' : 'warning'}>
                    {selectedUsesDirectUpload
                      ? `Stor fil oppdaget (${formatBytes(uploadedImage.size)}). Den lastes direkte til R2 i deler før analyse/forbedring.`
                      : `Filen er stor (${formatBytes(uploadedImage.size)}), men R2 storfil-opplasting er ikke aktiv på backend.`}
                  </Alert>
                ) : null}

                <FormControl fullWidth size="small">
                  <InputLabel id="enhancer-preset-label">Preset</InputLabel>
                  <Select
                    labelId="enhancer-preset-label"
                    label="Preset"
                    value={activePreset}
                    onChange={(event) => setActivePreset(event.target.value)}
                  >
                    {PRESETS.map((preset) => (
                      <MenuItem key={preset.id} value={preset.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {preset.icon}
                          <Box>
                            <Typography variant="body2">{preset.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{preset.description}</Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider />

                <Typography variant="subtitle2">Settings</Typography>
                {[
                  { key: 'brightness', label: 'Brightness' },
                  { key: 'contrast', label: 'Contrast' },
                  { key: 'saturation', label: 'Saturation' },
                  { key: 'sharpness', label: 'Sharpness' },
                  { key: 'denoising', label: 'Denoising' },
                  { key: 'faceEnhancement', label: 'Face Enhancement' },
                ].map((slider) => {
                  const key = slider.key as keyof EnhancementSettings;
                  return (
                    <Box key={slider.key}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{slider.label}</Typography>
                        <Typography variant="caption">{settings[key]}</Typography>
                      </Stack>
                      <Slider
                        value={settings[key]}
                        min={slider.key === 'brightness' || slider.key === 'contrast' || slider.key === 'saturation' || slider.key === 'sharpness' ? -100 : 0}
                        max={100}
                        onChange={(_, value) => {
                          const numericValue = Array.isArray(value) ? value[0] : value;
                          setSettings((previous) => ({ ...previous, [key]: numericValue }));
                        }}
                      />
                    </Box>
                  );
                })}

                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => void runAnalysis()} disabled={!uploadedImage || analyzeMutation.isPending}>
                    Analyze
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void runEnhancement()}
                    disabled={!uploadedImage || enhanceMutation.isPending}
                    startIcon={<AutoFixHighIcon />}
                  >
                    Enhance
                  </Button>
                </Stack>

                {directUploadProgress?.active ? (
                  <Box>
                    <LinearProgress variant="determinate" value={directUploadProgress.percent} />
                    <Typography variant="caption" color="text.secondary">
                      {directUploadProgress.phase}
                      {directUploadProgress.detail ? ` · ${directUploadProgress.detail}` : ''}
                    </Typography>
                  </Box>
                ) : analyzeMutation.isPending || enhanceMutation.isPending ? (
                  <Box>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">
                      Prosesserer bilde...
                    </Typography>
                  </Box>
                ) : null}

                {analyzeMutation.isError ? (
                  <Alert severity="error">
                    {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : 'Analyse feilet.'}
                  </Alert>
                ) : null}

                {enhanceMutation.isError ? (
                  <Alert severity="error">
                    {enhanceMutation.error instanceof Error ? enhanceMutation.error.message : 'Forbedring feilet.'}
                  </Alert>
                ) : null}

                {analysisResult ? (
                  <Alert severity="success" icon={<AssessmentIcon />}>
                    Analyse fullført
                    {toRecord(analysisResult.analysis).perceptualHash ? ' · hash klar' : ''}
                    {toRecord(analysisResult.analysis).format ? ` · ${String(toRecord(analysisResult.analysis).format).toUpperCase()}` : ''}
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant={viewMode === 'single' ? 'contained' : 'outlined'} onClick={() => setViewMode('single')}>
                    Single
                  </Button>
                  <Button
                    size="small"
                    variant={viewMode === 'side-by-side' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('side-by-side')}
                    disabled={!enhancedImageUrl}
                    startIcon={<CompareIcon />}
                  >
                    Side-by-side
                  </Button>
                  <Button
                    size="small"
                    variant={viewMode === 'slider' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('slider')}
                    disabled={!enhancedImageUrl}
                  >
                    Slider
                  </Button>
                </Stack>

                <FormControlLabelSwitch
                  label="Composition guides"
                  checked={showCompositionGuides}
                  onChange={(checked) => setShowCompositionGuides(checked)}
                />
              </Stack>

              {!originalImageUrl ? (
                <Alert severity="info">Last opp et bilde for forhåndsvisning.</Alert>
              ) : (
                <Box sx={{ position: 'relative', minHeight: 420, border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                  {viewMode === 'single' && (
                    <ImagePreview
                      src={enhancedImageUrl || originalImageUrl}
                      alt={enhancedImageUrl ? 'Enhanced' : 'Original'}
                      onLoad={onImageLoaded}
                      showCompositionGuides={showCompositionGuides}
                      compositionAnalysis={compositionAnalysis}
                    />
                  )}

                  {viewMode === 'side-by-side' && enhancedImageUrl && (
                    <Grid container sx={{ height: 420 }}>
                      <Grid item xs={6} sx={{ borderRight: '1px solid #e5e7eb' }}>
                        <ImagePreview
                          src={originalImageUrl}
                          alt="Original"
                          onLoad={onImageLoaded}
                          showCompositionGuides={showCompositionGuides}
                          compositionAnalysis={compositionAnalysis}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <ImagePreview
                          src={enhancedImageUrl}
                          alt="Enhanced"
                          onLoad={onImageLoaded}
                          showCompositionGuides={showCompositionGuides}
                          compositionAnalysis={compositionAnalysis}
                        />
                      </Grid>
                    </Grid>
                  )}

                  {viewMode === 'slider' && enhancedImageUrl && (
                    <Box sx={{ position: 'relative', height: 420 }}>
                      <img
                        src={originalImageUrl}
                        alt="Original"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <img
                        src={enhancedImageUrl}
                        alt="Enhanced"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          clipPath: `inset(0 ${100 - compareSlider}% 0 0)`,
                        }}
                      />
                      <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
                        <Slider value={compareSlider} onChange={(_, value) => setCompareSlider(Array.isArray(value) ? value[0] : value)} />
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {compositionAnalysis ? (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  Komposisjon score: {Math.round(compositionAnalysis.overall_score)} · Rule of Thirds: {Math.round(compositionAnalysis.rule_of_thirds_score)}
                </Alert>
              ) : null}

              <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <StorageIcon fontSize="small" sx={{ color: accentColor }} />
                      <Typography variant="subtitle2">Modellpipeline</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {modelRegistry.slice(0, 8).map((model) => (
                        <Chip
                          key={model.id}
                          size="small"
                          label={model.displayName || model.id}
                          color={model.available ? 'success' : 'default'}
                          variant={model.available ? 'filled' : 'outlined'}
                        />
                      ))}
                      {modelRegistry.length > 8 ? (
                        <Chip size="small" label={`+${modelRegistry.length - 8}`} variant="outlined" />
                      ) : null}
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <CloudDoneIcon fontSize="small" sx={{ color: accentColor }} />
                      <Typography variant="subtitle2">Google Drive-mapper</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {folders.slice(0, 6).map((folder) => (
                        <Chip key={folder.id} size="small" label={folder.name} variant="outlined" />
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!enhancedImageUrl}
                >
                  Save to project
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => setShowRatingDialog(true)}
                  disabled={!enhancedImageUrl}
                >
                  Rate enhancement
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Enhanced Image</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {projectsQuery.isError && !isDemoMode ? (
              <Alert severity="warning">Kunne ikke hente prosjekter. Bruk demo-prosjekter eller prøv igjen.</Alert>
            ) : null}

            <FormControl fullWidth size="small">
              <InputLabel id="save-project-label">Project</InputLabel>
              <Select
                labelId="save-project-label"
                label="Project"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="save-folder-label">Folder</InputLabel>
              <Select
                labelId="save-folder-label"
                label="Folder"
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
              >
                {folders.map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            startIcon={<SaveIcon />}
            sx={{ backgroundColor: accentColor }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <EnhancementRatingDialog
        open={showRatingDialog}
        onClose={() => setShowRatingDialog(false)}
        enhancementType="photo"
        originalUrl={originalImageUrl}
        enhancedUrl={enhancedImageUrl}
        onSubmitRating={handleSubmitRating}
        title="Vurder bildeforbedringen"
        description="Tilbakemeldingen brukes til å forbedre AI-modellene i CreatorHub." 
      />
    </Box>
  );
}

function FormControlLabelSwitch(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2">{label}</Typography>
      <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </Stack>
  );
}

function ImagePreview(props: {
  src: string;
  alt: string;
  onLoad: (image: HTMLImageElement) => Promise<void>;
  showCompositionGuides: boolean;
  compositionAnalysis: CompositionAnalysisResult | null;
}) {
  const { src, alt, onLoad, showCompositionGuides, compositionAnalysis } = props;
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImageElement(null);
  }, [src]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        ref={(node) => {
          if (!node) return;
          if (imageElement === node) return;
          setImageElement(node);
          if (node.complete) {
            void onLoad(node);
          } else {
            node.onload = () => {
              void onLoad(node);
            };
          }
        }}
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {showCompositionGuides && imageElement ? (
        <CompositionGuides imageElement={imageElement} analysisResult={compositionAnalysis} />
      ) : null}
    </Box>
  );
}
