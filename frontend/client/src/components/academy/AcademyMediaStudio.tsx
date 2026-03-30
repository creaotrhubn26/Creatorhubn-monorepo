import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  CheckCircle,
  CloudDownload,
  CloudUpload,
  DeleteOutline,
  Description,
  Download,
  DriveFileMove,
  Favorite,
  FavoriteBorder,
  FilterList,
  Folder,
  FolderOpen,
  Image,
  InfoOutlined,
  Link as LinkIcon,
  Lock,
  MailOutline,
  MoreHoriz,
  Movie,
  MusicNote,
  NotificationsNone,
  PlayArrow,
  Save,
  Search,
  Sync,
  Upload,
  ViewList,
  ViewModule,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useAcademy, type Course, type CourseResource, type LessonResource } from '@/contexts/AcademyContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademyLocale } from './academyLocale';
import AcademyLocaleSwitcher from './AcademyLocaleSwitcher';
import AcademyLeftSidebar from './AcademyLeftSidebar';
import AcademyStudentSidebar from './AcademyStudentSidebar';
import { probeVideoDurationSeconds } from './academyVideoSourceUtils';
import { apiRequest } from '@/lib/queryClient';
import {
  buildMediaUploadFingerprint,
  buildUrlMediaFingerprint,
  extractMediaDisplayName,
  normalizeMediaAssetId,
  normalizeMediaVersion,
  resolveLinkedVideoVersionState,
} from '@/utils/academyMediaLinkUtils';

type MediaAssetType = 'image' | 'video' | 'audio' | 'document';
type AssetScope = 'all' | 'favorites' | 'upload';
type AssetGridMode = 'grid' | 'list';
type FolderId = string;

interface FolderDefinition {
  id: FolderId;
  label: string;
  tags?: string[];
  custom?: boolean;
}

interface MediaAsset {
  id: string;
  name: string;
  type: MediaAssetType;
  url: string;
  posterUrl?: string;
  size: number;
  duration?: number;
  updatedAt: string;
  tags: string[];
  isFavorite: boolean;
  source: 'course' | 'lesson' | 'resource' | 'upload';
  courseId?: string;
  lessonId?: string;
  locked?: boolean;
  version?: number;
  fingerprint?: string;
}

interface AcademyStoredMediaAssetPayload {
  id: string;
  name: string;
  type: MediaAssetType;
  url: string;
  posterUrl?: string;
  size: number;
  duration?: number;
  updatedAt: string;
  tags: string[];
  source?: 'upload' | 'resource' | 'course' | 'lesson';
  courseId?: string;
  lessonId?: string;
  version?: number;
  fingerprint?: string;
}

interface AcademyStoredMediaUploadResponse {
  assets: AcademyStoredMediaAssetPayload[];
}

interface AcademyStoredMediaReplaceResponse {
  asset: AcademyStoredMediaAssetPayload;
}

interface AcademyMediaStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

type PendingMediaBindingMode = 'video' | 'resource';
type UploadDialogMode = 'new' | 'replace-selected';

const panelSx = {
  borderRadius: 1.4,
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.09)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 84% 18%, rgba(245,166,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,25,36,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 16% 84%, rgba(245,166,35,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 74% 12%, rgba(114,158,225,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 72% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,24,34,0.92), rgba(10,12,20,0.98)), radial-gradient(circle at 20% 22%, rgba(92,180,128,0.2), rgba(0,0,0,0))',
];

const defaultFolderDefinitions: FolderDefinition[] = [
  { id: 'all', label: 'All Folders' },
  { id: 'course-materials', label: 'Course Materials', tags: ['course-materials', 'course'] },
  { id: 'lesson-videos', label: 'Lesson Videos', tags: ['lesson-videos', 'lesson'] },
  { id: 'tutorials', label: 'Tutorials', tags: ['tutorials'] },
  { id: 'quiz-assets', label: 'Quiz Assets', tags: ['quiz-assets', 'quiz'] },
  { id: 'certificates', label: 'Certificates', tags: ['certificates', 'certificate'] },
];

const MEDIA_CUSTOM_FOLDERS_STORAGE_KEY = 'academyMediaCustomFolders';
const MEDIA_CUSTOM_FOLDERS_KV_KEY = 'academy_media_custom_folders_v1';
const RESOURCE_FOLDER_TAG_REGEX = /\[folder:([a-z0-9-]+)\]/i;
const RESOURCE_SOURCE_TAG_REGEX = /\[source:(upload|resource)\]/i;

const toDisplayName = (value: string, fallback = 'Student'): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  const base = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  const parts = base
    .replace(/[._]+/g, '-')
    .split('-')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const sanitizeCustomFolders = (value: unknown): FolderDefinition[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as Partial<FolderDefinition>)
    .filter((item) => typeof item.id === 'string' && typeof item.label === 'string')
    .map((item) => ({
      id: String(item.id),
      label: String(item.label),
      tags:
        Array.isArray(item.tags) && item.tags.length > 0
          ? item.tags.map((tag) => String(tag))
          : [String(item.id).replace(/^custom-/, '')],
      custom: true,
    }));
};

const readCustomFoldersFromDb = async (): Promise<FolderDefinition[] | null> => {
  try {
    const response = await fetch(`/api/user/kv/${encodeURIComponent(MEDIA_CUSTOM_FOLDERS_KV_KEY)}`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const value =
      payload && typeof payload === 'object'
        ? (payload.value ?? payload.data ?? null)
        : null;
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return sanitizeCustomFolders(parsed);
  } catch {
    return null;
  }
};

const writeCustomFoldersToDb = async (folders: FolderDefinition[]): Promise<void> => {
  try {
    await fetch('/api/user/kv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: MEDIA_CUSTOM_FOLDERS_KV_KEY, value: folders }),
    });
  } catch {
    // Ignore persistence errors to avoid blocking media workflows.
  }
};

const mapResourceType = (type: CourseResource['type'] | LessonResource['type']): MediaAssetType => {
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'document';
};

const toCourseResourceType = (type: MediaAssetType): CourseResource['type'] => {
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'pdf';
};

const resolveResourceMetadata = (description: string | undefined) => {
  const folderMatch = description?.match(RESOURCE_FOLDER_TAG_REGEX);
  const sourceMatch = description?.match(RESOURCE_SOURCE_TAG_REGEX);
  return {
    folderTag: folderMatch?.[1] || null,
    source: sourceMatch?.[1] === 'upload' ? 'upload' : 'resource',
  } as const;
};

const withFolderTag = (description: string | undefined, folderTag: string): string => {
  const withoutFolderTag = (description || '').replace(RESOURCE_FOLDER_TAG_REGEX, '').trim();
  return `[folder:${folderTag}] ${withoutFolderTag}`.trim();
};

const formatBytes = (value: number): string => {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(1)} KB`;
  if (safe < 1024 * 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
  return `${(safe / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const normalizeAssetUrl = (value: string | undefined | null): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const normalized =
      typeof window !== 'undefined'
        ? new URL(raw, window.location.origin)
        : new URL(raw, 'https://academy.local');
    return normalized.toString();
  } catch {
    return raw;
  }
};

const toAssetTypeFromFile = (file: File): MediaAssetType => {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};

const normalizeStoredMediaAssetPayload = (
  payload: AcademyStoredMediaAssetPayload,
): MediaAsset => ({
  id: String(payload.id || '').trim(),
  name: String(payload.name || '').trim() || 'Uploaded asset',
  type: payload.type,
  url: String(payload.url || '').trim(),
  posterUrl: String(payload.posterUrl || '').trim() || undefined,
  size: Number(payload.size || 0),
  duration:
    Number.isFinite(Number(payload.duration)) && Number(payload.duration) > 0
      ? Number(payload.duration)
      : undefined,
  updatedAt: String(payload.updatedAt || '').trim() || new Date().toISOString(),
  tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag)).filter(Boolean) : [],
  isFavorite: false,
  source: payload.source === 'upload' ? 'upload' : 'upload',
  courseId: String(payload.courseId || '').trim() || undefined,
  lessonId: String(payload.lessonId || '').trim() || undefined,
  locked: false,
  version: normalizeMediaVersion(payload.version, 1),
  fingerprint: String(payload.fingerprint || '').trim() || undefined,
});

const uploadFilesToAcademyMediaStore = async (params: {
  files: File[];
  folderId: string;
  courseId?: string;
  lessonId?: string;
}): Promise<MediaAsset[]> => {
  const formData = new FormData();
  params.files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('folderId', params.folderId);
  if (params.courseId) {
    formData.append('courseId', params.courseId);
  }
  if (params.lessonId) {
    formData.append('lessonId', params.lessonId);
  }
  const response = (await apiRequest('/api/academy/media-assets/upload', {
    method: 'POST',
    body: formData,
  })) as AcademyStoredMediaUploadResponse;
  return Array.isArray(response.assets)
    ? response.assets.map((asset) => normalizeStoredMediaAssetPayload(asset))
    : [];
};

const replaceAcademyMediaAsset = async (params: {
  assetId: string;
  file: File;
  currentAsset: MediaAsset;
  folderId?: string;
  courseId?: string;
  lessonId?: string;
}): Promise<MediaAsset> => {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('name', params.currentAsset.name);
  formData.append('type', params.currentAsset.type);
  formData.append('currentVersion', String(normalizeMediaVersion(params.currentAsset.version, 1)));
  if (params.folderId) {
    formData.append('folderId', params.folderId);
  }
  if (params.courseId) {
    formData.append('courseId', params.courseId);
  }
  if (params.lessonId) {
    formData.append('lessonId', params.lessonId);
  }
  params.currentAsset.tags.forEach((tag) => {
    formData.append('tags', tag);
  });
  const response = (await apiRequest(
    `/api/academy/media-assets/${encodeURIComponent(params.assetId)}/replace`,
    {
      method: 'POST',
      body: formData,
    },
  )) as AcademyStoredMediaReplaceResponse;
  return normalizeStoredMediaAssetPayload(response.asset);
};

const getAssetIcon = (type: MediaAssetType) => {
  if (type === 'image') return <Image fontSize="small" />;
  if (type === 'video') return <Movie fontSize="small" />;
  if (type === 'audio') return <MusicNote fontSize="small" />;
  return <Description fontSize="small" />;
};

const resolveAssetPreviewImageUrl = (asset: MediaAsset): string => {
  if (asset.type === 'image') {
    return String(asset.url || '').trim();
  }
  return String(asset.posterUrl || '').trim();
};

const buildAssetsFromCourse = (course: Course): MediaAsset[] => {
  const collected = new Map<string, MediaAsset>();
  const now = new Date().toISOString();
  const courseId = String(course.id);

  const mergeAsset = (asset: MediaAsset) => {
    if (!asset.id || !asset.url) return;
    const existing = collected.get(asset.id);
    if (!existing) {
      collected.set(asset.id, asset);
      return;
    }

    const existingUpdatedAt = Date.parse(existing.updatedAt || '');
    const nextUpdatedAt = Date.parse(asset.updatedAt || '');
    const nextVersion = normalizeMediaVersion(asset.version, 1);
    const existingVersion = normalizeMediaVersion(existing.version, 1);
    const shouldPromotePrimary =
      nextVersion > existingVersion ||
      (nextVersion === existingVersion &&
        Number.isFinite(nextUpdatedAt) &&
        (!Number.isFinite(existingUpdatedAt) || nextUpdatedAt > existingUpdatedAt));

    collected.set(asset.id, {
      ...(shouldPromotePrimary ? existing : asset),
      ...(shouldPromotePrimary ? asset : existing),
      id: existing.id,
      posterUrl: asset.posterUrl || existing.posterUrl,
      tags: Array.from(new Set([...(existing.tags || []), ...(asset.tags || [])])),
      isFavorite: existing.isFavorite || asset.isFavorite,
      locked: existing.locked || asset.locked,
      courseId: existing.courseId || asset.courseId,
      lessonId: existing.lessonId || asset.lessonId,
      duration: Number(asset.duration || 0) || Number(existing.duration || 0),
      version: Math.max(existingVersion, nextVersion),
      fingerprint: asset.fingerprint || existing.fingerprint,
      name:
        existing.source === 'resource' || existing.source === 'upload'
          ? existing.name
          : asset.source === 'resource' || asset.source === 'upload'
            ? asset.name
            : existing.name.length >= asset.name.length
              ? existing.name
              : asset.name,
      source:
        existing.source === 'upload' || asset.source === 'upload'
          ? 'upload'
          : existing.source === 'resource' || asset.source === 'resource'
            ? 'resource'
            : existing.source,
    });
  };

  if (course.thumbnail) {
    mergeAsset({
      id: `${courseId}-thumbnail`,
      name: `${course.title} Thumbnail`,
      type: 'image',
      url: course.thumbnail,
      size: 2 * 1024 * 1024,
      updatedAt: course.updatedAt || now,
      tags: ['course-materials', 'course', 'thumbnail'],
      isFavorite: false,
      source: 'course',
      courseId,
      version: 1,
      fingerprint: buildUrlMediaFingerprint(course.thumbnail),
    });
  }

  if (course.videoUrl) {
    const assetId =
      normalizeMediaAssetId(course.linkedVideoAssetId) || `${courseId}-video`;
    mergeAsset({
      id: assetId,
      name:
        String(course.linkedVideoAssetName || '').trim() ||
        `${course.title} Intro Video`,
      type: 'video',
      url: course.videoUrl,
      posterUrl: String(course.linkedVideoPosterUrl || '').trim() || undefined,
      size: 18 * 1024 * 1024,
      duration: Number(course.duration || 0),
      updatedAt: String(course.linkedVideoUpdatedAt || '').trim() || course.updatedAt || now,
      tags: ['course-materials', 'course', 'video'],
      isFavorite: true,
      source: 'course',
      courseId,
      version: normalizeMediaVersion(course.linkedVideoAssetVersion, 1),
      fingerprint:
        String(course.linkedVideoFingerprint || '').trim() ||
        buildUrlMediaFingerprint(course.videoUrl),
    });
  }

  const resources = Array.isArray(course.resources) ? course.resources : [];
  resources.forEach((resource, resourceIndex) => {
    const metadata = resolveResourceMetadata(resource.description);
    const folderTag = metadata.folderTag || 'course-materials';
    const assetId =
      normalizeMediaAssetId(resource.mediaAssetId) ||
      `${courseId}-course-resource-${resource.id || resourceIndex}`;
    mergeAsset({
      id: assetId,
      name: resource.title || `Course Resource ${resourceIndex + 1}`,
      type: mapResourceType(resource.type),
      url: resource.url || '',
      posterUrl:
        resource.type === 'video'
          ? String(resource.mediaPosterUrl || '').trim() || undefined
          : undefined,
      size: Number(resource.size || 0),
      updatedAt: String(resource.mediaUpdatedAt || '').trim() || course.updatedAt || now,
      tags: [folderTag, resource.type, ...(metadata.source === 'upload' ? ['uploaded'] : [])],
      isFavorite: false,
      source: metadata.source === 'upload' ? 'upload' : 'resource',
      courseId,
      version: normalizeMediaVersion(resource.mediaVersion, 1),
      fingerprint:
        String(resource.mediaFingerprint || '').trim() ||
        buildUrlMediaFingerprint(resource.url),
    });
  });

  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  lessons.forEach((lesson, lessonIndex) => {
    const lessonId = String(lesson.id || `${courseId}-lesson-${lessonIndex + 1}`);

    if (lesson.videoUrl) {
      const assetId =
        normalizeMediaAssetId(lesson.linkedVideoAssetId) ||
        `${courseId}-${lessonId}-video`;
      mergeAsset({
        id: assetId,
        name:
          String(lesson.linkedVideoAssetName || '').trim() ||
          (lesson.title ? `${lesson.title} Video` : `Lesson ${lessonIndex + 1} Video`),
        type: 'video',
        url: lesson.videoUrl,
        posterUrl: String(lesson.linkedVideoPosterUrl || '').trim() || undefined,
        size: 12 * 1024 * 1024,
        duration: Number(lesson.duration || 0),
        updatedAt:
          String(lesson.linkedVideoUpdatedAt || '').trim() ||
          lesson.updatedAt ||
          course.updatedAt ||
          now,
        tags: ['lesson-videos', 'lesson', ...(lesson.isPreview ? ['preview'] : [])],
        isFavorite: false,
        source: 'lesson',
        courseId,
        lessonId,
        version: normalizeMediaVersion(lesson.linkedVideoAssetVersion, 1),
        fingerprint:
          String(lesson.linkedVideoFingerprint || '').trim() ||
          buildUrlMediaFingerprint(lesson.videoUrl),
      });
    }

    const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
    lessonResources.forEach((resource, resourceIndex) => {
      const metadata = resolveResourceMetadata(resource.description);
      const folderTag = metadata.folderTag || 'lesson-videos';
      const assetId =
        normalizeMediaAssetId(resource.mediaAssetId) ||
        `${courseId}-${lessonId}-resource-${resource.id || resourceIndex}`;
      mergeAsset({
        id: assetId,
        name: resource.title || `${lesson.title || 'Lesson'} Resource ${resourceIndex + 1}`,
        type: mapResourceType(resource.type),
        url: resource.url || '',
        posterUrl:
          resource.type === 'video'
            ? String(resource.mediaPosterUrl || '').trim() || undefined
            : undefined,
        size: Number(resource.size || 0),
        updatedAt:
          String(resource.mediaUpdatedAt || '').trim() ||
          lesson.updatedAt ||
          course.updatedAt ||
          now,
        tags: [folderTag, resource.type, ...(metadata.source === 'upload' ? ['uploaded'] : [])],
        isFavorite: false,
        source: metadata.source === 'upload' ? 'upload' : 'resource',
        courseId,
        lessonId,
        version: normalizeMediaVersion(resource.mediaVersion, 1),
        fingerprint:
          String(resource.mediaFingerprint || '').trim() ||
          buildUrlMediaFingerprint(resource.url),
      });
    });
  });

  return Array.from(collected.values());
};

function AcademyMediaStudio({ courseId, onSave, onCancel }: AcademyMediaStudioProps) {
  const [location, setLocation] = useLocation();
  const { state, getCourse, updateCourse, setCurrentCourse, setCurrentLesson } = useAcademy();
  const { analytics, debugging, auth } = useEnhancedMasterIntegration();
  
  const { tt, navLabel } = useAcademyLocale();

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadIntentModeRef = useRef<UploadDialogMode>('new');
  const routeVideoBindingParams = useMemo<{
    lessonId: string;
    target: 'course' | 'skill';
    returnTo: string;
    audience: string;
  }>(() => {
    if (typeof window === 'undefined') {
      return { lessonId: '', target: 'skill' as const, returnTo: '', audience: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const lessonId = String(params.get('lessonId') || '').trim();
    const target: 'course' | 'skill' = params.get('bind') === 'course' ? 'course' : 'skill';
    const returnToRaw = String(params.get('returnTo') || '').trim();
    const returnTo = /^\/academy(\/|$)/.test(returnToRaw) ? returnToRaw : '';
    const audience = String(params.get('audience') || '').trim().toLowerCase();
    return { lessonId, target, returnTo, audience };
  }, [location]);

  const [scopeTab, setScopeTab] = useState<AssetScope>('all');
  const [typeTab, setTypeTab] = useState<'all' | MediaAssetType>('all');
  const [gridMode, setGridMode] = useState<AssetGridMode>('grid');
  const [folderId, setFolderId] = useState<FolderId>('all');
  const [searchValue, setSearchValue] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [leftNav, setLeftNav] = useState('media');
  const [customFolders, setCustomFolders] = useState<FolderDefinition[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [uploadFolderId, setUploadFolderId] = useState<FolderId>('course-materials');
  const [uploadDialogMode, setUploadDialogMode] = useState<UploadDialogMode>('new');
  const [videoBindingTarget, setVideoBindingTarget] = useState<'course' | 'skill'>(routeVideoBindingParams.target);
  const [videoBindingLessonId, setVideoBindingLessonId] = useState(routeVideoBindingParams.lessonId);
  const [pendingBindingDialogOpen, setPendingBindingDialogOpen] = useState(false);
  const [pendingBindingAssetId, setPendingBindingAssetId] = useState('');
  const [pendingBindingMode, setPendingBindingMode] = useState<PendingMediaBindingMode>('resource');
  const customFoldersHydratedRef = useRef(false);

  const folderDefinitions = useMemo<FolderDefinition[]>(
    () => [...defaultFolderDefinitions, ...customFolders],
    [customFolders],
  );

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [] as Course[];
  }, [state?.courses]);

  const activeCourse = useMemo(() => {
    if (courseId) {
      return getCourse(courseId) || courseItems[0] || null;
    }
    return state.currentCourse || courseItems[0] || null;
  }, [courseId, courseItems, getCourse, state.currentCourse]);

  useEffect(() => {
    if (!activeCourse?.id) return;
    const inState = state.courses.some((course) => String(course.id) === String(activeCourse.id));
    if (!inState) return;
    if (String(state.currentCourse?.id || '') === String(activeCourse.id)) return;
    setCurrentCourse(activeCourse);
  }, [activeCourse, setCurrentCourse, state.courses, state.currentCourse?.id]);

  const activeLesson = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    const requestedLessonId = String(routeVideoBindingParams.lessonId || state.currentLesson?.id || '').trim();
    if (!requestedLessonId) return lessons[0] || state.currentLesson || null;
    return lessons.find((lesson) => String(lesson.id) === requestedLessonId) || state.currentLesson || lessons[0] || null;
  }, [activeCourse?.lessons, routeVideoBindingParams.lessonId, state.currentLesson]);

  useEffect(() => {
    if (!activeLesson?.id) return;
    if (String(state.currentLesson?.id || '') === String(activeLesson.id)) return;
    setCurrentLesson(activeLesson);
  }, [activeLesson, setCurrentLesson, state.currentLesson?.id]);

  const isStudentMode = useMemo(() => {
    if (routeVideoBindingParams.audience === 'student') return true;
    return (
      /\/academy\/student-dashboard(?:\?|$)/.test(routeVideoBindingParams.returnTo) ||
      /\/academy\/player-studio(?:\?|$)/.test(routeVideoBindingParams.returnTo) ||
      /audience=student/.test(routeVideoBindingParams.returnTo)
    );
  }, [routeVideoBindingParams.audience, routeVideoBindingParams.returnTo]);

  const studentBaseReturnTo = routeVideoBindingParams.returnTo || '/academy/student-dashboard';
  const buildStudentRoute = useCallback(
    (
      path: string,
      extra?: Record<string, string | number | null | undefined>,
      overrideReturnTo = studentBaseReturnTo,
    ) => {
      const params = new URLSearchParams();
      const safeCourseId = String(activeCourse?.id || '').trim();
      const safeLessonId = String(activeLesson?.id || '').trim();

      if (safeCourseId) params.set('courseId', safeCourseId);
      if (safeLessonId) params.set('lessonId', safeLessonId);
      params.set('audience', 'student');

      const safeReturnTo = String(overrideReturnTo || '').trim();
      if (safeReturnTo) {
        params.set('returnTo', safeReturnTo);
      }

      Object.entries(extra || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });

      const query = params.toString();
      return query ? `${path}?${query}` : path;
    },
    [activeCourse?.id, activeLesson?.id, studentBaseReturnTo],
  );

  const studentPlayerRoute = useMemo(
    () => buildStudentRoute('/academy/player-studio'),
    [buildStudentRoute],
  );
  const studentAssignmentsRoute = useMemo(
    () => buildStudentRoute('/academy/assignments'),
    [buildStudentRoute],
  );
  const studentName = useMemo(() => {
    const user = auth.state.user as
      | {
          email?: string;
          name?: string;
          firstName?: string;
          id?: string;
        }
      | undefined;
    return toDisplayName(
      String(user?.name || user?.firstName || user?.email || user?.id || ''),
      tt('Student', 'Student'),
    );
  }, [auth.state.user, tt]);

  const sourceAssets = useMemo(() => {
    const fromCourses = courseItems.flatMap((course) => buildAssetsFromCourse(course));
    return fromCourses;
  }, [courseItems]);

  useEffect(() => {
    let cancelled = false;
    const localFolders = (() => {
      try {
        const raw = localStorage.getItem(MEDIA_CUSTOM_FOLDERS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return sanitizeCustomFolders(parsed);
      } catch {
        return [];
      }
    })();

    if (localFolders.length > 0) {
      setCustomFolders(localFolders);
    }

    void (async () => {
      const dbFolders = await readCustomFoldersFromDb();
      if (cancelled) return;

      if (Array.isArray(dbFolders) && dbFolders.length > 0) {
        setCustomFolders(dbFolders);
        try {
          localStorage.setItem(MEDIA_CUSTOM_FOLDERS_STORAGE_KEY, JSON.stringify(dbFolders));
        } catch {
          // Ignore local persistence errors.
        }
      } else if (localFolders.length > 0) {
        void writeCustomFoldersToDb(localFolders);
      }

      customFoldersHydratedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customFoldersHydratedRef.current) return;
    try {
      localStorage.setItem(MEDIA_CUSTOM_FOLDERS_STORAGE_KEY, JSON.stringify(customFolders));
    } catch {
      // Ignore storage write failures in dev mode.
    }
    void writeCustomFoldersToDb(customFolders);
  }, [customFolders]);

  useEffect(() => {
    setAssets((current) => {
      if (current.length === 0) return sourceAssets;

      const currentById = new Map(current.map((asset) => [asset.id, asset]));
      const merged = sourceAssets.map((asset) => {
        const existing = currentById.get(asset.id);
        if (!existing) return asset;
        return {
          ...asset,
          isFavorite: existing.isFavorite,
          locked: existing.locked ?? asset.locked,
          version: Math.max(
            normalizeMediaVersion(existing.version, 1),
            normalizeMediaVersion(asset.version, 1),
          ),
          fingerprint: existing.fingerprint || asset.fingerprint,
          name:
            existing.source === 'upload' && existing.name
              ? existing.name
              : asset.name,
        };
      });

      const uploaded = current.filter((asset) => asset.source === 'upload' && !merged.some((item) => item.id === asset.id));
      return [...uploaded, ...merged];
    });
  }, [sourceAssets]);

  useEffect(() => {
    analytics.trackEvent('academy_media_studio_opened', {
      courseId: activeCourse?.id || null,
      assetCount: assets.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AcademyMediaStudio opened', {
      courseId: activeCourse?.id || null,
      assetCount: assets.length,
    });
  }, [activeCourse?.id, analytics, assets.length, debugging]);

  const visibleAssets = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const selectedFolder = folderDefinitions.find((folder) => folder.id === folderId);

    return assets
      .filter((asset) => {
        if (scopeTab === 'favorites' && !asset.isFavorite) return false;
        if (scopeTab === 'upload' && asset.source !== 'upload') return false;
        if (typeTab !== 'all' && asset.type !== typeTab) return false;

        if (selectedFolder && selectedFolder.id !== 'all' && selectedFolder.tags) {
          const tagMatch = asset.tags.some((tag) =>
            selectedFolder.tags!.some((folderTag) => tag.toLowerCase().includes(folderTag.toLowerCase())),
          );
          if (!tagMatch) return false;
        }

        if (!query) return true;
        const haystack = `${asset.name} ${asset.tags.join(' ')} ${asset.type}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [assets, folderDefinitions, folderId, scopeTab, searchValue, typeTab]);

  useEffect(() => {
    if (visibleAssets.length === 0) {
      setSelectedAssetId('');
      return;
    }
    const exists = visibleAssets.some((asset) => asset.id === selectedAssetId);
    if (!exists) setSelectedAssetId(visibleAssets[0].id);
  }, [selectedAssetId, visibleAssets]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId],
  );
  const pendingBindingAsset = useMemo(
    () => assets.find((asset) => asset.id === pendingBindingAssetId) || null,
    [assets, pendingBindingAssetId],
  );
  const lessonBindingOptions = useMemo(() => {
    if (!Array.isArray(activeCourse?.lessons)) return [] as Array<{ id: string; label: string }>;
    return activeCourse.lessons.map((lesson, index) => ({
      id: String(lesson.id),
      label: lesson.title || `${tt('Ferdighet', 'Skill')} ${index + 1}`,
    }));
  }, [activeCourse?.lessons, tt]);

  const lessonBindingStatusById = useMemo(() => {
    const normalizedSelectedAssetUrl =
      selectedAsset?.type === 'video' ? normalizeAssetUrl(selectedAsset.url) : '';
    const selectedAssetId =
      selectedAsset?.type === 'video' ? normalizeMediaAssetId(selectedAsset.id) : '';

    return (Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : []).reduce<
      Record<
        string,
        {
          hasVideo: boolean;
          isSameAsSelected: boolean;
          videoLabel: string;
          duration: number;
          hasUpdate: boolean;
        }
      >
    >((acc, lesson) => {
      const lessonId = String(lesson.id);
      const versionState = resolveLinkedVideoVersionState({
        carrier: lesson,
        course: activeCourse,
        fallbackName: tt('Koblet video', 'Linked video'),
      });
      const lessonVideoUrl = String(lesson.videoUrl || '').trim();
      const normalizedLessonVideoUrl = normalizeAssetUrl(lessonVideoUrl);
      const normalizedLessonAssetId = normalizeMediaAssetId(lesson.linkedVideoAssetId);
      const hasVideo = Boolean(lessonVideoUrl);
      acc[lessonId] = {
        hasVideo,
        isSameAsSelected:
          (Boolean(selectedAssetId) &&
            Boolean(normalizedLessonAssetId) &&
            selectedAssetId === normalizedLessonAssetId) ||
          (Boolean(normalizedSelectedAssetUrl) &&
            Boolean(normalizedLessonVideoUrl) &&
            normalizedSelectedAssetUrl === normalizedLessonVideoUrl),
        videoLabel: hasVideo
          ? versionState.displayName ||
            extractMediaDisplayName(lessonVideoUrl, tt('Koblet video', 'Linked video'))
          : '',
        duration: Number(lesson.duration || 0),
        hasUpdate: versionState.hasUpdate,
      };
      return acc;
    }, {});
  }, [activeCourse?.lessons, selectedAsset, tt]);

  const selectedLessonBindingStatus = useMemo(() => {
    const key = String(videoBindingLessonId || '').trim();
    if (!key) return null;
    return lessonBindingStatusById[key] || null;
  }, [lessonBindingStatusById, videoBindingLessonId]);

  const studentProgressRows = useMemo(() => {
    if (!activeCourse?.id || !Array.isArray(state.progress)) return [];
    return state.progress.filter(
      (row) => String(row.courseId || '') === String(activeCourse.id),
    );
  }, [activeCourse?.id, state.progress]);

  const studentProgressStats = useMemo(() => {
    const lessons = Array.isArray(activeCourse?.lessons) ? activeCourse.lessons : [];
    const progressByLesson = new Map(
      studentProgressRows.map((row) => [String(row.lessonId || ''), Number(row.progress || 0)]),
    );
    const completedLessons = lessons.filter(
      (lesson) => (progressByLesson.get(String(lesson.id)) || 0) >= 100,
    ).length;
    const progressPercent =
      lessons.length > 0
        ? Math.round(
            lessons.reduce((sum, lesson) => sum + (progressByLesson.get(String(lesson.id)) || 0), 0) /
              lessons.length,
          )
        : Math.round(
            studentProgressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) /
              Math.max(1, studentProgressRows.length),
          );

    return {
      completedLessons,
      totalLessons: lessons.length,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
    };
  }, [activeCourse?.lessons, studentProgressRows]);

  useEffect(() => {
    setVideoBindingTarget(routeVideoBindingParams.target);
    if (routeVideoBindingParams.lessonId) {
      setVideoBindingLessonId(routeVideoBindingParams.lessonId);
    }
  }, [routeVideoBindingParams.lessonId, routeVideoBindingParams.target]);

  useEffect(() => {
    if (lessonBindingOptions.length === 0) {
      setVideoBindingLessonId('');
      return;
    }
    const exists = lessonBindingOptions.some((lesson) => lesson.id === videoBindingLessonId);
    if (exists) return;
    const preferredId =
      String(routeVideoBindingParams.lessonId || state.currentLesson?.id || lessonBindingOptions[0].id);
    setVideoBindingLessonId(preferredId);
  }, [lessonBindingOptions, routeVideoBindingParams.lessonId, state.currentLesson?.id, videoBindingLessonId]);

  const bindingFlowActive = useMemo(() => {
    if (!routeVideoBindingParams.returnTo) return false;
    if (routeVideoBindingParams.target === 'course') return true;
    return Boolean(videoBindingLessonId || routeVideoBindingParams.lessonId);
  }, [
    routeVideoBindingParams.lessonId,
    routeVideoBindingParams.returnTo,
    routeVideoBindingParams.target,
    videoBindingLessonId,
  ]);

  const bindingTargetLabel = useMemo(() => {
    if (videoBindingTarget === 'course') {
      return activeCourse?.title || tt('dette kurset', 'this course');
    }
    const targetLesson = lessonBindingOptions.find(
      (lesson) => lesson.id === String(videoBindingLessonId || routeVideoBindingParams.lessonId || ''),
    );
    return targetLesson?.label || tt('denne ferdigheten', 'this skill');
  }, [
    activeCourse?.title,
    lessonBindingOptions,
    routeVideoBindingParams.lessonId,
    tt,
    videoBindingLessonId,
    videoBindingTarget,
  ]);

  const bindingTargetLesson = useMemo(() => {
    if (videoBindingTarget !== 'skill') return null;
    const targetLessonId = String(
      videoBindingLessonId || routeVideoBindingParams.lessonId || state.currentLesson?.id || '',
    ).trim();
    if (!targetLessonId || !Array.isArray(activeCourse?.lessons)) return null;
    return (
      activeCourse.lessons.find((lesson) => String(lesson.id) === targetLessonId) || null
    );
  }, [
    activeCourse?.lessons,
    routeVideoBindingParams.lessonId,
    state.currentLesson?.id,
    videoBindingLessonId,
    videoBindingTarget,
  ]);

  const bindingTargetVideoVersionState = useMemo(
    () =>
      resolveLinkedVideoVersionState({
        carrier: videoBindingTarget === 'course' ? activeCourse : bindingTargetLesson,
        course: activeCourse,
        fallbackName: tt('Koblet video', 'Linked video'),
      }),
    [activeCourse, bindingTargetLesson, tt, videoBindingTarget],
  );

  const bindingTargetExistingVideo = useMemo(() => {
    if (!bindingTargetVideoVersionState.hasVideo) return null;
    const matchedAsset =
      bindingTargetVideoVersionState.assetId
        ? assets.find((asset) => asset.id === bindingTargetVideoVersionState.assetId) || null
        : assets.find(
            (asset) =>
              asset.type === 'video' &&
              normalizeAssetUrl(asset.url) ===
                normalizeAssetUrl(
                  videoBindingTarget === 'course'
                    ? activeCourse?.videoUrl
                    : bindingTargetLesson?.videoUrl,
                ),
          ) || null;
    const existingUrl =
      matchedAsset?.url ||
      String(
        videoBindingTarget === 'course'
          ? activeCourse?.videoUrl || ''
          : bindingTargetLesson?.videoUrl || '',
      ).trim();
    if (!existingUrl) return null;

    return {
      url: existingUrl,
      normalizedUrl: normalizeAssetUrl(existingUrl),
      assetId:
        bindingTargetVideoVersionState.assetId ||
        matchedAsset?.id ||
        '',
      name:
        matchedAsset?.name ||
        bindingTargetVideoVersionState.displayName ||
        extractMediaDisplayName(existingUrl, tt('Koblet video', 'Linked video')),
      duration:
        Number(matchedAsset?.duration || 0) ||
        Number(bindingTargetVideoVersionState.currentSnapshot?.duration || 0) ||
        Number(
          videoBindingTarget === 'course'
            ? activeCourse?.duration || 0
            : bindingTargetLesson?.duration || 0,
        ) ||
        0,
      version:
        bindingTargetVideoVersionState.currentVersion ||
        normalizeMediaVersion(matchedAsset?.version, 1),
    };
  }, [
    activeCourse?.duration,
    activeCourse?.videoUrl,
    assets,
    bindingTargetLesson?.duration,
    bindingTargetLesson?.videoUrl,
    bindingTargetVideoVersionState,
    tt,
    videoBindingTarget,
  ]);

  const selectedAssetAlreadyLinkedToTarget = useMemo(() => {
    if (!selectedAsset || selectedAsset.type !== 'video' || !bindingTargetExistingVideo) {
      return false;
    }
    if (
      bindingTargetExistingVideo.assetId &&
      normalizeMediaAssetId(selectedAsset.id) === bindingTargetExistingVideo.assetId
    ) {
      return (
        !bindingTargetVideoVersionState.hasUpdate &&
        normalizeMediaVersion(selectedAsset.version, 1) <=
          Math.max(1, bindingTargetVideoVersionState.linkedVersion)
      );
    }
    return (
      normalizeAssetUrl(selectedAsset.url) === bindingTargetExistingVideo.normalizedUrl
    );
  }, [bindingTargetExistingVideo, bindingTargetVideoVersionState, selectedAsset]);

  const pendingBindingAssetAlreadyLinkedToTarget = useMemo(() => {
    if (
      !pendingBindingAsset ||
      pendingBindingAsset.type !== 'video' ||
      !bindingTargetExistingVideo
    ) {
      return false;
    }
    if (
      bindingTargetExistingVideo.assetId &&
      normalizeMediaAssetId(pendingBindingAsset.id) === bindingTargetExistingVideo.assetId
    ) {
      return (
        !bindingTargetVideoVersionState.hasUpdate &&
        normalizeMediaVersion(pendingBindingAsset.version, 1) <=
          Math.max(1, bindingTargetVideoVersionState.linkedVersion)
      );
    }
    return (
      normalizeAssetUrl(pendingBindingAsset.url) === bindingTargetExistingVideo.normalizedUrl
    );
  }, [bindingTargetExistingVideo, bindingTargetVideoVersionState, pendingBindingAsset]);

  const resolvedBindingReturnTo = useMemo(() => {
    if (routeVideoBindingParams.returnTo) return routeVideoBindingParams.returnTo;
    const safeCourseId = String(activeCourse?.id || '').trim();
    if (!safeCourseId) return '/academy/course-creator';
    if (videoBindingTarget === 'course') {
      return `/academy/course-creator?courseId=${encodeURIComponent(safeCourseId)}`;
    }
    const safeLessonId = String(
      videoBindingLessonId || routeVideoBindingParams.lessonId || state.currentLesson?.id || '',
    ).trim();
    if (!safeLessonId) {
      return `/academy/course-creator?courseId=${encodeURIComponent(safeCourseId)}`;
    }
    return `/academy/course-creator?courseId=${encodeURIComponent(safeCourseId)}&skillId=${encodeURIComponent(safeLessonId)}`;
  }, [
    activeCourse?.id,
    routeVideoBindingParams.lessonId,
    routeVideoBindingParams.returnTo,
    state.currentLesson?.id,
    videoBindingLessonId,
    videoBindingTarget,
  ]);

  const navigateBackToBindingSource = useCallback(() => {
    if (!resolvedBindingReturnTo) return;
    setLocation(resolvedBindingReturnTo);
  }, [resolvedBindingReturnTo, setLocation]);

  const openBindingDialogForAsset = useCallback(
    (assetId: string) => {
      if (!bindingFlowActive) return;
      const asset = assets.find((entry) => entry.id === assetId);
      if (!asset) return;
      setPendingBindingAssetId(asset.id);
      setPendingBindingMode(asset.type === 'video' ? 'video' : 'resource');
      setPendingBindingDialogOpen(true);
    },
    [assets, bindingFlowActive],
  );

  const handleAssetSelect = useCallback(
    (assetId: string, options?: { openBindingDialog?: boolean }) => {
      setSelectedAssetId(assetId);
      if (options?.openBindingDialog) {
        openBindingDialogForAsset(assetId);
      }
    },
    [openBindingDialogForAsset],
  );

  const favoritesCount = useMemo(
    () => assets.filter((asset) => asset.isFavorite).length,
    [assets],
  );

  const uploadsCount = useMemo(
    () => assets.filter((asset) => asset.source === 'upload').length,
    [assets],
  );

  const folderCounts = useMemo(() => {
    return folderDefinitions.reduce<Record<string, number>>((acc, folder) => {
      if (folder.id === 'all') {
        acc[folder.id] = assets.length;
        return acc;
      }
      const tags = folder.tags || [];
      acc[folder.id] = assets.filter((asset) =>
        asset.tags.some((tag) => tags.some((folderTag) => tag.toLowerCase().includes(folderTag.toLowerCase()))),
      ).length;
      return acc;
    }, {});
  }, [assets, folderDefinitions]);

  const allFolderTags = useMemo(
    () =>
      new Set(
        folderDefinitions
          .flatMap((folder) => folder.tags || [])
          .filter((tag) => tag && tag.trim().length > 0),
      ),
    [folderDefinitions],
  );

  const openUploadDialog = useCallback(() => {
    uploadIntentModeRef.current = 'new';
    uploadInputRef.current?.click();
  }, []);

  const openReplaceUploadDialog = useCallback(() => {
    uploadIntentModeRef.current = 'replace-selected';
    uploadInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (files.length === 0) return;
      const preferredFolder = folderId !== 'all' ? folderId : 'course-materials';
      setPendingUploadFiles(files);
      setUploadFolderId(preferredFolder);
      setUploadDialogMode(
        uploadIntentModeRef.current === 'replace-selected' &&
          files.length === 1 &&
          selectedAsset
          ? 'replace-selected'
          : 'new',
      );
      setUploadDialogOpen(true);
      uploadIntentModeRef.current = 'new';
      event.target.value = '';
    },
    [folderId, selectedAsset],
  );

  const replaceSelectedAssetWithUpload = useCallback(async () => {
    if (!selectedAsset || pendingUploadFiles.length !== 1) {
      setStatusMessage(
        tt(
          'Velg nøyaktig én fil for å erstatte valgt media.',
          'Select exactly one file to replace the selected media.',
        ),
      );
      return;
    }

    const replacementFile = pendingUploadFiles[0];
    const replacementType = toAssetTypeFromFile(replacementFile);
    if (replacementType !== selectedAsset.type) {
      setStatusMessage(
        tt(
          'Erstatningsfilen må ha samme medietype som valgt asset.',
          'Replacement file must match the selected asset type.',
        ),
      );
      return;
    }

    const selectedFolder =
      folderDefinitions.find((folder) => folder.id === uploadFolderId) || null;
    const fallbackFolderId =
      selectedFolder?.id ||
      selectedAsset.tags.find((tag) =>
        folderDefinitions.some((folder) => (folder.tags || []).includes(tag)),
      ) ||
      'course-materials';

    let storedReplacement: MediaAsset;
    try {
      storedReplacement = await replaceAcademyMediaAsset({
        assetId: selectedAsset.id,
        file: replacementFile,
        currentAsset: selectedAsset,
        folderId: fallbackFolderId,
        courseId: activeCourse?.id ? String(activeCourse.id) : undefined,
        lessonId: bindingTargetLesson?.id ? String(bindingTargetLesson.id) : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              'Kunne ikke oppdatere valgt media akkurat nå.',
              'Could not update the selected media right now.',
            );
      setStatusMessage(message);
      return;
    }

    const nextUrl = storedReplacement.url;
    const nextPosterUrl = storedReplacement.posterUrl;
    const nowIso = storedReplacement.updatedAt;
    const nextVersion = normalizeMediaVersion(storedReplacement.version, 1);
    const nextFingerprint =
      storedReplacement.fingerprint ||
      buildMediaUploadFingerprint({
        name: replacementFile.name,
        size: replacementFile.size,
        lastModified: replacementFile.lastModified,
        type: replacementFile.type,
      });
    const nextDuration =
      replacementType === 'video'
        ? (Number.isFinite(Number(storedReplacement.duration)) &&
          Number(storedReplacement.duration) > 0
            ? Number(storedReplacement.duration)
            : (await probeVideoDurationSeconds(nextUrl)) ||
              (Number.isFinite(Number(selectedAsset.duration)) &&
              Number(selectedAsset.duration) > 0
                ? Number(selectedAsset.duration)
                : undefined))
        : undefined;

    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedAsset.id
          ? {
              ...asset,
              ...storedReplacement,
              name: storedReplacement.name || replacementFile.name,
              url: nextUrl,
              posterUrl: nextPosterUrl,
              size: storedReplacement.size || replacementFile.size,
              duration:
                replacementType === 'video'
                  ? Number(nextDuration || asset.duration || 0) || undefined
                  : asset.duration,
              updatedAt: nowIso,
              version: nextVersion,
              fingerprint: nextFingerprint,
              source: asset.source === 'upload' ? 'upload' : asset.source,
            }
          : asset,
      ),
    );

    if (
      activeCourse?.id &&
      Array.isArray(state.courses) &&
      state.courses.some((course) => String(course.id) === String(activeCourse.id))
    ) {
      const shouldRenameTitle = (title: string | undefined): boolean => {
        const normalized = String(title || '').trim();
        return normalized.length === 0 || normalized === selectedAsset.name;
      };

      const matchesAssetReference = (assetId: string | undefined, url: string | undefined) => {
        return (
          normalizeMediaAssetId(assetId) === selectedAsset.id ||
          String(url || '').trim() === String(selectedAsset.url || '').trim()
        );
      };

      const nextCourseResources = (Array.isArray(activeCourse.resources)
        ? activeCourse.resources
        : []
      ).map((resource) => {
        if (!matchesAssetReference(resource.mediaAssetId, resource.url)) return resource;
        return {
          ...resource,
          title: shouldRenameTitle(resource.title) ? replacementFile.name : resource.title,
          url: nextUrl,
          size: storedReplacement.size || replacementFile.size,
          mediaAssetId: selectedAsset.id,
          mediaVersion: nextVersion,
          mediaUpdatedAt: nowIso,
          mediaFingerprint: nextFingerprint,
          mediaPosterUrl:
            replacementType === 'video' ? nextPosterUrl || undefined : resource.mediaPosterUrl,
        };
      });

      const nextLessons = (Array.isArray(activeCourse.lessons)
        ? activeCourse.lessons
        : []
      ).map((lesson) => {
        const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
        const nextLessonResources = lessonResources.map((resource) => {
          if (!matchesAssetReference(resource.mediaAssetId, resource.url)) return resource;
          return {
            ...resource,
            title: shouldRenameTitle(resource.title) ? replacementFile.name : resource.title,
            url: nextUrl,
            size: storedReplacement.size || replacementFile.size,
            mediaAssetId: selectedAsset.id,
            mediaVersion: nextVersion,
            mediaUpdatedAt: nowIso,
            mediaFingerprint: nextFingerprint,
            mediaPosterUrl:
              replacementType === 'video' ? nextPosterUrl || undefined : resource.mediaPosterUrl,
          };
        });

        const shouldUpdateDirectVideo = matchesAssetReference(
          lesson.linkedVideoAssetId,
          lesson.videoUrl,
        );

        return {
          ...lesson,
          videoUrl: shouldUpdateDirectVideo ? nextUrl : lesson.videoUrl,
          linkedVideoAssetId: shouldUpdateDirectVideo
            ? selectedAsset.id
            : lesson.linkedVideoAssetId,
          linkedVideoAssetVersion: shouldUpdateDirectVideo
            ? nextVersion
            : lesson.linkedVideoAssetVersion,
          linkedVideoAssetName: shouldUpdateDirectVideo
            ? replacementFile.name
            : lesson.linkedVideoAssetName,
          linkedVideoUpdatedAt: shouldUpdateDirectVideo
            ? nowIso
            : lesson.linkedVideoUpdatedAt,
          linkedVideoFingerprint: shouldUpdateDirectVideo
            ? nextFingerprint
            : lesson.linkedVideoFingerprint,
          linkedVideoPosterUrl: shouldUpdateDirectVideo
            ? nextPosterUrl || undefined
            : lesson.linkedVideoPosterUrl,
          duration:
            shouldUpdateDirectVideo && replacementType === 'video'
              ? Number(nextDuration || lesson.duration || 0)
              : lesson.duration,
          resources: nextLessonResources,
        };
      });

      const updateCourseVideo = matchesAssetReference(
        activeCourse.linkedVideoAssetId,
        activeCourse.videoUrl,
      );

      const nextCourse: Course = {
        ...activeCourse,
        videoUrl: updateCourseVideo ? nextUrl : activeCourse.videoUrl,
        linkedVideoAssetId: updateCourseVideo
          ? selectedAsset.id
          : activeCourse.linkedVideoAssetId,
        linkedVideoAssetVersion: updateCourseVideo
          ? nextVersion
          : activeCourse.linkedVideoAssetVersion,
        linkedVideoAssetName: updateCourseVideo
          ? replacementFile.name
          : activeCourse.linkedVideoAssetName,
        linkedVideoUpdatedAt: updateCourseVideo
          ? nowIso
          : activeCourse.linkedVideoUpdatedAt,
        linkedVideoFingerprint: updateCourseVideo
          ? nextFingerprint
          : activeCourse.linkedVideoFingerprint,
        linkedVideoPosterUrl: updateCourseVideo
          ? nextPosterUrl || undefined
          : activeCourse.linkedVideoPosterUrl,
        duration:
          updateCourseVideo && replacementType === 'video'
            ? Number(nextDuration || activeCourse.duration || 0)
            : activeCourse.duration,
        resources: nextCourseResources,
        lessons: nextLessons,
        updatedAt: nowIso,
      };

      await updateCourse(nextCourse);
      setCurrentCourse(nextCourse);

      const nextCurrentLesson =
        nextLessons.find(
          (lesson) => String(lesson.id) === String(state.currentLesson?.id || ''),
        ) || null;
      if (nextCurrentLesson) {
        setCurrentLesson(nextCurrentLesson);
      }
    }

    setScopeTab('upload');
    setStatusMessage(
      tt(
        `${selectedAsset.name} oppdatert til versjon ${nextVersion}.`,
        `${selectedAsset.name} updated to version ${nextVersion}.`,
      ),
    );
    analytics.trackEvent('academy_media_asset_replaced', {
      assetId: selectedAsset.id,
      assetType: selectedAsset.type,
      courseId: activeCourse?.id || null,
      version: nextVersion,
      timestamp: Date.now(),
    });
    setUploadDialogOpen(false);
    setPendingUploadFiles([]);
    setUploadDialogMode('new');
  }, [
    activeCourse,
    analytics,
    pendingUploadFiles,
    selectedAsset,
    setCurrentCourse,
    setCurrentLesson,
    state.courses,
    state.currentLesson?.id,
    tt,
    updateCourse,
  ]);

  const confirmUploadToFolder = useCallback(async () => {
    if (pendingUploadFiles.length === 0) return;
    if (uploadDialogMode === 'replace-selected') {
      await replaceSelectedAssetWithUpload();
      return;
    }

    const selectedFolder = folderDefinitions.find((folder) => folder.id === uploadFolderId);
    const destinationTag =
      selectedFolder && selectedFolder.id !== 'all'
        ? (selectedFolder.tags?.[0] || selectedFolder.id.replace(/^custom-/, ''))
        : 'course-materials';

    let uploadedAssets: MediaAsset[] = [];
    try {
      uploadedAssets = await uploadFilesToAcademyMediaStore({
        files: pendingUploadFiles,
        folderId: uploadFolderId,
        courseId: activeCourse?.id ? String(activeCourse.id) : undefined,
        lessonId: bindingTargetLesson?.id ? String(bindingTargetLesson.id) : undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tt(
              'Kunne ikke laste opp filene akkurat nå.',
              'Could not upload the files right now.',
            );
      setStatusMessage(message);
      return;
    }

    if (uploadedAssets.length === 0) {
      setStatusMessage(
        tt('Ingen filer ble lagret av serveren.', 'No files were stored by the server.'),
      );
      return;
    }

    const uploadedCourseResources: CourseResource[] = uploadedAssets.map((asset) => ({
      id: `media-upload-${asset.id}`,
      type: toCourseResourceType(asset.type),
      title: asset.name,
      url: asset.url,
      description: `[folder:${destinationTag}] [source:upload] ${tt('Lastet opp fra Media', 'Uploaded from Media')}`,
      size: asset.size,
      mediaAssetId: asset.id,
      mediaVersion: normalizeMediaVersion(asset.version, 1),
      mediaUpdatedAt: asset.updatedAt,
      mediaFingerprint: asset.fingerprint || buildUrlMediaFingerprint(asset.url),
      mediaPosterUrl: asset.type === 'video' ? asset.posterUrl || undefined : undefined,
    }));

    setAssets((current) => {
      const withoutDuplicates = current.filter(
        (asset) => !uploadedAssets.some((uploadedAsset) => uploadedAsset.id === asset.id),
      );
      return [...uploadedAssets, ...withoutDuplicates];
    });

    if (
      activeCourse?.id &&
      Array.isArray(state.courses) &&
      state.courses.some((course) => String(course.id) === String(activeCourse.id))
    ) {
      const currentResources = Array.isArray(activeCourse.resources) ? activeCourse.resources : [];
      const existingUrls = new Set(currentResources.map((resource) => resource.url));
      const nextResources = [
        ...currentResources,
        ...uploadedCourseResources.filter((resource) => !existingUrls.has(resource.url)),
      ];

      await updateCourse({
        ...activeCourse,
        resources: nextResources,
        updatedAt: new Date().toISOString(),
      });
    }

    setScopeTab('upload');
    setFolderId(uploadFolderId);
    setStatusMessage(
      tt(
        `${uploadedAssets.length} ressurs(er) lastet opp til ${selectedFolder?.label || 'Course Materials'}.`,
        `${uploadedAssets.length} asset(s) uploaded to ${selectedFolder?.label || 'Course Materials'}.`,
      ),
    );

    analytics.trackEvent('academy_media_assets_uploaded', {
      count: uploadedAssets.length,
      courseId: activeCourse?.id || null,
      folderId: uploadFolderId,
      timestamp: Date.now(),
    });

    setUploadDialogOpen(false);
    setPendingUploadFiles([]);
    setUploadDialogMode('new');
  }, [
    activeCourse,
    analytics,
    folderDefinitions,
    pendingUploadFiles,
    replaceSelectedAssetWithUpload,
    state.courses,
    tt,
    updateCourse,
    uploadDialogMode,
    uploadFolderId,
  ]);

  const createCustomFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (name.length < 2) {
      setStatusMessage(tt('Mappenavn må være minst 2 tegn.', 'Folder name must be at least 2 characters.'));
      return;
    }

    const normalized = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const baseId = `custom-${normalized || 'folder'}`;
    let nextId = baseId;
    let counter = 1;
    const existing = new Set(folderDefinitions.map((folder) => folder.id));
    while (existing.has(nextId)) {
      counter += 1;
      nextId = `${baseId}-${counter}`;
    }

    const folderTag = nextId.replace(/^custom-/, '');
    const nextFolder: FolderDefinition = {
      id: nextId,
      label: name,
      tags: [folderTag],
      custom: true,
    };

    setCustomFolders((current) => [...current, nextFolder]);
    setFolderId(nextFolder.id);
    setNewFolderName('');
    setStatusMessage(tt(`Mappe "${name}" opprettet.`, `Folder "${name}" created.`));
  }, [folderDefinitions, newFolderName, tt]);

  const moveSelectedToFolder = useCallback(async () => {
    if (!selectedAsset) return;
    if (folderId === 'all') {
      setStatusMessage(tt('Velg en mappe først.', 'Select a folder first.'));
      return;
    }

    const destination = folderDefinitions.find((folder) => folder.id === folderId);
    if (!destination) return;
    const destinationTags = destination.tags || [];
    if (destinationTags.length === 0) return;

    setAssets((current) =>
      current.map((asset) => {
        if (asset.id !== selectedAsset.id) return asset;
        const nonFolderTags = asset.tags.filter((tag) => !allFolderTags.has(tag));
        return {
          ...asset,
          tags: [...nonFolderTags, ...destinationTags],
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    if (
      activeCourse?.id &&
      Array.isArray(state.courses) &&
      state.courses.some((course) => String(course.id) === String(activeCourse.id))
    ) {
      const folderTag = destinationTags[0];
      const currentCourseResources = Array.isArray(activeCourse.resources) ? activeCourse.resources : [];
      const nextCourseResources = currentCourseResources.map((resource) => {
        if (resource.url !== selectedAsset.url) return resource;
        return {
          ...resource,
          description: withFolderTag(resource.description, folderTag),
        };
      });

      const currentLessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
      const nextLessons = currentLessons.map((lesson) => {
        const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
        const nextLessonResources = lessonResources.map((resource) => {
          if (resource.url !== selectedAsset.url) return resource;
          return {
            ...resource,
            description: withFolderTag(resource.description, folderTag),
          };
        });

        const changed = nextLessonResources.some((resource, index) => resource !== lessonResources[index]);
        if (!changed) return lesson;
        return {
          ...lesson,
          resources: nextLessonResources,
        };
      });

      const courseChanged = nextCourseResources.some((resource, index) => resource !== currentCourseResources[index]);
      const lessonChanged = nextLessons.some((lesson, index) => lesson !== currentLessons[index]);

      if (courseChanged || lessonChanged) {
        await updateCourse({
          ...activeCourse,
          resources: nextCourseResources,
          lessons: nextLessons,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setStatusMessage(
      tt(
        `${selectedAsset.name} flyttet til ${destination.label}.`,
        `${selectedAsset.name} moved to ${destination.label}.`,
      ),
    );
  }, [activeCourse, allFolderTags, folderDefinitions, folderId, selectedAsset, state.courses, tt, updateCourse]);

  const toggleFavorite = useCallback((assetId: string) => {
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId ? { ...asset, isFavorite: !asset.isFavorite } : asset,
      ),
    );
  }, []);

  const removeFavorite = useCallback(() => {
    if (!selectedAsset) return;
    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedAsset.id ? { ...asset, isFavorite: false } : asset,
      ),
    );
    setStatusMessage('Removed from favorites.');
  }, [selectedAsset]);

  const copySelectedLink = useCallback(async () => {
    if (!selectedAsset?.url) {
      setStatusMessage('No asset URL available to copy.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedAsset.url);
        setStatusMessage('Asset link copied.');
      } else {
        setStatusMessage('Clipboard is unavailable in this environment.');
      }
    } catch {
      setStatusMessage('Could not copy asset link.');
    }
  }, [selectedAsset]);

  const downloadSelected = useCallback(() => {
    if (!selectedAsset?.url) {
      setStatusMessage(tt('Ingen nedlastbar ressurs er valgt.', 'No downloadable asset selected.'));
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = selectedAsset.url;
    anchor.download = selectedAsset.name;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
    setStatusMessage(tt(`Laster ned ${selectedAsset.name}.`, `Downloading ${selectedAsset.name}.`));
  }, [selectedAsset, tt]);

  const deleteSelected = useCallback(async () => {
    if (!selectedAsset) return;

    if (
      selectedAsset.source === 'upload' ||
      /^\/api\/academy\/media-assets\//.test(String(selectedAsset.url || '').trim()) ||
      /^https?:\/\/[^/]+\/api\/academy\/media-assets\//.test(String(selectedAsset.url || '').trim())
    ) {
      try {
        await apiRequest(`/api/academy/media-assets/${encodeURIComponent(selectedAsset.id)}`, {
          method: 'DELETE',
        });
      } catch {
        // Keep UI deletion non-blocking even if server cleanup fails.
      }
    }

    setAssets((current) => current.filter((asset) => asset.id !== selectedAsset.id));

    if (
      activeCourse?.id &&
      Array.isArray(state.courses) &&
      state.courses.some((course) => String(course.id) === String(activeCourse.id))
    ) {
      const matchesAssetReference = (assetId: string | undefined, url: string | undefined) =>
        normalizeMediaAssetId(assetId) === selectedAsset.id ||
        String(url || '').trim() === String(selectedAsset.url || '').trim();
      const currentCourseResources = Array.isArray(activeCourse.resources) ? activeCourse.resources : [];
      const nextCourseResources = currentCourseResources.filter(
        (resource) => !matchesAssetReference(resource.mediaAssetId, resource.url),
      );

      const currentLessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
      const nextLessons = currentLessons.map((lesson) => {
        const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
        const nextLessonResources = lessonResources.filter(
          (resource) => !matchesAssetReference(resource.mediaAssetId, resource.url),
        );
        const matchesDirectVideo = matchesAssetReference(
          lesson.linkedVideoAssetId,
          lesson.videoUrl,
        );
        if (
          nextLessonResources.length === lessonResources.length &&
          !matchesDirectVideo
        ) {
          return lesson;
        }
        return {
          ...lesson,
          videoUrl: matchesDirectVideo ? '' : lesson.videoUrl,
          linkedVideoAssetId: matchesDirectVideo ? undefined : lesson.linkedVideoAssetId,
          linkedVideoAssetVersion: matchesDirectVideo
            ? undefined
            : lesson.linkedVideoAssetVersion,
          linkedVideoAssetName: matchesDirectVideo
            ? undefined
            : lesson.linkedVideoAssetName,
          linkedVideoUpdatedAt: matchesDirectVideo
            ? undefined
            : lesson.linkedVideoUpdatedAt,
          linkedVideoFingerprint: matchesDirectVideo
            ? undefined
            : lesson.linkedVideoFingerprint,
          linkedVideoPosterUrl: matchesDirectVideo
            ? undefined
            : lesson.linkedVideoPosterUrl,
          resources: nextLessonResources,
        };
      });

      const lessonResourcesChanged = nextLessons.some((lesson, index) => lesson !== currentLessons[index]);
      const courseResourcesChanged = nextCourseResources.length !== currentCourseResources.length;
      const matchesCourseDirectVideo = matchesAssetReference(
        activeCourse.linkedVideoAssetId,
        activeCourse.videoUrl,
      );

      if (lessonResourcesChanged || courseResourcesChanged || matchesCourseDirectVideo) {
        await updateCourse({
          ...activeCourse,
          videoUrl: matchesCourseDirectVideo ? '' : activeCourse.videoUrl,
          linkedVideoAssetId: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoAssetId,
          linkedVideoAssetVersion: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoAssetVersion,
          linkedVideoAssetName: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoAssetName,
          linkedVideoUpdatedAt: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoUpdatedAt,
          linkedVideoFingerprint: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoFingerprint,
          linkedVideoPosterUrl: matchesCourseDirectVideo
            ? undefined
            : activeCourse.linkedVideoPosterUrl,
          resources: nextCourseResources,
          lessons: nextLessons,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setStatusMessage(tt(`${selectedAsset.name} slettet fra biblioteket.`, `${selectedAsset.name} deleted from library.`));
    setSelectedAssetId('');
  }, [activeCourse, selectedAsset, state.courses, tt, updateCourse]);

  const bindSelectedVideoToTarget = useCallback(
    async (target: 'course' | 'skill', assetOverride?: MediaAsset | null) => {
      const assetToBind = assetOverride || selectedAsset;
      if (!assetToBind || assetToBind.type !== 'video') {
        setStatusMessage(tt('Velg en video før du kobler.', 'Select a video before linking.'));
        return;
      }
      const alreadyLinkedToSameVersion = bindingTargetExistingVideo
        ? bindingTargetExistingVideo.assetId &&
          bindingTargetExistingVideo.assetId === assetToBind.id
          ? !bindingTargetVideoVersionState.hasUpdate &&
            normalizeMediaVersion(assetToBind.version, 1) <=
              Math.max(1, bindingTargetVideoVersionState.linkedVersion)
          : normalizeAssetUrl(bindingTargetExistingVideo.url) ===
            normalizeAssetUrl(assetToBind.url)
        : false;
      if (alreadyLinkedToSameVersion) {
        setStatusMessage(
          tt(
            'Denne videoen er allerede koblet til valgt mål.',
            'This video is already linked to the selected target.',
          ),
        );
        return;
      }

      if (
        !activeCourse?.id ||
        !Array.isArray(state.courses) ||
        !state.courses.some((course) => String(course.id) === String(activeCourse.id))
      ) {
        setStatusMessage(tt('Lagre kurset før videokobling.', 'Save the course before linking video.'));
        return;
      }

      const detectedDuration = await probeVideoDurationSeconds(assetToBind.url);
      const resolvedDuration =
        (Number.isFinite(Number(detectedDuration)) && Number(detectedDuration) > 0
          ? Number(detectedDuration)
          : Number.isFinite(Number(assetToBind.duration)) && Number(assetToBind.duration) > 0
            ? Number(assetToBind.duration)
            : null) ?? null;

      if (resolvedDuration) {
        setAssets((current) =>
          current.map((asset) =>
            asset.id === assetToBind.id
              ? {
                  ...asset,
                  duration: resolvedDuration,
                  version: normalizeMediaVersion(asset.version, 1),
                  fingerprint:
                    asset.fingerprint || buildUrlMediaFingerprint(asset.url),
                }
              : asset,
          ),
        );
      }

      const nowIso = new Date().toISOString();
      const assetVersion = normalizeMediaVersion(assetToBind.version, 1);
      const assetFingerprint =
        assetToBind.fingerprint || buildUrlMediaFingerprint(assetToBind.url);
      const assetPosterUrl = String(assetToBind.posterUrl || '').trim() || undefined;
      try {
        if (target === 'course') {
          const nextCourse: Course = {
            ...activeCourse,
            videoUrl: assetToBind.url,
            linkedVideoAssetId: assetToBind.id,
            linkedVideoAssetVersion: assetVersion,
            linkedVideoAssetName: assetToBind.name,
            linkedVideoUpdatedAt: nowIso,
            linkedVideoFingerprint: assetFingerprint,
            linkedVideoPosterUrl: assetPosterUrl,
            duration: resolvedDuration || activeCourse.duration,
            updatedAt: nowIso,
          };
          await updateCourse(nextCourse);
          setCurrentCourse(nextCourse);
          setStatusMessage(tt('Video koblet til kurs.', 'Video linked to course.'));
          analytics.trackEvent('academy_media_video_linked', {
            scope: 'course',
            courseId: activeCourse.id,
            lessonId: null,
            videoUrl: assetToBind.url,
            timestamp: Date.now(),
          });
          navigateBackToBindingSource();
          return;
        }

        const targetLessonId = String(videoBindingLessonId || state.currentLesson?.id || '').trim();
        if (!targetLessonId) {
          setStatusMessage(tt('Velg en ferdighet først.', 'Select a skill first.'));
          return;
        }

        const currentLessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
        const nextLessons = currentLessons.map((lesson) => {
          if (String(lesson.id) !== targetLessonId) return lesson;
          return {
            ...lesson,
            videoUrl: assetToBind.url,
            linkedVideoAssetId: assetToBind.id,
            linkedVideoAssetVersion: assetVersion,
            linkedVideoAssetName: assetToBind.name,
            linkedVideoUpdatedAt: nowIso,
            linkedVideoFingerprint: assetFingerprint,
            linkedVideoPosterUrl: assetPosterUrl,
            duration: resolvedDuration || lesson.duration,
          };
        });

        const nextCourse: Course = {
          ...activeCourse,
          lessons: nextLessons,
          updatedAt: nowIso,
        };
        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);

        const nextLesson = nextLessons.find((lesson) => String(lesson.id) === targetLessonId) || null;
        if (nextLesson) {
          setCurrentLesson(nextLesson);
        }

        setStatusMessage(tt('Video koblet til ferdighet.', 'Video linked to skill.'));
        analytics.trackEvent('academy_media_video_linked', {
          scope: 'skill',
          courseId: activeCourse.id,
          lessonId: targetLessonId,
          videoUrl: assetToBind.url,
          timestamp: Date.now(),
        });
        navigateBackToBindingSource();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt('Kunne ikke koble video akkurat nå.', 'Could not link video right now.');
        setStatusMessage(message);
        debugging.logIntegration('error', 'AcademyMediaStudio bind video failed', {
          message,
          target,
          assetId: assetToBind.id,
          courseId: activeCourse.id,
          lessonId: target === 'skill' ? videoBindingLessonId || null : null,
        });
      }
    },
    [
      activeCourse,
      analytics,
      debugging,
      bindingTargetExistingVideo,
      bindingTargetVideoVersionState,
      setAssets,
      selectedAsset,
      setCurrentCourse,
      setCurrentLesson,
      state.courses,
      state.currentLesson?.id,
      tt,
      updateCourse,
      videoBindingLessonId,
      navigateBackToBindingSource,
    ],
  );

  const linkSelectedAssetAsResource = useCallback(
    async (target: 'course' | 'skill', assetOverride?: MediaAsset | null) => {
      const assetToLink = assetOverride || selectedAsset;
      if (!assetToLink) {
        setStatusMessage(tt('Velg en ressurs først.', 'Select an asset first.'));
        return;
      }
      if (!assetToLink.url) {
        setStatusMessage(tt('Denne ressursen mangler fil-URL og kan ikke kobles.', 'This asset has no file URL and cannot be linked.'));
        return;
      }
      if (
        !activeCourse?.id ||
        !Array.isArray(state.courses) ||
        !state.courses.some((course) => String(course.id) === String(activeCourse.id))
      ) {
        setStatusMessage(tt('Lagre kurset før ressurskobling.', 'Save the course before linking resources.'));
        return;
      }

      const primaryFolderTag =
        assetToLink.tags.find((tag) => allFolderTags.has(tag)) || (target === 'course' ? 'course-materials' : 'lesson-videos');
      const sourceTag = assetToLink.source === 'upload' ? 'upload' : 'resource';
      const resourceBase: CourseResource = {
        id: `media-link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: toCourseResourceType(assetToLink.type),
        title: assetToLink.name,
        url: assetToLink.url,
        description: `[folder:${primaryFolderTag}] [source:${sourceTag}] ${tt('Koblet fra Media', 'Linked from Media')}`,
        size: Number.isFinite(assetToLink.size) ? assetToLink.size : undefined,
        mediaAssetId: assetToLink.id,
        mediaVersion: normalizeMediaVersion(assetToLink.version, 1),
        mediaUpdatedAt: String(assetToLink.updatedAt || '').trim() || new Date().toISOString(),
        mediaFingerprint:
          assetToLink.fingerprint || buildUrlMediaFingerprint(assetToLink.url),
        mediaPosterUrl:
          assetToLink.type === 'video'
            ? String(assetToLink.posterUrl || '').trim() || undefined
            : undefined,
      };
      const nowIso = new Date().toISOString();

      try {
        if (target === 'course') {
          const currentResources = Array.isArray(activeCourse.resources) ? activeCourse.resources : [];
          const exists = currentResources.some(
            (resource) =>
              normalizeMediaAssetId(resource.mediaAssetId) === assetToLink.id ||
              resource.url === assetToLink.url,
          );
          const nextResources = exists ? currentResources : [...currentResources, resourceBase];
          const nextCourse: Course = {
            ...activeCourse,
            resources: nextResources,
            updatedAt: nowIso,
          };
          await updateCourse(nextCourse);
          setCurrentCourse(nextCourse);
          setStatusMessage(
            exists
              ? tt('Ressursen er allerede koblet til kurset.', 'Asset is already linked to this course.')
              : tt('Ressurs koblet til kurs.', 'Asset linked to course.'),
          );
          analytics.trackEvent('academy_media_resource_linked', {
            scope: 'course',
            courseId: activeCourse.id,
            lessonId: null,
            resourceUrl: assetToLink.url,
            type: assetToLink.type,
            timestamp: Date.now(),
          });
          navigateBackToBindingSource();
          return;
        }

        const targetLessonId = String(videoBindingLessonId || state.currentLesson?.id || '').trim();
        if (!targetLessonId) {
          setStatusMessage(tt('Velg en ferdighet først.', 'Select a skill first.'));
          return;
        }

        const currentLessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
        const nextLessons = currentLessons.map((lesson) => {
          if (String(lesson.id) !== targetLessonId) return lesson;
          const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
          const exists = lessonResources.some(
            (resource) =>
              normalizeMediaAssetId(resource.mediaAssetId) === assetToLink.id ||
              resource.url === assetToLink.url,
          );
          if (exists) return lesson;
          return {
            ...lesson,
            resources: [...lessonResources, resourceBase],
          };
        });

        const nextCourse: Course = {
          ...activeCourse,
          lessons: nextLessons,
          updatedAt: nowIso,
        };
        await updateCourse(nextCourse);
        setCurrentCourse(nextCourse);
        const nextLesson = nextLessons.find((lesson) => String(lesson.id) === targetLessonId) || null;
        if (nextLesson) {
          setCurrentLesson(nextLesson);
        }
        const targetLesson = currentLessons.find((lesson) => String(lesson.id) === targetLessonId);
        const wasExisting = Array.isArray(targetLesson?.resources)
          ? targetLesson.resources.some(
              (resource) =>
                normalizeMediaAssetId(resource.mediaAssetId) === assetToLink.id ||
                resource.url === assetToLink.url,
            )
          : false;
        setStatusMessage(
          wasExisting
            ? tt('Ressursen er allerede koblet til ferdigheten.', 'Asset is already linked to this skill.')
            : tt('Ressurs koblet til ferdighet.', 'Asset linked to skill.'),
        );
        analytics.trackEvent('academy_media_resource_linked', {
          scope: 'skill',
          courseId: activeCourse.id,
          lessonId: targetLessonId,
          resourceUrl: assetToLink.url,
          type: assetToLink.type,
          timestamp: Date.now(),
        });
        navigateBackToBindingSource();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : tt('Kunne ikke koble ressurs akkurat nå.', 'Could not link resource right now.');
        setStatusMessage(message);
        debugging.logIntegration('error', 'AcademyMediaStudio link resource failed', {
          message,
          target,
          assetId: assetToLink.id,
          courseId: activeCourse.id,
          lessonId: target === 'skill' ? videoBindingLessonId || null : null,
        });
      }
    },
    [
      activeCourse,
      allFolderTags,
      analytics,
      debugging,
      navigateBackToBindingSource,
      selectedAsset,
      setCurrentCourse,
      setCurrentLesson,
      state.courses,
      state.currentLesson?.id,
      tt,
      updateCourse,
      videoBindingLessonId,
    ],
  );

  const handlePendingBindingConfirm = useCallback(
    async (mode?: PendingMediaBindingMode) => {
      const resolvedMode = mode || pendingBindingMode;
      if (!pendingBindingAsset) {
        setPendingBindingDialogOpen(false);
        return;
      }
      setSelectedAssetId(pendingBindingAsset.id);
      setPendingBindingDialogOpen(false);
      if (resolvedMode === 'video' && pendingBindingAsset.type === 'video') {
        await bindSelectedVideoToTarget(videoBindingTarget, pendingBindingAsset);
        return;
      }
      await linkSelectedAssetAsResource(videoBindingTarget, pendingBindingAsset);
    },
    [
      bindSelectedVideoToTarget,
      linkSelectedAssetAsResource,
      pendingBindingAsset,
      pendingBindingMode,
      videoBindingTarget,
    ],
  );

  const playSelected = useCallback(() => {
    if (!selectedAsset) return;
    if (isStudentMode) {
      setLocation(studentPlayerRoute);
      return;
    }
    setLocation('/academy/player-studio');
  }, [isStudentMode, selectedAsset, setLocation, studentPlayerRoute]);

  const syncNow = useCallback(() => {
    setSyncing(true);
    setStatusMessage(tt('Synkroniserer med skylagring...', 'Syncing with cloud storage...'));

    setTimeout(() => {
      setSyncing(false);
      setStatusMessage(tt('Synkronisering fullført.', 'Sync complete.'));
    }, 900);
  }, [tt]);

  const handleSave = useCallback(
    (publish: boolean) => {
      const payload = {
        courseId: activeCourse?.id || null,
        scopeTab,
        typeTab,
        folderId,
        assets,
        selectedAssetId,
        publish,
        updatedAt: new Date().toISOString(),
      };

      onSave?.(payload);
      setStatusMessage(
        publish
          ? tt('Mediebibliotek lagret og publisert.', 'Media library saved and published.')
          : tt('Mediebibliotek lagret.', 'Media library saved.'),
      );
    },
    [activeCourse?.id, assets, folderId, onSave, scopeTab, selectedAssetId, tt, typeTab],
  );

  const topContextLabel = activeCourse?.title || tt('Academy ressursbibliotek', 'Academy Asset Browser');

  if (isStudentMode) {
    const selectedAssetPreview = selectedAsset ? resolveAssetPreviewImageUrl(selectedAsset) : '';

    return (
      <Box
        sx={{
          minHeight: '100vh',
          color: '#edf0f7',
          bgcolor: '#06080d',
          fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            width: 'min(100%, var(--academy-shell-max-width, 1920px))',
            mx: 'auto',
          }}
        >
          <AcademyStudentSidebar
            activeNav="resources"
            onNavigate={(_, route) => setLocation(route)}
            tt={tt}
            studentName={studentName}
            activeCourseId={activeCourse?.id ? String(activeCourse.id) : null}
            activeCourseTitle={activeCourse?.title || undefined}
            progressPercent={studentProgressStats.progressPercent}
            completedLessons={studentProgressStats.completedLessons}
            totalLessons={studentProgressStats.totalLessons}
            returnTo={studentBaseReturnTo}
            continueRoute={studentPlayerRoute}
          />

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 1.4,
                borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.45)',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(180deg, rgba(248,179,33,0.35), rgba(248,179,33,0.1))',
                  }}
                >
                  <FolderOpen sx={{ color: '#f8c551', fontSize: 18 }} />
                </Box>
                <Stack spacing={0.2}>
                  <Typography sx={{ fontSize: { xs: 24, md: 31 }, lineHeight: 1.04, fontWeight: 600 }}>
                    {tt('Læringsressurser', 'Learning Resources')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 13 }}>
                    {activeLesson?.title
                      ? `${topContextLabel} · ${activeLesson.title}`
                      : topContextLabel}
                  </Typography>
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <AcademyLocaleSwitcher />
                <Button
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={() => setLocation(studentPlayerRoute)}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {tt('Til leksjonen', 'Back to lesson')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CheckCircle />}
                  onClick={() => setLocation(studentAssignmentsRoute)}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  {tt('Oppgaver', 'Assignments')}
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                px: { xs: 1.4, md: 2.2 },
                py: 1.8,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr) 340px' },
                gap: 1.4,
              }}
            >
              <Box sx={{ ...panelSx, p: 1.2, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                  {tt('Filtrer innhold', 'Filter content')}
                </Typography>
                <TextField
                  size="small"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt('Søk ressurser...', 'Search resources...')}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.16)' },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'rgba(237,240,247,0.65)' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <Stack direction="row" spacing={0.7}>
                  <Button
                    fullWidth
                    onClick={() => setScopeTab('all')}
                    sx={{
                      textTransform: 'none',
                      color: scopeTab === 'all' ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                      border: scopeTab === 'all'
                        ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.4)'
                        : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                      background: scopeTab === 'all'
                        ? 'linear-gradient(180deg, rgba(248,179,33,0.24), rgba(248,179,33,0.05))'
                        : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {tt('Alle', 'All')}
                  </Button>
                  <Button
                    fullWidth
                    onClick={() => setScopeTab('favorites')}
                    sx={{
                      textTransform: 'none',
                      color: scopeTab === 'favorites' ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                      border: scopeTab === 'favorites'
                        ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.4)'
                        : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                      background: scopeTab === 'favorites'
                        ? 'linear-gradient(180deg, rgba(248,179,33,0.24), rgba(248,179,33,0.05))'
                        : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {tt('Favoritter', 'Favorites')}
                  </Button>
                </Stack>

                <Stack spacing={0.55}>
                  {[
                    { id: 'all', label: tt('Alle typer', 'All types') },
                    { id: 'image', label: tt('Bilder', 'Images') },
                    { id: 'video', label: tt('Video', 'Video') },
                    { id: 'audio', label: tt('Audio', 'Audio') },
                    { id: 'document', label: tt('Dokumenter', 'Documents') },
                  ].map((item) => {
                    const active = typeTab === item.id;
                    return (
                      <Button
                        key={item.id}
                        onClick={() => setTypeTab(item.id as 'all' | MediaAssetType)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                          border: active
                            ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)'
                            : 'var(--academy-hairline-width, 1px) solid transparent',
                          background: active
                            ? 'linear-gradient(90deg, rgba(248,179,33,0.2), rgba(248,179,33,0.02))'
                            : 'transparent',
                        }}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </Stack>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                  {tt('Mapper', 'Folders')}
                </Typography>
                <Stack spacing={0.55}>
                  {folderDefinitions.filter((folder) => folder.id !== 'all').map((folder) => {
                    const active = folderId === folder.id;
                    return (
                      <Button
                        key={folder.id}
                        onClick={() => setFolderId(folder.id)}
                        startIcon={active ? <FolderOpen /> : <Folder />}
                        sx={{
                          justifyContent: 'space-between',
                          textTransform: 'none',
                          color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                          border: active
                            ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)'
                            : 'var(--academy-hairline-width, 1px) solid transparent',
                          background: active
                            ? 'linear-gradient(90deg, rgba(248,179,33,0.2), rgba(248,179,33,0.02))'
                            : 'transparent',
                        }}
                      >
                        <span>{folder.label}</span>
                        <Chip
                          label={folderCounts[folder.id] || 0}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'inherit' }}
                        />
                      </Button>
                    );
                  })}
                </Stack>
              </Box>

              <Box sx={{ ...panelSx, p: 1.2, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  sx={{ mb: 1 }}
                >
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={tt(`${visibleAssets.length} tilgjengelige`, `${visibleAssets.length} available`)}
                      sx={{ bgcolor: 'rgba(248,179,33,0.16)', color: '#f8d56f' }}
                    />
                    <Chip
                      label={tt(`${favoritesCount} favoritter`, `${favoritesCount} favorites`)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                    />
                  </Stack>
                  <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 13 }}>
                    {statusMessage || tt('Velg en ressurs for detaljer.', 'Select a resource for details.')}
                  </Typography>
                </Stack>

                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.3 }}>
                  {visibleAssets.length === 0 ? (
                    <Box
                      sx={{
                        ...panelSx,
                        py: 6,
                        textAlign: 'center',
                        borderStyle: 'dashed',
                        borderColor: 'rgba(255,255,255,0.2)',
                      }}
                    >
                      <Typography sx={{ fontSize: 24, fontWeight: 600 }}>
                        {tt('Ingen ressurser matcher filtrene.', 'No resources match the filters.')}
                      </Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.62)', mt: 0.8 }}>
                        {tt('Prøv en annen mappe eller søk etter et annet nøkkelord.', 'Try another folder or search keyword.')}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: 'repeat(1, minmax(0, 1fr))',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          xl: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: 1,
                      }}
                    >
                      {visibleAssets.map((asset, index) => {
                        const selected = selectedAssetId === asset.id;
                        const previewImageUrl = resolveAssetPreviewImageUrl(asset);
                        return (
                          <Box
                            key={asset.id}
                            onClick={() => handleAssetSelect(asset.id)}
                            sx={{
                              borderRadius: 1,
                              border: selected
                                ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.6)'
                                : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                              background: 'linear-gradient(150deg, rgba(19,23,33,0.95), rgba(10,12,19,0.98))',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              boxShadow: selected ? '0 8px 20px rgba(248,179,33,0.18)' : 'none',
                            }}
                          >
                            <Box
                              sx={{
                                aspectRatio: '16 / 9',
                                p: 1,
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between',
                                background: previewImageUrl
                                  ? `linear-gradient(180deg, rgba(11,14,22,0.08), rgba(11,14,22,0.72)), url("${previewImageUrl}") center / cover no-repeat`
                                  : placeholderBackgrounds[index % placeholderBackgrounds.length],
                              }}
                            >
                              <Chip
                                size="small"
                                icon={getAssetIcon(asset.type)}
                                label={asset.type.toUpperCase()}
                                sx={{
                                  bgcolor: 'rgba(11,14,22,0.72)',
                                  color: '#edf0f7',
                                  '.MuiChip-icon': { color: '#f8c551' },
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(asset.id);
                                }}
                                sx={{
                                  color: asset.isFavorite ? '#f85050' : 'rgba(255,255,255,0.84)',
                                  bgcolor: 'rgba(11,14,22,0.64)',
                                }}
                              >
                                {asset.isFavorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                              </IconButton>
                            </Box>
                            <Stack spacing={0.45} sx={{ p: 1 }}>
                              <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.12 }}>
                                {asset.name}
                              </Typography>
                              <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                                {formatBytes(asset.size)} · {formatDuration(asset.duration)}
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Box>

              <Box sx={{ ...panelSx, p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                  {tt('Valgt ressurs', 'Selected resource')}
                </Typography>

                {selectedAsset ? (
                  <>
                    <Box
                      sx={{
                        borderRadius: 1,
                        border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                        overflow: 'hidden',
                        minHeight: 180,
                        background: selectedAssetPreview
                          ? `linear-gradient(180deg, rgba(11,14,22,0.12), rgba(11,14,22,0.7)), url("${selectedAssetPreview}") center / cover no-repeat`
                          : placeholderBackgrounds[0],
                      }}
                    />

                    <Stack spacing={0.45}>
                      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
                        {selectedAsset.name}
                      </Typography>
                      <Typography sx={{ color: 'rgba(237,240,247,0.68)', fontSize: 13 }}>
                        {tt('Type', 'Type')}: {selectedAsset.type} · {formatBytes(selectedAsset.size)}
                        {selectedAsset.duration ? ` · ${formatDuration(selectedAsset.duration)}` : ''}
                      </Typography>
                    </Stack>

                    <Stack spacing={0.55}>
                      <Button
                        startIcon={<PlayArrow />}
                        onClick={playSelected}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {tt('Åpne i spiller', 'Open in player')}
                      </Button>
                      <Button
                        startIcon={selectedAsset.isFavorite ? <Favorite /> : <FavoriteBorder />}
                        onClick={() => toggleFavorite(selectedAsset.id)}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {selectedAsset.isFavorite
                          ? tt('Fjern favoritt', 'Remove favorite')
                          : tt('Lagre som favoritt', 'Save as favorite')}
                      </Button>
                      <Button
                        startIcon={<Download />}
                        onClick={downloadSelected}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {tt('Last ned', 'Download')}
                      </Button>
                      <Button
                        startIcon={<LinkIcon />}
                        onClick={copySelectedLink}
                        sx={{
                          justifyContent: 'flex-start',
                          textTransform: 'none',
                          color: '#edf0f7',
                          border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.15)',
                        }}
                      >
                        {tt('Kopier lenke', 'Copy link')}
                      </Button>
                    </Stack>

                    {selectedAsset.tags.length > 0 ? (
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        {selectedAsset.tags.slice(0, 6).map((tag) => (
                          <Chip
                            key={`${selectedAsset.id}-${tag}`}
                            label={tag}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#edf0f7' }}
                          />
                        ))}
                      </Stack>
                    ) : null}
                  </>
                ) : (
                  <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 13 }}>
                    {tt('Velg en ressurs fra listen for å se detaljer.', 'Select a resource from the list to view details.')}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: '#edf0f7',
        bgcolor: '#06080d',
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 74% 12%, rgba(248,179,33,0.24), rgba(5,8,13,0) 42%), radial-gradient(circle at 16% 74%, rgba(82,121,204,0.14), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
        }}
      >
        <AcademyLeftSidebar
          activeNav={leftNav}
          onNavigate={(navId, route) => {
            setLeftNav(navId);
            setLocation(route);
          }}
          onCreateCourse={() => {
            setLeftNav('curriculum');
            setLocation('/academy/curriculum?createCompetency=1');
          }}
          tt={tt}
          navLabel={navLabel}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.4,
            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(13,16,25,0.95), rgba(10,13,20,0.9))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.45)',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(180deg, rgba(248,179,33,0.35), rgba(248,179,33,0.1))',
              }}
            >
              <Movie sx={{ color: '#f8c551', fontSize: 18 }} />
            </Box>
            <Stack spacing={0.2}>
              <Typography sx={{ fontSize: { xs: 24, md: 31 }, lineHeight: 1.04, fontWeight: 600 }}>
                {tt('Academy ressursbibliotek', 'Academy Asset Browser')}
              </Typography>
              <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 13 }}>{topContextLabel}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <AcademyLocaleSwitcher />
            <IconButton
              size="small"
              onClick={() => setLocation('/academy/settings?tab=notifications')}
              aria-label={tt('Varsler', 'Notifications')}
              sx={{ color: 'rgba(237,240,247,0.75)' }}
            >
              <NotificationsNone fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setLocation('/academy/settings?tab=messages')}
              aria-label={tt('Meldinger', 'Messages')}
              sx={{ color: 'rgba(237,240,247,0.75)' }}
            >
              <MailOutline fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setLocation('/academy/settings?tab=profile')}
              aria-label={tt('Profil', 'Profile')}
              sx={{ p: 0 }}
            >
              <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
            </IconButton>
          </Stack>
        </Box>

        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.1,
            borderBottom: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.2,
            background: 'linear-gradient(180deg, rgba(15,19,29,0.94), rgba(9,12,19,0.9))',
          }}
        >
          <Typography sx={{ fontSize: 19, color: '#f4d78e', letterSpacing: '0.01em' }}>
            {tt('Fotograf · Min innholdsbank', 'Photographer · My content library')}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={openUploadDialog}
              sx={{
                textTransform: 'none',
                color: '#edf0f7',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              {tt('Last opp', 'Upload')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={() => handleSave(false)}
              sx={{
                textTransform: 'none',
                color: '#edf0f7',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              {tt('Lagre', 'Save')}
            </Button>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={openUploadDialog}
              sx={{
                textTransform: 'none',
                color: '#0f0f0f',
                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
              }}
            >
              {tt('Last opp', 'Upload')}
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            px: { xs: 1.4, md: 2.2 },
            py: 1.8,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '240px minmax(0, 1fr) 320px' },
            gap: 1.4,
          }}
        >
          <Box sx={{ ...panelSx, p: 1.2, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Typography sx={{ fontSize: 34, lineHeight: 1.04, fontWeight: 600 }}>{tt('Last opp nye ressurser', 'Upload New Assets')}</Typography>
            <Box
              onClick={openUploadDialog}
              sx={{
                border: '1px dashed rgba(248,179,33,0.45)',
                borderRadius: 1,
                p: 1.5,
                minHeight: 142,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                background:
                  'linear-gradient(145deg, rgba(17,21,31,0.92), rgba(8,10,18,0.96)), radial-gradient(circle at 78% 18%, rgba(248,179,33,0.2), rgba(0,0,0,0))',
              }}
            >
              <Stack spacing={0.8} alignItems="center">
                <Stack direction="row" spacing={0.5} sx={{ color: 'rgba(248,179,33,0.9)' }}>
                  <Image fontSize="small" />
                  <Movie fontSize="small" />
                  <MusicNote fontSize="small" />
                  <Description fontSize="small" />
                </Stack>
                <Typography sx={{ color: 'rgba(237,240,247,0.84)', fontSize: 15 }}>
                  Drag & drop files or click to upload
                </Typography>
              </Stack>
            </Box>

            <Button
              variant="contained"
              startIcon={<Add />}
              sx={{
                textTransform: 'none',
                color: '#0f0f0f',
                fontWeight: 700,
                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
              }}
            >
              Select assets
            </Button>

            <Box sx={{ ...panelSx, p: 1.1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={0.7} alignItems="center">
                  <CloudDownload sx={{ color: '#9ec4ff' }} />
                  <Typography sx={{ fontWeight: 600 }}>Google Drive</Typography>
                </Stack>
                <Chip label="Online" size="small" sx={{ bgcolor: 'rgba(79,199,128,0.16)', color: '#9ce5b5' }} />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={syncing ? 55 : 82}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #8de270 0%, #f8b321 100%)',
                  },
                }}
              />
              <Typography sx={{ mt: 0.8, color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                Synced 2 hours ago · 620 GB / 1 TB
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Sync />}
                onClick={syncNow}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  color: '#edf0f7',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                Sync Now
              </Button>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Typography sx={{ fontSize: 23, fontWeight: 600 }}>Folders</Typography>
            <Stack direction="row" spacing={0.7}>
              <TextField
                size="small"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder={tt('Ny mappe...', 'New folder...')}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    color: '#edf0f7',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  },
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    createCustomFolder();
                  }
                }}
              />
              <Button
                onClick={createCustomFolder}
                startIcon={<Add />}
                sx={{
                  textTransform: 'none',
                  color: '#edf0f7',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.18)',
                }}
              >
                {tt('Opprett', 'Create')}
              </Button>
            </Stack>
            <Stack spacing={0.55}>
              {folderDefinitions.filter((folder) => folder.id !== 'all').map((folder) => {
                const active = folderId === folder.id;
                return (
                  <Button
                    key={folder.id}
                    onClick={() => setFolderId(folder.id)}
                    startIcon={active ? <FolderOpen /> : <Folder />}
                    sx={{
                      justifyContent: 'space-between',
                      textTransform: 'none',
                      color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                      border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.35)' : 'var(--academy-hairline-width, 1px) solid transparent',
                      background: active
                        ? 'linear-gradient(90deg, rgba(248,179,33,0.2), rgba(248,179,33,0.02))'
                        : 'transparent',
                      px: 1.2,
                    }}
                  >
                    <span>{folder.label}</span>
                    <Chip
                      label={folderCounts[folder.id] || 0}
                      size="small"
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'inherit' }}
                    />
                  </Button>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ ...panelSx, p: 1.2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <Stack direction="row" spacing={0.8}>
                {[
                  { id: 'all', label: tt('Alle ressurser', 'All Assets'), count: assets.length },
                  { id: 'favorites', label: tt('Favoritter', 'Favorites'), count: favoritesCount },
                  { id: 'upload', label: tt('Opplastinger', 'Uploads'), count: uploadsCount },
                ].map((scope) => {
                  const active = scopeTab === scope.id;
                  return (
                    <Button
                      key={scope.id}
                      onClick={() => setScopeTab(scope.id as AssetScope)}
                      sx={{
                        textTransform: 'none',
                        color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                        borderRadius: 1,
                        border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.4)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                        background: active
                          ? 'linear-gradient(180deg, rgba(248,179,33,0.24), rgba(248,179,33,0.04))'
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      {scope.label}
                      <Chip
                        label={scope.count}
                        size="small"
                        sx={{ ml: 0.7, bgcolor: 'rgba(255,255,255,0.1)', color: 'inherit' }}
                      />
                    </Button>
                  );
                })}
              </Stack>

              <Stack direction="row" spacing={0.6} alignItems="center">
                <TextField
                  size="small"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={tt('Søk ressurser...', 'Search assets...')}
                  sx={{
                    minWidth: { xs: '100%', md: 280 },
                    '& .MuiOutlinedInput-root': {
                      color: '#edf0f7',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: 'rgba(237,240,247,0.65)' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.8)' }}>
                  <MoreHoriz />
                </IconButton>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={0.8}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
              sx={{ mt: 1 }}
            >
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                {[
                  { id: 'all', label: 'All', icon: <FolderOpen fontSize="small" /> },
                  { id: 'image', label: 'Images', icon: <Image fontSize="small" /> },
                  { id: 'video', label: 'Videos', icon: <Movie fontSize="small" /> },
                  { id: 'audio', label: 'Audio', icon: <MusicNote fontSize="small" /> },
                  { id: 'document', label: 'Documents', icon: <Description fontSize="small" /> },
                ].map((tab) => {
                  const active = typeTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      onClick={() => setTypeTab(tab.id as 'all' | MediaAssetType)}
                      startIcon={tab.icon}
                      sx={{
                        textTransform: 'none',
                        color: active ? '#fce3a1' : 'rgba(237,240,247,0.82)',
                        borderRadius: 1,
                        px: 1.2,
                        border: active ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.45)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                        background: active
                          ? 'linear-gradient(180deg, rgba(248,179,33,0.24), rgba(248,179,33,0.05))'
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      {tab.label}
                    </Button>
                  );
                })}
              </Stack>

              <Stack direction="row" spacing={0.6}>
                <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
                  <FilterList />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setGridMode('list')}
                  sx={{
                    color: gridMode === 'list' ? '#f8c551' : 'rgba(237,240,247,0.75)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                    borderRadius: 1,
                  }}
                >
                  <ViewList />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setGridMode('grid')}
                  sx={{
                    color: gridMode === 'grid' ? '#f8c551' : 'rgba(237,240,247,0.75)',
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                    borderRadius: 1,
                  }}
                >
                  <ViewModule />
                </IconButton>
              </Stack>
            </Stack>

            <Box sx={{ mt: 1.1, flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.4 }}>
              {visibleAssets.length === 0 ? (
                <Box
                  sx={{
                    ...panelSx,
                    py: 6,
                    textAlign: 'center',
                    borderStyle: 'dashed',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: 600 }}>No assets match your filters.</Typography>
                  <Typography sx={{ color: 'rgba(237,240,247,0.62)', mt: 0.8 }}>Try another tab or upload new media.</Typography>
                </Box>
              ) : gridMode === 'grid' ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(1, minmax(0, 1fr))',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      xl: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  {visibleAssets.map((asset, index) => {
                    const selected = selectedAssetId === asset.id;
                    const previewImageUrl = resolveAssetPreviewImageUrl(asset);
                    const linkedToActiveTarget =
                      bindingFlowActive &&
                      asset.type === 'video' &&
                      normalizeAssetUrl(asset.url) ===
                        bindingTargetExistingVideo?.normalizedUrl;
                    return (
                      <Box
                        key={asset.id}
                        onClick={() =>
                          handleAssetSelect(asset.id, { openBindingDialog: bindingFlowActive })
                        }
                        sx={{
                          borderRadius: 1,
                          border: selected ? 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.6)' : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                          background: 'linear-gradient(150deg, rgba(19,23,33,0.95), rgba(10,12,19,0.98))',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxShadow: selected ? '0 8px 20px rgba(248,179,33,0.18)' : 'none',
                        }}
                      >
                          <Box
                          sx={{
                            aspectRatio: '16 / 9',
                            p: 1,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'space-between',
                            background: previewImageUrl
                              ? `linear-gradient(180deg, rgba(11,14,22,0.08), rgba(11,14,22,0.72)), url("${previewImageUrl}") center / cover no-repeat`
                              : placeholderBackgrounds[index % placeholderBackgrounds.length],
                            backgroundBlendMode: previewImageUrl ? 'normal' : 'screen, normal',
                          }}
                        >
                          <Chip
                            size="small"
                            icon={getAssetIcon(asset.type)}
                            label={asset.type.toUpperCase()}
                            sx={{
                              bgcolor: 'rgba(11,14,22,0.72)',
                              color: '#edf0f7',
                              '.MuiChip-icon': { color: '#f8c551' },
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(asset.id);
                            }}
                            sx={{
                              color: asset.isFavorite ? '#f85050' : 'rgba(255,255,255,0.84)',
                              bgcolor: 'rgba(11,14,22,0.64)',
                            }}
                          >
                            {asset.isFavorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                          </IconButton>
                        </Box>
                        <Box sx={{ p: 0.95 }}>
                          {linkedToActiveTarget ? (
                            <Chip
                              size="small"
                              label={tt(
                                videoBindingTarget === 'course'
                                  ? 'Koblet til valgt kurs'
                                  : 'Koblet til valgt ferdighet',
                                videoBindingTarget === 'course'
                                  ? 'Linked to selected course'
                                  : 'Linked to selected skill',
                              )}
                              sx={{
                                mb: 0.65,
                                bgcolor: 'rgba(92,180,128,0.14)',
                                color: '#d8f4df',
                                border:
                                  'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)',
                                fontWeight: 700,
                              }}
                            />
                          ) : null}
                          <Typography sx={{ fontSize: 19, fontWeight: 600, lineHeight: 1.17 }}>{asset.name}</Typography>
                          <Stack direction="row" spacing={0.8} sx={{ mt: 0.5 }} alignItems="center" flexWrap="wrap">
                            <Typography sx={{ color: 'rgba(237,240,247,0.65)', fontSize: 13 }}>{formatBytes(asset.size)}</Typography>
                            {asset.duration ? (
                              <Typography sx={{ color: 'rgba(237,240,247,0.65)', fontSize: 13 }}>
                                {formatDuration(asset.duration)}
                              </Typography>
                            ) : null}
                            {asset.locked ? (
                              <Chip
                                size="small"
                                icon={<Lock fontSize="small" />}
                                label="Locked"
                                sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(237,240,247,0.82)' }}
                              />
                            ) : null}
                          </Stack>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Stack spacing={0.8}>
                  {visibleAssets.map((asset) => {
                    const selected = selectedAssetId === asset.id;
                    const previewImageUrl = resolveAssetPreviewImageUrl(asset);
                    const linkedToActiveTarget =
                      bindingFlowActive &&
                      asset.type === 'video' &&
                      normalizeAssetUrl(asset.url) ===
                        bindingTargetExistingVideo?.normalizedUrl;
                    return (
                      <Box
                        key={asset.id}
                        onClick={() =>
                          handleAssetSelect(asset.id, { openBindingDialog: bindingFlowActive })
                        }
                        sx={{
                          ...panelSx,
                          p: 0.95,
                          display: 'grid',
                          gridTemplateColumns: '52px minmax(0, 1fr) auto',
                          alignItems: 'center',
                          cursor: 'pointer',
                          borderColor: selected ? 'rgba(248,179,33,0.52)' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1,
                            display: 'grid',
                            placeItems: 'center',
                            background: previewImageUrl
                              ? `linear-gradient(180deg, rgba(11,14,22,0.12), rgba(11,14,22,0.54)), url("${previewImageUrl}") center / cover no-repeat`
                              : placeholderBackgrounds[asset.name.length % placeholderBackgrounds.length],
                          }}
                        >
                          {getAssetIcon(asset.type)}
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {asset.name}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.6}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                          >
                            <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                              {asset.type.toUpperCase()} · {formatBytes(asset.size)}
                            </Typography>
                            {linkedToActiveTarget ? (
                              <Chip
                                size="small"
                                label={tt(
                                  videoBindingTarget === 'course'
                                    ? 'Koblet til valgt kurs'
                                    : 'Koblet til valgt ferdighet',
                                  videoBindingTarget === 'course'
                                    ? 'Linked to selected course'
                                    : 'Linked to selected skill',
                                )}
                                sx={{
                                  height: 20,
                                  bgcolor: 'rgba(92,180,128,0.14)',
                                  color: '#d8f4df',
                                  border:
                                    'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)',
                                  fontWeight: 700,
                                }}
                              />
                            ) : null}
                          </Stack>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(asset.id);
                          }}
                          sx={{ color: asset.isFavorite ? '#f85050' : 'rgba(255,255,255,0.78)' }}
                        >
                          {asset.isFavorite ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {[
                { label: tt('Hurtiglenker', 'Quick Links'), route: '/academy/course-creator' },
                { label: tt('Instruktørpanel', 'Instructor Panel'), route: '/academy-dashboard' },
                { label: tt('Studentvisning', 'Student View'), route: '/academy/student-dashboard' },
                { label: tt('Læringsløp', 'Learning Paths'), route: '/academy/curriculum' },
                { label: tt('Bokmerker', 'Bookmarks'), route: '/academy/player-studio' },
              ].map((quick) => (
                <Button
                  key={quick.label}
                  variant="outlined"
                  onClick={() => setLocation(quick.route)}
                  sx={{
                    textTransform: 'none',
                    color: '#edf0f7',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderRadius: 1,
                  }}
                >
                  {quick.label}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box sx={{ ...panelSx, p: 1.2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: 33, lineHeight: 1.08, fontWeight: 600 }}>{tt('Ressurshandlinger', 'Asset Actions')}</Typography>

            {selectedAsset ? (
              <Box sx={{ ...panelSx, p: 1 }}>
                <Box
                  sx={{
                    borderRadius: 1,
                    border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.12)',
                    aspectRatio: '16 / 9',
                    p: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    background: resolveAssetPreviewImageUrl(selectedAsset)
                      ? `linear-gradient(180deg, rgba(11,14,22,0.08), rgba(11,14,22,0.72)), url("${resolveAssetPreviewImageUrl(selectedAsset)}") center / cover no-repeat`
                      : placeholderBackgrounds[selectedAsset.name.length % placeholderBackgrounds.length],
                  }}
                >
                  <Chip
                    icon={getAssetIcon(selectedAsset.type)}
                    label={selectedAsset.type.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(11,14,22,0.68)',
                      color: '#edf0f7',
                      '.MuiChip-icon': { color: '#f8c551' },
                    }}
                  />
                  {selectedAsset.locked ? <Lock sx={{ color: '#f8d56f' }} /> : null}
                </Box>
                <Typography sx={{ fontSize: 23, lineHeight: 1.18, fontWeight: 600, mt: 0.9 }}>
                  {selectedAsset.name}
                </Typography>
                <Typography sx={{ color: 'rgba(237,240,247,0.64)', fontSize: 13, mt: 0.4 }}>
                  {formatBytes(selectedAsset.size)} · {selectedAsset.duration ? formatDuration(selectedAsset.duration) : tt('Ingen varighet', 'No duration')} ·{' '}
                  {new Date(selectedAsset.updatedAt).toLocaleDateString()}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ ...panelSx, p: 2.4, textAlign: 'center' }}>
                <Typography sx={{ color: 'rgba(237,240,247,0.64)' }}>
                  {tt('Velg en ressurs for å se handlinger.', 'Select an asset to view actions.')}
                </Typography>
              </Box>
            )}

            {bindingFlowActive ? (
              <Box
                sx={{
                  ...panelSx,
                  p: 1,
                  mt: 0.1,
                  borderColor: 'rgba(248,179,33,0.22)',
                  background:
                    'linear-gradient(145deg, rgba(24,29,42,0.94), rgba(12,16,24,0.98))',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f8c551' }}>
                  {videoBindingTarget === 'course'
                    ? tt('Kobler media til kurs', 'Linking media to course')
                    : tt('Kobler media til ferdighet', 'Linking media to skill')}
                </Typography>
                <Typography sx={{ mt: 0.35, color: 'rgba(237,240,247,0.74)', fontSize: 12 }}>
                  {bindingTargetLabel}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.8}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 0.9 }}
                >
                  <Chip
                    size="small"
                    label={
                      bindingTargetExistingVideo
                        ? tt('Eksisterende video koblet', 'Existing video linked')
                        : tt('Ingen video koblet ennå', 'No video linked yet')
                    }
                    sx={{
                      bgcolor: bindingTargetExistingVideo
                        ? 'rgba(92,180,128,0.14)'
                        : 'rgba(255,255,255,0.08)',
                      color: bindingTargetExistingVideo ? '#d8f4df' : '#edf0f7',
                      border: bindingTargetExistingVideo
                        ? 'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)'
                        : 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                      fontWeight: 700,
                    }}
                  />
                  {bindingTargetExistingVideo ? (
                    <Typography
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        color: 'rgba(237,240,247,0.74)',
                        fontSize: 12,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {`${bindingTargetExistingVideo.name} · ${formatDuration(
                        bindingTargetExistingVideo.duration,
                      )}`}
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            ) : null}

            {bindingFlowActive && selectedAsset?.type === 'video' && bindingTargetExistingVideo ? (
              <Box
                sx={{
                  ...panelSx,
                  p: 1,
                  mt: 0.1,
                  borderColor: selectedAssetAlreadyLinkedToTarget
                    ? 'rgba(92,180,128,0.24)'
                    : 'rgba(248,179,33,0.24)',
                  background: selectedAssetAlreadyLinkedToTarget
                    ? 'linear-gradient(145deg, rgba(21,35,28,0.92), rgba(11,18,14,0.98))'
                    : 'linear-gradient(145deg, rgba(36,28,16,0.92), rgba(18,14,11,0.98))',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: selectedAssetAlreadyLinkedToTarget ? '#b7efc7' : '#f8c551',
                  }}
                >
                  {selectedAssetAlreadyLinkedToTarget
                    ? tt(
                        videoBindingTarget === 'course'
                          ? 'Denne videoen er allerede koblet til kurset.'
                          : 'Denne videoen er allerede koblet til ferdigheten.',
                        videoBindingTarget === 'course'
                          ? 'This video is already linked to the course.'
                          : 'This video is already linked to the skill.',
                      )
                    : tt(
                        videoBindingTarget === 'course'
                          ? 'Denne videoen vil erstatte eksisterende kursvideo.'
                          : 'Denne videoen vil erstatte eksisterende koblet video.',
                        videoBindingTarget === 'course'
                          ? 'This video will replace the current course video.'
                          : 'This video will replace the currently linked video.',
                      )}
                </Typography>
                <Typography sx={{ mt: 0.35, color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                  {selectedAssetAlreadyLinkedToTarget
                    ? `${bindingTargetExistingVideo.name} · ${formatDuration(
                        bindingTargetExistingVideo.duration,
                      )}`
                    : `${tt('Nå koblet', 'Currently linked')}: ${bindingTargetExistingVideo.name} · ${formatDuration(
                        bindingTargetExistingVideo.duration,
                      )}`}
                </Typography>
              </Box>
            ) : null}

            {selectedAsset?.type === 'video' ? (
              <Box sx={{ ...panelSx, p: 1, mt: 0.1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                  {tt('Videokobling', 'Video Binding')}
                </Typography>
                <Typography sx={{ mt: 0.4, color: 'rgba(237,240,247,0.66)', fontSize: 12 }}>
                  {tt(
                    'Velg mål og koble video til kurs eller spesifikk ferdighet.',
                    'Choose target and link this video to the course or a specific skill.',
                  )}
                </Typography>

                <Stack
                  direction="row"
                  spacing={0.8}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 1, '& > *': { minWidth: 0 } }}
                >
                  <Select
                    size="small"
                    value={videoBindingTarget}
                    onChange={(event) => setVideoBindingTarget(event.target.value as 'course' | 'skill')}
                    sx={{
                      flex: '1 1 130px',
                      minWidth: 130,
                      color: '#edf0f7',
                      borderRadius: 1,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    <MenuItem value="skill">{tt('Ferdighet', 'Skill')}</MenuItem>
                    <MenuItem value="course">{tt('Kurs', 'Course')}</MenuItem>
                  </Select>

                  {videoBindingTarget === 'skill' ? (
                    <Select
                      size="small"
                      value={videoBindingLessonId}
                      onChange={(event) => setVideoBindingLessonId(String(event.target.value))}
                      displayEmpty
                      renderValue={(value) => {
                        const lessonId = String(value || '').trim();
                        const option = lessonBindingOptions.find((lesson) => lesson.id === lessonId);
                        const status = lessonId ? lessonBindingStatusById[lessonId] : null;
                        if (!option) {
                          return tt('Velg ferdighet', 'Select skill');
                        }
                        return (
                          <Stack
                            direction="row"
                            spacing={0.6}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography sx={{ color: '#edf0f7', fontSize: 14 }} noWrap>
                              {option.label}
                            </Typography>
                            {status?.hasVideo ? (
                              <Chip
                                size="small"
                                label={
                                  status.hasUpdate
                                    ? tt('Ny versjon', 'New version')
                                    : status.isSameAsSelected
                                    ? tt('Samme video', 'Same video')
                                    : tt('Video koblet', 'Video linked')
                                }
                                sx={{
                                  height: 20,
                                  bgcolor: status.hasUpdate
                                    ? 'rgba(255,170,66,0.16)'
                                    : status.isSameAsSelected
                                    ? 'rgba(92,180,128,0.14)'
                                    : 'rgba(248,179,33,0.12)',
                                  color: status.hasUpdate
                                    ? '#ffd8aa'
                                    : status.isSameAsSelected
                                      ? '#d8f4df'
                                      : '#f8d56f',
                                  border: status.hasUpdate
                                    ? 'var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)'
                                    : status.isSameAsSelected
                                    ? 'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)'
                                    : 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                                  fontWeight: 700,
                                }}
                              />
                            ) : null}
                          </Stack>
                        );
                      }}
                      sx={{
                        flex: '2 1 190px',
                        color: '#edf0f7',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                      disabled={lessonBindingOptions.length === 0}
                    >
                      {lessonBindingOptions.length === 0 ? (
                        <MenuItem value="">
                          {tt('Ingen ferdigheter tilgjengelig', 'No skills available')}
                        </MenuItem>
                      ) : null}
                      {lessonBindingOptions.map((lesson) => {
                        const status = lessonBindingStatusById[lesson.id];
                        return (
                          <MenuItem key={lesson.id} value={lesson.id}>
                            <Stack
                              direction="row"
                              spacing={0.7}
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{ width: '100%' }}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <Typography sx={{ color: '#edf0f7', fontSize: 14 }}>
                                {lesson.label}
                              </Typography>
                              {status?.hasVideo ? (
                                <Chip
                                  size="small"
                                  label={
                                    status.hasUpdate
                                      ? tt('Ny versjon', 'New version')
                                      : status.isSameAsSelected
                                      ? tt('Samme video', 'Same video')
                                      : tt('Video koblet', 'Video linked')
                                  }
                                  sx={{
                                    height: 20,
                                    bgcolor: status.hasUpdate
                                      ? 'rgba(255,170,66,0.16)'
                                      : status.isSameAsSelected
                                      ? 'rgba(92,180,128,0.14)'
                                      : 'rgba(248,179,33,0.12)',
                                    color: status.hasUpdate
                                      ? '#ffd8aa'
                                      : status.isSameAsSelected
                                        ? '#d8f4df'
                                        : '#f8d56f',
                                    border: status.hasUpdate
                                      ? 'var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)'
                                      : status.isSameAsSelected
                                      ? 'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)'
                                      : 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                                    fontWeight: 700,
                                  }}
                                />
                              ) : null}
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  ) : null}

                  <Button
                    onClick={() => void bindSelectedVideoToTarget(videoBindingTarget)}
                    disabled={
                      (videoBindingTarget === 'skill' && lessonBindingOptions.length === 0) ||
                      selectedAssetAlreadyLinkedToTarget
                    }
                    sx={{
                      flex: '1 1 160px',
                      width: { xs: '100%', sm: 'auto' },
                      whiteSpace: 'normal',
                      lineHeight: 1.2,
                      textTransform: 'none',
                      color: '#0f0f0f',
                      fontWeight: 700,
                      borderRadius: 1,
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    }}
                  >
                    {selectedAssetAlreadyLinkedToTarget
                      ? tt('Allerede koblet', 'Already linked')
                      : videoBindingTarget === 'course'
                        ? tt('Koble til kurs', 'Link to course')
                        : tt('Koble til ferdighet', 'Link to skill')}
                  </Button>
                </Stack>
                {videoBindingTarget === 'skill' && selectedLessonBindingStatus?.hasVideo ? (
                  <Typography sx={{ mt: 0.75, color: 'rgba(237,240,247,0.68)', fontSize: 12 }}>
                    {selectedLessonBindingStatus.isSameAsSelected
                      ? `${tt('Valgt ferdighet bruker allerede denne videoen', 'Selected skill already uses this video')}: ${selectedLessonBindingStatus.videoLabel}`
                      : selectedLessonBindingStatus.hasUpdate
                        ? `${tt('Valgt ferdighet har en nyere videoversjon tilgjengelig', 'Selected skill has a newer video version available')}: ${selectedLessonBindingStatus.videoLabel}`
                        : `${tt('Valgt ferdighet har koblet video', 'Selected skill has a linked video')}: ${selectedLessonBindingStatus.videoLabel} · ${formatDuration(selectedLessonBindingStatus.duration)}`}
                  </Typography>
                ) : null}
              </Box>
            ) : null}

            {selectedAsset ? (
              <Box sx={{ ...panelSx, p: 1, mt: 0.1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                  {tt('Ressurskobling', 'Resource Linking')}
                </Typography>
                <Typography sx={{ mt: 0.4, color: 'rgba(237,240,247,0.66)', fontSize: 12 }}>
                  {tt(
                    'Legg valgt media inn som ressurs på kurs eller ferdighet.',
                    'Attach selected media as a resource on the course or a skill.',
                  )}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.8}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 1, '& > *': { minWidth: 0 } }}
                >
                  <Select
                    size="small"
                    value={videoBindingTarget}
                    onChange={(event) => setVideoBindingTarget(event.target.value as 'course' | 'skill')}
                    sx={{
                      flex: '1 1 130px',
                      minWidth: 130,
                      color: '#edf0f7',
                      borderRadius: 1,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    <MenuItem value="skill">{tt('Ferdighet', 'Skill')}</MenuItem>
                    <MenuItem value="course">{tt('Kurs', 'Course')}</MenuItem>
                  </Select>
                  {videoBindingTarget === 'skill' ? (
                    <Select
                      size="small"
                      value={videoBindingLessonId}
                      onChange={(event) => setVideoBindingLessonId(String(event.target.value))}
                      displayEmpty
                      renderValue={(value) => {
                        const lessonId = String(value || '').trim();
                        const option = lessonBindingOptions.find((lesson) => lesson.id === lessonId);
                        const status = lessonId ? lessonBindingStatusById[lessonId] : null;
                        if (!option) {
                          return tt('Velg ferdighet', 'Select skill');
                        }
                        return (
                          <Stack
                            direction="row"
                            spacing={0.6}
                            alignItems="center"
                            useFlexGap
                            flexWrap="wrap"
                          >
                            <Typography sx={{ color: '#edf0f7', fontSize: 14 }} noWrap>
                              {option.label}
                            </Typography>
                            {status?.hasVideo ? (
                              <Chip
                                size="small"
                                label={
                                  status.hasUpdate
                                    ? tt('Ny versjon', 'New version')
                                    : tt('Video koblet', 'Video linked')
                                }
                                sx={{
                                  height: 20,
                                  bgcolor: status.hasUpdate
                                    ? 'rgba(255,170,66,0.16)'
                                    : 'rgba(248,179,33,0.12)',
                                  color: status.hasUpdate ? '#ffd8aa' : '#f8d56f',
                                  border: status.hasUpdate
                                    ? 'var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)'
                                    : 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                                  fontWeight: 700,
                                }}
                              />
                            ) : null}
                          </Stack>
                        );
                      }}
                      sx={{
                        flex: '2 1 190px',
                        color: '#edf0f7',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                      disabled={lessonBindingOptions.length === 0}
                    >
                      {lessonBindingOptions.length === 0 ? (
                        <MenuItem value="">
                          {tt('Ingen ferdigheter tilgjengelig', 'No skills available')}
                        </MenuItem>
                      ) : null}
                      {lessonBindingOptions.map((lesson) => {
                        const status = lessonBindingStatusById[lesson.id];
                        return (
                          <MenuItem key={lesson.id} value={lesson.id}>
                            <Stack
                              direction="row"
                              spacing={0.7}
                              alignItems="center"
                              justifyContent="space-between"
                              sx={{ width: '100%' }}
                              useFlexGap
                              flexWrap="wrap"
                            >
                              <Typography sx={{ color: '#edf0f7', fontSize: 14 }}>
                                {lesson.label}
                              </Typography>
                              {status?.hasVideo ? (
                                <Chip
                                  size="small"
                                  label={
                                    status.hasUpdate
                                      ? tt('Ny versjon', 'New version')
                                      : tt('Video koblet', 'Video linked')
                                  }
                                  sx={{
                                    height: 20,
                                    bgcolor: status.hasUpdate
                                      ? 'rgba(255,170,66,0.16)'
                                      : 'rgba(248,179,33,0.12)',
                                    color: status.hasUpdate ? '#ffd8aa' : '#f8d56f',
                                    border: status.hasUpdate
                                      ? 'var(--academy-hairline-width, 1px) solid rgba(255,170,66,0.28)'
                                      : 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                                    fontWeight: 700,
                                  }}
                                />
                              ) : null}
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  ) : null}
                  <Button
                    onClick={() => void linkSelectedAssetAsResource(videoBindingTarget)}
                    disabled={videoBindingTarget === 'skill' && lessonBindingOptions.length === 0}
                    sx={{
                      flex: '1 1 160px',
                      width: { xs: '100%', sm: 'auto' },
                      whiteSpace: 'normal',
                      lineHeight: 1.2,
                      textTransform: 'none',
                      color: '#0f0f0f',
                      fontWeight: 700,
                      borderRadius: 1,
                      background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                    }}
                  >
                    {videoBindingTarget === 'course'
                      ? tt('Legg til i kurs', 'Add to course')
                      : tt('Legg til i ferdighet', 'Add to skill')}
                  </Button>
                </Stack>
              </Box>
            ) : null}

            <Stack spacing={0.55} sx={{ mt: 0.3 }}>
              {[
                {
                  label: tt('Velg ressurs', 'Select Asset'),
                  icon: <CheckCircle />,
                  onClick: () => setStatusMessage(tt('Ressurs valgt for innsetting.', 'Asset selected for insertion.')),
                },
                {
                  label: tt('Last opp ny versjon', 'Upload new version'),
                  icon: <CloudUpload />,
                  onClick: () => {
                    openReplaceUploadDialog();
                  },
                },
                { label: tt('Fjern fra favoritter', 'Remove from Favorites'), icon: <FavoriteBorder />, onClick: removeFavorite },
                { label: tt('Last ned', 'Download'), icon: <Download />, onClick: downloadSelected },
                { label: tt('Kopier lenke', 'Copy Link'), icon: <LinkIcon />, onClick: copySelectedLink },
                {
                  label: tt('Vis detaljer', 'View Details'),
                  icon: <InfoOutlined />,
                  onClick: () => setStatusMessage(tt('Detaljpanelet er oppdatert.', 'Details panel refreshed.')),
                },
                {
                  label: tt('Flytt til mappe', 'Move to Folder'),
                  icon: <DriveFileMove />,
                  onClick: moveSelectedToFolder,
                },
                {
                  label: tt('Lagre til sky', 'Save to Cloud'),
                  icon: <CloudUpload />,
                  onClick: () => setStatusMessage(tt('Lagt til i skykø.', 'Saved to cloud queue.')),
                },
                {
                  label: tt('Last ned fra sky', 'Download from Cloud'),
                  icon: <CloudDownload />,
                  onClick: () => setStatusMessage(tt('Nedlasting fra sky startet.', 'Cloud download started.')),
                },
                { label: tt('Synkroniser nå', 'Sync Now'), icon: <Sync />, onClick: syncNow },
                { label: tt('Spill av video', 'Play Video'), icon: <PlayArrow />, onClick: playSelected },
                { label: tt('Slett ressurs', 'Delete Asset'), icon: <DeleteOutline />, onClick: deleteSelected, danger: true },
              ].map((action) => (
                <Button
                  key={action.label}
                  onClick={action.onClick}
                  startIcon={action.icon}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    color: action.danger ? '#ff8f8f' : '#edf0f7',
                    border: `var(--academy-hairline-width, 1px) solid ${action.danger ? 'rgba(255,87,87,0.38)' : 'rgba(255,255,255,0.15)'}`,
                    background: action.danger
                      ? 'linear-gradient(180deg, rgba(255,87,87,0.14), rgba(255,87,87,0.03))'
                      : 'transparent',
                    borderRadius: 1,
                  }}
                  disabled={!selectedAsset && action.label !== tt('Synkroniser nå', 'Sync Now')}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mt: 0.7 }} />
            <Stack direction="row" spacing={1} sx={{ pt: 0.7 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  if (onCancel) onCancel();
                  else setLocation('/academy/course-creator');
                }}
                sx={{
                  textTransform: 'none',
                  color: '#edf0f7',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                {tt('Avbryt', 'Cancel')}
              </Button>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Save />}
                onClick={() => handleSave(true)}
                sx={{
                  textTransform: 'none',
                  color: '#0f0f0f',
                  fontWeight: 700,
                  background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                  boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
                }}
              >
                {tt('Lagre', 'Save')}
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1,
            borderTop: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(10,14,22,0.9), rgba(8,12,19,0.95))',
          }}
        >
          <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 13 }}>
            {statusMessage || tt(`${visibleAssets.length} ressurser synlige`, `${visibleAssets.length} assets visible`)}
          </Typography>
        </Box>

        <input
          ref={uploadInputRef}
          type="file"
          hidden
          multiple
          onChange={handleFileInput}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.zip,.txt"
        />
        <Dialog
          open={uploadDialogOpen}
          onClose={() => {
            setUploadDialogOpen(false);
            setPendingUploadFiles([]);
            setUploadDialogMode('new');
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              bgcolor: 'rgba(12,16,24,0.98)',
              color: '#edf0f7',
              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.6 }}>
            {tt('Velg mappe for opplasting', 'Choose upload folder')}
          </DialogTitle>
          <DialogContent sx={{ pt: 0.6 }}>
            <Typography sx={{ color: 'rgba(237,240,247,0.72)', mb: 1 }}>
              {tt(
                `${pendingUploadFiles.length} fil(er) klare for opplasting`,
                `${pendingUploadFiles.length} file(s) ready to upload`,
              )}
            </Typography>
            {selectedAsset && pendingUploadFiles.length === 1 ? (
              <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                <Button
                  variant={uploadDialogMode === 'replace-selected' ? 'contained' : 'outlined'}
                  onClick={() => setUploadDialogMode('replace-selected')}
                  sx={{
                    textTransform: 'none',
                    color:
                      uploadDialogMode === 'replace-selected'
                        ? '#0f0f0f'
                        : '#edf0f7',
                    borderColor: 'rgba(255,255,255,0.18)',
                    background:
                      uploadDialogMode === 'replace-selected'
                        ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                        : 'transparent',
                  }}
                >
                  {tt('Erstatt valgt media', 'Replace selected media')}
                </Button>
                <Button
                  variant={uploadDialogMode === 'new' ? 'contained' : 'outlined'}
                  onClick={() => setUploadDialogMode('new')}
                  sx={{
                    textTransform: 'none',
                    color: uploadDialogMode === 'new' ? '#0f0f0f' : '#edf0f7',
                    borderColor: 'rgba(255,255,255,0.18)',
                    background:
                      uploadDialogMode === 'new'
                        ? 'linear-gradient(180deg, #ffd44e, #f2a616)'
                        : 'transparent',
                  }}
                >
                  {tt('Last opp som ny', 'Upload as new')}
                </Button>
              </Stack>
            ) : null}
            {uploadDialogMode === 'replace-selected' && selectedAsset ? (
              <Box
                sx={{
                  mb: 1,
                  px: 1,
                  py: 0.9,
                  borderRadius: 1,
                  border:
                    'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                  bgcolor: 'rgba(248,179,33,0.08)',
                }}
              >
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#f8d56f' }}>
                  {tt(
                    'Valgt media oppdateres som en ny versjon.',
                    'Selected asset will be updated as a new version.',
                  )}
                </Typography>
                <Typography sx={{ mt: 0.3, color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                  {`${selectedAsset.name} · v${normalizeMediaVersion(selectedAsset.version, 1)} -> v${normalizeMediaVersion(selectedAsset.version, 1) + 1}`}
                </Typography>
              </Box>
            ) : null}
            <Select
              fullWidth
              size="small"
              value={uploadFolderId}
              onChange={(event) => setUploadFolderId(String(event.target.value))}
              disabled={uploadDialogMode === 'replace-selected'}
              sx={{
                color: '#edf0f7',
                bgcolor: 'rgba(255,255,255,0.03)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
              }}
            >
              {folderDefinitions
                .filter((folder) => folder.id !== 'all')
                .map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.label}
                  </MenuItem>
                ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setUploadDialogOpen(false);
                setPendingUploadFiles([]);
                setUploadDialogMode('new');
              }}
              sx={{ textTransform: 'none', color: 'rgba(237,240,247,0.82)' }}
            >
              {tt('Avbryt', 'Cancel')}
            </Button>
            <Button
              onClick={confirmUploadToFolder}
              sx={{
                textTransform: 'none',
                color: '#0f0f0f',
                fontWeight: 700,
                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
              }}
            >
              {uploadDialogMode === 'replace-selected'
                ? tt('Oppdater versjon', 'Update version')
                : tt('Last opp', 'Upload')}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog
          open={pendingBindingDialogOpen}
          onClose={() => setPendingBindingDialogOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              bgcolor: 'rgba(12,16,24,0.98)',
              color: '#edf0f7',
              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.6 }}>
            {videoBindingTarget === 'course'
              ? tt('Koble media til kurs?', 'Link media to course?')
              : tt('Koble media til ferdighet?', 'Link media to skill?')}
          </DialogTitle>
          <DialogContent sx={{ pt: 0.6 }}>
            <Typography sx={{ color: 'rgba(237,240,247,0.78)', mb: 1 }}>
              {pendingBindingAsset
                ? tt(
                    `Vil du koble "${pendingBindingAsset.name}" til ${videoBindingTarget === 'course' ? 'kurset' : 'ferdigheten'} "${bindingTargetLabel}"?`,
                    `Do you want to link "${pendingBindingAsset.name}" to the ${videoBindingTarget === 'course' ? 'course' : 'skill'} "${bindingTargetLabel}"?`,
                  )
                : tt('Velg hvordan denne ressursen skal kobles før du fortsetter.', 'Choose how this asset should be linked before continuing.')}
            </Typography>
            <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
              <Chip
                size="small"
                label={pendingBindingAsset?.type ? pendingBindingAsset.type.toUpperCase() : tt('MEDIA', 'MEDIA')}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: '#edf0f7',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.14)',
                }}
              />
              <Chip
                size="small"
                label={
                  videoBindingTarget === 'course'
                    ? tt('Mål: Kurs', 'Target: Course')
                    : `${tt('Mål', 'Target')}: ${bindingTargetLabel}`
                }
                sx={{
                  bgcolor: 'rgba(248,179,33,0.12)',
                  color: '#f8c551',
                  border: 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.2)',
                }}
              />
            </Stack>
            {pendingBindingAsset?.type === 'video' && bindingTargetExistingVideo ? (
              <Box
                sx={{
                  mt: 1,
                  borderRadius: 1,
                  border: pendingBindingAssetAlreadyLinkedToTarget
                    ? 'var(--academy-hairline-width, 1px) solid rgba(92,180,128,0.24)'
                    : 'var(--academy-hairline-width, 1px) solid rgba(248,179,33,0.22)',
                  bgcolor: pendingBindingAssetAlreadyLinkedToTarget
                    ? 'rgba(92,180,128,0.08)'
                    : 'rgba(248,179,33,0.08)',
                  px: 1,
                  py: 0.9,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: pendingBindingAssetAlreadyLinkedToTarget
                      ? '#d8f4df'
                      : '#f8d56f',
                  }}
                >
                  {pendingBindingAssetAlreadyLinkedToTarget
                    ? tt(
                        'Denne videoen er allerede koblet til målet.',
                        'This video is already linked to the target.',
                      )
                    : tt(
                        'Denne koblingen vil erstatte eksisterende video.',
                        'This link will replace the existing video.',
                      )}
                </Typography>
                <Typography sx={{ mt: 0.3, color: 'rgba(237,240,247,0.72)', fontSize: 12 }}>
                  {`${bindingTargetExistingVideo.name} · ${formatDuration(
                    bindingTargetExistingVideo.duration,
                  )}`}
                </Typography>
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.2, pt: 0.4, flexWrap: 'wrap', gap: 0.8 }}>
            <Button
              onClick={() => setPendingBindingDialogOpen(false)}
              sx={{ textTransform: 'none', color: 'rgba(237,240,247,0.82)' }}
            >
              {tt('Ikke nå', 'Not now')}
            </Button>
            {pendingBindingAsset?.type === 'video' ? (
              <Button
                variant="outlined"
                onClick={() => void handlePendingBindingConfirm('resource')}
                sx={{
                  textTransform: 'none',
                  color: '#edf0f7',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                {videoBindingTarget === 'course'
                  ? tt('Legg til som kursressurs', 'Add as course resource')
                  : tt('Legg til som ressurs', 'Add as resource')}
              </Button>
            ) : null}
            <Button
              onClick={() =>
                void handlePendingBindingConfirm(
                  pendingBindingAsset?.type === 'video' ? 'video' : 'resource',
                )
              }
              disabled={
                pendingBindingAsset?.type === 'video' &&
                pendingBindingAssetAlreadyLinkedToTarget
              }
              sx={{
                textTransform: 'none',
                color: '#0f0f0f',
                fontWeight: 700,
                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
              }}
            >
              {pendingBindingAsset?.type === 'video'
                ? pendingBindingAssetAlreadyLinkedToTarget
                  ? tt('Allerede koblet', 'Already linked')
                  : videoBindingTarget === 'course'
                    ? tt('Koble som kursvideo', 'Link as course video')
                    : tt('Koble som ferdighetsvideo', 'Link as skill video')
                : videoBindingTarget === 'course'
                  ? tt('Koble til kurset', 'Link to course')
                  : tt('Koble til ferdigheten', 'Link to skill')}
            </Button>
          </DialogActions>
        </Dialog>
        </Box>
      </Box>
    </Box>
  );
}

export default withUniversalIntegration(AcademyMediaStudio, {
  componentId: 'academy-media-studio',
  componentName: 'Academy Media Studio',
  componentType: 'media',
  componentCategory: 'academy',
  featureIds: ['academy-asset-browser', 'media-library', 'cloud-sync', 'upload-manager'],
});
