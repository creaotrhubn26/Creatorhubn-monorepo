import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Divider,
  alpha,
  useTheme,
  Tooltip,
  Badge,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Collapse,
  Avatar
} from '@mui/material';
import {
  Inventory,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Add,
  Remove,
  Edit,
  Search,
  Refresh,
  TrendingDown,
  TrendingUp,
  Info,
  Settings,
  History,
  FilterList,
  Download,
  LocalShipping,
  QrCode,
  Lightbulb,
  Scale,
  Timeline as TimelineIcon,
  Person,
  ShoppingCart,
  LocalShipping as ShippingIcon,
  Cancel,
  AddCircle,
  RemoveCircle,
  SwapHoriz,
  Assessment,
  Category,
  AccessTime,
  PhotoLibrary
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorInventoryManagerProps {
  vendorType: string;
  vendorName: string;
  userId: string;
}

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  reorderPoint: number;
  reorderQuantity?: number;
  unit: string;
  location?: string;
  lastRestocked?: string;
  lastSold?: string;
  averageSalesPerWeek?: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';
  category?: string;
  supplier?: string;
  costPrice?: number;
  sellingPrice?: number;
  trackInventory: boolean;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  shippingEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function VendorInventoryManager({
  vendorType,
  vendorName,
  userId
}: VendorInventoryManagerProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // Helper function to highlight search terms (WCAG 2.2 compliant)
  const highlightSearchTerm = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <Box
              key={index}
              component="mark"
              sx={{
                bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.25),
                color: 'inherit',
                fontWeight: 700,
                padding: '2px 4px',
                borderRadius: '3px',
                border: `1.5px solid ${vendorConfig?.color || '#2196f3'}`,
                // WCAG 2.2: Ensure proper contrast
                outline: 'none'
              }}
            >
              {part}
            </Box>
          ) : (
            part
          )
        )}
      </span>
    );
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [skuDialogOpen, setSkuDialogOpen] = useState(false);
  const [insightsTab, setInsightsTab] = useState(0);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [lastUpdatedFilter, setLastUpdatedFilter] = useState<string>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchFields, setSearchFields] = useState<string[]>(['productName', 'sku']);
  const [skuDraft, setSkuDraft] = useState('');
  const [reorderDraft, setReorderDraft] = useState({ minimumStock: 0, reorderPoint: 0, reorderQuantity: 0 });
  const [shippingDraft, setShippingDraft] = useState({
    weight: 0,
    dimensions: { length: 0, width: 0, height: 0 },
    shippingEnabled: false
  });

  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch SKU history/timeline
  const { data: timelineData } = useQuery({
    queryKey: ['/api/vendor-inventory/timeline', selectedItem?.productId],
    queryFn: () =>
      selectedItem
        ? apiRequest(`/api/vendor-inventory/timeline/${selectedItem.productId}`)
        : Promise.resolve(null),
    enabled: !!selectedItem && timelineDialogOpen
  });

  // Fetch inventory data
  const { data: inventoryData, isLoading, refetch } = useQuery({
    queryKey: ['/api/vendor-inventory', vendorType, vendorName, userId, statusFilter],
    queryFn: () =>
      apiRequest(`/api/vendor-inventory/${vendorType}/${vendorName}/${userId}?status=${statusFilter}`),
    refetchInterval: 60000 // Refresh every minute
  });

  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: ({
      productId,
      adjustment,
      reason
    }: {
      productId: string;
      adjustment: number;
      reason: string;
    }) =>
      apiRequest('/api/vendor-inventory/adjust-stock', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, productId, adjustment, reason }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory'] });
      setAdjustDialogOpen(false);
      setSelectedItem(null);
      setStockAdjustment(0);
      setAdjustmentReason('');
    }
  });

  // Update reorder settings mutation
  const updateReorderMutation = useMutation({
    mutationFn: ({
      productId,
      minimumStock,
      reorderPoint,
      reorderQuantity
    }: {
      productId: string;
      minimumStock: number;
      reorderPoint: number;
      reorderQuantity: number;
    }) =>
      apiRequest('/api/vendor-inventory/update-reorder', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, productId, minimumStock, reorderPoint, reorderQuantity }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory'] });
      setSettingsDialogOpen(false);
      setSelectedItem(null);
    }
  });

  const updateSkuMutation = useMutation({
    mutationFn: ({ productId, sku }: { productId: string; sku: string }) =>
      apiRequest('/api/vendor-inventory/update-sku', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, productId, sku }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory'] });
      setSkuDialogOpen(false);
      setSelectedItem(null);
    }
  });

  const updateTrackingMutation = useMutation({
    mutationFn: ({ productId, trackInventory }: { productId: string; trackInventory: boolean }) =>
      apiRequest('/api/vendor-inventory/update-tracking', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, productId, trackInventory }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory'] });
    }
  });

  const updateShippingMutation = useMutation({
    mutationFn: ({
      productId,
      weight,
      dimensions,
      shippingEnabled
    }: {
      productId: string;
      weight: number;
      dimensions: { length: number; width: number; height: number };
      shippingEnabled: boolean;
    }) =>
      apiRequest('/api/vendor-inventory/update-shipping', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, productId, weight, dimensions, shippingEnabled }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory'] });
      setShippingDialogOpen(false);
      setSelectedItem(null);
    }
  });

  const inventory: InventoryItem[] = inventoryData?.inventory || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return '#4caf50';
      case 'low_stock':
        return '#ff9800';
      case 'out_of_stock':
        return '#f44336';
      case 'overstocked':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <CheckCircle />;
      case 'low_stock':
        return <Warning />;
      case 'out_of_stock':
        return <ErrorIcon />;
      case 'overstocked':
        return <Info />;
      default:
        return <Inventory />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'På lager';
      case 'low_stock':
        return 'Lavt lager';
      case 'out_of_stock':
        return 'Tomt';
      case 'overstocked':
        return 'Overfylt';
      default:
        return 'Ukjent';
    }
  };

  const getStockPercentage = (item: InventoryItem) => {
    if (item.maximumStock) {
      return (item.currentStock / item.maximumStock) * 100;
    }
    return (item.currentStock / (item.reorderPoint * 2)) * 100;
  };

  const filteredInventory = inventory.filter(item => {
    // Advanced search across multiple fields
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = searchFields.some(field => {
        switch (field) {
          case 'productName':
            return item.productName.toLowerCase().includes(query);
          case 'sku':
            return item.sku.toLowerCase().includes(query);
          case 'supplier':
            return item.supplier?.toLowerCase().includes(query);
          case 'location':
            return item.location?.toLowerCase().includes(query);
          case 'category':
            return item.category?.toLowerCase().includes(query);
          default:
            return false;
        }
      });
    }
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    
    // Last updated filter
    let matchesLastUpdated = true;
    if (lastUpdatedFilter !== 'all' && item.updatedAt) {
      const updatedDate = new Date(item.updatedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (lastUpdatedFilter) {
        case 'today':
          matchesLastUpdated = daysDiff === 0;
          break;
        case 'week':
          matchesLastUpdated = daysDiff <= 7;
          break;
        case 'month':
          matchesLastUpdated = daysDiff <= 30;
          break;
        case 'older':
          matchesLastUpdated = daysDiff > 30;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesCategory && matchesLastUpdated;
  });

  const inventoryStats = {
    total: inventory.length,
    inStock: inventory.filter(i => i.status === 'in_stock').length,
    lowStock: inventory.filter(i => i.status === 'low_stock').length,
    outOfStock: inventory.filter(i => i.status === 'out_of_stock').length,
    totalValue: inventory.reduce((sum, item) => sum + (item.currentStock * (item.costPrice || 0)), 0)
  };

  const handleOpenAdjustDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustDialogOpen(true);
  };

  const handleOpenSettingsDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setSettingsDialogOpen(true);
    setReorderDraft({
      minimumStock: item.minimumStock,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity || 0
    });
  };

  const handleOpenSkuDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setSkuDraft(item.sku || '');
    setSkuDialogOpen(true);
  };

  const handleOpenShippingDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setShippingDraft({
      weight: item.weight || 0,
      dimensions: {
        length: item.dimensions?.length || 0,
        width: item.dimensions?.width || 0,
        height: item.dimensions?.height || 0
      },
      shippingEnabled: Boolean(item.shippingEnabled)
    });
    setShippingDialogOpen(true);
  };

  const handleSaveReorderSettings = () => {
    if (!selectedItem) return;
    updateReorderMutation.mutate({
      productId: selectedItem.productId,
      minimumStock: reorderDraft.minimumStock,
      reorderPoint: reorderDraft.reorderPoint,
      reorderQuantity: reorderDraft.reorderQuantity
    });
  };

  const handleSaveSku = () => {
    if (!selectedItem) return;
    updateSkuMutation.mutate({
      productId: selectedItem.productId,
      sku: skuDraft.trim()
    });
  };

  const handleSaveShipping = () => {
    if (!selectedItem) return;
    updateShippingMutation.mutate({
      productId: selectedItem.productId,
      weight: shippingDraft.weight,
      dimensions: shippingDraft.dimensions,
      shippingEnabled: shippingDraft.shippingEnabled
    });
  };

  const handleAdjustStock = () => {
    if (selectedItem && stockAdjustment !== 0) {
      updateStockMutation.mutate({
        productId: selectedItem.productId,
        adjustment: stockAdjustment,
        reason: adjustmentReason
      });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster lagerbeholdning...</Typography>
      </Box>
    );
  }

  return (
    <Box role="main" aria-label="Lagerstyring">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Inventory sx={{ color: vendorConfig?.color || '#2196f3' }} aria-hidden="true" />
          Lagerstyring
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<Download aria-hidden="true" />}
            aria-label="Eksporter lagerbeholdning"
          >
            Eksporter
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh aria-hidden="true" />}
            onClick={() => refetch()}
            aria-label="Oppdater lagerbeholdning"
          >
            Oppdater
          </Button>
        </Box>
      </Box>
      
      {/* Screen reader status for search results */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      >
        {searchQuery && `${filteredInventory.length} produkt${filteredInventory.length !== 1 ? 'er' : ','} funnet for søket "${searchQuery}"`}
      </div>

      {/* Inventory stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'all' ? `2px solid ${vendorConfig?.color || '#2196f3'}` : '1px solid',
              borderColor: statusFilter === 'all' ? vendorConfig?.color || '#2196f3' : 'divider',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: vendorConfig?.color || '#2196f3' }}>
                {inventoryStats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale produkter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'low_stock' ? `2px solid #ff9800` : '1px solid',
              borderColor: statusFilter === 'low_stock' ? '#ff9800' : 'divider',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
            onClick={() => setStatusFilter('low_stock')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={inventoryStats.lowStock} color="warning">
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                  {inventoryStats.lowStock}
                </Typography>
              </Badge>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Lavt lager
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'out_of_stock' ? `2px solid #f44336` : '1px solid',
              borderColor: statusFilter === 'out_of_stock' ? '#f44336' : 'divider',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
            onClick={() => setStatusFilter('out_of_stock')}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={inventoryStats.outOfStock} color="error">
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#f44336' }}>
                  {inventoryStats.outOfStock}
                </Typography>
              </Badge>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Tomt lager
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                {inventoryStats.totalValue.toLocaleString()} kr
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total lagerverdi
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts for low stock */}
      {inventoryStats.lowStock > 0 && (
        <Alert
          severity="warning"
          icon={<Warning />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => setStatusFilter('low_stock')}>
              VIS ALLE
            </Button>
          }
        >
          <strong>{inventoryStats.lowStock}</strong> produkt{inventoryStats.lowStock !== 1 ? 'er' : ','} har lavt lagernivå og bør bestilles.
        </Alert>
      )}

      {inventoryStats.outOfStock > 0 && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => setStatusFilter('out_of_stock')}>
              VIS ALLE
            </Button>
          }
        >
          <strong>{inventoryStats.outOfStock}</strong> produkt{inventoryStats.outOfStock !== 1 ? 'er' : ','} er tomt på lager!
        </Alert>
      )}

      {/* Search and filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Enhanced Search */}
            <Box sx={{ flexGrow: 1, minWidth: 300 }}>
              <TextField
                id="inventory-search"
                label="Søk i produkter"
                placeholder={`Søk i ${searchFields.length} felt${searchFields.length !== 1 ? 'er' : ','}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                inputProps={{
                  'aria-label': `Søk i lagerbeholdning på tvers av ${searchFields.length} felt`,
                  'aria-describedby': 'search-help-text'
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search aria-hidden="true" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery('')}
                        edge="end"
                        sx={{ mr: -1 }}
                        aria-label="Nullstill søk"
                        title="Nullstill søk"
                      >
                        <Cancel fontSize="small" aria-hidden="true" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                fullWidth
              />
              <Typography 
                id="search-help-text" 
                variant="caption" 
                sx={{ 
                  position: 'absolute', 
                  left: '-10000px',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden'
                }}
              >
                Skriv søkeord for å filtrere lagerbeholdningen. Resultater oppdateres automatisk.
              </Typography>
              {/* Search field selector */}
              <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
                  Søk i:
                </Typography>
                {[
                  { id: 'productName', label: 'Produktnavn', icon: '📦' },
                  { id: 'sku', label: 'SKU', icon: '🏷️' },
                  { id: 'supplier', label: 'Leverandør', icon: '🏭' },
                  { id: 'location', label: 'Plassering', icon: '📍' },
                  { id: 'category', label: 'Kategori', icon: '📁' }
                ].map(field => (
                  <Chip
                    key={field.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{field.icon}</span>
                        {field.label}
                      </Box>
                    }
                    size="small"
                    variant={searchFields.includes(field.id) ? 'filled' : 'outlined'}
                    onClick={() => {
                      if (searchFields.includes(field.id)) {
                        // Don't allow removing if it's the last field
                        if (searchFields.length > 1) {
                          setSearchFields(searchFields.filter(f => f !== field.id));
                        }
                      } else {
                        setSearchFields([...searchFields, field.id]);
                      }
                    }}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: searchFields.includes(field.id) 
                        ? alpha(vendorConfig?.color || '#2196f3', 0.15)
                        : 'transparent',
                      borderColor: searchFields.includes(field.id)
                        ? vendorConfig?.color || '#2196f3'
                        : 'divider',
                      '&:hover': {
                        bgcolor: searchFields.includes(field.id)
                          ? alpha(vendorConfig?.color || '#2196f3', 0.25)
                          : alpha(vendorConfig?.color || '#2196f3', 0.08)
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Filter button */}
            <Button
              variant={filtersExpanded ? 'contained' : 'outlined'}
              startIcon={<FilterList />}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              sx={{ minWidth: 120, height: 56 }}
            >
              Filtrer
              {(categoryFilter !== 'all' || lastUpdatedFilter !== 'all' || statusFilter !== 'all') && (
                <Badge
                  badgeContent={
                    (categoryFilter !== 'all' ? 1 : 0) + 
                    (lastUpdatedFilter !== 'all' ? 1 : 0) +
                    (statusFilter !== 'all' ? 1 : 0)
                  }
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </Button>
          </Box>

          {/* Advanced Filters */}
          <Collapse in={filtersExpanded}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Kategori"
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Category />
                        Alle kategorier
                      </Box>
                    </MenuItem>
                    {vendorConfig?.productCategories?.map((category: { id: string; label: string; color: string }) => (
                      <MenuItem key={category.id} value={category.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: category.color || '#9e9e9e'
                            }}
                          />
                          {category.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Lagerstatus</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Lagerstatus"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Inventory />
                        Alle statusar
                      </Box>
                    </MenuItem>
                    <MenuItem value="in_stock">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle sx={{ color: '#4caf50', fontSize: 18 }} />
                        På lager
                      </Box>
                    </MenuItem>
                    <MenuItem value="low_stock">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Warning sx={{ color: '#ff9800', fontSize: 18 }} />
                        Lavt lager
                      </Box>
                    </MenuItem>
                    <MenuItem value="out_of_stock">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon sx={{ color: '#f44336', fontSize: 18 }} />
                        Tomt lager
                      </Box>
                    </MenuItem>
                    <MenuItem value="overstocked">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Info sx={{ color: '#2196f3', fontSize: 18 }} />
                        Overfylt
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sist oppdatert</InputLabel>
                  <Select
                    value={lastUpdatedFilter}
                    label="Sist oppdatert"
                    onChange={(e) => setLastUpdatedFilter(e.target.value)}
                  >
                    <MenuItem value="all">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime />
                        Alle tidspunkt
                      </Box>
                    </MenuItem>
                    <MenuItem value="today">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime sx={{ color: '#4caf50' }} />
                        I dag
                      </Box>
                    </MenuItem>
                    <MenuItem value="week">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime sx={{ color: '#2196f3' }} />
                        Siste 7 dager
                      </Box>
                    </MenuItem>
                    <MenuItem value="month">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime sx={{ color: '#ff9800' }} />
                        Siste 30 dager
                      </Box>
                    </MenuItem>
                    <MenuItem value="older">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTime sx={{ color: '#9e9e9e' }} />
                        Eldre enn 30 dager
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Active Filters Summary */}
            {(categoryFilter !== 'all' || statusFilter !== 'all' || lastUpdatedFilter !== 'all') && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  Aktive filtre:
                </Typography>
                {categoryFilter !== 'all' && (
                  <Chip
                    label={`Kategori: ${vendorConfig?.productCategories?.find((c: { id: string; label: string; color: string }) => c.id === categoryFilter)?.label || categoryFilter}`}
                    size="small"
                    onDelete={() => setCategoryFilter('all')}
                    sx={{ bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.1) }}
                  />
                )}
                {statusFilter !== 'all' && (
                  <Chip
                    label={`Status: ${getStatusLabel(statusFilter)}`}
                    size="small"
                    onDelete={() => setStatusFilter('all')}
                    sx={{ bgcolor: alpha(getStatusColor(statusFilter), 0.1) }}
                  />
                )}
                {lastUpdatedFilter !== 'all' && (
                  <Chip
                    label={`Oppdatert: ${
                      lastUpdatedFilter === 'today' ? 'I dag' :
                      lastUpdatedFilter === 'week' ? 'Siste uke' :
                      lastUpdatedFilter === 'month' ? 'Siste måned' :
                      'Eldre'
                    }`}
                    size="small"
                    onDelete={() => setLastUpdatedFilter('all')}
                    sx={{ bgcolor: alpha('#2196f3', 0.1) }}
                  />
                )}
                <Button
                  size="small"
                  onClick={() => {
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setLastUpdatedFilter('all');
                  }}
                  sx={{ ml: 'auto' }}
                >
                  Nullstill alle
                </Button>
              </Box>
            )}

            {/* Results count */}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Viser <strong>{filteredInventory.length}</strong> av <strong>{inventory.length}</strong> produkter
              </Typography>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Inventory table */}
      {filteredInventory.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Inventory sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? 'Ingen produkter funnet' : 'Ingen lagerbeholdning ennå'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {searchQuery
                ? 'Prøv et annet søk'
                : 'Legg til produkter for å begynne å spore lagerbeholdning'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.1) }}>
                <TableCell sx={{ fontWeight: 600, width: 80 }}>Foto</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Produkt</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Spor Lager</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Lager</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Minimum</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Frakt</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Trend</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {filteredInventory.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    style={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Tooltip title={item.imageUrl ? 'Klikk for å forhåndsvise bilde' : 'Ingen bilde tilgjengelig'}>
                        <Avatar
                          src={item.thumbnailUrl || item.imageUrl}
                          alt={`Produktbilde for ${item.productName}`}
                          variant="rounded"
                          role="button"
                          tabIndex={item.imageUrl ? 0 : -1}
                          aria-label={item.imageUrl ? `Åpne bilde av ${item.productName}` : `Ingen bilde for ${item.productName}`}
                          sx={{
                            width: 56,
                            height: 56,
                            cursor: item.imageUrl ? 'pointer' : 'default',
                            bgcolor: item.imageUrl ? 'transparent' : alpha(vendorConfig?.color || '#2196f3', 0.1),
                            border: `2px solid ${alpha(vendorConfig?.color || '#2196f3', 0.2)}`,
                            transition: 'all 0.2s',
                            // WCAG 2.2: Focus indicator
                            '&:focus-visible': {
                              outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                              outlineOffset: '2px'
                            },
                            '&:hover': item.imageUrl ? {
                              transform: 'scale(1.05)',
                              boxShadow: 3,
                              borderColor: vendorConfig?.color || '#2196f3'
                            } : {}
                          }}
                          onClick={() => {
                            if (item.imageUrl) {
                              window.open(item.imageUrl, '_blank');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (item.imageUrl && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              window.open(item.imageUrl, '_blank');
                            }
                          }}
                        >
                          {!item.imageUrl && <PhotoLibrary sx={{ color: 'text.secondary' }} aria-hidden="true" />}
                        </Avatar>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {highlightSearchTerm(item.productName, searchQuery)}
                        </Typography>
                        {item.location && (
                          <Typography variant="caption" color="text.secondary">
                            📍 {highlightSearchTerm(item.location, searchQuery)}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Klikk for å redigere SKU">
                        <Box
                          role="button"
                          tabIndex={0}
                          aria-label={`Rediger SKU: ${item.sku || 'Ingen SKU'}`}
                          onClick={() => handleOpenSkuDialog(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenSkuDialog(item);
                            }
                          }}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '16px',
                            border: '1px solid',
                            borderColor: 'divider',
                            fontFamily: 'monospace',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            // WCAG 2.2: Focus indicator
                            '&:focus-visible': {
                              outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                              outlineOffset: '2px',
                              bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.05)
                            },
                            '&:hover': { 
                              bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.1),
                              borderColor: vendorConfig?.color || '#2196f3'
                            }
                          }}
                        >
                          <QrCode sx={{ fontSize: 16 }} aria-hidden="true" />
                          <span>{highlightSearchTerm(item.sku || 'Ingen SKU', searchQuery)}</span>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={item.trackInventory !== false}
                        size="small"
                        onChange={(e) => {
                          updateTrackingMutation.mutate({
                            productId: item.productId,
                            trackInventory: e.target.checked
                          });
                        }}
                        inputProps={{
                          'aria-label': `Spor lager for ${item.productName}`,
                          'role': 'switch'
                        }}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: vendorConfig?.color || '#2196f3'
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            bgcolor: vendorConfig?.color || '#2196f3'
                          },
                          // WCAG 2.2: Focus indicator
                          '& .MuiSwitch-switchBase:focus-visible': {
                            outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                            outlineOffset: '2px'
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.currentStock} {item.unit}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(getStockPercentage(item), 100)}
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: alpha(getStatusColor(item.status), 0.2),
                            '& .MuiLinearProgress-bar': {
                              bgcolor: getStatusColor(item.status)
                            }
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(item.status)}
                        label={getStatusLabel(item.status)}
                        size="small"
                        sx={{
                          bgcolor: alpha(getStatusColor(item.status), 0.2),
                          color: getStatusColor(item.status),
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.minimumStock} {item.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.shippingEnabled ? (
                        <Tooltip title="Bring-frakt aktivert">
                          <Chip
                            icon={<LocalShipping sx={{ fontSize: 16 }} />}
                            label="Aktivert"
                            size="small"
                            color="success"
                            onClick={() => handleOpenShippingDialog(item)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Klikk for å aktivere Bring-frakt">
                          <Chip
                            icon={<LocalShipping sx={{ fontSize: 16 }} />}
                            label="Inaktiv"
                            size="small"
                            variant="outlined"
                            onClick={() => handleOpenShippingDialog(item)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.reorderPoint} {item.unit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.averageSalesPerWeek && (
                        <Tooltip title={`Gjennomsnitt: ${item.averageSalesPerWeek.toFixed(1)} ${item.unit}/uke`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {item.averageSalesPerWeek > 0 ? (
                              <>
                                <TrendingUp sx={{ fontSize: 18, color: '#4caf50' }} />
                                <Typography variant="caption" color="#4caf50">
                                  {item.averageSalesPerWeek.toFixed(1)}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <TrendingDown sx={{ fontSize: 18, color: '#f44336' }} />
                                <Typography variant="caption" color="text.secondary">
                                  Ingen
                                </Typography>
                              </>
                            )}
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }} role="group" aria-label={`Handlinger for ${item.productName}`}>
                        <Tooltip title="Juster lager">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenAdjustDialog(item)}
                            aria-label={`Juster lagerbeholdning for ${item.productName}`}
                            sx={{
                              // WCAG 2.2: Minimum touch target 48x48px
                              minWidth: 48,
                              minHeight: 48,
                              // WCAG 2.2: Focus indicator
                              '&:focus-visible': {
                                outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                                outlineOffset: '2px'
                              }
                            }}
                          >
                            <Edit aria-hidden="true" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Innstillinger">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenSettingsDialog(item)}
                            aria-label={`Innstillinger for ${item.productName}`}
                            sx={{
                              minWidth: 48,
                              minHeight: 48,
                              '&:focus-visible': {
                                outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                                outlineOffset: '2px'
                              }
                            }}
                          >
                            <Settings aria-hidden="true" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Vis historikk">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedItem(item);
                              setTimelineDialogOpen(true);
                            }}
                            aria-label={`Vis lagerhistorikk for ${item.productName}`}
                            sx={{ 
                              color: '#9c27b0',
                              minWidth: 48,
                              minHeight: 48,
                              '&:focus-visible': {
                                outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                                outlineOffset: '2px'
                              }
                            }}
                          >
                            <History aria-hidden="true" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Adjust stock dialog */}
      <Dialog open={adjustDialogOpen} onClose={() => setAdjustDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle>
              Juster lagerbeholdning - {selectedItem.productName}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Nåværende beholdning: <strong>{selectedItem.currentStock} {selectedItem.unit}</strong>
                </Alert>

                <TextField
                  fullWidth
                  label="Justering"
                  type="number"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(Number(e.target.value))}
                  helperText="Bruk positive tall for å øke, negative for å redusere"
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {stockAdjustment >= 0 ? <Add /> : <Remove />}
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  fullWidth
                  label="Årsak (valgfritt)"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  multiline
                  rows={3}
                  placeholder="F.eks: Ny leveranse, svinn, inventurtelling..."
                />

                {stockAdjustment !== 0 && (
                  <Alert
                    severity={selectedItem.currentStock + stockAdjustment < selectedItem.minimumStock ? 'warning' : 'success'}
                    sx={{ mt: 2 }}
                  >
                    Ny beholdning: <strong>{selectedItem.currentStock + stockAdjustment} {selectedItem.unit}</strong>
                  </Alert>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAdjustDialogOpen(false)}>Avbryt</Button>
              <Button
                variant="contained"
                onClick={handleAdjustStock}
                disabled={stockAdjustment === 0 || updateStockMutation.isPending}
              >
                Oppdater
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Reorder settings dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings />
                Lagerinnstillinger - {selectedItem.productName}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Minimumsbeholdning"
                  type="number"
                  value={reorderDraft.minimumStock}
                  onChange={(e) =>
                    setReorderDraft((prev) => ({ ...prev, minimumStock: Number(e.target.value) }))
                  }
                  helperText="Laveste akseptable lagernivå"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{selectedItem.unit}</InputAdornment>
                  }}
                />

                <TextField
                  fullWidth
                  label="Bestillingspunkt"
                  type="number"
                  value={reorderDraft.reorderPoint}
                  onChange={(e) =>
                    setReorderDraft((prev) => ({ ...prev, reorderPoint: Number(e.target.value) }))
                  }
                  helperText="Når lageret når dette nivået, bør du bestille mer"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{selectedItem.unit}</InputAdornment>
                  }}
                />

                <TextField
                  fullWidth
                  label="Bestillingsmengde"
                  type="number"
                  value={reorderDraft.reorderQuantity}
                  onChange={(e) =>
                    setReorderDraft((prev) => ({ ...prev, reorderQuantity: Number(e.target.value) }))
                  }
                  helperText="Hvor mye skal bestilles når bestillingspunktet nås"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{selectedItem.unit}</InputAdornment>
                  }}
                />

                <Divider />

                <Alert severity="info" icon={<Info />}>
                  <Typography variant="caption">
                    <strong>Tips:</strong> Bestillingspunktet bør være høyere enn minimumsbeholdningen for å unngå at du går tom.
                  </Typography>
                </Alert>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSettingsDialogOpen(false)}>Avbryt</Button>
              <Button
                variant="contained"
                onClick={handleSaveReorderSettings}
                disabled={updateReorderMutation.isPending}
              >
                {updateReorderMutation.isPending ? 'Lagrer...' : 'Lagre innstillinger'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* SKU Management Dialog */}
      <Dialog open={skuDialogOpen} onClose={() => setSkuDialogOpen(false)} maxWidth="sm" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode />
                Administrer SKU - {selectedItem.productName}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info" icon={<Info />}>
                  SKU (Stock Keeping Unit) er en unik identifikator for produktet ditt. Dette gjør lagerstyring og ordresporing mye enklere.
                </Alert>

                <TextField
                  fullWidth
                  label="SKU / Produkt-ID"
                  value={skuDraft}
                  onChange={(e) => setSkuDraft(e.target.value)}
                  placeholder="f.eks. PHOTO-001 eller PR-2024-001"
                  helperText="Bruk bokstaver, tall og bindestrek. Må være unik."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCode />
                      </InputAdornment>
                    )
                  }}
                  sx={{ fontFamily: 'monospace' }}
                />

                <Button
                  variant="outlined"
                  startIcon={<QrCode />}
                  sx={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    const base = selectedItem.productName
                      .toUpperCase()
                      .replace(/[^A-Z0-9]+/g, '-')
                      .slice(0, 12)
                      .replace(/-+$/g, '');
                    setSkuDraft(`${base}-${Date.now().toString().slice(-4)}`);
                  }}
                >
                  Generer automatisk SKU
                </Button>

                <Divider />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    SKU-formateringsforslag:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    • Kategori-År-Nummer: PRINT-2024-001
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    • Leverandør-Produkt: VENDOR-PRODUCT-001
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    • Kort beskrivelse: PHOTO-ALBUM-A4-001
                  </Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSkuDialogOpen(false)}>Avbryt</Button>
              <Button
                variant="contained"
                onClick={handleSaveSku}
                disabled={!skuDraft.trim() || updateSkuMutation.isPending}
              >
                {updateSkuMutation.isPending ? 'Lagrer...' : 'Lagre SKU'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* SKU Timeline/History Dialog */}
      <Dialog open={timelineDialogOpen} onClose={() => setTimelineDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Lagerhistorikk
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedItem.productName} • SKU: {selectedItem.sku}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={`Nåværende: ${selectedItem.currentStock} ${selectedItem.unit}`}
                  sx={{
                    bgcolor: alpha(getStatusColor(selectedItem.status), 0.2),
                    color: getStatusColor(selectedItem.status),
                    fontWeight: 600
                  }}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                {/* Timeline Statistics */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha('#4caf50', 0.1) }}>
                      <AddCircle sx={{ color: '#4caf50', fontSize: 32, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#4caf50' }}>
                        {timelineData?.totalAdded || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Totalt lagt til
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha('#f44336', 0.1) }}>
                      <RemoveCircle sx={{ color: '#f44336', fontSize: 32, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#f44336' }}>
                        {timelineData?.totalRemoved || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Totalt solgt/fjernet
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha('#2196f3', 0.1) }}>
                      <SwapHoriz sx={{ color: '#2196f3', fontSize: 32, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#2196f3' }}>
                        {timelineData?.totalAdjustments || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Justeringer
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha('#9c27b0', 0.1) }}>
                      <Assessment sx={{ color: '#9c27b0', fontSize: 32, mb: 1 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#9c27b0' }}>
                        {timelineData?.avgWeeklyMovement || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Avg. bevegelse/uke
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 3 }} />

                {/* Timeline Events */}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon />
                  Hendelser ({timelineData?.events?.length || 0})
                </Typography>

                {(!timelineData?.events || timelineData.events.length === 0) ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <History sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Ingen historikk ennå
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ position: 'relative', pl: 3 }}>
                    {/* Timeline line */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 20,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        bgcolor: theme.palette.divider
                      }}
                    />

                    {/* Timeline events */}
                    {(timelineData?.events || []).map((event: any, index: number) => {
                      const getEventIcon = (type: string) => {
                        switch (type) {
                          case 'sale':
                          case 'order':
                            return <ShoppingCart />;
                          case 'restock':
                          case 'added':
                            return <AddCircle />;
                          case 'removed':
                          case 'adjustment_down':
                            return <RemoveCircle />;
                          case 'adjustment_up':
                            return <AddCircle />;
                          case 'shipped':
                            return <ShippingIcon />;
                          case 'cancelled':
                            return <Cancel />;
                          case 'adjustment':
                            return <SwapHoriz />;
                          default:
                            return <History />;
                        }
                      };

                      const getEventColor = (type: string) => {
                        switch (type) {
                          case 'sale':
                          case 'order':
                          case 'shipped':
                            return '#4caf50';
                          case 'restock':
                          case 'added':
                          case 'adjustment_up':
                            return '#2196f3';
                          case 'removed':
                          case 'adjustment_down':
                            return '#f44336';
                          case 'cancelled':
                            return '#9e9e9e';
                          case 'adjustment':
                            return '#ff9800';
                          default:
                            return '#9e9e9e';
                        }
                      };

                      const eventColor = getEventColor(event.type);

                      return (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Box sx={{ position: 'relative', mb: 3 }}>
                            {/* Timeline dot */}
                            <Box
                              sx={{
                                position: 'absolute',
                                left: -26,
                                top: 4,
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                bgcolor: alpha(eventColor, 0.2),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `2px solid ${eventColor}`,
                                zIndex: 1
                              }}
                            >
                              <Box sx={{ color: eventColor, fontSize: 20, display: 'flex' }}>
                                {getEventIcon(event.type)}
                              </Box>
                            </Box>

                            {/* Event card */}
                            <Card
                              sx={{
                                ml: 3,
                                borderLeft: `3px solid ${eventColor}`,
                                '&:hover': { boxShadow: 4 }
                              }}
                            >
                              <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {event.title || event.type}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(event.timestamp).toLocaleString('no-NO', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                      })}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={
                                      event.quantityChange > 0
                                        ? `+${event.quantityChange}`
                                        : event.quantityChange
                                    }
                                    size="small"
                                    sx={{
                                      bgcolor: alpha(eventColor, 0.2),
                                      color: eventColor,
                                      fontWeight: 600,
                                      fontFamily: 'monospace'
                                    }}
                                  />
                                </Box>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {event.description}
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                                  {event.user && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="caption" color="text.secondary">
                                        {event.user}
                                      </Typography>
                                    </Box>
                                  )}
                                  {event.reason && (
                                    <Chip
                                      label={event.reason}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                  {event.orderId && (
                                    <Chip
                                      label={`Ordre #${event.orderId}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                    Beholdning: {event.stockAfter} {selectedItem.unit}
                                  </Typography>
                                </Box>
                              </CardContent>
                            </Card>
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Box>
                )}

                {/* Export options */}
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    size="small"
                  >
                    Eksporter historikk (CSV)
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Assessment />}
                    size="small"
                  >
                    Se rapport
                  </Button>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setTimelineDialogOpen(false)}>Lukk</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Bring Shipping Integration Dialog */}
      <Dialog open={shippingDialogOpen} onClose={() => setShippingDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedItem && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalShipping />
                Bring Fraktintegrasjon - {selectedItem.productName}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Tabs value={insightsTab} onChange={(e, v) => setInsightsTab(v)} sx={{ mb: 3 }}>
                  <Tab label="Produktinfo" icon={<Scale />} iconPosition="start" />
                  <Tab label="Fraktberegning" icon={<LocalShipping />} iconPosition="start" />
                  <Tab label="Innsikt" icon={<Lightbulb />} iconPosition="start" />
                </Tabs>

                {insightsTab === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info" icon={<Info />}>
                      Bring trenger produktets vekt og dimensjoner for å beregne nøyaktige fraktkostnader.
                    </Alert>

                    <TextField
                      fullWidth
                      label="Vekt (kg)"
                      type="number"
                      value={shippingDraft.weight}
                      onChange={(e) =>
                        setShippingDraft((prev) => ({ ...prev, weight: Number(e.target.value) }))
                      }
                      helperText="Produktets totalvekt inkl. emballasje"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Scale />
                          </InputAdornment>
                        ),
                        endAdornment: <InputAdornment position="end">kg</InputAdornment>
                      }}
                    />

                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                      Dimensjoner (cm)
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Lengde"
                          type="number"
                          value={shippingDraft.dimensions.length}
                          onChange={(e) =>
                            setShippingDraft((prev) => ({
                              ...prev,
                              dimensions: { ...prev.dimensions, length: Number(e.target.value) }
                            }))
                          }
                          InputProps={{
                            endAdornment: <InputAdornment position="end">cm</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Bredde"
                          type="number"
                          value={shippingDraft.dimensions.width}
                          onChange={(e) =>
                            setShippingDraft((prev) => ({
                              ...prev,
                              dimensions: { ...prev.dimensions, width: Number(e.target.value) }
                            }))
                          }
                          InputProps={{
                            endAdornment: <InputAdornment position="end">cm</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          fullWidth
                          label="Høyde"
                          type="number"
                          value={shippingDraft.dimensions.height}
                          onChange={(e) =>
                            setShippingDraft((prev) => ({
                              ...prev,
                              dimensions: { ...prev.dimensions, height: Number(e.target.value) }
                            }))
                          }
                          InputProps={{
                            endAdornment: <InputAdornment position="end">cm</InputAdornment>
                          }}
                        />
                      </Grid>
                    </Grid>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={shippingDraft.shippingEnabled}
                          onChange={(e) =>
                            setShippingDraft((prev) => ({ ...prev, shippingEnabled: e.target.checked }))
                          }
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: vendorConfig?.color || '#2196f3'
                            }
                          }}
                        />
                      }
                      label="Aktiver Bring-frakt for dette produktet"
                    />
                  </Box>
                )}

                {insightsTab === 1 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="success" icon={<LocalShipping />}>
                      Bring-integrasjonen lar deg automatisk beregne fraktkostnader for hver ordre basert på kundens postnummer.
                    </Alert>

                    <Card sx={{ bgcolor: 'action.hover' }}>
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                          Eksempel: Frakt fra Oslo (0150) til Bergen (5003)
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                              <Typography variant="caption" color="text.secondary">
                                Bring Pakke til bedrift
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                89 kr
                              </Typography>
                              <Typography variant="caption">1-2 virkedager</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                              <Typography variant="caption" color="text.secondary">
                                Bring Pakke til private
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                129 kr
                              </Typography>
                              <Typography variant="caption">2-4 virkedager</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>

                    <Typography variant="body2" color="text.secondary">
                      <strong>Automatisk:</strong> Når en kunde kjøper dette produktet, vil systemet automatisk hente fraktkostnader fra Bring basert på kundens postnummer og produktets vekt/dimensjoner.
                    </Typography>
                  </Box>
                )}

                {insightsTab === 2 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info" icon={<Lightbulb />}>
                      <Typography variant="body2">
                        <strong>Intelligent frakt:</strong> Bring-integrasjonen velger automatisk den beste fraktløsningen basert på destinasjon, vekt og leveringstid.
                      </Typography>
                    </Alert>

                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Fordeler med Bring-integrasjon:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      <li>
                        <Typography variant="body2">
                          ✅ Nøyaktige fraktkostnader i sanntid
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          ✅ Automatisk sporingsnummer for hver forsendelse
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          ✅ Kundevennlig sporing av pakker
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          ✅ Validering av postnummer
                        </Typography>
                      </li>
                      <li>
                        <Typography variant="body2">
                          ✅ Spare opptil 15% på fraktkostnader
                        </Typography>
                      </li>
                    </Box>

                    <Divider />

                    <Typography variant="body2" color="text.secondary">
                      <strong>Tips:</strong> Sett riktig vekt og dimensjoner for å unngå ekstra kostnader ved henting.
                    </Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShippingDialogOpen(false)}>Avbryt</Button>
              <Button
                variant="contained"
                startIcon={<LocalShipping />}
                onClick={handleSaveShipping}
                disabled={updateShippingMutation.isPending}
              >
                {updateShippingMutation.isPending ? 'Lagrer...' : 'Aktiver Bring-frakt'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}


