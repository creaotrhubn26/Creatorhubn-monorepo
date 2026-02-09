import { useTheming } from '../../utils/theming-helper';
import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  LinearProgress,
  Tabs,
  Tab,
  Divider,
  Stack,
  Alert
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Inventory,
  Extension,
  CloudUpload,
  CloudDownload,
  Star,
  Sync,
  AddCircle,
  Schedule,
  PhotoLibrary,
  Image as ImageIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { vendorOperationService } from '@/services/VendorOperationService';
import backgroundUploadService from '@/services/BackgroundUploadService';
import { getVendorTypeConfig, getProductCategories } from '@shared/vendor-type-registry';
import { UniversalFileUpload } from '@/components/universal/UniversalFileUpload';

interface VendorProductManagerProps {
  userId: string;
  initialMode?: 'overview' | 'add';
  onProductCreated?: () => void;
  vendorType?: string;
  // Integration props for universal workflow connectivity
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
  vendorType: string;
  productId?: string;
  status?: string;
  updatedAt: string;
}

interface VendorMeeting {
  id: string;
  title: string;
  agenda?: string;
  scheduledFor?: string;
  relatedProductId?: string;
  vendorType: string;
}

interface VendorWorklog {
  id: string;
  title: string;
  description?: string;
  productId?: string;
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
  size?: number;
  url?: string;
  productId?: string;
  vendorType: string;
  createdAt: string;
}

interface VendorSettingsUpdate {
  key: string;
  value: string | number | boolean | string[];
  updatedAt: string;
}

interface ProductCategory {
  id: string;
  label: string;
  color: string;
}

interface ProductAnalytics {
  totalDownloads?: number;
  totalRevenue?: number;
  averageRating?: number;
}

interface Product {
  id: string;
  name: string;
  vendor: string;
  category: string; // Dynamic based on vendor type
  version: string;
  price: number;
  currency: string;
  downloads: number;
  rating: number;
  status: 'active' | 'inactive' | 'pending';
  description: string;
  downloadUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string; // Optimized thumbnail for grid display
  fileSize?: number;
  tags: string[];
  images?: string[]; // Multiple product images
}

interface ProductDraft {
  name: string;
  category: string;
  version: string;
  price: number;
  description: string;
  tags: string;
  imageUrl: string;
}

interface UploadResult {
  result?: {
    url?: string;
  };
}

export default function VendorProductManager({
  userId,
  initialMode = 'overview',
  onProductCreated,
  vendorType = 'print',
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
}: VendorProductManagerProps) {
  // Theming system
  const theming = useTheming('vendor');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(initialMode === 'add');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewImageDialog, setViewImageDialog] = useState<{ open: boolean; imageUrl: string; productName: string }>({ 
    open: false, 
    imageUrl: '', 
    productName: '' 
  });
  
  // Get vendor type configuration
  const vendorConfig = getVendorTypeConfig(vendorType);

  const createNotification = useCallback((title: string, message: string, severity: VendorNotification['severity']) => {
    onNotificationCreate?.({
      id: `vendor-product-notification-${Date.now()}`,
      title,
      message,
      severity,
      createdAt: new Date().toISOString(),
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

  // Fetch dynamic categories from API (for bidirectional sync)
  const { data: categoriesData, refetch: refetchCategories } = useQuery<{ categories: ProductCategory[] }>({
    queryKey: ['/api/vendor-types', vendorType, 'categories'],
    queryFn: () => apiRequest(`/api/vendor-types/${vendorType}/categories`),
    staleTime: 30000, // 30 seconds
  });

  // Use API categories if available, otherwise fall back to registry
  const registryCategories = getProductCategories(vendorType) as ProductCategory[];
  const productCategories: ProductCategory[] = categoriesData?.categories?.length > 0
    ? categoriesData.categories
    : registryCategories;
  const categories = productCategories.map((cat) => cat.id);
  const defaultCategory = categories[0] || 'produkter';

  // Helper to get category info by id
  const getCategoryInfo = (categoryId: string) => {
    return productCategories.find((cat) => cat.id === categoryId) || { id: categoryId, label: categoryId, color: vendorConfig?.color || '#2196f3' };
  };

  // State for custom category creation
  const [showCustomCategoryDialog, setShowCustomCategoryDialog] = useState(false);
  const [customCategory, setCustomCategory] = useState({ id: '', label: '', color: vendorConfig?.color || '#2196f3' });

  const [newProduct, setNewProduct] = useState<ProductDraft>({
    name: '',
    category: defaultCategory,
    version: '1.0.0',
    price: 0,
    description: '',
    tags: '',
    imageUrl: ''
  });

  // Mutation to add custom category (bidirectional sync)
  const addCategoryMutation = useMutation({
    mutationFn: async (category: { id: string; label: string; color: string }) => {
      return apiRequest(`/api/vendor-types/${vendorType}/categories`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(category)
      });
    },
    onSuccess: (data: { category?: ProductCategory }) => {
      // Update local categories and select the new one
      refetchCategories();
      if (data.category) {
        setNewProduct(prev => ({ ...prev, category: data.category.id }));
      }
      setShowCustomCategoryDialog(false);
      setCustomCategory({ id: '', label: '', color: vendorConfig?.color || '#2196f3' });
      onSettingsUpdate?.({
        key: 'vendor_categories',
        value: data.category?.id ?? '',
        updatedAt: new Date().toISOString()
      });
    }
  });

  // Check if category ID already exists
  const categoryIdExists = (id: string): boolean => {
    const normalizedId = id.toLowerCase().replace(/\s+/g, '_');
    return categories.some((catId) => catId === normalizedId);
  };

  // Handle adding custom category
  const handleAddCustomCategory = () => {
    if (customCategory.id && customCategory.label) {
      const normalizedId = customCategory.id.toLowerCase().replace(/\s+/g, '_');

      // Check for duplicate before submitting
      if (categoryIdExists(normalizedId)) {
        // Category already exists - just select it and close dialog
        setNewProduct(prev => ({ ...prev, category: normalizedId }));
        setShowCustomCategoryDialog(false);
        setCustomCategory({ id: '', label: '', color: vendorConfig?.color || '#2196f3' });
        return;
      }

      addCategoryMutation.mutate({
        id: normalizedId,
        label: customCategory.label,
        color: customCategory.color
      });
    }
  };

  // Fetch vendor products - filtered by vendorType
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/vendor/products', userId, vendorType],
    queryFn: () => apiRequest(`/api/vendor/products/${userId}?vendorType=${vendorType}`)
  });

  // Fetch product analytics
  const { data: analytics } = useQuery<ProductAnalytics>({
    queryKey: ['/api/vendor/analytics', userId],
    queryFn: () => apiRequest(`/api/vendor/analytics/${userId}`)
  });

  // Add/Update product mutation - includes vendorType
  const productMutation = useMutation<Product, Error, Product>({
    mutationFn: async (productData) => {
      if (editingProduct) {
        return apiRequest(`/api/vendor/products/${editingProduct.id}`, {
          headers: { 'Content-Type' : 'application/json' },
          method: 'PUT',
          body: JSON.stringify({ ...productData, vendorType })
        });
      } else {
        return apiRequest('/api/vendor/products', {
          headers: { 'Content-Type' : 'application/json' },
          method: 'POST',
          body: JSON.stringify({ ...productData, vendorId: userId, vendorType })
        });
      }
    },
    onSuccess: (savedProduct) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', userId, vendorType] });
      setShowAddDialog(false);
      setEditingProduct(null);
      if (onProductCreated) {
        onProductCreated();
      }
      const productId = savedProduct.id;
      const now = new Date().toISOString();
      onWorklogCreate?.({
        id: `worklog-${productId}`,
        title: editingProduct ? 'Oppdaterte produkt' : 'Opprettet produkt',
        description: savedProduct.name,
        productId,
        createdAt: now
      });
      onProjectUpdate?.({
        id: selectedProject?.id,
        vendorType,
        productId,
        status: editingProduct ? 'product_updated' : 'product_created',
        updatedAt: now
      });
      if (!editingProduct) {
        onMeetingCreate?.({
          id: `meeting-${productId}`,
          title: `Produktgjennomgang: ${savedProduct.name}`,
          agenda: 'Gjennomgang av produkt, priser og publisering.',
          scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          relatedProductId: productId,
          vendorType
        });
      }
      if (selectedClient) {
        onClientUpdate?.({
          id: selectedClient.id,
          note: `Produkt ${savedProduct.name} ${editingProduct ? 'oppdatert' : 'opprettet'}.`,
          updatedAt: now
        });
      }
      createNotification(
        'Produkt lagret',
        `${savedProduct.name} er ${editingProduct ? 'oppdatert' : 'opprettet'}.`,
        'success'
      );
      setNewProduct({
        name: '',
        category: defaultCategory,
        version: '1.0.0',
        price: 0,
        description: '',
        tags: '',
        imageUrl: ''
      });
    }
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/vendor/products/${productId}`, {
        headers: { 'Content-Type' : 'application/json' },
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', userId, vendorType] });
    }
  });

  // Publish product mutation (set status to active)
  const publishMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/vendor/products/${productId}/publish`, {
        headers: { 'Content-Type' : 'application/json' },
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', userId, vendorType] });
    }
  });

  // Unpublish product mutation (set status to inactive)
  const unpublishMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest(`/api/vendor/products/${productId}/unpublish`, {
        headers: { 'Content-Type' : 'application/json' },
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', userId, vendorType] });
    }
  });

  const handleAddProduct = () => {
    setEditingProduct(null);
    setNewProduct({
      name: '',
      category: defaultCategory,
      version: '1.0.0',
      price: 0,
      description: '',
      tags: '',
      imageUrl: ''
    });
    setShowAddDialog(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      category: product.category,
      version: product.version,
      price: product.price,
      description: product.description,
      tags: product.tags.join(', '),
      imageUrl: product.imageUrl || ''
    });
    setShowAddDialog(true);
  };

  const handleSaveProduct = () => {
    const productData: Product = {
      ...editingProduct,
      ...newProduct,
      vendor: editingProduct?.vendor || userId,
      currency: editingProduct?.currency || 'NOK',
      downloads: editingProduct?.downloads || 0,
      rating: editingProduct?.rating || 0,
      status: editingProduct?.status || 'pending',
      id: editingProduct?.id || `product-${Date.now()}`,
      tags: newProduct.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    };
    productMutation.mutate(productData);
  };

  const handlePublishProduct = (product: Product) => {
    if (product.status === 'active') {
      unpublishMutation.mutate(product.id);
    } else {
      publishMutation.mutate(product.id);
    }
  };

  const handleUploadProductFile = (product: Product) => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.pkg,.dmg,.exe,.msi';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Upload via Smart Queue Management
        const taskIds = backgroundUploadService.addFiles(
          [file],
          `/api/vendor/products/${product.id}/upload`,
          {
            productId: product.id,
            vendor: product.vendor,
            category: 'product_file'
          }
        );
        const eventId = taskIds[0] || `upload-${Date.now()}`;
        onFileUpload?.({
          id: eventId,
          name: file.name,
          size: file.size,
          productId: product.id,
          vendorType,
          createdAt: new Date().toISOString()
        });
        createNotification('Filopplasting startet', `Opplasting startet for ${product.name}.`, 'info');
      }
    };
    input.click();
  };

  const handleSyncProduct = async (product: Product) => {
    try {
      await vendorOperationService.checkPluginUpdates(
        product.vendor,
        [{
          id: product.id,
          name: product.name,
          currentVersion: product.version,
          updateUrl: product.downloadUrl || ''
        }]
      );
      onWorklogCreate?.({
        id: `sync-${product.id}`,
        title: 'Synkroniserte produkt',
        description: product.name,
        productId: product.id,
        createdAt: new Date().toISOString()
      });
      createNotification('Synkronisering startet', `Synkroniserer ${product.name}.`, 'info');
  } catch (error) {
      console.error('Failed to sync product: ', error);
      createNotification('Synkronisering feilet', `Kunne ikke synkronisere ${product.name}.`, 'error');
  }
};

  const handleDownloadProduct = (product: Product) => {
    if (!product.downloadUrl) return;
    onFileDownload?.({
      id: `download-${product.id}`,
      name: product.name,
      url: product.downloadUrl,
      productId: product.id,
      vendorType,
      createdAt: new Date().toISOString()
    });
    window.open(product.downloadUrl, '_blank');
  };

  // Dynamic category colors from vendor type registry
  const getCategoryColor = (category: string): string => {
    const categoryInfo = getCategoryInfo(category);
    return categoryInfo.color;
  };

  const getCategoryIcon = (category: string): JSX.Element => {
    const iconMap: { [key: string]: JSX.Element } = {
      // Print categories
      visittkort: <Extension />,
      plakater: <Extension />,
      brosjyrer: <Extension />,
      logoer: <Extension />,
      maler: <Inventory />,
      fonts: <Extension />,

      // Hardware categories
      kameraer: <Extension />,
      objektiver: <Extension />,
      audio: <Extension />,
      tilbehoer: <Extension />,
      stativer: <Inventory />,
      belysning: <Extension />,

      // Design categories
      pensler: <Extension />,
      teksturer: <Extension />,
      actions: <Extension />,
      overlays: <Extension />,
      mockups: <Inventory />,

      // Video categories
      templates: <Extension />,
      effekter: <Extension />,
      transitions: <Extension />,
      luts: <Extension />,
      lydeffekter: <Inventory />,
      musikk: <Extension />,

      // Software categories
      applikasjoner: <Extension />,
      scripts: <Extension />,
      utvidelser: <Extension />,
      verktoy: <Extension />,
      plugins: <Inventory />,
      presets: <Extension />
    };
    return iconMap[category] || <Extension />;
  };

  const filteredProducts = products.filter((product: Product) => {
    if (activeTab === 0) return true; // All
    if (activeTab === 1) return product.status === 'active';
    if (activeTab === 2) return product.status === 'inactive';
    if (activeTab === 3) return product.status === 'pending';
    return true;
  });

  useEffect(() => {
    if (initialMode === 'add') {
      setShowAddDialog(true);
    }
  }, [initialMode]);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
          Laster produkter...
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="main" role="main" aria-label="Produkthåndtering" sx={{ p: initialMode === 'add' ? 0 : 3 }}>
      {/* Only show overview when not in add mode */}
      {initialMode !== 'add' && (
        <>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
              Produkthåndtering - {vendorConfig?.name || vendorType}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add aria-hidden="true" />}
              onClick={handleAddProduct}
              aria-label="Legg til nytt produkt"
              sx={{ 
                bgcolor: '#27ae60', 
                minHeight: 48,
                '&:hover': { bgcolor: '#229954' },
                '&:focus-visible': {
                  outline: '3px solid #27ae60',
                  outlineOffset: '2px'
                }
              }}
            >
              Legg til Produkt
            </Button>
          </Box>

          {(onMeetingCreate || onShowcaseCreate || onWorklogCreate) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {onMeetingCreate && (
                <Button
                  variant="outlined"
                  startIcon={<Schedule aria-hidden="true" />}
                  onClick={() =>
                    onMeetingCreate({
                      id: `meeting-general-${Date.now()}`,
                      title: 'Produktstrategi',
                      agenda: 'Planlegg produktlanseringer og prising.',
                      scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
                      vendorType
                    })
                  }
                >
                  Planlegg møte
                </Button>
              )}
              {onWorklogCreate && (
                <Button
                  variant="outlined"
                  startIcon={<Edit aria-hidden="true" />}
                  onClick={() =>
                    onWorklogCreate({
                      id: `worklog-general-${Date.now()}`,
                      title: 'Oppdaterte produktkatalog',
                      description: 'Planlegging og prioritering av produktkatalog.',
                      createdAt: new Date().toISOString()
                    })
                  }
                >
                  Logg arbeid
                </Button>
              )}
              {onShowcaseCreate && (
                <Button
                  variant="outlined"
                  startIcon={<Star aria-hidden="true" />}
                  onClick={() =>
                    onShowcaseCreate({
                      id: `showcase-${Date.now()}`,
                      title: 'Ny produktshowcase',
                      productIds: products.slice(0, 3).map((product) => product.id),
                      createdAt: new Date().toISOString()
                    })
                  }
                >
                  Lag showcase
                </Button>
              )}
            </Box>
          )}

          {/* Analytics Summary */}
          {analytics && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', border: '1px solid #3498db30' }}>
                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#3498db' }}>
                      {analytics.totalDownloads || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Totale Downloads
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', border: '1px solid #27ae6030' }}>
                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#27ae60' }}>
                      {analytics.totalRevenue || 0} NOK
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Total Omsetning
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', border: '1px solid #e74c3c30' }}>
                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#e74c3c' }}>
                      {analytics.averageRating || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Gjennomsnittlig Rating
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', border: '1px solid #9b59b630' }}>
                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#9b59b6' }}>
                      {products.length}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Aktive Produkter
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="Produktfiltrering"
            sx={{ mb: 3 }}
          >
            <Tab label="Alle Produkter" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Aktive" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Inaktive" id="tab-2" aria-controls="tabpanel-2" />
            <Tab label="Venter" id="tab-3" aria-controls="tabpanel-3" />
          </Tabs>

          {/* Products Grid */}
          <Grid container spacing={3}>
            <AnimatePresence>
              {filteredProducts.map((product: Product, index: number) => (
                <Grid item xs={12} sm={6} md={4} key={product.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card sx={{
                      height: '100%',
                      border: `1px solid ${getCategoryColor(product.category)}30`, '&:hover': {
                        boxShadow: `0 8px 24px ${getCategoryColor(product.category)}20`,
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s ease'
                    }}>
                      <CardContent sx={{ p: 3 }}>
                        {/* Product Image/Thumbnail */}
                        <Box sx={{ mb: 2, position: 'relative' }}>
                          {product.thumbnailUrl || product.imageUrl ? (
                            <Box
                              component="button"
                              onClick={() => setViewImageDialog({ 
                                open: true, 
                                imageUrl: product.imageUrl || product.thumbnailUrl || '', 
                                productName: product.name 
                              })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setViewImageDialog({ 
                                    open: true, 
                                    imageUrl: product.imageUrl || product.thumbnailUrl || '', 
                                    productName: product.name 
                                  });
                                }
                              }}
                              tabIndex={0}
                              aria-label={`Vis stort bilde av ${product.name}`}
                              sx={{
                                width: '100%',
                                height: 200,
                                p: 0,
                                border: `2px solid ${getCategoryColor(product.category)}30`,
                                borderRadius: 2,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                background: 'none',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  borderColor: getCategoryColor(product.category),
                                  transform: 'scale(1.02)',
                                  boxShadow: `0 4px 12px ${getCategoryColor(product.category)}40`
                                },
                                '&:focus-visible': {
                                  outline: `3px solid ${getCategoryColor(product.category)}`,
                                  outlineOffset: '2px'
                                }
                              }}
                            >
                              <img
                                src={product.thumbnailUrl || product.imageUrl}
                                alt={`${product.name} produktbilde`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                                loading="lazy"
                              />
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                width: '100%',
                                height: 200,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: `${getCategoryColor(product.category)}10`,
                                border: `2px dashed ${getCategoryColor(product.category)}30`,
                                borderRadius: 2
                              }}
                            >
                              <PhotoLibrary 
                                sx={{ 
                                  fontSize: 60, 
                                  color: `${getCategoryColor(product.category)}50` 
                                }} 
                                aria-hidden="true"
                              />
                            </Box>
                          )}
                          {/* Category Badge */}
                          <Chip
                            label={getCategoryInfo(product.category).label}
                            size="small"
                            icon={<ImageIcon aria-hidden="true" />}
                            sx={{
                              position: 'absolute',
                              bottom: 8,
                              right: 8,
                              bgcolor: 'rgba(0,0,0,0.75)',
                              color: 'white',
                              fontWeight: 600,
                              backdropFilter: 'blur(4px)',
                              '& .MuiChip-icon': {
                                color: 'white'
                              }
                            }}
                          />
                        </Box>

                        {/* Product Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Avatar 
                            sx={{
                              bgcolor: `${getCategoryColor(product.category)}20`,
                              color: getCategoryColor(product.category)
                            }}
                            aria-hidden="true"
                          >
                            {getCategoryIcon(product.category)}
                          </Avatar>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={product.status}
                              size="small"
                              color={product.status === 'active' ? 'success' : product.status === 'pending' ? 'warning' : 'default'}
                              aria-label={`Status: ${product.status === 'active' ? 'Aktiv' : product.status === 'pending' ? 'Venter' : 'Inaktiv'}`}
                            />
                            <Button
                              size="small"
                              variant={product.status === 'active' ? 'outlined' : 'contained'}
                              color={product.status === 'active' ? 'warning' : 'success'}
                              onClick={() => handlePublishProduct(product)}
                              aria-label={product.status === 'active' ? `Avpubliser ${product.name}` : `Publiser ${product.name}`}
                              sx={{
                                minHeight: 32,
                                '&:focus-visible': {
                                  outline: '3px solid',
                                  outlineOffset: '2px'
                                }
                              }}
                            >
                              {product.status === 'active' ? 'Avpubliser' : 'Publiser'}
                            </Button>
                          </Box>
                        </Box>

                        {/* Product Info */}
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          {product.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                          v{product.version} • {getCategoryInfo(product.category).label}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, height: 40, overflow: 'hidden' }}>
                          {product.description}
                        </Typography>

                        {/* Stats */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} aria-label={`${product.downloads || 0} nedlastninger`}>
                            <CloudDownload sx={{ fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
                            <Typography variant="caption">
                              {product.downloads || 0}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} aria-label={`${product.rating || 0} stjerner rating`}>
                            <Star sx={{ fontSize: 16, color: '#ffc107' }} aria-hidden="true" />
                            <Typography variant="caption">
                              {product.rating || 0}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: getCategoryColor(product.category) }} aria-label={`Pris: ${product.price} ${product.currency}`}>
                            {product.price} {product.currency}
                          </Typography>
                        </Box>

                        {/* Tags */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          {product.tags.slice(0, 2).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{
                                bgcolor: `${getCategoryColor(product.category)}15`,
                                color: getCategoryColor(product.category),
                                fontSize: '0.7rem'
                              }}
                            />
                          ))}
                        </Box>

                        {/* Actions */}
                        <Box role="group" aria-label="Produkt handlinger" sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditProduct(product)}
                            aria-label={`Rediger ${product.name}`}
                            sx={{ 
                              color: '#3498db',
                              minWidth: 48,
                              minHeight: 48,
                              '&:focus-visible': {
                                outline: '3px solid #3498db',
                                outlineOffset: '2px'
                              }
                            }}
                          >
                            <Edit fontSize="small" aria-hidden="true" />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={() => handleUploadProductFile(product)}
                            aria-label={`Last opp fil for ${product.name}`}
                            sx={{ 
                              color: '#9b59b6',
                              minWidth: 48,
                              minHeight: 48,
                              '&:focus-visible': {
                                outline: '3px solid #9b59b6',
                                outlineOffset: '2px'
                              }
                            }}
                          >
                            <CloudUpload fontSize="small" aria-hidden="true" />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={() => handleSyncProduct(product)}
                            sx={{ color: '#27ae60' }}
                          >
                            <Sync fontSize="small" />
                          </IconButton>

                          {product.downloadUrl && (
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadProduct(product)}
                              sx={{ color: '#2c3e50' }}
                            >
                              <CloudDownload fontSize="small" />
                            </IconButton>
                          )}

                          <IconButton
                            size="small"
                            onClick={() => deleteMutation.mutate(product.id)}
                            sx={{ color: '#e74c3c' }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingProduct ? 'Rediger Produkt' : `Legg til Nytt ${vendorConfig?.name || vendorType} Produkt`}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Product Image Upload */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star sx={{ color: vendorConfig?.color || '#2196f3' }} />
                Produktbilde
              </Typography>
              {newProduct.imageUrl && (
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    component="img"
                    src={newProduct.imageUrl}
                    alt="Produktbilde"
                    sx={{
                      width: 100,
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: `2px solid ${vendorConfig?.color || '#2196f3'}50`
                    }}
                  />
                  <Button
                    onClick={() => setNewProduct({ ...newProduct, imageUrl: '' })}
                    size="small"
                    color="error"
                  >
                    Fjern bilde
                  </Button>
                </Box>
              )}
              <UniversalFileUpload
                allowedTypes="images"
                maxFiles={1}
                maxFileSizeMB={10}
                profession={vendorType === 'print' ? 'vendor' : 'photographer'}
                onUploadComplete={(results?: UploadResult[]) => {
                  if (results && results.length > 0 && results[0].result?.url) {
                    setNewProduct({ ...newProduct, imageUrl: results[0].result.url });
                  }
                }}
                onUploadError={(error: string) => {
                  console.error('Bildeopplasting feilet:', error);
                }}
                className="vendor-product-image-upload"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Produktnavn"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={newProduct.category}
                  label="Kategori"
                  onChange={(e) => {
                    if (e.target.value === '__add_custom__') {
                      setShowCustomCategoryDialog(true);
                    } else {
                      setNewProduct({ ...newProduct, category: e.target.value });
                    }
                  }}
                >
                  {productCategories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                        {cat.label}
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem value="__add_custom__">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                      <AddCircle fontSize="small" />
                      Legg til ny kategori...
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Versjon"
                value={newProduct.version}
                onChange={(e) => setNewProduct({ ...newProduct, version: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Pris (NOK)"
                type="number"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Beskrivelse"
                multiline
                rows={3}
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tags (komma-separert)"
                value={newProduct.tags}
                onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                helperText="Eksempel: synthesizer, kontakt, piano"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleSaveProduct}
            variant="contained"
            disabled={productMutation.isPending}
            sx={{ bgcolor: '#27ae60', '&:hover': { bgcolor: '#229954' } }}
          >
            {productMutation.isPending ? 'Lagrer...' : (editingProduct ? 'Oppdater' : 'Legg til')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custom Category Dialog */}
      <Dialog
        open={showCustomCategoryDialog}
        onClose={() => setShowCustomCategoryDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AddCircle sx={{ color: vendorConfig?.color || 'primary.main' }} />
            Legg til ny kategori
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, mt: 1 }}>
            Ny kategori vil bli lagt til for alle {vendorConfig?.name || 'vendor'}-produkter.
          </Alert>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Kategori ID"
              value={customCategory.id}
              onChange={(e) => setCustomCategory({
                ...customCategory,
                id: e.target.value.toLowerCase().replace(/\s+/g, '_')
              })}
              placeholder="f.eks. synthesizers"
              helperText={
                categoryIdExists(customCategory.id)
                  ? "Denne kategorien finnes allerede - klikk for å velge den" : "Unik ID (lowercase, ingen mellomrom)"
              }
              error={categoryIdExists(customCategory.id)}
              color={categoryIdExists(customCategory.id) ? 'warning' : undefined}
            />
            <TextField
              fullWidth
              label="Visningsnavn"
              value={customCategory.label}
              onChange={(e) => setCustomCategory({ ...customCategory, label: e.target.value })}
              placeholder="f.eks. Synthesizers"
              helperText="Navn som vises i menyen"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">Farge:</Typography>
              <input
                type="color"
                value={customCategory.color}
                onChange={(e) => setCustomCategory({ ...customCategory, color: e.target.value })}
                style={{ width: 50, height: 35, border: 'none', cursor: 'pointer', borderRadius: 4 }}
              />
              <Box
                sx={{
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: customCategory.color,
                  color: 'white',
                  fontWeight: 50
                }}
              >
                {customCategory.label || 'Forhåndsvisning'}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCustomCategoryDialog(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleAddCustomCategory}
            variant="contained"
            disabled={!customCategory.id || !customCategory.label || addCategoryMutation.isPending}
            sx={{ bgcolor: vendorConfig?.color || 'primary.main' }}
          >
            {addCategoryMutation.isPending
              ? 'Legger til...'
              : categoryIdExists(customCategory.id)
                ? 'Velg eksisterende kategori' : 'Legg til kategori'
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={viewImageDialog.open}
        onClose={() => setViewImageDialog({ open: false, imageUrl: '', productName: '' })}
        maxWidth="lg"
        fullWidth
        aria-labelledby="image-viewer-title"
      >
        <DialogTitle id="image-viewer-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ImageIcon sx={{ color: vendorConfig?.color || 'primary.main' }} aria-hidden="true" />
            <Typography variant="h6" component="h2">
              {viewImageDialog.productName}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 400,
              bgcolor: 'rgba(0,0,0,0.05)',
              borderRadius: 2,
              p: 2
            }}
          >
            {viewImageDialog.imageUrl ? (
              <img
                src={viewImageDialog.imageUrl}
                alt={`Stort bilde av ${viewImageDialog.productName}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 8
                }}
              />
            ) : (
              <PhotoLibrary sx={{ fontSize: 100, color: 'text.disabled' }} aria-hidden="true" />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setViewImageDialog({ open: false, imageUrl: '', productName: '' })}
            sx={{
              minHeight: 48,
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: vendorConfig?.color || 'primary.main',
                outlineOffset: '2px'
              }
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}