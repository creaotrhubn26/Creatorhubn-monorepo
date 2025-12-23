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
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
  Avatar,
  Badge,
  LinearProgress,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  CheckCircle,
  Schedule,
  LocalShipping,
  Cancel,
  Refresh,
  Visibility,
  Edit,
  Print,
  DownloadForOffline,
  Email,
  Phone,
  AttachMoney,
  LocationOn,
  ShoppingCart,
  AccessTime,
  Error as ErrorIcon,
  TrendingUp
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorOrdersManagerProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  onOrderClick?: (orderId: string) => void;
}

interface VendorOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  shippingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  fulfillmentMethod?: 'physical_shipping' | 'digital_delivery' | 'pickup';
}

export default function VendorOrdersManager({
  vendorType,
  vendorName,
  userId,
  onOrderClick
}: VendorOrdersManagerProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['/api/vendor-orders', vendorType, vendorName, userId, statusFilter],
    queryFn: () =>
      apiRequest(`/api/vendor-orders/${vendorType}/${vendorName}/${userId}?status=${statusFilter}`),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiRequest('/api/vendor-orders/update-status', {
        method: 'POST',
        body: { orderId, status, vendorName, vendorType }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-orders'] });
      handleCloseMenu();
    }
  });

  // Add tracking number mutation
  const addTrackingMutation = useMutation({
    mutationFn: ({ orderId, trackingNumber }: { orderId: string; trackingNumber: string }) =>
      apiRequest('/api/vendor-orders/add-tracking', {
        method: 'POST',
        body: { orderId, trackingNumber, vendorName, vendorType }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-orders'] });
    }
  });

  const orders: VendorOrder[] = ordersData?.orders || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'processing':
        return '#2196f3';
      case 'shipped':
        return '#9c27b0';
      case 'delivered':
        return '#4caf50';
      case 'cancelled':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Schedule />;
      case 'processing':
        return <AccessTime />;
      case 'shipped':
        return <LocalShipping />;
      case 'delivered':
        return <CheckCircle />;
      case 'cancelled':
        return <Cancel />;
      default:
        return <ShoppingCart />;
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return '#4caf50';
      case 'pending':
        return '#ff9800';
      case 'refunded':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, orderId: string) => {
    setAnchorEl(event.currentTarget);
    setActiveOrderId(orderId);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveOrderId(null);
  };

  const handleViewOrder = (order: VendorOrder) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
    handleCloseMenu();
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (activeOrderId) {
      updateOrderStatusMutation.mutate({ orderId: activeOrderId, status: newStatus });
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster ordre...</Typography>
      </Box>
    );
  }

  return (
    <Box component="section" role="main" aria-label="Ordrehåndtering">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShoppingCart sx={{ color: vendorConfig?.color || '#2196f3' }} aria-hidden="true" />
          Ordrehåndtering
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh aria-hidden="true" />}
            onClick={() => refetch()}
            aria-label="Oppdater ordreliste"
            sx={{
              minHeight: 48, // iPad touch target
              '&:focus-visible': {
                outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                outlineOffset: '2px'
              }
            }}
          >
            Oppdater
          </Button>
        </Box>
      </Box>
      
      {/* Screen reader status for orders */}
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
        {!isLoading && `${filteredOrders.length} ordre${filteredOrders.length !== 1 ? 'r' : ','} funnet.`}
      </div>

      {/* Quick stats */}
      <Grid container spacing={2} sx={{ mb: 3 }} role="group" aria-label="Ordrestatistikk filtre">
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            component="button"
            role="button"
            tabIndex={0}
            aria-label={`Vis alle ordre. Total: ${orderStats.total} ordre${statusFilter === 'all' ? '. Valgt' : ','}`}
            aria-pressed={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ', ') {
                e.preventDefault();
                setStatusFilter('all');
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'all' ? `2px solid ${vendorConfig?.color || '#2196f3'}` : '1px solid',
              borderColor: statusFilter === 'all' ? vendorConfig?.color || '#2196f3' : 'divider',
              textAlign: 'center',
              width: '100%',
              padding: 0,
              backgroundColor: 'background.paper',
              '&:focus-visible': {
                outline: `3px solid ${vendorConfig?.color || '#2196f3'}`,
                outlineOffset: '2px'
              },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: vendorConfig?.color || '#2196f3' }}>
                {orderStats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totalt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            component="button"
            role="button"
            tabIndex={0}
            aria-label={`Vis ventende ordre. ${orderStats.pending} ordre venter${statusFilter === 'pending' ? '. Valgt' : ','}`}
            aria-pressed={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ', ') {
                e.preventDefault();
                setStatusFilter('pending');
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'pending' ? `2px solid #ff9800` : '1px solid',
              borderColor: statusFilter === 'pending' ? '#ff9800' : 'divider',
              textAlign: 'center',
              width: '100%',
              padding: 0,
              backgroundColor: 'background.paper',
              '&:focus-visible': {
                outline: '3px solid #ff9800',
                outlineOffset: '2px'
              },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={orderStats.pending} color="warning" aria-hidden="true">
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                  {orderStats.pending}
                </Typography>
              </Badge>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Venter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            component="button"
            role="button"
            tabIndex={0}
            aria-label={`Vis ordre under behandling. ${orderStats.processing} ordre behandles${statusFilter === 'processing' ? '. Valgt' : ','}`}
            aria-pressed={statusFilter === 'processing'}
            onClick={() => setStatusFilter('processing')}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ', ') {
                e.preventDefault();
                setStatusFilter('processing');
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'processing' ? `2px solid #2196f3` : '1px solid',
              borderColor: statusFilter === 'processing' ? '#2196f3' : 'divider',
              textAlign: 'center',
              width: '100%',
              padding: 0,
              backgroundColor: 'background.paper',
              '&:focus-visible': {
                outline: '3px solid #2196f3',
                outlineOffset: '2px'
              },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {orderStats.processing}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Behandles
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            component="button"
            role="button"
            tabIndex={0}
            aria-label={`Vis sendte ordre. ${orderStats.shipped} ordre er sendt${statusFilter === 'shipped' ? '. Valgt' : ','}`}
            aria-pressed={statusFilter === 'shipped'}
            onClick={() => setStatusFilter('shipped')}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ', ') {
                e.preventDefault();
                setStatusFilter('shipped');
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'shipped' ? `2px solid #9c27b0` : '1px solid',
              borderColor: statusFilter === 'shipped' ? '#9c27b0' : 'divider',
              textAlign: 'center',
              width: '100%',
              padding: 0,
              backgroundColor: 'background.paper',
              '&:focus-visible': {
                outline: '3px solid #9c27b0',
                outlineOffset: '2px'
              },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                {orderStats.shipped}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sendt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card
            component="button"
            role="button"
            tabIndex={0}
            aria-label={`Vis leverte ordre. ${orderStats.delivered} ordre er levert${statusFilter === 'delivered' ? '. Valgt' : ','}`}
            aria-pressed={statusFilter === 'delivered'}
            onClick={() => setStatusFilter('delivered')}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ', ') {
                e.preventDefault();
                setStatusFilter('delivered');
              }
            }}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: statusFilter === 'delivered' ? `2px solid #4caf50` : '1px solid',
              borderColor: statusFilter === 'delivered' ? '#4caf50' : 'divider',
              textAlign: 'center',
              width: '100%',
              padding: 0,
              backgroundColor: 'background.paper',
              '&:focus-visible': {
                outline: '3px solid #4caf50',
                outlineOffset: '2px'
              },
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                {orderStats.delivered}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Levert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              id="order-search"
              label="Søk i ordre"
              placeholder="Søk etter ordrenummer, kunde..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              inputProps={{
                'aria-label': 'Søk i ordre etter ordrenummer, kundenavn eller e-post',
                'aria-describedby': 'order-search-help'
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
                      aria-label="Nullstill søk"
                      title="Nullstill søk"
                      sx={{
                        minWidth: 44,
                        minHeight: 44,
                        '&:focus-visible': {
                          outline: '3px solid #2196f3',
                          outlineOffset: '2px'
                        }
                      }}
                    >
                      <Cancel fontSize="small" aria-hidden="true" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ flexGrow: 1, minWidth: 300 }}
            />
            <Typography 
              id="order-search-help"
              sx={{ 
                position: 'absolute', 
                left: '-10000px',
                width: '1px',
                height: '1px',
                overflow: 'hidden'
              }}
            >
              Skriv for å søke i ordre. Resultater oppdateres automatisk.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Orders table */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ShoppingCart sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery ? 'Ingen ordre funnet' : 'Ingen ordre ennå'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {searchQuery
                ? 'Prøv et annet søk'
                : 'Ordre vil vises her når kunder kjøper produktene dine'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table aria-label="Ordreliste">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.1) }}>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Ordrenummer</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Kunde</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Produkter</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Beløp</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Betaling</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Dato</TableCell>
                <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <AnimatePresence>
                {filteredOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    component={TableRow}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleViewOrder(order)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        #{order.orderNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {order.customerName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.customerEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.items.length} produkt{order.items.length !== 1 ? 'er' : ','}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {order.totalAmount.toLocaleString()} kr
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={order.status === 'pending' ? 'Venter' : order.status === 'processing' ? 'Behandles' : order.status === 'shipped' ? 'Sendt' : order.status === 'delivered' ? 'Levert' : 'Kansellert'}
                        size="small"
                        sx={{
                          bgcolor: alpha(getStatusColor(order.status), 0.2),
                          color: getStatusColor(order.status),
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.paymentStatus === 'paid' ? 'Betalt' : order.paymentStatus === 'pending' ? 'Venter' : 'Refundert'}
                        size="small"
                        sx={{
                          bgcolor: alpha(getPaymentStatusColor(order.paymentStatus), 0.2),
                          color: getPaymentStatusColor(order.paymentStatus),
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.createdAt).toLocaleDateString('no-NO')}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, order.id)}
                        aria-label={`Handlinger for ordre ${order.orderNumber}`}
                        aria-haspopup="true"
                        aria-controls={activeOrderId === order.id ? 'order-actions-menu' : undefined}
                        aria-expanded={activeOrderId === order.id}
                        sx={{
                          minWidth: 48,
                          minHeight: 48,
                          '&:focus-visible': {
                            outline: '3px solid #2196f3',
                            outlineOffset: '2px'
                          }
                        }}
                      >
                        <MoreVert aria-hidden="true" />
                      </IconButton>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Context menu */}
      <Menu
        id="order-actions-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        aria-label="Ordrehandlinger"
      >
        <MenuItem 
          onClick={() => handleUpdateStatus('processing')}
          aria-label="Marker ordre som behandles"
        >
          <AccessTime sx={{ mr: 1, fontSize: 20 }} aria-hidden="true" />
          Marker som behandles
        </MenuItem>
        <MenuItem 
          onClick={() => handleUpdateStatus('shipped')}
          aria-label="Marker ordre som sendt"
        >
          <LocalShipping sx={{ mr: 1, fontSize: 20 }} aria-hidden="true" />
          Marker som sendt
        </MenuItem>
        <MenuItem 
          onClick={() => handleUpdateStatus('delivered')}
          aria-label="Marker ordre som levert"
        >
          <CheckCircle sx={{ mr: 1, fontSize: 20 }} aria-hidden="true" />
          Marker som levert
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => handleUpdateStatus('cancelled')}
          aria-label="Kanseller denne ordren"
        >
          <Cancel sx={{ mr: 1, fontSize: 20, color: '#f44336' }} aria-hidden="true" />
          <Typography color="#f44336">Kanseller ordre</Typography>
        </MenuItem>
      </Menu>

      {/* Order details dialog */}
      <Dialog
        open={orderDetailsOpen}
        onClose={() => setOrderDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Ordre #{selectedOrder.orderNumber}
                </Typography>
                <Chip
                  icon={getStatusIcon(selectedOrder.status)}
                  label={selectedOrder.status}
                  sx={{
                    bgcolor: alpha(getStatusColor(selectedOrder.status), 0.2),
                    color: getStatusColor(selectedOrder.status),
                    fontWeight: 600
                  }}
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                {/* Customer info */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Kundeinformasjon
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: vendorConfig?.color || '#2196f3' }}>
                        {selectedOrder.customerName.charAt(0)}
                      </Avatar>
                      <Typography variant="body2">{selectedOrder.customerName}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2">{selectedOrder.customerEmail}</Typography>
                    </Box>
                    {selectedOrder.customerPhone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2">{selectedOrder.customerPhone}</Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* Shipping address */}
                {selectedOrder.shippingAddress && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Leveringsadresse
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <LocationOn sx={{ fontSize: 18, color: 'text.secondary', mt: 0.5 }} />
                      <Box>
                        <Typography variant="body2">{selectedOrder.shippingAddress.street}</Typography>
                        <Typography variant="body2">
                          {selectedOrder.shippingAddress.postalCode} {selectedOrder.shippingAddress.city}
                        </Typography>
                        <Typography variant="body2">{selectedOrder.shippingAddress.country}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}

                {/* Order items */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Produkter
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Produkt</TableCell>
                          <TableCell align="right">Antall</TableCell>
                          <TableCell align="right">Pris</TableCell>
                          <TableCell align="right">Sum</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">{item.price.toLocaleString()} kr</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {(item.quantity * item.price).toLocaleString()} kr
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} align="right" sx={{ fontWeight: 600 }}>
                            Total:
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                            {selectedOrder.totalAmount.toLocaleString()} kr
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Tracking */}
                {selectedOrder.trackingNumber && (
                  <Grid item xs={12}>
                    <Alert severity="info" icon={<LocalShipping />}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Sporingsnummer: {selectedOrder.trackingNumber}
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {/* Notes */}
                {selectedOrder.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Notater
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'action.hover' }}>
                      <Typography variant="body2">{selectedOrder.notes}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOrderDetailsOpen(false)}>Lukk</Button>
              <Button variant="contained" startIcon={<Print />}>
                Skriv ut
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}


