import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode } from '@/contexts/DemoModeContext';
import {
  Box,
  Container,
  Typography,
  Grid,
  Avatar,
  Button,
  Tabs as MuiTabs,
  Tab,
  Badge,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  ListItemButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery,
  Stack,
  LinearProgress,
  alpha,
  Fade,
  Collapse,
  Skeleton,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  AttachMoney,
  Add,
  AccessTime,
  Analytics,
  Build,
  CheckCircle,
  Delete,
  Edit,
  MoreVert,
  OpenWith,
  Pause,
  PlayArrow,
  Receipt,
  Schedule,
  Visibility,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number; 
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`northtone-vendor-tabpanel-${index}`}
      aria-labelledby={`northtone-vendor-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

interface AcousticPanel {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive' | 'draft';
  category: 'portable' | 'wall_mounted' | 'corner' | 'ceiling';
  description?: string;
  imageUrl?: string;
  dimensions?: string;
  material?: string;
  color?: string;
  nrc?: number; // Noise Reduction Coefficient
  thickness?: number;
  weight?: number;
  createdAt: string;
  updatedAt: string; 
}

interface AcousticOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  installationType: 'self_install' | 'professional' | 'consultation';
  createdAt: string;
  updatedAt: string; 
}

interface AcousticStats {
  totalProducts: number;
  activeOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalInstallations: number;
  topPanels: Array<{
    name: string;
    sales: number;
  }>;
  maxSales: number; 
}

interface PluginMetrics {
  totalInstalls: number;
  activeInstallations: number;
  avgRating: number;
  avgResponseTime: number; // seconds
  uptimePercent: number;
  topCountries: Array<{
    name: string;
    installs: number;
  }>;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const PRODUCT_CATEGORIES: AcousticPanel['category'][] = [
  'portable',
  'wall_mounted',
  'corner',
  'ceiling',
];

const PRODUCT_STATUSES: AcousticPanel['status'][] = ['active', 'inactive', 'draft'];

const ORDER_STATUSES: AcousticOrder['status'][] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const INSTALLATION_TYPES: AcousticOrder['installationType'][] = [
  'self_install',
  'professional',
  'consultation',
];

export default function NorthtoneVendorDashboard() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('vendor');
  const { isDemoMode } = useDemoMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management
  const [tabValue, setTabValue] = useState(0);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AcousticPanel | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AcousticOrder | null>(null);
  const [proEditorMode, setProEditorMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const emptyProduct = useMemo<AcousticPanel>(
    () => ({
      id: '',
      name: '',
      price: 0,
      status: 'draft',
      category: 'portable',
      description: '',
      imageUrl: '',
      dimensions: '',
      material: '',
      color: '',
      nrc: 0,
      thickness: 0,
      weight: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    []
  );

  const [productDraft, setProductDraft] = useState<AcousticPanel>(emptyProduct);
  const [orderStatusDraft, setOrderStatusDraft] = useState<AcousticOrder['status']>('pending');
  const [orderInstallationDraft, setOrderInstallationDraft] = useState<AcousticOrder['installationType']>('self_install');

  const vendorId = isDemoMode ? 'demo-user' : 'northtone';

  // Data fetching
  const { data: vendorStats, isLoading: statsLoading, error: statsError } = useQuery<AcousticStats>({
    queryKey: ['/api/vendor/stats', vendorId],
    queryFn: async () => (await apiRequest(`/api/vendor/stats/${vendorId}`)) as AcousticStats,
    retry: false,
  });

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<
    AcousticPanel[]
  >({
    queryKey: ['/api/vendor/products', vendorId],
    queryFn: async () => (await apiRequest(`/api/vendor/products/${vendorId}`)) as AcousticPanel[],
    retry: false,
  });

  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<
    AcousticOrder[]
  >({
    queryKey: ['/api/vendor/orders', vendorId],
    queryFn: async () => (await apiRequest(`/api/vendor/orders/${vendorId}`)) as AcousticOrder[],
    retry: false,
  });

  const { data: pluginMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<
    PluginMetrics
  >({
    queryKey: ['/api/vendor/plugin-metrics', vendorId],
    queryFn: async () =>
      (await apiRequest(`/api/vendor/plugin-metrics/${vendorId}`)) as PluginMetrics,
    retry: false,
  });

  // Mutations
  const updateProductMutation = useMutation<AcousticPanel, Error, AcousticPanel>({
    mutationFn: async (data) =>
      (await apiRequest('/api/vendor/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, vendorId }),
      })) as AcousticPanel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', vendorId] });
    },
  });

  const updateOrderMutation = useMutation<AcousticOrder, Error, Partial<AcousticOrder> & { id: string }>({
    mutationFn: async (data) =>
      (await apiRequest('/api/vendor/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, vendorId }),
      })) as AcousticOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orders', vendorId] });
    },
  });

  const isLoading = statsLoading || productsLoading || ordersLoading || metricsLoading;
  const hasError = statsError || productsError || ordersError || metricsError;

  // Mock data for demo mode
  const mockAcousticPanels = useMemo<AcousticPanel[]>(
    () => [
      {
        id: 'demo-panel-1',
        name: 'Portable Acoustic Panel Pro',
        price: 299.9,
        status: 'active',
        category: 'portable',
        description: 'Bærbart akustikkpanel for optimal lydkvalitet i alle miljøer',
        imageUrl: '/images/products/portable-panel-pro.jpg',
        dimensions: '60x40x10 cm',
        material: 'High-density foam',
        color: 'Charcoal',
        nrc: 0.5,
        thickness: 10,
        weight: 2.5,
        createdAt: '2024-01-15T10:00:00',
        updatedAt: '2024-01-15T10:00:00',
      },
      {
        id: 'demo-panel-2',
        name: 'Wall Mount Acoustic Panel',
        price: 199.9,
        status: 'active',
        category: 'wall_mounted',
        description: 'Veggmontert panel for permanent lydforbedring',
        imageUrl: '/images/products/wall-panel.jpg',
        dimensions: '120x60x5 cm',
        material: 'Acoustic fabric + foam',
        color: 'Navy Blue',
        nrc: 0.4,
        thickness: 5,
        weight: 3.2,
        createdAt: '2024-01-10T14:30:00',
        updatedAt: '2024-01-10T14:30:00',
      },
      {
        id: 'demo-panel-3',
        name: 'Corner Bass Trap',
        price: 149.9,
        status: 'draft',
        category: 'corner',
        description: 'Hjørnefelle for bassfrekvenser og ekko-reduksjon',
        imageUrl: '/images/products/corner-bass-trap.jpg',
        dimensions: '50x50x20 cm',
        material: 'Mineral wool',
        color: 'White',
        nrc: 0.6,
        thickness: 20,
        weight: 4.1,
        createdAt: '2024-01-05T09:15:00',
        updatedAt: '2024-01-05T09:15:00',
      },
    ],
    []
  );

  const mockAcousticOrders = useMemo<AcousticOrder[]>(
    () => [
      {
        id: 'ACO-001',
        customerName: 'Yoga Studio Oslo',
        customerEmail: 'studio@yogaoslo.no',
        total: 599.8,
        status: 'processing',
        installationType: 'professional',
        items: [
          { productId: 'demo-panel-1', productName: 'Portable Acoustic Panel Pro', quantity: 2, price: 299.9 },
        ],
        createdAt: '2024-01-20T10:00:00',
        updatedAt: '2024-01-20T10:00:00',
      },
      {
        id: 'ACO-002',
        customerName: 'Podcast Studio Bergen',
        customerEmail: 'info@podcastbergen.no',
        total: 199.9,
        status: 'delivered',
        installationType: 'self_install',
        items: [
          { productId: 'demo-panel-2', productName: 'Wall Mount Acoustic Panel', quantity: 1, price: 199.9 },
        ],
        createdAt: '2024-01-18T14:30:00',
        updatedAt: '2024-01-19T16:45:00',
      },
    ],
    []
  );

  const displayProducts = useMemo<AcousticPanel[]>(
    () => (isDemoMode ? mockAcousticPanels : products),
    [isDemoMode, mockAcousticPanels, products]
  );

  const displayOrders = useMemo<AcousticOrder[]>(
    () => (isDemoMode ? mockAcousticOrders : orders),
    [isDemoMode, mockAcousticOrders, orders]
  );

  const stats = useMemo(() => {
    const totalProducts = vendorStats?.totalProducts ?? displayProducts.length;
    const activeOrders = vendorStats?.activeOrders ?? displayOrders.length;
    const totalRevenue = vendorStats?.totalRevenue ?? 0;
    const monthlyRevenue = vendorStats?.monthlyRevenue ?? 0;
    const totalInstallations = vendorStats?.totalInstallations ?? pluginMetrics?.activeInstallations ?? 0;

    const topPanels = vendorStats?.topPanels ??
      displayProducts
        .slice(0, 3)
        .map((product) => ({ name: product.name, sales: Math.max(1, Math.round(product.price)) }));

    return {
      totalProducts,
      activeOrders,
      totalRevenue,
      monthlyRevenue,
      totalInstallations,
      topPanels,
    };
  }, [displayOrders.length, displayProducts, pluginMetrics?.activeInstallations, vendorStats]);

  const pendingOrderCount = useMemo(
    () => displayOrders.filter((order) => ['pending', 'processing'].includes(order.status)).length,
    [displayOrders]
  );

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

  const handleProductClick = useCallback((product: AcousticPanel) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  }, []);

  const handleOrderClick = useCallback((order: AcousticOrder) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  }, []);

  const handlePlayPause = useCallback((productId: string) => {
    setIsPlaying((prev) => (prev === productId ? null : productId));
  }, []);

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'active':
      case 'completed':
      case 'delivered':
        return 'success';
      case 'shipped':
        return 'info';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'info';
      case 'draft':
        return 'default';
      case 'inactive':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
  }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle fontSize="small" />;
      case 'processing':
        return <Schedule fontSize="small" />;
      case 'completed':
      case 'delivered':
        return <CheckCircle fontSize="small" />;
      case 'shipped':
        return <Schedule fontSize="small" />;
      case 'pending':
        return <AccessTime fontSize="small" />;
      case 'cancelled':
        return <Delete fontSize="small" />;
      default:
        return <Schedule fontSize="small" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portable':
        return <OpenWith />;
      case 'wall_mounted':
        return <Build />;
      case 'corner':
        return <OpenWith />;
      case 'ceiling':
        return <Build />;
      default:
        return <OpenWith />;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSafeIcon = useCallback(
    (iconName: string, fallback: React.ReactElement) => {
      const icon = theming.getThemedIcon(iconName);
      return React.isValidElement(icon) ? icon : fallback;
    },
    [theming]
  );

  useEffect(() => {
    if (!showProductModal) return;
    if (selectedProduct) {
      setProductDraft({ ...selectedProduct });
      return;
    }
    setProductDraft({ ...emptyProduct, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }, [emptyProduct, selectedProduct, showProductModal]);

  useEffect(() => {
    if (!showOrderModal) return;
    if (selectedOrder) {
      setOrderStatusDraft(selectedOrder.status);
      setOrderInstallationDraft(selectedOrder.installationType);
    }
  }, [selectedOrder, showOrderModal]);

  useEffect(() => {
    if (isDemoMode) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/stats', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orders', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/plugin-metrics', vendorId] });
    }, 1000 * 60 * 5);

    return () => clearInterval(interval);
  }, [isDemoMode, queryClient, vendorId]);

  const handleProductSave = useCallback(async () => {
    const now = new Date().toISOString();
    const generatedId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `panel-${Date.now()}`;
    const payload: AcousticPanel = {
      ...productDraft,
      id: selectedProduct?.id || productDraft.id || generatedId,
      createdAt: selectedProduct?.createdAt || productDraft.createdAt || now,
      updatedAt: now,
    };

    await updateProductMutation.mutateAsync(payload);
    setShowProductModal(false);
    setSelectedProduct(null);
  }, [productDraft, selectedProduct, updateProductMutation]);

  const handleOrderUpdate = useCallback(async () => {
    if (!selectedOrder) return;
    await updateOrderMutation.mutateAsync({
      id: selectedOrder.id,
      status: orderStatusDraft,
      installationType: orderInstallationDraft,
    });
    setShowOrderModal(false);
    setSelectedOrder(null);
  }, [orderInstallationDraft, orderStatusDraft, selectedOrder, updateOrderMutation]);

  if (hasError) {
    return (
      <Container maxWidth="xl" sx={{ py:  3 }}>
        <Alert severity="error" sx={{ mb:  3 }}>
          Failed to load Northtone vendor dashboard data. Please try again.
        </Alert>
      </Container>
    );
}

  return (
    <Container maxWidth="xl" sx={{ py:  3 }}>
      {/* Header */}
      <Box sx={{ mb:  4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr:  2 }}>
            <OpenWith />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
              Northtone Vendor Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your acoustic panels, orders, and sound improvement analytics
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <OpenWith color="primary" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Panels</Typography>
                </Box>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={60} /> : stats.totalProducts}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Acoustic Panels
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Receipt color="success" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Orders</Typography>
                </Box>
                <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={60} /> : stats.activeOrders}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Orders
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <AttachMoney color="warning" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Revenue</Typography>
                </Box>
                <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={80} /> : `$${stats.totalRevenue}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Revenue
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Build color="info" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Installations</Typography>
                </Box>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={60} /> : stats.totalInstallations}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Installations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Fade in={isLoading} unmountOnExit>
          <LinearProgress sx={{ mb: 2 }} />
        </Fade>

        {/* Tabs */}
        <Paper sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <MuiTabs
            value={tabValue}
            onChange={handleTabChange}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider'}}
          >
            <Tab
              icon={<OpenWith />}
              label="Panel Library"
              iconPosition="start"
            />
            <Tab
              icon={
                <Badge color="error" badgeContent={pendingOrderCount} invisible={pendingOrderCount === 0}>
                  <Receipt />
                </Badge>
              }
              label="Orders"
              iconPosition="start"
            />
            <Tab
              icon={getSafeIcon('analytics', <Analytics fontSize="small" />)}
              label="Analytics"
              iconPosition="start"
            />
            <Tab
              icon={getSafeIcon('settings', <Build fontSize="small" />)}
              label="Settings"
              iconPosition="start"
            />
          </MuiTabs>
        </Paper>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {/* Panel Library Tab */}
        <Box sx={{ mb:  3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Panel Library ({displayProducts.length})</Typography>
          <Button variant="contained"
            startIcon={<Add />}
            onClick={() => setShowProductModal(true)}
          >
            Add Panel
          </Button>
        </Box>

        <Grid container spacing={3}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Grid item xs={12} sm={6} md={4} key={`panel-skeleton-${index}`}>
                <Card sx={theming.getThemedCardSx()}>
                  <Skeleton variant="rectangular" height={200} />
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Skeleton variant="text" height={32} />
                    <Skeleton variant="text" height={24} />
                    <Skeleton variant="text" height={20} />
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : displayProducts.length === 0 ? (
            <Grid item xs={12}>
              <Card sx={{ textAlign: 'center', py:  4 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                  No acoustic panels found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Get started by adding your first acoustic panel
                </Typography>
                <Button variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowProductModal(true)}
                >
                  Add Panel
                </Button>
              </Card>
            </Grid>
          ) : (
            displayProducts.map((product, index) => (
              <Grid item xs={12} sm={6} md={4} key={`${product.id}-${index}`}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: theme.shadows[4],
                    },
                  }}
                  onClick={() => handleProductClick(product)}
                >
                  <Box sx={{ position: 'relative'}}>
                    <Box
                      sx={{
                        height: 200,
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: product.imageUrl
                          ? `url(${product.imageUrl})`
                          : `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.secondary.main}20)`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'}}
                    >
                      {!product.imageUrl && (
                        <Box sx={{ textAlign: 'center'}}>
                          {getCategoryIcon(product.category)}
                          <Typography variant="h4" sx={{  mt:  1  }}>
                            {product.category === 'portable' ? '📦' : product.category === 'wall_mounted' ? '🧱' : product.category === 'corner' ? '📐' : '🏠'}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Chip
                      label={product.status}
                      color={getStatusColor(product.status)}
                      size="small"
                      sx={{ position: 'absolute', top:  8, right:  8 }}
                    />
                    <IconButton
                      sx={{
                        position: 'absolute',
                        bottom:  8,
                        right:  8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.8)',
                        },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(product.id);
                      }}
                    >
                      {isPlaying === product.id ? <Pause /> : <PlayArrow />}
                    </IconButton>
                  </Box>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom noWrap sx={{ color: theming.colors.primary }}>
                      {product.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {getCategoryIcon(product.category)}
                      <Typography variant="body2" color="text.secondary">
                        {product.category.replace('_', ' ').toUpperCase()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                        ${product.price}
                      </Typography>
                      {product.dimensions && (
                        <Typography variant="body2" color="text.secondary">
                          {product.dimensions}
                        </Typography>
                      )}
                    </Box>
                    {product.nrc !== undefined && product.nrc !== null && (
                      <Typography variant="body2" color="text.secondary">
                        NRC: {product.nrc} • {product.material}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={theming.getThemedCardSx()}>
                    <Tooltip title="Edit panel">
                      <Button size="small" startIcon={<Edit />}>
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip title="Preview panel listing">
                      <Button size="small" startIcon={<Visibility />}>
                        Preview
                      </Button>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Orders Tab */}
        <Box sx={{ mb:  3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Recent Orders ({displayOrders.length})</Typography>
          <Button
            variant="outlined"
            startIcon={<Receipt />}
            onClick={() => setShowOrderModal(true)}
          >
            View All Orders
          </Button>
        </Box>

        <Card sx={theming.getThemedCardSx()}>
          <List>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <ListItem key={`order-skeleton-${index}`}>
                  <ListItemAvatar>
                    <Skeleton variant="circular" width={40} height={40} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Skeleton variant="text" width="60%" />}
                    secondary={<Skeleton variant="text" width="40%" />}
                  />
                </ListItem>
              ))
            ) : displayOrders.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No orders found"
                  secondary="Orders will appear here when customers purchase acoustic panels"
                />
              </ListItem>
            ) : (
              displayOrders.map((order, index) => (
                <React.Fragment key={`${order.id}-${index}`}>
                  <ListItem
                    sx={{ cursor: 'pointer'}}
                    onClick={() => handleOrderClick(order)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main'}}>
                        <Receipt />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Typography variant="subtitle1">
                            {order.customerName}
                          </Typography>
                          <Chip
                            label={order.status}
                            color={getStatusColor(order.status)}
                            size="small"
                            icon={getStatusIcon(order.status)}
                          />
                          <Chip
                            label={order.installationType}
                            color="info"
                            size="small"
                          />
                        </Box>
                    }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {order.customerEmail}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total: ${order.total} • {new Date(order.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                    }
                    />
                    <IconButton>
                      <MoreVert />
                    </IconButton>
                  </ListItem>
                  {index < displayOrders.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Analytics Tab */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Acoustic Panel Analytics & Performance
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Analytics />}
            onClick={() => setShowAnalyticsModal(true)}
          >
            View Plugin Health
          </Button>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Sales Performance
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Monthly revenue target
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={stats.monthlyRevenue > 0 ? Math.min(100, (stats.monthlyRevenue / Math.max(stats.totalRevenue, 1)) * 100) : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ${stats.monthlyRevenue} this month
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Active orders vs total
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={stats.totalProducts > 0 ? Math.min(100, (stats.activeOrders / Math.max(stats.totalProducts, 1)) * 100) : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {stats.activeOrders} active orders
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Top Panels
                </Typography>
                <List>
                  {stats.topPanels.slice(0, 3).map((panel, index) => (
                    <ListItem key={`${panel.name}-${index}`}>
                      <ListItemIcon>
                        {getCategoryIcon(displayProducts[index]?.category ?? 'portable')}
                      </ListItemIcon>
                      <ListItemText
                        primary={panel.name}
                        secondary={`${panel.sales} sales`}
                      />
                      <Chip label={`#${index + 1}`} size="small" />
                    </ListItem>
                  ))}
                </List>
                {pluginMetrics && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Avg response time: {formatDuration(Math.round(pluginMetrics.avgResponseTime))}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Settings Tab */}
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Acoustic Panel Vendor Settings
        </Typography>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <FormControlLabel
              control={
                <Switch
                  checked={proEditorMode}
                  onChange={(e) => setProEditorMode(e.target.checked)}
                />
              }
              label="Pro Installation Mode"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Enable advanced installation features and professional acoustic consulting tools
            </Typography>
            <Collapse in={proEditorMode}>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel control={<Switch defaultChecked />} label="Auto-generate installation briefs" />
                <FormControlLabel control={<Switch />} label="Require measurement upload before approval" />
                <FormControlLabel control={<Switch defaultChecked />} label="Enable acoustic simulation preview" />
              </Stack>
            </Collapse>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom:  16,
          right:  16}}
        onClick={() => setShowProductModal(true)}
      >
        <Add />
      </Fab>

      {/* Analytics Modal */}
      <Dialog
        open={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Plugin Health & Usage</DialogTitle>
        <DialogContent>
          {pluginMetrics ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Active installations
                </Typography>
                <Typography variant="h6">
                  {pluginMetrics.activeInstallations} / {pluginMetrics.totalInstalls}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={
                    pluginMetrics.totalInstalls > 0
                      ? Math.min(100, (pluginMetrics.activeInstallations / pluginMetrics.totalInstalls) * 100)
                      : 0
                  }
                />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Uptime
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pluginMetrics.uptimePercent}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {pluginMetrics.uptimePercent}% uptime
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Chip label={`Avg rating: ${pluginMetrics.avgRating}`} color="success" />
                <Chip label={`Avg response: ${formatDuration(Math.round(pluginMetrics.avgResponseTime))}`} color="info" />
              </Stack>
              <Divider />
              <Typography variant="subtitle2">Top countries</Typography>
              <List>
                {pluginMetrics.topCountries.map((country) => (
                  <ListItem key={country.name}>
                    <ListItemText primary={country.name} />
                    <Chip label={country.installs} size="small" />
                  </ListItem>
                ))}
              </List>
            </Stack>
          ) : (
            <Alert severity="info">No plugin metrics available yet.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalyticsModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Product Modal */}
      <Dialog
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedProduct ? 'Edit Acoustic Panel' : 'Add New Panel'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Panel Name"
              value={productDraft.name}
              onChange={(event) =>
                setProductDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Price"
                type="number"
                value={productDraft.price}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    price: Number(event.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Status"
                select
                value={productDraft.status}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    status: event.target.value as AcousticPanel['status'],
                  }))
                }
                fullWidth
              >
                {PRODUCT_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Category"
                select
                value={productDraft.category}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    category: event.target.value as AcousticPanel['category'],
                  }))
                }
                fullWidth
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category.replace('_', ' ')}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Description"
              value={productDraft.description ?? ''}
              onChange={(event) =>
                setProductDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              rows={3}
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Dimensions"
                value={productDraft.dimensions ?? ''}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    dimensions: event.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Material"
                value={productDraft.material ?? ''}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    material: event.target.value,
                  }))
                }
                fullWidth
              />
              <TextField
                label="Color"
                value={productDraft.color ?? ''}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    color: event.target.value,
                  }))
                }
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="NRC"
                type="number"
                value={productDraft.nrc ?? 0}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    nrc: Number(event.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Thickness (cm)"
                type="number"
                value={productDraft.thickness ?? 0}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    thickness: Number(event.target.value),
                  }))
                }
                fullWidth
              />
              <TextField
                label="Weight (kg)"
                type="number"
                value={productDraft.weight ?? 0}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    weight: Number(event.target.value),
                  }))
                }
                fullWidth
              />
            </Stack>
            <TextField
              label="Image URL"
              value={productDraft.imageUrl ?? ''}
              onChange={(event) =>
                setProductDraft((prev) => ({
                  ...prev,
                  imageUrl: event.target.value,
                }))
              }
              fullWidth
            />
            {updateProductMutation.isError && (
              <Alert severity="error">Failed to save panel. Please try again.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowProductModal(false);
              setSelectedProduct(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleProductSave}
            disabled={updateProductMutation.isPending || !productDraft.name.trim()}
            startIcon={
              updateProductMutation.isPending ? (
                <CircularProgress size={16} />
              ) : (
                <CheckCircle fontSize="small" />
              )
            }
          >
            {selectedProduct ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Order Modal */}
      <Dialog
        open={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedOrder ? `Order ${selectedOrder.id}` :'All Orders'}
        </DialogTitle>
        <DialogContent>
          {selectedOrder ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedOrder.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedOrder.customerEmail}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Status"
                  select
                  value={orderStatusDraft}
                  onChange={(event) =>
                    setOrderStatusDraft(event.target.value as AcousticOrder['status'])
                  }
                  fullWidth
                >
                  {ORDER_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Installation Type"
                  select
                  value={orderInstallationDraft}
                  onChange={(event) =>
                    setOrderInstallationDraft(event.target.value as AcousticOrder['installationType'])
                  }
                  fullWidth
                >
                  {INSTALLATION_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Divider />
              <Typography variant="subtitle2">Items</Typography>
              <List>
                {selectedOrder.items.map((item) => (
                  <ListItem key={`${selectedOrder.id}-${item.productId}`}>
                    <ListItemText
                      primary={`${item.productName} x${item.quantity}`}
                      secondary={`$${item.price} each`}
                    />
                    <Typography variant="body2">${item.price * item.quantity}</Typography>
                  </ListItem>
                ))}
              </List>
              <Divider />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                Total: ${selectedOrder.total}
              </Typography>
              {updateOrderMutation.isError && (
                <Alert severity="error">Failed to update order. Please try again.</Alert>
              )}
            </Stack>
          ) : (
            <List>
              {displayOrders.map((order) => (
                <ListItem key={order.id} disablePadding>
                  <ListItemButton onClick={() => handleOrderClick(order)}>
                  <ListItemText
                    primary={`${order.customerName} — $${order.total}`}
                    secondary={`${order.status} • ${new Date(order.createdAt).toLocaleDateString()}`}
                  />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowOrderModal(false);
              setSelectedOrder(null);
            }}
          >
            Close
          </Button>
          {selectedOrder && (
            <Button
              variant="contained"
              onClick={handleOrderUpdate}
              disabled={updateOrderMutation.isPending}
              startIcon={
                updateOrderMutation.isPending ? (
                  <CircularProgress size={16} />
                ) : (
                  <CheckCircle fontSize="small" />
                )
              }
            >
              Update Order
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
