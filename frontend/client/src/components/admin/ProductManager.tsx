import * as React from 'react';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs
} from '@mui/material';
import {
  AddCircle as Add,
  Edit,
  Delete,
  Search,
  Upload,
  FileUpload,
  ExpandMore,
  PhotoLibrary,
  Memory,
  AttachMoney,
  Category,
  Info
} from '@mui/icons-material';

interface Product {
  id: string;
  type: 'camera' | 'lens' | 'accessory';
  brand: string;
  series?: string;
  model: string;
  mount?: string;
  sensorFormat?: string;
  announcedAt?: string;
  releasedAt?: string;
  discontinuedAt?: string;
  technicalSpecs?: any;
  sourceUrl?: string;
  license?: 'proprietary' | 'cc-by' | 'editorial-use-only';
  attribution?: string;
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
  version: number;
  lastScrapedAt?: string;
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[];
  firmware?: ProductFirmware[];
  compatibility?: ProductCompatibility[];
  prices?: ProductPrice[];
}

interface ProductImage {
  id: string;
  productId: string;
  angle: string;
  role: string;
  format: string;
  urlOriginal: string;
  urlWebp2k?: string;
  urlWebp1k?: string;
  urlThumb?: string;
  width?: number;
  height?: number;
  filesize?: number;
  colorProfile?: string;
  hashPerceptual?: string;
  license?: string;
  attribution?: string;
  sourceUrl?: string;
}

interface ProductFirmware {
  id: string;
  productId: string;
  version: string;
  releasedAt?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  checksumSha256?: string;
  region?: string;
}

interface ProductCompatibility {
  id: string;
  productId: string;
  compatibleWithProductId?: string;
  minFocalMm?: number;
  maxFocalMm?: number;
  apertureMin?: number;
  apertureMax?: number;
  notes?: string;
}

interface ProductPrice {
  id: string;
  productId: string;
  retailer: string;
  currency: string;
  price: number;
  url?: string;
  lastSeenAt: string;
}

// Integration props for unified workflow connectivity
interface ProductManagerProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

const ProductManager: React.FC<ProductManagerProps> = ({
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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMount, setFilterMount] = useState('');
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const queryClient = useQueryClient();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Integration handlers for unified workflow system
  const handleProductCreated = (productData: any) => {
    console.log('📦 Product Created, :', productData);
    
    // Broadcast product created event
    (communication as any).broadcast('admin: product:created', {
      type: 'product_created',
      data: productData,
      component: 'ProductManager'
});
    
    // Trigger unified workflow events
    if (onProjectUpdate) {
      onProjectUpdate({
        ...selectedProject,
        equipmentAdded: productData,
        lastEquipmentUpdate: new Date().toISOString()
  });
  }
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `product_created_${Date.now()}`,
        type: 'product_created',
        title: 'New Product Added',
        message: `Product "${productData.brand} ${productData.model}, " added to database`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'product_manager'
  });
  }
};

  const handleProductUpdated = (productData: any) => {
    console.log('📦 Product Updated, :', productData);
    
    // Broadcast product updated event
    (communication as any).broadcast('admin: product:updated', {
      type: 'product_updated',
      data: productData,
      component: 'ProductManager'
});
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `product_updated_${Date.now()}`,
        type: 'product_updated',
        title: 'Product Updated',
        message: `Product "${productData.brand} ${productData.model}, " has been updated`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'product_manager'
  });
  }
};

  // Fetch products with filters
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['/api/admin/products', { search: searchTerm, brand: filterBrand, type: filterType, mount: filterMount, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterBrand) params.append('brand', filterBrand);
      if (filterType) params.append('type', filterType);
      if (filterMount) params.append('mount', filterMount);
      params.append('page', page.toString());
      
      const response = await fetch(`/api/admin/products?${params}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
  }
});

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Create/Update product mutation
  const productMutation = useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const method = productData.id ? 'PUT' : 'POST';
      const url = productData.id ? `/api/admin/products/${productData.d}` : '/api/admin/products';

      const headers = await auth.getAuthHeader();
      const response = await fetch(url, {
        headers: {
          ...headers, 'Content-Type': 'application/json'
      },
        method,
        body: JSON.stringify(productData)
  });

      if (!response.ok) throw new Error('Failed to save product');
      return response.json();
  },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
      setOpenDialog(false);
      setSelectedProduct(null);
      
      // Trigger integration event
      if (variables.id) {
        handleProductUpdated(variables);
    } else {
        handleProductCreated(variables);
    }
  }
});

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/admin/products/${productd}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'DELETE'
  });
      if (!response.ok) throw new Error('Failed to delete product');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
  }
});

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/admin/bulk-import', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: formData
  });
      
      if (!response.ok) throw new Error('Failed to import data');
      return response.json();
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
      setBulkImportOpen(false);
      setSelectedFile(null);
  }
});

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    (componentRegistry as any).registerComponent('ProductManager', {
      type: 'admin',
      capabilities: ['product-management','inventory-tracking','bulk-import'],
      dataFlow: {
        sources: ['products','product-filters','product-imports'],
        destinations: ['admin-dashboard','inventory-system','showcase-system'],
        processors: ['product-processing', 'filter-processing','import-processing']
    }
  });

    // Set up data flow nodes
    (dataFlow as any).registerNode('products', {
      type: 'source',
      data: productsData?.products || [],
      metadata: { component: 'ProductManager', type: 'products',}
  });

    (dataFlow as any).registerNode('product-filters', {
      type: 'source',
      data: { searchTerm, filterBrand, filterType, filterMount },
      metadata: { component: 'ProductManager', type: 'product-filters',}
  });

    // Listen for product events
    (communication as any).subscribe('admin: product:refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products', ],});
  });

    (communication as any).subscribe('admin: product:create', (data) => {
      if (data.productData) {
        handleProductCreated(data.productData);
    }
  });

    (communication as any).subscribe('admin: product:update', (data) => {
      if (data.productData) {
        handleProductUpdated(data.productData);
    }
  });

    return () => {
      (componentRegistry as any).unregisterComponent('ProductManager');
      (dataFlow as any).unregisterNode('products');
      (dataFlow as any).unregisterNode('product-filters');
  };
}, [productsData, searchTerm, filterBrand, filterType, filterMount, componentRegistry, dataFlow, communication, queryClient]);

  const handleSaveProduct = (formData: FormData) => {
    const productData: Partial<Product> = {
      id: selectedProduct?.d,
      type: formData.get('type') as Product[', '],
      brand: formData.get('brand') as string,
      series: formData.get('series') as string || undefined,
      model: formData.get('model') as string,
      mount: formData.get('mount') as string || undefined,
      sensorFormat: formData.get('sensorFormat') as string || undefined,
      license: formData.get('license') as Product['license'] || undefined,
      attribution: formData.get('attribution') as string || undefined,
      sourceUrl: formData.get('sourceUrl') as string || undefined,
      metaTitle: formData.get('metaTitle') as string || undefined,
      metaDescription: formData.get('metaDescription') as string || undefined
};

    // Generate slug if not editing
    if (!selectedProduct) {
      productData.slug = `${productData.brand}-${productData.model}`.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-, ')
        .replace(/^-|-$/g, ', ');
  }

    productMutation.mutate(productData);
};

  const handleBulkImport = () => {
    if (selectedFile) {
      bulkImportMutation.mutate(selectedFile);
  }
};

  const products = productsData?.data || [];

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Produktadministrasjon
      </Typography>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs:  12, md:  3 }}>
            <TextField
              fullWidth
              label="Søk i produkter"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />
            }}
            />
          </Grid>
          <Grid size={{ xs:  12, md:  2 }}>
            <FormControl fullWidth>
              <InputLabel>Merke</InputLabel>
              <Select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                label="Merke"
              >
                <MenuItem value="">Alle merker</MenuItem>
                <MenuItem value="Canon">Canon</MenuItem>
                <MenuItem value="Sony">Sony</MenuItem>
                <MenuItem value="Nikon">Nikon</MenuItem>
                <MenuItem value="Fujifilm">Fujifilm</MenuItem>
                <MenuItem value="Profoto">Profoto</MenuItem>
                <MenuItem value="Rode">Rode</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs:  12, md:  2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type"
              >
                <MenuItem value="">Alle typer</MenuItem>
                <MenuItem value="camera">Kamera</MenuItem>
                <MenuItem value="lens">Objektiv</MenuItem>
                <MenuItem value="accessory">Tilbehør</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs:  12, md:  2 }}>
            <FormControl fullWidth>
              <InputLabel>Fatning</InputLabel>
              <Select
                value={filterMount}
                onChange={(e) => setFilterMount(e.target.value)}
                label="Fatning"
              >
                <MenuItem value="">Alle fatninger</MenuItem>
                <MenuItem value="RF">Canon RF</MenuItem>
                <MenuItem value="EF">Canon EF</MenuItem>
                <MenuItem value="E">Sony E</MenuItem>
                <MenuItem value="FE">Sony FE</MenuItem>
                <MenuItem value="Z">Nikon Z</MenuItem>
                <MenuItem value="F">Nikon F</MenuItem>
                <MenuItem value="X">Fujifilm X</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs:  12, md:  3 }}>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('add')}
                onClick={() => {
                  setSelectedProduct(null);
                  setOpenDialog(true);
              }}
              >
                Nytt produkt
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('upload')}
                onClick={() => setBulkImportOpen(true)}
              >
                Masseimport
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>
                Totalt produkter
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {products.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>
                Kameraer
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {products.filter((p: Product) => p.type === 'camera').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>
                Objektiver
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {products.filter((p: Product) => p.type === 'lens').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography color="textSecondary" gutterBottom>
                Tilbehør
              </Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {products.filter((p: Product) => p.type === 'accessory').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Loading */}
      {isLoading && <LinearProgress sx={{ mb:  2 }} />}

      {/* Products Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bilde</TableCell>
              <TableCell>Merke</TableCell>
              <TableCell>Modell</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Fatning</TableCell>
              <TableCell>Sensor</TableCell>
              <TableCell>Lisens</TableCell>
              <TableCell>Opprettet</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product: Product) => (
              <TableRow key={product.d}>
                <TableCell>
                  {product.images && product.images.length > 0 ? (
                    <Box
                      component="img"
                      src={product.images[0].urlThumb || product.images[0].urlOriginal}
                      alt={`${product.brand} ${product.model}`}
                      sx={{ width:  60, height:  45, objectFit: 'cover', borderRadius:  1 }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width:  60,
                        height:  45,
                        backgroundColor: 'grey.20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1 }}
                    >
                      <PhotoLibrary color="disabled" />
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">{product.brand}</Typography>
                  {product.series && (
                    <Typography variant="caption" color="textSecondary">
                      {product.series}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">{product.model}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {product.slug}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={product.type}
                    color={product.type === 'camera' ? 'primary' : product.type === 'lens' ? 'secondary' : 'default'}
                  />
                </TableCell>
                <TableCell>{product.mount || '-'}</TableCell>
                <TableCell>{product.sensorFormat || '-'}</TableCell>
                <TableCell>
                  {product.license && (
                    <Chip
                      size="small"
                      label={product.license}
                      color={product.license === 'cc-by' ? 'success' : 'warning'}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {new Date(product.createdAt).toLocaleDateString('no-NO')}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedProduct(product);
                      setOpenDialog(true);
                  }}
                  >
                    {theming.getThemedIcon('edit')}
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      if (confirm(`Er du sikker på at du vil slette ${product.brand} ${product.model}?`)) {
                        deleteMutation.mutate(product.id);
                    }
                  }}
                  >
                    {theming.getThemedIcon('delete')}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Product Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSaveProduct(new FormData(e.currentTarget));
      }}>
          <DialogTitle>
            {selectedProduct ? `Rediger ${selectedProduct.brand} ${selectedProduct.model}` : 'Nytt produkt'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt:  1 }}>
              <Grid size={{ xs:  12, md:  6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Type</InputLabel>
                  <Select
                    name="type"
                    defaultValue={selectedProduct?.type || ''}
                    label="Type"
                  >
                    <MenuItem value="camera">Kamera</MenuItem>
                    <MenuItem value="lens">Objektiv</MenuItem>
                    <MenuItem value="accessory">Tilbehør</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  required
                  name="brand"
                  label="Merke"
                  defaultValue={selectedProduct?.brand || ''}
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  name="series"
                  label="Serie"
                  defaultValue={selectedProduct?.series || ''}
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  required
                  name="model"
                  label="Modell"
                  defaultValue={selectedProduct?.model || ''}
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  name="mount"
                  label="Fatning"
                  defaultValue={selectedProduct?.mount || ', '}
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  name="sensorFormat"
                  label="Sensorformat"
                  defaultValue={selectedProduct?.sensorFormat || ', '}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  name="sourceUrl"
                  label="Kilde-URL"
                  defaultValue={selectedProduct?.sourceUrl || ', '}
                />
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <FormControl fullWidth>
                  <InputLabel>Lisens</InputLabel>
                  <Select
                    name="license"
                    defaultValue={selectedProduct?.license || ''}
                    label="Lisens"
                  >
                    <MenuItem value="">Ikke spesifisert</MenuItem>
                    <MenuItem value="proprietary">Proprietær</MenuItem>
                    <MenuItem value="cc-by">CC-BY</MenuItem>
                    <MenuItem value="editorial-use-only">Kun redaksjonell bruk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs:  12, md:  6 }}>
                <TextField
                  fullWidth
                  name="attribution"
                  label="Kreditering"
                  defaultValue={selectedProduct?.attribution || ''}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  name="metaTitle"
                  label="SEO Tittel"
                  defaultValue={selectedProduct?.metaTitle || ''}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  name="metaDescription"
                  label="SEO Beskrivelse"
                  defaultValue={selectedProduct?.metaDescription || ''}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Avbryt</Button>
            <Button type="submit" variant="contained" disabled={productMutation.isPending} sx={theming.getThemedButtonSx()}>
              {productMutation.isPending ? 'Lagrer...' : 'Lagre'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onClose={() => setBulkImportOpen(false)}>
        <DialogTitle>Masseimport av produkter</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb:  2 }}>
            Last opp en JSON-fil med produktdata. Formatet må følge API-spesifikasjonen.
          </Alert>
          <Button
            variant="outlined"
            component="label"
            startIcon={<FileUpload />}
            fullWidth
            sx={{ mb:  2 }}
          >
            Velg fil
            <input
              type="file"
              accept=".json,.csv"
              hidden
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </Button>
          {selectedFile && (
            <Typography variant="body2" color="textSecondary">
              Valgt fil: {selectedFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkImportOpen(false)}>Avbryt</Button>
          <Button onClick={handleBulkImport}
            variant="contained"
            disabled={!selectedFile || bulkImportMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {bulkImportMutation.isPending ? 'Importerer...' : 'Importer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProductManager;