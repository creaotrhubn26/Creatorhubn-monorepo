import { useTheming } from '../../utils/theming-helper';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  IconButton,
  Divider,
  TextField,
  Stack,
} from '@mui/material';
import {
  Add,
  Settings,
  Category,
  CheckCircle,
  RadioButtonUnchecked,
  Lightbulb,
  Extension,
  Info,
  Edit,
  Delete,
  ColorLens,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { getAllVendorTypes, enableVendorType, VendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorTypeManagerProps {
  onTypeEnabled?: (typeId: string) => void;
  onMeetingCreate?: (meeting: VendorMeeting) => void;
  onProjectUpdate?: (project: VendorProjectUpdate) => void;
  onWorklogCreate?: (worklog: VendorWorklog) => void;
  onClientSelect?: (client: VendorClientSelection | null) => void;
  onClientUpdate?: (client: VendorClientUpdate) => void;
  onShowcaseCreate?: (showcase: VendorShowcase) => void;
  onFileUpload?: (file: VendorFileEvent) => void;
  onFileDownload?: (file: VendorFileEvent) => void;
  selectedProject?: VendorProjectSelection | null;
  onProjectSelect?: (project: VendorProjectSelection | null) => void;
  selectedClient?: VendorClientSelection | null;
  onSettingsUpdate?: (settings: VendorSettingsUpdate) => void;
  onNotificationCreate?: (notification: VendorNotification) => void
}

interface VendorNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

interface VendorProjectSelection {
  id: string;
  name?: string;
}

interface VendorProjectUpdate {
  id?: string;
  status?: string;
  vendorType?: string;
  updatedAt: string;
}

interface VendorMeeting {
  id: string;
  title: string;
  agenda?: string;
  scheduledFor?: string;
}

interface VendorWorklog {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}

interface VendorClientSelection {
  id: string;
  name?: string;
  email?: string;
}

interface VendorClientUpdate {
  id: string;
  note?: string;
  updatedAt: string;
}

interface VendorShowcase {
  id: string;
  title: string;
  productIds: string[];
  createdAt: string;
}

interface VendorFileEvent {
  id: string;
  name: string;
  url?: string;
  createdAt: string;
}

interface VendorSettingsUpdate {
  key: string;
  value: string | number | boolean | string[];
  updatedAt: string;
}

// Category type for editing
interface ProductCategory {
  id: string;
  label: string;
  color: string;
}

export default function VendorTypeManager({
  onTypeEnabled,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: VendorTypeManagerProps) {
  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<VendorTypeConfig | null>(null);

  // State for categories editor
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<VendorTypeConfig | null>(null);
  const [editingCategories, setEditingCategories] = useState<ProductCategory[]>([]);
  const [originalCategories, setOriginalCategories] = useState<ProductCategory[]>([]); // Track original for change detection
  const [newCategory, setNewCategory] = useState<ProductCategory>({ id: '', label: '', color: '#2196f3' });
  const [categoryChangeNotice, setCategoryChangeNotice] = useState<string | null>(null);
  const [importingCategories, setImportingCategories] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('vendor');

  const createNotification = useCallback((title: string, message: string, severity: VendorNotification['severity']) => {
    onNotificationCreate?.({
      id: `vendor-type-notification-${Date.now()}`,
      title,
      message,
      severity,
      createdAt: new Date().toISOString()
    });
  }, [onNotificationCreate]);

  useEffect(() => {
    if (selectedProject && onProjectSelect) {
      onProjectSelect(selectedProject);
    }
  }, [onProjectSelect, selectedProject]);

  useEffect(() => {
    if (selectedClient && onClientSelect) {
      onClientSelect(selectedClient);
    }
  }, [onClientSelect, selectedClient]);

  // Fetch current vendor types
  const { data: vendorTypesData, isLoading } = useQuery<{ vendorTypes?: VendorTypeConfig[]; totalTypes?: number }>({
    queryKey: ['/api/vendor-types'],
    queryFn: () => apiRequest('/api/vendor-types')
  });

  const fallbackVendorTypes = useMemo(() => getAllVendorTypes(), []);

  // Fetch available expandable types
  const { data: availableTypes } = useQuery<{ availableTypes?: VendorTypeConfig[]; count?: number }>({
    queryKey: ['/api/vendor-types/expandable/available'],
    queryFn: () => apiRequest('/api/vendor-types/expandable/available')
  });
  const availableVendorTypes = availableTypes?.availableTypes ?? [];
  const availableVendorTypeCount = availableTypes?.count ?? availableVendorTypes.length;

  // Enable vendor type mutation
  const enableTypeMutation = useMutation({
    mutationFn: async (typeId: string) => {
      return apiRequest(`/api/vendor-types/enable/${typeId}`, {
        method: 'POST',
        headers: {
          "Content-Type" : "application/json"
        }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-types']});
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-types/expandable/available']});
      if (data?.config?.id) {
        enableVendorType(data.config.id);
      }
      setEnableDialogOpen(false);
      if (onTypeEnabled) {
        onTypeEnabled(data.config.id);
      }
      onSettingsUpdate?.({
        key: 'vendor_type_enabled',
        value: data.config.id,
        updatedAt: new Date().toISOString()
      });
      onWorklogCreate?.({
        id: `worklog-type-${data.config.id}`,
        title: 'Aktiverte vendor type',
        description: data.config.name,
        createdAt: new Date().toISOString()
      });
      onProjectUpdate?.({
        id: selectedProject?.id,
        status: 'vendor_type_enabled',
        vendorType: data.config.id,
        updatedAt: new Date().toISOString()
      });
      if (selectedClient) {
        onClientUpdate?.({
          id: selectedClient.id,
          note: `Vendor type aktivert: ${data.config.name}`,
          updatedAt: new Date().toISOString()
        });
      }
      onMeetingCreate?.({
        id: `meeting-type-${data.config.id}`,
        title: `Oppstart: ${data.config.name}`,
        agenda: 'Gjennomgang av nye funksjoner og kategorier.',
        scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
      });
      createNotification('Vendor type aktivert', `${data.config.name} er nå aktiv.`, 'success');
    }
  });

  // Update vendor type mutation (for categories)
  const updateTypeMutation = useMutation({
    mutationFn: async ({ typeId, updates }: { typeId: string; updates: Partial<VendorTypeConfig> }) => {
      return apiRequest(`/api/vendor-types/${typeId}`, {
        method: 'PUT',
        headers: {
          "Content-Type" : "application/json"
        },
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-types']});
      setCategoriesDialogOpen(false);
      setEditingType(null);
      setEditingCategories([]);
      setOriginalCategories([]);
      setCategoryChangeNotice(null);
      onSettingsUpdate?.({
        key: 'vendor_categories_updated',
        value: editingType?.id || '',
        updatedAt: new Date().toISOString()
      });
      onWorklogCreate?.({
        id: `worklog-categories-${Date.now()}`,
        title: 'Oppdaterte produktkategorier',
        description: editingType?.name,
        createdAt: new Date().toISOString()
      });
    }
  });

  // Update single category mutation (handles ID changes)
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ typeId, categoryId, updates }: { typeId: string; categoryId: string; updates: Partial<ProductCategory> }) => {
      return apiRequest(`/api/vendor-types/${typeId}/categories/${categoryId}`, {
        method: 'PUT',
        headers: {
          "Content-Type" : "application/json"
        },
        body: JSON.stringify(updates)
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-types']});
      if (data.affectedProducts > 0) {
        setCategoryChangeNotice(`${data.affectedProducts} produkter ble oppdatert med ny kategori-ID.`);
      }
      // Update local state with new categories
      if (data.categories) {
        setEditingCategories(data.categories);
        setOriginalCategories(data.categories);
      }
      onSettingsUpdate?.({
        key: 'vendor_category_updated',
        value: data.categories?.map((cat: ProductCategory) => cat.id) || [],
        updatedAt: new Date().toISOString()
      });
    }
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ typeId, categoryId, replacementCategory }: { typeId: string; categoryId: string; replacementCategory?: string }) => {
      return apiRequest(`/api/vendor-types/${typeId}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          "Content-Type" : "application/json"
        },
        body: JSON.stringify({ replacementCategory })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-types']});
      if (data.affectedProducts > 0) {
        setCategoryChangeNotice(`${data.affectedProducts} produkter ble flyttet til "${data.replacementCategory}".`);
      }
      // Update local state
      if (data.categories) {
        setEditingCategories(data.categories);
        setOriginalCategories(data.categories);
      }
      onSettingsUpdate?.({
        key: 'vendor_category_deleted',
        value: data.replacementCategory || '',
        updatedAt: new Date().toISOString()
      });
    }
  });

  const handleEnableType = (type: VendorTypeConfig) => {
    setSelectedType(type);
    setEnableDialogOpen(true);
    onShowcaseCreate?.({
      id: `showcase-type-${type.id}`,
      title: `${type.name} Showcase`,
      productIds: [],
      createdAt: new Date().toISOString()
    });
  };

  const confirmEnableType = () => {
    if (selectedType) {
      enableTypeMutation.mutate(selectedType.id);
    }
  };

  // Open categories editor
  const handleEditCategories = (type: VendorTypeConfig) => {
    setEditingType(type);
    const categories = type.productCategories || [];
    setEditingCategories(categories);
    setOriginalCategories(JSON.parse(JSON.stringify(categories))); // Deep copy for change detection
    setNewCategory({ id: '', label: '', color: type.color || '#2196f3' });
    setCategoryChangeNotice(null);
    setCategoriesDialogOpen(true);
  };

  // Add new category (local state + API)
  const handleAddCategory = () => {
    if (newCategory.id && newCategory.label && editingType) {
      // Generate ID from label if not provided
      const categoryId = newCategory.id || newCategory.label.toLowerCase().replace(/\s+/g, '_');
      const categoryToAdd = { ...newCategory, id: categoryId };

      // Add locally first for immediate feedback
      setEditingCategories([...editingCategories, categoryToAdd]);
      setNewCategory({ id: '', label: '', color: editingType?.color || '#2196f3' });

      // Also add via API for bidirectional sync
      apiRequest(`/api/vendor-types/${editingType.id}/categories`, {
        method: 'POST',
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(categoryToAdd)
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/vendor-types']});
      });
    }
  };

  // Remove category - uses DELETE endpoint which updates affected products
  const handleRemoveCategory = (categoryId: string) => {
    if (editingType) {
      // Check if this is an existing category (in originalCategories)
      const isExisting = originalCategories.some(cat => cat.id === categoryId);

      if (isExisting) {
        // Use DELETE endpoint - will update affected products
        deleteCategoryMutation.mutate({
          typeId: editingType.id,
          categoryId
        });
      } else {
        // Just remove from local state (was just added)
        setEditingCategories(editingCategories.filter(cat => cat.id !== categoryId));
      }
    }
  };

  // Update category (local state)
  const handleUpdateCategory = (index: number, field: keyof ProductCategory, value: string) => {
    const updated = [...editingCategories];
    updated[index] = { ...updated[index], [field]: value };
    setEditingCategories(updated);
  };

  // Commit category ID change - uses PUT endpoint which updates affected products
  const handleCommitCategoryIdChange = (index: number) => {
    if (!editingType) return;

    const category = editingCategories[index];
    const original = originalCategories[index];

    if (original && category.id !== original.id) {
      // ID changed - use PUT endpoint to update products
      updateCategoryMutation.mutate({
        typeId: editingType.id,
        categoryId: original.id,
        updates: {
          id: category.id,
          label: category.label,
          color: category.color
        }
      });
    }
  };

  // Save categories
  const handleSaveCategories = () => {
    if (editingType) {
      updateTypeMutation.mutate({
        typeId: editingType.id,
        updates: { productCategories: editingCategories }
      });
    }
  };

  const handleExportCategories = () => {
    if (!editingType) return;
    const payload = JSON.stringify(editingCategories, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fileName = `${editingType.id}-categories.json`;
    onFileDownload?.({
      id: `download-${editingType.id}-${Date.now()}`,
      name: fileName,
      url,
      createdAt: new Date().toISOString()
    });
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCategories = (file: File) => {
    if (!editingType) return;
    setImportingCategories(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ProductCategory[];
        const sanitized = parsed
          .filter((category) => category.id && category.label)
          .map((category) => ({
            id: category.id.toLowerCase().replace(/\s+/g, '_'),
            label: category.label,
            color: category.color || editingType.color || '#2196f3'
          }));
        setEditingCategories(sanitized);
        updateTypeMutation.mutate({
          typeId: editingType.id,
          updates: { productCategories: sanitized }
        });
        onFileUpload?.({
          id: `upload-${editingType.id}-${Date.now()}`,
          name: file.name,
          createdAt: new Date().toISOString()
        });
        createNotification('Kategorier importert', `Importererte ${sanitized.length} kategorier.`, 'success');
      } catch (error) {
        console.error('Failed to import categories', error);
        createNotification('Import feilet', 'Kunne ikke importere kategorifil.', 'error');
      } finally {
        setImportingCategories(false);
      }
    };
    reader.onerror = () => {
      setImportingCategories(false);
      createNotification('Import feilet', 'Kunne ikke lese filen.', 'error');
    };
    reader.readAsText(file);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      creative: '#e91e63',
      technology: '#2196f3',
      service: '#ff9800',
      physical: '#795548',
      education: '#4caf50',
      lifestyle: '#9c27b0'
    };
    return colors[category as keyof typeof colors] || '#9e9e9e';
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Laster vendor typer...</Typography>
      </Box>
    );
}

  return (
    <Box component="main" role="main" aria-label="Vendor Type Manager" sx={{ p: 3 }}>
      {/* Header */}
      <Paper component="header" sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 60, height: 60 }} aria-hidden="true">
            <Category sx={{ fontSize: 30, color: 'white' }} aria-hidden="true" />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: 'white', fontWeight: 700}}>
              Vendor Type Manager
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Administrer og utvid vendor kategorier
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Current Vendor Types */}
      <Paper component="section" aria-labelledby="active-types-heading" sx={{ p: 3, mb: 3 }}>
        <Typography 
          variant="h5" 
          component="h2"
          id="active-types-heading"
          sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}
        >
          <CheckCircle sx={{ mr: 2, color: 'success.main' }} aria-hidden="true" />
          Aktive Vendor Typer ({vendorTypesData?.totalTypes || 0})
        </Typography>
        
        <Grid container spacing={2}>
          {(vendorTypesData?.vendorTypes?.length ? vendorTypesData.vendorTypes : fallbackVendorTypes).map((type: VendorTypeConfig) => (
            <Grid item xs={12} sm={6} md={4} key={type.id}>
              <Card sx={{ 
                height: '100%',
                border: `2px solid ${type.color}30`, '&:hover': { borderColor: type.color }
            }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: type.color }}>
                      <Category />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600}}>
                        {type.name}
                      </Typography>
                      <Chip 
                        label={type.category}
                        size="small"
                        sx={{ 
                          bgcolor: getCategoryColor(type.category),
                          color: 'white',
                          fontSize: '0.7rem'
                      }}
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {type.targetCustomers.slice(0, 2).join(', ')}
                    {type.targetCustomers.length > 2 && '...'}
                  </Typography>

                  {/* Product Categories Preview */}
                  {type.productCategories && type.productCategories.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
                        Produktkategorier:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {type.productCategories.slice(0, 4).map((cat) => (
                          <Chip
                            key={cat.id}
                            label={cat.label}
                            size="small"
                            sx={{
                              bgcolor: cat.color,
                              color: 'white',
                              fontSize: '0.6rem',
                              height: 20
                            }}
                          />
                        ))}
                        {type.productCategories.length > 4 && (
                          <Chip
                            label={`+${type.productCategories.length - 4}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 20 }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {Object.entries(type.supportedFeatures)
                      .filter(([, enabled]) => enabled)
                      .slice(0, 3)
                      .map(([feature]) => (
                        <Chip
                          key={feature}
                          label={feature}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem' }}
                        />
                      ))}
                  </Box>

                  {/* Edit Categories Button */}
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEditCategories(type)}
                    sx={{
                      borderColor: type.color,
                      color: type.color, '&:hover': {
                        borderColor: type.color,
                        bgcolor: `${type.color}10`,
                      }}}
                  >
                    Rediger Kategorier
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Available Expandable Types */}
      {availableVendorTypes.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <Extension sx={{ mr: 2, color: 'primary.main' }} />
            Tilgjengelige Utvidelser ({availableVendorTypeCount})
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Disse vendor typene kan aktiveres for å utvide plattformen med nye kategorier og funktionalitet.
            </Typography>
          </Alert>
          
          <Grid container spacing={2}>
            {availableVendorTypes.map((type: VendorTypeConfig) => (
              <Grid item xs={12} sm={6} md={4} key={type.id}>
                <Card sx={{ 
                  height: '100%',
                  border: `2px dashed ${type.color}50`, '&:hover': { 
                    borderColor: type.color,
                    borderStyle: 'solid'
                }
              }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: `${type.color}20`, color: type.color }}>
                        {React.createElement(type.icon)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600}}>
                          {type.name}
                        </Typography>
                        <Chip 
                          label={type.category}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: getCategoryColor(type.category),
                            color: getCategoryColor(type.category),
                            fontSize: '0.7rem'
                        }}
                        />
                      </Box>
                    </Box>
                    
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      Målgruppe: {type.targetCustomers.slice(0, 2).join(', ')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {type.marketplaceCategory.slice(0, 3).map(cat => (
                        <Chip 
                          key={cat}
                          label={cat}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.6rem' }}
                        />
                      ))}
                    </Box>
                    
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={theming.getThemedIcon('add')}
                      onClick={() => handleEnableType(type)}
                      sx={{
                        borderColor: type.color,
                        color: type.color, '&:hover': {
                          borderColor: type.color,
                          bgcolor: `${type.color}10`
                      }
                    }}
                    >
                      Aktiver Type
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Enable Type Dialog */}
      <Dialog open={enableDialogOpen} onClose={() => setEnableDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: selectedType?.color || 'primary.main' }}>
              {selectedType && React.createElement(selectedType.icon)}
            </Avatar>
            Aktiver {selectedType?.name}
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedType && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Du er i ferd med å aktivere en ny vendor type. Dette vil legge til nye funksjoner og kategorier.
              </Alert>
              
              <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                Funksjoner som aktiveres:
              </Typography>
              <List dense>
                {Object.entries(selectedType.supportedFeatures)
                  .filter(([, enabled]) => enabled)
                  .map(([feature]) => (
                    <ListItem key={feature}>
                      <ListItemIcon>
                        <CheckCircle color="success" />
                      </ListItemIcon>
                      <ListItemText primary={feature.replace(/_/g, ' ')} />
                    </ListItem>
                  ))}
              </List>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Kategorier: {selectedType.marketplaceCategory.join(', ')}
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setEnableDialogOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={confirmEnableType}
            disabled={enableTypeMutation.isPending}
            sx={{ bgcolor: selectedType?.color }}
          >
            {enableTypeMutation.isPending ? 'Aktiverer...' : 'Aktiver Type'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Categories Editor Dialog */}
      <Dialog
        open={categoriesDialogOpen}
        onClose={() => setCategoriesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: editingType?.color || 'primary.main' }}>
              <Category />
            </Avatar>
            Rediger Produktkategorier - {editingType?.name}
          </Box>
        </DialogTitle>

        <DialogContent>
          {editingType && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Definer produktkategorier for {editingType.name}. Disse kategoriene vil være tilgjengelige når leverandører oppretter produkter.
              </Alert>

              {/* Notice about affected products */}
              {categoryChangeNotice && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setCategoryChangeNotice(null)}>
                  {categoryChangeNotice}
                </Alert>
              )}

              {/* Add New Category */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
                  Legg til ny kategori
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
                  <TextField
                    label="Kategori ID"
                    size="small"
                    value={newCategory.id}
                    onChange={(e) => setNewCategory({ ...newCategory, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="f.eks. visittkort"
                    helperText="Unik ID (lowercase)"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Visningsnavn"
                    size="small"
                    value={newCategory.label}
                    onChange={(e) => setNewCategory({ ...newCategory, label: e.target.value })}
                    placeholder="f.eks. Visittkort"
                    helperText="Navn som vises til brukere"
                    sx={{ flex: 1 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                    />
                    <Typography variant="caption">{newCategory.color}</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddCategory}
                    disabled={!newCategory.id || !newCategory.label}
                    sx={{ bgcolor: editingType.color }}
                  >
                    Legg til
                  </Button>
                </Stack>
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={handleExportCategories}>
                    Eksporter kategorier
                  </Button>
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={importingCategories}
                  >
                    {importingCategories ? 'Importerer...' : 'Importer kategorier'}
                    <input
                      type="file"
                      accept="application/json"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleImportCategories(file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </Button>
                </Box>
              </Paper>

              {/* Current Categories */}
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
                Nåværende kategorier ({editingCategories.length})
              </Typography>

              {editingCategories.length === 0 ? (
                <Alert severity="warning">
                  Ingen kategorier definert. Legg til minst én kategori.
                </Alert>
              ) : (
                <Stack spacing={1}>
                  {editingCategories.map((cat, index) => {
                    const original = originalCategories[index];
                    const idChanged = original && cat.id !== original.id;

                    return (
                      <Paper
                        key={`${original?.id || cat.id}-${index}`}
                        sx={{
                          p: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          borderLeft: `4px solid ${cat.color}`,
                          bgcolor: idChanged ? 'warning.light' : 'background.paper'
                        }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: cat.color,
                            flexShrink: 0
                          }}
                        />
                        <TextField
                          size="small"
                          label="ID"
                          value={cat.id}
                          onChange={(e) =>
                            handleUpdateCategory(
                              index,
                              'id',
                              e.target.value.toLowerCase().replace(/\s+/g, '_'),
                            )
                          }
                          sx={{ width: 150 }}
                          helperText={idChanged ? `Endret fra: ${original.id}` : undefined}
                          color={idChanged ? 'warning' : undefined}
                        />
                        <TextField
                          size="small"
                          label="Visningsnavn"
                          value={cat.label}
                          onChange={(e) => handleUpdateCategory(index, 'label', e.target.value)}
                          sx={{ flex: 1 }}
                        />
                        <input
                          type="color"
                          value={cat.color}
                          onChange={(e) => handleUpdateCategory(index, 'color', e.target.value)}
                          style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}
                          title="Velg farge"
                        />
                        {idChanged && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => handleCommitCategoryIdChange(index)}
                            disabled={updateCategoryMutation.isPending}
                          >
                            {updateCategoryMutation.isPending ? '...' : 'Oppdater ID'}
                          </Button>
                        )}
                        <IconButton
                          onClick={() => handleRemoveCategory(original?.id || cat.id)}
                          color="error"
                          size="small"
                          disabled={deleteCategoryMutation.isPending}
                          title="Slett kategori (produkter flyttes til annen kategori)"
                        >
                          <Delete />
                        </IconButton>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCategoriesDialogOpen(false)}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategories}
            disabled={updateTypeMutation.isPending || editingCategories.length === 0}
            sx={{ bgcolor: editingType?.color }}
          >
            {updateTypeMutation.isPending ? 'Lagrer...' : 'Lagre Kategorier'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
