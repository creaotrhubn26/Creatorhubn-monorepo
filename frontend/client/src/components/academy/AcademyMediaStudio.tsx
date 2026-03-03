import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
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

type MediaAssetType = 'image' | 'video' | 'audio' | 'document';
type AssetScope = 'all' | 'favorites' | 'upload';
type AssetGridMode = 'grid' | 'list';
type FolderId = 'all' | 'course-materials' | 'lesson-videos' | 'tutorials' | 'quiz-assets' | 'certificates';

interface MediaAsset {
  id: string;
  name: string;
  type: MediaAssetType;
  url: string;
  size: number;
  duration?: number;
  updatedAt: string;
  tags: string[];
  isFavorite: boolean;
  source: 'course' | 'lesson' | 'resource' | 'upload' | 'sample';
  courseId?: string;
  lessonId?: string;
  locked?: boolean;
}

interface AcademyMediaStudioProps {
  courseId?: string;
  onSave?: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}

const panelSx = {
  borderRadius: 1.4,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'linear-gradient(145deg, rgba(20,24,36,0.88), rgba(11,14,22,0.96))',
};

const placeholderBackgrounds = [
  'linear-gradient(145deg, rgba(24,30,42,0.92), rgba(12,16,24,0.98)), radial-gradient(circle at 84% 18%, rgba(245,166,35,0.35), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(20,25,36,0.95), rgba(10,14,21,0.98)), radial-gradient(circle at 16% 84%, rgba(245,166,35,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(17,21,31,0.94), rgba(8,12,18,0.98)), radial-gradient(circle at 74% 12%, rgba(114,158,225,0.24), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(19,24,36,0.93), rgba(11,14,22,0.98)), radial-gradient(circle at 72% 22%, rgba(248,179,33,0.22), rgba(0,0,0,0))',
  'linear-gradient(145deg, rgba(18,24,34,0.92), rgba(10,12,20,0.98)), radial-gradient(circle at 20% 22%, rgba(92,180,128,0.2), rgba(0,0,0,0))',
];

const fallbackCourse: Course = {
  id: 'media-course-fallback',
  title: 'Directing Masterclass',
  description: 'Cinematic media assets for course production.',
  instructor: {
    id: 'fallback-instructor',
    name: 'CreatorHub Academy',
    avatar: '',
    bio: 'Production team',
    profession: 'videographer',
  },
  thumbnail: '',
  videoUrl: '/assets/academy/intro-video.mp4',
  duration: 336,
  level: 'advanced',
  category: 'videography',
  tags: ['directing', 'cinematic'],
  price: 0,
  isFree: true,
  isPublished: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rating: 4.8,
  studentCount: 370,
  lessons: [
    {
      id: 'media-fallback-lesson',
      courseId: 'media-course-fallback',
      title: 'Lighting Basics',
      description: 'Fallback lesson',
      videoUrl: '/assets/academy/intro-video.mp4',
      duration: 612,
      order: 1,
      isPreview: true,
      resources: [],
    },
  ],
  prerequisites: [],
  learningOutcomes: [],
  resources: [],
};

const fallbackAssets: MediaAsset[] = [
  {
    id: 'asset-fallback-1',
    name: 'Course Introduction Video',
    type: 'video',
    url: '/assets/academy/intro-video.mp4',
    size: 16 * 1024 * 1024,
    duration: 930,
    updatedAt: new Date().toISOString(),
    tags: ['course-materials', 'introduction'],
    isFavorite: true,
    source: 'sample',
  },
  {
    id: 'asset-fallback-2',
    name: 'Photography Basics Thumbnail',
    type: 'image',
    url: '',
    size: 2 * 1024 * 1024,
    updatedAt: new Date().toISOString(),
    tags: ['course-materials', 'thumbnail'],
    isFavorite: false,
    source: 'sample',
  },
  {
    id: 'asset-fallback-3',
    name: 'Lesson Audio Guide',
    type: 'audio',
    url: '',
    size: 6 * 1024 * 1024,
    duration: 264,
    updatedAt: new Date().toISOString(),
    tags: ['lesson-videos', 'audio'],
    isFavorite: false,
    source: 'sample',
  },
  {
    id: 'asset-fallback-4',
    name: 'Course Materials PDF',
    type: 'document',
    url: '',
    size: 1.8 * 1024 * 1024,
    updatedAt: new Date().toISOString(),
    tags: ['course-materials', 'documents'],
    isFavorite: false,
    source: 'sample',
  },
  {
    id: 'asset-fallback-5',
    name: 'Street Photography Tutorial',
    type: 'video',
    url: '',
    size: 34 * 1024 * 1024,
    duration: 932,
    updatedAt: new Date().toISOString(),
    tags: ['tutorials'],
    isFavorite: true,
    source: 'sample',
  },
  {
    id: 'asset-fallback-6',
    name: 'Certificate Template',
    type: 'document',
    url: '',
    size: 460 * 1024,
    updatedAt: new Date().toISOString(),
    tags: ['certificates'],
    isFavorite: false,
    source: 'sample',
  },
];

const folderDefinitions: Array<{ id: FolderId; label: string; tags?: string[] }> = [
  { id: 'all', label: 'All Folders' },
  { id: 'course-materials', label: 'Course Materials', tags: ['course-materials', 'course'] },
  { id: 'lesson-videos', label: 'Lesson Videos', tags: ['lesson-videos', 'lesson'] },
  { id: 'tutorials', label: 'Tutorials', tags: ['tutorials'] },
  { id: 'quiz-assets', label: 'Quiz Assets', tags: ['quiz-assets', 'quiz'] },
  { id: 'certificates', label: 'Certificates', tags: ['certificates', 'certificate'] },
];

const mapResourceType = (type: CourseResource['type'] | LessonResource['type']): MediaAssetType => {
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  return 'document';
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

const toAssetTypeFromFile = (file: File): MediaAssetType => {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};

const getAssetIcon = (type: MediaAssetType) => {
  if (type === 'image') return <Image fontSize="small" />;
  if (type === 'video') return <Movie fontSize="small" />;
  if (type === 'audio') return <MusicNote fontSize="small" />;
  return <Description fontSize="small" />;
};

const buildAssetsFromCourse = (course: Course): MediaAsset[] => {
  const collected: MediaAsset[] = [];
  const now = new Date().toISOString();
  const courseId = String(course.id);

  if (course.thumbnail) {
    collected.push({
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
    });
  }

  if (course.videoUrl) {
    collected.push({
      id: `${courseId}-video`,
      name: `${course.title} Intro Video`,
      type: 'video',
      url: course.videoUrl,
      size: 18 * 1024 * 1024,
      duration: Number(course.duration || 0),
      updatedAt: course.updatedAt || now,
      tags: ['course-materials', 'course', 'video'],
      isFavorite: true,
      source: 'course',
      courseId,
    });
  }

  const resources = Array.isArray(course.resources) ? course.resources : [];
  resources.forEach((resource, resourceIndex) => {
    collected.push({
      id: `${courseId}-course-resource-${resource.id || resourceIndex}`,
      name: resource.title || `Course Resource ${resourceIndex + 1}`,
      type: mapResourceType(resource.type),
      url: resource.url || '',
      size: Number(resource.size || 0),
      updatedAt: course.updatedAt || now,
      tags: ['course-materials', resource.type],
      isFavorite: false,
      source: 'resource',
      courseId,
    });
  });

  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  lessons.forEach((lesson, lessonIndex) => {
    const lessonId = String(lesson.id || `${courseId}-lesson-${lessonIndex + 1}`);

    if (lesson.videoUrl) {
      collected.push({
        id: `${courseId}-${lessonId}-video`,
        name: lesson.title ? `${lesson.title} Video` : `Lesson ${lessonIndex + 1} Video`,
        type: 'video',
        url: lesson.videoUrl,
        size: 12 * 1024 * 1024,
        duration: Number(lesson.duration || 0),
        updatedAt: course.updatedAt || now,
        tags: ['lesson-videos', 'lesson', ...(lesson.isPreview ? ['preview'] : [])],
        isFavorite: false,
        source: 'lesson',
        courseId,
        lessonId,
      });
    }

    const lessonResources = Array.isArray(lesson.resources) ? lesson.resources : [];
    lessonResources.forEach((resource, resourceIndex) => {
      collected.push({
        id: `${courseId}-${lessonId}-resource-${resource.id || resourceIndex}`,
        name: resource.title || `${lesson.title || 'Lesson'} Resource ${resourceIndex + 1}`,
        type: mapResourceType(resource.type),
        url: resource.url || '',
        size: Number(resource.size || 0),
        updatedAt: course.updatedAt || now,
        tags: ['lesson-videos', resource.type],
        isFavorite: false,
        source: 'resource',
        courseId,
        lessonId,
      });
    });
  });

  return collected;
};

function AcademyMediaStudio({ courseId, onSave, onCancel }: AcademyMediaStudioProps) {
  const [, setLocation] = useLocation();
  const { state, getCourse } = useAcademy();
  const { analytics, debugging } = useEnhancedMasterIntegration();

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const objectUrlStoreRef = useRef<string[]>([]);

  const [scopeTab, setScopeTab] = useState<AssetScope>('all');
  const [typeTab, setTypeTab] = useState<'all' | MediaAssetType>('all');
  const [gridMode, setGridMode] = useState<AssetGridMode>('grid');
  const [folderId, setFolderId] = useState<FolderId>('all');
  const [searchValue, setSearchValue] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>(fallbackAssets);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  const courseItems = useMemo(() => {
    if (Array.isArray(state?.courses) && state.courses.length > 0) {
      return state.courses;
    }
    return [fallbackCourse];
  }, [state?.courses]);

  const activeCourse = useMemo(() => {
    if (courseId) {
      return getCourse(courseId) || courseItems[0] || fallbackCourse;
    }
    return state.currentCourse || courseItems[0] || fallbackCourse;
  }, [courseId, courseItems, getCourse, state.currentCourse]);

  const sourceAssets = useMemo(() => {
    const fromCourses = courseItems.flatMap((course) => buildAssetsFromCourse(course));
    if (fromCourses.length > 0) return fromCourses;
    return fallbackAssets;
  }, [courseItems]);

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
  }, [assets, folderId, scopeTab, searchValue, typeTab]);

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
  }, [assets]);

  const triggerUpload = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      if (files.length === 0) return;

      const uploadedAssets: MediaAsset[] = files.map((file, index) => {
        const objectUrl = URL.createObjectURL(file);
        objectUrlStoreRef.current.push(objectUrl);

        return {
          id: `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: toAssetTypeFromFile(file),
          url: objectUrl,
          size: file.size,
          updatedAt: new Date().toISOString(),
          tags: ['uploaded', 'course-materials'],
          isFavorite: false,
          source: 'upload',
          locked: false,
        };
      });

      setAssets((current) => [...uploadedAssets, ...current]);
      setScopeTab('upload');
      setStatusMessage(`${uploadedAssets.length} asset(s) uploaded to draft library.`);

      analytics.trackEvent('academy_media_assets_uploaded', {
        count: uploadedAssets.length,
        courseId: activeCourse?.id || null,
        timestamp: Date.now(),
      });

      event.target.value = '';
    },
    [activeCourse?.id, analytics],
  );

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
      setStatusMessage('No downloadable asset selected.');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = selectedAsset.url;
    anchor.download = selectedAsset.name;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
    setStatusMessage(`Downloading ${selectedAsset.name}.`);
  }, [selectedAsset]);

  const deleteSelected = useCallback(() => {
    if (!selectedAsset) return;
    setAssets((current) => current.filter((asset) => asset.id !== selectedAsset.id));
    setStatusMessage(`${selectedAsset.name} deleted from library.`);
    setSelectedAssetId('');
  }, [selectedAsset]);

  const playSelected = useCallback(() => {
    if (!selectedAsset) return;
    setLocation('/academy/video-player');
  }, [selectedAsset, setLocation]);

  const syncNow = useCallback(() => {
    setSyncing(true);
    setStatusMessage('Syncing with cloud storage...');

    setTimeout(() => {
      setSyncing(false);
      setStatusMessage('Sync complete.');
    }, 900);
  }, []);

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
      setStatusMessage(publish ? 'Media library saved and published.' : 'Media library saved.');
    },
    [activeCourse?.id, assets, folderId, onSave, scopeTab, selectedAssetId, typeTab],
  );

  const openNavRoute = useCallback(
    (id: string, route: string) => {
      if (id === 'overview') setLocation('/academy-dashboard');
      else setLocation(route);
    },
    [setLocation],
  );

  useEffect(() => {
    return () => {
      objectUrlStoreRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlStoreRef.current = [];
    };
  }, []);

  const topContextLabel = activeCourse?.title || 'Academy Asset Browser';

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
            'radial-gradient(circle at 72% 13%, rgba(248,179,33,0.28), rgba(5,8,13,0) 40%), radial-gradient(circle at 12% 84%, rgba(92,128,210,0.18), rgba(6,8,14,0) 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0) 32%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          width: 'min(100%, var(--academy-shell-max-width, 1920px))',
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.4,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
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
                border: '1px solid rgba(248,179,33,0.45)',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(180deg, rgba(248,179,33,0.35), rgba(248,179,33,0.1))',
              }}
            >
              <Movie sx={{ color: '#f8c551', fontSize: 18 }} />
            </Box>
            <Stack spacing={0.2}>
              <Typography sx={{ fontSize: { xs: 24, md: 31 }, lineHeight: 1.04, fontWeight: 600 }}>
                Academy Asset Browser
              </Typography>
              <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 13 }}>{topContextLabel}</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
              <NotificationsNone fontSize="small" />
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(237,240,247,0.75)' }}>
              <MailOutline fontSize="small" />
            </IconButton>
            <Avatar sx={{ width: 34, height: 34, bgcolor: '#f8b321', color: '#111' }}>N</Avatar>
          </Stack>
        </Box>

        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.1,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.2,
            background: 'linear-gradient(180deg, rgba(15,19,29,0.94), rgba(9,12,19,0.9))',
          }}
        >
          <Typography sx={{ fontSize: 19, color: '#f4d78e', letterSpacing: '0.01em' }}>
            Fotograf · Min Innholdsbank
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
              onClick={triggerUpload}
              sx={{
                textTransform: 'none',
                color: '#edf0f7',
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              Upload
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
              Save
            </Button>
            <Button
              variant="contained"
              startIcon={<Upload />}
              onClick={triggerUpload}
              sx={{
                textTransform: 'none',
                color: '#0f0f0f',
                background: 'linear-gradient(180deg, #ffd44e, #f2a616)',
                boxShadow: '0 10px 24px rgba(248,179,33,0.25)',
              }}
            >
              Upload
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
            <Typography sx={{ fontSize: 34, lineHeight: 1.04, fontWeight: 600 }}>Upload New Assets</Typography>
            <Box
              onClick={triggerUpload}
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
                      border: active ? '1px solid rgba(248,179,33,0.35)' : '1px solid transparent',
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
                  { id: 'all', label: 'All Assets', count: assets.length },
                  { id: 'favorites', label: 'Favorites', count: favoritesCount },
                  { id: 'upload', label: 'Upload', count: uploadsCount },
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
                        border: active ? '1px solid rgba(248,179,33,0.4)' : '1px solid rgba(255,255,255,0.14)',
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
                  placeholder="Search assets..."
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
                        border: active ? '1px solid rgba(248,179,33,0.45)' : '1px solid rgba(255,255,255,0.14)',
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
                    border: '1px solid rgba(255,255,255,0.14)',
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
                    border: '1px solid rgba(255,255,255,0.14)',
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
                    return (
                      <Box
                        key={asset.id}
                        onClick={() => setSelectedAssetId(asset.id)}
                        sx={{
                          borderRadius: 1,
                          border: selected ? '1px solid rgba(248,179,33,0.6)' : '1px solid rgba(255,255,255,0.12)',
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
                            background: placeholderBackgrounds[index % placeholderBackgrounds.length],
                            backgroundBlendMode: 'screen, normal',
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
                    return (
                      <Box
                        key={asset.id}
                        onClick={() => setSelectedAssetId(asset.id)}
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
                            background: placeholderBackgrounds[asset.name.length % placeholderBackgrounds.length],
                          }}
                        >
                          {getAssetIcon(asset.type)}
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {asset.name}
                          </Typography>
                          <Typography sx={{ color: 'rgba(237,240,247,0.62)', fontSize: 12 }}>
                            {asset.type.toUpperCase()} · {formatBytes(asset.size)}
                          </Typography>
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
                { label: 'Quick Links', route: '/academy/course-creator' },
                { label: 'Instructor Panel', route: '/academy-dashboard' },
                { label: 'Student View', route: '/academy/student-dashboard' },
                { label: 'Learning Paths', route: '/academy/curriculum' },
                { label: 'Bookmarks', route: '/academy/video-player' },
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
            <Typography sx={{ fontSize: 33, lineHeight: 1.08, fontWeight: 600 }}>Asset Actions</Typography>

            {selectedAsset ? (
              <Box sx={{ ...panelSx, p: 1 }}>
                <Box
                  sx={{
                    borderRadius: 1,
                    border: '1px solid rgba(255,255,255,0.12)',
                    aspectRatio: '16 / 9',
                    p: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    background: placeholderBackgrounds[selectedAsset.name.length % placeholderBackgrounds.length],
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
                  {formatBytes(selectedAsset.size)} · {selectedAsset.duration ? formatDuration(selectedAsset.duration) : 'No duration'} ·{' '}
                  {new Date(selectedAsset.updatedAt).toLocaleDateString()}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ ...panelSx, p: 2.4, textAlign: 'center' }}>
                <Typography sx={{ color: 'rgba(237,240,247,0.64)' }}>Select an asset to view actions.</Typography>
              </Box>
            )}

            <Stack spacing={0.55} sx={{ mt: 0.3 }}>
              {[
                { label: 'Select Asset', icon: <CheckCircle />, onClick: () => setStatusMessage('Asset selected for insertion.') },
                { label: 'Remove from Favorites', icon: <FavoriteBorder />, onClick: removeFavorite },
                { label: 'Download', icon: <Download />, onClick: downloadSelected },
                { label: 'Copy Link', icon: <LinkIcon />, onClick: copySelectedLink },
                { label: 'View Details', icon: <InfoOutlined />, onClick: () => setStatusMessage('Details panel refreshed.') },
                { label: 'Move to Folder', icon: <DriveFileMove />, onClick: () => setStatusMessage('Move action opened.') },
                { label: 'Save to Cloud', icon: <CloudUpload />, onClick: () => setStatusMessage('Saved to cloud queue.') },
                { label: 'Download from Cloud', icon: <CloudDownload />, onClick: () => setStatusMessage('Cloud download started.') },
                { label: 'Sync Now', icon: <Sync />, onClick: syncNow },
                { label: 'Play Video', icon: <PlayArrow />, onClick: playSelected },
                { label: 'Delete Asset', icon: <DeleteOutline />, onClick: deleteSelected, danger: true },
              ].map((action) => (
                <Button
                  key={action.label}
                  onClick={action.onClick}
                  startIcon={action.icon}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    color: action.danger ? '#ff8f8f' : '#edf0f7',
                    border: `1px solid ${action.danger ? 'rgba(255,87,87,0.38)' : 'rgba(255,255,255,0.15)'}`,
                    background: action.danger
                      ? 'linear-gradient(180deg, rgba(255,87,87,0.14), rgba(255,87,87,0.03))'
                      : 'transparent',
                    borderRadius: 1,
                  }}
                  disabled={!selectedAsset && action.label !== 'Sync Now'}
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
                Cancel
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
                Save
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(10,14,22,0.9), rgba(8,12,19,0.95))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Stack direction="row" spacing={0.8}>
            {[
              { id: 'overview', label: 'Overview', route: '/academy-dashboard' },
              { id: 'curriculum', label: 'Curriculum', route: '/academy/curriculum' },
              { id: 'lessons', label: 'Lessons', route: '/academy/lesson-editor' },
              { id: 'media', label: 'Media', route: '/academy/media' },
              { id: 'assignments', label: 'Assignments', route: '/academy/assignments' },
            ].map((item) => (
              <Button
                key={item.id}
                size="small"
                onClick={() => openNavRoute(item.id, item.route)}
                sx={{
                  textTransform: 'none',
                  color: item.id === 'media' ? '#fce3a1' : 'rgba(237,240,247,0.8)',
                  border: item.id === 'media' ? '1px solid rgba(248,179,33,0.35)' : '1px solid rgba(255,255,255,0.16)',
                  background: item.id === 'media' ? 'linear-gradient(90deg, rgba(248,179,33,0.2), rgba(248,179,33,0.03))' : 'transparent',
                  borderRadius: 1,
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Typography sx={{ color: 'rgba(237,240,247,0.66)', fontSize: 13 }}>
            {statusMessage || `${visibleAssets.length} assets visible`}
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
