/**
 * Digital Asset Management (DAM) Admin Panel
 * Professional DAM interface inspired by enterprise solutions
 * Complete asset management with advanced features
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress,
  Alert,
  Avatar,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridOnIcon,
  ViewList as ListIcon,
  Sort as SortIcon,
  MoreVert as MoreIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Info as InfoIcon,
  Image as ImageIcon,
  Videocam as VideoIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as ViewIcon,
  VisibilityOff as ViewOffIcon,
  Lock as LockIcon,
  Public as PublicIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Palette as PaletteIcon,
  Crop as CropIcon,
  Transform as TransformIcon,
  History as HistoryIcon,
  Comment as CommentIcon,
  LocalOffer as TagIcon,
  Category as CategoryIcon,
  Collections as CollectionsIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Security as SecurityIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
} from '@mui/icons-material';

interface Asset {
  id: string;
  name: string;
  originalName: string;
  description?: string;
  altText?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string;
  width?: number;
  height?: number;
  duration?: number;
  status: 'uploading' | 'processing' | 'ready' | 'archived' | 'deleted' | 'error';
  isPublic: boolean;
  accessLevel: 'public' | 'internal' | 'restricted' | 'confidential';
  downloadCount: number;
  viewCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags?: string[];
  category?: string;
  collection?: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  path: string;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  assetCount?: number;
  createdAt: string;
  createdBy: string;
}

interface DAMStats {
  totalAssets: number;
  totalSize: number;
  totalViews: number;
  totalDownloads: number;
  byType: Record<string, { count: number; size: number }>;
  byStatus: Record<string, number>;
}

interface SearchFilters {
  query: string;
  collectionId?: string;
  categoryId?: string;
  tags: string[];
  mimeTypes: string[];
  status: string[];
  accessLevel?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function DAMAdminPanel() {
  // State management
  const [assets, setAssets] = useState<Asset[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<DAMStats | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalAssets, setTotalAssets] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Search and filters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    tags:  [],
    mimeTypes:  [],
    status:  [],
    sortBy: 'createdA',
    sortOrder: 'desc',
});

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Load initial data
  useEffect(() => {
    loadAssets();
    loadCollections();
    loadStats();
}, []);

  // Load assets with current filters
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (searchFilters.query) params.append('query', searchFilters.query);
      if (searchFilters.collectionId) params.append('collectionId', searchFilters.collectionId);
      if (searchFilters.categoryId) params.append('categoryId, ', searchFilters.categoryId);
      if (searchFilters.tags.length > 0) params.append('tags', searchFilters.tags.join(','));
      if (searchFilters.mimeTypes.length > 0) params.append('mimeTypes', searchFilters.mimeTypes.join(','));
      if (searchFilters.status.length > 0) params.append('status', searchFilters.status.join(', '));
      if (searchFilters.accessLevel) params.append('accessLevel', searchFilters.accessLevel);
      if (searchFilters.dateFrom) params.append('dateFrom', searchFilters.dateFrom.toISOString());
      if (searchFilters.dateTo) params.append('dateTo', searchFilters.dateTo.toISOString());
      
      params.append('sortBy', searchFilters.sortBy);
      params.append('sortOrder', searchFilters.sortOrder);
      params.append('limit', rowsPerPage.toString());
      params.append('offset', (currentPage * rowsPerPage).toString());

      const response = await fetch(`/api/dam/assets/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setAssets(Array.isArray(data.assets) ? data.assets : []);
        setTotalAssets(data.total);
        setHasMore(data.hasMore);
    } else {
        setError(data.error || 'Failed to load assets');
    }
  } catch (err) {
      setError('Failed to load assets');
      console.error('Load assets error: ', err);
  } finally {
      setLoading(false);
  }
}, [searchFilters, currentPage, rowsPerPage]);

  // Load collections
  const loadCollections = useCallback(async () => {
    try {
      const response = await fetch('/api/dam/collections');
      const data = await response.json();

      if (data.success) {
        setCollections(Array.isArray(data.collections) ? data.collections : []);
    }
  } catch (err) {
      console.error('Load collections error:', err);
  }
}, []);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dam/stats');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
    }
  } catch (err) {
      console.error('Load stats error:', err);
  }
}, []);

  // Handle search
  const handleSearch = useCallback(() => {
    setCurrentPage(0);
    loadAssets();
}, [loadAssets]);

  // Handle filter change
  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
}, []);

  // Handle asset selection
  const handleAssetSelect = useCallback((assetId: string, selected: boolean) => {
    setSelectedAssets(prev => 
      selected 
        ? [...prev, assetId]
        : prev.filter(id => id !== assetId)
    );
}, []);

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedAssets(selected ? assets.map(asset => asset.id) : []);
}, [assets]);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
}, []);

  // Get file icon
  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType.startsWith('video/')) return <VideoIcon />;
    if (mimeType.startsWith('audio/')) return <AudioIcon />;
    return <DocumentIcon />;
}, []);

  // Get status color
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'ready': return 'success';
      case 'processing': return 'warning';
      case 'error': return 'error';
      case 'archived': return 'default';
      default: return 'info';
}
}, []);

  // Get access level icon
  const getAccessLevelIcon = useCallback((accessLevel: string) => {
    switch (accessLevel) {
      case 'public': return <PublicIcon />;
      case 'internal': return <GroupIcon />;
      case 'restricted': return <LockIcon />;
      case 'confidential': return <SecurityIcon />;
      default: return <GroupIcon />;
}
}, []);

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Digital Asset Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Professional asset management with enterprise-grade features
        </Typography>
      </Box>

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb:  3 }}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main'}}>
                    <StorageIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{stats.totalAssets.toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Assets
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'success.main'}}>
                    <SpeedIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{formatFileSize(stats.totalSize)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Size
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'info.main'}}>
                    <ViewIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{stats.totalViews.toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Views
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar sx={{ bgcolor: 'warning.main'}}>
                    <DownloadIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{stats.totalDownloads.toLocaleString()}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Downloads
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <TextField
                fullWidth
                placeholder="Search assets..."
                value={searchFilters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary'}} />}}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Collection</InputLabel>
                <Select
                  value={searchFilters.collectionId || ', '}
                  onChange={(e) => handleFilterChange('collectionId', e.target.value)}
                >
                  <MenuItem value="">All Collections</MenuItem>
                  {collections.map((collection) => (
                    <MenuItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={searchFilters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="ready">Ready</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Access Level</InputLabel>
                <Select
                  value={searchFilters.accessLevel || ', '}
                  onChange={(e) => handleFilterChange('accessLevel', e.target.value)}
                >
                  <MenuItem value="">All Levels</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                  <MenuItem value="internal">Internal</MenuItem>
                  <MenuItem value="restricted">Restricted</MenuItem>
                  <MenuItem value="confidential">Confidential</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1}>
                <Button variant="contained"
                  onClick={handleSearch}
                  startIcon={<SearchIcon />}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setSearchFilters({
                    query: '',
                    tags:  [],
                    mimeTypes:  [],
                    status:  [],
                    sortBy: 'createdA',
                    sortOrder: 'desc',
                })}
                >
                  Clear
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Button variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload Assets
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setCollectionDialogOpen(true)}
              >
                New Collection
              </Button>
              {selectedAssets.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                >
                  Delete ({selectedAssets.length})
                </Button>
              )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('grid')}
                startIcon={<GridOnIcon />}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('list')}
                startIcon={<ListIcon />}
              >
                List
              </Button>
              <IconButton onClick={() => loadAssets()}>
                <RefreshIcon />
              </IconButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Assets Display */}
      {loading && <LinearProgress sx={{ mb:  2 }} />}
      
      {error && (
        <Alert severity="error" sx={{ mb:  2 }}>
          {error}
        </Alert>
      )}

      {viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {assets.map((asset) => (
            <Grid item xs={12} key={asset.id}>
              <Card
                sx={{
                  cursor: 'pointer', '&:hover': { boxShadow:  4 },
                  border: selectedAssets.includes(asset.id) ? 2 : 0,
                  borderColor: 'primary.main'}}
                onClick={() => {
                  setSelectedAsset(asset);
                  setAssetDetailsOpen(true);
              }}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb:  2 }}>
                    <Checkbox
                      checked={selectedAssets.includes(asset.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleAssetSelect(asset.id, e.target.checked);
                    }}
                    />
                    <IconButton size="small">
                      <MoreIcon />
                    </IconButton>
                  </Stack>
                  
                  <Box sx={{ textAlign: 'center', mb:  2 }}>
                    <Avatar
                      sx={{
                        width:  80,
                        height:  80,
                        mx: 'auto',
                        mb:  1,
                        bgcolor:'grey.10'}}
                    >
                      {getFileIcon(asset.mimeType)}
                    </Avatar>
                    <Typography variant="subtitle2" noWrap>
                      {asset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(asset.fileSize)}
                    </Typography>
                  </Box>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip
                      label={asset.status}
                      size="small"
                      color={getStatusColor(asset.status) as any}
                    />
                    <Stack direction="row" spacing={0.5}>
                      {getAccessLevelIcon(asset.accessLevel)}
                      {asset.isPublic ? <PublicIcon /> : <ViewOffIcon />}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card sx={theming.getThemedCardSx()}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedAssets.length === assets.length && assets.length > 0}
                      indeterminate={selectedAssets.length > 0 && selectedAssets.length < assets.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Access</TableCell>
                  <TableCell>Views</TableCell>
                  <TableCell>Downloads</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedAssets.includes(asset.id)}
                        onChange={(e) => handleAssetSelect(asset.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        {getFileIcon(asset.mimeType)}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {asset.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {asset.originalName}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={asset.fileExtension.toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatFileSize(asset.fileSize)}</TableCell>
                    <TableCell>
                      <Chip
                        label={asset.status}
                        size="small"
                        color={getStatusColor(asset.status) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {getAccessLevelIcon(asset.accessLevel)}
                        {asset.isPublic ? <PublicIcon /> : <ViewOffIcon />}
                      </Stack>
                    </TableCell>
                    <TableCell>{asset.viewCount}</TableCell>
                    <TableCell>{asset.downloadCount}</TableCell>
                    <TableCell>
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small">
                          <DownloadIcon />
                        </IconButton>
                        <IconButton size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small">
                          <ShareIcon />
                        </IconButton>
                        <IconButton size="small">
                          <MoreIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={totalAssets}
            page={currentPage}
            onPageChange={(_, newPage) => setCurrentPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setCurrentPage(0);
          }}
            rowsPerPageOptions={[2550, 100]}
          />
        </Card>
      )}

      {/* Asset Details Dialog */}
      <Dialog
        open={assetDetailsOpen}
        onClose={() => setAssetDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedAsset?.name}
            </Typography>
            <IconButton onClick={() => setAssetDetailsOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedAsset && (
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Details" />
              <Tab label="Versions" />
              <Tab label="Analytics" />
              <Tab label="Comments" />
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
