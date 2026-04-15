// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Badge,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  PhotoCamera as CameraIcon,
  FlashOn as FlashIcon,
  Support as TripodIcon,
  CameraAlt as LensIcon,
  Mic as AudioIcon,
  Build as SpecIcon,
  DateRange as CalendarIcon,
  Business as BrandIcon,
  Category as CategoryIcon,
  CloudDownload as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Settings as SoftwareIcon,
  Build as TilbehorIcon,
  Lightbulb as LysIcon,
  Camera as KameraIcon,
  Lens as ObjektivIcon,
  SystemUpdate as UpdateIcon,
  Build as BuildIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';

interface GearItem {
  id: string;
  brand: string;
  category: string;
  model: string;
  releaseYear: number;
  specifications: Record<string, any>;
  images?: string[];
  catalogItem?: boolean; // ⭐ Mark items from curated catalog
  databaseStored?: boolean; // ⭐ Mark items with cached photos
  searchSource?: string;
  price?: {
    msrp?: number;
    currency: string;
    retailers?: Array<{
      name: string;
      price: number;
      url: string;
}>;
};
  discontinued?: boolean;
  successor?: string;
}

interface DatabaseStats {
  totalItems: number;
  authenticItems?: number; // ⭐ Items from authentic database
  catalogItems?: number; // ⭐ Items from curated catalog
  brandCount: number;
  categories: string[];
  yearRange: { min: number; max: number };
  lastUpdate: Date
}

interface AuthenticImageMatch {
  brand: string;
  model: string;
  category: string;
  imageFound: boolean;
  imageCount: number;
  source: string;
  sampleImage: string | null;
  officialUrl: string | null;
  thumbnail?: string | null;
  confidence?: number;
  databaseStored?: boolean;
  googleImages?: string[] | Array<{ link?: string; thumbnail?: string }>;
}

const normalizeExternalUrl = (rawUrl?: string | null): string | null => {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed === ',' || trimmed === ', ' || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  try {
    return new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://creatorhub.no').toString();
  } catch {
    return null;
  }
};

const getExternalHostname = (rawUrl?: string | null): string => {
  const normalizedUrl = normalizeExternalUrl(rawUrl);
  if (!normalizedUrl) {
    return 'ukjent kilde';
  }

  try {
    return new URL(normalizedUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'ukjent kilde';
  }
};

const ComprehensiveGearDatabase: React.FC = () => {
  // Enhanced Master Integration
  const { 
    analytics, 
    performance, 
    debugging, 
    lifecycle 
  } = useEnhancedMasterIntegration();
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  
  const [gearData, setGearData] = useState<GearItem[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<GearItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [collectionProgress, setCollectionProgress] = useState<string>('');
  const [authenticImages, setAuthenticImages] = useState<AuthenticImageMatch[]>([]);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [firmwareSearchSummary, setFirmwareSearchSummary] = useState('');
  const databaseChromeSx = {
    '& .MuiCard-root': {
      border: '1px solid rgba(15, 23, 42, 0.08)',
      borderRadius: { xs: 3, md: 4 },
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))',
      boxShadow: '0 18px 48px rgba(15, 23, 42, 0.07)',
      backdropFilter: 'blur(14px)',
    },
    '& .MuiAccordion-root': {
      border: '1px solid rgba(15, 23, 42, 0.08)',
      borderRadius: { xs: 3, md: 4 },
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))',
      boxShadow: '0 18px 48px rgba(15, 23, 42, 0.07)',
      '&:before': {
        display: 'none',
      },
    },
    '& .MuiAlert-root': {
      borderRadius: 3,
      border: '1px solid rgba(148, 163, 184, 0.24)',
    },
    '& .MuiChip-root': {
      borderRadius: 999,
    },
  } as const;
  const databaseDialogPaperSx = {
    borderRadius: { xs: 3, md: 4 },
    border: '1px solid rgba(15, 23, 42, 0.08)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.95))',
    boxShadow: '0 32px 96px rgba(15, 23, 42, 0.18)',
    overflow: 'hidden',
  } as const;
  const { data: inventoryContextData = [], isLoading: inventoryContextLoading } = useQuery({
    queryKey: ['/api/equipment/inventory', userId],
    queryFn: () => apiRequest(`/api/equipment/inventory?userId=${userId}`),
    enabled: userId !== 'guest',
    staleTime: 5 * 60 * 1000,
  });
  const inventoryContext = Array.isArray(inventoryContextData) ? inventoryContextData : [];
  
  // Register component with Enhanced Master Integration
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'comprehensive-gear-database',
      type: 'equipment-browser',
      version: '1.0.0',
      capabilities: {
        data: ['equipment-search','equipment-stats','equipment-discovery'],
        events: ['equipment-selected','search-performed','filter-applied'],
        actions: ['search-equipment','filter-equipment','discover-equipment'],
        ui: ['equipment-cards','search-filters','category-icons'],
        system: ['image-caching','google-images-integration']
      },
      dependencies: ['equipment-database','google-images-service'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });
    
    analytics.trackEvent('comprehensive_gear_database_opened', {
      component: 'ComprehensiveGearDatabase'
    });
    
    return () => {
      lifecycle.unregisterComponent('comprehensive-gear-database');
    };
  }, [lifecycle, analytics]);

  // Kategori-mapping mellom norsk og engelsk for API-kall
  const categoryMapping: { [key: string]: string } = {
    'Kameraer':'cameras','Objektiver':'lenses','Blits':'flash','Lys':'lighting','Lyd':'audio','Stativer':'tripods','Tilbehør' : 'support'
};

  // Reverse mapping for display purposes
  const reverseCategoryMapping: { [key: string]: string } = {
    'cameras':'Kameraer','lenses':'Objektiver','flash':'Blits','lighting':'Lys','audio':'Lyd','tripods':'Stativer','support' : 'Tilbehør'
};

  // Dynamic brands from API
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Kategori-ikoner med amber fargekoordinering
  const getCategoryIcon = (category: string) => {
    const iconProps = { sx: { color: '#FFA726', fontSize: '1.5rem' } }; // Amber farge
    const normalizedCategory = categoryMapping[category] || category?.toLowerCase();
    const IndexedIcon = categoryIcons[normalizedCategory as keyof typeof categoryIcons];

    if (IndexedIcon) {
      return <IndexedIcon {...iconProps} />;
    }
    
    switch (category?.toLowerCase()) {
      case 'kameraer':
      case 'cameras':
        return <KameraIcon {...iconProps} />;
      case 'objektiver':
      case 'lenses':
        return <ObjektivIcon {...iconProps} />;
      case 'blits':
      case 'flash':
        return <FlashIcon {...iconProps} />;
      case 'stativer':
      case 'tripods':
        return <TripodIcon {...iconProps} />;
      case 'tilbehør':
      case 'accessories':
        return <TilbehorIcon {...iconProps} />;
      case 'software':
        return <SoftwareIcon {...iconProps} />;
      case 'lyd':
      case 'audio':
        return <AudioIcon {...iconProps} />;
      case 'lys':
      case 'lighting':
        return <LysIcon {...iconProps} />;
      default: return <CategoryIcon {...iconProps} />;
  }
};

  const categoryIcons = {
    cameras: CameraIcon,
    lenses: LensIcon,
    flash: FlashIcon,
    lighting: FlashIcon,
    tripods: TripodIcon,
    support: TripodIcon
};

  const getDisplayCategory = (category: string) => reverseCategoryMapping[category] || category;

  // Fetch available brands from API
  const fetchAvailableBrands = async () => {
    try {
      const data = await apiRequest('/api/equipment/brands');
      if (data.success) {
        setAvailableBrands(data.data || []);
    }
  } catch (error) {
      debugging.logIntegration('error', 'Error fetching equipment brands', error);
  }
};

  useEffect(() => {
    fetchDatabaseStats();
    fetchAvailableBrands();
    // Load all items on initial render
    handleSearch();
    loadGoogleSearchEngine();
}, []);

  const loadGoogleSearchEngine = () => {
    // Last Google Custom Search Engine script
    if (!document.querySelector('script[src*="cse.google.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://cse.google.com/cse.js?cx=44aefefd428a54f45';
      script.async = true;
      document.head.appendChild(script);
      // Google Custom Search Engine loaded
    }
  };

  useEffect(() => {
    if (searchQuery || selectedBrand || selectedCategory || selectedYear) {
      handleSearch();
    }
  }, [searchQuery, selectedBrand, selectedCategory, selectedYear]);

  const fetchDatabaseStats = async () => {
    const endTiming = performance.startTiming('fetch_database_stats');
    
    try {
      analytics.trackEvent('equipment_stats_fetch_started', {});
      
      const response = await fetch('/api/equipment/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        analytics.trackEvent('equipment_stats_fetch_success', {
          totalItems: data.data.totalItems,
          catalogItems: data.data.catalogItems,
          brandCount: data.data.brandCount
        });
      } else {
        debugging.logIntegration('warn','Equipment stats API returned error', data);
      }
    } catch (error) {
      debugging.logIntegration('error','Failed to fetch database stats', error);
      // Set fallback stats if API fails
      setStats({
        totalItems: 0,
        brandCount: 0,
        categories: ['Kameraer','Objektiver','Blits','Stativer','Tilbehør'],
        yearRange: { min: 2000, max: 2025 },
        lastUpdate: new Date()
      });
      
      analytics.trackEvent('equipment_stats_fetch_failed', { error });
    } finally {
      endTiming();
    }
  };

  const startComprehensiveCollection = async () => {
    setIsCollecting(true);
    setCollectionProgress('Initierer omfattende utstyrsdatabase med OpenAI bildeoppgagelse...');
    
    try {
      const response = await fetch('/api/equipment/discover-all', {
        headers: {
          'Content-Type' : 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          useGradualSearch: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCollectionProgress(`Innsamling fullført! ${data.data?.totalProcessed || 0} elementer fra ${data.data?.brandsProcessed || 0} merker`);
        await fetchDatabaseStats();
        
        // Auto-refresh to show new data
        setTimeout(() => {
          setCollectionProgress('');
          setIsCollecting(false);
        }, 3000);
      } else {
        throw new Error(data.error || 'Innsamling mislyktes');
      }
    } catch (error) {
      debugging.logIntegration('error', 'Collection error occurred', error);
      setCollectionProgress('Innsamling mislyktes. Prøv igjen senere.');
      setTimeout(() => {
        setCollectionProgress('');
        setIsCollecting(false);
      }, 3000);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    const endTiming = performance.startTiming('equipment_search');
    
    try {
      const params = new URLSearchParams();
      
      if (searchQuery) params.append('q', searchQuery);
      if (selectedBrand) params.append('brand', selectedBrand);
      if (selectedCategory) {
        // Map kategori from Norwegian to expected API format
        const mappedCategory = categoryMapping[selectedCategory] || selectedCategory;
        params.append('category', mappedCategory);
      }
      if (selectedYear) params.append('year', selectedYear);
      
      analytics.trackEvent('equipment_search_performed', {
        query: searchQuery,
        brand: selectedBrand,
        category: selectedCategory,
        year: selectedYear
      });
      
      const url = `/api/equipment/search?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setGearData(data.data || []);
        setCurrentPage(1);
        
        analytics.trackEvent('equipment_search_success', {
          resultsCount: data.data?.length || 0,
          catalogItems: data.data?.filter((item: GearItem) => item.catalogItem).length || 0
        });
      }
    } catch (error) {
      debugging.logIntegration('error','Equipment search failed', error);
      setGearData([]);
      analytics.trackEvent('equipment_search_failed', { error });
    } finally {
      setLoading(false);
      endTiming();
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBrand('');
    setSelectedCategory('');
    setSelectedYear('');
    setGearData([]);
    setCurrentPage(1);
};

  const openItemDetails = (item: GearItem) => {
    setSelectedItem(item);
    setShowDetails(true);
    
    analytics.trackEvent('equipment_details_opened', {
      brand: item.brand,
      model: item.model,
      category: item.category,
      catalogItem: item.catalogItem,
      hasImages: item.images && item.images.length > 0
    });
  };

  // Hent autentiske produktbilder fra offisielle nettsider
  const fetchAuthenticImages = async (products: Array<{brand: string; model: string; category: string}>) => {
    try {
      const response = await fetch('/api/product-images/test-images', {
        headers: {
          'Content-Type' : 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({ products })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Found authentic images with good success rate
        return data.results;
      } else {
        console.warn('Kunne ikke hente autentiske bilder');
        return [];
      }
    } catch (error) {
      debugging.logIntegration('error', 'Feil ved henting av autentiske bilder', error);
      return [];
    }
  };

  const handleAuthenticImageCheck = async () => {
    setLoadingImages(true);

    const testProducts = [
      { brand: 'Canon', model: 'EOS R', category: 'Kameraer' },
      { brand: 'Sony', model: 'A7R', category: 'Kameraer' },
      { brand: 'Nikon', model: 'Z', category: 'Kameraer' },
      { brand: 'Profoto', model: 'B1', category: 'Lys' },
      { brand: 'Rode', model: 'VideoMic Pro', category: 'Lyd' },
    ];

    try {
      const results = await fetchAuthenticImages(testProducts);
      const validResults = results.filter((result): result is AuthenticImageMatch => Boolean(result));

      validResults.forEach((result) => {
        debugging.logIntegration('info', 'Authentic image result loaded', {
          brand: result.brand,
          model: result.model,
          source: result.source,
          imageFound: result.imageFound,
        });
      });

      setAuthenticImages(validResults);
      setActiveTab(2);
      setShowImageGallery(validResults.length > 0);
      setCollectionProgress(
        validResults.length > 0
          ? `Fant ${validResults.length} autentiske bildesett fra produsentkilder`
          : 'Fant ingen autentiske bilder i denne testen'
      );
    } catch (error) {
      debugging.logIntegration('error', 'Google Images search failed', error);
      setCollectionProgress('Kunne ikke hente autentiske bilder akkurat nå');
    } finally {
      setLoadingImages(false);
    }
  };

  const closeItemDetails = () => {
    setSelectedItem(null);
    setShowDetails(false);
};

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = gearData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(gearData.length / itemsPerPage);

  const renderGearCard = (item: GearItem) => {
    return (
      <Grid item xs={12} sm={6} md={4} key={item.id}>
        <Card 
          sx={{ 
            height: '100%', 
            cursor: 'pointer',
            overflow: 'hidden',
            transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 24px 64px rgba(15, 23, 42, 0.12)',
              borderColor: `${theming.colors.primary}35`,
            },
          }}
          onClick={() => openItemDetails(item)}
        >
          {item.images && item.images.length > 0 ? (
            <CardMedia 
              component="img"
              height="200"
              image={item.images[0]}
              alt={item.model}
              sx={{ objectFit: 'contain', p: 1.5, background: 'linear-gradient(180deg, rgba(248,250,252,0.94), rgba(241,245,249,0.76))' }}
            />
          ) : (
            <Box
              sx={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(180deg, rgba(248,250,252,0.94), rgba(241,245,249,0.76))'
              }}
            >
              {getCategoryIcon(item.category)}
            </Box>
          )}
          
          <CardContent sx={{ p: 2.25 }}>
            <Typography variant="h6" component="h3" gutterBottom noWrap sx={{ color: theming.colors.primary, fontWeight: 700 }}>
              {item.model}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <BrandIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {item.brand}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {item.releaseYear}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {getCategoryIcon(item.category)}
              <Chip
                label={getDisplayCategory(item.category)}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
              
              {/* Show badge for curated catalog items */}
              {item.catalogItem && (
                <Chip
                  icon={<StarIcon sx={{ fontSize: '1rem' }} />}
                  label="Curated"
                  size="small"
                  color="success"
                  variant="filled"
                  sx={{ fontWeight: 'bold' }}
                />
              )}
              
              {/* Show badge for items with cached photos */}
              {item.databaseStored && (
                <Chip
                  icon={<CameraIcon sx={{ fontSize: '1rem' }} />}
                  label="Photo"
                  size="small"
                  color="info"
                  variant="outlined"
                />
              )}
              
              {item.discontinued && (
                <Chip
                  label="Discontinued"
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
};

  const renderDatabaseStats = () => {
    if (!stats) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {stats.totalItems.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Items
              </Typography>
              {/* Show breakdown if available */}
              {stats.catalogItems && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon sx={{ fontSize: '0.875rem' }} />
                  {stats.catalogItems} curated
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                {stats.brandCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Brands
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {stats.categories.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Categories
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Kategori oversikt med ikoner */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <CategoryIcon sx={{ color: '#FFA726' }} />
                Utstyrskategorier
              </Typography>
              <Grid container spacing={2}>
                {stats.categories.map((category) => (
                  <Grid item xs={6} sm={4} md={2} key={category}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: 'grey.50',
                        transition: 'all 0.2s',
                        cursor: 'pointer','&:hover': {
                          backgroundColor: 'grey.100',
                          transform: 'translateY(-2px)'
                        }
                      }}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {getCategoryIcon(category)}
                      <Typography 
                        variant="body2" 
                        sx={{ mt: 1, textAlign: 'center', fontWeight: 500}}
                      >
                        {getDisplayCategory(category)}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {stats.yearRange.max - stats.yearRange.min + 1}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Year Range
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderOverviewPanel = () => (
    <>
      {renderDatabaseStats()}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InventoryIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  Inventarkontekst
                </Typography>
                <Badge color="primary" badgeContent={inventoryContext.length} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {inventoryContextLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : inventoryContext.length > 0 ? (
                <List dense>
                  {inventoryContext.slice(0, 4).map((item: any) => (
                    <ListItem key={item.id || item.name}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `${theming.colors.primary}15`, color: theming.colors.primary }}>
                          <InventoryIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.name || `${item.brand || ''} ${item.model || ''}`.trim() || 'Utstyr'}
                        secondary={item.category || 'Ukjent kategori'}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info" icon={<InfoIcon />}>
                  Logg inn og koble inventaret ditt for å se hvilke databasefunn som matcher eget utstyr.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>
        </Grid>
        <Grid item xs={12} md={6}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SpecIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  Datakvalitet
                </Typography>
                <Badge color="secondary" badgeContent={gearData.length} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Alert severity={gearData.length > 0 ? 'success' : 'warning'} icon={gearData.length > 0 ? <CheckCircleIcon /> : <WarningIcon />}>
                  {gearData.length > 0
                    ? `Søket har returnert ${gearData.length} treff med strukturert metadata.`
                    : 'Ingen treff lastet ennå. Kjør et søk eller start innsamling for å bygge opp datagrunnlaget.'}
                </Alert>
                <Alert severity={authenticImages.length > 0 ? 'success' : 'info'} icon={authenticImages.length > 0 ? <CameraIcon /> : <InfoIcon />}>
                  {authenticImages.length > 0
                    ? `${authenticImages.length} produkter har verifiserte bilder fra produsentkilder.`
                    : 'Ingen verifiserte produsentbilder er lastet i denne økten ennå.'}
                </Alert>
                {collectionProgress && (
                  <Alert severity="info" icon={<InfoIcon />}>
                    {collectionProgress}
                  </Alert>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </>
  );

  const renderImageCoveragePanel = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraIcon />
            Bildekilder og verifikasjon
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={loadingImages ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleAuthenticImageCheck}
            disabled={loadingImages}
          >
            Oppdater bilder
          </Button>
        </Box>

        {authenticImages.length > 0 ? (
          <Grid container spacing={2}>
            {authenticImages.map((image) => (
              <Grid item xs={12} md={6} key={`${image.brand}-${image.model}`}>
                <ListItem
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    alignItems: 'flex-start',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={image.thumbnail || image.sampleImage || undefined}
                      sx={{ bgcolor: `${theming.colors.primary}10` }}
                    >
                      <CameraIcon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${image.brand} ${image.model}`}
                    secondary={`${getDisplayCategory(image.category)} · ${image.source}`}
                  />
                  <Chip
                    label={image.imageFound ? 'Verifisert' : 'Mangler bilde'}
                    color={image.imageFound ? 'success' : 'warning'}
                    size="small"
                  />
                </ListItem>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info" icon={<ErrorIcon />}>
            Ingen produsentbilder er lastet ennå. Kjør «Se Database Bilder» for å verifisere bildedekning.
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, ...databaseChromeSx }}>
      <Card
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: { xs: 4, md: 5 },
          borderColor: `${theming.colors.primary}24`,
          background: `radial-gradient(circle at top right, ${theming.colors.primary}18, transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))`,
        }}
      >
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12} lg={7}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.75} alignItems="flex-start">
                <Box
                  sx={{
                    width: { xs: 54, md: 62 },
                    height: { xs: 54, md: 62 },
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${theming.colors.primary}22, ${theming.colors.primary}0f)`,
                    color: theming.colors.primary,
                  }}
                >
                  <BuildIcon sx={{ fontSize: '2rem' }} />
                </Box>
                <Box>
                  <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 800 }}>
                    Omfattende Utstyr Database
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Komplett katalog med produsentbilder, spesifikasjoner, datakvalitet og firmware-/bildedekning samlet i én operativ databaseflate.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`${stats?.totalItems?.toLocaleString?.() || 0} produkter`} variant="outlined" size="small" />
                <Chip label={`${stats?.brandCount || availableBrands.length} merker`} variant="outlined" size="small" />
                <Chip label={`${authenticImages.length} verifiserte bilder`} color={authenticImages.length > 0 ? 'success' : 'default'} size="small" />
                <Chip label={inventoryContext.length > 0 ? 'Inventarkontekst aktiv' : 'Inventarkontekst venter'} size="small" variant="outlined" />
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<DownloadIcon />}
                onClick={startComprehensiveCollection}
                disabled={isCollecting}
              >
                {isCollecting ? 'Samler data...' : 'Start datainnsamling'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchDatabaseStats}
                disabled={isCollecting}
              >
                Oppdater stats
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<CategoryIcon />}
                onClick={async () => {
                  try {
                    const response = await fetch('/api/equipment/category-icons/generate', {
                      headers: {
                        'Content-Type' : 'application/json'
                      },
                      method: 'POST'
                    });
                    const data = await response.json();
                    if (data.success) {
                      debugging.logIntegration('info', 'Category icons generated successfully', data);
                      setCollectionProgress('Kategori-ikonene ble regenerert for denne databasen');
                  }
                } catch (error) {
                    debugging.logIntegration('error', 'Error generating category icons', error);
                }
              }}
                disabled={isCollecting}
              >
                Generer kategori-ikoner
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {isCollecting && (
          <Box sx={{ mt: 2.5 }}>
            <LinearProgress sx={{ borderRadius: 999, height: 8 }} />
            <Typography variant="body2" sx={{ mt: 1.25 }}>
              {collectionProgress}
            </Typography>
          </Box>
        )}
      </Card>

      {/* Database Statistics */}
      {renderDatabaseStats()}

      {/* Search and Filter Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 700 }}>
            <SearchIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Søk og Filtrer
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Søk etter modell"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Produsent</InputLabel>
                <Select
                  value={selectedBrand}
                  label="Produsent"
                  onChange={(e) => setSelectedBrand(e.target.value)}
                >
                  <MenuItem value="">Alle produsenter</MenuItem>
                  {availableBrands.map((brand) => (
                    <MenuItem key={brand} value={brand}>
                      {brand}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Kategori"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <MenuItem value="">Alle kategorier</MenuItem>
                  <MenuItem value="Kameraer">Kameraer</MenuItem>
                  <MenuItem value="Objektiver">Objektiver</MenuItem>
                  <MenuItem value="Blits">Blits</MenuItem>
                  <MenuItem value="Lys">Belysning</MenuItem>
                  <MenuItem value="Lyd">Lydutstyr</MenuItem>
                  <MenuItem value="Stativer">Stativer</MenuItem>
                  <MenuItem value="Tilbehør">Tilbehør</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>År</InputLabel>
                <Select
                  value={selectedYear}
                  label="År"
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  <MenuItem value="">Alle år</MenuItem>
                  {Array.from({ length: 7 }, (_, i) => 2025 - i).map((year) => (
                    <MenuItem key={year} value={year.toString()}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {/* Google Search Integration Status */}
          <Box sx={{ mt: 3, p: 2.25, border: '1px solid rgba(34,197,94,0.24)', borderRadius: 3, bgcolor: 'rgba(240,253,244,0.95)' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ fontSize: '1.25rem' }} />
              Google Images Integration Aktiv
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Søkesystemet henter automatisk ekte produktbilder fra Canon.no, Sony.no, Nikon.no og andre offisielle nettsider når du søker i databasen nedenfor.
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
            <Button 
              variant="contained"
              onClick={handleSearch}
            >
              Søk Database
            </Button>
            <Button
              variant="outlined"
              onClick={clearFilters}
              size="small"
            >
              Nullstill filtre
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={handleAuthenticImageCheck}
              size="small"
              disabled={loadingImages}
              startIcon={loadingImages ? <CircularProgress size={16} /> : <CameraIcon />}
            >
              {loadingImages ? 'Henter bilder...' : 'Se Database Bilder'}
            </Button>
            <Button
              variant="outlined"
              color="info"
              onClick={async () => {
                setLoadingImages(true);
                // Searching Google for firmware updates
                const testProducts = [
                  { brand: 'Canon', model: 'EOS R', category: 'camera'},
                  { brand: 'Sony', model: 'A7R', category: 'camera'},
                  { brand: 'Nikon', model: 'Z', category: 'camera'},
                  { brand: 'Profoto', model: 'B1', category: 'lighting'},
                  { brand: 'Rode', model: 'VideoMic Pro', category: 'audio'}
                ];
                
                try {
                  const firmwarePromises = testProducts.map(async (product) => {
                    try {
                      const response = await fetch(`/api/google/firmware/${product.brand}/${product.model}`);
                      const data = await response.json();
                      
                      if (data.success && data.result) {
                        return data.result;
                    }
                      return null;
                  } catch (error) {
                      debugging.logIntegration('warn', 'Firmware search failed for product', {
                        product,
                        error,
                      });
                      return null;
                  }
                });

                  const results = await Promise.all(firmwarePromises);
                  const validResults = results.filter(result => result !== null);
                  
                  validResults.forEach(result => {
                    if (result.firmwareFound) {
                      debugging.logIntegration('info', 'Firmware info found', result);
                }
                });
                  
                  const summary = `Firmware søk fullført: ${validResults.length}/${testProducts.length} produkter har tilgjengelig firmware`;
                  setFirmwareSearchSummary(summary);
                  alert(summary);
              } catch (error) {
                  debugging.logIntegration('error', 'Google firmware search failed', error);
              } finally {
                  setLoadingImages(false);
              }
            }}
              size="small"
              disabled={loadingImages}
              startIcon={loadingImages ? <CircularProgress size={16} /> : <UpdateIcon />}
            >
              {loadingImages ? 'Søker firmware...' : 'Søk Firmware'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, p: 1, background: 'rgba(255,255,255,0.9)' }}>
        <CardContent sx={{ pb: '8px !important', px: 1.25, pt: 1.25 }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value) => setActiveTab(value)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              minHeight: 56,
              '& .MuiTabs-flexContainer': {
                gap: 0.75,
              },
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 3,
                px: 1.5,
                border: '1px solid transparent',
              },
              '& .MuiTab-root.Mui-selected': {
                color: theming.colors.primary,
                backgroundColor: `${theming.colors.primary}14`,
                borderColor: `${theming.colors.primary}24`,
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: 999,
              },
            }}
          >
            <Tab label="Oversikt" />
            <Tab label={<Badge color="primary" badgeContent={gearData.length}>Resultater</Badge>} />
            <Tab label={<Badge color="secondary" badgeContent={authenticImages.length}>Bilder</Badge>} />
          </Tabs>
        </CardContent>
      </Card>

      {activeTab === 0 && renderOverviewPanel()}

      {activeTab === 1 && (
        <>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : gearData.length > 0 ? (
            <>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {gearData.length} resultater funnet
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {currentItems.map(renderGearCard)}
              </Grid>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={(_event, value) => setCurrentPage(value)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          ) : searchQuery || selectedBrand || selectedCategory || selectedYear ? (
            <Alert severity="info">
              Ingen resultater funnet for dine søkekriterier. Prøv å justere filtrene.
            </Alert>
          ) : (
            <Alert severity="info">
              Bruk søk eller filtrer for å finne utstyr, eller start datainnsamling for å fylle databasen.
            </Alert>
          )}
        </>
      )}

      {activeTab === 2 && (
        <>
          {renderImageCoveragePanel()}
          {firmwareSearchSummary && (
            <Alert severity="info" icon={<UpdateIcon />} sx={{ mb: 3 }}>
              {firmwareSearchSummary}
            </Alert>
          )}
        </>
      )}

      {/* Item Details Dialog */}
      <Dialog
        open={showDetails}
        onClose={closeItemDetails}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: databaseDialogPaperSx }}
      >
        {selectedItem && (
          <>
            <DialogTitle
              sx={{
                px: 3,
                pt: 3,
                pb: 2,
                borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                background: `linear-gradient(135deg, ${theming.colors.primary}14, rgba(248,250,252,0.95))`,
              }}
            >
              {selectedItem.model} - {selectedItem.brand}
            </DialogTitle>
            <DialogContent sx={{ px: 3, py: 2.5 }}>
              {selectedItem.images && selectedItem.images.length > 0 && (
                <Box sx={{ mb: 2.5, borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(248,250,252,0.94), rgba(241,245,249,0.76))', p: 2 }}>
                  <img
                    src={selectedItem.images[0]}
                    alt={selectedItem.model}
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }}
                  />
                </Box>
              )}
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Produsent: {selectedItem.brand}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Kategori: {getDisplayCategory(selectedItem.category)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Utgivelsesår: {selectedItem.releaseYear}
                  </Typography>
                </Grid>
                
                {Object.keys(selectedItem.specifications).length > 0 && (
                  <Grid item xs={12}>
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SpecIcon color="primary" />
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            Spesifikasjoner
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <List dense>
                          {Object.entries(selectedItem.specifications).map(([key, value]) => (
                            <ListItem key={key}>
                              <ListItemText primary={key} secondary={String(value)} />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
                
                {selectedItem.images && selectedItem.images.length > 1 && (
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          Flere bilder
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {selectedItem.images.slice(1).map((image, index) => (
                            <img
                              key={index}
                              src={image}
                              alt={`${selectedItem.model} ${index + 2}`}
                              style={{ width: 100, height: 100, objectFit: 'contain', border: '1px solid #ddd' }}
                            />
                          ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
              <Button onClick={closeItemDetails} variant="contained">
                Lukk
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Autentiske produktbilder galleri */}
      <Dialog 
        open={showImageGallery}
        onClose={() => setShowImageGallery(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: databaseDialogPaperSx }}
      >
        <DialogTitle
          sx={{
            px: 3,
            pt: 3,
            pb: 2,
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
            background: `linear-gradient(135deg, rgba(34,197,94,0.14), rgba(248,250,252,0.95))`,
          }}
        >
          <Typography variant="h5" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ fontSize: '1.5rem', color: 'success.main' }} />
            Autentiske produktbilder fra offisielle nettsider
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Fant {authenticImages.length}/5 ekte bilder fra produsentnettsider med høy tillitsscore
          </Typography>
          
          <Grid container spacing={3}>
            {authenticImages.map((image, index) => {
              const sourceUrl = image.officialUrl || image.sampleImage;
              const sourceHostname = getExternalHostname(sourceUrl);

              return (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card sx={{ height: '100%' }}>
                  <Box
                    sx={{
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#f5f5f5',
                      border: '2px dashed #FFA726',
                      borderRadius: '8px',
                      flexDirection: 'column',
                      gap: 1
                }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ color: '#FFA726', fontSize: '1.5rem' }} />
                      <Typography variant="h6" sx={{ color: '#FFA726', fontWeight: 'bold' }}>
                        AUTENTISK BILDE
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', px: 2 }}>
                      Ekte produktbilde fra {sourceHostname}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999', textAlign: 'center' }}>
                      {image.confidence ? `${(image.confidence * 100).toFixed(0)}% tillitsscore` : 'Bekreftet autentisk'}
                    </Typography>
                  </Box>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {image.brand} {image.model}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Kategori: {getDisplayCategory(image.category)}
                    </Typography>
                    <Chip 
                      label={`${(image.confidence * 100).toFixed(0)}% tillitsscore`}
                      color="success"
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <br />
                    <Chip 
                      label={image.source === 'official_norwegian' ? 'Norsk nettsted' : 'Internasjonal'}
                      color={image.source === 'official_norwegian' ? 'primary' : 'secondary'}
                      size="small"
                    />
                    {sourceUrl && (
                      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="caption" display="block">
                          Kilde: {sourceHostname}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => {
                            const targetUrl = normalizeExternalUrl(sourceUrl);
                            if (targetUrl) {
                              window.open(targetUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          sx={{ fontSize:'0.7rem', py: 0.5 }}
                        >
                          Se ekte bilde på {sourceHostname}
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
            })}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid rgba(15, 23, 42, 0.08)' }}>
          <Button onClick={() => setShowImageGallery(false)} variant="contained">
            Lukk galleri
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComprehensiveGearDatabase;
