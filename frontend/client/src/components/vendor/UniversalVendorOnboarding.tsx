import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Paper,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  CheckCircle,
  Store,
  Business,
  Palette,
  Upload,
  Settings,
  Launch,
  Info,
  Lightbulb,
  Category,
  Payment,
  Security,
  CloudUpload,
  Analytics,
  Image,
  VerifiedUser,
  Warning,
  AccountBalance,
  Receipt,
  Sync,
  AutoAwesome
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig, getProductCategories } from '@shared/vendor-type-registry';
import PlanFeaturePreview from '../subscription/PlanFeaturePreview';

interface UniversalVendorOnboardingProps {
  vendorType: string;
  vendorName: string;
  userId: string;
  inviteRequestId?: string; // From landing-mobile invite request
  inviteToken?: string; // Token for fetching invite request data
  onComplete?: (data: any) => void;
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

interface CategoryOption {
  id: string;
  label: string;
  color: string;
}

interface OnboardingStep {
  label: string;
  description: string;
  icon: any;
  required: boolean;
  fields?: {
    name: string;
    label: string;
    type: 'text' | 'email' | 'url' | 'textarea' | 'select' | 'checkbox' | 'category-select' | 'file' | 'integration';
    required?: boolean;
    options?: string[];
    categoryOptions?: CategoryOption[];
  }[];
}

export default function UniversalVendorOnboarding({
  vendorType,
  vendorName,
  userId,
  inviteRequestId,
  inviteToken,
  onComplete,
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
}: UniversalVendorOnboardingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [orgValidation, setOrgValidation] = useState<{
    isValid: boolean;
    companyName?: string;
    error?: string;
} | null>(null);
  
  const queryClient = useQueryClient();
  
  // Profession wiring (API configs + adapter)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const activeProfession = professionAdapter.profession || 'vendor';
  const enhancedProfessionConfig = apiProfessionConfigs?.[activeProfession];
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || activeProfession;
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionIcon = getProfessionIcon(activeProfession);

  // Theming system
  const theming = useTheming(activeProfession);
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch invite request data if ID and token provided (for pre-populating onboarding)
  const { data: inviteRequest } = useQuery({
    queryKey: ['/api/invites/request', inviteRequestId, inviteToken],
    queryFn: async () => {
      const response = await apiRequest(`/api/invites/request/${inviteRequestId}?token=${inviteToken}`);
      return response.json();
    },
    enabled: !!inviteRequestId && !!inviteToken
  });

  // Pre-populate form data from invite request
  useEffect(() => {
    if (inviteRequest) {
      setFormData((prev) => ({
        ...prev,
        organizationNumber: inviteRequest.orgNumber || prev.organizationNumber,
        businessName: inviteRequest.businessName || prev.businessName,
        contactEmail: inviteRequest.contactEmail || prev.contactEmail,
        phone: inviteRequest.contactPhone || prev.phone,
        website: inviteRequest.websiteUrl || prev.website,
        description: inviteRequest.businessDescription || prev.description,
      }));
      // If org number is provided, auto-validate
      if (inviteRequest.orgNumber && !orgValidation) {
        setOrgValidation({
          isValid: true,
          companyName: inviteRequest.businessName,
        });
      }
    }
  }, [inviteRequest]);

  // Validate organization number mutation
  const validateOrgMutation = useMutation({
    mutationFn: async (orgNumber: string) => {
      return apiRequest('/api/vendor-onboarding/validate-org', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify({ 
          organizationNumber: orgNumber,
          inviteRequestId
      })
    });
  },
    onSuccess: (data) => {
      setOrgValidation(data);
      if (data.isValid && data.companyName) {
        handleFieldChange('businessName', data.companyName);
    }
  },
    onError: (error) => {
      setOrgValidation({
        isValid: false,
        error: 'Kunne ikke validere organisasjonsnummer'
  });
  }
});

  // Get vendor-specific onboarding steps
  const getOnboardingSteps = (): OnboardingStep[] => {
    const baseSteps: OnboardingStep[] = [
      {
        label: 'Virksomhetsvalidering',
        description: 'Valider organisasjonsnummer fra landing-mobile invite request',
        icon: VerifiedUser,
        required: true,
        fields: [
          { name: 'organizationNumber', label: 'Organisasjonsnummer', type: 'text', required: true },
          { name: 'businessName', label: 'Firmanavn (fra Brønnøysund, )', type: 'text', required: true },
          { name: 'verifyBrreg', label: 'Verifiser mot Brønnøysundregistrene', type: 'checkbox', required: true }
        ]
    },
      {
        label: 'Logo & Profil',
        description: 'Last opp bedriftslogo og kontaktinformasjon',
        icon: Image,
        required: true,
        fields: [
          { name: 'logo', label: 'Bedriftslogo', type: 'file', required: true },
          { name: 'contactEmail', label: 'Kontakt E-post', type: 'email', required: true },
          { name: 'website', label: 'Nettside', type: 'url',},
          { name: 'description', label: 'Beskrivelse', type: 'textarea', required: true },
          { name: 'phone', label: 'Telefon', type: 'text',}
        ]
    },
      {
        label: 'Produktkategorier',
        description: `Velg hvilke ${vendorConfig?.name.toLowerCase()} kategorier du tilbyr`,
        icon: Category,
        required: true,
        fields: [
          {
            name: 'categories',
            label: 'Produktkategorier',
            type: 'category-select',
            required: true,
            // Use dynamic categories from registry with full config (id, label, color)
            categoryOptions: getProductCategories(vendorType)
          }
        ]
      }
    ];

    // Add vendor-specific steps
    switch (vendorType) {
      case 'print':
        baseSteps.push(
          {
            label: 'Design Assets',
            description: 'Last opp dine design-maler og ressurser',
            icon: Palette,
            required: false,
            fields: [
              { name: 'designStyles', label: 'Design Stiler', type: 'textarea',},
              { name: 'fileFormats', label: 'Filformater', type: 'text',},
              { name: 'printSizes', label: 'Print Størrelser', type: 'text',}
            ]
        },
          {
            label: 'Printing Setup',
            description: 'Konfigurer print-tjenester og leveringsmuligheter',
            icon: Settings,
            required: true,
            fields: [
              { name: 'shippingRegions', label: 'Leveringsområder', type: 'text', required: true },
              { name: 'printingPartners', label: 'Print Partnere', type: 'text',},
              { name: 'turnaroundTime', label: 'Leveringstid (dager, )', type: 'text', required: true }
            ]
        }
        );
        break;

      case 'audio':
        baseSteps.push(
          {
            label: 'Audio Samples',
            description: 'Last opp dine audio samples og presets',
            icon: CloudUpload,
            required: false,
            fields: [
              { name: 'audioFormats', label: 'Audio Formater', type: 'text',},
              { name: 'samplePacks', label: 'Sample Pakker', type: 'textarea',},
              { name: 'pluginCompatibility', label: 'Plugin Kompatibilitet', type: 'text',}
            ]
        },
          {
            label: 'Music Licensing',
            description: 'Sett opp lisensering og royalty-fri alternativer',
            icon: Security,
            required: true,
            fields: [
              { name: 'licensingType', label: 'Lisens Type', type: 'select', options: ['Royalty-Free','Commercial','Extended'], required: true },
              { name: 'usageRights', label: 'Bruksrettigheter', type: 'textarea', required: true }
            ]
          }
        );
        break;

      case 'design':
        baseSteps.push(
          {
            label: 'Creative Tools',
            description: 'Spesifiser hvilke design-verktøy du støtter',
            icon: Palette,
            required: true,
            fields: [
              { name: 'softwareSupport', label: 'Software Støtte', type: 'text', required: true },
              { name: 'brushStyles', label: 'Pensel Stiler', type: 'textarea',},
              { name: 'textureTypes', label: 'Tekstur Typer', type: 'text',}
            ]
        }
        );
        break;

      case 'software':
        baseSteps.push(
          {
            label: 'Technical Specs',
            description: 'Spesifiser tekniske krav og kompatibilitet',
            icon: Settings,
            required: true,
            fields: [
              { name: 'platforms', label: 'Plattformer', type: 'text', required: true },
              { name: 'systemRequirements', label: 'Systemkrav', type: 'textarea', required: true },
              { name: 'apiIntegrations', label: 'API Integrasjoner', type: 'text',}
            ]
        }
        );
        break;

      case 'hardware':
        baseSteps.push(
          {
            label: 'Product Catalog',
            description: 'Legg til dine hardware produkter',
            icon: Store,
            required: true,
            fields: [
              { name: 'productCategories', label: 'Produkt Kategorier', type: 'text', required: true },
              { name: 'warranty', label: 'Garanti (måneder, )', type: 'text', required: true },
              { name: 'shippingOptions', label: 'Frakt Alternativer', type: 'textarea', required: true }
            ]
        }
        );
        break;

      default: // Add generic step for new vendor types
        baseSteps.push({
          label: 'Produktoppsett',
          description: 'Konfigurer dine produkter og tjenester',
          icon: Store,
          required: true,
          fields: [
            { name: 'productTypes', label: 'Produkt Typer', type: 'text', required: true },
            { name: 'serviceAreas', label: 'Tjenesteområder', type: 'textarea',}
          ]
      });
  }

    // Add Fiken integration step (optional but recommended)
    baseSteps.push({
      label: 'Fiken Integrasjon',
      description: 'Koble til Fiken for automatisk fakturering og regnskap',
      icon: AccountBalance,
      required: false,
      fields: [
        {
          name: 'fikenIntegration',
          label: 'Fiken Regnskapsintegrasjon',
          type: 'integration',
          required: false
        }
      ]
    });

    // Always add payment and launch steps
    baseSteps.push(
      {
        label: 'Betalingsoppsett',
        description: 'Konfigurer betalingsmetoder og priser',
        icon: Payment,
        required: true,
        fields: [
          { name: 'paymentMethods', label: 'Betalingsmetoder', type: 'select', options: ['Stripe','PayPal','Bankoverføring'], required: true },
          { name: 'currency', label: 'Valuta', type: 'select', options: ['NOK','EUR','USD'], required: true },
          { name: 'taxId', label: 'MVA Nummer', type: 'text' }
        ]
    },
      {
        label: 'Lansering',
        description: 'Aktiver din vendor profil og gå live',
        icon: Launch,
        required: true,
        fields: [
          { name: 'termsAccepted', label: 'Jeg aksepterer vilkårene', type: 'checkbox', required: true },
          { name: 'readyToLaunch', label: 'Klar for lansering', type: 'checkbox', required: true }
        ]
    }
    );

    return baseSteps;
};

  const steps = getOnboardingSteps();

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/vendor-onboarding/complete', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POS',
        body: JSON.stringify({
          vendorType,
          vendorName,
          userId,
          onboardingData: data
    })
    });
  },
    onSuccess: (data) => {
      console.log('Vendor onboarding completed: ', data);
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-dashboard', ],});
      if (onComplete) {
        onComplete(data);
    }
  }
});

  const handleNext = () => {
    setCompletedSteps(prev => new Set([...prev, activeStep]));
    setActiveStep(prev => prev + 1);
};

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
};

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
  }));
};

  const isStepComplete = (stepIndex: number): boolean => {
    const step = steps[stepIndex];
    if (!step.fields) return true;
    
    return step.fields.every(field => {
      if (!field.required) return true;
      const value = formData[field.name];
      return value !== undefined && value !== ', ' && value !== false;
});
};

  const handleCompleteOnboarding = async () => {
    let finalFormData = { ...formData };
    
    // Upload logo if present
    if (logoFile) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const logoBase64 = e.target?.result as string;
          
          const logoResponse = await apiRequest('/api/vendor-onboarding/upload-logo', {
            headers: {
              "Content-Type" : "application/json"
            },
            method: 'POST',
            body: JSON.stringify({
              userId,
              vendorType,
              logoBase64,
              fileName: logoFile.name
            })
          });

          if (logoResponse.success) {
            finalFormData.logoUrl = logoResponse.logoUrl;
            finalFormData.logoFileName = logoResponse.fileName;
          }

          completeOnboardingMutation.mutate(finalFormData);
      };
        reader.readAsDataURL(logoFile);
    } catch (error) {
        console.error('Error uploading logo: ', error);
        // Continue with onboarding even if logo upload fails
        completeOnboardingMutation.mutate(finalFormData);
    }
  } else {
      completeOnboardingMutation.mutate(finalFormData);
  }
};

  const progress = (completedSteps.size / steps.length) * 100;

  if (!vendorConfig) {
    return (
      <Alert severity="error">
        Ukjent vendor type: {vendorType}
      </Alert>
    );
}

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{
        p: 3,
        mb: 3,
        background: `linear-gradient(135deg, ${vendorConfig.color}15 0%, ${vendorConfig.color}05 100%)`,
        border: `1px solid ${vendorConfig.color}30`,
        ...theming.getThemedCardSx()
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar sx={{
            bgcolor: vendorConfig.color,
            width: 80,
            height: 80,
            fontSize: '2rem'
          }}>
            {React.createElement(vendorConfig.icon)}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
              Velkommen til {vendorConfig.name}
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
              Universal Vendor Onboarding for {vendorName}
              {inviteRequestId && (
                <Chip
                  label={`Invite: ${inviteRequestId.slice(0, 8)}`}
                  size="small"
                  sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                />
              )}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {React.cloneElement(professionIcon as any, {
                  sx: { color: professionColor, fontSize: 18 }
                })}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: `${vendorConfig.color}20`,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: vendorConfig.color
                  }
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 60 }}>
                {Math.round(progress)}% ferdig
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Feature Preview - Show what features user will get with their plan */}
      {inviteRequest?.profession && inviteRequest?.selectedPlan && (
        <Paper sx={{
          p: 3,
          mb: 3,
          border: `1px solid ${vendorConfig.color}30`,
          ...theming.getThemedCardSx()
        }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
            📦 Funksjoner inkludert i din plan
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Basert på din profesjon ({inviteRequest.profession}) og valgte plan ({inviteRequest.planName || inviteRequest.selectedPlan})
          </Typography>
          <PlanFeaturePreview
            profession={inviteRequest.profession}
            selectedPlan={inviteRequest.selectedPlan}
            showLocked={true}
            showDetails={true}
            maxFeatures={8}
          />
        </Paper>
      )}

      {/* Onboarding Steps */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }} md={4}>
          {/* Step Navigation */}
          <Card sx={{ position: 'sticky', top: 20, ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                Onboarding Steg
              </Typography>

              <List dense>
                {steps.map((step, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      mb: 1,
                      bgcolor: activeStep === index ? `${vendorConfig.color}10` : 'transparent','&:hover': { bgcolor: `${vendorConfig.color}05` }
                    }}
                    onClick={() => setActiveStep(index)}
                  >
                    <ListItemIcon>
                      <Avatar sx={{
                        width: 32,
                        height: 32,
                        bgcolor: completedSteps.has(index) ? 'success.main' :
                                activeStep === index ? vendorConfig.color : 'grey.300',
                        fontSize: '1rem'
                      }}>
                        {completedSteps.has(index) ? (
                          <CheckCircle sx={{ fontSize: 18 }} />
                        ) : (
                          React.createElement(step.icon, { sx: { fontSize: 18 } })
                        )}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={step.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: ctiveStep === index ? 600 : 400,
                        color: activeStep === index ? vendorConfig.color : 'text.primary'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} md={8}>
          {/* Current Step Content */}
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar sx={{ bgcolor: vendorConfig.color }}>
                  {React.createElement(steps[activeStep]?.icon)}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {steps[activeStep]?.label}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {steps[activeStep]?.description}
                  </Typography>
                </Box>
              </Box>

              {steps[activeStep]?.required && (
                <Chip
                  label="Påkrevd"
                  size="small"
                  color="error"
                  sx={{ mb: 3 }}
                />
              )}

              {/* Step Fields */}
              {steps[activeStep]?.fields && (
                <Box sx={{ mb: 3 }}>
                  <Grid container spacing={3}>
                    {steps[activeStep].fields!.map((field, fieldIndex) => (
                      <Grid size={{ xs: 12 }} sm={field.type === 'textarea' ? 12 : 6} key={fieldIndex}>
                        {field.type === 'checkbox' && field.options ? (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>
                              {field.label}
                            </Typography>
                            {field.options.map((option, optionIndex) => (
                              <FormControlLabel
                                key={optionIndex}
                                control={
                                  <Checkbox
                                    checked={formData[field.name]?.includes(option) || false}
                                    onChange={(e) => {
                                      const currentValues = formData[field.name] || [];
                                      const newValues = e.target.checked
                                        ? [...currentValues, option]
                                        : currentValues.filter((v: string) => v !== option);
                                      handleFieldChange(field.name, newValues);
                                  }}
                                  />
                              }
                                label={option}
                              />
                            ))}
                          </Box>
                        ) : field.type === 'checkbox' ? (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={formData[field.name] || false}
                                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                              />
                          }
                            label={field.label}
                          />
                        ) : field.type === 'category-select' && field.categoryOptions ? (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 2 }}>
                              {field.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {field.categoryOptions.map((category) => {
                                const isSelected = formData[field.name]?.includes(category.id) || false;
                                return (
                                  <Chip
                                    key={category.id}
                                    label={category.label}
                                    onClick={() => {
                                      const currentValues = formData[field.name] || [];
                                      const newValues = isSelected
                                        ? currentValues.filter((v: string) => v !== category.id)
                                        : [...currentValues, category.id];
                                      handleFieldChange(field.name, newValues);
                                    }}
                                    icon={
                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          bgcolor: category.color,
                                          ml: 0.5
                                        }}
                                      />
                                    }
                                    sx={{
                                      bgcolor: isSelected ? `${category.color}20` : 'transparent',
                                      borderColor: category.color,
                                      border: isSelected ? `2px solid ${category.color}` : '1px solid',
                                      '&:hover': {
                                        bgcolor: `${category.color}30`
                                      }
                                    }}
                                    variant={isSelected ? 'filled' : 'outlined'}
                                  />
                                );
                              })}
                            </Box>
                            {formData[field.name]?.length > 0 && (
                              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'success.main' }}>
                                {formData[field.name].length} kategorier valgt
                              </Typography>
                            )}
                          </Box>
                        ) : field.type === 'integration' && field.name === 'fikenIntegration' ? (
                          <Box sx={{ gridColumn: 'span 2' }}>
                            <Card
                              variant="outlined"
                              sx={{
                                p: 3,
                                borderRadius: 2,
                                border: formData.fikenEnabled ? '2px solid' : '1px solid',
                                borderColor: formData.fikenEnabled ? 'primary.main' : 'divider',
                                bgcolor: formData.fikenEnabled ? 'primary.50' : 'background.paper',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {/* Fiken Header with Full Logo (Icon + Text) */}
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    mr: 2,
                                    p: 1.5,
                                    bgcolor: 'white',
                                    borderRadius: 2,
                                    boxShadow: 1
                                  }}
                                >
                                  {/* Official Fiken Logo - Icon */}
                                  <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12.462,15.174C11.743,15.174 11.055,14.892 10.548,14.391C10.041,13.89 9.757,13.211 9.759,12.504L9.759,11.471C9.752,5.672 14.515,0.962 20.405,0.944C22.528,0.941 24.603,1.568 26.359,2.743C27.573,3.575 27.884,5.212 27.058,6.421C26.233,7.629 24.576,7.962 23.335,7.169C22.471,6.591 21.45,6.283 20.405,6.285C17.504,6.295 15.16,8.616 15.164,11.471L15.164,12.509C15.166,13.216 14.882,13.894 14.375,14.395C13.868,14.896 13.18,15.178 12.462,15.179" fill="#75ABF7"/>
                                    <path d="M21.45,17.681L15.161,17.681L15.161,11.472C15.195,10.5 14.688,9.587 13.838,9.092C12.989,8.596 11.932,8.596 11.082,9.092C10.233,9.587 9.725,10.5 9.759,11.472L9.759,17.686L3.47,17.686C1.972,17.686 0.758,18.881 0.758,20.356C0.758,21.831 1.972,23.027 3.47,23.027L9.759,23.027L9.759,29.241C9.735,30.206 10.245,31.109 11.091,31.599C11.937,32.088 12.985,32.088 13.831,31.599C14.677,31.109 15.187,30.206 15.163,29.241L15.163,23.022L21.452,23.022C22.95,23.022 24.164,21.826 24.164,20.352C24.164,18.877 22.95,17.681 21.452,17.681" fill="#5239BA"/>
                                  </svg>
                                  {/* Fiken text */}
                                  <Typography
                                    variant="h5"
                                    sx={{
                                      ml: 1,
                                      fontWeight: 50,
                                      color: '#5239BA',
                                      fontFamily: 'system-ui, -apple-system, sans-serif',
                                      letterSpacing: '-0.02em'
                                    }}
                                  >
                                    fiken
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="h6" fontWeight="bold">
                                    Regnskapsintegrasjon
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Norges mest populære regnskapsprogram for små bedrifter
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Description */}
                              <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                                Koble din CreatorHub-konto til Fiken for å automatisere fakturering og regnskap.
                                Vi kan aktivere denne integrasjonen for deg slik at du slipper manuelt arbeid.
                              </Typography>

                              {/* Benefits List */}
                              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
                                Fordeler med Fiken-integrasjon:
                              </Typography>
                              <List dense sx={{ mb: 3 }}>
                                <ListItem sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Receipt color="primary" fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Automatisk fakturering"
                                    secondary="Fakturaer opprettes automatisk når kunder kjøper produktene dine"
                                  />
                                </ListItem>
                                <ListItem sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Sync color="primary" fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Synkronisering av kunder"
                                    secondary="Kundeinformasjon synkroniseres automatisk mellom plattformene"
                                  />
                                </ListItem>
                                <ListItem sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Analytics color="primary" fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="MVA-rapportering"
                                    secondary="Automatisk beregning og rapportering av merverdiavgift"
                                  />
                                </ListItem>
                                <ListItem sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 36 }}>
                                    <AutoAwesome color="primary" fontSize="small" />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Spar tid"
                                    secondary="Fokuser på det du gjør best - la oss håndtere regnskapet"
                                  />
                                </ListItem>
                              </List>

                              {/* Enable Toggle */}
                              <Divider sx={{ mb: 2 }} />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.fikenEnabled || false}
                                    onChange={(e) => handleFieldChange('fikenEnabled', e.target.checked)}
                                    color="primary"
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="body1" fontWeight="medium">
                                      Ja, jeg ønsker Fiken-integrasjon
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Vi kontakter deg for å sette opp tilkoblingen etter onboarding
                                    </Typography>
                                  </Box>
                                }
                              />

                              {formData.fikenEnabled && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                  Flott valg! Etter at du har fullført onboarding, vil vi kontakte deg for å koble
                                  din Fiken-konto. Du trenger en aktiv Fiken-konto for å bruke integrasjonen.
                                </Alert>
                              )}
                            </Card>
                          </Box>
                        ) : field.type === 'file' ? (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb:  2 }}>
                              {field.label}
                            </Typography>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none'}}
                              id={`file-upload-${field.name}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setLogoFile(file);
                                  handleFieldChange(field.name, file.name);
                              }
                            }}
                            />
                            <label htmlFor={`file-upload-${field.name}`}>
                              <Button
                                component="span"
                                variant="outlined"
                                startIcon={theming.getThemedIcon('cloudUpload')}
                                fullWidth
                                sx={{ mb: 2 }}
                              >
                                {logoFile ? logoFile.name : 'Velg fil'}
                              </Button>
                            </label>
                            {logoFile && (
                              <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <img
                                  src={URL.createObjectURL(logoFile)}
                                  alt="Logo preview"
                                  style={{
                                    maxWidth: '200px',
                                    maxHeight: '100px',
                                    objectFit: 'contain',
                                    border: '1px solid #ddd',
                                    borderRadius: '8px',
                                    padding: '8px'
                              }}
                                />
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Box>
                            <TextField
                              fullWidth
                              label={field.label}
                              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                              multiline={field.type === 'textarea'}
                              rows={field.type === 'textarea' ? 4 : 1}
                              required={field.required}
                              value={formData[field.name] || ', '}
                              onChange={(e) => {
                                handleFieldChange(field.name, e.target.value);
                                // Auto-validate org number
                                if (field.name === 'organizationNumber' && e.target.value.length === 9) {
                                  validateOrgMutation.mutate(e.target.value);
                              }
                            }}
                              select={field.type === 'select'}
                              SelectProps={field.type === 'select' ? { native: true } : undefined}
                              disabled={field.name === 'businessName' && orgValidation?.isValid}
                            >
                              {field.type === 'select' && field.options && [
                                <option key="" value="">Velg...</option>,
                                ...field.options.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))
                              ]}
                            </TextField>
                            
                            {/* Organization validation feedback */}
                            {field.name === 'organizationNumber' && formData[field.name] && (
                              <Box sx={{ mt:  1 }}>
                                {validateOrgMutation.isPending && (
                                  <Alert severity="info" sx={{ fontSize: '0.8rem'}}>
                                    Validerer organisasjonsnummer...
                                  </Alert>
                                )}
                                {orgValidation?.isValid && (
                                  <Alert severity="success" sx={{ fontSize: '0.8rem' }}>
                                    Gyldig organisasjonsnummer: {orgValidation.companyName}
                                  </Alert>
                                )}
                                {orgValidation?.error && (
                                  <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                                    {orgValidation.error}
                                  </Alert>
                                )}
                              </Box>
                            )}

                            {/* Invite request matching */}
                            {field.name === 'organizationNumber' && inviteRequest && (
                              <Alert
                                severity={formData[field.name] === inviteRequest.organizationNumber ? 'success' : 'warning'}
                                sx={{ mt: 1, fontSize: '0.8rem' }}
                              >
                                Sammenligner med invite request: {inviteRequest.organizationNumber}
                                {formData[field.name] === inviteRequest.organizationNumber ? ' (Match)' : ' (Avvik)'}
                              </Alert>
                            )}
                          </Box>
                        )}
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Step Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: 1, borderColor: 'divider'}}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                >
                  Tilbake
                </Button>
                
                {activeStep === steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleCompleteOnboarding}
                    disabled={!isStepComplete(activeStep) || completeOnboardingMutation.isPending}
                    sx={{ bgcolor: vendorConfig.color, '&:hover': { bgcolor: vendorConfig.color }, ...theming.getThemedButtonSx() }}
                  >
                    {completeOnboardingMutation.isPending ? 'Fullfører...' : 'Fullfør Onboarding'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={!isStepComplete(activeStep)}
                    sx={{ bgcolor: vendorConfig.color, '&:hover': { bgcolor: vendorConfig.color }, ...theming.getThemedButtonSx() }}
                  >
                    Neste
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}