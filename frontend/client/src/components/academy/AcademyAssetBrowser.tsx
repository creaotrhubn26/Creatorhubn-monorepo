import { useAcademyContext } from '@/contexts/AcademyContext';
/**
 * Academy Asset Browser
 * Integrated asset management for CreatorHub Academy with Google Drive connectivity
 */

import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Paper,
  Chip,
  Avatar,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  Card,
  CardContent,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Badge,
  LinearProgress,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { springVariants, hoverLift } from '@/utils/animation-variants';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  Search,
  Movie,
  Timeline,
  ContentCut,
  MoreVert,
  ExpandMore,
  PlayArrow,
  Favorite,
  FavoriteBorder,
  Download,
  Info,
  Folder,
  VideoLibrary,
  MusicNote,
  PhotoCamera,
  Business,
  Celebration,
  Article,
  PermMedia,
  CloudUpload,
  GetApp,
  Share,
  Delete,
  Visibility,
  CloudDownload,
  Sync,
  FolderOpen,
  Add,
  Close,
  Upload,
  Image,
  VideoFile,
  AudioFile,
  Description,
} from '@mui/icons-material';
import {
  AcademyIcon,
  CourseIcon,
  LessonIcon,
  VideoPlayerIcon,
  InstructorIcon,
  StudentIcon,
  LearningPathIcon,
  CertificateIcon,
  QuizIcon,
  BookmarkIcon,
  NoteIcon,
} from '../shared/CreatorHubIcons';
	import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
	import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
	import { useTheming } from '../../utils/theming-helper';
  import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
  import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
  import { getProfessionIcon } from '@/utils/profession-icons';
	import { UniversalFileUpload } from '../universal/UniversalFileUpload';
	import { apiRequest } from '@/lib/queryClient';
	import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AcademyAssetBrowserProps {
  onAssetSelect?: (asset: AcademyAsset) => void;
  onAssetUpload?: (assets: AcademyAsset[]) => void;
  selectedAsset?: AcademyAsset | null;
  height?: number;
  mode?: 'select' | 'browse' | 'upload';
  allowedTypes?: ('image' | 'video' | 'audio' | 'document')[];
  showUploadDialog?: boolean;
  onClose?: () => void;
}

interface AcademyAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  thumbnailUrl?: string;
  size: number;
  duration?: number;
  uploadedAt: string;
  tags: string[];
  isFavorite: boolean;
  courseId?: string;
  lessonId?: string;
  googleDriveId?: string;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    quality?: string;
  };
}

const SAMPLE_ACADEMY_ASSETS: AcademyAsset[] = [
  {
    id: 'asset-1',
    name: 'Course Introduction Video',
    type: 'video',
    url: '/assets/academy/intro-video.mp4',
    thumbnailUrl: '/assets/academy/intro-thumb.jpg',
    size: 15728640, // 15MB
    duration: 180, // 3 minutes
    uploadedAt: '2024-01-15T10:30:00Z',
    tags: ['introduction','course','video'],
    isFavorite: true,
    courseId: 'course-1',
    metadata: {
      width: 1920,
      height: 1080,
      format: 'MP4',
      quality: 'HD',
    },
  },
  {
    id: 'asset-2',
    name: 'Photography Basics Thumbnail',
    type: 'image',
    url: '/assets/academy/photography-basics.jpg',
    thumbnailUrl: '/assets/academy/photography-basics-thumb.jpg',
    size: 2048576, // 2MB
    uploadedAt: '2024-01-14T14:20:00Z',
    tags: ['photography','thumbnail','course'],
    isFavorite: false,
    courseId: 'course-2',
    metadata: {
      width: 1200,
      height: 675,
      format: 'JPEG',
      quality: 'High',
    },
  },
  {
    id: 'asset-3',
    name: 'Lesson 1 Audio Guide',
    type: 'audio',
    url: '/assets/academy/lesson1-audio.mp3',
    size: 5242880, // 5MB
    duration: 300, // 5 minutes
    uploadedAt: '2024-01-13T09:15:00Z',
    tags: ['audio','lesson','guide'],
    isFavorite: true,
    lessonId: 'lesson-1',
    metadata: {
      format: 'MP3',
      quality: 'High',
    },
  },
  {
    id: 'asset-4',
    name: 'Course Syllabus PDF',
    type: 'document',
    url: '/assets/academy/syllabus.pdf',
    size: 1024000, // 1MB
    uploadedAt: '2024-01-12T16:45:00Z',
    tags: ['document','syllabus','course'],
    isFavorite: false,
    courseId: 'course-1',
    metadata: {
      format: 'PDF',
      quality: 'Standard',
    },
  },
];

// Lazy Loading Image Component with Framer Motion
const LazyImage = memo(({
  src,
  alt,
  width,
  height
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = img.dataset.src || '';
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  return (
    <Box sx={{ position: 'relative', width, height }}>
      {!loaded && !error && (
        <Skeleton variant="rectangular" width={width} height={height} />
      )}
      <m.img
        ref={imgRef}
        data-src={src}
        alt={alt}
        style={{
          width,
          height,
          objectFit: 'cover',
          display: loaded ? 'block' : 'none'}}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {error && (
        <Box
          sx={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.200'}}
        >
          <Typography variant="caption" color="text.secondary">
            Failed to load
          </Typography>
        </Box>
      )}
    </Box>
  );
});

LazyImage.displayName = 'LazyImage';

// Memoized Asset Card Component for better performance
const AssetCard = memo(({
  asset,
  selectedAsset,
  mode,
  favorites,
  onSelect,
  onContextMenu,
  onToggleFavorite,
  getAssetTypeIcon,
  formatFileSize,
  formatDuration,
}: {
  asset: AcademyAsset;
  selectedAsset: AcademyAsset | null | undefined;
  mode: string;
  favorites: Set<string>;
  onSelect: (asset: AcademyAsset) => void;
  onContextMenu: (e: React.MouseEvent, asset: AcademyAsset) => void;
  onToggleFavorite: (id: string) => void;
  getAssetTypeIcon: (type: string) => JSX.Element;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds: number) => string;
}) => (
  <m.div
    variants={springVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    whileHover={hoverLift}
    style={{ padding: '8px' }}
  >
    <Card
      sx={{
        cursor: mode === 'select' ? 'pointer' : 'default',
        border: selectedAsset?.id === asset.id ? 2 : 1,
        borderColor: selectedAsset?.id === asset.id ? 'primary.main' : 'divider'}}
      onClick={() => onSelect(asset)}
      onContextMenu={(e) => onContextMenu(e, asset)}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 48,
              height: 48}}
          >
            {getAssetTypeIcon(asset.type)}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {asset.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatFileSize(asset.size)}
              {asset.duration && ` • ${formatDuration(asset.duration)}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(asset.uploadedAt).toLocaleDateString()}
            </Typography>

            {asset.tags.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                {asset.tags.slice(0, 2).map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 10 }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(asset.id);
            }}
          >
            {favorites.has(asset.id) ? (
              <Favorite fontSize="small" color="error" />
            ) : (
              <FavoriteBorder fontSize="small" />
            )}
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  </m.div>
));

AssetCard.displayName = 'AssetCard';

// Loading Skeleton for Asset Cards
const AssetCardSkeleton = memo(() => (
  <Box sx={{ p: 1 }}>
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Skeleton variant="circular" width={48} height={48} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
            <Skeleton variant="text" width="30%" height={16} />
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
              <Skeleton variant="rectangular" width={60} height={20} />
              <Skeleton variant="rectangular" width={60} height={20} />
            </Stack>
          </Box>
          <Skeleton variant="circular" width={24} height={24} />
        </Stack>
      </CardContent>
    </Card>
  </Box>
));

	AssetCardSkeleton.displayName = 'AssetCardSkeleton';

	function AcademyAssetBrowser({
  onAssetSelect,
  onAssetUpload,
  selectedAsset,
  height = 600,
  mode = 'browse',
  allowedTypes = ['image','video','audio','document'],
  showUploadDialog = false,
  onClose,
}: AcademyAssetBrowserProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['asset-1', 'asset-3']));
  const [showUploadModal, setShowUploadModal] = useState(showUploadDialog);
  const [uploadedAssets, setUploadedAssets] = useState<AcademyAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [displayedAssets, setDisplayedAssets] = useState<AcademyAsset[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    asset: AcademyAsset;
  } | null>(null);

  const ITEMS_PER_PAGE = 20;

  const { analytics, performance, debugging, features } = useEnhancedMasterIntegration();
  
  // Academy context for course integration
  const academyContext = useAcademyContext();

  // Track component performance
  useEffect(() => {
    const endTiming = performance.startTiming('academy_asset_browser_render');
    
    debugging.logIntegration('info', 'AcademyAssetBrowser mounted', {
      mode,
      allowedTypes,
      hasFeatureAccess: features.checkFeatureAccess('asset-browser'),
      coursesCount: academyContext.state.courses.length,
    });
    
    return () => {
      endTiming();
    };
  }, [performance, debugging, features, mode, allowedTypes, academyContext.state.courses.length]);

  // Profession wiring (API configs + adapter)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'music_producer';
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || currentProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(currentProfession);

  // Theming system
  const theming = useTheming(currentProfession);
  const queryClient = useQueryClient();
  
  // Database connection for asset browser state
  const { data: savedAssets = [] } = useQuery({
    queryKey: ['/api/academy/assets', currentProfession],
    queryFn: () => apiRequest(`/api/academy/assets?profession=${currentProfession}`),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Mutation for uploading/saving assets
  const saveAssetMutation = useMutation({
    mutationFn: async (asset: AcademyAsset) => {
      return apiRequest('/api/academy/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asset),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/academy/assets'] });
    },
  });

  // Combine sample assets with uploaded assets and saved assets from database
  const allAssets = useMemo(() => [
    ...SAMPLE_ACADEMY_ASSETS, 
    ...uploadedAssets,
    ...(Array.isArray(savedAssets) ? savedAssets : []),
  ], [uploadedAssets, savedAssets]);

  // Filter assets based on search and type
  const filteredAssets = useMemo(() => {
    return allAssets.filter((asset) => {
      const matchesSearch =
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'all' || asset.type === selectedType;
      const matchesAllowedTypes = allowedTypes.includes(asset.type);
      return matchesSearch && matchesType && matchesAllowedTypes;
    });
  }, [allAssets, searchQuery, selectedType, allowedTypes]);

  // Initialize displayed assets with first page
  useEffect(() => {
    const initialAssets = filteredAssets.slice(0, ITEMS_PER_PAGE);
    setDisplayedAssets(initialAssets);
    setPage(1);
    setHasMore(filteredAssets.length > ITEMS_PER_PAGE);
  }, [filteredAssets]);

  // Load more assets for infinite scroll
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setTimeout(() => {
      const nextPage = page + 1;
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const newAssets = filteredAssets.slice(startIndex, endIndex);

      if (newAssets.length > 0) {
        setDisplayedAssets((prev) => [...prev, ...newAssets]);
        setPage(nextPage);
        setHasMore(endIndex < filteredAssets.length);
      } else {
        setHasMore(false);
      }
      setIsLoading(false);
    }, 500); // Simulate loading delay
  }, [page, filteredAssets, isLoading, hasMore]);

  // Get asset type icon
  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <PhotoCamera />;
      case 'video':
        return <VideoLibrary />;
      case 'audio':
        return <MusicNote />;
      case 'document':
        return <Description />;
      default:
        return <PermMedia />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes','KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle favorite
  const toggleFavorite = useCallback((assetId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(assetId)) {
        newFavorites.delete(assetId);
      } else {
        newFavorites.add(assetId);
      }
      return newFavorites;
    });
  }, []);

  // Handle asset selection
  const handleAssetSelect = useCallback(
    (asset: AcademyAsset) => {
      if (mode === 'select' && onAssetSelect) {
        onAssetSelect(asset);
      }

      analytics.trackEvent('academy_asset_selected', {
        assetId: asset.id,
        assetType: asset.type,
        assetName: asset.name,
        timestamp: Date.now(),
      });
    },
    [mode, onAssetSelect, analytics],
  );

  // Handle context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, asset: AcademyAsset) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      asset: asset,
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle asset upload
  const handleAssetUpload = useCallback(
    (files: File[]) => {
      const newAssets: AcademyAsset[] = files.map((file, index) => ({
        id: `uploaded-${Date.now()}-${index}`,
        name: file.name,
        type: file.type.startsWith('image/')
          ? 'image'
          : file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'document',
        url: URL.createObjectURL(file),
        size: file.size,
        uploadedAt: new Date().toISOString(),
        tags: [],
        isFavorite: false,
        metadata: {
          format: file.type.split('/')[1]?.toUpperCase() || 'Unknown',
        },
      }));

      setUploadedAssets((prev) => [...prev, ...newAssets]);

      if (onAssetUpload) {
        onAssetUpload(newAssets);
      }

      analytics.trackEvent('academy_assets_uploaded', {
        assetCount: newAssets.length,
        assetTypes: newAssets.map((a) => a.type),
        timestamp: Date.now(),
      });
    },
    [onAssetUpload, analytics],
  );

  // Tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // All Assets
        return (
          <Box>
            {/* Search and Filter */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )}}
                sx={{ mb: 2 }}
              />

              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip
                  label="All"
                  onClick={() => setSelectedType('all')}
                  color={selectedType === 'all' ? 'primary' : 'default'}
                  variant={selectedType === 'all' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Images"
                  onClick={() => setSelectedType('image')}
                  color={selectedType === 'image' ? 'primary' : 'default'}
                  variant={selectedType === 'image' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Videos"
                  onClick={() => setSelectedType('video')}
                  color={selectedType === 'video' ? 'primary' : 'default'}
                  variant={selectedType === 'video' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Audio"
                  onClick={() => setSelectedType('audio')}
                  color={selectedType === 'audio' ? 'primary' : 'default'}
                  variant={selectedType === 'audio' ? 'filled' : 'outlined'}
                />
                <Chip
                  label="Documents"
                  onClick={() => setSelectedType('document')}
                  color={selectedType === 'document' ? 'primary' : 'default'}
                  variant={selectedType === 'document' ? 'filled' : 'outlined'}
                />
              </Stack>
            </Box>

            {/* Assets Grid */}
            <Box sx={{ height: 600 }}>
              {displayedAssets.length === 0 && isLoading ? (
                <Box>
                  {[...Array(5)].map((_, i) => (
                    <AssetCardSkeleton key={i} />
                  ))}
                </Box>
              ) : (
                <AnimatePresence>
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={displayedAssets}
                    endReached={loadMore}
                    itemContent={(index, asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        selectedAsset={selectedAsset}
                        mode={mode}
                        favorites={favorites}
                        onSelect={handleAssetSelect}
                        onContextMenu={handleContextMenu}
                        onToggleFavorite={toggleFavorite}
                        getAssetTypeIcon={getAssetTypeIcon}
                        formatFileSize={formatFileSize}
                        formatDuration={formatDuration}
                      />
                    )}
                    components={{
                      Footer: () =>
                        isLoading ? (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : !hasMore ? (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <Typography variant="caption" color="text.secondary">
                              No more assets
                            </Typography>
                          </Box>
                        ) : null}}
                  />
                </AnimatePresence>
              )}
            </Box>

            {filteredAssets.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  No assets found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search or upload new assets
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 1: { // Favorites
        const favoriteAssets = filteredAssets.filter((asset) => favorites.has(asset.id));
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Favorite Assets ({favoriteAssets.length})
            </Typography>
            <Box sx={{ height: 600 }}>
              {favoriteAssets.length === 0 && isLoading ? (
                <Box>
                  {[...Array(3)].map((_, i) => (
                    <AssetCardSkeleton key={i} />
                  ))}
                </Box>
              ) : (
                <AnimatePresence>
                  <Virtuoso
                    style={{ height: '100%' }}
                    data={favoriteAssets}
                    itemContent={(index, asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        selectedAsset={selectedAsset}
                        mode={mode}
                        favorites={favorites}
                        onSelect={handleAssetSelect}
                        onContextMenu={handleContextMenu}
                        onToggleFavorite={toggleFavorite}
                        getAssetTypeIcon={getAssetTypeIcon}
                        formatFileSize={formatFileSize}
                        formatDuration={formatDuration}
                      />
                    )}
                  />
                </AnimatePresence>
              )}
            </Box>
          </Box>
        );
      }

      case 2: // Upload
        return (
          <Box>
            <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <AcademyIcon sx={{ color: theming.colors.primary, fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Upload New Assets
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Drag and drop or click to upload files
                  </Typography>
                </Box>
                <Box sx={{ flexGrow: 1 }} />
                <Button startIcon={<Add />} variant="outlined" size="small">
                  New Folder
                </Button>
              </Stack>
            </Paper>
            
            {/* Upload progress indicator */}
            {saveAssetMutation.isPending && (
              <LinearProgress sx={{ mb: 2 }} />
            )}
            
            <UniversalFileUpload
              onFilesSelected={handleAssetUpload}
              maxFiles={10}
              allowedTypes="all"
              showFormatInfo={true}
              enableGoogleDriveSync={true}
              profession="photographer"
              showStorageInfo={true}
            />
            
            {/* Quick asset type buttons */}
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={6} sm={3}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Image sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="body2">Images</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <VideoFile sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="body2">Videos</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <AudioFile sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                  <Typography variant="body2">Audio</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Article sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="body2">Documents</Typography>
                </Paper>
              </Grid>
            </Grid>
            
            {/* Folder structure */}
            <Paper elevation={0} sx={{ mt: 3, p: 2, border: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Folder color="primary" />
                <Typography variant="subtitle2">Folders</Typography>
                <ExpandMore fontSize="small" />
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small"><MoreVert fontSize="small" /></IconButton>
              </Stack>
              <List dense>
                <ListItem disablePadding>
                  <ListItemButton>
                    <ListItemIcon><CourseIcon /></ListItemIcon>
                    <ListItemText primary="Course Materials" secondary="12 files" />
                    <GetApp fontSize="small" color="action" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton>
                    <ListItemIcon><LessonIcon /></ListItemIcon>
                    <ListItemText primary="Lesson Videos" secondary="8 files" />
                    <GetApp fontSize="small" color="action" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton>
                    <ListItemIcon><VideoPlayerIcon /></ListItemIcon>
                    <ListItemText primary="Tutorials" secondary="5 files" />
                    <GetApp fontSize="small" color="action" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton>
                    <ListItemIcon><QuizIcon /></ListItemIcon>
                    <ListItemText primary="Quiz Assets" secondary="15 files" />
                    <GetApp fontSize="small" color="action" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton>
                    <ListItemIcon><CertificateIcon /></ListItemIcon>
                    <ListItemText primary="Certificates" secondary="3 files" />
                    <GetApp fontSize="small" color="action" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Paper>
            
            {/* Quick links to academy sections */}
            <Paper elevation={0} sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>Quick Links</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<InstructorIcon />} label="Instructor Panel" size="small" variant="outlined" />
                <Chip icon={<StudentIcon />} label="Student View" size="small" variant="outlined" />
                <Chip icon={<LearningPathIcon />} label="Learning Paths" size="small" variant="outlined" />
                <Chip icon={<BookmarkIcon />} label="Bookmarks" size="small" variant="outlined" />
                <Chip icon={<NoteIcon />} label="Notes" size="small" variant="outlined" />
                <Chip icon={<Business />} label="Business" size="small" variant="outlined" />
                <Chip icon={<Celebration />} label="Achievements" size="small" variant="outlined" />
              </Stack>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary showDetails={true}>
      <LazyMotion features={domAnimation} strict>
        <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(professionIcon as any, {
                sx: { color: professionColor, fontSize: 26 }
              })}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }} noWrap>
                Academy Asset Browser
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => setShowUploadModal(true)}
            >
              Upload
            </Button>
            {onClose && (
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            )}
          </Stack>
        </Stack>

        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="All Assets" />
          <Tab
            label={
              <Badge badgeContent={favorites.size} color="error">
                Favorites
              </Badge>
            }
          />
          <Tab label="Upload" />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>{renderTabContent()}</Box>

      {/* Upload Modal */}
      <Dialog
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Upload Academy Assets</DialogTitle>
        <DialogContent>
          <UniversalFileUpload
            onFilesSelected={handleAssetUpload}
            maxFiles={20}
            allowedTypes="all"
            showFormatInfo={true}
            enableGoogleDriveSync={true}
            profession={currentProfession as any}
            showStorageInfo={true}
            onUploadComplete={() => setShowUploadModal(false)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUploadModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        {contextMenu && (
          <>
            <MenuItem onClick={() => handleAssetSelect(contextMenu.asset)}>
              <ListItemIcon>
                <Visibility fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Select Asset" />
            </MenuItem>
            <MenuItem onClick={() => toggleFavorite(contextMenu.asset.id)}>
              <ListItemIcon>
                {favorites.has(contextMenu.asset.id) ? (
                  <Favorite fontSize="small" color="error" />
                ) : (
                  <FavoriteBorder fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  favorites.has(contextMenu.asset.id) ? 'Remove from Favorites' : 'Add to Favorites'
                }
              />
            </MenuItem>
            <MenuItem onClick={() => window.open(contextMenu.asset.url, '_blank')}>
              <ListItemIcon>
                <Download fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Download" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => navigator.clipboard.writeText(contextMenu.asset.url)}>
              <ListItemIcon>
                <Share fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Copy Link" />
            </MenuItem>
            
            {/* Additional asset actions using unused icons */}
            <Divider />
            <MenuItem onClick={() => {
              analytics.trackEvent('asset_info_viewed', { assetId: contextMenu.asset.id });
              console.log('Asset info:', contextMenu.asset);
            }}>
              <ListItemIcon><Info fontSize="small" /></ListItemIcon>
              <ListItemText primary="View Details" />
            </MenuItem>
            
            <MenuItem onClick={() => console.log('Move to folder')}>
              <ListItemIcon><FolderOpen fontSize="small" /></ListItemIcon>
              <ListItemText primary="Move to Folder" />
            </MenuItem>
            
            <MenuItem onClick={() => {
              saveAssetMutation.mutate(contextMenu.asset);
            }}>
              <ListItemIcon><CloudUpload fontSize="small" /></ListItemIcon>
              <ListItemText primary="Save to Cloud" />
            </MenuItem>
            
            <MenuItem onClick={() => window.open(contextMenu.asset.url, '_blank')}>
              <ListItemIcon><CloudDownload fontSize="small" /></ListItemIcon>
              <ListItemText primary="Download from Cloud" />
            </MenuItem>
            
            <MenuItem onClick={() => console.log('Sync asset')}>
              <ListItemIcon><Sync fontSize="small" /></ListItemIcon>
              <ListItemText primary="Sync Now" />
            </MenuItem>
            
            <Divider />
            
            {contextMenu.asset.type === 'video' && (
              <>
                <MenuItem onClick={() => console.log('Play video')}>
                  <ListItemIcon><PlayArrow fontSize="small" color="primary" /></ListItemIcon>
                  <ListItemText primary="Play Video" />
                </MenuItem>
                <MenuItem onClick={() => console.log('Edit timeline')}>
                  <ListItemIcon><Timeline fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Edit Timeline" />
                </MenuItem>
                <MenuItem onClick={() => console.log('Trim video')}>
                  <ListItemIcon><ContentCut fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Trim Video" />
                </MenuItem>
                <MenuItem onClick={() => console.log('Movie info')}>
                  <ListItemIcon><Movie fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Movie Properties" />
                </MenuItem>
              </>
            )}
            
            <Divider />
            
            <MenuItem onClick={() => {
              analytics.trackEvent('asset_deleted', { assetId: contextMenu.asset.id });
              console.log('Delete asset:', contextMenu.asset.id);
            }} sx={{ color: 'error.main' }}>
              <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
              <ListItemText primary="Delete Asset" />
            </MenuItem>
          </>
        )}
      </Menu>
        </Box>
      </LazyMotion>
	    </ErrorBoundary>
	  );
	}

	export default withUniversalIntegration(AcademyAssetBrowser, {
	  componentId: 'academy-asset-browser',
	  componentName: 'Academy Asset Browser',
	  componentType: 'widget',
	  componentCategory: 'academy',
	  featureIds: ['asset-browser', 'media-upload', 'content-management'],
	});
