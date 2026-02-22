import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  IconButton,
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
  Rating,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tab,
  Tabs,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Store,
  ShoppingCart,
  Download,
  Star,
  Favorite,
  FavoriteBorder,
  Share,
  Launch,
  Extension,
  CloudDownload,
  AttachMoney,
  Visibility,
  Edit,
  Add,
  Category,
  FilterList,
  Search,
  TrendingUp,
  Info,
  CheckCircle,
  Security,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';

interface VendorShowcaseProps {
  userId: string;
  viewMode?: 'public' | 'admin';
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
  onNotificationCreate?: (notification: any) => void
}

interface VendorProduct {
  id: string;
  name: string;
  vendor: string;
  category: 'plugin' | 'sample_pack' | 'preset' | 'software' | 'hardware';
  version: string;
  price: number;
  currency: string;
  description: string;
  imageUrl?: string;
  downloadUrl?: string;
  demoUrl?: string;
  downloads: number;
  rating: number;
  reviews: number;
  tags: string[];
  featured: boolean;
  status: 'active' | 'coming_soon' | 'discontinued';
  releaseDate: string;
  requirements?: string[];
  screenshots?: string[]
}

export default function VendorShowcase({ 
  userId, 
  viewMode = 'public',
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
}: VendorShowcaseProps) {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('vendor');
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedProduct, setSelectedProduct] = useState<VendorProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Fetch vendor products for showcase
  const { data: showcaseProducts = [], isLoading } = useQuery({
    queryKey: ['/api/vendor/showcase', userId, selectedCategory, searchQuery, sortBy],
    queryFn: () => apiRequest(`/api/vendor/showcase/${userId}?category=${selectedCategory}&search=${searchQuery}&sort=${sortBy}`)
});

  // Fetch vendor showcase stats
  const { data: showcaseStats } = useQuery({
    queryKey: ['/api/vendor/showcase-stats', userId],
    queryFn: () => apiRequest(`/api/vendor/showcase-stats/${userId}`)
});

  const categories = [
    { value: 'all', label: 'Alle Produkter', icon: theming.getThemedIcon(',') },
    { value: 'plugin', label: 'Plugins', icon: <Extension />,},
    { value: 'sample_pack', label: 'Sample Packs', icon: theming.getThemedIcon(',') },
    { value: 'preset', label: 'Presets', icon: theming.getThemedIcon(',') },
    { value: 'software', label: 'Software', icon: theming.getThemedIcon(', ') },
    { value: 'hardware', label: 'Hardware', icon: theming.getThemedIcon(', ') }
  ];

  const sortOptions = [
    { value: 'popular', label: 'Mest Populære',},
    { value: 'newest', label: 'Nyeste',},
    { value: 'price_low', label: 'Laveste Pris',},
    { value: 'price_high', label: 'Høyeste Pris',},
    { value: 'rating', label: 'Høyest Vurdert',}
  ];

  const handleProductClick = (product: VendorProduct) => {
    setSelectedProduct(product);
    setShowProductDialog(true);
};

  const handleDownloadProduct = async (product: VendorProduct) => {
    try {
      // Trigger download via Smart Queue Management
      console.log(`📦 Starting download for ${product.name}`);
      
      // In real implementation, this would handle the download
      // and update download count
      
  } catch (error) {
      console.error('Download failed: ', error);
  }
};

  const categoryColors = {
    plugin: '#9b59b0',
    sample_pack: '#3498db',
    preset: '#e74c30',
    software: '#27ae60',
    hardware: '#f39c12'
};

  const filteredProducts = showcaseProducts.filter((product: VendorProduct) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = searchQuery === ', ' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
});

  return (
    <Box sx={{ p:  3 }}>
      {/* Vendor Showcase Header */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" sx={{  
          fontWeight: 700, 
          color: '#27ae60',
          display: 'flex', 
          alignItems: 'center',
          mb: 1  }}>
          <Store sx={{ mr: 2, fontSize: 40}} />
          Vendor Showcase
        </Typography>
        <Typography variant="h6" sx={{  color: 'text.secondary' }}>
          Profesjonelle plugins og verktøy for kreative
        </Typography>
      </Box>

      {/* Showcase Stats */}
      {showcaseStats && (
        <Grid container spacing={3} sx={{ mb:  4 }}>
          <Grid size={{ xs: 12 }} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: '#9b59b61', border: '1px solid #9b59b630',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{  fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.totalProducts || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                  Totale Produkter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: '#3498db1', border: '1px solid #3498db30',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{  fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.totalDownloads || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                  Totale Downloads
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: '#e74c3c1', border: '1px solid #e74c3c30',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{  fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.averageRating?.toFixed(1) || '0.0'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                  Gjennomsnittlig Rating
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6} md={3}>
            <Card sx={{ textAlign: 'center', bgcolor: '#27ae601', border: '1px solid #27ae6030',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{  fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.featuredProducts || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                  Fremhevede Produkter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filter and Search Controls */}
      <Card sx={{ mb:  4, p:  3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12 }} md={3}>
            <TextField
              fullWidth
              placeholder="Søk produkter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />
            }}
            />
          </Grid>
          <Grid size={{ xs: 12 }} md={3}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                label="Kategori"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      {cat.icon}
                      {cat.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }} md={3}>
            <FormControl fullWidth>
              <InputLabel>Sorter etter</InputLabel>
              <Select
                value={sortBy}
                label="Sorter etter"
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }} md={3}>
            <Typography variant="body2" sx={{ color: 'text.secondary'}}>
              {filteredProducts.length} produkter funnet
            </Typography>
          </Grid>
        </Grid>
      </Card>

      {/* Product Showcase Grid */}
      <Grid container spacing={3}>
        <AnimatePresence>
          {filteredProducts.map((product: VendorProduct, index: number) => (
            <Grid size={{ xs: 12 }} sm={6} md={4} lg={3} key={product.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  cursor: 'pointer',
                  border: `1px solid ${categoryColors[product.category]}30`, '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 12px 28px ${categoryColors[product.category]}25`,
                    borderColor: categoryColors[product.category]
              },
                  transition: 'all 0.3s ease'
            }}
                onClick={() => handleProductClick(product)}
                >
                  {/* Featured Badge */}
                  {product.featured && (
                    <Chip
                      label="Fremhevet"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top:  8,
                        right:  8,
                        zIndex: 1,
                        bgcolor: '#f39c10',
                        color: 'white',
                        fontWeight: 600}}
                    />
                  )}

                  {/* Product Image */}
                  <CardMedia
                    component="div"
                    sx={{
                      height: 200,
                      background: product.imageUrl 
                        ? `url(${product.imageUrl}) center/cover`
                        : `linear-gradient(135deg, ${categoryColors[product.category]}40 0%, ${categoryColors[product.category]}20 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...theming.getThemedCardSx()
                    }}>
                    {!product.imageUrl && (
                      <Avatar sx={{ 
                        width:  64, 
                        height:  64, 
                        bgcolor: categoryColors[product.category],
                        fontSize: '2rem'
                  }}>
                        {product.category === 'plugin' && <Extension />}
                        {product.category === 'sample_pack' && <CloudDownload />}
                        {product.category === 'preset' && <Star />}
                        {product.category === 'software' && <Launch />}
                        {product.category === 'hardware' && <Extension />}
                      </Avatar>
                    )}
                  </CardMedia>

                  <CardContent sx={{ flexGrow: 1, p: 2, ...theming.getThemedCardSx() }}>
                    {/* Product Info */}
                    <Typography variant="h6" sx={{  fontWeight: 600, mb: 1, lineHeight: 1.2 }}>
                      {product.name}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb:  2 }}>
                      {product.vendor} • v{product.version}
                    </Typography>

                    <Typography 
                      variant="body2" 
                      sx={{ 
                        mb: 2, height:  40, 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp:  2,
                        WebkitBoxOrient: 'vertical'
                  }}
                    >
                      {product.description}
                    </Typography>

                    {/* Rating and Downloads */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        <Rating value={product.rating} readOnly size="small" />
                        <Typography variant="caption">
                          ({product.reviews})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        <CloudDownload sx={{ fontSize:  16, color: 'text.secondary'}} />
                        <Typography variant="caption">
                          {product.downloads}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Tags */}
                    <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap', mb:  2 }}>
                      {product.tags.slice(0, 2).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            bgcolor: `${categoryColors[product.category]}15`,
                            color: categoryColors[product.category],
                            fontSize: '0.7rem',
                            height: 20 }}
                        />
                      ))}
                    </Box>

                    {/* Price and Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography variant="h6" sx={{  
                        fontWeight: 700, 
                        color: categoryColors[product.category] 
                   }}>
                        {product.price === 0 ? 'Gratis' : `${product.price} ${product.currency}`}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap:  1 }}>
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadProduct(product);
                        }}
                          sx={{ color: categoryColors[product.category]}}
                        >
                          <Download />
                        </IconButton>
                        <IconButton 
                          size="small"
                          sx={{ color: 'text.secondary'}}
                        >
                          {theming.getThemedIcon('share')}
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>

      {/* Product Detail Dialog */}
      <Dialog
        open={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedProduct && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Avatar sx={{ 
                  bgcolor: categoryColors[selectedProduct.category],
                  width:  48,
                  height: 48 }}>
                  {selectedProduct.category === 'plugin' && <Extension />}
                  {selectedProduct.category === 'sample_pack' && <CloudDownload />}
                  {selectedProduct.category === 'preset' && <Star />}
                  {selectedProduct.category === 'software' && <Launch />}
                  {selectedProduct.category === 'hardware' && <Extension />}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{  fontWeight: 600}}>
                    {selectedProduct.name}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: 'text.secondary'}}>
                    {selectedProduct.vendor} • v{selectedProduct.version}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label="Oversikt" />
                <Tab label="Detaljer" />
                <Tab label="Anmeldelser" />
              </Tabs>

              <Box sx={{ mt:  3 }}>
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="body1" sx={{ mb:  3 }}>
                      {selectedProduct.description}
                    </Typography>

                    <Grid container spacing={2}>
                      <Grid size={{ xs:  6 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                          Pris
                        </Typography>
                        <Typography variant="h5" sx={{  
                          color: categoryColors[selectedProduct.category],
                          fontWeight: 700 }}>
                          {selectedProduct.price === 0 ? 'Gratis' : `${selectedProduct.price} ${selectedProduct.currency}`}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs:  6 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1 }}>
                          Vurdering
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Rating value={selectedProduct.rating} readOnly />
                          <Typography variant="body2">
                            ({selectedProduct.reviews} anmeldelser)
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  2 }}>
                      Systemkrav
                    </Typography>
                    <List>
                      {selectedProduct.requirements?.map((req, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <CheckCircle sx={{ color: '#27ae60'}} />
                          </ListItemIcon>
                          <ListItemText primary={req} />
                        </ListItem>
                      )) || (
                        <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                          Ingen spesielle krav oppgitt
                        </Typography>
                      )}
                    </List>
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign:'center', py:  4 }}>
                      Anmeldelser kommer snart...
                    </Typography>
                  </Box>
                )}
              </Box>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setShowProductDialog(false)}>
                Lukk
              </Button>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('download')}
                onClick={() => {
                  handleDownloadProduct(selectedProduct);
                  setShowProductDialog(false);
              }}
                sx={{
                  bgcolor: categoryColors[selectedProduct.category],
                  '&:hover': {
                    bgcolor: alpha(categoryColors[selectedProduct.category], 0.8)
                  }
              }}
              >
                Last ned
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}