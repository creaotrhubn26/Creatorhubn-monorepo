// @ts-nocheck
/**
 * CreatorHub Norge - Branding Step for Onboarding
 * Integrated with existing onboarding process for logo upload and brand setup
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Button,
  Card as MuiCard,
  CardContent,
  TextField,
  Alert,
  CircularProgress,
  Avatar,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
} from '@mui/material';
import {
  CloudUpload,
  Business,
  Palette,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { apiRequest } from '@/lib/queryClient';
import { UniversalFileUpload } from '../universal/UniversalFileUpload';

const UploadButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
  color: 'white',
  padding: theme.spacing(),
  borderRadius: theme.spacing(),
  border: '2px dashed rgba(255, 255, 255, 0.26)',
  minHeight: '120px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(),
  transition: 'all 0.3s ease', '&:hover': {
    background: 'linear-gradient(135deg, #F7931E 0%, #FF6B35 100%)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(25, 107, 53, 0.3)'
}
}));

const BrandPreviewCard = styled(MuiCard)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.06)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: theme.spacing(),
  padding: theme.spacing(2, ), 
}));

interface BrandingStepProps {
  userId: string;
  profession: string; // Dynamic profession type from useDynamicProfessions
  onComplete: (brandingData: any) => void;
  onSkip: () => void;
  initialData?: {
    businessName?: string;
    logoUrl?: string;
    brandColors?: any;
};
}

const BrandingStep: React.FC<BrandingStepProps> = ({
  userd,
  profession,
  onComplete,
  onSkip,
  initialData
}) => {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(initialData?.logoUrl || '');
  const [businessName, setBusinessName] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [businessName, setBusinessName] = useState(initialData?.businessName || '');
  const [brandDescription, setBrandDescription] = useState('');
  const [selectedColors, setSelectedColors] = useState(initialData?.brandColors || {
    primary: '#FF6B30',
    secondary: '#1a1a10',
    accent: '#F7931E'
});

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest('/api/branding/upload-logo', {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POST',
        body: formData
  });
  },
    onSuccess: (data) => {
      setLogoPreview(data.logoUrl);
      onComplete({
        logoUrl: data.logoUl,
        businessName,
        brandColors: selectedColors,
        brandDescription,
        affectedAreas: data.affectedAreas
  });
  }
});

  const handleFilesSelected = (files: File[]) => {
    console.log('🎨 Logo valgt for branding, :', files);
    if (files.length > 0) {
      const file = files[0];
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
    };
      reader.readAsDataURL(file);
  }
};

  const handleUploadComplete = (results: any[]) => {
    console.log('✅ Logo opplasting fullført, :', results);
    if (results.length > 0) {
      const result = results[0];
      setLogoPreview(result.url || result.logoUrl);
      onComplete({
        logoUrl: result.url || result.logoUl,
        businessName,
        brandColors: selectedColors,
        brandDescription,
        affectedAreas: result.affectedAreas || []
  });
  }
};

  const handleUpload = useCallback(() => {
    if (!logoFile || !businessName.trim()) {
      alert('Vennligst fyll ut firmanavn og velg en logo');
      return;
  }

    const formData = new FormData();
    formData.append('logo', logoFile);
    formData.append('brandName', businessName);
    formData.append('brandDescription', brandDescription);
    formData.append('brandColors', JSON.stringify(selectedColors));

    uploadMutation.mutate(formData);
}, [logoFile, businessName, brandDescription, selectedColors, uploadMutation]);

  const getProfessionBranding = () => {
    const configs = {
      photographer: {
        title: 'Fotograf Branding',
        description: 'Din logo vil vises på alle klient-synlige områder som fotogallerier, leveranser og kontrakter.',
        examples: ['Bryllupsgallerier', 'Porteføljesider','Klientleveranser']
    },
      videographer: {
        title: 'Videograf Branding',
        description: 'Din logo vil vises på videoshowcase, leveringsportaler og alle videorelaterte klientområder.',
        examples: ['Video showcase', 'Leveringsportaler','Klientkommunikasjon']
    },
      music_producer: {
        title: 'Musikkprodusent Branding',
        description: 'Din logo vil vises på musikkportfolio, låtleveranser og alle musikkproduksjon-relaterte områder.',
        examples: ['Musikkportfolio', 'Låtleveranser','Produksjonsoversikter']
    },
      vendor: {
        title: 'Leverandør Branding',
        description: 'Din logo vil vises på produktkataloger, tjenesteoversikter og klientkommunikasjon.',
        examples: ['Produktkataloger', 'Tjenesteoversikter', 'Tilbudsportaler']
    }
  };
    return configs[profession];
};

  const config = getProfessionBranding();

  return (
    <Box sx={{ maxWidth: 80, mx: 'auto', p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{  
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
   }}>
        {config.title}
      </Typography>
      
      <Typography variant="body1" sx={{ mb:  3, color: 'text.secondary'}}>
        {config.description}
      </Typography>

      <Alert severity="info" sx={{ mb:  3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <Info fontSize="small" />
          <Typography variant="body2">
            Din branding påvirker kun områder hvor klientene dine skal se innholdet
          </Typography>
        </Box>
      </Alert>

      <Grid container spacing={3}>
        {/* Logo Upload */}
        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard sx={{ height: '100%'}}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Last opp logo
              </Typography>
              
              {logoPreview && (
                <Box sx={{ textAlign: 'center', mb:  2 }}>
                  <Avatar
                    src={logoPreview}
                    sx={{ width:  80, height:  80, mx: 'auto', mb:  1 }}
                  />
                  <Typography variant="body2" color="success.main">
                    Logo valgt
                  </Typography>
                </Box>
              )}
              
              <UniversalFileUpload
                onFilesSelected={handleFilesSelected}
                onUploadComplete={handleUploadComplete}
                allowedTypes="images"
                maxFiles={1}
                maxFileSizeMB={5}
                enableBackgroundUpload={true}
                maxRetries={3}
                profession="photographer"
                showFormatInfo={true}
                uploadEndpoint="/api/branding/upload-logo"
                profession={profession}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Brand Information */}
        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard sx={{ height: '100%'}}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Brandinginformasjon
              </Typography>
              
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Firmanavn / Merkenavn"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="F.eks. Creatorhub AS"
                  required
                />
                
                <TextField
                  fullWidth
                  label="Kort beskrivelse (valgfritt)"
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                  placeholder="Beskriv din bedrift i noen få ord..."
                  multiline
                  rows={2}
                />
              </Stack>
            </CardContent>
          </MuiCard>
        </Grid>

        {/* Brand Preview */}
        <Grid size={{ xs: 12 }}>
          <BrandPreviewCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Hvor din branding vil vises
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                {config.examples.map((example, index) => (
                  <Chip
                    key={index}
                    label={example}
                    variant="outlined"
                    sx={{ 
                      borderColor: 'rgba(25, 107, 53, 0.5)',
                      color: '#FF6B35'
                }}
                  />
                ))}
              </Stack>
              
              <Typography variant="body2" color="text.secondary">
                Din logo og branding vil automatisk vises på alle disse områdene for å gi klientene dine en profesjonell og sammenhengende opplevelse.
              </Typography>
            </CardContent>
          </BrandPreviewCard>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'space-between'}}>
        <Button
          variant="outlined"
          onClick={onSkip}
          sx={{ minWidth: 120}}
        >
          Hopp over
        </Button>
        
        <Button variant="contained"
          onClick={handleUpload}
          disabled={!logoFile || !businessName.trim() || uploadMutation.isPending}
          startIcon={uploadMutation.isPending ? <CircularProgress size={20} /> : theming.getThemedIcon('checkCircle')}
          sx={{ 
            minWidth: 120,
            background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)'
        }}
        >
          {uploadMutation.isPending ? 'Laster opp...' : 'Fullfør branding'}
        </Button>
      </Box>
    </Box>
  );
};

export default BrandingStep;
