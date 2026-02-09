import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid2 as Grid,
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
  useTheme,
  alpha,
  Badge,
  InputAdornment,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Extension,
  CloudDownload,
  Category,
  Search,
  Print,
  AudioFile,
  Brush,
  Code,
  ThreeDRotation,
  ViewInAr,
  ZoomIn,
  ZoomOut,
  Add,
  Edit,
  Delete
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';

// Extend JSX namespace for Three.js elements (used dynamically)
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      boxGeometry: any;
      planeGeometry: any;
      icosahedronGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Three.js imports
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, Sphere } from '@react-three/drei';

interface UniversalVendorShowcaseProps {
  vendorType: 'print' | 'audio' | 'design' | 'software' | 'hardware';
  vendorName: string;
  userId: string;
  viewMode?: 'public' | 'admin'
}

interface VendorProduct {
  id: string;
  name: string;
  vendor: string;
  category: string;
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
  screenshots?: string[];
  model3dUrl?: string; // URL to 3D model (.glb/.gltf)
}

// ============== THREE.JS COMPONENTS ==============

// Animated floating shape for hero section
function FloatingShape({ color, position, scale = 1 }: { color: string; position: [number, number, number]; scale?: number }) {
  const meshRef = useRef<any>(null);

  useFrame((state: any) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  if (!THREE || !Sphere) return null;

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={color}
        metalness={0.8}
        roughness={0.2}
        emissive={color}
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}

// Product 3D Model Viewer
function Product3DViewer({ color }: { modelUrl?: string; color: string }) {
  const meshRef = useRef<any>(null);
  const autoRotate = true;

  useFrame((state: any) => {
    if (meshRef.current && autoRotate) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  if (!THREE) return null;

  // If no model, show placeholder box
  return (
    <group ref={meshRef}>
      <mesh>
        <boxGeometry args={[1.5, 1, 0.3]} />
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      {/* Product label */}
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[1.2, 0.6]} />
        <meshBasicMaterial color="#ffffff" opacity={0.9} transparent />
      </mesh>
    </group>
  );
}

// 3D Hero Scene for vendor showcase
function HeroScene3D({ color }: { vendorType: string; color: string }) {
  if (!THREE || !Canvas) return null;

  const shapes = [
    { position: [-2, 0, -1] as [number, number, number], scale: 0.5 },
    { position: [2, 1, -2] as [number, number, number], scale: 0.7 },
    { position: [0, -1, -1.5] as [number, number, number], scale: 0.4 },
    { position: [-1.5, 1.5, -2] as [number, number, number], scale: 0.3 },
    { position: [1.5, -0.5, -1] as [number, number, number], scale: 0.6 },
  ];

  return (
    <Box sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.6,
      pointerEvents: 'none'
    }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
        <pointLight position={[-5, 5, 5]} intensity={0.5} color={color} />

        {shapes.map((shape, i) => (
          <FloatingShape
            key={i}
            color={color}
            position={shape.position}
            scale={shape.scale}
          />
        ))}
      </Canvas>
    </Box>
  );
}

// Interactive Product 3D Preview in Dialog
function ProductPreview3D({ product, color }: { product: VendorProduct; color: string }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoom, setZoom] = useState(3);

  if (!THREE || !Canvas) {
    return (
      <Box sx={{
        height: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
        borderRadius: 2
      }}>
        <Typography color="text.secondary">3D Preview ikke tilgjengelig</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{
        height: 300,
        bgcolor: '#1a1a2e',
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${color}30`
      }}>
        <Canvas camera={{ position: [0, 0, zoom], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, 5, 5]} intensity={0.3} color={color} />

          <Product3DViewer modelUrl={product.model3dUrl} color={color} />

          {OrbitControls && (
            <OrbitControls
              enableZoom={true}
              enablePan={false}
              autoRotate={autoRotate}
              autoRotateSpeed={2}
              minDistance={2}
              maxDistance={8}
            />
          )}
        </Canvas>
      </Box>

      {/* 3D Controls */}
      <Box sx={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        display: 'flex',
        gap: 0.5,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 1,
        p: 0.5
      }}>
        <IconButton
          size="small"
          onClick={() => setAutoRotate(!autoRotate)}
          sx={{ color: autoRotate ? color : 'white' }}
        >
          <ThreeDRotation fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => setZoom(Math.max(2, zoom - 0.5))}
          sx={{ color: 'white' }}
        >
          <ZoomIn fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => setZoom(Math.min(8, zoom + 0.5))}
          sx={{ color: 'white' }}
        >
          <ZoomOut fontSize="small" />
        </IconButton>
      </Box>

      {/* 3D Badge */}
      <Chip
        icon={<ViewInAr />}
        label="3D Visning"
        size="small"
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          bgcolor: color,
          color: 'white',
          fontWeight: 60
        }}
      />
    </Box>
  );
}

// ============== END THREE.JS COMPONENTS ==============

// Vendor type configurations
const vendorTypeConfigs = {
  print: {
    name: 'Print & Design',
    color: '#e91e60',
    icon: <Print />,
    categories: [
      { value: 'templates', label: 'Maler', icon: <Brush /> },
      { value: 'fonts', label: 'Fonter', icon: <Code /> },
      { value: 'graphics', label: 'Grafikk', icon: <Brush /> },
      { value: 'mockups', label: 'Mockups', icon: <ViewInAr /> },
      { value: 'presets', label: 'Presets', icon: <Category /> }
    ],
    examples: ['NorthTone Design','Nordic Print Solutions','Scandinavian Templates']
  },
  audio: {
    name: 'Audio & Music',
    color: '#9c27b0',
    icon: <AudioFile />,
    categories: [
      { value: 'plugins', label: 'Plugins', icon: <Extension /> },
      { value: 'samples', label: 'Samples', icon: <AudioFile /> },
      { value: 'presets', label: 'Presets', icon: <Category /> },
      { value: 'loops', label: 'Loops', icon: <AudioFile /> },
      { value: 'software', label: 'Software', icon: <Code /> }
    ],
    examples: ['Norsk Musikk Plugins','Arctic Audio','Nordic Sound Design']
  },
  design: {
    name: 'Design & Creative',
    color: '#ff5720',
    icon: <Brush />,
    categories: [
      { value: 'brushes', label: 'Pensler', icon: <Brush /> },
      { value: 'textures', label: 'Teksturer', icon: <Category /> },
      { value: 'actions', label: 'Actions', icon: <Code /> },
      { value: 'filters', label: 'Filtre', icon: <Category /> },
      { value: 'overlays', label: 'Overlays', icon: <Category /> }
    ],
    examples: ['Creative Norway','Nordic Design Co','Fjord Graphics']
  },
  software: {
    name: 'Software & Tools',
    color: '#2196f0',
    icon: <Code />,
    categories: [
      { value: 'applications', label: 'Applikasjoner', icon: <Code /> },
      { value: 'extensions', label: 'Utvidelser', icon: <Extension /> },
      { value: 'scripts', label: 'Scripts', icon: <Code /> },
      { value: 'utilities', label: 'Verktøy', icon: <Category /> },
      { value: 'libraries', label: 'Bibliotek', icon: <Category /> }
    ],
    examples: ['Nordic Software','Scandinavian Tech','Arctic Dev Tools']
  },
  hardware: {
    name: 'Hardware & Equipment',
    color: '#795540',
    icon: <ViewInAr />,
    categories: [
      { value: 'cameras', label: 'Kameraer', icon: <ViewInAr /> },
      { value: 'lenses', label: 'Objektiver', icon: <ViewInAr /> },
      { value: 'audio', label: 'Audio', icon: <AudioFile /> },
      { value: 'lighting', label: 'Lys', icon: <Category /> },
      { value: 'accessories', label: 'Tilbehør', icon: <Category /> }
    ],
    examples: ['Nordic Gear','Scandinavian Equipment','Arctic Hardware']
  }
};

export default function UniversalVendorShowcase({
  vendorType,
  vendorName,
  userId,
  viewMode = 'public'
}: UniversalVendorShowcaseProps) {
  useTheme();

  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedProduct, setSelectedProduct] = useState<VendorProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);

  // CRUD state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<VendorProduct> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [isSaving, setIsSaving] = useState(false);

  const config = vendorTypeConfigs[vendorType];

  // Fetch vendor products for showcase
  const { data: showcaseProducts = [] } = useQuery({
    queryKey: ['/api/universal-vendor-showcase', vendorType, vendorName, selectedCategory, searchQuery, sortBy],
    queryFn: () => apiRequest(`/api/universal-vendor-showcase/${vendorType}/${vendorName}?category=${selectedCategory}&search=${searchQuery}&sort=${sortBy}`)
});

  // Fetch vendor showcase stats
  const { data: showcaseStats } = useQuery({
    queryKey: ['/api/universal-vendor-showcase-stats', vendorType, vendorName],
    queryFn: () => apiRequest(`/api/universal-vendor-showcase-stats/${vendorType}/${vendorName}`)
});

  const categories = [
    { value: 'all', label: 'Alle Produkter', icon: theming.getThemedIcon(',') },
    ...config.categories
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
      console.log(`📦 Starting download for ${product.name} from ${vendorName}`);
      // Track download in database
      await apiRequest(`/api/universal-vendor-showcase/product/${product.id}/download`, {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          userAgent: navigator.userAgent
        })
      });
      // Trigger actual download if downloadUrl exists
      if (product.downloadUrl) {
        window.open(product.downloadUrl, '_blank');
      }
      setSnackbar({ open: true, message: `Nedlasting, startet: ${product.name}`, severity: 'success' });
      // Refresh products to update download count
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase'] });
    } catch (error) {
      console.error('Download failed:', error);
      setSnackbar({ open: true, message: 'Nedlasting feilet', severity: 'error' });
    }
  };

  // CRUD Operations
  const handleOpenCreateDialog = () => {
    setEditingProduct({
      name: '',
      vendor: vendorName,
      category: 'all',
      version: '1.0.0',
      price: 0,
      currency: 'NOK',
      description: '',
      downloads: 0,
      rating: 0,
      reviews: 0,
      tags: [],
      featured: false,
      status: 'active',
      releaseDate: new Date().toISOString()
    });
    setIsCreating(true);
    setShowEditDialog(true);
  };

  const handleOpenEditDialog = (product: VendorProduct) => {
    setEditingProduct({ ...product });
    setIsCreating(false);
    setShowEditDialog(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    setIsSaving(true);
    try {
      if (isCreating) {
        // Create new product
        await apiRequest('/api/universal-vendor-showcase/product', {
          method: 'POST',
          body: JSON.stringify({
            ...editingProduct,
            vendorId: `vendor_${vendorName.toLowerCase().replace(/\s+/g, '_, ')}`,
            vendorName: vendorName,
            productType: vendorType
          })
        });
        setSnackbar({ open: true, message: 'Produkt opprettet!', severity: 'success' });
      } else {
        // Update existing product
        await apiRequest(`/api/universal-vendor-showcase/product/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingProduct)
        });
        setSnackbar({ open: true, message: 'Produkt oppdatert!', severity: 'success' });
      }

      // Refresh products list
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase'] });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase-stats'] });
      setShowEditDialog(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Save failed:', error);
      setSnackbar({ open: true, message: 'Lagring feilet', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette produktet?')) return;

    try {
      await apiRequest(`/api/universal-vendor-showcase/product/${productId}`, {
        method: 'DELETE'
      });
      setSnackbar({ open: true, message: 'Produkt slettet!', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase'] });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase-stats'] });
    } catch (error) {
      console.error('Delete failed:', error);
      setSnackbar({ open: true, message: 'Sletting feilet', severity: 'error' });
    }
  };

  const handleToggleFeatured = async (product: VendorProduct) => {
    try {
      await apiRequest(`/api/universal-vendor-showcase/product/${product.id}/featured`, {
        method: 'PATCH',
        body: JSON.stringify({ featured: !product.featured })
      });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-vendor-showcase'] });
      setSnackbar({
        open: true,
        message: product.featured ? 'Produkt fjernet fra fremhevet' : 'Produkt fremhevet!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Toggle featured failed:', error);
      setSnackbar({ open: true, message: 'Oppdatering feilet', severity: 'error' });
    }
  };

  const filteredProducts = showcaseProducts.filter((product: VendorProduct) => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
});

  return (
    <Box sx={{ p:  3 }}>
      {/* Universal Vendor Showcase Header with 3D Background */}
      <Box sx={{
        mb: 4,
        position: 'relative',
        minHeight: Canvas ? 200 : 'auto',
        borderRadius: 3,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}05 100%)`,
        border: `1px solid ${config.color}20`,
        p: 3
      }}>
        {/* 3D Hero Background */}
        <HeroScene3D vendorType={vendorType} color={config.color} />

        <Box sx={{ position: 'relative', zIndex: 1}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{
              bgcolor: config.color,
              width: 64,
              height: 64,
              fontSize: '1.8rem',
              boxShadow: `0 4px 20px ${config.color}40`
            }}>
              {config.icon}
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{
                fontWeight: 700,
                color: theming.colors.primary,
                display: 'flex',
                alignItems: 'center',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {vendorName}
                {Canvas && (
                  <Chip
                    icon={<ViewInAr />}
                    label="3D"
                    size="small"
                    sx={{
                      ml: 2,
                      bgcolor: config.color,
                      color: 'white',
                      fontWeight: 60
                    }}
                  />
                )}
              </Typography>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {config.name} • Profesjonelle verktøy og ressurser
              </Typography>
            </Box>
            {viewMode === 'admin' && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleOpenCreateDialog}
                sx={{
                  ml: 'auto',
                  bgcolor: config.color, '&:hover': { bgcolor: alpha(config.color, 0.8) },
                  ...theming.getThemedButtonSx()
                }}
              >
                Legg til produkt
              </Button>
            )}
          </Box>

          {/* Vendor Type Badge */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={config.name}
              sx={{
                bgcolor: `${config.color}15`,
                color: config.color,
                fontWeight: 600,
                borderRadius: 2
              }}
            />
            {Canvas && (
              <Chip
                icon={<ThreeDRotation />}
                label="Interaktiv 3D Showcase"
                size="small"
                variant="outlined"
                sx={{
                  borderColor: config.color,
                  color: config.color
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Showcase Stats */}
      {showcaseStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              textAlign: 'center',
              bgcolor: `${config.color}10`,
              border: `1px solid ${config.color}30`,
              height: '100%',
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.totalProducts || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Totale Produkter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              textAlign: 'center',
              bgcolor: `${config.color}08`,
              border: `1px solid ${config.color}20`,
              height: '100%',
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.totalDownloads || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Totale Downloads
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              textAlign: 'center',
              bgcolor: `${config.color}08`,
              border: `1px solid ${config.color}20`,
              height: '100%',
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.averageRating?.toFixed(1) || '0.0'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Gjennomsnittlig Rating
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{
              textAlign: 'center',
              bgcolor: `${config.color}15`,
              border: `1px solid ${config.color}30`,
              height: '100%',
              ...theming.getThemedCardSx()
            }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {showcaseStats.featuredProducts || 0}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Fremhevede Produkter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filter and Search Controls */}
      <Card sx={{ mb: 4, p: 3, border: `1px solid ${config.color}20`, ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              placeholder="Søk produkter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: 'text.secondary' }} /></InputAdornment>
                }
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                label="Kategori"
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {cat.icon}
                      {cat.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
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
          <Grid size={{ xs: 12, md: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {filteredProducts.length} produkter funnet
              </Typography>
              <Badge
                badgeContent={filteredProducts.filter((p: VendorProduct) => p.featured).length}
                color="primary"
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: config.color
                  }
                }}
              >
                <Chip
                  label="Fremhevet"
                  size="small"
                  sx={{
                    bgcolor: `${config.color}15`,
                    color: config.color
                  }}
                />
              </Badge>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Product Showcase Grid */}
      <Grid container spacing={3}>
        <AnimatePresence>
          {filteredProducts.map((product: VendorProduct, index: number) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={product.id}>
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
                  border: `1px solid ${config.color}30`, '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: `0 12px 28px ${config.color}25`,
                    borderColor: config.color
                  },
                  transition: 'all 0.3s ease',
                  ...theming.getThemedCardSx()
                }}
                onClick={() => handleProductClick(product)}
              >
                  {/* Featured Badge */}
                  {product.featured && (
                    <Chip
                      label="Fremhevet"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (viewMode === 'admin') handleToggleFeatured(product);
                      }}
                      sx={{
                        position: 'absolute',
                        top:  8,
                        right: viewMode === 'admin' ? 90 : 8,
                        zIndex: 1,
                        bgcolor: config.color,
                        color: 'white',
                        fontWeight: 600,
                        cursor: viewMode === 'admin' ? 'pointer' : 'default'
                      }}
                    />
                  )}

                  {/* Admin Controls */}
                  {viewMode === 'admin' && (
                    <Box sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      display: 'flex',
                      gap: 0.5
                    }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditDialog(product);
                        }}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.9)',
                          '&:hover': { bgcolor: 'white' }
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(product.id);
                        }}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.9)',
                          '&:hover': { bgcolor: 'white', color: 'error.main' }
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  )}

                  {/* Product Image */}
                  <CardMedia
                    component="div"
                    sx={{
                      height: 200,
                      background: product.imageUrl
                        ? `url(${product.imageUrl}) center/cover`
                        : `linear-gradient(135deg, ${config.color}40 0%, ${config.color}20 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...theming.getThemedCardSx()
                    }}
                  >
                    {!product.imageUrl && (
                      <Avatar sx={{
                        width: 64,
                        height: 64,
                        bgcolor: config.color,
                        fontSize: '2rem'
                      }}>
                        {config.icon}
                      </Avatar>
                    )}
                  </CardMedia>

                  <CardContent sx={{ flexGrow: 1, p: 2,...theming.getThemedCardSx() }}>
                    {/* Product Info */}
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, lineHeight: 1.2, color: theming.colors.primary }}>
                      {product.name}
                    </Typography>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      {product.vendor} • v{product.version}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{
                        mb: 2,
                        height: 40,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {product.description}
                    </Typography>

                    {/* Rating and Downloads */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Rating value={product.rating} readOnly size="small" />
                        <Typography variant="caption">
                          ({product.reviews})
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CloudDownload sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="caption">
                          {product.downloads}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Tags */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                      {product.tags.slice(0, 2).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{
                            bgcolor: `${config.color}15`,
                            color: config.color,
                            fontSize: '0.7rem',
                            height: 20
                          }}
                        />
                      ))}
                    </Box>

                    {/* Price and Actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                        {product.price === 0 ? 'Gratis' : `${product.price} ${product.currency}`}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadProduct(product);
                          }}
                          sx={{ color: config.color }}
                        >
                          {theming.getThemedIcon('download')}
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
                  bgcolor: config.color,
                  width:  48,
                  height: 48 }}>
                  {config.icon}
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
              {/* 3D Product Preview */}
              <Box sx={{ mb: 3 }}>
                <ProductPreview3D product={selectedProduct} color={config.color} />
              </Box>

              <Typography variant="body1" sx={{ mb:  3 }}>
                {selectedProduct.description}
              </Typography>

              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Pris
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                    {selectedProduct.price === 0 ? 'Gratis' : `${selectedProduct.price} ${selectedProduct.currency}`}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Vurdering
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Rating value={selectedProduct.rating} readOnly />
                    <Typography variant="body2">
                      ({selectedProduct.reviews} anmeldelser)
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions>
              <Button onClick={() => setShowProductDialog(false)}>
                Lukk
              </Button>
              <Button
                variant="contained"
                startIcon={theming.getThemedIcon('download')}
                onClick={() => {
                  handleDownloadProduct(selectedProduct);
                  setShowProductDialog(false);
                }}
                sx={{
                  bgcolor: config.color, '&:hover': {
                    bgcolor: alpha(config.color, 0.8)
                  },
                  ...theming.getThemedButtonSx()
                }}
              >
                Last ned
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Edit/Create Product Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isCreating ? 'Opprett nytt produkt' : 'Rediger produkt'}
        </DialogTitle>
        <DialogContent>
          {editingProduct && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Produktnavn"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={editingProduct.category || 'all'}
                    label="Kategori"
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  >
                    {config.categories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Versjon"
                  value={editingProduct.version || '1.0.0'}
                  onChange={(e) => setEditingProduct({ ...editingProduct, version: e.target.value })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Pris"
                  type="number"
                  value={editingProduct.price || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Valuta</InputLabel>
                  <Select
                    value={editingProduct.currency || 'NOK'}
                    label="Valuta"
                    onChange={(e) => setEditingProduct({ ...editingProduct, currency: e.target.value })}
                  >
                    <MenuItem value="NOK">NOK</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Beskrivelse"
                  multiline
                  rows={3}
                  value={editingProduct.description || ', '}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Bilde URL"
                  value={editingProduct.imageUrl || ', '}
                  onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Nedlastings URL"
                  value={editingProduct.downloadUrl || ', '}
                  onChange={(e) => setEditingProduct({ ...editingProduct, downloadUrl: e.target.value })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="Demo URL"
                  value={editingProduct.demoUrl || ', '}
                  onChange={(e) => setEditingProduct({ ...editingProduct, demoUrl: e.target.value })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  fullWidth
                  label="3D Modell URL (.glb/.gltf)"
                  value={editingProduct.model3dUrl || ', '}
                  onChange={(e) => setEditingProduct({ ...editingProduct, model3dUrl: e.target.value })}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Tags (kommaseparert)"
                  value={(editingProduct.tags || []).join('')}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    tags: e.target.value.split(', ').map(t => t.trim()).filter(t => t)
                  })}
                  helperText="Skriv inn tags separert med komma"
                />
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editingProduct.status || 'active'}
                    label="Status"
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value as 'active' | 'coming_soon' | 'discontinued' })}
                  >
                    <MenuItem value="active">Aktiv</MenuItem>
                    <MenuItem value="coming_soon">Kommer snart</MenuItem>
                    <MenuItem value="discontinued">Utgått</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={editingProduct.featured || false}
                      onChange={(e) => setEditingProduct({ ...editingProduct, featured: e.target.checked })}
                    />
                  }
                  label="Fremhevet produkt"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProduct}
            disabled={isSaving || !editingProduct?.name}
            startIcon={isSaving ? <CircularProgress size={16} /> : null}
            sx={{
              bgcolor: config.color,
              '&:hover': { bgcolor: alpha(config.color, 0.8) }
            }}
          >
            {isSaving ? 'Lagrer...' : (isCreating ? 'Opprett' : 'Lagre')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width:'100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}