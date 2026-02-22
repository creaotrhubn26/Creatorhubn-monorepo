import { useTheming } from '../../utils/theming-helper';
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Store,
  Inventory,
  ShoppingCart,
  TrendingUp,
  LocalShipping,
  Assignment,
  AddCircle as Add,
  Edit,
  Delete,
  Search,
  FilterList,
  GetApp,
  Notifications,
  AttachMoney,
} from '@mui/icons-material';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface Order {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  date: string
}

interface VendorManagementToolsProps {
  vendorType: string;
  vendorName: string;
  userId: string;
}

interface InventoryCreatePayload {
  name: string;
  category: string;
  brand: string;
  stock: number;
  minStock: number;
  price: number;
}

const VendorManagementTools: React.FC<VendorManagementToolsProps> = ({ vendorType, vendorName, userId }) => {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<'inventory' | 'orders' | 'analytics'>('inventory');
  
  // Theming system
  const theming = useTheming('vendor');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addItemDialog, setAddItemDialog] = useState(false);
  const [newItem, setNewItem] = useState<InventoryCreatePayload>({
    name: '',
    category: '',
    brand: '',
    stock: 0,
    minStock: 0,
    price: 0
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery<{ inventory?: InventoryItem[] }>({
    queryKey: ['/api/vendor-inventory', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-inventory/${vendorType}/${vendorName}/${userId}?status=all`)
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders?: Order[] }>({
    queryKey: ['/api/vendor-orders', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-orders/${vendorType}/${vendorName}/${userId}?status=all`)
  });

  const inventoryItems = inventoryData?.inventory || [];
  const orders = ordersData?.orders || [];

  const categories = useMemo(() => {
    const unique = new Set<string>();
    inventoryItems.forEach((item) => unique.add(item.category));
    return Array.from(unique);
  }, [inventoryItems]);

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'success';
      case 'low_stock': return 'warning';
      case 'out_of_stock': return 'error';
      default: return 'default';
}
};

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'processing': return 'info';
      case 'shipped': return 'primary';
      case 'delivered': return 'success';
      default: return 'default';
}
};

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'in_stock': return 'På lager';
      case 'low_stock': return 'Lavt lager';
      case 'out_of_stock': return 'Tomt';
      default: return status;
}
};

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Venter';
      case 'processing': return 'Behandles';
      case 'shipped': return 'Sendt';
      case 'delivered': return 'Levert';
      default: return status;
}
};

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
});

  const createInventoryMutation = useMutation<InventoryItem, Error, InventoryCreatePayload>({
    mutationFn: async (payload) =>
      apiRequest('/api/vendor-inventory/create', {
        method: 'POST',
        body: JSON.stringify({ ...payload, vendorType, vendorName, userId }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory', vendorType, vendorName, userId] });
      setAddItemDialog(false);
      setNewItem({ name: '', category: '', brand: '', stock: 0, minStock: 0, price: 0 });
    }
  });

  const deleteInventoryMutation = useMutation<void, Error, string>({
    mutationFn: async (itemId) =>
      apiRequest(`/api/vendor-inventory/${itemId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-inventory', vendorType, vendorName, userId] });
    }
  });

  const updateOrderStatusMutation = useMutation<void, Error, { orderId: string; status: Order['status'] }>({
    mutationFn: async ({ orderId, status }) =>
      apiRequest('/api/vendor-orders/update-status', {
        method: 'POST',
        body: JSON.stringify({ orderId, status, vendorType, vendorName }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-orders', vendorType, vendorName, userId] });
    }
  });

  const handleExportInventory = useCallback(() => {
    const csvRows = [
      ['Produkt', 'Kategori', 'Merke', 'Lager', 'Min. lager', 'Pris', 'Status'].join(',')
    ];
    filteredItems.forEach((item) => {
      csvRows.push([
        item.name,
        item.category,
        item.brand,
        item.stock,
        item.minStock,
        item.price,
        getStockStatusText(item.status)
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `inventory-${vendorName}-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filteredItems, vendorName]);

  const lowStockCount = inventoryItems.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock').length;
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.stock * item.price), 0);

  const isLoading = inventoryLoading || ordersLoading;

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        {theming.getThemedIcon('store')}
        Vendor Management Tools
      </Typography>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Dashboard Overview */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {inventoryItems.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale produkter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {lowStockCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lavt/tomt lager
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {orders.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive ordrer
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {(totalValue / 1000000).toFixed(1)}M
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lagerverdi (NOK)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Navigation Tabs */}
      <Box sx={{ mb:  3 }}>
        <Button
          variant={selectedTab === 'inventory' ? 'contained' : 'outlined'}
          startIcon={<Inventory />}
          onClick={() => setSelectedTab('inventory')}
          sx={{ mr:  1 }}
        >
          Lager
        </Button>
        <Button
          variant={selectedTab === 'orders' ? 'contained' : 'outlined'}
          startIcon={<ShoppingCart />}
          onClick={() => setSelectedTab('orders')}
          sx={{ mr:  1 }}
        >
          Ordrer
        </Button>
        <Button
          variant={selectedTab === 'analytics' ? 'contained' : 'outlined'}
          startIcon={<TrendingUp />}
          onClick={() => setSelectedTab('analytics')}
        >
          Analyse
        </Button>
      </Box>

      {/* Inventory Management */}
      {selectedTab === 'inventory' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                  <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                    <Inventory />
                    Lager Administrasjon
                  </Typography>
                  <Button variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddItemDialog(true)}
                  >
                    Legg til produkt
                  </Button>
                </Box>

                {/* Search and Filter */}
                <Grid container spacing={2} sx={{ mb:  2 }}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Søk produkter"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: <Search sx={{ mr: 1 }} />
                    }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Kategori</InputLabel>
                      <Select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <MenuItem value="all">Alle kategorier</MenuItem>
                        {categories.map((category) => (
                          <MenuItem key={category} value={category}>
                            {category}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<GetApp />}
                      sx={{ height: '56px'}}
                      onClick={handleExportInventory}
                    >
                      Eksporter
                    </Button>
                  </Grid>
                </Grid>

                {/* Zero Toast Compliance - Low Stock Info as Typography only */}
                {lowStockCount > 0 && (
                  <Typography variant="body2" sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius:  1 }}>
                    {lowStockCount} produkter har lavt eller tomt lager. Vurder å bestille mer.
                  </Typography>
                )}

                {/* Inventory Table */}
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Produkt</TableCell>
                        <TableCell>Kategori</TableCell>
                        <TableCell>Merke</TableCell>
                        <TableCell align="right">Lager</TableCell>
                        <TableCell align="right">Min. lager</TableCell>
                        <TableCell align="right">Pris (NOK)</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell>{item.brand}</TableCell>
                          <TableCell align="right">{item.stock}</TableCell>
                          <TableCell align="right">{item.minStock}</TableCell>
                          <TableCell align="right">{item.price.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={getStockStatusText(item.status)}
                              color={getStockStatusColor(item.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap:  1 }}>
                              <IconButton size="small" aria-label="Rediger produkt">
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label="Slett produkt"
                                onClick={() => deleteInventoryMutation.mutate(item.id)}
                                disabled={deleteInventoryMutation.isPending}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {createInventoryMutation.isError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Kunne ikke opprette produkt. Prøv igjen.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Order Management */}
      {selectedTab === 'orders' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <ShoppingCart />
                  Ordre Administrasjon
                </Typography>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Ordre ID</TableCell>
                        <TableCell>Kunde</TableCell>
                        <TableCell align="right">Antall varer</TableCell>
                        <TableCell align="right">Total (NOK)</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Dato</TableCell>
                        <TableCell>Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>{order.id}</TableCell>
                          <TableCell>{order.customer}</TableCell>
                          <TableCell align="right">{order.items}</TableCell>
                          <TableCell align="right">{order.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip
                              label={getOrderStatusText(order.status)}
                              color={getOrderStatusColor(order.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{new Date(order.date).toLocaleDateString('no-NO')}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap:  1 }}>
                              <IconButton size="small" onClick={() => setSelectedOrder(order)}>
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: 'shipped' })}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                <LocalShipping />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Analytics */}
      {selectedTab === 'analytics' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <TrendingUp />
                  Salgs- og Lageranalyse
                </Typography>

                <List>
                  <ListItem>
                    <ListItemIcon>
                      <AttachMoney />
                    </ListItemIcon>
                    <ListItemText
                      primary="Totalt lagerverdi"
                      secondary={`NOK ${totalValue.toLocaleString()}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Assignment />
                    </ListItemIcon>
                    <ListItemText
                      primary="Mest populære kategori"
                      secondary={categories[0] ? `${categories[0]} (${categories.length} kategorier)` : 'Ingen data'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Notifications />
                    </ListItemIcon>
                    <ListItemText
                      primary="Produkter som trenger påfylling"
                      secondary={`${lowStockCount} produkter under minimumslager`}
                    />
                  </ListItem>
                </List>

                {/* Zero Toast Compliance - Info as Typography only */}
                <Typography variant="body2" sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, color: 'info.contrastText'}}>
                  Detaljerte rapporter og analyse er tilgjengelig. Analyser salgs- og lagertrender for bedre beslutninger.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Add Item Dialog */}
      <Dialog open={addItemDialog} onClose={() => setAddItemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til nytt produkt</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Produktnavn"
                value={newItem.name}
                onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={newItem.category}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, category: String(e.target.value) }))}
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Merke"
                value={newItem.brand}
                onChange={(e) => setNewItem((prev) => ({ ...prev, brand: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Lagerantall"
                type="number"
                value={newItem.stock}
                onChange={(e) => setNewItem((prev) => ({ ...prev, stock: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Min. lager"
                type="number"
                value={newItem.minStock}
                onChange={(e) => setNewItem((prev) => ({ ...prev, minStock: Number(e.target.value) }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Pris (NOK)"
                type="number"
                value={newItem.price}
                onChange={(e) => setNewItem((prev) => ({ ...prev, price: Number(e.target.value) }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            sx={theming.getThemedButtonSx()}
            onClick={() => createInventoryMutation.mutate(newItem)}
            disabled={createInventoryMutation.isPending || !newItem.name.trim()}
          >
            {createInventoryMutation.isPending ? 'Lagrer...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>Ordre {selectedOrder.id}</DialogTitle>
            <DialogContent>
              <Typography variant="subtitle2">{selectedOrder.customer}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedOrder.items} varer • {selectedOrder.total.toLocaleString()} NOK
              </Typography>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Status: {getOrderStatusText(selectedOrder.status)}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedOrder(null)}>Lukk</Button>
              <Button
                variant="contained"
                startIcon={<LocalShipping />}
                onClick={() => updateOrderStatusMutation.mutate({ orderId: selectedOrder.id, status: 'shipped' })}
              >
                Marker som sendt
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default VendorManagementTools;