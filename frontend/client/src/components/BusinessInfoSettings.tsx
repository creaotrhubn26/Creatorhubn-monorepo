/**
 * Business Information Settings Component
 * Allows users to set up their business branding for contracts and documents
 */

// import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Avatar,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  OutlinedInput,
  Chip,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Language as WebsiteIcon,
  Numbers as OrgNumberIcon,
  PhotoCamera as PhotoIcon,
  Palette as ColorIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Description,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useExternalData } from '../services/ExternalDataService';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';

interface BusinessInfo {
  businessName: string;
  email: string;
  phone: string;
  businessAddress: string;
  organizationNumber: string;
  website: string;
  customLogo: string;
  brandingColor: string;
  tagline: string;
  businessStatus?: string;
}

interface BusinessInfoSettingsProps {
  userId?: string;
  onUpdate?: (businessInfo: BusinessInfo) => void;
}

export default function BusinessInfoSettings({
  userId = 'session-user,',
  onUpdate,
}: BusinessInfoSettingsProps) {
  // Get user and profession context
  const { user } = useAuth();
  
  // ⭐ Enhanced Master Integration
  const { lifecycle, analytics, performance, debugging, dataFlow } = useEnhancedMasterIntegration();
  
  // Theming system
  // const theming = useTheming('photographer,');
  const theming = { colors: { primary: '#1976d2' } };
  const userProfession = user?.profession || 'photographer';
  
  // External Data Service integration for address validation
  const { 
    getKartverketAddress,
    searchKartverketPlaceNames,
    validatePostalCode,
    getBRREGCompanyData
} = useExternalData();

  // Register component with Master Integration
  React.useEffect(() => {
    lifecycle.registerComponent({
      id: 'BusinessInfoSettings',
      type: 'settings',
      version: '1.0.0',
      capabilities: {
        data: ['businessInfo','logo','branding'],
        events: ['info:updated','logo:uploaded','validation:completed'],
        actions: ['save','upload','validate','autofill'],
        ui: ['form','preview','validation'],
        system: ['brreg-integration','address-validation','image-upload']
      },
      dependencies: ['external-data-service','theming-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    // Track component opened
    analytics.trackEvent('business_info_settings_opened', {
      userId,
      profession: userProfession,
      hasExistingInfo: !!existingInfo
    });

    return () => {
      lifecycle.unregisterComponent('BusinessInfoSettings');
    };
  }, []);

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const professionConfig = professionConfigs?.[userProfession];

  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  // Address validation state
  const [addressValidation, setAddressValidation] = useState<any>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [postalCodeValidation, setPostalCodeValidation] = useState<any>(null);
  
  // BRREG auto-fill state
  const [brregLoading, setBrregLoading] = useState(false);
  const [brregData, setBrregData] = useState<any>(null);
  
  // Form validation state
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof BusinessInfo, string>>>({});
  const [imageError, setImageError] = useState<string>('');
  
  // ⭐ Business lifecycle management state
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<string>('active');

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    businessName: '',
    email: '',
    phone: '',
    businessAddress: '',
    organizationNumber: '',
    website: '',
    customLogo: '',
    brandingColor: '#ff8c00',
    tagline: '',
});

  // Address validation functions
  const validateAddress = async (address: string) => {
    if (!address || address.length < 5) return;
    
    setAddressLoading(true);
    try {
      const addressData = await getKartverketAddress(address);
      setAddressValidation(addressData);
  } catch (error) {
      console.warn('Address validation failed: ', error);
      setAddressValidation(null);
  } finally {
      setAddressLoading(false);
  }
};

  const searchAddressSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
  }
    
    try {
      const suggestions = await searchKartverketPlaceNames(query);
      setAddressSuggestions(suggestions.slice(0, 5)); // Limit to 5 suggestions
  } catch (error) {
      console.warn('Address search failed:', error);
      setAddressSuggestions([]);
  }
};

  const validatePostalCodeInput = async (postalCode: string) => {
    if (!postalCode || postalCode.length !== 4) return;
    
    try {
      const validation = await validatePostalCode(postalCode);
      setPostalCodeValidation(validation);
  } catch (error) {
      console.warn('Postal code validation failed:', error);
      setPostalCodeValidation(null);
  }
};

  // Fetch existing business information with profession context
  const { data: existingInfo, isLoading, refetch } = useQuery({
    queryKey: ['/api/onboarding/business-info', userId, userProfession],
    queryFn: () =>
      apiRequest(`/api/onboarding/business-info/${userId}?profession=${userProfession}`),
    retry: false,
    refetchInterval: 60000,        // ⭐ Poll every 60 seconds
    refetchOnWindowFocus: true,    // ⭐ Refetch when tab becomes active
    staleTime: 30000,              // ⭐ Consider data stale after 30 seconds
});

  // Update business information mutation with profession context
  const updateBusinessInfo = useMutation({
    mutationFn: async (data: BusinessInfo) => {
      return apiRequest(`/api/onboarding/business-info/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...data,
          profession: userProfession,
        })
    });
  },
    onSuccess: (updatedInfo) => {
      console.log('✅ Business information updated successfully, ');
      setIsEditing(false);
      queryClient.invalidateQueries({
        queryKey: ['/api/onboarding/business-info', userId, userProfession],
    });
      
      // ⭐ Broadcast update to other tabs
      if (typeof window !== 'undefined') {
        const channel = new BroadcastChannel('business-info-sync');
        channel.postMessage({
          type: 'business-info-updated',
          userId,
          timestamp: Date.now()
        });
        channel.close();
      }
      
      if (onUpdate) {
        onUpdate(updatedInfo);
    }
  },
    onError: (error) => {
      console.error('❌ Failed to update business information:', error);
  },
});

  // Upload logo mutation
  const uploadLogo = useMutation({
    mutationFn: async (logoData: { logoBase64: string; fileName: string }) => {
      return apiRequest(`/api/onboarding/upload-logo/${userId}`, {
        method: 'POST',
        body: JSON.stringify(logoData)
      });
  },
    onSuccess: (result) => {
      console.log('✅ Logo uploaded successfully');
      setBusinessInfo((prev) => ({ ...prev, customLogo: result.logoUrl }));
      setLogoFile(null);
      setLogoPreview('');
  },
    onError: (error) => {
      console.error('❌ Failed to upload logo:', error);
  },
});

  // Initialize with existing data
  useEffect(() => {
    if (existingInfo) {
      setBusinessInfo(existingInfo);
      if (existingInfo.customLogo && existingInfo.customLogo !== '/default-logo.png') {
        setLogoPreview(existingInfo.customLogo);
    }
      
      // ⭐ Track business status
      setBusinessStatus((existingInfo as any).businessStatus || 'active');
    
      analytics.trackEvent('business_info_loaded', {
        userId,
        hasData: !!existingInfo.businessName,
        businessStatus: existingInfo.businessStatus || 'active',
        source: 'auto_refresh'
      });
  }
}, [existingInfo]);

  // ⭐ Listen for onboarding completion events from Master Integration
  React.useEffect(() => {
    const communication = {
      subscribe: (
        _event: string,
        _callback: (payload: { userId?: string }) => void,
      ) => () => {},
    };
    
    // Subscribe to onboarding completion
    const unsubscribeOnboarding = communication.subscribe('onboarding:completed', (data: { userId?: string }) => {
      debugging.logIntegration('info', 'Onboarding completed - refreshing business info', { userId });
      
      // Trigger immediate refresh
      refetch();
      
      analytics.trackEvent('business_info_auto_refreshed', {
        userId,
        trigger: 'onboarding_completed',
        source: data.userId === userId ? 'master_integration_same_user' : 'master_integration'
      });
    });
    
    return () => {
      if (typeof unsubscribeOnboarding === 'function') {
        unsubscribeOnboarding();
      }
    };
  }, [refetch]);
  
  // ⭐ Cross-Tab Sync with BroadcastChannel
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const channel = new BroadcastChannel('business-info-sync');
    
    channel.onmessage = (event) => {
      if (event.data.type === 'business-info-updated' && event.data.userId === userId) {
        debugging.logIntegration('info','Business info updated in another tab - refreshing', { userId });
        
        // Trigger immediate refresh
        refetch();
        
        analytics.trackEvent('business_info_cross_tab_sync', {
          userId,
          trigger: 'other_tab_update'
        });
      }
    };
    
    return () => {
      channel.close();
    };
  }, [userId, refetch]);

  const handleInputChange = (field: keyof BusinessInfo, value: string) => {
    setBusinessInfo((prev) => ({ ...prev, [field]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Track field edits
    analytics.trackEvent('business_info_field_edited', {
      field,
      hasValue: !!value,
      userId
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // ⭐ Validate image file
    const error = validateImageFile(file);
    if (error) {
      setImageError(error);
      analytics.trackEvent('image_upload_validation_failed', { 
        error, 
        fileSize: file.size, 
        fileType: file.type 
      });
      return;
    }
    
    setImageError('');
    setLogoFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      
      analytics.trackEvent('logo_preview_generated', {
        fileName: file.name,
        fileSize: file.size
      });
    };
    reader.readAsDataURL(file);
  };

  // ⭐ BRREG Auto-Fill
  const fetchBRREGData = async (orgNumber: string) => {
    if (!orgNumber || orgNumber.replace(/\s/g, ', ').length !== 9) return;
    
    const endTiming = performance.startTiming('fetch_brreg_data');
    setBrregLoading(true);
    
    try {
      const data = await getBRREGCompanyData(orgNumber);
      setBrregData(data);
      
      // Auto-fill business information
      if (data) {
        const address = data.businessAddress 
          ? `${data.businessAddress.adresse}, ${data.businessAddress.postnummer} ${data.businessAddress.poststed}`
          : '';
        
        setBusinessInfo(prev => ({
          ...prev,
          businessName: prev.businessName || data.name,
          businessAddress: prev.businessAddress || address,
          organizationNumber: orgNumber,
          website: prev.website || data.website || ''
        }));
        
        analytics.trackEvent('brreg_autofill_success', {
          orgNumber,
          companyName: data.name
        });
        
        debugging.logIntegration('info','BRREG data fetched successfully', {
          orgNumber,
          companyName: data.name
        });
      }
    } catch (error) {
      debugging.logIntegration('error','BRREG fetch failed', { error, orgNumber });
      analytics.trackEvent('brreg_autofill_failed', { error: (error as Error).message, orgNumber });
    } finally {
      setBrregLoading(false);
      endTiming();
    }
  };

  // ⭐ Form Validation
  const validateEmail = (email: string): string => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Ugyldig e-postadresse';
  };

  const validatePhone = (phone: string): string => {
    if (!phone) return '';
    const phoneRegex = /^(\+47)?[2-9]\d{7}$/;
    const cleaned = phone.replace(/\s/g, '');
    return phoneRegex.test(cleaned) ? '' : 'Ugyldig telefonnummer (bruk +47 eller 8 siffer)';
  };

  const validateOrgNumber = (orgNumber: string): string => {
    if (!orgNumber) return '';
    const cleaned = orgNumber.replace(/\s/g, '');
    if (cleaned.length !== 9) return 'Organisasjonsnummer må være 9 siffer';
    if (!/^\d+$/.test(cleaned)) return 'Organisasjonsnummer må kun inneholde tall';
    return '';
  };

  const validateImageFile = (file: File): string => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return 'Bildet er for stort. Maks størrelse er 5MB';
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Filen må være et bilde';
    }
    
    return ', ';
  };
  
  // ⭐ Handle business cancellation
  const handleBusinessCancellation = async () => {
    if (!confirmCancellation) return;
    
    const endTiming = performance.startTiming('cancel_business');
    
    try {
      debugging.logIntegration('info','Business cancellation initiated', {
        userId,
        reason: cancellationReason
      });
      
      // Call cancellation API
      const response = await apiRequest(`/api/business-lifecycle/cancel/${userId}`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cancellationReason,
          requestedBy: 'user',
          organizationNumber: businessInfo.organizationNumber
        })
      });
      
      if (response.success) {
        // Track cancellation
        analytics.trackEvent('business_cancelled', {
          userId,
          reason: cancellationReason,
          hasOngoingProjects: false // TODO: Check from API
        });
        
        // Trigger data export
        await handleDataExport();
        
        // Refresh to show new status
        queryClient.invalidateQueries({
          queryKey: ['/api/onboarding/business-info', userId, userProfession],
        });
        
        // Broadcast to other tabs
        if (typeof window !== 'undefined') {
          const channel = new BroadcastChannel('business-info-sync');
          channel.postMessage({
            type: 'business-cancelled',
            userId,
            timestamp: Date.now()
          });
          channel.close();
        }
        
        setShowCancellationDialog(false);
        setCancellationReason('');
        setConfirmCancellation(false);
      }
    } catch (error) {
      debugging.logIntegration('error','Business cancellation failed', { error, userId });
      analytics.trackEvent('business_cancellation_failed', { error: (error as Error).message });
    } finally {
      endTiming();
    }
  };
  
  // ⭐ GDPR Data Export
  const handleDataExport = async () => {
    try {
      debugging.logIntegration('info','GDPR data export initiated', { userId });
      
      const response = await apiRequest(`/api/business-lifecycle/export-data/${userId}`, {
        method: 'GET'
      });
      
      // Create download link
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `creatorhub-data-${userId}-${new Date().toISOString()}.json`;
      link.click();
      
      analytics.trackEvent('gdpr_data_exported', {
        userId,
        dataSize: dataBlob.size,
        exportDate: new Date().toISOString()
      });
    } catch (error) {
      debugging.logIntegration('error','Data export failed', { error, userId });
    }
  };

  const handleSave = async () => {
    const endTiming = performance.startTiming('save_business_info');
    
    try {
      // Validate before saving
      const errors: Partial<Record<keyof BusinessInfo, string>> = {
        email: validateEmail(businessInfo.email),
        phone: validatePhone(businessInfo.phone),
        organizationNumber: validateOrgNumber(businessInfo.organizationNumber)
      };
      
      const hasErrors = Object.values(errors).some(err => err !== ', ');
      if (hasErrors) {
        setValidationErrors(errors);
        analytics.trackEvent('business_info_validation_failed', { errors });
        return;
      }
      
      // Upload logo first if there's a new one
      if (logoFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const logoBase64 = e.target?.result as string;
          await uploadLogo.mutateAsync({
            logoBase64,
            fileName: logoFile.name,
        });
      };
        reader.readAsDataURL(logoFile);
    }

      // Update business information
      await updateBusinessInfo.mutateAsync(businessInfo);
      
      // Track successful save
      analytics.trackEvent('business_info_saved', {
        userId,
        profession: userProfession,
        hasLogo: !!businessInfo.customLogo,
        fields: Object.keys(businessInfo).filter(k => businessInfo[k as keyof BusinessInfo])
      });
      
      debugging.logIntegration('info','Business information saved', {
        userId,
        businessName: businessInfo.businessName
      });
      
      // Sync with data flow
      dataFlow.syncData('BusinessInfoSettings:businessInfo', businessInfo);
      
  } catch (error) {
      debugging.logIntegration('error', 'Failed to save business info', { error, userId });
      analytics.trackEvent('business_info_save_failed', { error: (error as Error).message });
      console.error('Error saving business information:', error);
  } finally {
      endTiming();
  }
};

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>
            Laster {professionConfig ? professionConfig.displayName.toLowerCase() : 'bedrifts'}
            informasjon...
          </Typography>
        </CardContent>
      </Card>
    );
}

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto' }}>
      <CardContent>
        {/* ⭐ Business Status Alert */}
        {businessStatus !== 'active' && (
          <Alert 
            severity={
              businessStatus === 'bankrupt' ? 'error' :
              businessStatus === 'suspended' ? 'warning' :
              businessStatus === 'cancelled' || businessStatus === 'pending_closure' ? 'info' : 'warning'
            }
            sx={{ mb: 3 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {businessStatus === 'bankrupt' && '🚨 Bedriften er registrert som konkurs'}
              {businessStatus === 'suspended' && '⚠️ Bedriften er midlertidig suspendert'}
              {businessStatus === 'cancelled' && 'ℹ️ Bedriften er avsluttet'}
              {businessStatus === 'pending_closure' && '📝 Bedriften er under avslutning'}
            </Typography>
            
            <Typography variant="body2" sx={{ mt: 1 }}>
              {(existingInfo as any)?.businessStatusReason || 'Ingen årsak oppgitt'}
            </Typography>
            
            {(existingInfo as any)?.businessStatusChangedAt && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Endret: {new Date((existingInfo as any).businessStatusChangedAt).toLocaleDateString('no-NO')} 
                {', '}av {(existingInfo as any).businessStatusChangedBy || 'system'}
              </Typography>
            )}
            
            {(existingInfo as any)?.dataRetentionUntil && (
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'error.main', fontWeight: 600}}>
                ⏰ Data slettes permanent: {new Date((existingInfo as any).dataRetentionUntil).toLocaleDateString('no-NO')}
              </Typography>
            )}
            
            {businessStatus === 'active' ? null : (
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleDataExport}
                sx={{ mt: 2 }}
                startIcon={<SaveIcon />}
              >
                Eksporter all data (GDPR)
              </Button>
            )}
          </Alert>
        )}
      
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <BusinessIcon sx={{ mr: 2, color: businessInfo.brandingColor }} />
          <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }}>
            {professionConfig
              ? `${professionConfig.displayName} - Bedriftsinformasjon`
              : 'Bedriftsinformasjon'}
          </Typography>
          {!isEditing && businessStatus === 'active' && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsEditing(true)}
              sx={{ ml: 'auto' }}
            >
              Rediger
            </Button>
          )}
          {businessStatus === 'active' && (
            <Tooltip title="Avslutt bedrift">
              <IconButton
                onClick={() => setShowCancellationDialog(true)}
                sx={{ ml: businessStatus === 'active' && !isEditing ? 1 : 'auto', color: 'error.main' }}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Denne informasjonen brukes automatisk i alle{''}
          {professionConfig ? professionConfig.displayName.toLowerCase() : 'profesjonelle'}
          -kontrakter og dokumenter. CreatorHub Norge er kun plattformen - dine dokumenter viser din
          bedrift.
        </Alert>
        {professionsLoading && <Typography>Laster profesjonsdata...</Typography>}

        {/* Logo Upload Section */}
        <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(25, 118, 210, 0.05)' }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Bedriftslogo
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar
                src={logoPreview || businessInfo.customLogo}
                sx={{
                  width: 80,
                  height: 80,
                  backgroundColor: businessInfo.brandingColor
              }}
              >
                <BusinessIcon />
              </Avatar>
            </Grid>
            <Grid item xs>
              {isEditing && (
                <Box>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="logo-upload"
                    type="file"
                    onChange={handleLogoUpload}
                  />
                  <label htmlFor="logo-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<UploadIcon />}
                      size="small"
                    >
                      Last opp logo
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Maks 5MB • JPG, PNG eller GIF
                  </Typography>
                  {logoFile && (
                    <Chip
                      label={`${logoFile.name} (${(logoFile.size / 1024).toFixed(0)}KB)`}
                      onDelete={() => {
                        setLogoFile(null);
                        setLogoPreview('');
                        setImageError('');
                        analytics.trackEvent('logo_removed', { fileName: logoFile.name });
                    }}
                      sx={{ ml: 1 }}
                      color="success"
                    />
                  )}
                  {imageError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {imageError}
                    </Alert>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          {/* Business Name */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Bedriftsnavn"
              value={businessInfo.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon />
                  </InputAdornment>
                )
            }}
              placeholder="Ditt Firma AS"
            />
          </Grid>

          {/* Organization Number */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Organisasjonsnummer"
              value={businessInfo.organizationNumber}
              onChange={(e) => handleInputChange('organizationNumber', e.target.value)}
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <OrgNumberIcon />
                  </InputAdornment>
                )
            }}
              placeholder="123 456 789"
              error={!!validationErrors.organizationNumber}
              helperText={validationErrors.organizationNumber}
              onBlur={() => {
                // Validate org number
                const error = validateOrgNumber(businessInfo.organizationNumber);
                setValidationErrors(prev => ({ ...prev, organizationNumber: error }));
                
                // ⭐ Fetch BRREG data if valid
                const orgNumber = businessInfo.organizationNumber.replace(/\s/g, ', ');
                if (orgNumber.length === 9 && !error) {
                  fetchBRREGData(orgNumber);
                  
                  // Also validate postal code
                  const postalCode = orgNumber.substring(0, 4);
                  validatePostalCodeInput(postalCode);
              }
            }}
            />
            
            {/* ⭐ BRREG Auto-Fill Display */}
            {brregLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Henter firmainfo fra BRREG...
                </Typography>
              </Box>
            )}
            
            {brregData && !brregLoading && (
              <Alert severity="success" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  ✅ Firma bekreftet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {brregData.name}
                </Typography>
                {brregData.businessAddress && (
                  <Typography variant="body2" color="text.secondary">
                    {brregData.businessAddress.adresse}, {brregData.businessAddress.postnummer} {brregData.businessAddress.poststed}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  Bransje: {brregData.industry} • Ansatte: {brregData.employees}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Informasjonen er automatisk fylt ut fra Brønnøysundregistrene
                </Typography>
              </Alert>
            )}
            
            {/* Postal Code Validation Display */}
            {postalCodeValidation && !brregData && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  📮 Postnummer bekreftet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {postalCodeValidation.city} ({postalCodeValidation.postalCode})
                </Typography>
                {postalCodeValidation.county && (
                  <Typography variant="body2" color="text.secondary">
                    Fylke: {postalCodeValidation.county}
                  </Typography>
                )}
              </Alert>
            )}
          </Grid>

          {/* Email */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="E-post"
              type="email"
              value={businessInfo.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={!isEditing}
              error={!!validationErrors.email}
              helperText={validationErrors.email}
              onBlur={() => {
                const error = validateEmail(businessInfo.email);
                setValidationErrors(prev => ({ ...prev, email: error }));
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon />
                  </InputAdornment>
                )
            }}
              placeholder="kontakt@dittfirma.no"
            />
          </Grid>

          {/* Phone */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Telefon"
              value={businessInfo.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              disabled={!isEditing}
              error={!!validationErrors.phone}
              helperText={validationErrors.phone}
              onBlur={() => {
                const error = validatePhone(businessInfo.phone);
                setValidationErrors(prev => ({ ...prev, phone: error }));
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                )
            }}
              placeholder="+47 123 45 678"
            />
          </Grid>

          {/* Business Address */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Forretningsadresse"
              value={businessInfo.businessAddress}
              onChange={(e) => {
                handleInputChange('businessAddress', e.target.value);
                searchAddressSuggestions(e.target.value);
            }}
              disabled={!isEditing}
              multiline
              rows={2}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationIcon />
                  </InputAdornment>
                )
            }}
              placeholder="Gateadresse, Postnummer Sted"
              onBlur={() => validateAddress(businessInfo.businessAddress)}
            />
            
            {/* Address Validation Display */}
            {addressLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Validerer adresse...
                </Typography>
              </Box>
            )}
            
            {addressValidation && !addressLoading && (
              <Alert severity="success" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  ✅ Adresse bekreftet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {addressValidation.address}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {addressValidation.postalCode} {addressValidation.city}
                </Typography>
                {addressValidation.coordinates && (
                  <Typography variant="body2" color="text.secondary">
                    Koordinater: {addressValidation.coordinates.lat.toFixed(4)}, {addressValidation.coordinates.lng.toFixed(4)}
                  </Typography>
                )}
              </Alert>
            )}
            
            {/* Address Suggestions */}
            {addressSuggestions.length > 0 && (
              <Paper sx={{ mt: 1, p: 1, maxHeight: 200, overflow: 'auto' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Adresseforslag:
                </Typography>
                {addressSuggestions.map((suggestion, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      p: 1, 
                      cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1
                  }}
                    onClick={() => {
                      setBusinessInfo(prev => ({ 
                        ...prev, 
                        businessAddress: suggestion.address 
                    }));
                      setAddressSuggestions([]);
                      validateAddress(suggestion.address);
                  }}
                  >
                    <Typography variant="body2">
                      {suggestion.address}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {suggestion.postalCode} {suggestion.city}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}
          </Grid>

          {/* Website */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Nettside"
              value={businessInfo.website}
              onChange={(e) => handleInputChange('website', e.target.value)}
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WebsiteIcon />
                  </InputAdornment>
                )
            }}
              placeholder="https://dittfirma.no"
            />
          </Grid>

          {/* Branding Color */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Merkevarefarge"
              type="color"
              value={businessInfo.brandingColor}
              onChange={(e) => handleInputChange('brandingColor', e.target.value)}
              disabled={!isEditing}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ColorIcon />
                  </InputAdornment>
                )
            }}
            />
          </Grid>

          {/* Tagline */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Slagord/Tagline"
              value={businessInfo.tagline}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
              disabled={!isEditing}
              placeholder="Din unike beskrivelse eller slagord"
            />
          </Grid>
        </Grid>

        {/* Action Buttons */}
        {isEditing && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setIsEditing(false);
                setBusinessInfo(existingInfo || businessInfo);
                setLogoFile(null);
                setLogoPreview(', ');
            }}
            >
              Avbryt
            </Button>
            <Button 
              variant="contained"
              onClick={handleSave}
              disabled={updateBusinessInfo.isPending || uploadLogo.isPending}
              startIcon={updateBusinessInfo.isPending ? <CheckIcon /> : <SaveIcon />}
              sx={{ backgroundColor: businessInfo.brandingColor }}
            >
              {updateBusinessInfo.isPending ? 'Lagrer...': 'Lagre endringer'}
            </Button>
          </Box>
        )}

        {/* Preview Section */}
        {!isEditing && businessInfo.businessName && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Forhåndsvisning i kontrakter:
            </Typography>
            <Paper sx={{ p: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
              <Typography variant="body2" component="div">
                <strong>{businessInfo.businessName}</strong>
                <br />
                {businessInfo.organizationNumber && `Org.nr: ${businessInfo.organizationNumber}`}
                <br />
                {businessInfo.email}
                <br />
                {businessInfo.phone}
                <br />
                {businessInfo.businessAddress}
                <br />
                {businessInfo.website}
              </Typography>
            </Paper>
          </Box>
        )}
        
        {/* ⭐ Business Cancellation Dialog */}
        <Dialog 
          open={showCancellationDialog} 
          onClose={() => setShowCancellationDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloseIcon color="error" />
              <Typography variant="h6" color="error">
                Avslutt bedrift på CreatorHub Norge
              </Typography>
            </Box>
          </DialogTitle>
          
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                ⚠️ Viktig informasjon før du avslutter
              </Typography>
              <Typography variant="body2">
                Dette vil deaktivere dine tjenester og starte nedleggelsesprosessen.
                Vi vil beholde dataene dine i 90 dager i henhold til norsk lovgivning og GDPR.
              </Typography>
            </Alert>
            
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 600}}>
              Hva skjer når du avslutter bedriften?
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'info.light' }}>
                    <Typography sx={{ color: 'info.dark', fontWeight: 600}}>1</Typography>
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      Eksporter alle dine data (GDPR)
                    </Typography>
                  }
                  secondary="Du får en fullstendig fil med all data"
                />
              </ListItem>
              
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'warning.light' }}>
                    <Typography sx={{ color: 'warning.dark', fontWeight: 600}}>2</Typography>
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      Avslutt aktive abonnementer
                    </Typography>
                  }
                  secondary="Ingen flere fakturaer"
                />
              </ListItem>
              
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'success.light' }}>
                    <Typography sx={{ color: 'success.dark', fontWeight: 600}}>3</Typography>
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      90 dagers leseaksess
                    </Typography>
                  }
                  secondary="Du kan fortsatt laste ned filer"
                />
              </ListItem>
              
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'error.light' }}>
                    <Typography sx={{ color:'error.dark', fontWeight: 600}}>4</Typography>
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      Permanent sletting etter 90 dager
                    </Typography>
                  }
                  secondary="All data slettes fra våre servere"
                />
              </ListItem>
            </List>
            
            <Divider sx={{ my: 3 }} />
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Årsak til avslutning (valgfritt)"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="F.eks: Nedlegger virksomhet, bytter til annen plattform, etc."
              sx={{ mb: 3 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={confirmCancellation}
                  onChange={(e) => setConfirmCancellation(e.target.checked)}
                  color="error"
                />
              }
              label={
                <Typography variant="body2">
                  <strong>Jeg forstår at dette vil:</strong> Avslutte abonnementer, deaktivere tjenester, 
                  og slette data permanent etter 90 dager.
                </Typography>
              }
            />
          </DialogContent>
          
          <DialogActions sx={{ p: 3 }}>
            <Button 
              onClick={() => {
                setShowCancellationDialog(false);
                setCancellationReason('');
                setConfirmCancellation(false);
              }}
            >
              Avbryt
            </Button>
            <Button 
              variant="contained" 
              color="error"
              onClick={handleBusinessCancellation}
              disabled={!confirmCancellation}
              startIcon={<CloseIcon />}
            >
              Avslutt bedrift
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}
