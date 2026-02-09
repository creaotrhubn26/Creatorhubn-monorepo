import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
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
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle,
  OpenWith,
  Wall,
  Corner,
  Ceiling,
  AcousticPanel,
} from '@mui/icons-material';

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

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface VendorShowcaseUpdateResponse {
  status?: string;
  [key: string]: unknown;
}

interface VendorShowcaseUpdatePayload {
  vendorId: string;
  featuredProductId?: string;
  featuredOrderId?: string;
}

export default function NorthtoneVendorShowcase() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('vendor');
  const { isDemoMode } = useDemoMode();

  const vendorId = isDemoMode ? 'demo-user' : 'northtone';

  // State management
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AcousticPanel | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AcousticOrder | null>(null);

  // Data fetching
  const { data: vendorStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['/api/vendor/stats', vendorId],
    queryFn: () => apiRequest(`/api/vendor/stats/${vendorId}`),
    retry: false,
  });

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['/api/vendor/products', vendorId],
    queryFn: () => apiRequest(`/api/vendor/products/${vendorId}`),
    retry: false,
  });

  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['/api/vendor/orders', vendorId],
    queryFn: () => apiRequest(`/api/vendor/orders/${vendorId}`),
    retry: false,
  });

  const { data: pluginMetrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['/api/vendor/plugin-metrics', vendorId],
    queryFn: () => apiRequest(`/api/vendor/plugin-metrics/${vendorId}`),
    retry: false,
  });

  // Mutation for updating vendor data
  const updateNorthtoneVendorShowcase = useMutation<
    VendorShowcaseUpdateResponse,
    Error,
    VendorShowcaseUpdatePayload
  >({
    mutationFn: async (data) =>
      apiRequest('/api/vendor/update', {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor'] });
    },
  });

  const isLoading = statsLoading || productsLoading || ordersLoading || metricsLoading;
  const hasError = statsError || productsError || ordersError || metricsError;

  // Mock data for demo mode
  const mockAcousticPanels: AcousticPanel[] = [
    {
      id: '',
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
      thickness:  10,
      weight: 2.5,
      createdAt: '2024-01-15T10:00:00',
      updatedAt: '2024-01-15T10:00:00',
  },
    {
      id: '',
      name: 'Wall Mount Acoustic Panel',
      price: 199.9,
      status: 'active',
      category: 'wall_mounted',
      description: 'Veggmontert panel for permanent lydforbedring',
      imageUrl: '/images/products/wall-panel.jpg',
      dimensions: '120x60x5 cm',
      material: 'Acoustic fabric + foam',
      color: 'Navy Blue',
      nrc: 0.0,
      thickness:  5,
      weight: 3.2,
      createdAt: '2024-01-10T14:30:00',
      updatedAt: '2024-01-10T14:30:00',
  },
    {
      id: '',
      name: 'Corner Bass Trap',
      price: 149.9,
      status: 'draft',
      category: 'corner',
      description: 'Hjørnefelle for bassfrekvenser og ekko-reduksjon',
      imageUrl: '/images/products/corner-bass-trap.jpg',
      dimensions: '50x50x20 cm',
      material: 'Mineral wool',
      color: 'White',
      nrc: 0.5,
      thickness:  20,
      weight: 4.1,
      createdAt: '2024-01-05T09:15:00',
      updatedAt: '2024-01-05T09:15:00',
  },
  ];

  const mockAcousticOrders: AcousticOrder[] = [
    {
      id: 'ACO-00',
      customerName: 'Yoga Studio Oslo',
      customerEmail: 'studio@yogaoslo.no',
      total: 599.8,
      status: 'processing',
      installationType: 'professional',
      items: [
        { productId: '', productName: 'Portable Acoustic Panel Pro', quantity: 2, price: 299.9 }
      ],
      createdAt: '2024-01-20T10:00:00',
      updatedAt: '2024-01-20T10:00:00',
  },
    {
      id: 'ACO-00',
      customerName: 'Podcast Studio Bergen',
      customerEmail: 'info@podcastbergen.no',
      total: 199.9,
      status: 'delivered',
      installationType: 'self_install',
      items: [
        { productId: '', productName: 'Wall Mount Acoustic Panel', quantity: 1, price: 199.9 }
      ],
      createdAt: '2024-01-18T14:30:00',
      updatedAt: '2024-01-19T16:45:00',
  },
  ];

  const displayProducts = isDemoMode ? mockAcousticPanels : products;
  const displayOrders = isDemoMode ? mockAcousticOrders : orders;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portable':
        return <OpenWith />;
      case 'wall_mounted':
        return <Wall />;
      case 'corner':
        return <Corner />;
      case 'ceiling':
        return <Ceiling />;
      default:
        return <AcousticPanel />;
  }
};

  const getStatusColor = (status: string): ChipColor => {
    switch (status) {
      case 'active':
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

  if (hasError) {
    return (
      <Container maxWidth="xl" sx={{ py:  3 }}>
        <Alert severity="error" sx={{ mb:  3 }}>
          Failed to load Northtone vendor showcase data. Please try again.
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
            <AcousticPanel />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
              Northtone Vendor Showcase
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Showcase your acoustic panels and sound improvement solutions
            </Typography>
          </Box>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200}}>
          <CircularProgress />
          <Typography sx={{ ml:  2 }}>Loading showcase data...</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Vendor Stats */}
          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Vendor Performance
                </Typography>
                <Grid container spacing={2}>
                  <Grid item >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {vendorStats?.totalProducts || displayProducts.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Acoustic Panels
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        {vendorStats?.activeOrders || displayOrders.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Orders
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                        ${vendorStats?.totalRevenue || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Revenue
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item >
                    <Box sx={{ textAlign: 'center'}}>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {pluginMetrics?.topPlugins?.length || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Installations
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Products Showcase */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Featured Acoustic Panels
                </Typography>
                {displayProducts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No acoustic panels available for showcase
                  </Typography>
                ) : (
                  displayProducts.slice(0, 4).map((product: AcousticPanel, index: number) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowProductModal(true);
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getCategoryIcon(product.category)}
                        <Typography variant="subtitle1" gutterBottom>
                          {product.name}
                        </Typography>
                        <Chip 
                          label={product.status} 
                          color={getStatusColor(product.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        {product.description}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                          ${product.price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {product.dimensions} • NRC: {product.nrc}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Orders */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Recent Activity
                </Typography>
                {displayOrders.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No recent orders
                  </Typography>
                ) : (
                  displayOrders.slice(0, 4).map((order: AcousticOrder, index: number) => (
                    <Box
                      key={index}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowOrderModal(true);
                      }}
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        Order #{order.id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                        {order.customerName} • {order.customerEmail}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Chip 
                          label={order.status} 
                          color={getStatusColor(order.status)}
                          size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          ${order.total}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={showProductModal} onClose={() => setShowProductModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Produktdetaljer</DialogTitle>
        <DialogContent dividers>
          {selectedProduct ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="h6">{selectedProduct.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedProduct.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={selectedProduct.category.replace('_', ' ')} />
                <Chip label={selectedProduct.status} color={getStatusColor(selectedProduct.status)} />
                <Chip label={`NRC ${selectedProduct.nrc ?? '-'}`} />
              </Box>
              <Typography variant="body2">Dimensjoner: {selectedProduct.dimensions || 'Ikke oppgitt'}</Typography>
              <Typography variant="body2">Materiale: {selectedProduct.material || 'Ikke oppgitt'}</Typography>
              <Typography variant="body2">Pris: ${selectedProduct.price}</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen produkt valgt.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProductModal(false)}>Lukk</Button>
          {selectedProduct && (
            <Button
              variant="contained"
              onClick={() =>
                updateNorthtoneVendorShowcase.mutate({
                  vendorId,
                  featuredProductId: selectedProduct.id
                })
              }
            >
              Marker som utvalgt
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={showOrderModal} onClose={() => setShowOrderModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ordredetaljer</DialogTitle>
        <DialogContent dividers>
          {selectedOrder ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="h6">Order #{selectedOrder.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder.customerName} • {selectedOrder.customerEmail}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={selectedOrder.status} color={getStatusColor(selectedOrder.status)} />
                <Chip label={selectedOrder.installationType.replace('_', ' ')} />
              </Box>
              <Typography variant="body2">Total: ${selectedOrder.total}</Typography>
              <Typography variant="body2">Produkter: {selectedOrder.items.length}</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Ingen ordre valgt.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOrderModal(false)}>Lukk</Button>
          {selectedOrder && (
            <Button
              variant="contained"
              onClick={() =>
                updateNorthtoneVendorShowcase.mutate({
                  vendorId,
                  featuredOrderId: selectedOrder.id
                })
              }
            >
              Marker som viktig
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}