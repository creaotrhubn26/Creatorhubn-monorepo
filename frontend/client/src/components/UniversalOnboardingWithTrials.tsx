// client/src/components/UniversalOnboardingWithTrials.tsx
import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Autocomplete,
  CircularProgress,
  Alert,
  Fade,
  Collapse,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Tab,
  Tabs,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  Radio,
  RadioGroup,
  FormControl as MuiFormControl,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  FlashOn as FlashIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  CloudSync as CloudIcon,
  Share as SocialIcon,
  Palette as BrandingIcon,
  Settings as WorkflowIcon,
  Launch as LaunchIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  AutoAwesome,
  PlayArrow as PlayArrowArrow,
  Upgrade,
  Timer,
  Payment,
  Google,
  CreditCard as CreditDirectionsCard,
  Phone,
  Info,
  MonetizationOn,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Import trial system components
import { TrialFeatureWithPricing } from './common/TrialFeatureWithPricing';
import { TrialActivationDialog } from './common/TrialActivationDialog';
import { pricingService } from '@/services/PricingService';
import { useTrialFeatureIntegration } from '@/contexts/TrialFeatureContext';

// Import dynamic profession system
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';

// Re-export all interfaces from original onboarding
export interface Camera {
  id: string;
  brand: string;
  model: string;
  mount: string;
  type: string;
  firmwareVersion?: string;
  description?: string;
  features: string[];
  compatibility: string[]
}

export interface FlashSystem {
  id: string;
  brand: string;
  model: string;
  type: string;
  compatibility: string[];
  powerOutput?: string;
  features: string[];
  description?: string
}

// Extended onboarding data with trial features
interface OnboardingDataWithTrials {
  profession: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  companyName: string;
  organizationNumber: string;
  businessAddress: string;
  website?: string;
  customLogo?: string;
  selectedCameras: Camera[];
  selectedFlashSystems: FlashSystem[];
  cloudProvider: string;
  socialMediaAccounts: {
    instagram: string;
    facebook: string;
    linkedin: string;
    youtube: string;
    website: string;
};
  brandingSettings: {
    primaryColor: string;
    logo?: File;
    businessType: string;
};
  workflowPreferences: {
    projectTypes: string[];
    communicationStyle: string;
    deliveryPreferences: string[];
};
  // New trial-related fields
  selectedTrialFeatures: string[];
  trialPreferences: {
    autoStartTrials: boolean;
    notificationFrequency: 'immediate' | 'daily' | 'weekly';
    preferredPaymentMethod: 'google-pay' | 'stripe' | 'vipps';
};
  subscriptionPlan: {
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    paymentMethod: string;
} | null;
}

// Trial features available during onboarding
const TRIAL_FEATURES = {
  photographer: [
    'advanced-editing', 'ai-photo-enhancement', 'client-galleries', 'contract-management', 'invoice-automation', 'branding-tools',
  ],
  videographer: [
    'video-editing', 'motion-graphics', 'color-grading', 'client-galleries', 'contract-management', 'invoice-automation',
  ],
  music_producer: [
    'audio-editing', 'mastering-tools', 'collaboration', 'client-portal', 'contract-management', 'invoice-automation',
  ],
  designer: [
    'design-tools', 'brand-assets', 'client-presentations', 'contract-management', 'invoice-automation', 'branding-tools',
  ],
};

export default function UniversalOnboardingWithTrials({
  isOpen = true,
  onClose = () => {},
  profession = 'photographer',
}) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Use dynamic profession system
  const {
    professionConfigs,
    isLoading: professionsLoading,
    error: professionsError,
} = useDynamicProfessions();

  // Check for pending onboarding data from landing page submission (server-first)
  const [pendingData, setPendingData] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/user/kv/pendingOnboardingData,', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (mounted && v) {
          setPendingData(v);
          // Clear server copy
          fetch('/api/user/kv,', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ key: 'pendingOnboardingData', value: null })
          }).catch(() => {});
        } else {
          const stored = localStorage.getItem('pendingOnboardingData');
          if (stored) {
            setPendingData(JSON.parse(stored));
            localStorage.removeItem('pendingOnboardingData');
          }
        }
      } catch {
        const stored = localStorage.getItem('pendingOnboardingData');
        if (stored) {
          setPendingData(JSON.parse(stored));
          localStorage.removeItem('pendingOnboardingData');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    if (pendingData) setActiveStep(1);
  }, [pendingData]);
  const [orgValidationState, setOrgValidationState] = useState({
    loading: false,
    validated: false,
    error: null as string | null,
    companyData: null as any,
});

  const [onboardingData, setOnboardingData] = useState<OnboardingDataWithTrials>({
    profession: pendingData?.profession || profession,
    firstName: pendingData?.firstName ||'',
    lastName: pendingData?.lastName ||'',
    email: pendingData?.email ||'',
    phone: pendingData?.phone ||'',
    business: pendingData?.business ||'',
    companyName: pendingData?.business ||'',
    organizationNumber: pendingData?.organizationNumber ||'',
    businessAddress: pendingData?.businessAddress ||'',
    website: pendingData?.website ||'',
    selectedCameras:  [],
    selectedFlashSystems:  [],
    cloudProvider: '',
    socialMediaAccounts: {
      instagram: '',
      facebook: '',
      linkedin: '',
      youtube: '',
      website: pendingData?.website ||'',
  },
    brandingSettings: {
      primaryColor: professionConfigs?.[pendingData?.profession || profession]?.iconColor || '#ff8c00',
      businessType: '',
  },
    customLogo: '',
    workflowPreferences: {
      projectTypes: [],
      communicationStyle: 'professional',
      deliveryPreferences:  [],
  },
    // New trial-related fields
    selectedTrialFeatures:  [],
    trialPreferences: {
      autoStartTrials: true,
      notificationFrequency: 'daily',
      preferredPaymentMethod: 'google-pay',
  },
    subscriptionPlan: null,
});

  const [cameraSearchQuery, setCameraSearchQuery] = useState('');
  const [flashSearchQuery, setFlashSearchQuery] = useState('');
  const [equipmentTabValue, setEquipmentTabValue] = useState(0);
  const [trialTabValue, setTrialTabValue] = useState(0);

  // Trial feature states
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [selectedTrialFeature, setSelectedTrialFeature] = useState<string | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  const steps = [
    'Profesjonsvalg',
    'Profildetaljer',
    'Kamera- og Utstyrssystem',
    'Trial Funksjoner',
    'Cloud Integrering',
    'Sosiale Medier',
    'Branding Setup',
    'Arbeidsflyt Konfigurasjon',
  ];

  const selectedProfession = professionConfigs?.[onboardingData.profession];
  const availableTrialFeatures = TRIAL_FEATURES[onboardingData.profession as keyof typeof TRIAL_FEATURES] || [];

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async (profileData: OnboardingDataWithTrials) => {
      const response = await fetch('/api/universal-onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify(profileData),
    });
      if (!response.ok) throw new Error('Failed to complete onboarding');
      return response.json();
  },
    onSuccess: (data) => {
      // Start selected trial features
      if (onboardingData.selectedTrialFeatures.length > 0) {
        startSelectedTrials();
  }
      
      // Redirect to profession-specific dashboard
      window.location.href = `/?profession=${onboardingData.profession}`;
      if (onClose) onClose();
  },
});

  const startSelectedTrials = async () => {
    try {
      setTrialLoading(true);
      
      for (const featureId of onboardingData.selectedTrialFeatures) {
        // Start trial for each selected feature
        await fetch('/api/trial-features/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({
            featureId,
            userId: 'current-user', // This should come from auth context
            componentId: 'onboarding',
        }),
      });
    }
  } catch (error) {
      console.error('Error starting trials:', error);
  } finally {
      setTrialLoading(false);
  }
};

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleCompleteOnboarding();
  } else {
      setActiveStep((prev) => prev + 1);
  }
};

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
};

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboardingMutation.mutateAsync(onboardingData);
  } catch (error) {
      console.error('Onboarding completion error:', error);
  }
};

  const handleProfessionSelect = (professionId: string) => {
    setOnboardingData((prev) => ({
      ...prev,
      profession: professiond,
      brandingSettings: {
        ...prev.brandingSettings,
        primaryColor: professionConfigs?.[professionId]?.iconColor || '#ff8c00',
    },
      // Reset trial features when profession changes
      selectedTrialFeatures:  [],
  }));
};

  const handleTrialFeatureToggle = (featureId: string) => {
    setOnboardingData((prev) => ({
      ...prev,
      selectedTrialFeatures: prev.selectedTrialFeatures.includes(featureId)
        ? prev.selectedTrialFeatures.filter(id => id !== featureId)
        : [...prev.selectedTrialFeatures, featureId],
  }));
};

  const handleTrialFeatureSelect = (featureId: string) => {
    setSelectedTrialFeature(featureId);
    setShowTrialDialog(true);
};

  const canProceed = () => {
    switch (activeStep) {
      case 0: return onboardingData.profession !== ', ';
      case 1:
        return onboardingData.firstName && onboardingData.lastName && onboardingData.email;
      case 2:
        return onboardingData.selectedCameras.length > 0;
      case 3:
        return true; // Trial features are optional
      case 4:
        return onboardingData.cloudProvider !== ', ';
      case 5:
        return true; // Social media is optional
      case 6:
        return true; // Branding is optional
      case 7:
        return true; // Workflow preferences are optional
      default:
        return false;
}
};

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Profession selection (same as original)
        return (
          <Fade in>
            <Box>
              <Typography variant="h5" gutterBottom sx={{  textAlign: 'center', mb:  4  }}>
                Hvilken type kreativ profesjonell er du?
              </Typography>

              <Box>
                {professionsLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py:  4 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ ml:  2 }}>
                      Laster profesjoner...
                    </Typography>
                  </Box>
                )}

                {professionsError && (
                  <Alert severity="warning" sx={{ mb:  2 }}>
                    Kunne ikke laste profesjoner. Prøver med standard alternativer.
                  </Alert>
                )}

                {professionConfigs && (
                  <Grid container spacing={3} justifyContent="center">
                    {Object.entries(professionConfigs).map(([key, config]) => {
                      const isSelected = onboardingData.profession === key;

                      return (
                        <Grid item xs={12} sm={6} md={3} key={key}>
                          <Card
                            sx={{
                              cursor: 'pointer',
                              border: isSelected ? `3px solid ${config.iconColor}` : '1px solid transparent',
                              bgcolor: isSelected ? `${config.iconColor}15` : 'background.paper','&:hover': { transform: 'translateY(-4px)', boxShadow:  4 },
                              transition: 'all 0.2'}}
                            onClick={() => handleProfessionSelect(key)}
                          >
                            <CardContent sx={{ textAlign: 'center', py:  3 ,  ...theming.getThemedCardSx() }}>
                              <Avatar
                                sx={{
                                  bgcolor: config.iconColor,
                                  mx: 'auto',
                                  mb:  2,
                                  width:  64,
                                  height:  64}}
                              >
                                <Box sx={{ fontSize:  32, color: 'white'}}>
                                  {React.cloneElement(config.icon, { sx: { fontSize: 32} })}
                                </Box>
                              </Avatar>
                              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                                {config.displayName}
                              </Typography>
                              {isSelected && <CheckCircleIcon sx={{ color: config.iconColor, mt:  1 }} />}
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                  })}
                  </Grid>
                )}
              </Box>
            </Box>
          </Fade>
        );

      case 1: // Profile details (same as original)
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <PersonIcon sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                  {pendingData ? 'Bekreft din informasjon' : 'Profildetaljer'}
                </Typography>
              </Box>

              {/* Profile form content - same as original */}
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fornavn"
                    value={onboardingData.firstName}
                    onChange={(e) =>
                      setOnboardingData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Etternavn"
                    value={onboardingData.lastName}
                    onChange={(e) =>
                      setOnboardingData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="E-post"
                    type="email"
                    value={onboardingData.email}
                    onChange={(e) =>
                      setOnboardingData((prev) => ({ ...prev, email: e.target.value }))
                  }
                    required
                  />
                </Grid>
                {/* Add other profile fields as needed */}
              </Grid>
            </Box>
          </Fade>
        );

      case 2: // Equipment selection (same as original)
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <CameraIcon sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Kamera- og Utstyrssystem</Typography>
              </Box>

              <Typography variant="body1" color="textSecondary" sx={{ mb:  3 }}>
                Velg dine kameraer og flash-systemer så vi kan tilpasse alle funksjoner til ditt utstyr
              </Typography>

              {/* Equipment selection content - same as original */}
              <Alert severity="info" sx={{ mb:  3 }}>
                <Typography variant="body2">
                  <strong>Utstyr valgt: </strong> {onboardingData.selectedCameras.length} kameraer, {onboardingData.selectedFlashSystems.length} lyssystemer
                </Typography>
              </Alert>
            </Box>
          </Fade>
        );

      case 3: // NEW: Trial Features Selection
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <AutoAwesome sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Prøv Premium Funksjoner</Typography>
              </Box>

              <Typography variant="body1" color="textSecondary" sx={{ mb:  3 }}>
                Velg hvilke premium funksjoner du vil prøve gratis i 14 dager. Du kan alltid oppgradere senere.
              </Typography>

              <Tabs
                value={trialTabValue}
                onChange={(e, newValue) => setTrialTabValue(newValue)}
                sx={{ mb:  3 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Alle Funksjoner" />
                <Tab label="Redigering" />
                <Tab label="Kundehåndtering" />
                <Tab label="Automatisering" />
              </Tabs>

              <Grid container spacing={3}>
                {availableTrialFeatures.map((featureId) => {
                  const pricing = pricingService.getFeaturePricing(featureId);
                  const isSelected = onboardingData.selectedTrialFeatures.includes(featureId);

                  return (
                    <Grid item xs={12} sm={6} md={4} key={featureId}>
                      <TrialFeatureWithPricing
                        featureId={featureId}
                        componentId="onboarding"
                        variant="card"
                        showPricing={true}
                        onTrialStart={() => handleTrialFeatureSelect(featureId)}
                        onUpgradeRequired={() => handleTrialFeatureSelect(featureId)}
                      >
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: isSelected ? `2px solid ${selectedProfession?.color}` : '1px solid transparent',
                            bgcolor: isSelected ? `${selectedProfession?.color}10` : 'background.paper','&:hover': { boxShadow:  3 },
                            transition: 'all 0.2'}}
                          onClick={() => handleTrialFeatureToggle(featureId)}
                        >
                          <CardContent sx={theming.getThemedCardSx()}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleTrialFeatureToggle(featureId)}
                                color="primary"
                              />
                              <Box sx={{ flex:  1 }}>
                                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                                  {pricing?.name || featureId}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                                  {pricing?.description || 'Premium funksjon for din profesjon'}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                  <Chip label="14 dager gratis" size="small" color="primary" variant="outlined" />
                                  <Chip 
                                    label={pricingService.formatPrice(pricing?.pricing.monthly || 0)} 
                                    size="small" 
                                    color="success" 
                                    variant="outlined" 
                                  />
                                </Box>
                              </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', gap:  1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={theming.getThemedIcon('play')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTrialFeatureSelect(featureId);
                              }}
                              >
                                Prøv nå
                              </Button>
                              <Button size="small"
                                variant="contained"
                                startIcon={<Upgrade />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTrialFeatureSelect(featureId);
                              }}
                              >
                                Kjøp
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      </TrialFeatureWithPricing>
                    </Grid>
                  );
              })}
              </Grid>

              {/* Trial Preferences */}
              <Card sx={{ mt:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Trial Innstillinger
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={onboardingData.trialPreferences.autoStartTrials}
                            onChange={(e) =>
                              setOnboardingData((prev) => ({
                                ...prev,
                                trialPreferences: {
                                  ...prev.trialPreferences,
                                  autoStartTrials: e.target.checked,
                              },
                            }))
                          }
                          />
                      }
                        label="Start valgte trials automatisk"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Notifikasjonsfrekvens</InputLabel>
                        <Select
                          value={onboardingData.trialPreferences.notificationFrequency}
                          onChange={(e) =>
                            setOnboardingData((prev) => ({
                              ...prev,
                              trialPreferences: {
                                ...prev.trialPreferences,
                                notificationFrequency: e.target.value as any,
                            },
                          }))
                        }
                          label="Notifikasjonsfrekvens"
                        >
                          <MenuItem value="immediate">Umiddelbart</MenuItem>
                          <MenuItem value="daily">Daglig</MenuItem>
                          <MenuItem value="weekly">Ukentlig</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Selected Trials Summary */}
              {onboardingData.selectedTrialFeatures.length > 0 && (
                <Alert severity="success" sx={{ mt:  3 }}>
                  <Typography variant="body2">
                    <strong>Valgte trial funksjoner: </strong> {onboardingData.selectedTrialFeatures.length} funksjoner vil starte automatisk etter oppsett
                  </Typography>
                </Alert>
              )}
            </Box>
          </Fade>
        );

      // Other steps remain the same as original...
      case 4: // Cloud Integration
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <CloudIcon sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Cloud Integrering</Typography>
              </Box>
              {/* Cloud integration content */}
            </Box>
          </Fade>
        );

      case 5: // Social Media
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <SocialIcon sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Sosiale Medier (valgfritt)</Typography>
              </Box>
              {/* Social media content */}
            </Box>
          </Fade>
        );

      case 6: // Branding Setup
        return (
          <Fade in>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                <BrandingIcon sx={{ color: selectedProfession?.color, mr: 2, fontSize: 32}} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>Branding Setup (valgfritt)</Typography>
              </Box>
              {/* Branding content */}
            </Box>
          </Fade>
        );

      case 7: // Workflow Configuration
        return (
          <Fade in>
            <Box sx={{ textAlign: 'center'}}>
              <SettingsIcon sx={{ color: selectedProfession?.color, fontSize:  64, mb:  2 }} />
              <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                Klar til å fullføre oppsettet
              </Typography>

              <Typography variant="body1" color="textSecondary" sx={{ mb:  4 }}>
                Vi setter opp alle funksjoner basert på ditt valgte utstyr og preferanser
              </Typography>

              <Card sx={{ maxWidth: 60, mx: 'auto', p:  3 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Sammendrag av din profil
                </Typography>

                <List>
                  <ListItem>
                    <ListItemText primary="Profesjon" secondary={selectedProfession?.name} />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Navn"
                      secondary={`${onboardingData.firstName} ${onboardingData.lastName}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Kameraer"
                      secondary={`${onboardingData.selectedCameras.length} valgt`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Trial Funksjoner"
                      secondary={`${onboardingData.selectedTrialFeatures.length} valgt`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Cloud Provider"
                      secondary={onboardingData.cloudProvider || 'Ikke valgt'}
                    />
                  </ListItem>
                </List>
              </Card>
            </Box>
          </Fade>
        );

      default: return null;
}
};

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          maxHeight: '90vh',
      }}}
    >
      <DialogTitle>
        <Box sx={{ textAlign: 'center'}}>
          <Typography variant="h4"
            component="h1"
            gutterBottom
            sx={{ 
              color: selectedProfession?.color || '#ff6f00',
              fontWeight: 'bold',
              mb:  1 }}>
            Velkommen til CreatorHub Norge
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            La oss sette opp din personlige creative workspace
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px:  3, py:  2 }}>
        {/* Stepper */}
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card sx={{ minHeight: '400px',  ...theming.getThemedCardSx() }}>
          <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>{renderStepContent()}</CardContent>
        </Card>
      </DialogContent>

      <DialogActions sx={{ p:  3 }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || completeOnboardingMutation.isPending}
          startIcon={<ArrowBackIcon />}
          sx={{ minWidth: 120}}
        >
          Tilbake
        </Button>

        <Button variant="contained"
          onClick={handleNext}
          disabled={!canProceed() || completeOnboardingMutation.isPending}
          endIcon={
            completeOnboardingMutation.isPending ? (
              <CircularProgress size={20} />
            ) : activeStep === steps.length - 1 ? (
              <CheckIcon />
            ) : (
              <ArrowForwardIcon />
            )
        }
          sx={{
            minWidth: 120,
            bgcolor: selectedProfession?.color || 'primary.main',
            '&:hover': {
              bgcolor: selectedProfession?.color || 'primary.dark',
            },
          }}
        >
          {activeStep === steps.length - 1 ? 'Fullfør' : 'Neste'}
        </Button>
      </DialogActions>

      {/* Trial Activation Dialog */}
      {selectedTrialFeature && (
        <TrialActivationDialog
          open={showTrialDialog}
          feature={{
            id: selectedTrialFeature,
            name: pricingService.getFeaturePricing(selectedTrialFeature)?.name || selectedTrialFeature,
            description: pricingService.getFeaturePricing(selectedTrialFeature)?.description || '',
            benefits: pricingService.getFeaturePricing(selectedTrialFeature)?.benefits || [],
            trialDuration:  14,
            category: 'premium',
            color: selectedProfession?.color || '#ff6f00',
            icon: '⭐',
          }}
          onAccept={() => {
            handleTrialFeatureToggle(selectedTrialFeature);
            setShowTrialDialog(false);
            setSelectedTrialFeature(null);
        }}
          onDecline={() => {
            setShowTrialDialog(false);
            setSelectedTrialFeature(null);
        }}
          onUpgrade={() => {
            setShowTrialDialog(false);
            setSelectedTrialFeature(null);
        }}
          trialStatus={null}
          loading={trialLoading}
        />
      )}
    </Dialog>
  );
}
