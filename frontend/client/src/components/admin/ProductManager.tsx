import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import Grid from '@mui/material/Grid2';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  FileUpload,
  PhotoLibrary,
  Search,
} from '@mui/icons-material';

type ProductType = 'camera' | 'lens' | 'accessory';
type ProductLicense = 'proprietary' | 'cc-by' | 'editorial-use-only';

interface Product {
  id: string;
  type: ProductType;
  brand: string;
  series?: string;
  model: string;
  mount?: string;
  sensorFormat?: string;
  announcedAt?: string;
  releasedAt?: string;
  discontinuedAt?: string;
  technicalSpecs?: Record<string, unknown>;
  sourceUrl?: string;
  license?: ProductLicense;
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

interface ProductListResponse {
  data?: Product[];
  products?: Product[];
}

type WorkflowPayload = Record<string, unknown>;

interface ProductManagerProps {
  onMeetingCreate?: (meeting: WorkflowPayload) => void;
  onProjectUpdate?: (project: WorkflowPayload) => void;
  onWorklogCreate?: (worklog: WorkflowPayload) => void;
  onClientSelect?: (client: WorkflowPayload) => void;
  onClientUpdate?: (client: WorkflowPayload) => void;
  onShowcaseCreate?: (showcase: WorkflowPayload) => void;
  onFileUpload?: (file: WorkflowPayload) => void;
  onFileDownload?: (file: WorkflowPayload) => void;
  selectedProject?: WorkflowPayload;
  onProjectSelect?: (project: WorkflowPayload) => void;
  selectedClient?: WorkflowPayload;
  onSettingsUpdate?: (settings: WorkflowPayload) => void;
  onNotificationCreate?: (notification: WorkflowPayload) => void;
}

function normalizeString(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalString(value: FormDataEntryValue | null): string | undefined {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeProductType(value: string): ProductType {
  if (value === 'camera' || value === 'lens' || value === 'accessory') {
    return value;
  }
  return 'camera';
}

function normalizeProductLicense(value: string): ProductLicense | undefined {
  if (value === 'proprietary' || value === 'cc-by' || value === 'editorial-use-only') {
    return value;
  }
  return undefined;
}

function buildSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ProductManager: React.FC<ProductManagerProps> = ({
  onNotificationCreate,
  onProjectUpdate,
  selectedProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMount, setFilterMount] = useState('');
  const [page] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; severity: 'success' | 'error' | 'info'; message: string }>({
    open: false,
    severity: 'info',
    message: '',
  });

  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['/api/admin/products', searchTerm, filterBrand, filterType, filterMount, page],
    queryFn: async (): Promise<ProductListResponse> => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterBrand) params.append('brand', filterBrand);
      if (filterType) params.append('type', filterType);
      if (filterMount) params.append('mount', filterMount);
      params.append('page', String(page));

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      return (await response.json()) as ProductListResponse;
    },
  });

  const productMutation = useMutation({
    mutationFn: async (productData: Partial<Product>) => {
      const method = productData.id ? 'PUT' : 'POST';
      const url = productData.id ? `/api/admin/products/${productData.id}` : '/api/admin/products';
      const headers = await auth.getAuthHeader();

      const response = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error('Failed to save product');
      }
      return (await response.json()) as Product;
    },
    onSuccess: (savedProduct, submittedData) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setOpenDialog(false);
      setSelectedProduct(null);

      const action = submittedData.id ? 'updated' : 'created';
      setSnackbar({ open: true, severity: 'success', message: `Produkt ${action}.` });

      onProjectUpdate?.({
        ...(selectedProject ?? {}),
        lastEquipmentUpdate: new Date().toISOString(),
        equipmentProductId: savedProduct.id,
      });

      onNotificationCreate?.({
        id: `product_${action}_${savedProduct.id}`,
        type: `product_${action}`,
        title: submittedData.id ? 'Produkt oppdatert' : 'Nytt produkt lagt til',
        message: `${savedProduct.brand} ${savedProduct.model}`,
        source: 'product_manager',
        timestamp: new Date().toISOString(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setSnackbar({ open: true, severity: 'success', message: 'Produkt slettet.' });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to import data');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setBulkImportOpen(false);
      setSelectedFile(null);
      setSnackbar({ open: true, severity: 'success', message: 'Masseimport fullført.' });
    },
    onError: () => {
      setSnackbar({ open: true, severity: 'error', message: 'Masseimport feilet.' });
    },
  });

  const products = useMemo(() => {
    const list = productsData?.data ?? productsData?.products ?? [];
    return Array.isArray(list) ? list : [];
  }, [productsData]);

  const handleSaveProduct = (formData: FormData) => {
    const brand = normalizeString(formData.get('brand'));
    const model = normalizeString(formData.get('model'));
    const type = normalizeProductType(normalizeString(formData.get('type')));

    const productData: Partial<Product> = {
      id: selectedProduct?.id,
      type,
      brand,
      model,
      series: normalizeOptionalString(formData.get('series')),
      mount: normalizeOptionalString(formData.get('mount')),
      sensorFormat: normalizeOptionalString(formData.get('sensorFormat')),
      license: normalizeProductLicense(normalizeString(formData.get('license'))),
      attribution: normalizeOptionalString(formData.get('attribution')),
      sourceUrl: normalizeOptionalString(formData.get('sourceUrl')),
      metaTitle: normalizeOptionalString(formData.get('metaTitle')),
      metaDescription: normalizeOptionalString(formData.get('metaDescription')),
    };

    if (!selectedProduct) {
      productData.slug = buildSlug(brand, model);
    }

    productMutation.mutate(productData);
  };

  const handleBulkImport = () => {
    if (selectedFile) {
      bulkImportMutation.mutate(selectedFile);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Produktadministrasjon
      </Typography>

      <Paper sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Søk i produkter"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Merke</InputLabel>
              <Select value={filterBrand} onChange={(event) => setFilterBrand(event.target.value)} label="Merke">
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
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={filterType} onChange={(event) => setFilterType(event.target.value)} label="Type">
                <MenuItem value="">Alle typer</MenuItem>
                <MenuItem value="camera">Kamera</MenuItem>
                <MenuItem value="lens">Objektiv</MenuItem>
                <MenuItem value="accessory">Tilbehør</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Fatning</InputLabel>
              <Select value={filterMount} onChange={(event) => setFilterMount(event.target.value)} label="Fatning">
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
          <Grid size={{ xs: 12, md: 3 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatsCard title="Totalt produkter" value={products.length} />
        <StatsCard title="Kameraer" value={products.filter((product) => product.type === 'camera').length} />
        <StatsCard title="Objektiver" value={products.filter((product) => product.type === 'lens').length} />
        <StatsCard title="Tilbehør" value={products.filter((product) => product.type === 'accessory').length} />
      </Grid>

      {isLoading ? <LinearProgress sx={{ mb: 2 }} /> : null}

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
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  {product.images && product.images.length > 0 ? (
                    <Box
                      component="img"
                      src={product.images[0].urlThumb || product.images[0].urlOriginal}
                      alt={`${product.brand} ${product.model}`}
                      sx={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 60,
                        height: 45,
                        backgroundColor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                      }}
                    >
                      <PhotoLibrary color="disabled" />
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">{product.brand}</Typography>
                  {product.series ? (
                    <Typography variant="caption" color="text.secondary">
                      {product.series}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">{product.model}</Typography>
                  <Typography variant="caption" color="text.secondary">
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
                  {product.license ? (
                    <Chip
                      size="small"
                      label={product.license}
                      color={product.license === 'cc-by' ? 'success' : 'warning'}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{new Date(product.createdAt).toLocaleDateString('no-NO')}</TableCell>
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
                  <IconButton size="small" color="error" onClick={() => setDeleteConfirmProduct(product)}>
                    {theming.getThemedIcon('delete')}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveProduct(new FormData(event.currentTarget));
          }}
        >
          <DialogTitle>
            {selectedProduct ? `Rediger ${selectedProduct.brand} ${selectedProduct.model}` : 'Nytt produkt'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Type</InputLabel>
                  <Select name="type" defaultValue={selectedProduct?.type || 'camera'} label="Type">
                    <MenuItem value="camera">Kamera</MenuItem>
                    <MenuItem value="lens">Objektiv</MenuItem>
                    <MenuItem value="accessory">Tilbehør</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth required name="brand" label="Merke" defaultValue={selectedProduct?.brand || ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth name="series" label="Serie" defaultValue={selectedProduct?.series || ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth required name="model" label="Modell" defaultValue={selectedProduct?.model || ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth name="mount" label="Fatning" defaultValue={selectedProduct?.mount || ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth name="sensorFormat" label="Sensorformat" defaultValue={selectedProduct?.sensorFormat || ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth name="sourceUrl" label="Kilde-URL" defaultValue={selectedProduct?.sourceUrl || ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Lisens</InputLabel>
                  <Select name="license" defaultValue={selectedProduct?.license || ''} label="Lisens">
                    <MenuItem value="">Ikke spesifisert</MenuItem>
                    <MenuItem value="proprietary">Proprietær</MenuItem>
                    <MenuItem value="cc-by">CC-BY</MenuItem>
                    <MenuItem value="editorial-use-only">Kun redaksjonell bruk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth name="attribution" label="Kreditering" defaultValue={selectedProduct?.attribution || ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth name="metaTitle" label="SEO Tittel" defaultValue={selectedProduct?.metaTitle || ''} />
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

      <Dialog open={bulkImportOpen} onClose={() => setBulkImportOpen(false)}>
        <DialogTitle>Masseimport av produkter</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Last opp en JSON- eller CSV-fil med produktdata.
          </Alert>
          <Button variant="outlined" component="label" startIcon={<FileUpload />} fullWidth sx={{ mb: 2 }}>
            Velg fil
            <input
              type="file"
              accept=".json,.csv"
              hidden
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
          </Button>
          {selectedFile ? (
            <Typography variant="body2" color="text.secondary">
              Valgt fil: {selectedFile.name}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkImportOpen(false)}>Avbryt</Button>
          <Button
            onClick={handleBulkImport}
            variant="contained"
            disabled={!selectedFile || bulkImportMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {bulkImportMutation.isPending ? 'Importerer...' : 'Importer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteConfirmProduct)} onClose={() => setDeleteConfirmProduct(null)}>
        <DialogTitle>Slett produkt</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil slette {deleteConfirmProduct?.brand} {deleteConfirmProduct?.model}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmProduct(null)}>Avbryt</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (!deleteConfirmProduct) return;
              deleteMutation.mutate(deleteConfirmProduct.id);
              setDeleteConfirmProduct(null);
            }}
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>

      <SnackbarAlert
        open={snackbar.open}
        severity={snackbar.severity}
        message={snackbar.message}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      />
    </Box>
  );
};

function StatsCard({ title, value }: { title: string; value: number }) {
  const theming = useTheming('prototype_tester');
  return (
    <Grid size={{ xs: 12, md: 3 }}>
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function SnackbarAlert({
  open,
  severity,
  message,
  onClose,
}: {
  open: boolean;
  severity: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1300,
        display: open ? 'block' : 'none',
      }}
    >
      <Alert severity={severity} onClose={onClose}>
        {message}
      </Alert>
    </Box>
  );
}

export default ProductManager;
