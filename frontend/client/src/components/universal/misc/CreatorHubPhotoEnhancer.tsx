import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Popover,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AddPhotoAlternate as AddPhotoIcon,
  Assessment as AssessmentIcon,
  AutoFixHigh as AutoFixHighIcon,
  BookmarkAdd as BookmarkAddIcon,
  CloudDone as CloudDoneIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpIcon,
  RestartAlt as RestartAltIcon,
  CloudUpload as CloudUploadIcon,
  Compare as CompareIcon,
  Face as FaceIcon,
  Memory as MemoryIcon,
  Palette as PaletteIcon,
  Save as SaveIcon,
  Storage as StorageIcon,
  Tune as TuneIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, apiFetch } from '../../../lib/queryClient';
import CompositionGuides, { GuideType } from '../../photo-enhancer/CompositionGuides';
import { RealtimePreviewCanvas } from '../../photo-enhancer/RealtimePreviewCanvas';
import { Filmstrip } from '../../photo-enhancer/Filmstrip';
import { EditClipboardBar } from '../../photo-enhancer/EditClipboardBar';
import { ExportPresetDialog } from '../../photo-enhancer/ExportPresetDialog';
import { useEnhancerShortcuts } from '../../photo-enhancer/useEnhancerShortcuts';
import { HSLColorPanel } from '../../photo-enhancer/HSLColorPanel';
import { LUTPanel, type LutRegistryEntry } from '../../photo-enhancer/LUTPanel';
import { useLutPreview } from '../../photo-enhancer/useLutPreview';
import { useLutThumbnails } from '../../photo-enhancer/useLutThumbnails';
import { useImagePixelSampler } from '../../photo-enhancer/useImagePixelSampler';
import { CullView } from '../../photo-enhancer/CullView';
import { FaceChipStrip, computeFocusTransform } from '../../photo-enhancer/FaceChipStrip';
import { useFaceDetectionLoader } from '../../photo-enhancer/useFaceDetectionLoader';
import { FrequencySepDialog } from '../../photo-enhancer/FrequencySepDialog';
import { ObjectRemovalEditor } from '../../photo-enhancer/ObjectRemovalEditor';
import { AutoDistractionDetector } from '../../photo-enhancer/AutoDistractionDetector';
import type { InpaintRecipe } from '../../../lib/enhancer-session/module-contract';
import { ClientActivityBanner } from '../../photo-enhancer/ClientActivityBanner';
import type { DetectedFace } from '../../../lib/enhancer-session/types';
import type { SampledPixel } from '../../../lib/enhancer-session/hsl-band-math';
import type { CompositionAnalysisResult } from '../../../services/composition-analysis';
import { compositionAnalyzer } from '../../../services/composition-analysis';
import EnhancementRatingDialog from '../../ai-training/EnhancementRatingDialog';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import { useDemoMode, useDemoModeData } from '../../../contexts/DemoModeContext';
import { useEnhancerSession } from '../../../lib/enhancer-session/use-enhancer-session';
import { serializePerFaceOverrides } from '../../../lib/enhancer-session/session-reducer';
import { loadLooks, saveLook, deleteLook, type SavedLook } from '../../../lib/enhancer-session/enhancer-looks';
import type {
  EditModuleKey,
  EnhancementSettings as EnhancementSettingsContract,
  IntensityProfile,
  LensCorrectionSettings,
  SubjectKind,
} from '../../../lib/enhancer-session/module-contract';
import {
  DEFAULT_LENS_CORRECTION,
  DEFAULT_SETTINGS,
  INTENSITY_PROFILES,
  SUBJECT_KINDS,
} from '../../../lib/enhancer-session/module-contract';
import type { ExportPreset, StarRating } from '../../../lib/enhancer-session/types';
import SmartFlytCullingPanel from '../../enhancement/SmartFlytCullingPanel';

type SupportedProfession = 'photographer' | 'videographer' | 'music_producer' | 'musicproducer' | 'vendor';
type ViewMode = 'single' | 'side-by-side' | 'slider';

interface CreatorHubPhotoEnhancerProps {
  profession?: SupportedProfession;
}

interface EnhancerProject {
  id: string;
  name: string;
}

// EnhancementSettings / IntensityProfile / SubjectKind / DEFAULT_SETTINGS
// live in the shared contract module so the session state + the React
// component agree on a single shape. Do NOT re-declare them locally.
type EnhancementSettings = EnhancementSettingsContract;

const SUBJECT_LABELS: Record<SubjectKind, string> = {
  '':               'Auto (ingen kategori-look)',
  portrait:         'Portrett',
  group_portrait:   'Gruppe-portrett',
  food:             'Mat',
  landscape:        'Landskap',
  product:          'Produkt',
  vehicle:          'Kjøretøy',
  aviation:         'Fly',
  other:            'Annet',
};

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
  queue?: {
    paused?: boolean;
    counts?: Record<string, number>;
    concurrency?: { global?: number; perUser?: number; perProject?: number };
    memory?: { freeMb?: number; minFreeMb?: number; canStart?: boolean; policy?: string };
    capabilities?: string[];
  };
  processingOptions?: {
    modelPreference?: string[];
    executionNote?: string;
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

interface PhotoEnhancerJob {
  id: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  priority?: number;
  projectId?: string;
  owner?: string;
  failureReason?: string | null;
  result?: Record<string, unknown> | null;
  artifacts?: Array<{ id: string; type: string; mimeType?: string | null; size?: number | null; url?: string | null; checksum?: string | null }>;
  timeline?: Array<{ id: string; timestamp: string; type: string; message: string; details?: Record<string, unknown> }>;
  outputManifest?: Record<string, unknown> | null;
  checksum?: string | null;
  attempts?: number;
  maxAttempts?: number;
  updatedAt?: string;
}

const PRESETS = [
  { id: 'auto', name: 'Auto Enhancer', description: 'Automatisk optimalisering', icon: <AutoFixHighIcon /> },
  { id: 'portrait', name: 'Portrait Pro', description: 'Ansiktsforbedring', icon: <FaceIcon /> },
  { id: 'landscape', name: 'Landscape Master', description: 'Landskap og natur', icon: <PaletteIcon /> },
  { id: 'studio', name: 'Studio Perfect', description: 'Studio og kommersiell', icon: <TuneIcon /> },
];

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

// Formats the browser cannot decode itself (every camera RAW + HEIC/HEIF +
// TIFF). For these we fetch a server-rasterised JPEG to display and to feed
// the AI / face endpoints; the original file still goes to /enhance.
const BROWSER_UNDECODABLE_EXTENSIONS = [...RAW_UPLOAD_EXTENSIONS, '.heic', '.heif', '.tif', '.tiff'];

function needsRasterPreview(file: File): boolean {
  const name = (file.name || '').toLowerCase();
  return BROWSER_UNDECODABLE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

const clampPct = (n: number): number => Math.max(-100, Math.min(100, n));

// One-click A/B/C exploration: render the current recipe three ways so the
// photographer can pick a direction instead of dialling sliders blind.
const ENHANCE_VARIANTS: Array<{
  key: string;
  label: string;
  tweak: (settings: EnhancementSettings) => EnhancementSettings;
}> = [
  { key: 'natural', label: 'Naturlig', tweak: (settings) => settings },
  {
    key: 'vivid',
    label: 'Livlig',
    tweak: (settings) => ({
      ...settings,
      saturation: clampPct(settings.saturation + 30),
      contrast: clampPct(settings.contrast + 15),
      sharpness: clampPct(settings.sharpness + 10),
    }),
  },
  {
    key: 'bw',
    label: 'Sort-hvitt',
    tweak: (settings) => ({
      ...settings,
      saturation: -100,
      contrast: clampPct(settings.contrast + 10),
    }),
  },
];

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

function normalizePhotoEnhancerJob(value: unknown): PhotoEnhancerJob | null {
  const record = toRecord(value);
  const id = typeof record.id === 'string' ? record.id : '';
  const status = typeof record.status === 'string' ? record.status : '';
  if (!id || !['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'].includes(status)) return null;
  return {
    id,
    status: status as PhotoEnhancerJob['status'],
    progress: toNumber(record.progress) ?? 0,
    priority: toNumber(record.priority) ?? undefined,
    projectId: typeof record.projectId === 'string' ? record.projectId : undefined,
    owner: typeof record.owner === 'string' ? record.owner : undefined,
    failureReason: typeof record.failureReason === 'string' ? record.failureReason : null,
    result: record.result && typeof record.result === 'object' ? (record.result as Record<string, unknown>) : null,
    artifacts: Array.isArray(record.artifacts) ? (record.artifacts as PhotoEnhancerJob['artifacts']) : [],
    timeline: Array.isArray(record.timeline) ? (record.timeline as PhotoEnhancerJob['timeline']) : [],
    outputManifest: record.outputManifest && typeof record.outputManifest === 'object'
      ? (record.outputManifest as Record<string, unknown>)
      : null,
    checksum: typeof record.checksum === 'string' ? record.checksum : null,
    attempts: toNumber(record.attempts) ?? undefined,
    maxAttempts: toNumber(record.maxAttempts) ?? undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

// Photographers shouldn't need to know that "GFPGAN" restores faces or that
// "Real-ESRGAN" upscales. We surface plain-language descriptions of what each
// model *does* while the underlying value sent to the backend stays the
// technical id (so the pipeline is unchanged).
const MODEL_PLAIN_LABELS: Record<string, string> = {
  auto: 'Automatisk (anbefalt)',
  sharp: 'Bare skarphet',
  gfpgan: 'Ansiktsforbedring (naturlig)',
  codeformer: 'Ansiktsrekonstruksjon (kraftig)',
  realesrgan: 'Oppskalering – mer oppløsning',
  swinir: 'Støyfjerning',
  bsrgan: 'Detalj-gjenoppretting',
  diffbir: 'AI-rekonstruksjon (sterkest)',
};

function plainModelLabel(idOrName: string): string {
  const key = idOrName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [id, label] of Object.entries(MODEL_PLAIN_LABELS)) {
    if (key.includes(id)) return label;
  }
  return idOrName;
}

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
  const [frequencySepOpen, setFrequencySepOpen] = useState(false);
  const [objectRemovalOpen, setObjectRemovalOpen] = useState(false);
  const [autoDetectorOpen, setAutoDetectorOpen] = useState(false);
  /** Pulled from `?projectId=...` URL param at mount. When present, the
   *  ClientActivityBanner surfaces recent hearts/comments from the bakery /
   *  client. Null = hide the banner entirely. */
  const [projectIdFromUrl, setProjectIdFromUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [compareSlider, setCompareSlider] = useState(50);
  const [showCompositionGuides, setShowCompositionGuides] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [shortcutsAnchor, setShortcutsAnchor] = useState<HTMLElement | null>(null);
  const [looks, setLooks] = useState<SavedLook[]>(() => loadLooks());
  const [saveLookDialogOpen, setSaveLookDialogOpen] = useState(false);
  const [lookName, setLookName] = useState('');
  // For RAW/HEIC uploads: the server-rasterised JPEG used for display + AI
  // (the original RAW stays in `uploadedImage` for full-quality enhance).
  const [visionInputFile, setVisionInputFile] = useState<File | null>(null);
  const [rasterizing, setRasterizing] = useState(false);
  const [rasterError, setRasterError] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState<Array<{ key: string; label: string; url: string; settings: EnhancementSettings }>>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [directUploadCache, setDirectUploadCache] = useState<DirectUploadCache | null>(null);
  const [directUploadProgress, setDirectUploadProgress] = useState<DirectUploadProgress | null>(null);
  const [queueJob, setQueueJob] = useState<PhotoEnhancerJob | null>(null);
  const [queueActionPending, setQueueActionPending] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [compareHeld, setCompareHeld] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [sampledPixel, setSampledPixel] = useState<SampledPixel | null>(null);
  const [cullOpen, setCullOpen] = useState(false);
  const [focusedFace, setFocusedFace] = useState<DetectedFace | null>(null);

  const session = useEnhancerSession();

  // Auto-hydrate from an iPad capture session when the URL carries
  // `?captureSessionId=...`. Typical flow: photographer finishes the
  // shoot on iPad → iPad pushes the session URL into the dashboard via
  // the Showcase bridge → tapping it opens the enhancer with every
  // rating / pick / reject already in place.
  //
  // `?projectId=...` (optional, same URL) enables the ClientActivityBanner.
  const loadCaptureSessionRef = useRef(session.loadCaptureSession);
  loadCaptureSessionRef.current = session.loadCaptureSession;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectIdParam = params.get('projectId');
    if (projectIdParam) setProjectIdFromUrl(projectIdParam);
    const captureSessionId = params.get('captureSessionId');
    if (!captureSessionId) return;
    let cancelled = false;
    loadCaptureSessionRef.current(captureSessionId).then(
      (created) => {
        if (cancelled || created.length === 0) return;
        const first = created[0];
        setUploadedImage(first.file);
        setOriginalImageUrl(first.previewUrl);
        session.selectImage(first.id);
      },
      (err) => {
        console.warn('[enhancer] capture-session hydrate failed:', err);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const faceLoader = useFaceDetectionLoader({
    setStatus: (imageId, status) =>
      session.dispatch({ type: 'SET_FACE_STATUS', imageId, status }),
    setFaces: (imageId, faces) =>
      session.dispatch({ type: 'SET_FACES', imageId, faces }),
  });

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
  const queueRuntime = statusQuery.data?.queue;
  const queueCounts = queueRuntime?.counts || {};
  const processingOptions = statusQuery.data?.processingOptions;

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

  const startQueuedEnhancement = useCallback(async (source: DirectUploadSource) => {
    setDirectUploadProgress({
      active: true,
      phase: 'Legger jobb i server-kø',
      percent: 100,
      detail: 'Backend styrer prioritet, minne og retry.',
    });
    const createResponse = await apiRequest('/api/photo-enhancer/jobs', {
      method: 'POST',
      body: {
        source,
        preset: activePreset,
        settings,
        projectId: selectedProjectId || 'photo-enhancer',
        folderId: selectedFolderId || undefined,
        priority: source.size >= 250 * 1024 * 1024 ? 10 : 25,
      },
    });
    const createdJob = normalizePhotoEnhancerJob(toRecord(createResponse).job);
    if (!createdJob) throw new Error('Serveren opprettet ikke en gyldig Photo Enhancer-jobb.');
    setQueueJob(createdJob);

    let currentJob = createdJob;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      if (['completed', 'failed', 'cancelled'].includes(currentJob.status)) break;
      await delay(1500);
      const response = await apiRequest(`/api/photo-enhancer/jobs/${encodeURIComponent(currentJob.id)}`);
      const nextJob = normalizePhotoEnhancerJob(toRecord(response).job);
      if (!nextJob) throw new Error('Serveren returnerte ugyldig job-status.');
      currentJob = nextJob;
      setQueueJob(nextJob);
      setDirectUploadProgress({
        active: true,
        phase: nextJob.status === 'running' ? 'Forbedrer i server-kø' : 'Venter i server-kø',
        percent: Math.max(1, Math.min(100, nextJob.progress || 1)),
        detail: `Jobb ${nextJob.id.slice(0, 8)} · ${nextJob.status} · forsøk ${nextJob.attempts || 0}/${nextJob.maxAttempts || 1}`,
      });
    }

    if (currentJob.status === 'completed' && currentJob.result) {
      return {
        ...currentJob.result,
        job: currentJob,
      };
    }
    throw new Error(currentJob.failureReason || `Photo Enhancer-jobb stoppet med status ${currentJob.status}.`);
  }, [activePreset, selectedFolderId, selectedProjectId, settings]);

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
      const id = session.active?.id;
      if (id) session.setAnalysis(id, record);
      setDirectUploadProgress((previous) => previous?.active ? { ...previous, phase: 'Analyse fullført', percent: 100 } : previous);
    },
  });

  // Claude Vision recipe suggester — a dedicated "AI-forslag" pass
  // that asks the backend to propose every slider value + per-effect
  // intensity profile. Separate from analyzeMutation (which is a local
  // Sharp/face-api readout); this one is Claude Opus 4.7 driven and
  // returns a recipe we merge straight into the settings state.
  const [aiSuggestion, setAiSuggestion] = useState<{
    subject: string;
    confidence: number;
    rationale: string;
    observations: string[];
  } | null>(null);
  // The exact recipe the AI proposed — kept frozen alongside
  // ``settings`` so we can diff it against whatever the photographer
  // ultimately enhances with and POST the drift back. Reset to null
  // whenever a new image is uploaded or an AI suggestion lands (the
  // next onSuccess will populate this fresh).
  const [aiSuggestedRecipe, setAiSuggestedRecipe] = useState<Partial<EnhancementSettings> | null>(
    null,
  );
  const suggestRecipeMutation = useMutation({
    mutationFn: async (input: { file: File; instruction?: string }): Promise<{
      recipe: Partial<EnhancementSettings>;
      analysis: {
        subject: string;
        confidence: number;
        rationale: string;
        observations: string[];
      };
    }> => {
      const formData = new FormData();
      formData.append('image', input.file);
      // Send the active preset so Claude knows whether we're shooting
      // wedding / studio portrait / product / landscape etc. Claude still
      // classifies the image independently but the hint breaks ties.
      formData.append('preset', activePreset);
      // Optional free-text style brief ("warm pastel film look", "moody
      // editorial") — Claude translates it into concrete slider/HSL/LUT
      // values for this image.
      if (input.instruction && input.instruction.trim()) {
        formData.append('instruction', input.instruction.trim());
      }
      return apiRequest('/api/photo-enhancer/suggest-recipe', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const record = toRecord(response);
      const recipe = (record.recipe ?? {}) as Partial<EnhancementSettings>;
      const analysis = (record.analysis ?? {}) as {
        subject?: string;
        confidence?: number;
        rationale?: string;
        observations?: unknown;
      };
      const rawSubject = String(analysis.subject ?? 'other');
      const subject = (SUBJECT_KINDS.includes(rawSubject as SubjectKind)
        ? (rawSubject as SubjectKind)
        : 'other') as SubjectKind;
      // When the AI returns a non-portrait category, seed a default
      // subject-look strength so the subject_retouch dispatcher
      // actually kicks in on the next Enhance. Portraits / group
      // portraits + 'other' stay at 0 (portrait retouch handles the
      // first two; 'other' is intentionally a no-op).
      const seedSubjectStrength =
        subject && subject !== 'portrait' && subject !== 'group_portrait' && subject !== 'other'
          ? 60
          : 0;
      const seeded: Partial<EnhancementSettings> = {
        ...recipe,
        subject,
        subjectLookStrength: seedSubjectStrength,
      };
      setSettings((previous) => ({ ...previous, ...seeded }));
      setAiSuggestedRecipe(seeded);
      const summary = {
        subject: rawSubject,
        confidence: Number(analysis.confidence ?? 0),
        rationale: String(analysis.rationale ?? ''),
        observations: Array.isArray(analysis.observations)
          ? (analysis.observations as unknown[]).filter((o): o is string => typeof o === 'string')
          : [],
      };
      setAiSuggestion(summary);
      const id = session.active?.id;
      if (id) {
        session.setAiSuggestion(id, summary, seeded);
        // AI-forslag should land as a single undoable step — otherwise
        // the photographer has to press ⌘Z per slider to back it out.
        session.commitHistory(id, 'AI-forslag');
      }
    },
  });

  const runSuggestRecipe = async () => {
    if (!visionFile) return;
    await suggestRecipeMutation.mutateAsync({ file: visionFile });
  };

  // Natural-language editing: turn a free-text style brief into settings.
  const runStyleInstruction = async () => {
    if (!visionFile || !editInstruction.trim()) return;
    await suggestRecipeMutation.mutateAsync({ file: visionFile, instruction: editInstruction.trim() });
  };

  // Render the current recipe three ways (Naturlig / Livlig / Sort-hvitt) so
  // the photographer can pick a direction in one click.
  const runVariants = async () => {
    if (!visionFile) return;
    setVariants([]);
    setVariantsOpen(true);
    setVariantsLoading(true);
    const perFaceOverrides = session.active
      ? serializePerFaceOverrides(session.active.perFaceOverrides)
      : [];
    const results = await Promise.all(
      ENHANCE_VARIANTS.map(async (variant) => {
        const variantSettings = variant.tweak(settings);
        const formData = new FormData();
        formData.append('image', visionFile);
        formData.append('preset', activePreset);
        formData.append('settings', JSON.stringify({ ...variantSettings, perFaceOverrides }));
        try {
          const response = await apiRequest('/api/photo-enhancer/enhance', {
            method: 'POST',
            body: formData,
          });
          return { key: variant.key, label: variant.label, settings: variantSettings, url: toImageUrl(response) };
        } catch {
          return { key: variant.key, label: variant.label, settings: variantSettings, url: '' };
        }
      }),
    );
    setVariants(results);
    setVariantsLoading(false);
  };

  const applyVariant = (variant: { label: string; url: string; settings: EnhancementSettings }) => {
    setSettings(variant.settings);
    if (variant.url) {
      setEnhancedImageUrl(variant.url);
      setViewMode('side-by-side');
      const id = session.active?.id;
      if (id) session.setEnhancedUrl(id, variant.url);
    }
    setVariantsOpen(false);
    commitActiveHistory(`Variant: ${variant.label}`);
  };

  // Batch — apply the current recipe to every image in the session so a
  // whole shoot gets the same look in one click.
  const applyRecipeToAllImages = () => {
    for (const image of session.state.images) {
      session.setSettings(image.id, settings);
      session.commitHistory(image.id, 'Bruk på alle');
    }
  };

  // Batch — enhance every image in the session sequentially (each with its
  // own settings), updating per-image results as they land.
  const enhanceAllImages = async () => {
    const images = session.state.images;
    if (images.length === 0 || batchProgress) return;
    setBatchProgress({ done: 0, total: images.length });
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      try {
        const formData = new FormData();
        formData.append('image', image.file);
        formData.append('preset', activePreset);
        formData.append('settings', JSON.stringify({ ...image.settings, perFaceOverrides: [] }));
        const response = await apiRequest('/api/photo-enhancer/enhance', { method: 'POST', body: formData });
        const url = toImageUrl(response);
        if (url) {
          session.setEnhancedUrl(image.id, url);
          if (image.id === session.active?.id) {
            setEnhancedImageUrl(url);
            setViewMode('side-by-side');
          }
        }
      } catch {
        // Per-image failure shouldn't abort the whole batch.
      }
      setBatchProgress({ done: index + 1, total: images.length });
    }
    setBatchProgress(null);
  };

  const enhanceMutation = useMutation({
    mutationFn: async (file: File) => {
      if (shouldUseDirectUpload(file)) {
        const source = await getDirectUploadSource(file);
        return startQueuedEnhancement(source);
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', activePreset);
      // Merge the active image's per-face overrides into the settings
      // payload so the runner sees the full scoping contract in a single
      // shape.
      const perFaceOverrides = session.active
        ? serializePerFaceOverrides(session.active.perFaceOverrides)
        : [];
      formData.append(
        'settings',
        JSON.stringify({ ...settings, perFaceOverrides }),
      );

      return apiRequest('/api/photo-enhancer/enhance', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const imageUrl = toImageUrl(response);
      const job = normalizePhotoEnhancerJob(toRecord(response).job);
      if (job) setQueueJob(job);
      if (imageUrl) {
        setEnhancedImageUrl(imageUrl);
        setViewMode('side-by-side');
        const id = session.active?.id;
        if (id) session.setEnhancedUrl(id, imageUrl);
      }
      setDirectUploadProgress((previous) => previous?.active ? { ...previous, phase: 'Forbedring fullført', percent: 100 } : previous);
      // If the photographer started from an AI suggestion, send the
      // diff back so the preference-learning service can refine the
      // next suggestion. Fire-and-forget — feedback is purely an
      // optimisation; a logging failure shouldn't surface as an
      // Enhance error to the user.
      if (aiSuggestedRecipe) {
        void apiRequest('/api/photo-enhancer/feedback', {
          method: 'POST',
          body: {
            suggested: aiSuggestedRecipe,
            final: settings,
          },
        }).catch((err) => {
          // Don't retry — feedback is best-effort.
          console.debug('recipe feedback skipped:', err);
        });
        // Clear so a second Enhance on the same recipe doesn't
        // double-log. A new AI suggestion seeds a fresh one.
        setAiSuggestedRecipe(null);
        const activeId = session.active?.id;
        if (activeId) session.clearAiSuggestedRecipe(activeId);
      }
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

  // Shared upload path for both the file picker and drag-and-drop on the
  // preview pane. Resets all per-image state so a new file starts clean.
  const ingestFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Legacy single-image blob-URL ownership — the session hook owns the
    // URLs it creates for session images, so we only revoke the standalone
    // URL used before multi-image mode existed.
    if (originalImageUrl.startsWith('blob:') && !session.state.images.some((i) => i.previewUrl === originalImageUrl)) {
      URL.revokeObjectURL(originalImageUrl);
    }

    const added = session.addFiles(files);
    if (added.length === 0) return;

    const first = added[0];
    setUploadedImage(first.file);
    setOriginalImageUrl(first.previewUrl);
    setEnhancedImageUrl('');
    setAnalysisResult(null);
    setCompositionAnalysis(null);
    setDirectUploadCache(null);
    setDirectUploadProgress(null);
    setQueueJob(null);
    setViewMode('single');
    setCompareSlider(50);
    setSettings(DEFAULT_SETTINGS);
    setAiSuggestion(null);
    setAiSuggestedRecipe(null);
    setVisionInputFile(null);
    setRasterError(null);
    session.selectImage(first.id);

    // Browsers can't render camera RAW (Nikon/Sony/Fuji/Canon/…) or HEIC.
    // Fetch a server-rasterised JPEG to drive the preview AND the AI / face
    // endpoints; the untouched original still goes to /enhance, where it is
    // converted at full quality.
    let visionFile = first.file;
    if (needsRasterPreview(first.file)) {
      setRasterizing(true);
      try {
        const formData = new FormData();
        formData.append('image', first.file);
        const response = await apiFetch('/api/photo-enhancer/preview', { method: 'POST', body: formData });
        if (response.ok) {
          const blob = await response.blob();
          setOriginalImageUrl(URL.createObjectURL(blob));
          const baseName = first.file.name.replace(/\.[^.]+$/, '') || 'bilde';
          visionFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
          setVisionInputFile(visionFile);
        } else {
          setRasterError(
            response.status === 422
              ? 'RAW-konvertering er ikke aktiv på serveren ennå — du kan fortsatt trykke Enhance (serveren konverterer da), eller laste opp en JPEG.'
              : 'Klarte ikke å lage forhåndsvisning av RAW-filen.',
          );
        }
      } catch {
        setRasterError('Klarte ikke å lage forhåndsvisning av RAW-filen.');
      } finally {
        setRasterizing(false);
      }
    }

    // Reduce friction: kick off the lightweight analysis (faces, format,
    // hash) right away unless the photographer has turned it off. For RAW
    // this uses the rasterised preview so it never hits the 415 guard.
    if (autoAnalyze) {
      void analyzeMutation.mutateAsync(visionFile).catch(() => {
        // Auto-analysis is best-effort; the manual "Analyze" button stays
        // available and surfaces its own error.
      });
    }
  };

  // Download the enhanced result directly, without going through the
  // project-save or export-preset flow.
  const handleDownloadEnhanced = () => {
    if (!enhancedImageUrl) return;
    const anchor = document.createElement('a');
    anchor.href = enhancedImageUrl;
    const base = uploadedImage?.name?.replace(/\.[^.]+$/, '') || 'bilde';
    anchor.download = `${base}-forbedret.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  // Reset every adjustment back to defaults (e.g. to start over after an
  // AI suggestion or manual tweaking).
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setAiSuggestion(null);
    setAiSuggestedRecipe(null);
    commitActiveHistory('Tilbakestilt');
  };

  // Apply a saved Look's full recipe to the current image.
  const applyLook = (look: SavedLook) => {
    setSettings(look.settings);
    setAiSuggestion(null);
    commitActiveHistory(`Look: ${look.name}`);
  };

  const confirmSaveLook = () => {
    if (!lookName.trim()) return;
    setLooks((previous) => saveLook(previous, lookName, settings));
    setLookName('');
    setSaveLookDialogOpen(false);
  };

  const onImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList) : [];
    event.target.value = '';
    void ingestFiles(files);
  };

  const onPreviewDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    const images = dropped.filter(
      (file) =>
        file.type.startsWith('image/') ||
        /\.(jpe?g|png|webp|hei[cf]|tiff?|dng|cr[23w]|nef|nrw|arw|sr[f2]|raf|orf|rw2|pef|x3f|3fr|mrw|mef|mos|iiq|raw|rwl)$/i.test(file.name),
    );
    if (images.length > 0) void ingestFiles(images);
  };

  // The file the AI / face endpoints should read: a browser-decodable
  // raster. For RAW/HEIC that's the server-rasterised JPEG (null until it
  // arrives, which gates the AI buttons); otherwise the original upload.
  const visionFile: File | null = uploadedImage
    ? needsRasterPreview(uploadedImage)
      ? visionInputFile
      : uploadedImage
    : null;

  // Lens correction (distortion / vignetting / chromatic aberration). The
  // amounts ride along in the enhance payload; the runner / RAW converter
  // applies them, preferring the matched lens profile when `auto` is on.
  const lensCorrection: LensCorrectionSettings = settings.lensCorrection ?? DEFAULT_LENS_CORRECTION;
  const updateLensCorrection = (patch: Partial<LensCorrectionSettings>) => {
    setSettings((previous) => ({
      ...previous,
      lensCorrection: { ...(previous.lensCorrection ?? DEFAULT_LENS_CORRECTION), ...patch },
    }));
  };
  const matchedLensName: string | null = (() => {
    const analysis = toRecord(toRecord(analysisResult).analysis);
    const lens = toRecord(analysis.lensProfile);
    return typeof lens.name === 'string' ? lens.name : null;
  })();

  /**
   * Swap the enhance-pipeline input to a freshly retouched File. Invoked
   * by `FrequencySepDialog` after the user commits a frequency-sep edit.
   *
   * - Revokes the prior legacy blob URL when we own it (session-owned
   *   URLs are left alone so filmstrip thumbs stay valid).
   * - Drops the current enhanced-image preview — it was rendered from
   *   the pre-retouch source and no longer matches.
   * - Leaves slider settings intact: the retouch is an input swap, so
   *   every HSL/LUT/AI tweak should re-apply on top of the cleaner base.
   * - Does NOT mutate the session image; the session keeps a handle to
   *   the original upload for comparison. Callers that want the retouch
   *   to survive thumb switches should save out to storage first.
   */
  const handleFrequencySepApply = (retouchedFile: File) => {
    if (
      originalImageUrl.startsWith('blob:') &&
      !session.state.images.some((i) => i.previewUrl === originalImageUrl)
    ) {
      URL.revokeObjectURL(originalImageUrl);
    }
    const nextUrl = URL.createObjectURL(retouchedFile);
    setUploadedImage(retouchedFile);
    setOriginalImageUrl(nextUrl);
    setEnhancedImageUrl('');
  };

  /**
   * Object-removal commit. Mirrors handleFrequencySepApply: swap the
   * pipeline input to the inpainted result so subsequent slider tweaks
   * compose on top of the cleaned image. Records the recipe (without the
   * mask itself — too large to persist in settings) so A/B and audit
   * tooling can show what was removed.
   *
   * Used by both the manual brush editor (ObjectRemovalEditor) and the
   * auto-detect flow (AutoDistractionDetector). Recipe may be null in
   * the auto path when the executor ran skipPlanner.
   */
  const handleInpaintApply = (
    label: string,
    inpaintedDataUrl: string,
    recipe: InpaintRecipe | null,
    _warnings: string[],
  ) => {
    fetch(inpaintedDataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File(
          [blob],
          uploadedImage?.name?.replace(/\.[^.]+$/, '_inpainted.jpg') || 'inpainted.jpg',
          { type: 'image/jpeg' },
        );
        if (
          originalImageUrl.startsWith('blob:') &&
          !session.state.images.some((i) => i.previewUrl === originalImageUrl)
        ) {
          URL.revokeObjectURL(originalImageUrl);
        }
        const nextUrl = URL.createObjectURL(file);
        setUploadedImage(file);
        setOriginalImageUrl(nextUrl);
        setEnhancedImageUrl('');
        setSettings((previous) => ({
          ...previous,
          inpaint: recipe ? { maskPng: '', intensity: 1, recipe } : previous.inpaint,
        }));
        commitActiveHistory(label);
      })
      .catch((err) => {
        console.error('[photo-enhancer] inpaint apply failed:', err);
      });
  };

  const handleObjectRemovalApply = (
    inpaintedDataUrl: string,
    recipe: InpaintRecipe,
    warnings: string[],
  ) => {
    handleInpaintApply('Fjern objekter', inpaintedDataUrl, recipe, warnings);
    setObjectRemovalOpen(false);
  };

  const handleAutoDetectApply = (
    inpaintedDataUrl: string,
    recipe: InpaintRecipe | null,
    warnings: string[],
  ) => {
    handleInpaintApply('Auto-fjern objekter', inpaintedDataUrl, recipe, warnings);
    setAutoDetectorOpen(false);
  };

  // Syncs the active session image into the legacy per-image state fields
  // when the user clicks a different thumb in the filmstrip. Only fires
  // when the active id actually changes, so ongoing edits on the current
  // image aren't clobbered.
  const lastActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const active = session.active;
    if (!active) return;
    if (lastActiveIdRef.current === active.id) return;
    // Commit any in-flight edits on the outgoing image so the history
    // ring has a clean terminal state before we swap. No-op if nothing
    // actually moved.
    const outgoingId = lastActiveIdRef.current;
    if (outgoingId) session.commitHistory(outgoingId, 'Bildebytte');
    lastActiveIdRef.current = active.id;
    setFocusedFace(null);
    faceLoader.requestForImage(active);
    setUploadedImage(active.file);
    setOriginalImageUrl(active.previewUrl);
    setEnhancedImageUrl(active.enhancedUrl ?? '');
    setSettings(active.settings);
    setAnalysisResult(active.analysisResult ?? null);
    setCompositionAnalysis(null);
    setAiSuggestion(active.aiSuggestion ?? null);
    setAiSuggestedRecipe(active.aiSuggestedRecipe ?? null);
    setQueueJob(null);
    setDirectUploadCache(null);
    setDirectUploadProgress(null);
    setCompareSlider(50);
  }, [session.active]);

  // Pushes local slider tweaks back into the session record so filmstrip
  // thumbnails, copy/paste, and export preview stay coherent. Debounced
  // via rAF to avoid firing on every scroll of a slider drag.
  useEffect(() => {
    const id = session.active?.id;
    if (!id) return;
    const handle = window.requestAnimationFrame(() => {
      session.setSettings(id, settings);
    });
    return () => window.cancelAnimationFrame(handle);
  }, [settings, session.active?.id]);

  const runAnalysis = async () => {
    if (!visionFile) return;
    await analyzeMutation.mutateAsync(visionFile);
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

  const runQueueJobAction = async (action: 'cancel' | 'pause' | 'resume' | 'retry') => {
    if (!queueJob) return;
    setQueueActionPending(true);
    try {
      const response = await apiRequest(`/api/photo-enhancer/jobs/${encodeURIComponent(queueJob.id)}/${action}`, {
        method: 'POST',
      });
      const nextJob = normalizePhotoEnhancerJob(toRecord(response).job);
      if (nextJob) setQueueJob(nextJob);
      void statusQuery.refetch();
    } finally {
      setQueueActionPending(false);
    }
  };

  const canSave = Boolean(enhancedImageUrl && selectedProjectId && selectedFolderId);
  const selectedIsLargeUpload = Boolean(uploadedImage && uploadedImage.size >= DIRECT_UPLOAD_THRESHOLD_BYTES);
  const selectedUsesDirectUpload = uploadedImage ? shouldUseDirectUpload(uploadedImage) : false;

  // Pixel sampler — hidden canvas mirroring the source image so the HSL
  // eyedropper reads true source colours, independent of the preview shader.
  const pixelSampler = useImagePixelSampler(originalImageUrl || null);

  // Fetch the LUT table for the active selection so the WebGL preview
  // reflects the chosen look live (instead of waiting for Enhance).
  const lutAtlas = useLutPreview(settings.lut.name);

  const [lutRegistry, setLutRegistry] = useState<LutRegistryEntry[]>([]);
  const lutThumbnails = useLutThumbnails(
    originalImageUrl || null,
    lutRegistry,
    session.active?.id ?? null,
  );

  // "Recent LUTs" derived from this image's edit history — scan entries
  // for labels starting with "LUT:" and return the most-recent 5 slugs.
  const recentLutNames = useMemo(() => {
    const entries = session.active?.history.entries ?? [];
    const seen: string[] = [];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const name = entries[i].settings.lut?.name;
      if (name && !seen.includes(name)) seen.push(name);
      if (seen.length >= 5) break;
    }
    return seen;
  }, [session.active]);

  const handleEyedropperStart = () => {
    if (!originalImageUrl) return;
    setEyedropperActive(true);
  };

  const handlePreviewPixelPick = (normX: number, normY: number) => {
    const sample = pixelSampler.sampleNormalised(normX, normY);
    if (sample) setSampledPixel(sample);
    setEyedropperActive(false);
  };

  useEnhancerShortcuts({
    activeId: session.active?.id ?? null,
    imageIds: session.state.images.map((i) => i.id),
    enabled: !exportDialogOpen && !saveDialogOpen && !showRatingDialog && !cullOpen,
    setRating: (id, rating) => session.setRating(id, rating),
    setFlag: (id, flag) => session.setFlag(id, flag),
    selectImage: (id) => session.selectImage(id),
    setCompareHeld: (held) => setCompareHeld(held),
    copyEdits: () => {
      const id = session.active?.id;
      if (id) session.copyEdits(id);
    },
    undo: () => {
      const id = session.active?.id;
      if (id) session.undoHistory(id);
    },
    redo: () => {
      const id = session.active?.id;
      if (id) session.redoHistory(id);
    },
  });

  const commitActiveHistory = useCallback(
    (label?: string) => {
      const id = session.active?.id;
      if (id) session.commitHistory(id, label);
    },
    [session],
  );

  // When a face chip is selected, portrait-region sliders write to that
  // face's override patch instead of the global settings. Reads fall back
  // to global when the face hasn't overridden that particular key yet —
  // a fresh chip defaults to the image's current look.
  const activeFaceIndex = session.state.activeFaceIndex;
  const activeFaceOverride: Partial<EnhancementSettings> =
    activeFaceIndex != null && session.active
      ? session.active.perFaceOverrides[activeFaceIndex] ?? {}
      : {};
  type PortraitKey =
    | 'teethWhiteness'
    | 'eyeBrightness'
    | 'eyeWhiteness'
    | 'blemishRemoval'
    | 'skinTextureGuard'
    | 'faceEnhancement';
  type ProfileKey =
    | 'teethProfile'
    | 'eyeBrightnessProfile'
    | 'eyeWhitenessProfile'
    | 'blemishProfile';

  function readPortraitValue<K extends PortraitKey>(key: K): number {
    const override = activeFaceOverride[key];
    return typeof override === 'number' ? override : (settings[key] as number);
  }

  function readProfileValue<K extends ProfileKey>(key: K): IntensityProfile {
    const override = activeFaceOverride[key];
    return (override as IntensityProfile | undefined) ?? (settings[key] as IntensityProfile);
  }

  const writePortraitValue = (key: PortraitKey, value: number) => {
    if (activeFaceIndex != null && session.active) {
      session.patchFaceSettings(session.active.id, activeFaceIndex, { [key]: value });
    } else {
      setSettings((previous) => ({ ...previous, [key]: value }));
    }
  };

  const writeProfileValue = (key: ProfileKey, value: IntensityProfile) => {
    if (activeFaceIndex != null && session.active) {
      session.patchFaceSettings(session.active.id, activeFaceIndex, { [key]: value });
    } else {
      setSettings((previous) => ({ ...previous, [key]: value }));
    }
  };

  // When compare-held is true, force the preview to show the original so
  // the photographer can tap \ and see before/after without mouse work.
  const compareOverrideUrl = compareHeld && enhancedImageUrl ? originalImageUrl : '';

  // Slice 9X.79 — userId for SmartFlyt-culling-panel
  const enhancerUserId = (typeof window !== 'undefined' && window.localStorage.getItem('userId')) || '';

  return (
    <Box>
      {/* Slice 9X.79 — Siste auto-culling-resultat fra SmartFlyt */}
      <SmartFlytCullingPanel userId={enhancerUserId} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    CreatorHub Photo Enhancer
                  </Typography>
                  <Tooltip title="Hurtigtaster">
                    <IconButton
                      size="small"
                      aria-label="Hurtigtaster"
                      onClick={(event) => setShortcutsAnchor(event.currentTarget)}
                    >
                      <HelpIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
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

                {projectIdFromUrl && (
                  <ClientActivityBanner projectId={projectIdFromUrl} />
                )}

                <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
                  Last opp bilde
                  <input hidden multiple accept={PHOTO_UPLOAD_ACCEPT} type="file" onChange={onImageUpload} />
                </Button>

                {uploadedImage ? <Chip label={uploadedImage.name} size="small" /> : null}

                <Box data-testid="auto-analyze-toggle">
                  <FormControlLabelSwitch
                    label="Analyser automatisk ved opplasting"
                    checked={autoAnalyze}
                    onChange={(checked) => setAutoAnalyze(checked)}
                  />
                </Box>

                {rasterizing ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Konverterer RAW til forhåndsvisning…
                    </Typography>
                  </Stack>
                ) : null}

                {rasterError ? <Alert severity="warning">{rasterError}</Alert> : null}

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

                {session.state.images.length > 1 && session.active ? (
                  <EditClipboardBar
                    clipboard={session.state.clipboard}
                    activeImageName={session.active.fileName}
                    activeImageSettings={session.active.settings}
                    multiSelectCount={session.state.multiSelectIds.length}
                    totalImageCount={session.state.images.length}
                    onCopy={() => session.copyEdits(session.active!.id)}
                    onPaste={(scope, modules) => {
                      const ids = scope === 'active'
                        ? session.active ? [session.active.id] : []
                        : session.state.multiSelectIds.length > 0
                          ? session.state.multiSelectIds
                          : session.state.images.map((i) => i.id);
                      session.pasteEdits(ids, modules);
                      for (const id of ids) session.commitHistory(id, 'Lim inn');
                      const activeId = session.active?.id;
                      if (activeId && ids.includes(activeId)) {
                        // force-refresh local settings from session after paste
                        lastActiveIdRef.current = null;
                      }
                    }}
                    onClearClipboard={() => session.clearClipboard()}
                  />
                ) : null}

                <Divider />

                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">Mine Looks</Typography>
                    <Tooltip title="Lagre nåværende innstillinger som en gjenbrukbar Look">
                      <span>
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<BookmarkAddIcon fontSize="small" />}
                          onClick={() => {
                            setLookName('');
                            setSaveLookDialogOpen(true);
                          }}
                          disabled={!uploadedImage}
                          sx={{ textTransform: 'none' }}
                        >
                          Lagre Look
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                  {looks.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      Lagre en signatur-look og bruk den på nye bilder med ett klikk.
                    </Typography>
                  ) : (
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {looks.map((look) => (
                        <Chip
                          key={look.id}
                          label={look.name}
                          size="small"
                          variant="outlined"
                          clickable
                          disabled={!uploadedImage}
                          onClick={() => applyLook(look)}
                          onDelete={() => setLooks((previous) => deleteLook(previous, look.id))}
                        />
                      ))}
                    </Stack>
                  )}
                </Stack>

                {session.state.images.length > 1 ? (
                  <>
                    <Divider />
                    <Stack spacing={0.75}>
                      <Typography variant="subtitle2">Hele serien ({session.state.images.length})</Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={applyRecipeToAllImages}
                          disabled={!uploadedImage || Boolean(batchProgress)}
                          sx={{ textTransform: 'none' }}
                        >
                          Bruk på alle ({session.state.images.length})
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          startIcon={<AutoFixHighIcon fontSize="small" />}
                          onClick={() => void enhanceAllImages()}
                          disabled={Boolean(batchProgress)}
                          sx={{ textTransform: 'none' }}
                        >
                          Enhance alle ({session.state.images.length})
                        </Button>
                      </Stack>
                      {batchProgress ? (
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={(batchProgress.done / batchProgress.total) * 100}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Forbedrer {batchProgress.done}/{batchProgress.total}…
                          </Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  </>
                ) : null}

                <Divider />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Justeringer</Typography>
                  <Tooltip title="Tilbakestill alle justeringer til standard">
                    <span>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<RestartAltIcon fontSize="small" />}
                        onClick={resetSettings}
                        disabled={!uploadedImage}
                        sx={{ textTransform: 'none' }}
                      >
                        Tilbakestill
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {[
                  { key: 'brightness', label: 'Lysstyrke', hint: 'Gjør hele bildet lysere eller mørkere.' },
                  { key: 'contrast', label: 'Kontrast', hint: 'Øker forskjellen mellom lyse og mørke partier.' },
                  { key: 'saturation', label: 'Metning', hint: 'Hvor kraftige og mettede fargene er.' },
                  { key: 'sharpness', label: 'Skarphet', hint: 'Tydeligere kanter og finere detaljer.' },
                  { key: 'denoising', label: 'Støyreduksjon', hint: 'Fjerner korn og grynethet fra høy ISO eller dårlig lys.' },
                  { key: 'faceEnhancement', label: 'Ansiktsforbedring', hint: 'Glatter hud og løfter ansikter automatisk.' },
                ].map((slider) => {
                  const key = slider.key as 'brightness' | 'contrast' | 'saturation' | 'sharpness' | 'denoising' | 'faceEnhancement';
                  // Only faceEnhancement is face-scopable in this block.
                  const faceScoped = key === 'faceEnhancement' && activeFaceIndex != null;
                  const currentValue = faceScoped ? readPortraitValue('faceEnhancement') : settings[key];
                  return (
                    <Box key={slider.key}>
                      <Stack direction="row" justifyContent="space-between">
                        <Tooltip title={slider.hint} placement="top" arrow>
                          <Typography
                            variant="caption"
                            sx={{ borderBottom: '1px dotted', borderColor: 'text.secondary', cursor: 'help' }}
                          >
                            {slider.label}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption">{currentValue}</Typography>
                      </Stack>
                      <Slider
                        value={currentValue}
                        min={slider.key === 'brightness' || slider.key === 'contrast' || slider.key === 'saturation' || slider.key === 'sharpness' ? -100 : 0}
                        max={100}
                        onChange={(_, value) => {
                          const numericValue = Array.isArray(value) ? value[0] : value;
                          if (faceScoped) {
                            writePortraitValue('faceEnhancement', numericValue);
                          } else {
                            setSettings((previous) => ({ ...previous, [key]: numericValue }));
                          }
                        }}
                        onChangeCommitted={() =>
                          commitActiveHistory(
                            faceScoped ? `Ansikt #${(activeFaceIndex ?? 0) + 1}` : 'Justering',
                          )
                        }
                      />
                    </Box>
                  );
                })}

                <Divider />

                <Accordion
                  disableGutters
                  square
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 'auto' }}>
                    <Stack spacing={0}>
                      <Typography variant="subtitle2">Avanserte justeringer</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Ansiktsretusj, oppskalering, kategori-look og serverkø
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Stack spacing={1.25}>
                    <Box data-testid="lens-correction-toggle">
                      <FormControlLabelSwitch
                        label="Linsekorreksjon"
                        checked={lensCorrection.enabled}
                        onChange={(checked) => updateLensCorrection({ enabled: checked })}
                      />
                    </Box>
                    {lensCorrection.enabled ? (
                      <>
                        <Typography variant="caption" color="text.secondary">
                          {matchedLensName
                            ? `Profil: ${matchedLensName}`
                            : 'Ingen linseprofil matchet ennå — kjør Analyze, eller bruk manuell styrke.'}
                        </Typography>
                        <FormControlLabelSwitch
                          label="Automatisk fra linseprofil"
                          checked={lensCorrection.auto}
                          onChange={(checked) => updateLensCorrection({ auto: checked })}
                        />
                        {!lensCorrection.auto
                          ? (
                              [
                                { key: 'distortion' as const, label: 'Forvrengning' },
                                { key: 'vignette' as const, label: 'Vignett' },
                                { key: 'chromaticAberration' as const, label: 'Kromatisk aberrasjon' },
                              ].map((control) => (
                                <Box key={control.key}>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="caption">{control.label}</Typography>
                                    <Typography variant="caption">{lensCorrection[control.key]}</Typography>
                                  </Stack>
                                  <Slider
                                    value={lensCorrection[control.key]}
                                    min={0}
                                    max={100}
                                    onChange={(_, value) =>
                                      updateLensCorrection({ [control.key]: Array.isArray(value) ? value[0] : value })
                                    }
                                    onChangeCommitted={() => commitActiveHistory('Linsekorreksjon')}
                                  />
                                </Box>
                              ))
                            )
                          : null}
                      </>
                    ) : null}
                  </Stack>
                </Paper>

                <FormControl fullWidth size="small">
                  <InputLabel id="enhancer-model-label">Forbedrings-metode</InputLabel>
                  <Select
                    labelId="enhancer-model-label"
                    label="Forbedrings-metode"
                    value={settings.modelPreference}
                    onChange={(event) => setSettings((previous) => ({ ...previous, modelPreference: event.target.value }))}
                  >
                    {(processingOptions?.modelPreference || ['auto', 'sharp', 'gfpgan', 'codeformer', 'realesrgan', 'swinir', 'bsrgan', 'diffbir']).map((model) => (
                      <MenuItem key={model} value={model}>
                        {plainModelLabel(model)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {[
                  { key: 'gfpganQuality', label: 'Ansiktsforbedring', profileKey: null, hint: 'Hvor mye ansikter forbedres og glattes (naturlig).' },
                  { key: 'codeformerFidelity', label: 'Behold opprinnelig ansikt', profileKey: null, hint: 'Høyt = mer likt originalansiktet; lavt = kraftigere rekonstruksjon.' },
                  { key: 'skinTextureGuard', label: 'Bevar hudtekstur', profileKey: null, hint: 'Beholder porer og hudtekstur så huden ikke blir plastaktig.' },
                  { key: 'blemishRemoval', label: 'Fjern urenheter', profileKey: 'blemishProfile' as const, hint: 'Fjerner kviser, flekker og midlertidige urenheter.' },
                  { key: 'teethWhiteness', label: 'Hvitere tenner', profileKey: 'teethProfile' as const, hint: 'Gjør tenner hvitere uten å bli unaturlig blå.' },
                  { key: 'eyeBrightness', label: 'Lysere øyne', profileKey: 'eyeBrightnessProfile' as const, hint: 'Lysner og åpner blikket.' },
                  { key: 'eyeWhiteness', label: 'Hvitere øyne', profileKey: 'eyeWhitenessProfile' as const, hint: 'Fjerner røde og gule toner i det hvite i øyet.' },
                ].map((slider) => {
                  const key = slider.key as
                    | 'gfpganQuality'
                    | 'codeformerFidelity'
                    | 'skinTextureGuard'
                    | 'blemishRemoval'
                    | 'teethWhiteness'
                    | 'eyeBrightness'
                    | 'eyeWhiteness';
                  const profileKey = slider.profileKey;
                  // gfpganQuality and codeformerFidelity stay global even
                  // when a face is active — they are whole-image face-
                  // restoration knobs, not per-face portrait sliders.
                  const isFaceScopable =
                    key !== 'gfpganQuality' && key !== 'codeformerFidelity';
                  const faceScoped = isFaceScopable && activeFaceIndex != null;
                  const currentValue = faceScoped
                    ? readPortraitValue(key as PortraitKey)
                    : (settings[key] as number);
                  const currentProfile = profileKey
                    ? (faceScoped ? readProfileValue(profileKey) : settings[profileKey])
                    : undefined;
                  return (
                    <Box key={slider.key}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Tooltip title={slider.hint} placement="top" arrow>
                          <Typography
                            variant="caption"
                            sx={{ borderBottom: '1px dotted', borderColor: 'text.secondary', cursor: 'help' }}
                          >
                            {slider.label}
                          </Typography>
                        </Tooltip>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {profileKey && (
                            <Stack direction="row" spacing={0.25}>
                              {INTENSITY_PROFILES.map((p) => {
                                const active = currentProfile === p;
                                const label = p === 'subtle' ? 'S' : p === 'normal' ? 'N' : '+';
                                return (
                                  <Chip
                                    key={p}
                                    clickable
                                    size="small"
                                    label={label}
                                    title={p}
                                    color={active ? 'primary' : 'default'}
                                    variant={active ? 'filled' : 'outlined'}
                                    sx={{ height: 20, minWidth: 24, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }}
                                    onClick={() => {
                                      if (faceScoped) {
                                        writeProfileValue(profileKey, p);
                                      } else {
                                        setSettings((previous) => ({ ...previous, [profileKey]: p }));
                                      }
                                    }}
                                  />
                                );
                              })}
                            </Stack>
                          )}
                          <Typography variant="caption">{currentValue}</Typography>
                        </Stack>
                      </Stack>
                      <Slider
                        value={currentValue}
                        min={0}
                        max={100}
                        onChange={(_, value) => {
                          const numericValue = Array.isArray(value) ? value[0] : value;
                          if (faceScoped) {
                            writePortraitValue(key as PortraitKey, numericValue);
                          } else {
                            setSettings((previous) => ({ ...previous, [key]: numericValue }));
                          }
                        }}
                        onChangeCommitted={() =>
                          commitActiveHistory(
                            faceScoped ? `Ansikt #${(activeFaceIndex ?? 0) + 1}` : 'Portrett',
                          )
                        }
                      />
                    </Box>
                  );
                })}

                <FormControl fullWidth size="small">
                  <InputLabel id="enhancer-scale-label">Oppskalering</InputLabel>
                  <Select
                    labelId="enhancer-scale-label"
                    label="Oppskalering"
                    value={settings.realesrganScale}
                    onChange={(event) => setSettings((previous) => ({ ...previous, realesrganScale: Number(event.target.value) }))}
                  >
                    {[2, 3, 4].map((scale) => (
                      <MenuItem key={scale} value={scale}>
                        {scale}× større
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="enhancer-subject-label">Kategori-look</InputLabel>
                  <Select
                    labelId="enhancer-subject-label"
                    label="Kategori-look"
                    value={settings.subject}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        subject: event.target.value as SubjectKind,
                      }))
                    }
                  >
                    {SUBJECT_KINDS.map((kind) => (
                      <MenuItem key={kind || 'auto'} value={kind}>
                        {SUBJECT_LABELS[kind]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {settings.subject && settings.subject !== 'portrait' && settings.subject !== 'group_portrait' && settings.subject !== 'other' && (
                  <Box>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption">Kategori-look styrke</Typography>
                      <Typography variant="caption">{settings.subjectLookStrength}</Typography>
                    </Stack>
                    <Slider
                      value={settings.subjectLookStrength}
                      min={0}
                      max={100}
                      onChange={(_, value) => {
                        const numericValue = Array.isArray(value) ? value[0] : value;
                        setSettings((previous) => ({ ...previous, subjectLookStrength: numericValue }));
                      }}
                      onChangeCommitted={() => commitActiveHistory('Kategori-styrke')}
                    />
                  </Box>
                )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Accordion
                  disableGutters
                  square
                  elevation={0}
                  sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 'auto' }}>
                    <Stack spacing={0}>
                      <Typography variant="subtitle2">Farge &amp; look</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Avansert — fargebånd og fargefilter (LUT)
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <Stack spacing={2}>
                <HSLColorPanel
                  value={settings.hsl}
                  onChange={(next) => setSettings((previous) => ({ ...previous, hsl: next }))}
                  onCommit={(label) => commitActiveHistory(label ?? 'HSL')}
                  onEyedropperStart={handleEyedropperStart}
                  eyedropperActive={eyedropperActive}
                  sampledPixel={sampledPixel}
                />

                <LUTPanel
                  value={settings.lut}
                  onChange={(next) => setSettings((previous) => ({ ...previous, lut: next }))}
                  onCommit={(label) => commitActiveHistory(label ?? 'LUT')}
                  thumbnails={lutThumbnails}
                  onRegistryLoaded={setLutRegistry}
                  recentNames={recentLutNames}
                  onUpload={async (file) => {
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('ownerUserId', 'default');
                    await apiRequest('/api/photo-enhancer/luts', {
                      method: 'POST',
                      body: fd,
                    });
                  }}
                  onDelete={async (lutId) => {
                    await apiRequest(
                      `/api/photo-enhancer/luts/${encodeURIComponent(lutId)}?ownerUserId=default`,
                      { method: 'DELETE' },
                    );
                  }}
                />
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {[
                    { key: 'swinir', label: 'Støyfjerning' },
                    { key: 'bsrgan', label: 'Detalj-boost' },
                    { key: 'diffbir', label: 'AI-rekonstruksjon' },
                    { key: 'faceOnlyCrop', label: 'Kun ansikt' },
                    { key: 'preserveBackground', label: 'Behold bakgrunn' },
                  ].map((toggle) => {
                    const key = toggle.key as 'swinir' | 'bsrgan' | 'diffbir' | 'faceOnlyCrop' | 'preserveBackground';
                    return (
                      <Chip
                        key={toggle.key}
                        clickable
                        size="small"
                        label={toggle.label}
                        color={settings[key] ? 'primary' : 'default'}
                        variant={settings[key] ? 'filled' : 'outlined'}
                        onClick={() => setSettings((previous) => ({ ...previous, [key]: !previous[key] }))}
                      />
                    );
                  })}
                </Stack>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip size="small" label={`Kø: ${queueCounts.queued || 0} venter`} />
                      <Chip size="small" label={`Kjører: ${queueCounts.running || 0}`} color={(queueCounts.running || 0) > 0 ? 'info' : 'default'} />
                      <Chip size="small" label={queueRuntime?.paused ? 'Kø pauset' : 'Kø aktiv'} color={queueRuntime?.paused ? 'warning' : 'success'} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {processingOptions?.executionNote || 'Store filer behandles server-side med audit, retry og jobbmanifest.'}
                    </Typography>
                  </Stack>
                </Paper>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  <Tooltip title="Angre (⌘Z)">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!session.activeCanUndo}
                        onClick={() => {
                          const id = session.active?.id;
                          if (id) session.undoHistory(id);
                        }}
                      >
                        <UndoIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Gjør om (⌘⇧Z)">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!session.activeCanRedo}
                        onClick={() => {
                          const id = session.active?.id;
                          if (id) session.redoHistory(id);
                        }}
                      >
                        <RedoIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button variant="outlined" onClick={() => void runAnalysis()} disabled={!visionFile || analyzeMutation.isPending}>
                    Analyze
                  </Button>
                  <Button
                    variant={visionFile && !aiSuggestion ? 'contained' : 'outlined'}
                    color="secondary"
                    onClick={() => void runSuggestRecipe()}
                    disabled={!visionFile || suggestRecipeMutation.isPending}
                    title="Be Claude Vision foreslå verdier for alle slidere basert på bildet"
                  >
                    {suggestRecipeMutation.isPending ? 'Spør AI…' : 'AI-forslag'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void runVariants()}
                    disabled={!visionFile || variantsLoading}
                    title="Lag 3 varianter (Naturlig / Livlig / Sort-hvitt) og velg den beste"
                  >
                    Varianter
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setFrequencySepOpen(true)}
                    disabled={!uploadedImage}
                    title="Åpne frekvens-separert retusj (pore-bevarende, stylus + trykk)"
                  >
                    Frekvens-retusj
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setObjectRemovalOpen(true)}
                    disabled={!uploadedImage || !originalImageUrl}
                    title="Mal over blits/kabel/stativ — Claude planlegger fyll, server utfører"
                  >
                    Fjern objekter
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => setAutoDetectorOpen(true)}
                    disabled={!uploadedImage || !originalImageUrl}
                    title="Claude finner studio-utstyr selv — du krysser av hva som skal fjernes"
                  >
                    Auto-finn objekter
                  </Button>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Beskriv ønsket look — AI setter innstillingene
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="F.eks. varm, luftig pastell film-look"
                      value={editInstruction}
                      onChange={(event) => setEditInstruction(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          editInstruction.trim() &&
                          visionFile &&
                          !suggestRecipeMutation.isPending
                        ) {
                          void runStyleInstruction();
                        }
                      }}
                      disabled={!visionFile || suggestRecipeMutation.isPending}
                    />
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => void runStyleInstruction()}
                      disabled={!visionFile || !editInstruction.trim() || suggestRecipeMutation.isPending}
                      startIcon={<AutoFixHighIcon fontSize="small" />}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Bruk
                    </Button>
                  </Stack>
                </Stack>

                <Box
                  sx={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 3,
                    pt: 1.5,
                    pb: 1,
                    mt: 0.5,
                    bgcolor: 'background.paper',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={() => void runEnhancement()}
                    disabled={!uploadedImage || enhanceMutation.isPending}
                    startIcon={<AutoFixHighIcon />}
                    sx={{ py: 1.25, fontWeight: 700 }}
                  >
                    {enhanceMutation.isPending ? 'Forbedrer…' : 'Enhance'}
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Forhåndsvisningen er omtrentlig — Enhance kjører full forbedring (ansiktsretusj, detaljer og oppskalering) for endelig kvalitet.
                </Typography>

                {aiSuggestion && (
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                        <Chip
                          size="small"
                          label={`AI: ${aiSuggestion.subject.replace('_', ' ')}`}
                          color={aiSuggestion.subject === 'non_portrait' ? 'default' : 'primary'}
                        />
                        <Chip
                          size="small"
                          label={`${Math.round(aiSuggestion.confidence * 100)}% sikker`}
                          color={aiSuggestion.confidence < 0.35 ? 'warning' : 'success'}
                          variant={aiSuggestion.confidence < 0.35 ? 'filled' : 'outlined'}
                        />
                        {aiSuggestion.confidence < 0.35 && (
                          <Typography variant="caption" color="warning.main">
                            Lav sikkerhet — verifiser manuelt før du enhancer.
                          </Typography>
                        )}
                      </Stack>
                      {aiSuggestion.rationale && (
                        <Typography variant="caption" color="text.secondary">
                          {aiSuggestion.rationale}
                        </Typography>
                      )}
                      {aiSuggestion.observations.length > 0 && (
                        <Box component="ul" sx={{ m: 0, pl: 2 }}>
                          {aiSuggestion.observations.map((obs, idx) => (
                            <Typography key={idx} component="li" variant="caption" color="text.secondary">
                              {obs}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                )}
                {suggestRecipeMutation.isError && (
                  <Typography variant="caption" color="error">
                    {suggestRecipeMutation.error instanceof Error
                      ? `AI-forslag feilet: ${suggestRecipeMutation.error.message}`
                      : 'AI-forslag feilet.'}
                  </Typography>
                )}

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

                {queueJob ? (
                  <Paper variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Box>
                          <Typography variant="subtitle2">Server-jobb</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {queueJob.id.slice(0, 8)} · {queueJob.status} · {queueJob.attempts || 0}/{queueJob.maxAttempts || 1} forsøk
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`${Math.round(queueJob.progress || 0)}%`}
                          color={queueJob.status === 'completed' ? 'success' : queueJob.status === 'failed' ? 'error' : 'info'}
                        />
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, queueJob.progress || 0))}
                        color={queueJob.status === 'failed' ? 'error' : queueJob.status === 'completed' ? 'success' : 'primary'}
                      />
                      {queueJob.failureReason ? (
                        <Alert severity="warning">{queueJob.failureReason}</Alert>
                      ) : null}
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={queueActionPending || !['queued', 'running', 'paused'].includes(queueJob.status)}
                          onClick={() => void runQueueJobAction('cancel')}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={queueActionPending || queueJob.status !== 'queued'}
                          onClick={() => void runQueueJobAction('pause')}
                        >
                          Pause
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={queueActionPending || queueJob.status !== 'paused'}
                          onClick={() => void runQueueJobAction('resume')}
                        >
                          Resume
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={queueActionPending || !['failed', 'cancelled'].includes(queueJob.status)}
                          onClick={() => void runQueueJobAction('retry')}
                        >
                          Retry
                        </Button>
                      </Stack>
                      {queueJob.timeline?.[0] ? (
                        <Typography variant="caption" color="text.secondary">
                          Siste hendelse: {queueJob.timeline[0].message}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Paper>
                ) : null}

                {analyzeMutation.isError ? renderEnhancerError(analyzeMutation.error, 'Analyse') : null}

                {enhanceMutation.isError ? renderEnhancerError(enhanceMutation.error, 'Forbedring') : null}

                {analysisResult ? (
                  <Alert severity="success" icon={<AssessmentIcon />}>
                    Analyse fullført
                    {toRecord(analysisResult.analysis).perceptualHash ? ' · bilde gjenkjent' : ''}
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
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => setCullOpen(true)}
                    disabled={session.state.images.length === 0}
                  >
                    Cull-modus
                  </Button>
                </Stack>

                <FormControlLabelSwitch
                  label="Composition guides"
                  checked={showCompositionGuides}
                  onChange={(checked) => setShowCompositionGuides(checked)}
                />
              </Stack>

              <Box sx={{ mb: 1 }}>
                <FaceChipStrip
                  faces={session.active?.faces}
                  status={session.active?.faceStatus ?? 'idle'}
                  activeFaceIndex={session.state.activeFaceIndex}
                  faceIndicesWithOverrides={Object.keys(session.active?.perFaceOverrides ?? {}).map(Number)}
                  onSelect={(face) => {
                    setFocusedFace(face);
                    session.setActiveFaceIndex(face?.index ?? null);
                  }}
                />
              </Box>

              {!originalImageUrl ? (
                <Box
                  onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={onPreviewDrop}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.5,
                    minHeight: 420,
                    textAlign: 'center',
                    color: 'text.secondary',
                    border: '2px dashed',
                    borderColor: isDragOver ? 'primary.main' : 'rgba(148,163,184,0.35)',
                    bgcolor: isDragOver ? 'action.hover' : 'transparent',
                    borderRadius: 2,
                    p: 4,
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <AddPhotoIcon sx={{ fontSize: 56, opacity: 0.45 }} />
                  <Typography variant="h6" sx={{ color: 'text.primary' }}>
                    {isDragOver ? 'Slipp bildet her' : 'Last opp et bilde for å starte'}
                  </Typography>
                  <Typography variant="body2" sx={{ maxWidth: 380 }}>
                    Dra bildet rett hit, eller bruk «Last opp bilde». Deretter kan du la{' '}
                    <strong>AI-forslag</strong> sette anbefalte verdier automatisk, eller justere selv
                    før du trykker <strong>Enhance</strong>.
                  </Typography>
                </Box>
              ) : (
                <Box
                  onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={onPreviewDrop}
                  sx={{
                    position: 'relative',
                    minHeight: 420,
                    border: '1px solid',
                    borderColor: isDragOver ? 'primary.main' : eyedropperActive ? 'primary.main' : focusedFace ? 'primary.light' : '#e5e7eb',
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: eyedropperActive ? 'crosshair' : 'default',
                    '& > .face-zoom-layer': focusedFace
                      ? {
                          transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: (() => {
                            const t = computeFocusTransform(focusedFace.box, 1, 1);
                            return `scale(${t.scale}) translate(${t.translateXPct}%, ${t.translateYPct}%)`;
                          })(),
                          transformOrigin: '50% 50%',
                        }
                      : {
                          transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: 'none',
                        },
                  }}
                  onClick={(event) => {
                    if (!eyedropperActive) return;
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    const normX = (event.clientX - rect.left) / rect.width;
                    const normY = (event.clientY - rect.top) / rect.height;
                    handlePreviewPixelPick(normX, normY);
                  }}
                >
                  {enhanceMutation.isPending && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        color: '#fff',
                        bgcolor: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(2px)',
                      }}
                    >
                      <CircularProgress color="inherit" />
                      <Typography variant="body2">Forbedrer bildet…</Typography>
                    </Box>
                  )}
                  <Box className="face-zoom-layer" sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 420 }}>
                  {viewMode === 'single' && (
                    enhancedImageUrl ? (
                      <ImagePreview
                        src={compareOverrideUrl || enhancedImageUrl}
                        alt={compareOverrideUrl ? 'Original' : 'Enhanced'}
                        onLoad={onImageLoaded}
                        showCompositionGuides={showCompositionGuides}
                        compositionAnalysis={compositionAnalysis}
                      />
                    ) : (
                      <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 420 }}>
                        <RealtimePreviewCanvas
                          imageUrl={originalImageUrl}
                          settings={settings}
                          lutAtlas={lutAtlas}
                          lutStrength={settings.lut.strength}
                          lutTonalMix={settings.lut.tonalMix}
                          alt="Live preview"
                        />
                        <Chip
                          size="small"
                          label="Live preview · approximate"
                          color="info"
                          variant="filled"
                          sx={{ position: 'absolute', top: 8, left: 8, opacity: 0.9 }}
                        />
                      </Box>
                    )
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
                </Box>
              )}

              {session.state.images.length > 1 ? (
                <Box sx={{ mt: 1.5 }}>
                  <Filmstrip
                    images={session.state.images}
                    selectedId={session.state.selectedId}
                    multiSelectIds={session.state.multiSelectIds}
                    onSelect={(id, event) => {
                      if (event.shiftKey && session.state.selectedId) {
                        session.selectRange(session.state.selectedId, id);
                      } else if (event.metaKey || event.ctrlKey) {
                        session.toggleMultiSelect(id, true);
                      } else {
                        session.selectImage(id);
                      }
                    }}
                    onRemove={(id) => session.removeImage(id)}
                  />
                </Box>
              ) : null}

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
                      <Typography variant="subtitle2">Tilgjengelige forbedringer</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {modelRegistry.slice(0, 8).map((model) => (
                        <Chip
                          key={model.id}
                          size="small"
                          label={plainModelLabel(model.displayName || model.id)}
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
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadEnhanced}
                  disabled={!enhancedImageUrl}
                >
                  Last ned
                </Button>
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
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => setExportDialogOpen(true)}
                  disabled={session.state.images.length === 0}
                >
                  Eksporter {session.state.images.length > 1 ? `(${session.state.images.length})` : ''}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={variantsOpen} onClose={() => setVariantsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Velg en variant</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {ENHANCE_VARIANTS.map((variant) => {
              const result = variants.find((entry) => entry.key === variant.key);
              return (
                <Grid item xs={12} sm={4} key={variant.key}>
                  <Stack spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'action.hover',
                      }}
                    >
                      {variantsLoading || !result ? (
                        <CircularProgress size={28} />
                      ) : result.url ? (
                        <img
                          src={result.url}
                          alt={variant.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Typography variant="caption" color="error">
                          Feilet
                        </Typography>
                      )}
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      disabled={!result?.url}
                      onClick={() => result && applyVariant(result)}
                    >
                      {variant.label}
                    </Button>
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariantsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={saveLookDialogOpen} onClose={() => setSaveLookDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Lagre Look</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Navn på Look"
            placeholder="F.eks. Varm bryllup"
            value={lookName}
            onChange={(event) => setLookName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && lookName.trim()) confirmSaveLook();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveLookDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" disabled={!lookName.trim()} onClick={confirmSaveLook}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={Boolean(shortcutsAnchor)}
        anchorEl={shortcutsAnchor}
        onClose={() => setShortcutsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, maxWidth: 300 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hurtigtaster
          </Typography>
          <Stack spacing={0.5}>
            {[
              ['1–5', 'Gi stjerner til bildet'],
              ['0', 'Fjern rating'],
              ['P / X / U', 'Marker / forkast / fjern markering'],
              ['← / →', 'Forrige / neste bilde'],
              ['Hold \\', 'Sammenlign med original'],
              ['⌘Z / ⌘⇧Z', 'Angre / gjør om'],
              ['⌘⇧C', 'Kopier justeringer'],
            ].map(([keys, desc]) => (
              <Stack key={keys} direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {keys}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                  {desc}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Popover>

      <ExportPresetDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        preset={
          session.state.exportPresets.find((p) => p.id === session.state.activeExportPresetId) ?? null
        }
        images={session.state.images}
        projectName={projects.find((p) => p.id === selectedProjectId)?.name}
        clientName={undefined}
        photographerId={
          typeof window !== 'undefined'
            ? localStorage.getItem('userId') || undefined
            : undefined
        }
        onSavePreset={(preset: ExportPreset) => {
          const exists = session.state.exportPresets.some((p) => p.id === preset.id);
          if (exists) session.dispatch({ type: 'UPDATE_EXPORT_PRESET', preset });
          else session.dispatch({ type: 'ADD_EXPORT_PRESET', preset });
          session.dispatch({ type: 'SELECT_EXPORT_PRESET', presetId: preset.id });
        }}
        onDeletePreset={(presetId) => session.dispatch({ type: 'REMOVE_EXPORT_PRESET', presetId })}
      />

      <CullView
        open={cullOpen}
        onClose={() => setCullOpen(false)}
        state={session.state}
        activeId={session.active?.id ?? null}
        onSelect={(id) => session.selectImage(id)}
        onRating={(id, rating) => session.setRating(id, rating)}
        onFlag={(id, flag) => session.setFlag(id, flag)}
        onApplyRatingToBurst={(burstId, rating) => session.applyRatingToBurst(burstId, rating)}
        onApplyFlagToBurst={(burstId, flag) => session.applyFlagToBurst(burstId, flag)}
        onFilterChange={(filter) => session.setCullFilter(filter)}
      />

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

      <FrequencySepDialog
        open={frequencySepOpen}
        source={uploadedImage}
        originalFilename={uploadedImage?.name}
        onApply={handleFrequencySepApply}
        onClose={() => setFrequencySepOpen(false)}
      />

      <Dialog
        open={objectRemovalOpen && Boolean(originalImageUrl)}
        onClose={() => setObjectRemovalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        {originalImageUrl && (
          <ObjectRemovalEditor
            imageUrl={originalImageUrl}
            onApply={handleObjectRemovalApply}
            onClose={() => setObjectRemovalOpen(false)}
          />
        )}
      </Dialog>

      <Dialog
        open={autoDetectorOpen && Boolean(originalImageUrl)}
        onClose={() => setAutoDetectorOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {originalImageUrl && (
          <AutoDistractionDetector
            imageUrl={originalImageUrl}
            onApply={handleAutoDetectApply}
            onClose={() => setAutoDetectorOpen(false)}
          />
        )}
      </Dialog>
    </Box>
  );
}

/**
 * Turn a mutation error into a user-facing alert. Detects the specific
 * RAW-conversion-unavailable case (the Render deployment is missing
 * dcraw — see A4 audit) and routes it to a friendlier message with
 * actionable guidance instead of exposing the 422 status string.
 */
function renderEnhancerError(err: unknown, action: string): React.ReactNode {
  const message = err instanceof Error ? err.message : `${action} feilet.`;
  const lower = message.toLowerCase();

  // RAW-specific path. The backend returns 422 with body
  // `{error: "raw_conversion_unavailable"}` when dcraw / ImageMagick /
  // darktable are all missing on the server — which is the current
  // Render state (A4 audit 2026-04-22). Guide Daniel to re-upload as
  // JPEG so he isn't stuck on a blank error.
  if (lower.includes('raw_conversion_unavailable') || lower.includes('raw_image_required')) {
    return (
      <Alert severity="warning">
        <Typography variant="body2" fontWeight={600}>
          RAW-konvertering er ikke aktivert på serveren
        </Typography>
        <Typography variant="body2">
          Last opp en JPEG eller PNG i stedet — kameraet produserer
          en JPEG-sidecar ved siden av CR3-filen som du kan bruke.
          RAW-støtte kommer når backend-boksen får dcraw installert.
        </Typography>
      </Alert>
    );
  }

  return <Alert severity="error">{message}</Alert>;
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
