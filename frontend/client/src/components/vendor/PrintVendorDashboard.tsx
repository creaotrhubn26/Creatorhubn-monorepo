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
  ListItemAvatar,
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
  ListItemButton,
} from '@mui/material';
import {
  Add,
  AttachMoney,
  Visibility,
  MoreVert,
  AccessTime,
  Schedule,
  CheckCircle,
  Delete,
  PhotoLibrary,
  Edit,
  Print,
  LocalPrintshop,
  Inventory,
  ShoppingCart,
  Receipt,
  Analytics,
  TrendingUp,
  Build,
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vendor-tabpanel-${index}`}
      aria-labelledby={`vendor-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

interface Product {
  id: string;
  name: string;
  price: number;
  status: 'active' | 'inactive' | 'draft';
  category: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface Order {
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
  createdAt: string;
  updatedAt: string;
}

interface VendorStats {
  totalProducts: number;
  activeOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const PRODUCT_CATEGORIES = [
  'Albums',
  'Prints',
  'Books',
  'Cards',
  'Wall Art',
  'Framed Prints',
  'Canvas',
] as const;

const PRODUCT_STATUSES: Product['status'][] = ['active', 'inactive', 'draft'];

const ORDER_STATUSES: Order['status'][] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const SHIPPING_SLA_HOURS = 72;

export default function PrintVendorDashboard() {
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [proEditorMode, setProEditorMode] = useState(false);

  const emptyProduct = useMemo<Product>(
    () => ({
      id: '',
      name: '',
      price: 0,
      status: 'draft',
      category: PRODUCT_CATEGORIES[0],
      description: '',
      imageUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    []
  );

  const [productDraft, setProductDraft] = useState<Product>(emptyProduct);
  const [orderStatusDraft, setOrderStatusDraft] = useState<Order['status']>('pending');

  const vendorId = isDemoMode ? 'demo-user' : 'print-vendor';

  // Data fetching
  const { data: vendorStats, isLoading: statsLoading, error: statsError } = useQuery<VendorStats>({
    queryKey: ['/api/vendor/stats', vendorId],
    queryFn: async () => (await apiRequest(`/api/vendor/stats/${vendorId}`)) as VendorStats,
    retry: false,
  });

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<
    Product[]
  >({
    queryKey: ['/api/vendor/products', vendorId],
    queryFn: async () => (await apiRequest(`/api/vendor/products/${vendorId}`)) as Product[],
    retry: false,
  });

  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery<Order[]>(
    {
      queryKey: ['/api/vendor/orders', vendorId],
      queryFn: async () => (await apiRequest(`/api/vendor/orders/${vendorId}`)) as Order[],
      retry: false,
    }
  );

  // Mutations
  const updateProductMutation = useMutation<Product, Error, Product>({
    mutationFn: async (data) =>
      (await apiRequest('/api/vendor/products/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, vendorId }),
      })) as Product,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', vendorId] });
    },
  });

  const updateOrderMutation = useMutation<Order, Error, Partial<Order> & { id: string }>({
    mutationFn: async (data) =>
      (await apiRequest('/api/vendor/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, vendorId }),
      })) as Order,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orders', vendorId] });
    },
  });

  const isLoading = statsLoading || productsLoading || ordersLoading;
  const hasError = statsError || productsError || ordersError;

  // Mock data for demo mode
  const mockProducts = useMemo<Product[]>(
    () => [
      {
        id: 'demo-print-1',
        name: 'Premium Wedding Album',
        price: 299.9,
        status: 'active',
        category: 'Albums',
        description: 'High-quality wedding album with premium materials',
        imageUrl: '/images/products/wedding-album.jpg',
        createdAt: '2024-01-15T10:00:00',
        updatedAt: '2024-01-15T10:00:00',
      },
      {
        id: 'demo-print-2',
        name: 'Photo Canvas Print',
        price: 89.9,
        status: 'active',
        category: 'Prints',
        description: 'Gallery-quality canvas print',
        imageUrl: '/images/products/canvas-print.jpg',
        createdAt: '2024-01-10T14:30:00',
        updatedAt: '2024-01-10T14:30:00',
      },
      {
        id: 'demo-print-3',
        name: 'Custom Photo Book',
        price: 149.9,
        status: 'draft',
        category: 'Books',
        description: 'Personalized photo book with custom layout',
        imageUrl: '/images/products/photo-book.jpg',
        createdAt: '2024-01-05T09:15:00',
        updatedAt: '2024-01-05T09:15:00',
      },
    ],
    []
  );

  const mockOrders = useMemo<Order[]>(
    () => [
      {
        id: 'ORD-001',
        customerName: 'John Smith',
        customerEmail: 'john@example.com',
        total: 299.9,
        status: 'processing',
        items: [
          { productId: 'demo-print-1', productName: 'Premium Wedding Album', quantity: 1, price: 299.9 },
        ],
        createdAt: '2024-01-20T10:00:00',
        updatedAt: '2024-01-20T10:00:00',
      },
      {
        id: 'ORD-002',
        customerName: 'Sarah Johnson',
        customerEmail: 'sarah@example.com',
        total: 89.9,
        status: 'shipped',
        items: [
          { productId: 'demo-print-2', productName: 'Photo Canvas Print', quantity: 1, price: 89.9 },
        ],
        createdAt: '2024-01-18T14:30:00',
        updatedAt: '2024-01-19T16:45:00',
      },
    ],
    []
  );

  const displayProducts = useMemo(() => (isDemoMode ? mockProducts : products), [
    isDemoMode,
    mockProducts,
    products,
  ]);
  const displayOrders = useMemo(() => (isDemoMode ? mockOrders : orders), [
    isDemoMode,
    mockOrders,
    orders,
  ]);

  const stats = useMemo(() => {
    const totalProducts = vendorStats?.totalProducts ?? displayProducts.length;
    const activeOrders = vendorStats?.activeOrders ?? displayOrders.length;
    const totalRevenue = vendorStats?.totalRevenue ?? 0;
    const monthlyRevenue = vendorStats?.monthlyRevenue ?? 0;

    return {
      totalProducts,
      activeOrders,
      totalRevenue,
      monthlyRevenue,
    };
  }, [displayOrders.length, displayProducts.length, vendorStats]);

  const printKpis = useMemo(() => {
    const totalOrders = displayOrders.length;
    const ordersWithTimestamps = displayOrders.filter((order) => order.createdAt && order.updatedAt);
    const turnaroundHours = ordersWithTimestamps.map((order) => {
      const created = new Date(order.createdAt).getTime();
      const updated = new Date(order.updatedAt).getTime();
      return Math.max(0, (updated - created) / (1000 * 60 * 60));
    });
    const avgTurnaroundHours = turnaroundHours.length
      ? turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length
      : 0;

    const nonCancelled = displayOrders.filter((order) => order.status !== 'cancelled');
    const approvedProofs = nonCancelled.filter((order) => order.status !== 'pending').length;
    const proofApprovalRate = nonCancelled.length ? approvedProofs / nonCancelled.length : 0;

    const shippedOrders = displayOrders.filter((order) =>
      ['shipped', 'delivered'].includes(order.status)
    );
    const slaMet = shippedOrders.filter((order) => {
      const created = new Date(order.createdAt).getTime();
      const updated = new Date(order.updatedAt).getTime();
      const hours = Math.max(0, (updated - created) / (1000 * 60 * 60));
      return hours <= SHIPPING_SLA_HOURS;
    }).length;
    const shippingSlaRate = shippedOrders.length ? slaMet / shippedOrders.length : 0;

    const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const recentOrders = displayOrders.filter(
      (order) => new Date(order.createdAt).getTime() >= thirtyDaysAgo
    );
    const orderCounts = new Map<string, number>();
    recentOrders.forEach((order) => {
      const emailKey = order.customerEmail?.trim().toLowerCase() || 'unknown';
      orderCounts.set(emailKey, (orderCounts.get(emailKey) ?? 0) + 1);
    });
    const reprintOrders = Array.from(orderCounts.values()).reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0
    );
    const reprintRate = recentOrders.length ? reprintOrders / recentOrders.length : 0;

    return {
      totalOrders,
      avgTurnaroundHours,
      proofApprovalRate,
      reprintRate,
      shippingSlaRate,
      shippedOrders: shippedOrders.length,
      slaMet,
      recentOrders: recentOrders.length,
    };
  }, [displayOrders]);

  const pendingOrderCount = useMemo(
    () => displayOrders.filter((order) => ['pending', 'processing'].includes(order.status)).length,
    [displayOrders]
  );

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  }, []);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  }, []);

  const handleOrderClick = useCallback((order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  }, []);

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'active':
      case 'shipped':
      case 'delivered':
        return 'success';
      case 'processing':
        return 'warning';
      case 'pending':
        return 'info';
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
      case 'shipped':
        return <LocalPrintshop />;
      case 'delivered':
        return <CheckCircle fontSize="small" />;
      case 'pending':
        return <AccessTime fontSize="small" />;
      case 'cancelled':
        return <Delete fontSize="small" />;
      default:
        return <Schedule fontSize="small" />;
    }
  };

  const formatHours = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

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
    }
  }, [selectedOrder, showOrderModal]);

  useEffect(() => {
    if (isDemoMode) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/stats', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/products', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['/api/vendor/orders', vendorId] });
    }, 1000 * 60 * 5);

    return () => clearInterval(interval);
  }, [isDemoMode, queryClient, vendorId]);

  const handleProductSave = useCallback(async () => {
    const now = new Date().toISOString();
    const generatedId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `product-${Date.now()}`;
    const payload: Product = {
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
    });
    setShowOrderModal(false);
    setSelectedOrder(null);
  }, [orderStatusDraft, selectedOrder, updateOrderMutation]);

  if (hasError) {
    return (
      <Container maxWidth="xl" sx={{ py:  3 }}>
        <Alert severity="error" sx={{ mb:  3 }}>
          Failed to load vendor dashboard data. Please try again.
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
            <Print />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
              Print Vendor Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your print products, orders, and analytics
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={3} sx={{ mb:  3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <Inventory color="primary" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Products</Typography>
                </Box>
                <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={60} /> : stats.totalProducts}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Products
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                  <ShoppingCart color="success" sx={{ mr:  1 }} />
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
                  <TrendingUp color="info" sx={{ mr:  1 }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Turnaround</Typography>
                </Box>
                <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                  {isLoading ? <Skeleton width={60} /> : formatHours(printKpis.avgTurnaroundHours)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Turnaround
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
              icon={<Inventory />}
              label="Products"
              iconPosition="start"
            />
            <Tab
              icon={
                <Badge color="error" badgeContent={pendingOrderCount} invisible={pendingOrderCount === 0}>
                  <ShoppingCart />
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
        {/* Products Tab */}
        <Box sx={{ mb:  3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Products ({displayProducts.length})</Typography>
          <Button variant="contained"
            startIcon={<Add />}
            onClick={() => setShowProductModal(true)}
          >
            Add Product
          </Button>
        </Box>

        <Grid container spacing={3}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Grid item xs={12} sm={6} md={4} key={`product-skeleton-${index}`}>
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
                  No products found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Get started by adding your first product
                </Typography>
                <Button variant="contained"
                  startIcon={<Add />}
                  onClick={() => setShowProductModal(true)}
                >
                  Add Product
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
                        backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'}}
                    >
                      {!product.imageUrl && (
                        <PhotoLibrary sx={{ fontSize: 48, color: 'grey.400' }} />
                      )}
                    </Box>
                    <Chip
                      label={product.status}
                      color={getStatusColor(product.status)}
                      size="small"
                      sx={{ position: 'absolute', top:  8, right:  8 }}
                    />
                  </Box>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom noWrap sx={{ color: theming.colors.primary }}>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {product.category}
                    </Typography>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      ${product.price}
                    </Typography>
                  </CardContent>
                  <CardActions sx={theming.getThemedCardSx()}>
                    <Tooltip title="Edit product">
                      <Button size="small" startIcon={<Edit />}>
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip title="View product">
                      <Button size="small" startIcon={<Visibility />}>
                        View
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
                  secondary="Orders will appear here when customers make purchases"
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
            Analytics & Performance
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Analytics />}
            onClick={() => setShowAnalyticsModal(true)}
          >
            View KPI Details
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
                  Top Products
                </Typography>
                <List>
                  {displayProducts.slice(0, 3).map((product, index) => (
                    <ListItem key={`${product.id}-${index}`}>
                      <ListItemText
                        primary={product.name}
                        secondary={`$${product.price}`}
                      />
                      <Chip label={`#${index + 1}`} size="small" />
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Proof approvals: {formatPercent(printKpis.proofApprovalRate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Reprint rate (30d): {formatPercent(printKpis.reprintRate)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Settings Tab */}
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Vendor Settings
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
              label="Pro Editor Mode"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Enable advanced editing features and professional tools
            </Typography>
            <Collapse in={proEditorMode}>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <FormControlLabel control={<Switch defaultChecked />} label="Auto-generate print proofs" />
                <FormControlLabel control={<Switch />} label="Require client approval before production" />
                <FormControlLabel control={<Switch defaultChecked />} label="Enable color calibration workflow" />
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
        <DialogTitle>Print KPI Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Average turnaround time
              </Typography>
              <Typography variant="h6">
                {formatHours(printKpis.avgTurnaroundHours)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Based on {printKpis.totalOrders} orders
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Proof approval rate
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, printKpis.proofApprovalRate * 100)}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                {formatPercent(printKpis.proofApprovalRate)} approved
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Shipping SLA hit rate ({SHIPPING_SLA_HOURS}h)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, printKpis.shippingSlaRate * 100)}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                {formatPercent(printKpis.shippingSlaRate)} • {printKpis.slaMet}/{printKpis.shippedOrders} shipped
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Chip label={`Reprint rate (30d): ${formatPercent(printKpis.reprintRate)}`} color="info" />
              <Chip label={`Recent orders: ${printKpis.recentOrders}`} color="default" />
            </Stack>
          </Stack>
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
          {selectedProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product name"
              value={productDraft.name}
              onChange={(event) =>
                setProductDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Category"
                select
                value={productDraft.category}
                onChange={(event) =>
                  setProductDraft((prev) => ({ ...prev, category: event.target.value }))
                }
                fullWidth
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Status"
                select
                value={productDraft.status}
                onChange={(event) =>
                  setProductDraft((prev) => ({
                    ...prev,
                    status: event.target.value as Product['status'],
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
            </Stack>
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
              label="Image URL"
              value={productDraft.imageUrl ?? ''}
              onChange={(event) =>
                setProductDraft((prev) => ({ ...prev, imageUrl: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={productDraft.description ?? ''}
              onChange={(event) =>
                setProductDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              multiline
              minRows={3}
              fullWidth
            />
            {updateProductMutation.isError && (
              <Alert severity="error">Failed to save product. Please try again.</Alert>
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
            {selectedProduct ? 'Update' : 'Create'}
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
              <TextField
                label="Status"
                select
                value={orderStatusDraft}
                onChange={(event) =>
                  setOrderStatusDraft(event.target.value as Order['status'])
                }
                fullWidth
              >
                {ORDER_STATUSES.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
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
