import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  PhotoCamera,
  VideoLibrary,
  CloudUpload,
  Business,
  Star,
  Visibility,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

interface VendorProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  price: number;
  rating: number;
  views: number
}

interface PowerfulVendorShowcaseProps {
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

export default function PowerfulVendorShowcase({
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
}: PowerfulVendorShowcaseProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('vendor');
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Database connection for PowerfulVendorShowcase
  const { data: vendorData = [], isLoading } = useQuery({
    queryKey: ['/api/vendor','showcase-products'],
    queryFn: () => apiRequest('/api/vendor/showcase-products', ),
    retry: false,
});

  const { data: vendorStats } = useQuery({
    queryKey: ['/api/vendor','stats'],
    queryFn: () => apiRequest('/api/vendor/stats', ),
    retry: false,
});

  // Mutation for updating vendor data
  const updateProduct = useMutation({
    mutationFn: async (productData: any) => {
      return apiRequest('/api/vendor/products', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify(productData)
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor', ],});
      setUploadDialogOpen(false);
  }
});

  const handleFilesSelected = (files: File[]) => {
    console.log('📷 Produktbilder valgt, :', files);
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Produktopplasting fullført, :', results);
    queryClient.invalidateQueries({ queryKey: ['/api/vendor', ],});
};

  const categories = ['Alle', 'Kameraer', 'Objektiver', 'Lys', 'Lyd', 'Tilbehør'];
  

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" gutterBottom sx={{  fontWeight: 'bold' }}>
          Leverandør Showcase
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Vis frem ditt utstyr til fotografer og videografer
        </Typography>
      </Box>

      {/* Stats cards */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('business')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{vendorStats?.totalProducts || 24}</Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Produkter
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('visibility')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{vendorStats?.totalViews || 2847}</Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Visninger
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb:  1 }}>
                {theming.getThemedIcon('star')}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{vendorStats?.avgRating || 4.7}</Typography>
              <Typography variant="body2" color="text.secondary">
                Gjennomsnittsvurdering
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Button variant="contained"
                fullWidth
                startIcon={theming.getThemedIcon('cloudUpload')}
                onClick={() => setUploadDialogOpen(true)}
                sx={{ height: '100%'}}
              >
                Last opp nytt produkt
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Category filter */}
      <Box sx={{ mb:  3 }}>
        {categories.map((category) => (
          <Chip
            key={category}
            label={category}
            onClick={() => setSelectedCategory(category.toLowerCase())}
            variant={selectedCategory === category.toLowerCase() ? 'filled' : 'outlined'}
            sx={{ mr: 1, mb: 1 }}
          />
        ))}
      </Box>

      {/* Products grid */}
      <Grid container spacing={3}>
        {vendorData.map((product: any) => (
          <Grid item xs={12} key={product.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
              <Box
                sx={{
                  height: 20,
                  bgcolor: 'grey.10',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
            }}
              >
                <PhotoCamera sx={{ fontSize:  60, color: 'grey.400'}} />
              </Box>
              <CardContent sx={{ flexGrow:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  {product.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {product.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    {product.price.toLocaleString('no-NO')} kr
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center'}}>
                    <Star sx={{ color: 'gold', fontSize: 18}} />
                    <Typography variant="body2" sx={{ ml: 0.5}}>
                      {product.rating}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {product.views} visninger
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upload dialog */}
      {uploadDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top:  0,
            left:  0,
            right:  0,
            bottom:  0,
            bgcolor: 'blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300}}
        >
          <Card sx={{ maxWidth: 60, width: '90, %', maxHeight: '80vh', overflow: 'auto',  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Last opp nytt produkt</Typography>
                <IconButton onClick={() => setUploadDialogOpen(false)}>
                  ×
                </IconButton>
              </Box>
              
              <UniversalFileUpload
                onFilesSelected={handleFilesSelected}
                onUploadComplete={handleUploadComplete}
                allowedTypes="all"
                maxFiles={10}
                maxFileSizeMB={100}
                enableBackgroundUpload={true}
                maxRetries={3}
                profession="vendor"
                showFormatInfo={true}
                uploadEndpoint="/api/vendor/upload-product"
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mt:  2 }}>
                Støtter alle formater: Bilder, videoer, 3D-modeller, tekniske spesifikasjoner (PDF), og mer
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}