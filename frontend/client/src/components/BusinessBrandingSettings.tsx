import { useTheming } from '../utils/theming-helper';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid2,
  Avatar,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Business as BusinessIcon,
  Preview as PreviewIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import debounce from 'lodash/debounce';
import { apiRequest } from '../lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useAuth } from '../hooks/useAuth';

interface BusinessInfo {
  businessName?: string;
  email?: string;
  phone?: string;
  businessAddress?: string;
  organizationNumber?: string;
  website?: string;
  vatNumber?: string;
  tagline?: string;
  brandingColor?: string;
  customLogo?: string;
  businessDescription?: string; // From onboarding
}

interface BusinessBrandingSettingsProps {
  userId: string;
}

const BusinessBrandingSettings: React.FC<BusinessBrandingSettingsProps> = ({ 
  userId
}) => {
  // Get user and profession context
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const userProfession = user?.profession || 'photographer';
  
  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    brandingColor: professionConfig?.iconColor || '#ff8c00'
});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmDeleteLogo, setConfirmDeleteLogo] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({ open: false, message: '', severity: 'info' });

  const queryClient = useQueryClient();

  // Fetch existing business info with profession context
  const { data: existingInfo, isLoading } = useQuery({
    queryKey: ['/api/branding/business-info,', userId, userProfession],
    queryFn: () => apiRequest(`/api/branding/business-info?userId=${userId}&profession=${userProfession}`),
    enabled: !!userId
});

  // Load existing data when available
  useEffect(() => {
    if (existingInfo?.businessInfo) {
      setBusinessInfo(existingInfo.businessInfo);
      if (existingInfo.businessInfo.customLogo) {
        setPreviewUrl(existingInfo.businessInfo.customLogo);
    }
  }
}, [existingInfo]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg','image/png','image/svg+xml','image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setSnackbar({ open: true, message: 'Kun JPEG, PNG, SVG og WebP filer er tillatt', severity: 'error' });
        return;
    }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({ open: true, message: 'Filen må være mindre enn 5MB', severity: 'error' });
        return;
    }

      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
  }
};

  // Upload logo mutation
  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('userId', userId);

      const response = await fetch('/api/branding/upload-logo', {
        method: 'POST',
        body: formData
  });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Logo-opplasting mislyktes');
    }

      return response.json();
  },
    onSuccess: (data) => {
      setPreviewUrl(data.logoUrl);
      setSelectedFile(null);
      // Invalidate both branding and onboarding profile queries to sync data
      queryClient.invalidateQueries({ queryKey: ['/api/branding/business-info', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/profile', userId] });
  }
});

  // Update business info mutation with profession context
  const businessInfoMutation = useMutation({
    mutationFn: async (info: BusinessInfo) => {
      return apiRequest(`/api/branding/business-info/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...info, profession: userProfession }),
        headers: {
          'Content-Type' : 'application/json'
    }
    });
  },
    onSuccess: () => {
      // Invalidate both branding and onboarding profile queries to sync data
      queryClient.invalidateQueries({ queryKey: ['/api/branding/business-info', userId, userProfession] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/profile', userId] });
  }
});

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/branding/logo/${userId}`, {
        method: 'DELETE'
  });
  },
    onSuccess: () => {
      setPreviewUrl(null);
      setBusinessInfo(prev => ({ ...prev, customLogo: undefined }));
      // Invalidate both branding and onboarding profile queries to sync data
      queryClient.invalidateQueries({ queryKey: ['/api/branding/business-info', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/profile', userId] });
  }
});

  // Debounced auto-save for color changes to provide real-time updates
  const debouncedColorUpdate = useCallback(
    debounce(async (color: string) => {
      try {
        await businessInfoMutation.mutateAsync({ ...businessInfo, brandingColor: color });
    } catch (error) {
        console.error('Failed to auto-save color: ', error);
    }
  }, 1000),
    [businessInfo, businessInfoMutation]
  );

  const handleInputChange = (field: keyof BusinessInfo) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setBusinessInfo(prev => ({
      ...prev,
      [field]: value
  }));
    
    // Auto-save color changes with debounce
    if (field === 'brandingColor') {
      debouncedColorUpdate(value);
  }
};

  const handleUploadLogo = () => {
    if (selectedFile) {
      logoUploadMutation.mutate(selectedFile);
  }
};

  const handleSaveBusinessInfo = () => {
    businessInfoMutation.mutate(businessInfo);
};

  const handleDeleteLogo = () => {
    setConfirmDeleteLogo(true);
  };

  const executeDeleteLogo = () => {
    deleteLogoMutation.mutate();
    setConfirmDeleteLogo(false);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
}

  return (
    <Box sx={{ maxWidth: 1200, margin: 'auto', padding: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
        <BusinessIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
        {professionConfig ? `${professionConfig.displayName} - Bedriftsprofil og Branding` : 'Bedriftsprofil og Branding'}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Last opp logo og oppdater bedriftsinformasjon som vil brukes i alle {professionConfig ? professionConfig.displayName.toLowerCase() : 'profesjonelle'}-kontrakter og dokumenter.
      </Typography>
      {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}

      <Grid2 container spacing={4}>
        {/* Logo Upload Section */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: 'fit-content', ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
              <UploadIcon sx={{ mr: 1 }} />
              Bedriftslogo
            </Typography>

            <Box sx={{ mb:  3, textAlign: 'center'}}>
              <Avatar
                src={previewUrl || undefined}
                sx={{
                  width: 10,
                  height: 10,
                  margin: 'auto',
                  backgroundColor: businessInfo.brandingColor || '#ff8c00',
                  fontSize: '48px'
            }}
              >
                {businessInfo.businessName?.[0] || 'L'}
              </Avatar>
            </Box>

            <input
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              style={{ display: 'none'}}
              id="logo-file-input"
              type="file"
              onChange={handleFileSelect}
            />
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center'}}>
              <label htmlFor="logo-file-input">
                <Button variant="outlined" component="span" startIcon={<UploadIcon />}>
                  Velg Logo
                </Button>
              </label>

              {selectedFile && (
                <Button variant="contained"
                  onClick={handleUploadLogo}
                  disabled={logoUploadMutation.isPending}
                  sx={{ backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67e00' }, ...theming.getThemedButtonSx() }}>
                  {logoUploadMutation.isPending ? <CircularProgress size={20} /> : 'Last Opp'}
                </Button>
              )}

              {previewUrl && !selectedFile && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDeleteLogo}
                  disabled={deleteLogoMutation.isPending}
                  startIcon={<DeleteIcon />}
                >
                  Slett Logo
                </Button>
              )}
            </Box>

            {selectedFile && (
              <Alert severity="info" sx={{ mt:  2 }}>
                Fil valgt: {selectedFile.name}
                <br />
                Størrelse: {(selectedFile.size / 1024 / 1024).toFixed()} MB
              </Alert>
            )}

            <Typography variant="caption" display="block" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary'}}>
              Tillatte formater: JPG, PNG, SVG, WebP (maks 5MB)
            </Typography>
          </Paper>
        </Grid2>

        {/* Business Information Section */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
              <BusinessIcon sx={{ mr: 1 }} />
              Bedriftsinformasjon
            </Typography>

            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Bedriftsnavn"
                  value={businessInfo.businessName || ''}
                  onChange={handleInputChange('businessName')}
                  required
                />
              </Grid2>

              <Grid2 size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Tagline"
                  value={businessInfo.tagline || ''}
                  onChange={handleInputChange('tagline')}
                  placeholder="f.eks. 'Profesjonell fotografering for spesielle øyeblikk', "
                />
              </Grid2>

              <Grid2 size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Bedriftsbeskrivelse"
                  value={businessInfo.businessDescription || ', '}
                  onChange={handleInputChange('businessDescription')}
                  multiline
                  rows={3}
                  placeholder="Beskriv din virksomhet og tjenester..."
                  helperText="Denne beskrivelsen kan brukes i kontrakter og på din profil"
                />
              </Grid2>

              <Grid2 size={{ xs:  12, sm:  6 }}>
                <TextField
                  fullWidth
                  label="E-post"
                  type="email"
                  value={businessInfo.email || ', '}
                  onChange={handleInputChange('email')}
                  required
                />
              </Grid2>

              <Grid2 size={{ xs:  12, sm:  6 }}>
                <TextField
                  fullWidth
                  label="Telefonnummer"
                  value={businessInfo.phone || ', '}
                  onChange={handleInputChange('phone')}
                  required
                />
              </Grid2>

              <Grid2 size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Forretningsadresse"
                  value={businessInfo.businessAddress || ', '}
                  onChange={handleInputChange('businessAddress')}
                  multiline
                  rows={2}
                />
              </Grid2>

              <Grid2 size={{ xs:  12, sm:  6 }}>
                <TextField
                  fullWidth
                  label="Organisasjonsnummer"
                  value={businessInfo.organizationNumber || ', '}
                  onChange={handleInputChange('organizationNumber')}
                />
              </Grid2>

              <Grid2 size={{ xs:  12, sm:  6 }}>
                <TextField
                  fullWidth
                  label="MVA-nummer"
                  value={businessInfo.vatNumber || ', '}
                  onChange={handleInputChange('vatNumber')}
                />
              </Grid2>

              <Grid2 size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Nettside"
                  type="url"
                  value={businessInfo.website || ', '}
                  onChange={handleInputChange('website')}
                  placeholder="https: //www.dinside.no"
                />
              </Grid2>

              <Grid2 size={{ xs: 12, sm:  6 }}>
                <TextField
                  fullWidth
                  label="Merkevare-farge"
                  type="color"
                  value={businessInfo.brandingColor || '#ff8c00'}
                  onChange={handleInputChange('brandingColor')}
                />
              </Grid2>

              <Grid2 size={{ xs:  12, sm:  6 }}>
                <Box sx={{ pt:  2 }}>
                  <Chip 
                    label={businessInfo.brandingColor || '#ff8c00'}
                    sx={{ 
                      backgroundColor: businessInfo.brandingColor || '#ff8c00',
                      color: 'white'
                }}
                  />
                </Box>
              </Grid2>
            </Grid2>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="contained"
                onClick={handleSaveBusinessInfo}
                disabled={businessInfoMutation.isPending}
                sx={{ backgroundColor: '#ff8c00', '&:hover': { backgroundColor: '#e67e00' }, ...theming.getThemedButtonSx() }}>
                {businessInfoMutation.isPending ? <CircularProgress size={20} /> : 'Lagre Informasjon'}
              </Button>
            </Box>
          </Paper>
        </Grid2>

        {/* Preview Section */}
        <Grid2 size={{ xs: 12 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center' }}>
                <PreviewIcon sx={{ mr:  1 }} />
                Forhåndsvisning Kontrakthode
              </Typography>
              
              <Divider sx={{ my:  2 }} />
              
              <Box sx={{ 
                p:  3, 
                backgroundColor: 'rgba(25, 1400.05)',
                borderRadius:  2,
                border: `2px solid ${businessInfo.brandingColor || '#ff8c00'}20`
            }}>
                <Grid2 container spacing={3} alignItems="center">
                  <Grid2>
                    {previewUrl ? (
                      <img 
                        src={previewUrl}
                        alt="Bedriftslogo" 
                        style={{ width:  80, height:  80, objectFit: 'contain'}}
                      />
                    ) : (
                      <Avatar
                        sx={{
                          width:  80,
                          height:  80,
                          backgroundColor: businessInfo.brandingColor || '#ff8c00',
                          fontSize: '32px'
                    }}
                      >
                        {businessInfo.businessName?.[0] || 'B'}
                      </Avatar>
                    )}
                  </Grid2>
                  
                  <Grid2 sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                      {businessInfo.businessName || 'Ditt Bedriftsnavn'}
                    </Typography>
                    {businessInfo.tagline && (
                      <Typography variant="body2" color="text.secondary">
                        {businessInfo.tagline}
                      </Typography>
                    )}
                    <Box sx={{ mt:  1 }}>
                      <Typography variant="body2">
                        📧 {businessInfo.email ||'din@email.no'}
                        {businessInfo.phone && ` • 📱 ${businessInfo.phone}`}
                      </Typography>
                      {businessInfo.website && (
                        <Typography variant="body2" color="primary">
                          🌐 {businessInfo.website}
                        </Typography>
                      )}
                    </Box>
                  </Grid2>
                </Grid2>
              </Box>

              <Alert severity="info" sx={{ mt:  2 }}>
                Slik vil bedriftsinformasjonen din se ut i kontrakter og andre profesjonelle dokumenter.
              </Alert>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>

      {/* Success/Error Messages */}
      {logoUploadMutation.isError && (
        <Alert severity="error" sx={{ mt:  2 }}>
          Feil ved opplasting: {logoUploadMutation.error?.message}
        </Alert>
      )}

      {logoUploadMutation.isSuccess && (
        <Alert severity="success" sx={{ mt:  2 }}>
          Logo lastet opp!
        </Alert>
      )}

      {businessInfoMutation.isError && (
        <Alert severity="error" sx={{ mt:  2 }}>
          Feil ved lagring av bedriftsinformasjon
        </Alert>
      )}

      {businessInfoMutation.isSuccess && (
        <Alert severity="success" sx={{ mt:  2 }}>
          Bedriftsinformasjon lagret!
        </Alert>
      )}

      {/* Confirm Delete Logo Dialog */}
      <Dialog open={confirmDeleteLogo} onClose={() => setConfirmDeleteLogo(false)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette logoen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteLogo(false)}>Avbryt</Button>
          <Button onClick={executeDeleteLogo} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BusinessBrandingSettings;