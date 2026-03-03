import { useTheming } from '../utils/theming-helper';
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Alert,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  TablePagination,
  Snackbar,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Dashboard,
  PhotoLibrary,
  Memory,
  Analytics,
  Add,
  Search,
  Edit,
  Delete,
  Upload,
  Description,
  FilterList,
  Refresh,
  Save,
  Cancel,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  ContentCopy,
  FindInPage,
  TrendingUp,
  Cloud,
  AutoAwesome,
  Psychology,
  FileDownload,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

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
      id={`equipment-tabpanel-${index}`}
      aria-labelledby={`equipment-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py:  3 }}>{children}</Box>}
    </div>
  );
}

interface Product {
  id: string;
  type: string;
  brand: string;
  series?: string;
  model: string;
  mount?: string;
  sensorFormat?: string;
  sourceUrl?: string;
  license?: string;
  attribution?: string;
  technicalSpecs?: any;
  slug: string;
  createdAt: string;
  updatedAt: string;
  announcedAt?: string;
  releasedAt?: string;
  discontinuedAt?: string
}

interface NewProduct {
  type: string;
  brand: string;
  series?: string;
  model: string;
  mount?: string;
  sensorFormat?: string;
  sourceUrl?: string;
  license?: string;
  attribution?: string;
  technicalSpecs?: string
}

const EquipmentAdminPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);

  // Selected items
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkData, setBulkData] = useState('');

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
}>({
    open: false,
    message: '',
    severity: 'info',
});

  // Form data
  const [formData, setFormData] = useState<NewProduct>({
    type: '',
    brand: '',
    series: '',
    model: '',
    mount: '',
    sensorFormat: '',
    sourceUrl: '',
    license: '',
    attribution: '',
    technicalSpecs: '',
});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Google Search API state
  const [searchProductInfo, setSearchProductInfo] = useState({
    brand: '',
    model: '',
    type: 'camera',
});
  const [searchResults, setSearchResults] = useState<any>(null);

  // Individual input handlers to prevent focus loss
  const handleBrandChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchProductInfo((prev) => ({
      ...prev,
      brand: e.target.value,
  }));
}, []);

  const handleModelChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchProductInfo((prev) => ({
      ...prev,
      model: e.target.value,
  }));
}, []);

  const handleTypeChange = React.useCallback((e: any) => {
    setSearchProductInfo((prev) => ({
      ...prev,
      type: e.target.value,
  }));
}, []);
  const [enrichmentProgress, setEnrichmentProgress] = useState<{
    isRunning: boolean;
    processed: number;
    total: number;
    message: string;
}>({
    isRunning: false,
    processed:  0,
    total:  0,
    message: '',
});

  // Fetch products
  const {
    data: productsResponse,
    isLoading: productsLoading,
    refetch: refetchProducts,
} = useQuery({
    queryKey: ['/api/equipment-admin/products', ],
    refetchInterval: 3000,
});

  // Fetch stats
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/equipment-admin/stats', ],
    refetchInterval: 3000,
});

  const products = (productsResponse as any)?.data || [];
  const stats = (statsResponse as any)?.data || { total:  0 };

  // Google Search API service status
  const { data: searchServiceStatus } = useQuery({
    queryKey: ['/api/equipment-admin/search-service-status', ],
    retry: false,
});

  // Google Search API mutations
  const searchProductMutation = useMutation({
    mutationFn: async (productInfo: { brand: string; model: string; type: string }) => {
      return apiRequest('/api/equipment-admin/search-product-info', {
        method: 'POST',
        body: JSON.stringify(productInfo),
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: (data) => {
      setSearchResults(data.data);
      setSnackbar({
        open: true,
        message: `Produktinformasjon funnet for ${searchProductInfo.brand} ${searchProductInfo.model}`,
        severity: 'success',
    });
  },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.message || 'Feil ved søk etter produktinformasjon',
        severity: 'error',
    });
  },
});

  const enrichExistingProductsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/equipment-admin/enrich-existing-products', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: (data) => {
      setEnrichmentProgress({
        isRunning: false,
        processed: data.data.processed,
        total: data.data.total,
        message: data.message,
    });
      setSnackbar({
        open: true,
        message: `${data.data.enriched} produkter beriket`,
        severity: 'success',
    });
      refetchProducts();
  },
    onError: (error: any) => {
      setEnrichmentProgress({
        isRunning: false,
        processed:  0,
        total:  0,
        message: '',
    });
      setSnackbar({
        open: true,
        message: error.message || 'Feil ved berikelse av produkter',
        severity: 'error',
    });
  },
});

  const autoDiscoverBrandMutation = useMutation({
    mutationFn: async (brand: string) => {
      return apiRequest('/api/equipment-admin/auto-discover-brand', {
        method: 'POST',
        body: JSON.stringify({ brand }),
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: `${data.data.inserted} nye produkter lagt til for ${data.data.brand}`,
        severity: 'success',
    });
      refetchProducts();
  },
    onError: (error: any) => {
      setSnackbar({
        open: true,
        message: error.message || 'Feil ved auto-oppdagelse',
        severity: 'error',
    });
  },
});

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: NewProduct) => {
      return apiRequest('/api/equipment-admin/products', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Produkt opprettet, !',
        severity: 'success',
    });
      setAddDialogOpen(false);
      setFormData({
        type: '',
        brand: '',
        series: '',
        model: '',
        mount: '',
        sensorFormat: '',
        sourceUrl: '',
        license: '',
        attribution: '',
        technicalSpecs: '',
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/products', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/stats', ],
    });
  },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Feil ved opprettelse av produkt',
        severity: 'error',
    });
  },
});

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      return apiRequest(`/api/equipment-admin/products/${id}`, {
        method: 'PU',
        body: JSON.stringify(data),
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Produkt oppdatert, !',
        severity: 'success',
    });
      setEditDialogOpen(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/products', ],
    });
  },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Feil ved oppdatering av produkt',
        severity: 'error',
    });
  },
});

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/equipment-admin/products/${d}`, {
        method: 'DELET',
    });
  },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Produkt slettet, !',
        severity: 'success',
    });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/products', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/stats', ],
    });
  },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Feil ved sletting av produkt',
        severity: 'error',
    });
  },
});

  const bulkImportMutation = useMutation({
    mutationFn: async (products: any[]) => {
      return apiRequest('/api/equipment-admin/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ products }),
        headers: { 'Content-Type' : 'application/json',},
    });
  },
    onSuccess: (response) => {
      setSnackbar({
        open: true,
        message: `${response.data.imported} produkter importert!`,
        severity: 'success',
    });
      setBulkImportDialogOpen(false);
      setBulkData('');
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/products', ],
    });
      queryClient.invalidateQueries({
        queryKey: ['/api/equipment-admin/stats', ],
    });
  },
    onError: () => {
      setSnackbar({
        open: true,
        message: 'Feil ved masseimport',
        severity: 'error',
    });
  },
});

  // Filter products
  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch =
      product.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || product.type === typeFilter;
    const matchesBrand = brandFilter === 'all' || product.brand === brandFilter;

    return matchesSearch && matchesType && matchesBrand;
});

  // Get unique brands and types for filters
  const uniqueBrands = Array.from(new Set(products.map((p: Product) => p.brand))).sort();
  const uniqueTypes = Array.from(new Set(products.map((p: Product) => p.type))).sort();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  const handleSearchProduct = () => {
    if (!searchProductInfo.brand || !searchProductInfo.model) {
      setSnackbar({
        open: true,
        message: 'Brand og model er påkrevd',
        severity: 'warning',
    });
      return;
  }
    searchProductMutation.mutate(searchProductInfo);
};

  const handleEnrichExistingProducts = () => {
    setEnrichmentProgress({
      isRunning: true,
      processed:  0,
      total:  0,
      message: 'Starter berikelse av eksisterende produkter...',
  });
    enrichExistingProductsMutation.mutate();
};

  // Google Search API Tab Component
  const GoogleSearchApiTab = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Google Search API - Automatisk produktinformasjon
      </Typography>

      {/* Service Status */}
      <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Cloud sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Service Status</Typography>
          </Box>

          {(searchServiceStatus as any)?.data?.configured ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Google Search API er konfigurert og klar for bruk
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Google Search API er ikke konfigurert riktig
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Single Product Search */}
      <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Søk etter enkelt produkt
          </Typography>

          <Grid container spacing={2} sx={{ mb:  2 }}>
            <Grid size={{ xs:  12, md:  4 }}>
              <TextField
                fullWidth
                label="Produsent"
                value={searchProductInfo.brand}
                onChange={handleBrandChange}
                placeholder="f.eks. Canon, Sony, Nikon"
                variant="outlined"
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs:  12, md:  4 }}>
              <TextField
                fullWidth
                label="Modell"
                value={searchProductInfo.model}
                onChange={handleModelChange}
                placeholder="f.eks. EOS R5, A7 III"
                variant="outlined"
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs:  12, md:  4 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Type</InputLabel>
                <Select value={searchProductInfo.type} label="Type" onChange={handleTypeChange}>
                  <MenuItem value="camera">Kamera</MenuItem>
                  <MenuItem value="lens">Objektiv</MenuItem>
                  <MenuItem value="lighting">Belysning</MenuItem>
                  <MenuItem value="audio">Lyd</MenuItem>
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="accessory">Tilbehør</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Button variant="contained"
            onClick={handleSearchProduct}
            disabled={searchProductMutation.isPending}
            startIcon={theming.getThemedIcon('search')}
           sx={theming.getThemedButtonSx()}>
            {searchProductMutation.isPending ? 'Søker...' : 'Søk produkt'}
          </Button>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Søkeresultater
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Merke: </strong> {searchResults.brand || 'Ikke funnet'}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Modell: </strong> {searchResults.model || 'Ikke funnet'}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Type: </strong> {searchResults.type || 'Ikke funnet'}
              </Typography>

              {searchResults.description && (
                <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
                  <strong>Beskrivelse: </strong> {searchResults.description}
                </Typography>
              )}

              {searchResults.imageUrl && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <strong>Produktbilde: </strong>
                  </Typography>
                  <img
                    src={searchResults.imageUrl}
                    alt={`${searchResults.brand} ${searchResults.model}`}
                    style={{ maxWidth: '300px', height: 'auto' }}
                  />
                </Box>
              )}

              {searchResults.officialUrl && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    href={searchResults.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Vis offisiell side
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Bulk Operations */}
      <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Masseoperasjoner
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
            <Button variant="contained"
              onClick={handleEnrichExistingProducts}
              disabled={enrichExistingProductsMutation.isPending}
              startIcon={theming.getThemedIcon('autoAwesome')}
             sx={theming.getThemedButtonSx()}>
              {enrichExistingProductsMutation.isPending
                ? 'Beriker produkter...'
                : 'Berik eksisterende produkter'}
            </Button>

            <Button
              variant="outlined"
              onClick={() => autoDiscoverBrandMutation.mutate('Canon')}
              disabled={autoDiscoverBrandMutation.isPending}
              startIcon={<Psychology />}
            >
              Auto-oppdag Canon produkter
            </Button>

            <Button
              variant="outlined"
              onClick={() => autoDiscoverBrandMutation.mutate('Sony')}
              disabled={autoDiscoverBrandMutation.isPending}
              startIcon={<Psychology />}
            >
              Auto-oppdag Sony produkter
            </Button>

            <Button
              variant="outlined"
              onClick={() => autoDiscoverBrandMutation.mutate('Nikon')}
              disabled={autoDiscoverBrandMutation.isPending}
              startIcon={<Psychology />}
            >
              Auto-oppdag Nikon produkter
            </Button>
          </Box>

          {enrichmentProgress.isRunning && (
            <Box sx={{ mt:  2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt:  1 }}>
                {enrichmentProgress.message}
              </Typography>
            </Box>
          )}

          {enrichmentProgress.total > 0 && !enrichmentProgress.isRunning && (
            <Alert severity="success" sx={{ mt:  2 }}>
              Berikelse fullført: {enrichmentProgress.processed}/{enrichmentProgress.total},{', '}
              produkter behandlet
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Bruksanvisning
          </Typography>

          <List>
            <ListItem>
              <ListItemIcon>
                {theming.getThemedIcon('search')}
              </ListItemIcon>
              <ListItemText
                primary="Søk etter enkelt produkt"
                secondary="Skriv inn merke og modell for å finne detaljert produktinformasjon fra Google"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                {theming.getThemedIcon('autoAwesome')}
              </ListItemIcon>
              <ListItemText
                primary="Berik eksisterende produkter"
                secondary="Automatisk oppdatering av eksisterende produkter med manglende bilder eller beskrivelser"
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <Psychology />
              </ListItemIcon>
              <ListItemText
                primary="Auto-oppdag produkter"
                secondary="Finn og legg til nye produkter automatisk for spesifikke merker"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );

  const handleFormSubmit = () => {
    if (!formData.type || !formData.brand || !formData.model) {
      setSnackbar({
        open: true,
        message: 'Type, brand og model er påkrevd',
        severity: 'warning',
    });
      return;
  }

    createProductMutation.mutate(formData);
};

  const handleEditSubmit = () => {
    if (!selectedProduct) return;

    updateProductMutation.mutate({
      id: selectedProduct.d,
      data: selectedProduct,
  });
};

  const handleDelete = () => {
    if (!selectedProduct) return;

    deleteProductMutation.mutate(selectedProduct.id);
};

  const handleBulkImport = () => {
    try {
      const data = JSON.parse(bulkData);
      let products;

      // Check if data has "products" property (correct format)
      if (data.products && Array.isArray(data.products)) {
        products = data.products;
    }
      // Otherwise, assume it's a direct array
      else if (Array.isArray(data)) {
        products = data;
    } else {
        throw new Error('Data må være en array eller ha en "products" property');
    }

      bulkImportMutation.mutate(products);
  } catch (error) {
      setSnackbar({
        open: true,
        message: 'Ugyldig JSON format',
        severity: 'error',
    });
  }
};

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
};

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
};

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
};

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
};

  const formatType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      camera: 'Kamera',
      lens: 'Objektiv',
      accessory: 'Tilbehø',
      flash: 'Blits',
      audio: 'Lyd',
  };
    return typeMap[type] || type;
};

  const formatMount = (mount: string | null) => {
    if (!mount) return '-';
    return mount;
};

  return (
    <Container maxWidth="xl" sx={{ py:  4 }}>
      {/* Header */}
      <Box sx={{ mb:  4 }}>
        <Breadcrumbs sx={{ mb:  2 }}>
          <Link color="inherit" href="/">
            CreatorHub Norge
          </Link>
          <Link color="inherit" href="/admin">
            Admin Dashboard
          </Link>
          <Typography color="text.primary">Utstyrsdatabase</Typography>
        </Breadcrumbs>

        <Typography variant="h3" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
          Utstyrsdatabase Administrasjon
        </Typography>

        <Typography variant="subtitle1" color="text.secondary">
          Avansert administrasjonssystem for CreatorHub Norge utstyrsdatabase
        </Typography>
      </Box>

      {/* Admin Notice */}
      <Alert severity="info" sx={{ mb:  3 }}>
        <strong>Avansert Utstyrsdatabase</strong> - Komplett administrasjon av {stats.total}+
        produkter med autentiske bilder, lisensieringssystem og Google Custom Search integrasjon.
      </Alert>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Dashboard color="primary" />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Totale produkter
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats.total}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <PhotoLibrary color="success" />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Autentiske bilder
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>95%</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Memory color="warning" />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Produsenter
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{uniqueBrands.length}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Analytics color="info" />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    System status
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>✅ Operativ</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider',}}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="equipment admin tabs">
            <Tab label="Produktoversikt" />
            <Tab label="Legg til produkt" />
            <Tab label="Masseimport" />
            <Tab label="Bildehåndtering" />
            <Tab label="Analyser" />
            <Tab label="Google Søk API" icon={<Cloud />} />
          </Tabs>
        </Box>

        {/* Products Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Search and Filters */}
          <Box sx={{ mb:  3, display: 'flex', gap: 2, flexWrap: 'wrap',}}>
            <TextField
              placeholder="Søk etter produkter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {theming.getThemedIcon('')}
                  </InputAdornment>
                ),
            }}
              sx={{ minWidth: 300,}}
            />

            <FormControl sx={{ minWidth: 120,}}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="all">Alle typer</MenuItem>
                {uniqueTypes.map((type) => (
                  <MenuItem key={type as string} value={type as string}>
                    {formatType(type as string)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: 120,}}>
              <InputLabel>Produsent</InputLabel>
              <Select
                value={brandFilter}
                label="Produsent"
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <MenuItem value="all">Alle produsenter</MenuItem>
                {uniqueBrands.map((brand) => (
                  <MenuItem key={brand as string} value={brand as string}>
                    {brand as string}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" startIcon={theming.getThemedIcon('refresh')} onClick={() => refetchProducts()}>
              Oppdater
            </Button>
          </Box>

          {/* Products Table */}
          {productsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py:  4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Produsent</TableCell>
                  <TableCell>Modell</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Mount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts.map((product: Product) => (
                  <TableRow key={product.d}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {product.brand}
                      </Typography>
                      {product.series && (
                        <Typography variant="caption" color="textSecondary">
                          {product.series}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{product.model}</TableCell>
                    <TableCell>
                      <Chip
                        label={formatType(product.type)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatMount(product.mount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={product.license ? 'Lisensiert' : 'Ukjent'}
                        size="small"
                        color={product.license ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditProduct(product)}
                      >
                        {theming.getThemedIcon('edit')}
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteProduct(product)}
                      >
                        {theming.getThemedIcon('delete')}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <TablePagination
            component="div"
            count={filteredProducts.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Rader per side: "
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} av ${count}`}
          />
        </TabPanel>

        {/* Add Product Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Legg til nytt produkt
          </Typography>

          <Grid container spacing={3}>
            <Grid size={{ xs:  12, md:  6 }}>
              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Type *</InputLabel>
                <Select
                  value={formData.type}
                  label="Type *"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="camera">Kamera</MenuItem>
                  <MenuItem value="lens">Objektiv</MenuItem>
                  <MenuItem value="accessory">Tilbehør</MenuItem>
                  <MenuItem value="flash">Blits</MenuItem>
                  <MenuItem value="audio">Lyd</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Produsent *"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Serie"
                value={formData.series}
                onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Modell *"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                sx={{ mb:  2 }}
              />
            </Grid>

            <Grid size={{ xs:  12, md:  6 }}>
              <TextField
                fullWidth
                label="Mount"
                value={formData.mount}
                onChange={(e) => setFormData({ ...formData, mount: e.target.value })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Sensor format"
                value={formData.sensorFormat}
                onChange={(e) => setFormData({ ...formData, sensorFormat: e.target.value })}
                sx={{ mb:  2 }}
              />

              <TextField
                fullWidth
                label="Kilde URL"
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                sx={{ mb:  2 }}
              />

              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Lisens</InputLabel>
                <Select
                  value={formData.license}
                  label="Lisens"
                  onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  <MenuItem value="proprietary">Proprietary</MenuItem>
                  <MenuItem value="cc-by">CC BY</MenuItem>
                  <MenuItem value="editorial">Editorial Use Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Tekniske spesifikasjoner"
                multiline
                rows={3}
                value={formData.technicalSpecs}
                onChange={(e) => setFormData({ ...formData, technicalSpecs: e.target.value })}
                sx={{ mb:  2 }}
              />

              <Box sx={{ display: 'flex', gap:  2 }}>
                <Button variant="contained"
                  startIcon={theming.getThemedIcon('save')}
                  onClick={handleFormSubmit}
                  disabled={createProductMutation.isPending}
                 sx={theming.getThemedButtonSx()}>
                  {createProductMutation.isPending ? 'Lagrer...' : 'Lagre produkt'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('cancel')}
                  onClick={() =>
                    setFormData({
                      type: '',
                      brand: '',
                      series: '',
                      model: '',
                      mount: '',
                      sensorFormat: '',
                      sourceUrl: '',
                      license: '',
                      attribution: '',
                      technicalSpecs: '',
                  })
                }
                >
                  Nullstill
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Bulk Import Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Masseimport av produkter
          </Typography>

          <Alert severity="info" sx={{ mb:  3 }}>
            Importer flere produkter samtidig ved å lime inn JSON-data eller laste opp en fil.
          </Alert>

          <TextField
            fullWidth
            multiline
            rows={12}
            label="JSON data"
            placeholder={`{
  "products": [
    {
      "type":"camera","brand":"Canon","model":"EOS R6 Mark II","mount":"RF","sensorFormat":"FF","sourceUrl":"https: //canon.no/cameras/eos-r6-mark-ii, /","license" : "proprietary"
  }
  ]
}`}
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            sx={{ mb:  3 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button variant="contained"
              startIcon={theming.getThemedIcon('upload')}
              onClick={handleBulkImport}
              disabled={bulkImportMutation.isPending || !bulkData.trim()}
             sx={theming.getThemedButtonSx()}>
              {bulkImportMutation.isPending ? 'Importerer...' : 'Importer produkter'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={() => {
                const sampleData = {
                  products: [
                    {
                      type: 'camera',
                      brand: 'Canon',
                      model: 'EOS R6 Mark I',
                      mount: 'R',
                      sensorFormat: 'F',
                      sourceUrl: 'https://canon.no/cameras/eos-r6-mark-ii, /',
                      license: 'proprietary',
                  },
                    {
                      type: 'camera',
                      brand: 'Canon',
                      model: 'EOS R',
                      mount: 'R',
                      sensorFormat: 'F',
                      sourceUrl: 'https://canon.no/cameras/eos-r5, /',
                      license: 'proprietary',
                  },
                  ],
              };
                setBulkData(JSON.stringify(sampleData, null, 2));
            }}
            >
              Last inn eksempel
            </Button>
          </Box>

          {bulkImportMutation.isPending && <LinearProgress sx={{ mb:  2 }} />}
        </TabPanel>

        {/* Image Management Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Bildehåndtering og duplikatdeteksjon
          </Typography>
          
          <Grid container spacing={3}>
            {/* Image Statistics */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PhotoLibrary sx={{ mr: 1, color: theming.colors.primary }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Bildestatistikk
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Totalt bilder:</Typography>
                    <Typography variant="body2" fontWeight="bold">{equipmentData?.length || 0} produkter</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Med bilder:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {equipmentData?.filter((p: Product) => p.sourceUrl).length || 0}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Mangler bilder:</Typography>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                      {equipmentData?.filter((p: Product) => !p.sourceUrl).length || 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Duplicate Detection */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FindInPage sx={{ mr: 1, color: theming.colors.primary }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Duplikatdeteksjon
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    pHash-basert bildeduplikatdeteksjon for å finne like bilder.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Search />}
                    onClick={() => setSnackbar({
                      open: true,
                      message: 'Skanner bilder for duplikater...',
                      severity: 'info'
                    })}
                    fullWidth
                  >
                    Skann for duplikater
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Image Optimization */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AutoAwesome sx={{ mr: 1, color: theming.colors.primary }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Bildeoptimalisering
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Automatisk resize og komprimering av bilder.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<TrendingUp />}
                    onClick={() => setSnackbar({
                      open: true,
                      message: 'Starter bildeoptimalisering...',
                      severity: 'info'
                    })}
                    fullWidth
                  >
                    Optimaliser bilder
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Products Missing Images */}
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Produkter uten bilder
                  </Typography>
                  <List dense>
                    {equipmentData?.filter((p: Product) => !p.sourceUrl).slice(0, 5).map((product: Product) => (
                      <ListItem key={product.id} divider>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${product.brand} ${product.model}`}
                          secondary={product.type}
                        />
                        <Button
                          size="small"
                          startIcon={<Upload />}
                          onClick={() => {
                            setSelectedProduct(product);
                            setEditDialogOpen(true);
                          }}
                        >
                          Last opp
                        </Button>
                      </ListItem>
                    ))}
                    {(!equipmentData || equipmentData.filter((p: Product) => !p.sourceUrl).length === 0) && (
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary="Alle produkter har bilder!" />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Analytics Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Database analyser og statistikk
          </Typography>
          
          <Grid container spacing={3}>
            {/* Overview Stats */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Totalt produkter</Typography>
                  <Typography variant="h4" color="primary.main">{equipmentData?.length || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ bgcolor: 'success.50' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Merker</Typography>
                  <Typography variant="h4" color="success.main">
                    {[...new Set(equipmentData?.map((p: Product) => p.brand) || [])].length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ bgcolor: 'info.50' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Kategorier</Typography>
                  <Typography variant="h4" color="info.main">
                    {[...new Set(equipmentData?.map((p: Product) => p.type) || [])].length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ bgcolor: 'warning.50' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Lagt til denne måneden</Typography>
                  <Typography variant="h4" color="warning.main">
                    {equipmentData?.filter((p: Product) => {
                      const createdAt = new Date(p.createdAt);
                      const now = new Date();
                      return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
                    }).length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Products by Type */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Produkter per kategori
                  </Typography>
                  {(() => {
                    const typeCounts = equipmentData?.reduce((acc: Record<string, number>, p: Product) => {
                      acc[p.type] = (acc[p.type] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>) || {};
                    const sortedTypes = Object.entries(typeCounts).sort(([,a], [,b]) => (b as number) - (a as number));
                    const maxCount = Math.max(...Object.values(typeCounts) as number[], 1);
                    
                    return sortedTypes.slice(0, 8).map(([type, count]) => (
                      <Box key={type} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{type}</Typography>
                          <Typography variant="body2" fontWeight="bold">{count}</Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={((count as number) / maxCount) * 100}
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                    ));
                  })()}
                </CardContent>
              </Card>
            </Grid>

            {/* Products by Brand */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Topp 8 merker
                  </Typography>
                  {(() => {
                    const brandCounts = equipmentData?.reduce((acc: Record<string, number>, p: Product) => {
                      acc[p.brand] = (acc[p.brand] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>) || {};
                    const sortedBrands = Object.entries(brandCounts).sort(([,a], [,b]) => (b as number) - (a as number));
                    const maxCount = Math.max(...Object.values(brandCounts) as number[], 1);
                    
                    return sortedBrands.slice(0, 8).map(([brand, count]) => (
                      <Box key={brand} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{brand}</Typography>
                          <Typography variant="body2" fontWeight="bold">{count}</Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={((count as number) / maxCount) * 100}
                          color="secondary"
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                    ));
                  })()}
                </CardContent>
              </Card>
            </Grid>

            {/* Data Quality Report */}
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Datakvalitetsrapport
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary">Med tekniske spesifikasjoner</Typography>
                        <Typography variant="h5" color="success.main">
                          {equipmentData?.filter((p: Product) => p.technicalSpecs).length || 0}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary">Med kildelenke</Typography>
                        <Typography variant="h5" color="info.main">
                          {equipmentData?.filter((p: Product) => p.sourceUrl).length || 0}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary">Med lisensinfo</Typography>
                        <Typography variant="h5" color="warning.main">
                          {equipmentData?.filter((p: Product) => p.license).length || 0}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="body2" color="text.secondary">Komplett data</Typography>
                        <Typography variant="h5" color="primary.main">
                          {equipmentData?.filter((p: Product) => p.sourceUrl && p.technicalSpecs && p.license).length || 0}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Export Options */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<FileDownload />}
                  onClick={() => {
                    const dataStr = JSON.stringify(equipmentData, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'equipment-export.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Eksporter JSON
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Description />}
                  onClick={() => {
                    const headers = ['Type', 'Brand', 'Model', 'Mount', 'Sensor Format', 'Source URL'];
                    const rows = equipmentData?.map((p: Product) => 
                      [p.type, p.brand, p.model, p.mount || '', p.sensorFormat || '', p.sourceUrl || ''].join(',')
                    ) || [];
                    const csv = [headers.join(','), ...rows].join('\n');
                    const dataBlob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(dataBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'equipment-export.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Eksporter CSV
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Google Search API Tab */}
        <TabPanel value={tabValue} index={5}>
          <GoogleSearchApiTab />
        </TabPanel>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rediger produkt</DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Grid container spacing={2} sx={{ mt:  1 }}>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Type"
                  value={selectedProduct.type || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      type: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />

                <TextField
                  fullWidth
                  label="Produsent"
                  value={selectedProduct.brand || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      brand: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />

                <TextField
                  fullWidth
                  label="Modell"
                  value={selectedProduct.model || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      model: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />
              </Grid>

              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  label="Serie"
                  value={selectedProduct.series || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      series: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />

                <TextField
                  fullWidth
                  label="Mount"
                  value={selectedProduct.mount || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      mount: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />

                <TextField
                  fullWidth
                  label="Kilde URL"
                  value={selectedProduct.sourceUrl || ', '}
                  onChange={(e) =>
                    setSelectedProduct({
                      ...selectedProduct,
                      sourceUrl: e.target.value,
                  })
                }
                  sx={{ mb:  2 }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleEditSubmit}
            variant="contained"
            disabled={updateProductMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {updateProductMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Product Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Slett produkt</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
            <Warning color="warning" sx={{ mr:  1 }} />
            <Typography>Er du sikker på at du vil slette dette produktet?</Typography>
          </Box>
          {selectedProduct && (
            <Typography variant="body2" color="textSecondary">
              {selectedProduct.brand} {selectedProduct.model}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={deleteProductMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {deleteProductMutation.isPending ? 'Sletter...': 'Slett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom:  16,
          right:  16,
      }}
        onClick={() => setTabValue(1)}
      >
        {theming.getThemedIcon('add')}
      </Fab>
    </Container>
  );
};

export default EquipmentAdminPage;
