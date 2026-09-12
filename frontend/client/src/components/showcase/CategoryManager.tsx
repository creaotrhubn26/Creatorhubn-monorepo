// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import _getProfessionIcon from '@/utils/profession-icons';
// Wiring: getProfessionIcon is available for dynamic icon rendering
const getProfessionIcon = _getProfessionIcon;
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Grid,
  Card as MuiCard,
  CardContent,
  CardActions,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Snackbar,
  Checkbox,
  FormGroup,
  InputAdornment,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  GridView as GridViewIcon,
  ViewModule as MasonryIcon,
  ViewCarousel as CarouselIcon,
  Sync as SyncIcon,
  Add as AddIcon,
  DragIndicator as DragIndicatorIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

// Common file types available for categories
const COMMON_FILE_TYPES = {
  'jpeg': 'JPEG Images',
  'jpg': 'JPG Images',
  'png': 'PNG Images',
  'gif': 'GIF Images',
  'webp': 'WebP Images',
  'mov': 'MOV Videos',
  'mp4': 'MP4 Videos',
  'webm': 'WebM Videos',
  'mkv': 'MKV Videos',
  'avi': 'AVI Videos',
  'pdf': 'PDF Documents',
  'doc': 'Word Documents',
  'docx': 'Word Documents (New)',
  'xls': 'Excel Spreadsheets',
  'xlsx': 'Excel Spreadsheets (New)',
  'pptx': 'PowerPoint Presentations'
};

interface ShowcaseCategory {
  id: number;
  driveFolderId: string;
  folderName: string;
  folderPath: string;
  categoryName: string;
  displayName: string;
  isVisible: boolean;
  sortOrder: number;
  gridLayout: 'grid' | 'masonry' | 'carousel';
  lastSyncAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  fileCount: number;
  allowedFileTypes: string[]
}

interface CategoryManagerProps {
  userId: string;
  profession: string;
  onCategorySelect?: (categoryId: number) => void;
  editMode?: boolean
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  userId,
  profession,
  onCategorySelect,
  editMode = false
}) => {
  const [editingCategory, setEditingCategory] = useState<ShowcaseCategory | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedCategory, setDraggedCategory] = useState<ShowcaseCategory | null>(null);
  const [snackbarError, setSnackbarError] = useState<string | null>(null);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>(['jpeg', 'jpg', 'png', 'gif', 'mov', 'mp4', 'webm']);
  
  const { user } = useAuth();
  
  const queryClient = useQueryClient();
  const { integration, componentRegistry } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    if (!userId) return;

    // Track component registration
    componentRegistry.registerComponent({
      id: `category-manager-${userId}`,
      type: 'admin',
      userId: user?.id,
      capabilities: [
        'categories', 'category-settings', 'sync-status', 'category:selected', 
        'category:updated', 'category:visibility-changed', 'select-category', 
        'edit-category', 'toggle-visibility', 'update-settings'
      ],
      dependencies: ['showcase-drive-manager', 'showcase-admin'],
      lastActive: Date.now(),
      performance: { renderCount: 0, avgRenderTime: 0, memoryUsage: 0 }
    });

    return () => {
      componentRegistry.unregisterComponent(`category-manager-${userId}`);
    };
  }, [componentRegistry, userId, user?.id]);

  // Fetch categories using apiRequest
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['showcase-categories', userId],
    queryFn: async () => {
      try {
        const result = await apiRequest(`/api/showcase/drive/categories?userId=${userId}`);
        // Track category fetch event
        integration.emit?.('categories:fetched', { 
          userId, 
          count: Array.isArray(result) ? result.length : (result?.data?.length || 0),
          timestamp: Date.now()
        });
        return (Array.isArray(result) ? result : result?.data) as ShowcaseCategory[];
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw error;
      }
  }
});

  // Update category mutation - using apiRequest with error handling
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, updates }: { categoryId: number; updates: any }) => {
      return apiRequest(`/api/showcase/drive/category/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['showcase-categories', userId] });
      setEditDialog(false);
      setEditingCategory(null);
      
      // Broadcast category updated event
      integration.emit('category:updated', {
        category: data,
        userId,
        profession: currentProfession,
        timestamp: Date.now()
      });
    },
    onError: (error: Error) => {
      setSnackbarError(`Feil ved oppdatering av kategori: ${error.message}`);
      console.error('Failed to update category:', error);
    }
  });

// Delete category mutation - using apiRequest with error handling
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      // Emit category deleted event before deletion
      integration.emit?.('category:deleted', { 
        categoryId, 
        userId, 
        profession: currentProfession,
        timestamp: Date.now() 
      });
      return apiRequest(`/api/showcase/drive/category/${categoryId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-categories', userId] });
      setConfirmDeleteCategoryId(null);
    },
    onError: (error: Error) => {
      setSnackbarError(`Feil ved sletting av kategori: ${error.message}`);
      console.error('Failed to delete category:', error);
      setConfirmDeleteCategoryId(null);
    }
});

  // Sync category mutation - using apiRequest with error handling
  const syncCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      // Emit category sync started event
      integration.emit?.('category:sync-started', { 
        categoryId, 
        userId, 
        profession: currentProfession,
        timestamp: Date.now() 
      });
      return apiRequest(`/api/showcase/drive/category/${categoryId}/sync`, {
        method: 'POST',
        body: JSON.stringify({ userId, profession: currentProfession })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-categories', userId] });
    },
    onError: (error: Error) => {
      setSnackbarError(`Feil ved synkronisering av kategori: ${error.message}`);
      console.error('Failed to sync category:', error);
    }
  });

  const handleEditCategory = useCallback((category: ShowcaseCategory) => {
    setEditingCategory(category);
    setEditDialog(true);
    
    // Broadcast category selected for editing event
    integration.emit('category:selected', {
      category,
      userId,
      profession: currentProfession,
      action: 'edit'
    });
  }, [userId, currentProfession, integration]);

  const handleSaveCategory = useCallback(() => {
    if (!editingCategory) return;
    
    updateCategoryMutation.mutate({
      categoryId: editingCategory.id,
      updates: {
        displayName: editingCategory.displayName,
        categoryName: editingCategory.categoryName,
        gridLayout: editingCategory.gridLayout,
        allowedFileTypes: editingCategory.allowedFileTypes,
        isVisible: editingCategory.isVisible
      }
    });
  }, [editingCategory, updateCategoryMutation]);

  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim() || !user) return;
    
    try {
      const createResponse = await apiRequest('/api/showcase/drive/category', {
        method: 'POST',
        body: JSON.stringify({
          categoryName: newCategoryName.trim(),
          displayName: newCategoryName.trim(),
          userId: user.id,
          profession: currentProfession,
          driveFolderId: user.id,
          allowedFileTypes: selectedFileTypes,
          gridLayout: 'grid',
          isVisible: true,
          sortOrder: categories.length
        })
      });
      
      // Emit category created event
      integration.emit('category:created', {
        category: createResponse,
        userId: user.id,
        profession: currentProfession,
        timestamp: Date.now()
      });
      
      // Invalidate cache and reset form
      queryClient.invalidateQueries({ queryKey: ['showcase-categories', user.id] });
      setNewCategoryName('');
      setSelectedFileTypes(['jpeg', 'jpg', 'png', 'gif', 'mov', 'mp4', 'webm']);
      setShowAddDialog(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSnackbarError(`Feil ved oppretting av kategori: ${errorMsg}`);
      console.error('Failed to create category:', error);
      integration.emit('category:creation-failed', {
        error: errorMsg,
        userId: user?.id,
        profession: currentProfession,
        timestamp: Date.now()
      });
    }
  }, [newCategoryName, selectedFileTypes, user, currentProfession, categories.length, integration, queryClient]);

  const toggleVisibility = useCallback((categoryId: number, isVisible: boolean) => {
    // Track visibility toggle event
    integration.emit('category:visibility-toggled', { 
      categoryId, 
      isVisible: !isVisible, 
      userId, 
      profession: currentProfession,
      timestamp: Date.now() 
    });
    updateCategoryMutation.mutate({
      categoryId,
      updates: { isVisible: !isVisible }
    });
  }, [userId, currentProfession, integration, updateCategoryMutation]);

  const getGridLayoutIcon = (layout: string) => {
    switch (layout) {
      case 'masonry': return <MasonryIcon />;
      case 'carousel': return <CarouselIcon />;
      default: return <GridViewIcon />;
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'success';
      case 'syncing': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter((cat) =>
    cat.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.folderName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle drag start
  const handleDragStart = useCallback((category: ShowcaseCategory) => {
    setDraggedCategory(category);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop for reordering
  const handleDrop = useCallback(async (targetCategory: ShowcaseCategory) => {
    if (!draggedCategory || draggedCategory.id === targetCategory.id) {
      setDraggedCategory(null);
      return;
    }

    try {
      // Swap sort orders
      const oldSortOrder = draggedCategory.sortOrder;
      const newSortOrder = targetCategory.sortOrder;

      // Update both categories
      await Promise.all([
        updateCategoryMutation.mutateAsync({
          categoryId: draggedCategory.id,
          updates: { sortOrder: newSortOrder }
        }),
        updateCategoryMutation.mutateAsync({
          categoryId: targetCategory.id,
          updates: { sortOrder: oldSortOrder }
        })
      ]);

      // Emit reorder event
      integration.emit('category:reordered', {
        sourceId: draggedCategory.id,
        targetId: targetCategory.id,
        userId,
        timestamp: Date.now()
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSnackbarError(`Feil ved omsortering av kategorier: ${errorMsg}`);
    } finally {
      setDraggedCategory(null);
    }
  }, [draggedCategory, userId, integration, updateCategoryMutation]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
}

  if (!categories || categories.length === 0) {
    return (
      <Alert severity="info">
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Ingen kategorier funnet</Typography>
        <Typography>
          Gå til "Drive Integration" for å sette opp dine første showcase-kategorier.
        </Typography>
      </Alert>
    );
}

  return (
    <Box>
      {/* Error Snackbar */}
      <Snackbar
        open={!!snackbarError}
        autoHideDuration={6000}
        onClose={() => setSnackbarError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={() => setSnackbarError(null)} severity="error" sx={{ width: '100%' }}>
          {snackbarError}
        </Alert>
      </Snackbar>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Kategori-administrasjon`
              : 'Kategori-administrasjon'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {filteredCategories.length} av {categories.length} kategorier
          </Typography>
          {editMode && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
              size="small"
              sx={{
                borderColor: professionColor,
                color: professionColor,
                '&:hover': {
                  borderColor: professionColor,
                  backgroundColor: `${professionColor}15`
                }
              }}
            >
              Ny kategori
            </Button>
          )}
        </Box>
      </Box>

      {/* Search Field */}
      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="Søk etter kategori navn, folder navn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setSearchTerm('')}
                  edge="end"
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
          size="small"
          variant="outlined"
        />
      </Box>

      <Grid container spacing={3}>
        {filteredCategories.map((category) => (
          <Grid
            item
            xs={12}
            md={6}
            lg={4}
            key={category.id}
            draggable={editMode}
            onDragStart={() => editMode && handleDragStart(category)}
            onDragOver={editMode ? handleDragOver : undefined}
            onDrop={() => editMode && handleDrop(category)}
            sx={{
              opacity: draggedCategory?.id === category.id ? 0.5 : 1,
              cursor: editMode ? 'grab' : 'default',
              '&:active': editMode ? { cursor: 'grabbing' } : {}
            }}
          >
            <MuiCard 
              sx={{ 
                height: '100%',
                background: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(25, 140, 200, 0.2)',
                cursor: onCategorySelect ? 'pointer' : 'default',
                position: 'relative',
                '&:hover': onCategorySelect ? {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                  transition: 'all 0.2s ease-in-out'
                } : {}
              }}
              onClick={() => onCategorySelect && onCategorySelect(category.id)}
            >
              {editMode && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    opacity: 0.7,
                    cursor: 'grab',
                    '&:active': { cursor: 'grabbing' }
                  }}
                  draggable
                  onDragStart={() => handleDragStart(category)}
                >
                  <DragIndicatorIcon sx={{ color: professionColor }} />
                </Box>
              )}

              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, pr: editMode ? 3 : 0 }}>
                    {category.displayName || category.categoryName}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(category.id, category.isVisible);
                    }}
                  >
                    {category.isVisible ? (
                      <VisibilityIcon color="primary" />
                    ) : (
                      <VisibilityOffIcon color="disabled" />
                    )}
                  </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  📁 {category.folderName}
                </Typography>

                <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                  <Chip 
                    label={`${category.fileCount || 0} filer`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={category.syncStatus}
                    size="small"
                    color={getSyncStatusColor(category.syncStatus) as any}
                    variant="outlined"
                  />
                  <Chip
                    icon={getGridLayoutIcon(category.gridLayout)}
                    label={category.gridLayout}
                    size="small"
                    variant="outlined"
                  />
                  {!category.isVisible && (
                    <Chip
                      label="Skjult"
                      size="small"
                      color="warning"
                      variant="filled"
                    />
                  )}
                </Box>

                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {category.allowedFileTypes?.slice(0, 4).map((type) => (
                    <Chip
                      key={type}
                      label={type.toUpperCase()}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ))}
                  {category.allowedFileTypes?.length > 4 && (
                    <Chip
                      label={`+${category.allowedFileTypes.length - 4}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </Box>

                {category.lastSyncAt && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Sist synkronisert: {new Date(category.lastSyncAt).toLocaleString('no')}
                  </Typography>
                )}
              </CardContent>

              {editMode && (
                <CardActions sx={theming.getThemedCardSx()}>
                  <Button
                    size="small"
                    startIcon={<SyncIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      syncCategoryMutation.mutate(category.id);
                    }}
                    disabled={syncCategoryMutation.isPending}
                  >
                    {syncCategoryMutation.isPending ? 'Synkroniserer...' : 'Synkroniser'}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCategory(category);
                    }}
                  >
                    Rediger
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DeleteIcon />}
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteCategoryId(category.id);
                    }}
                    disabled={deleteCategoryMutation.isPending}
                  >
                    {deleteCategoryMutation.isPending ? 'Sletter...' : 'Slett'}
                  </Button>
                </CardActions>
              )}
            </MuiCard>
          </Grid>
        ))}
      </Grid>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog
          open={editDialog}
          onClose={() => setEditDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: 'rgba(15,23,42,0.96)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              '& .MuiOutlinedInput-root': { color: '#fff' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.23)' },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            },
          }}
        >
          <DialogTitle>Rediger kategori</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Kategori navn"
                value={editingCategory?.categoryName || ''}
                onChange={(e) => editingCategory && setEditingCategory({
                  ...editingCategory,
                  categoryName: e.target.value
                })}
              />

              <TextField
                fullWidth
                label="Visningsnavn"
                value={editingCategory?.displayName || ''}
                onChange={(e) => editingCategory && setEditingCategory({
                  ...editingCategory,
                  displayName: e.target.value
                })}
              />

              <TextField
                fullWidth
                type="number"
                label="Sorteringsrekkefølge"
                value={editingCategory?.sortOrder || 0}
                onChange={(e) => editingCategory && setEditingCategory({
                  ...editingCategory,
                  sortOrder: parseInt(e.target.value) || 0
                })}
                helperText="Lavere tall vises først (eller dra kategori for å sortere)"
              />

              <FormControl fullWidth>
                <InputLabel>Grid-layout</InputLabel>
                <Select
                  value={editingCategory?.gridLayout || 'grid'}
                  onChange={(e) => editingCategory && setEditingCategory({
                    ...editingCategory,
                    gridLayout: e.target.value as any
                  })}
                  label="Grid-layout"
                >
                  <MenuItem value="grid">
                    <Box display="flex" alignItems="center" gap={1}>
                      <GridViewIcon />
                      Standard Grid
                    </Box>
                  </MenuItem>
                  <MenuItem value="masonry">
                    <Box display="flex" alignItems="center" gap={1}>
                      <MasonryIcon />
                      Masonry Layout
                    </Box>
                  </MenuItem>
                  <MenuItem value="carousel">
                    <Box display="flex" alignItems="center" gap={1}>
                      <CarouselIcon />
                      Carousel
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <Typography variant="subtitle2" gutterBottom>Tillatte filtyper</Typography>
                <FormGroup sx={{ pl: 1 }}>
                  {Object.entries(COMMON_FILE_TYPES).map(([fileType, label]) => (
                    <FormControlLabel
                      key={fileType}
                      control={
                        <Checkbox
                          checked={editingCategory?.allowedFileTypes?.includes(fileType) || false}
                          onChange={(e) => {
                            if (!editingCategory) return;
                            const newTypes = e.target.checked
                              ? [...(editingCategory.allowedFileTypes || []), fileType]
                              : (editingCategory.allowedFileTypes || []).filter(t => t !== fileType);
                            setEditingCategory({
                              ...editingCategory,
                              allowedFileTypes: newTypes
                            });
                          }}
                        />
                      }
                      label={label}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={editingCategory?.isVisible || false}
                    onChange={(e) => editingCategory && setEditingCategory({
                      ...editingCategory,
                      isVisible: e.target.checked
                    })}
                  />
                }
                label="Synlig i showcase"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(false)}>
              Avbryt
            </Button>
            <Button
              onClick={() => handleSaveCategory()}
              variant="contained"
              disabled={updateCategoryMutation.isPending}
              sx={{
                background: 'linear-gradient(45deg, #ff8c00, #ff6b35)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #ff7b00, #ff5722)'
                }
              }}
            >
              {updateCategoryMutation.isPending ? <CircularProgress size={20} /> : 'Lagre'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Confirm Delete Category Dialog */}
      <Dialog
        open={!!confirmDeleteCategoryId}
        onClose={() => setConfirmDeleteCategoryId(null)}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15,23,42,0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
          },
        }}
      >
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne kategorien? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteCategoryId(null)}>Avbryt</Button>
          <Button 
            onClick={() => {
              if (confirmDeleteCategoryId) {
                deleteCategoryMutation.mutate(confirmDeleteCategoryId);
                setConfirmDeleteCategoryId(null);
              }
            }} 
            color="error" 
            variant="contained"
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15,23,42,0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            '& .MuiOutlinedInput-root': { color: '#fff' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.23)' },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
            '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
          },
        }}
      >
        <DialogTitle>Opprett ny kategori</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Kategori navn"
              placeholder="f.eks. Bryllup, Portrett, Produkter"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newCategoryName.trim()) {
                  handleCreateCategory();
                }
              }}
              autoFocus
              helperText="Dette blir brukt som foldernavn i Drive og visningsnavn i showcase."
            />

            <FormControl fullWidth>
              <Typography variant="subtitle2" gutterBottom>Tillatte filtyper</Typography>
              <FormGroup sx={{ pl: 1 }}>
                {Object.entries(COMMON_FILE_TYPES).map(([fileType, label]) => (
                  <FormControlLabel
                    key={fileType}
                    control={
                      <Checkbox
                        checked={selectedFileTypes.includes(fileType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFileTypes([...selectedFileTypes, fileType]);
                          } else {
                            setSelectedFileTypes(selectedFileTypes.filter(t => t !== fileType));
                          }
                        }}
                      />
                    }
                    label={label}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddDialog(false);
            setNewCategoryName('');
            setSelectedFileTypes(['jpeg', 'jpg', 'png', 'gif', 'mov', 'mp4', 'webm']);
          }}>
            Avbryt
          </Button>
          <Button
            onClick={handleCreateCategory}
            variant="contained"
            disabled={!newCategoryName.trim() || selectedFileTypes.length === 0}
            sx={{
              background: 'linear-gradient(45deg, #ff8c00, #ff6b35)',
              color: '#fff',
              '&:hover': {
                background: 'linear-gradient(45deg, #ff7b00, #ff5722)'
              },
              '&:disabled': {
                background: '#ccc'
              }
            }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
